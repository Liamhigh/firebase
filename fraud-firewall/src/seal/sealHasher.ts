// VO-DSS-1.2 — Verum Omnis Document Sealing Standard v1.2
// Firewall (TypeScript) port of seal-module/web/seal-document.html
// Source of truth: Liamhigh/webdocsol. Interoperable with web + Android.
//
// Dual-hash rule: SHA-256 anchors to Bitcoin via OpenTimestamps;
// SHA-512 is the Verum forensic fingerprint (footer + QR + Seal ID).

import { createHash } from "node:crypto";

/** SHA-256 of document bytes — used for the OpenTimestamps submission. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** SHA-512 of document bytes — the Verum forensic fingerprint. */
export function sha512Hex(bytes: Uint8Array): string {
  return createHash("sha512").update(bytes).digest("hex");
}

/** Seal ID derivation — identical on all platforms: VO- + first 12 hex chars, uppercased. */
export function sealIdFromSha512(sha512: string): string {
  return "VO-" + sha512.substring(0, 12).toUpperCase();
}

/** Hex string -> raw bytes (for OTS digest submission). */
export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return out;
}
