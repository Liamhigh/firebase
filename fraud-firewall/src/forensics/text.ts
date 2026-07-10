/**
 * Shared deterministic text helpers for the forensic engine.
 * No network, no randomness — identical input yields identical output.
 */

export interface Sentence {
  text: string;
  /** Inclusive start char offset in the page text. */
  start: number;
  /** Exclusive end char offset in the page text. */
  end: number;
}

const TERMINATORS = new Set([".", "!", "?"]);

/** Split page text into sentences while preserving char offsets. */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (start === -1) {
      if (/\S/.test(ch)) start = i;
      continue;
    }
    if (TERMINATORS.has(ch)) {
      const raw = text.slice(start, i + 1);
      out.push({ text: raw.trim(), start, end: i + 1 });
      start = -1;
    }
  }
  if (start !== -1) {
    const raw = text.slice(start);
    if (raw.trim()) out.push({ text: raw.trim(), start, end: text.length });
  }
  return out;
}

export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
  "with", "by", "from", "as", "is", "was", "were", "are", "be", "been", "being",
  "that", "this", "these", "those", "it", "its", "he", "she", "they", "them",
  "his", "her", "their", "we", "you", "i", "which", "who", "whom", "whose",
  "had", "has", "have", "did", "does", "do", "will", "would", "shall", "should",
  "can", "could", "may", "might", "must", "into", "over", "under", "per",
  "about", "after", "before", "later", "then", "than", "so", "such", "same",
  "according", "per", "said", "stated", "reported", "recorded", "regarding",
]);

export const MONTHS = new Set([
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
]);

/**
 * Polarity / antonym tokens. Excluded from topic tokens (so they never inflate
 * overlap) and used to decide whether two claims about the same topic conflict.
 */
export const NEGATIVE_TOKENS = new Set([
  "no", "not", "never", "without", "failed", "fell", "collapsed", "denied",
  "cancelled", "canceled", "terminated", "false", "untrue", "rejected",
  "lost", "absent", "decreased", "declined", "abandoned", "void", "dismissed",
]);

export const POSITIVE_TOKENS = new Set([
  "proceeded", "completed", "succeeded", "confirmed", "agreed", "signed",
  "paid", "true", "approved", "won", "present", "increased", "accepted",
  "finalised", "finalized", "delivered", "concluded", "honoured", "honored",
]);

/** Explicit antonym pairs (either direction implies a conflict). */
export const ANTONYM_PAIRS: Array<[string, string]> = [
  ["fell", "proceeded"],
  ["cancelled", "completed"],
  ["canceled", "completed"],
  ["denied", "admitted"],
  ["false", "true"],
  ["rejected", "approved"],
  ["lost", "won"],
  ["absent", "present"],
  ["decreased", "increased"],
  ["terminated", "continued"],
];

const DATE_PATTERNS: RegExp[] = [
  /\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{2,4}\b/i,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{2,4}\b/i,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
];

export function hasDate(text: string): boolean {
  return DATE_PATTERNS.some((re) => re.test(text));
}

export function extractDates(text: string): string[] {
  const out: string[] = [];
  for (const re of DATE_PATTERNS) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) out.push(m[0].toLowerCase().replace(/,/g, ""));
  }
  return [...new Set(out)].sort();
}

const MONEY_RE = /\b(?:zar|usd|aed|eur|gbp|r|\$|€|£)?\s?\d[\d,]*(?:\.\d+)?\b/gi;

export function hasNumber(text: string): boolean {
  return /\d/.test(text);
}

/** Extract numeric values (commas stripped). Dates are excluded upstream. */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const m = text.match(MONEY_RE) ?? [];
  for (const token of m) {
    const cleaned = token.replace(/[^\d.]/g, "");
    if (!cleaned) continue;
    const n = Number(cleaned);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Significant topic tokens: lowercased, stopword/month/polarity-free, len>=3. */
export function topicTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (/^\d+$/.test(t)) continue;
    if (STOPWORDS.has(t)) continue;
    if (MONTHS.has(t)) continue;
    if (NEGATIVE_TOKENS.has(t)) continue;
    if (POSITIVE_TOKENS.has(t)) continue;
    out.add(t);
  }
  return out;
}

export function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n += 1;
  return n;
}

export type Polarity = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export function polarityOf(text: string): Polarity {
  const tokens = new Set(
    text.toLowerCase().replace(/[^a-z']/g, " ").split(/\s+/).filter(Boolean),
  );
  const neg = [...tokens].some(
    (t) => NEGATIVE_TOKENS.has(t) || t.endsWith("n't"),
  );
  const pos = [...tokens].some((t) => POSITIVE_TOKENS.has(t));
  if (neg && !pos) return "NEGATIVE";
  if (pos && !neg) return "POSITIVE";
  return "NEUTRAL";
}

/** Detect an explicit antonym pair spanning two texts. */
export function hasAntonymConflict(a: string, b: string): boolean {
  const ta = new Set(a.toLowerCase().replace(/[^a-z]/g, " ").split(/\s+/));
  const tb = new Set(b.toLowerCase().replace(/[^a-z]/g, " ").split(/\s+/));
  return ANTONYM_PAIRS.some(
    ([x, y]) => (ta.has(x) && tb.has(y)) || (ta.has(y) && tb.has(x)),
  );
}
