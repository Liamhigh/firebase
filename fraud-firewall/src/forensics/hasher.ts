import { sha512, shortCode } from "../core/crypto.js";
import type { ForensicDocument } from "../core/types.js";

/**
 * Page + line anchoring primitives for the forensic extraction engine.
 * Everything here is deterministic: identical input always yields identical
 * hashes, atom ids, and line ranges (Constitution v6.0.0 offline requirement).
 */

export interface PageText {
  page: number;
  text: string;
}

export interface LineIndex {
  /** 1-based line number. */
  line: number;
  /** Inclusive start char offset within the page text. */
  start: number;
  /** Exclusive end char offset within the page text (excludes newline). */
  end: number;
  text: string;
}

/** Normalise a document into page-segmented text. */
export function toPages(doc: ForensicDocument): PageText[] {
  if (doc.pages && doc.pages.length > 0) {
    return [...doc.pages]
      .sort((a, b) => a.page - b.page)
      .map((p) => ({ page: p.page, text: p.text }));
  }
  return [{ page: 1, text: doc.text ?? "" }];
}

/** Build a line index for a page so char offsets map back to line numbers. */
export function indexLines(text: string): LineIndex[] {
  const out: LineIndex[] = [];
  let offset = 0;
  let line = 1;
  for (const raw of text.split("\n")) {
    out.push({ line, start: offset, end: offset + raw.length, text: raw });
    offset += raw.length + 1; // +1 for the stripped newline
    line += 1;
  }
  return out;
}

/** Resolve a [start,end) char span to a "start-end" (1-based) line range. */
export function lineRangeFor(
  lines: LineIndex[],
  start: number,
  end: number,
): { first: number; last: number; range: string } {
  let first = lines[0]?.line ?? 1;
  let last = first;
  for (const li of lines) {
    if (start >= li.start && start <= li.end) first = li.line;
    if (end >= li.start && end <= li.end) last = li.line;
  }
  if (last < first) last = first;
  return { first, last, range: first === last ? `${first}` : `${first}-${last}` };
}

/** SHA-512 of verbatim atom content (128-char hex). */
export function hashContent(content: string): string {
  return sha512(content);
}

/**
 * Document fingerprint. Uses full page-joined text so re-hashing the same
 * source reproduces the digest.
 */
export function hashDocument(pages: PageText[]): string {
  const joined = pages.map((p) => `#p${p.page}\n${p.text}`).join("\n\f\n");
  return sha512(joined);
}

/** Deterministic Evidence Atom id derived from its content hash (spec §12.1). */
export function makeAtomId(
  evidenceId: string,
  page: number,
  contentHash: string,
): string {
  const seed = sha512(`${evidenceId}|${page}|${contentHash}`);
  return `EA-${shortCode(seed, 12)}`;
}

/** Deterministic contradiction id from the two atom ids it links (spec §12.2). */
export function makeContradictionId(atomIdA: string, atomIdB: string): string {
  const [lo, hi] = [atomIdA, atomIdB].sort();
  return `C-${shortCode(sha512(`${lo}|${hi}`), 10)}`;
}
