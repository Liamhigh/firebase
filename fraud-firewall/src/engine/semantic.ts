// CONSTITUTION: v5.2.7 — Semantic Analyzer
// Ported from Python verum_contradiction_engine_v529.py Section 3
// Deterministic word embeddings + negation detection — no external ML dependencies

import type { Claim } from "./types.js";

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "shall", "can", "need",
  "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
  "and", "but", "if", "or", "because", "not", "no", "this", "that",
]);

const EMBEDDING_DIM = 100;

/** Deterministic tokenization — same input = same tokens, always */
function tokenize(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, " ");
  return cleaned
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Deterministic word embedding using character hashing.
 * Same text always produces the same embedding vector — no randomness.
 */
function embed(text: string, cache: Map<string, number[]>): number[] {
  if (cache.has(text)) return cache.get(text)!;

  const tokens = tokenize(text);
  if (tokens.length === 0) return new Array(EMBEDDING_DIM).fill(0.0);

  const embedding = new Array(EMBEDDING_DIM).fill(0.0);
  for (const token of tokens) {
    for (let i = 0; i < token.length; i++) {
      const idx = (token.charCodeAt(i) + i * 31) % EMBEDDING_DIM;
      embedding[idx] += 1.0;
    }
  }

  // L2 normalization
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      embedding[i] /= norm;
    }
  }

  cache.set(text, embedding);
  return embedding;
}

/** Cosine similarity between two text strings — deterministic */
export function cosineSimilarity(textA: string, textB: string): number {
  const cache = new Map<string, number[]>();
  const embA = embed(textA, cache);
  const embB = embed(textB, cache);
  let dot = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) dot += embA[i] * embB[i];
  return dot;
}

const NEGATORS = new Set([
  "no", "not", "never", "none", "nobody", "nothing", "neither",
  "nowhere", "hardly", "scarcely", "barely", "deny", "denies",
  "denied", "refuse", "refuses", "rejected", "false", "incorrect",
  "wrong", "without", "lacks", "missing", "absent",
]);

const OPPOSITES: [string, string][] = [
  ["exists", "does not exist"],
  ["has", "does not have"],
  ["true", "false"],
  ["yes", "no"],
  ["agreed", "denied"],
  ["paid", "unpaid"],
  ["valid", "invalid"],
  ["signed", "unsigned"],
  ["binding", "non-binding"],
  ["accepted", "rejected"],
];

/** Detect negation between two text strings */
export function negationScore(textA: string, textB: string): number {
  let score = 0.0;
  const aHasNeg = [...NEGATORS].some((n) => textA.includes(n));
  const bHasNeg = [...NEGATORS].some((n) => textB.includes(n));
  if (aHasNeg !== bHasNeg) score += 0.4;

  for (const [pos, neg] of OPPOSITES) {
    if (
      (textA.includes(pos) && textB.includes(neg)) ||
      (textA.includes(neg) && textB.includes(pos))
    ) {
      score += 0.6;
    }
  }
  return Math.min(1.0, score);
}

/**
 * Detect semantic contradiction between two claims.
 * Returns [isContradiction, confidenceScore].
 */
export function detectSemanticContradiction(
  claimA: Claim,
  claimB: Claim,
): [boolean, number] {
  const textA = claimA.value.toLowerCase();
  const textB = claimB.value.toLowerCase();
  const similarity = cosineSimilarity(textA, textB);
  const neg = negationScore(textA, textB);
  const sameSubject = claimA.subject === claimB.subject;

  if (sameSubject && similarity < 0.3 && neg > 0.5) return [true, 0.8];
  if (sameSubject && similarity < 0.5 && neg > 0.3) return [true, 0.6];
  if (neg > 0.7) return [true, 0.5];
  return [false, 0.0];
}
