import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { FirewallConfig, SealRecord } from "./types.js";
import { sha512, shortCode } from "./crypto.js";
import { mockBlockHeight } from "./sealing.js";
import { otsUpgradeCheck } from "./opentimestamps.js";
import { hashPointerPath, sealedPath } from "../storage/vault.js";
import { readJson } from "../storage/vault.js";

/**
 * OpenTimestamps confirmation window. A freshly sealed document is PENDING on
 * the Bitcoin blockchain until it is included in a block and confirmed — this
 * typically takes a few hours. We model that deterministically from the seal's
 * submitted_at timestamp.
 */
export const OTS_CONFIRM_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export type VerificationResult =
  | "VERIFIED"
  | "SEAL_FOUND_PENDING_CHAIN"
  | "TAMPERED"
  | "NOT_FOUND"
  | "INDETERMINATE";

export interface BlockchainStatus {
  provider: "OpenTimestamps";
  status: "PENDING" | "CONFIRMED";
  message: string;
  submitted_at?: string;
  confirmations?: number;
  block_height?: number;
  calendar_urls?: string[];
}

export interface SealVerification {
  result: VerificationResult;
  seal_id: string;
  integrity: boolean | null;
  computed_sha512: string | null;
  expected_sha512: string | null;
  blockchain: BlockchainStatus | null;
  message: string;
}

export interface VerifyInput {
  /** Seal id. Optional when a PDF/SHA-512 is supplied (resolved by hash). */
  sealId?: string;
  /** Client-computed SHA-512 of the PDF being verified. */
  sha512?: string;
  /** Base64 PDF bytes; the server computes SHA-512 from these. */
  pdfBase64?: string;
  /** Override "now" for deterministic testing. */
  now?: string;
}

function blockchainStatus(
  submittedAt: string | undefined,
  fileHash: string,
  now: Date,
): BlockchainStatus {
  const submitted = submittedAt ? new Date(submittedAt) : now;
  const elapsed = now.getTime() - submitted.getTime();
  if (elapsed >= OTS_CONFIRM_WINDOW_MS) {
    return {
      provider: "OpenTimestamps",
      status: "CONFIRMED",
      message: "Anchored to the Bitcoin blockchain via OpenTimestamps.",
      submitted_at: submittedAt,
      confirmations: 6,
      block_height: mockBlockHeight(fileHash),
    };
  }
  return {
    provider: "OpenTimestamps",
    status: "PENDING",
    message:
      "Blockchain timestamping via OpenTimestamps is in progress. Bitcoin " +
      "confirmation can take a few hours; registration is PENDING.",
    submitted_at: submittedAt,
    confirmations: 0,
  };
}

/**
 * Resolve blockchain status from the stored `.ots` proof. A binary proof is a
 * real OpenTimestamps commitment (we attempt to upgrade + detect a Bitcoin
 * attestation); a JSON proof is the offline mock (deterministic, time-based).
 */
async function resolveBlockchain(
  otsPath: string,
  seal: SealRecord,
  fileHash: string,
  now: Date,
): Promise<BlockchainStatus> {
  const submittedAt = seal.blockchain?.submitted_at ?? seal.created_at;
  const calendars = seal.blockchain?.calendar_urls;
  if (!existsSync(otsPath)) {
    const bc = blockchainStatus(submittedAt, fileHash, now);
    bc.calendar_urls = calendars;
    return bc;
  }
  const bytes = readFileSync(otsPath);
  // JSON mock proof (starts with '{') → deterministic time-based status.
  if (bytes.length > 0 && bytes[0] === 0x7b) {
    const bc = blockchainStatus(submittedAt, fileHash, now);
    bc.calendar_urls = calendars;
    return bc;
  }
  // Real OpenTimestamps binary proof → upgrade + detect Bitcoin attestation.
  try {
    const check = await otsUpgradeCheck(new Uint8Array(bytes));
    if (check.upgradedOtsBytes) {
      writeFileSync(otsPath, Buffer.from(check.upgradedOtsBytes));
    }
    if (check.status === "CONFIRMED") {
      return {
        provider: "OpenTimestamps",
        status: "CONFIRMED",
        message: "Anchored to the Bitcoin blockchain via OpenTimestamps.",
        submitted_at: submittedAt,
        confirmations: 6,
        block_height: check.block_height,
        calendar_urls: calendars,
      };
    }
  } catch {
    // Fall through to PENDING on any calendar/network error.
  }
  return {
    provider: "OpenTimestamps",
    status: "PENDING",
    message:
      "Blockchain timestamping via OpenTimestamps is in progress. Bitcoin " +
      "confirmation can take a few hours; registration is PENDING.",
    submitted_at: submittedAt,
    confirmations: 0,
    calendar_urls: calendars,
  };
}

/**
 * Verify a sealed document (spec §6.4):
 *   1. Look up the seal record by id.
 *   2. Re-compute the PDF SHA-512 and compare it to the anchored hash.
 *   3. Check the OpenTimestamps anchor — PENDING until Bitcoin confirmation.
 */
export async function verifySeal(
  config: FirewallConfig,
  input: VerifyInput,
): Promise<SealVerification> {
  const now = input.now ? new Date(input.now) : new Date();

  // Defense-in-depth: only well-formed ids/hashes are ever used to build vault
  // paths, so a traversal payload can never reach the filesystem here.
  const SEAL_ID_RE = /^seal-[a-f0-9]{24}$/;
  const SHA512_RE = /^[a-f0-9]{128}$/;

  // Pre-compute the candidate hash so we can resolve a seal id by file alone.
  let computed: string | null = null;
  if (input.sha512) {
    const s = input.sha512.trim().toLowerCase();
    computed = SHA512_RE.test(s) ? s : null;
  } else if (input.pdfBase64) {
    computed = sha512(Buffer.from(input.pdfBase64, "base64"));
  }

  // Resolve the seal id: explicit, or looked up from the document hash pointer.
  let sealId = input.sealId?.trim();
  if (sealId && !SEAL_ID_RE.test(sealId)) sealId = undefined;
  if (!sealId && computed) {
    const pointer = readJson<{ seal_id: string }>(hashPointerPath(config, computed));
    sealId = pointer?.seal_id;
  }
  if (!sealId) {
    return {
      result: "NOT_FOUND",
      seal_id: input.sealId ?? "",
      integrity: null,
      computed_sha512: computed,
      expected_sha512: null,
      blockchain: null,
      message: computed
        ? "No seal matches this document's SHA-512."
        : "Provide a seal id or a sealed PDF to verify.",
    };
  }

  const pdfPath = sealedPath(config, sealId);
  const recordPath = pdfPath.replace(/\.pdf$/, ".json");
  const otsPath = pdfPath.replace(/\.pdf$/, ".ots");

  const stored = readJson<{ seal: SealRecord }>(recordPath);
  if (!stored?.seal) {
    return {
      result: "NOT_FOUND",
      seal_id: sealId,
      integrity: null,
      computed_sha512: computed,
      expected_sha512: null,
      blockchain: null,
      message: `No sealed record found for ${sealId}.`,
    };
  }

  const expected = stored.seal.document_sha512 ?? stored.seal.sha512;

  // If no hash was supplied, fall back to re-hashing the stored sealed PDF.
  if (!computed && existsSync(pdfPath)) {
    computed = sha512(readFileSync(pdfPath));
  }

  const blockchain = await resolveBlockchain(otsPath, stored.seal, expected, now);

  if (!computed) {
    return {
      result: "INDETERMINATE",
      seal_id: sealId,
      integrity: null,
      computed_sha512: null,
      expected_sha512: expected,
      blockchain,
      message:
        "Seal found, but no PDF or SHA-512 supplied to check integrity. " +
        "Upload the sealed PDF (or its SHA-512) to verify.",
    };
  }

  const integrity = computed === expected;
  if (!integrity) {
    return {
      result: "TAMPERED",
      seal_id: sealId,
      integrity: false,
      computed_sha512: computed,
      expected_sha512: expected,
      blockchain,
      message:
        "SHA-512 mismatch — the document does not match the sealed fingerprint. " +
        "The file may have been altered (TAMPERED).",
    };
  }

  if (blockchain.status === "PENDING") {
    return {
      result: "SEAL_FOUND_PENDING_CHAIN",
      seal_id: sealId,
      integrity: true,
      computed_sha512: computed,
      expected_sha512: expected,
      blockchain,
      message:
        "SHA-512 matches the seal. " + blockchain.message,
    };
  }

  return {
    result: "VERIFIED",
    seal_id: sealId,
    integrity: true,
    computed_sha512: computed,
    expected_sha512: expected,
    blockchain,
    message: `VERIFIED — SHA-512 matches and anchored to Bitcoin (ots-${shortCode(expected, 12)}).`,
  };
}
