import { createRequire } from "node:module";
import { createHash } from "node:crypto";

/**
 * Thin wrapper around `javascript-opentimestamps` for real Bitcoin anchoring.
 *
 * The library is CommonJS with `this`-bound methods, so we load it via
 * createRequire and always call methods on the module object (never destructure).
 * All calls are network-bound and time-boxed; callers fall back to the offline
 * mock when the library or the calendars are unavailable.
 */

const require = createRequire(import.meta.url);
type OtsLib = {
  DetachedTimestampFile: {
    fromHash: (op: unknown, digest: Buffer) => OtsDetached;
    deserialize: (bytes: number[]) => OtsDetached;
  };
  Ops: { OpSHA256: new () => unknown };
  stamp: (detached: OtsDetached, options?: unknown) => Promise<void>;
  upgrade: (detached: OtsDetached) => Promise<boolean>;
  info: (detached: OtsDetached) => string;
};
interface OtsDetached {
  serializeToBytes: () => number[];
}

let cached: OtsLib | null = null;
function lib(): OtsLib {
  if (!cached) cached = require("javascript-opentimestamps") as OtsLib;
  return cached;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export interface OtsStampResult {
  otsBytes: Uint8Array;
  sha256: string;
}

/** Submit the PDF's SHA-256 to public OpenTimestamps calendars. */
export async function otsStamp(pdf: Uint8Array, timeoutMs = 20000): Promise<OtsStampResult> {
  const OT = lib();
  const sha256 = createHash("sha256").update(Buffer.from(pdf)).digest();
  const detached = OT.DetachedTimestampFile.fromHash(new OT.Ops.OpSHA256(), sha256);
  await withTimeout(OT.stamp(detached), timeoutMs, "ots.stamp");
  return {
    otsBytes: Uint8Array.from(detached.serializeToBytes()),
    sha256: sha256.toString("hex"),
  };
}

export interface OtsCheck {
  status: "PENDING" | "CONFIRMED";
  block_height?: number;
  /** Upgraded proof bytes when the anchor advanced (persist these). */
  upgradedOtsBytes?: Uint8Array;
}

const BITCOIN_ATTESTATION = /BitcoinBlockHeaderAttestation\((\d+)\)/;

/**
 * Attempt to upgrade a pending proof from the calendars and detect a Bitcoin
 * attestation. Fresh proofs are PENDING until included in a block (hours).
 */
export async function otsUpgradeCheck(
  otsBytes: Uint8Array,
  timeoutMs = 15000,
): Promise<OtsCheck> {
  const OT = lib();
  const detached = OT.DetachedTimestampFile.deserialize([...Buffer.from(otsBytes)]);
  let changed = false;
  try {
    changed = await withTimeout(OT.upgrade(detached), timeoutMs, "ots.upgrade");
  } catch {
    // Network/calendar failure — treat as still pending.
  }
  const info = OT.info(detached);
  const m = BITCOIN_ATTESTATION.exec(info);
  if (m) {
    return {
      status: "CONFIRMED",
      block_height: Number(m[1]),
      upgradedOtsBytes: Uint8Array.from(detached.serializeToBytes()),
    };
  }
  return {
    status: "PENDING",
    upgradedOtsBytes: changed ? Uint8Array.from(detached.serializeToBytes()) : undefined,
  };
}
