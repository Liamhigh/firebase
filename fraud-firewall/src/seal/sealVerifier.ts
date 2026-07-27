// VO-DSS-1.2 — Seal verifier (Firewall/TypeScript).
// Port of verify.html verifyFile(): read the seal from PDF Subject metadata,
// fall back to a raw-bytes scan, then compare against an expected SHA-512
// (e.g. from a scanned QR code) when supplied.

import { PDFDocument } from "pdf-lib";
import { sha512Hex } from "./sealHasher.js";
import { parseSealSubject, SEAL_KEYWORDS_PREFIX, type ParsedSealSubject } from "./sealChain.js";

export type VerificationVerdict =
  | "VERIFIED" // embedded seal matches the expected hash — document intact
  | "TAMPERED" // embedded seal does NOT match the expected hash
  | "SEAL_FOUND" // seal present, no expected hash to compare against
  | "NO_SEAL"; // no Verum Omnis seal detected

export interface SealVerification {
  verdict: VerificationVerdict;
  seal: ParsedSealSubject | null;
  metadataSource: "PDF Subject metadata" | "PDF content scan" | null;
  isEncrypted: boolean;
  expectedHash: string | null;
  /** SHA-512 recomputed over the uploaded bytes — shown on NO_SEAL, matching verify.html. */
  computedSha512: string | null;
  reason: string;
}

const RAW_SUBJECT_RE = /\(VO-SEAL\|([a-f0-9]{128})\|(VO-[A-F0-9]+)(\|CHAIN:[A-Z0-9,-]+)?\)/i;

/** Raw-bytes fallback — scans the file for the literal subject string. */
function scanRawBytes(pdfBytes: Uint8Array): ParsedSealSubject | null {
  const latin1 = Buffer.from(pdfBytes).toString("latin1");
  const m = latin1.match(RAW_SUBJECT_RE);
  if (!m) return null;
  const subject = `VO-SEAL|${m[1]}|${m[2]}${m[3] ?? ""}`;
  return parseSealSubject(subject);
}

/**
 * Verify a (possibly sealed) PDF.
 * @param expectedHash  Optional SHA-512 (full or prefix, e.g. from a scanned QR code).
 */
export async function verifySealedDocument(
  pdfBytes: Uint8Array,
  expectedHash?: string | null,
): Promise<SealVerification> {
  let seal: ParsedSealSubject | null = null;
  let metadataSource: SealVerification["metadataSource"] = null;
  let isEncrypted = false;

  try {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    isEncrypted = doc.isEncrypted;
    const subject = doc.getSubject();
    seal = parseSealSubject(subject);
    if (seal) {
      metadataSource = "PDF Subject metadata";
    } else {
      const keywords = doc.getKeywords();
      if (keywords && keywords.includes(SEAL_KEYWORDS_PREFIX)) {
        // Keywords confirm a seal but carry only the hash prefix — content scan for the full seal.
        const scanned = scanRawBytes(pdfBytes);
        if (scanned) {
          seal = scanned;
          metadataSource = "PDF content scan";
        }
      }
    }
  } catch {
    // Unparseable as PDF — fall through to raw scan.
  }

  if (!seal) {
    const scanned = scanRawBytes(pdfBytes);
    if (scanned) {
      seal = scanned;
      metadataSource = "PDF content scan";
    }
  }

  const expected = expectedHash ? expectedHash.toLowerCase() : null;

  if (expected && seal) {
    const match = seal.sha512.toLowerCase().startsWith(expected);
    return {
      verdict: match ? "VERIFIED" : "TAMPERED",
      seal,
      metadataSource,
      isEncrypted,
      expectedHash: expected,
      computedSha512: null,
      reason: match
        ? "The SHA-512 fingerprint embedded in this document matches the expected hash. The document has NOT been tampered with since it was sealed."
        : "The SHA-512 fingerprint does NOT match the expected hash. This document has been altered or corrupted since it was sealed — do not accept it.",
    };
  }

  if (seal) {
    return {
      verdict: "SEAL_FOUND",
      seal,
      metadataSource,
      isEncrypted,
      expectedHash: expected,
      computedSha512: null,
      reason:
        "A Verum Omnis seal was found embedded in this document. Compare the Seal ID and SHA-512 prefix with the footer printed on every page to confirm authenticity.",
    };
  }

  return {
    verdict: "NO_SEAL",
    seal: null,
    metadataSource: null,
    isEncrypted,
    expectedHash: expected,
    // verify.html parity: show the recomputed fingerprint so the user can
    // compare it with the footer/QR of the document they expected.
    computedSha512: sha512Hex(pdfBytes),
    reason:
      "No Verum Omnis seal metadata was detected. The document was not sealed by the Verum Omnis system, or the seal metadata was stripped in transit. Compare the recomputed SHA-512 of this file with the Seal ID on your document.",
  };
}
