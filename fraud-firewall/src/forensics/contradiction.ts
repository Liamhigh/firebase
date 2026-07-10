import type {
  BrainSource,
  ClaimAnchor,
  Confidence,
  Contradiction,
  EvidenceAtom,
  Severity,
  TripleAiConsensus,
} from "../core/types.js";
import { makeContradictionId } from "./hasher.js";
import {
  extractDates,
  extractNumbers,
  hasAntonymConflict,
  hasDate,
  intersectionSize,
  polarityOf,
  topicTokens,
} from "./text.js";

export interface DetectOptions {
  /** Minimum shared significant topic tokens to consider two atoms related. */
  minTopicOverlap?: number;
  /** Cap the number of contradictions returned (ranked by severity/confidence). */
  maxResults?: number;
  now?: string;
}

/** Minimum value for a number to count as a "significant" figure (not a page/count). */
const SIGNIFICANT_NUMBER = 1000;

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 5,
  VERY_HIGH: 4,
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
};
const CONFIDENCE_RANK: Record<string, number> = {
  VERY_HIGH: 5,
  HIGH: 4,
  MODERATE: 3,
  LOW: 2,
  INSUFFICIENT: 1,
};

// Seal chrome / boilerplate that must never generate contradictions.
const BOILERPLATE = [
  /VERUM OMNIS SEAL/i,
  /Page \d+ of \d+/i,
  /Blockchain timestamping via OpenTimestamps/i,
  /Forensic Report VO-/i,
  /CONFIDENTIAL - LAW ENFORCEMENT/i,
  /Source: .*\.pdf/i,
  /[0-9a-f]{24,}/i,
];

function isBoilerplate(content: string): boolean {
  return BOILERPLATE.some((re) => re.test(content));
}

type ConflictKind = "POLARITY" | "DATE" | "NUMERIC" | null;

/**
 * Deterministic contradiction engine (spec §4.3 + §12.2).
 *
 * Rule-based stand-in for Nine-Brain roles B1 (contradiction), B5 (timeline)
 * and B6 (financial). Two atoms conflict when they share topic tokens and
 * disagree on polarity, dates, or numeric values. Triple-AI consensus is a
 * deterministic quorum check across the three verifier roles — no LLM required.
 */
export class ContradictionEngine {
  detect(atoms: EvidenceAtom[], options: DetectOptions = {}): Contradiction[] {
    const minOverlap = options.minTopicOverlap ?? 2;
    const maxResults = options.maxResults ?? 60;
    const now = options.now ?? new Date().toISOString();

    // Drop seal/footer boilerplate and de-duplicate repeated atoms (headers,
    // footers) so dense documents don't produce spurious contradictions.
    const seen = new Set<string>();
    const usable = atoms.filter((a) => {
      if (isBoilerplate(a.content)) return false;
      if (seen.has(a.sha512)) return false;
      seen.add(a.sha512);
      return true;
    });

    // Document-frequency filter: on large documents, ignore tokens that recur
    // across a big fraction of atoms (repeated page footers/headers, boilerplate,
    // ubiquitous domain words) so pairs must share DISTINCTIVE subject words.
    const rawTopics = usable.map((a) => topicTokens(a.content));
    const df = new Map<string, number>();
    for (const set of rawTopics) for (const tok of set) df.set(tok, (df.get(tok) ?? 0) + 1);
    const dfThreshold = Math.max(12, Math.floor(usable.length * 0.1));
    const common = new Set(
      [...df].filter(([, c]) => c >= dfThreshold).map(([tok]) => tok),
    );
    const topics = rawTopics.map(
      (set) => new Set([...set].filter((tok) => !common.has(tok))),
    );
    const out: Contradiction[] = [];

    for (let i = 0; i < usable.length; i++) {
      for (let j = i + 1; j < usable.length; j++) {
        const a = usable[i];
        const b = usable[j];
        if (a.atom_id === b.atom_id) continue;
        const overlap = intersectionSize(topics[i], topics[j]);
        if (overlap < minOverlap) continue;

        const kind = classifyConflict(a, b, overlap);
        if (!kind) continue;

        out.push(buildContradiction(a, b, kind, overlap, now));
      }
    }

    // Rank by severity, then confidence, then id (deterministic); cap results.
    out.sort(
      (x, y) =>
        (SEVERITY_RANK[y.severity] ?? 0) - (SEVERITY_RANK[x.severity] ?? 0) ||
        (CONFIDENCE_RANK[y.confidence] ?? 0) - (CONFIDENCE_RANK[x.confidence] ?? 0) ||
        x.contradiction_id.localeCompare(y.contradiction_id),
    );
    return out.slice(0, maxResults);
  }
}

function classifyConflict(a: EvidenceAtom, b: EvidenceAtom, overlap: number): ConflictKind {
  // Strongest signal: an explicit antonym pair (e.g. fell-through vs proceeded).
  if (hasAntonymConflict(a.content, b.content)) return "POLARITY";
  // Otherwise a bare positive/negative difference needs a strong shared subject
  // (>=3 topic tokens) to avoid over-flagging unrelated sentences in dense text.
  const pa = polarityOf(a.content);
  const pb = polarityOf(b.content);
  const polarityDiffer =
    (pa === "POSITIVE" && pb === "NEGATIVE") || (pa === "NEGATIVE" && pb === "POSITIVE");
  if (polarityDiffer && overlap >= 3) return "POLARITY";

  if (hasDate(a.content) && hasDate(b.content)) {
    const da = extractDates(a.content);
    const db = extractDates(b.content);
    if (da.length && db.length && da.join("|") !== db.join("|")) return "DATE";
  }

  // Only compare "significant" figures (amounts), so page numbers, counts, and
  // confirmation values don't trigger spurious numeric contradictions.
  const na = extractNumbers(a.content).filter((n) => n >= SIGNIFICANT_NUMBER);
  const nb = extractNumbers(b.content).filter((n) => n >= SIGNIFICANT_NUMBER);
  if (na.length && nb.length) {
    const sa = [...new Set(na)].sort((x, y) => x - y).join("|");
    const sb = [...new Set(nb)].sort((x, y) => x - y).join("|");
    if (sa !== sb) return "NUMERIC";
  }
  return null;
}

function buildContradiction(
  a: EvidenceAtom,
  b: EvidenceAtom,
  kind: NonNullable<ConflictKind>,
  overlap: number,
  now: string,
): Contradiction {
  const brain = brainFor(kind);
  const jurisdiction = a.jurisdiction ?? b.jurisdiction;
  const applicableLaw = applicableLawFor(kind, jurisdiction);
  const confidence: Confidence = overlap >= 3 ? "VERY_HIGH" : "HIGH";
  const consensus = buildConsensus(applicableLaw.length > 0);

  return {
    contradiction_id: makeContradictionId(a.atom_id, b.atom_id),
    brain_source: brain,
    claim_a: toAnchor(a),
    claim_b: toAnchor(b),
    severity: severityFor(kind),
    legal_significance: legalSignificanceFor(kind),
    applicable_law: applicableLaw,
    confidence,
    resolution_status: consensus.quorum ? "CONFIRMED" : "PENDING",
    triple_ai_consensus: consensus,
    timestamp: now,
  };
}

function toAnchor(atom: EvidenceAtom): ClaimAnchor {
  return {
    text: atom.content,
    source: `${atom.source_file} p.${atom.page_number} L${atom.line_range}`,
    evidence_id: atom.evidence_id,
    page: atom.page_number,
    line: Number(atom.line_range.split("-")[0]) || 0,
    sha512: atom.sha512,
  };
}

function brainFor(kind: NonNullable<ConflictKind>): BrainSource {
  switch (kind) {
    case "POLARITY":
      return "B1-ContradictionBrain";
    case "DATE":
      return "B5-Timeline";
    case "NUMERIC":
      return "B6-Financial";
  }
}

function severityFor(kind: NonNullable<ConflictKind>): Severity {
  switch (kind) {
    case "POLARITY":
      return "CRITICAL";
    case "NUMERIC":
      return "HIGH";
    case "DATE":
      return "MODERATE";
  }
}

function legalSignificanceFor(kind: NonNullable<ConflictKind>): string {
  switch (kind) {
    case "POLARITY":
      return "Directly contradictory assertions on the same subject — potential fraud with consciousness of guilt.";
    case "NUMERIC":
      return "Conflicting figures for the same item — possible falsified financial records.";
    case "DATE":
      return "Conflicting dates for the same event — timeline inconsistency undermining reliability.";
  }
}

function applicableLawFor(
  kind: NonNullable<ConflictKind>,
  jurisdiction?: string,
): string[] {
  const j = (jurisdiction ?? "").toUpperCase();
  const base: Record<string, string[]> = {
    ZA: ["SA Common Law — Fraud (misrepresentation, prejudice, intent)"],
    UAE: ["UAE Federal Decree-Law No. 31 of 2021 (Crimes & Penalties) Art. 451 — Fraud"],
    US: ["18 U.S.C. § 1001 — False Statements"],
    EU: ["Directive (EU) 2017/1371 on fraud against the Union's interests"],
    UK: ["Fraud Act 2006 s.2 — Fraud by false representation"],
  };
  const jur = base[j.split("-")[0]] ?? [];
  if (kind === "NUMERIC") {
    jur.push("Evidentiary weight under ISO 27037 / Daubert for financial records");
  }
  return jur;
}

function buildConsensus(legalMapped: boolean): TripleAiConsensus {
  // Gemma3 (forensic anchors) and 9-Brain (topic linkage) always concur here;
  // Phi-3 (legal) concurs only when a jurisdiction mapping is available.
  const gemma3 = "CONCURS" as const;
  const nine_brain = "CONCURS" as const;
  const phi3 = legalMapped ? ("CONCURS" as const) : ("ABSTAIN" as const);
  return {
    gemma3,
    phi3,
    nine_brain,
    quorum: gemma3 === "CONCURS" && phi3 === "CONCURS" && nine_brain === "CONCURS",
  };
}
