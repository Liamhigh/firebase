import { createHash, randomBytes } from "node:crypto";

/** SHA-512 hex digest of arbitrary bytes or UTF-8 string. */
export function sha512(input: string | Buffer | Uint8Array): string {
  return createHash("sha512").update(input).digest("hex");
}

/** Deterministic short code from a hash prefix. */
export function shortCode(hash: string, len = 12): string {
  return hash.slice(0, len);
}

/** Seal ID format from spec: seal-<24 hex chars> */
export function makeSealId(hash: string): string {
  return `seal-${hash.slice(0, 24)}`;
}

/** Case reference: CASE-YYYY-NNNN */
export function makeCaseReference(date: Date, sequence: number): string {
  const yyyy = date.getUTCFullYear();
  const nnnn = String(sequence).padStart(4, "0");
  return `CASE-${yyyy}-${nnnn}`;
}

/** Alert ID: FA-NNN-YYYYMMDD */
export function makeAlertId(date: Date, sequence: number): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `FA-${String(sequence).padStart(3, "0")}-${ymd}`;
}

export function makeInvoiceId(sealShort: string): string {
  return `VO-COMM-${sealShort}`;
}

export function makeLogId(prefix: string, date: Date, sequence: number): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${String(sequence).padStart(3, "0")}-${ymd}`;
}

/** Non-forensic random id for runtime agent instances (not used in sealed hashes). */
export function runtimeId(bytes = 6): string {
  return randomBytes(bytes).toString("hex");
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return value;
}
