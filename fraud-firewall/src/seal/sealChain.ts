// VO-DSS-1.2 §8 — Seal Chain of Custody.
// A sealed PDF carries the seal in its Subject metadata:
//   VO-SEAL|<SHA512_128_HEX>|<SEAL_ID>[|CHAIN:VO-OLD1,VO-OLD2]
// Re-sealing a previously sealed document preserves the prior seal IDs so
// the full investigation timeline stays independently verifiable.

export const SEAL_SUBJECT_MAGIC = "VO-SEAL|";
export const SEAL_KEYWORDS_PREFIX = "verum,seal,";
export const SEAL_PRODUCER = "Verum Omnis Document Sealing Service v1.2";

export interface PreviousSeal {
  sealId: string;
  sha512: string | null;
  source: "Subject metadata" | "Chain history";
}

export interface ParsedSealSubject {
  sha512: string;
  sealId: string;
  chain: string[]; // previous seal IDs, excluding the current one
}

/** Parse a VO-SEAL subject string. Returns null when the document is unsealed. */
export function parseSealSubject(subject: string | null | undefined): ParsedSealSubject | null {
  if (!subject || !subject.startsWith(SEAL_SUBJECT_MAGIC)) return null;
  const parts = subject.split("|");
  if (parts.length < 3) return null;
  const sha512 = parts[1];
  const sealId = parts[2];
  let chain: string[] = [];
  if (parts.length >= 4 && parts[3].startsWith("CHAIN:")) {
    chain = parts[3].substring(6).split(",").filter((s) => s.length > 0);
  }
  return { sha512, sealId, chain };
}

/** Build the subject string for a new seal, preserving the prior chain. */
export function buildSealSubject(sha512: string, sealId: string, previousChain: string[]): string {
  const prior = previousChain.filter((id) => id && id !== sealId);
  const chainStr = prior.length > 0 ? "|CHAIN:" + prior.join(",") : "";
  return `${SEAL_SUBJECT_MAGIC}${sha512}|${sealId}${chainStr}`;
}

/** Keywords string, matching the web sealer. */
export function buildSealKeywords(sha512: string, sealType: string): string {
  return `${SEAL_KEYWORDS_PREFIX}${sha512.substring(0, 16)},${sealType}`;
}

/**
 * Flatten a parsed subject into the PreviousSeal[] shape the sealer/verify
 * pages display: the immediately-previous seal first, then older chain entries.
 */
export function previousSealsFromSubject(parsed: ParsedSealSubject | null): PreviousSeal[] {
  if (!parsed) return [];
  const out: PreviousSeal[] = [
    { sealId: parsed.sealId, sha512: parsed.sha512, source: "Subject metadata" },
  ];
  for (const oldId of parsed.chain) {
    if (oldId !== parsed.sealId) {
      out.push({ sealId: oldId, sha512: null, source: "Chain history" });
    }
  }
  return out;
}

/** All prior seal IDs carried by a subject (excluding the new seal's own ID). */
export function chainIdsFrom(parsed: ParsedSealSubject | null, newSealId: string): string[] {
  if (!parsed) return [];
  const ids = [parsed.sealId, ...parsed.chain];
  return ids.filter((id, i) => id && id !== newSealId && ids.indexOf(id) === i);
}
