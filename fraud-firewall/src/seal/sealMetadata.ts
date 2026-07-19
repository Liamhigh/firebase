// VO-DSS-1.2 — Seal metadata schema + QR verify-URL format.
// The QR code on every sealed page encodes:
//   https://verumglobal.foundation/verify.html?h=<SHA512_PREFIX_32>&m=<BASE64_METADATA>
// where BASE64_METADATA = encodeURIComponent(base64(JSON.stringify(meta))).
// Must stay byte-compatible with the web sealer and the Android port.

export const SEAL_FORMAT_VERSION = "1.2";
export const VERIFY_BASE_URL = "https://verumglobal.foundation/verify.html";

export type SealType = "private" | "commercial";

/** Optional sender identity — encoded in QR metadata only, never stored server-side. */
export interface SealIdentity {
  n?: string; // full name
  id?: string; // ID / passport number
  a?: string; // physical address
  e?: string; // contact email
}

/** QR metadata schema (README §"QR Code Format"). All identity fields optional. */
export interface SealMetadata {
  v: string; // seal format version — required
  t: number; // unix timestamp (ms) — required
  id?: SealIdentity;
  lock?: boolean; // password-protected flag
  gps?: string; // "lat,lng"
  acc?: number; // GPS accuracy in metres (rounded)
  dev?: string; // "Platform|Cores|Timezone"
  type: SealType; // required
  org?: string; // organisation name (commercial only)
}

export interface SealMetadataInput {
  timestampMs: number; // injected — constitution: never Date.now() deep in logic
  identity?: SealIdentity;
  lock?: boolean;
  gps?: { lat: string; lng: string; accuracy?: number } | null;
  device?: string | null; // pre-formatted "Platform|Cores|Timezone"
  sealType: SealType;
  org?: string;
}

/** Build the metadata object exactly as the web collectSealMetadata() does. */
export function collectSealMetadata(input: SealMetadataInput): SealMetadata {
  const meta: SealMetadata = { v: SEAL_FORMAT_VERSION, t: input.timestampMs, type: input.sealType };
  const id = input.identity;
  if (id && (id.n || id.id || id.a || id.e)) {
    meta.id = {};
    if (id.n) meta.id.n = id.n;
    if (id.id) meta.id.id = id.id;
    if (id.a) meta.id.a = id.a;
    if (id.e) meta.id.e = id.e;
  }
  if (input.lock) meta.lock = true;
  if (input.gps) {
    meta.gps = `${input.gps.lat},${input.gps.lng}`;
    if (input.gps.accuracy) meta.acc = Math.round(input.gps.accuracy);
  }
  if (input.device) meta.dev = input.device;
  if (input.sealType === "commercial" && input.org) meta.org = input.org;
  return meta;
}

/**
 * Encode metadata for the QR/verify URL: encodeURIComponent(base64(JSON)).
 * The web uses btoa(JSON.stringify(meta)) which is Latin-1 bound; for ASCII
 * content the outputs are identical. We base64 the UTF-8 bytes, which is the
 * correct generalisation (non-ASCII names survive the round-trip).
 */
export function encodeSealMetadata(meta: SealMetadata): string {
  const json = JSON.stringify(meta);
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return encodeURIComponent(b64);
}

/** Tolerant decode of the `m` parameter (percent-decoded base64 JSON). */
export function decodeSealMetadata(encoded: string): SealMetadata | null {
  try {
    const b64 = decodeURIComponent(encoded);
    const json = Buffer.from(b64, "base64").toString("utf8");
    const parsed = JSON.parse(json) as SealMetadata;
    if (typeof parsed !== "object" || parsed === null || !("v" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Build the QR / verify URL: ?h=<first 32 hex of SHA-512>&m=<encoded metadata>. */
export function buildVerifyUrl(sha512: string, meta?: SealMetadata): string {
  let url = `${VERIFY_BASE_URL}?h=${sha512.substring(0, 32)}`;
  if (meta) url += `&m=${encodeSealMetadata(meta)}`;
  return url;
}
