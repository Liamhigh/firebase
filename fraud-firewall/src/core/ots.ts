import { createHash } from "node:crypto";

/**
 * OpenTimestamps submission for seal records — REAL calendar submission,
 * no fabricated confirmations.
 *
 * Status contract (honest by construction):
 * - "PENDING"         — at least one public calendar accepted the digest.
 *                       The Bitcoin block height stays ABSENT until a real
 *                       confirmation is observed; it is never fabricated.
 * - "PENDING_OFFLINE" — no calendar could be reached (or network access is
 *                       disabled). The digest is still computed and stored
 *                       so the seal can be submitted later.
 */

/** Public OpenTimestamps calendar servers (free timestamping, no account). */
export const OTS_CALENDARS = [
  "https://alice.btc.calendar.opentimestamps.org",
  "https://bob.btc.calendar.opentimestamps.org",
] as const;

/** Timeout per calendar request. */
const OTS_TIMEOUT_MS = 10_000;

export interface OtsAttestation {
  calendar: string;
  /** Base64-serialised attestation returned by the calendar (upgradeable to a full .ots proof). */
  receipt_b64: string;
}

export interface OtsSubmission {
  status: "PENDING" | "PENDING_OFFLINE";
  /** SHA-256 hex digest that was (or would be) submitted to the calendars. */
  digest: string;
  attestations: OtsAttestation[];
  /** Operator-facing, honest explanation of the anchor status. */
  note: string;
}

export type OtsSubmitter = (sha512Hex: string) => Promise<OtsSubmission>;

/**
 * Digest submitted to OpenTimestamps: SHA-256 over the raw bytes of the
 * hexadecimal SHA-512 string (the seal fingerprint), matching the web
 * sealer's convention.
 */
export function otsDigest(sha512Hex: string): Buffer {
  return createHash("sha256").update(sha512Hex, "utf8").digest();
}

async function postDigest(calendar: string, digest: Buffer): Promise<OtsAttestation> {
  const res = await fetch(`${calendar}/digest`, {
    method: "POST",
    body: new Uint8Array(digest),
    headers: { "Content-Type": "application/octet-stream" },
    signal: AbortSignal.timeout(OTS_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`calendar ${calendar} answered HTTP ${res.status}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error(`calendar ${calendar} returned an empty attestation`);
  }
  return { calendar, receipt_b64: bytes.toString("base64") };
}

/**
 * Live submitter: POSTs the digest to the public OpenTimestamps calendars.
 * PENDING when at least one calendar accepted; PENDING_OFFLINE when none
 * could be reached. Never fabricates a block height or confirmation count.
 */
export const liveOtsSubmitter: OtsSubmitter = async (sha512Hex) => {
  const digest = otsDigest(sha512Hex);
  const digestHex = digest.toString("hex");
  const settled = await Promise.allSettled(
    OTS_CALENDARS.map((calendar) => postDigest(calendar, digest)),
  );
  const attestations = settled
    .filter((r): r is PromiseFulfilledResult<OtsAttestation> => r.status === "fulfilled")
    .map((r) => r.value);
  if (attestations.length > 0) {
    return {
      status: "PENDING",
      digest: digestHex,
      attestations,
      note:
        `submitted to ${attestations.length}/${OTS_CALENDARS.length} OpenTimestamps calendars; ` +
        "awaiting Bitcoin confirmation",
    };
  }
  const reasons = settled
    .map((r) => (r.status === "rejected" ? String(r.reason?.message ?? r.reason) : ""))
    .filter(Boolean)
    .join("; ");
  return {
    status: "PENDING_OFFLINE",
    digest: digestHex,
    attestations: [],
    note:
      `OpenTimestamps calendars unreachable (${reasons}); ` +
      "digest computed locally — resubmit for anchoring later",
  };
};

/**
 * Offline submitter: never touches the network. Produces an honest
 * PENDING_OFFLINE record. This is the default so tests and offline demos
 * stay deterministic; set VO_OTS_MODE=live for real submissions.
 */
export const offlineOtsSubmitter: OtsSubmitter = async (sha512Hex) => ({
  status: "PENDING_OFFLINE",
  digest: otsDigest(sha512Hex).toString("hex"),
  attestations: [],
  note:
    "offline mode — OpenTimestamps submission skipped " +
    "(set VO_OTS_MODE=live to submit to public calendars)",
});

/**
 * Resolve the effective submitter. An explicitly injected submitter always
 * wins (unit tests); otherwise VO_OTS_MODE=live enables real calendar
 * submission and anything else stays offline.
 */
export function resolveOtsSubmitter(custom?: OtsSubmitter): OtsSubmitter {
  if (custom) return custom;
  return process.env.VO_OTS_MODE === "live" ? liveOtsSubmitter : offlineOtsSubmitter;
}
