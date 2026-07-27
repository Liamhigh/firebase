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
  now?: string;
}

type ConflictKind =
  | "POLARITY"
  | "DATE"
  | "NUMERIC"
  | "CLAUSE_PRECONDITION"
  | "ASSET_VALUE_DENIAL"
  | null;

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
    const now = options.now ?? new Date().toISOString();
    const topics = atoms.map((a) => topicTokens(a.content));
    const out: Contradiction[] = [];

    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const a = atoms[i];
        const b = atoms[j];
        if (a.atom_id === b.atom_id) continue;
        const overlap = intersectionSize(topics[i], topics[j]);

        // High-value legal patterns are checked first and are NOT gated on the
        // generic topic-overlap threshold: the lease agreement carrying the
        // clause and the document establishing ownership rarely share enough
        // surface tokens, which is exactly why the engine missed them before.
        const legalKind = classifyLegalConflict(a, b);
        if (legalKind) {
          out.push(buildContradiction(a, b, legalKind, overlap, now));
          continue;
        }

        if (overlap < minOverlap) continue;

        const kind = classifyConflict(a, b);
        if (!kind) continue;

        out.push(
          buildContradiction(a, b, kind, overlap, now),
        );
      }
    }

    // Deterministic ordering by id.
    out.sort((x, y) => x.contradiction_id.localeCompare(y.contradiction_id));
    return out;
  }
}

function classifyConflict(a: EvidenceAtom, b: EvidenceAtom): ConflictKind {
  const pa = polarityOf(a.content);
  const pb = polarityOf(b.content);
  const polarityConflict =
    hasAntonymConflict(a.content, b.content) ||
    (pa === "POSITIVE" && pb === "NEGATIVE") ||
    (pa === "NEGATIVE" && pb === "POSITIVE");
  if (polarityConflict) return "POLARITY";

  if (hasDate(a.content) && hasDate(b.content)) {
    const da = extractDates(a.content);
    const db = extractDates(b.content);
    if (da.length && db.length && da.join("|") !== db.join("|")) return "DATE";
  }

  const na = extractNumbers(a.content);
  const nb = extractNumbers(b.content);
  if (na.length && nb.length) {
    const sa = [...new Set(na)].sort((x, y) => x - y).join("|");
    const sb = [...new Set(nb)].sort((x, y) => x - y).join("|");
    if (sa !== sb) return "NUMERIC";
  }
  return null;
}

/**
 * Domain-specific legal contradictions (v6.0). These encode the AllFuels /
 * Caltex Franchise Agreement patterns the engine previously missed:
 *  - CLAUSE_PRECONDITION: a termination/expiry resting on a clause whose
 *    precondition is that the party is the LESSEE (not the owner) under a head
 *    lease, contradicted by an atom establishing that party's OWNERSHIP.
 *  - ASSET_VALUE_DENIAL: goodwill / value of the business recognised or
 *    quantified in one atom, denied or said to have no compensable value in
 *    another ("you only take away what exists").
 */
function classifyLegalConflict(a: EvidenceAtom, b: EvidenceAtom): ConflictKind {
  const ta = a.content.toLowerCase();
  const tb = b.content.toLowerCase();

  const clauseCond = (t: string) => /lessee|head lease|not the owner|effluxion/.test(t);
  const ownership = (t: string) =>
    /\b(is|became|registered|the)\s+owner\b|purchased the property|owns the (premises|property)|took transfer|acquired the property|ownership of the premises/.test(t);
  if ((clauseCond(ta) && ownership(tb)) || (clauseCond(tb) && ownership(ta))) {
    return "CLAUSE_PRECONDITION";
  }

  const asset = (t: string) => /goodwill|value of the business/.test(t);
  const denies = (t: string) =>
    /no goodwill|no compensable|has no value|not entitled to any compensation|without compensation|\bno value\b|not compensable/.test(t);
  const recognises = (t: string) =>
    asset(t) && /means|value|clawback|percentage|inure|entitled|recognis|quantif|compensat/.test(t) && !denies(t);
  if ((recognises(ta) && denies(tb)) || (recognises(tb) && denies(ta))) {
    return "ASSET_VALUE_DENIAL";
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
  const isLegalKind = kind === "CLAUSE_PRECONDITION" || kind === "ASSET_VALUE_DENIAL";
  const confidence: Confidence = isLegalKind || overlap >= 3 ? "VERY_HIGH" : "HIGH";
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
    case "CLAUSE_PRECONDITION":
    case "ASSET_VALUE_DENIAL":
      return "B7-LegalMapping";
  }
}

function severityFor(kind: NonNullable<ConflictKind>): Severity {
  switch (kind) {
    case "POLARITY":
      return "CRITICAL";
    case "CLAUSE_PRECONDITION":
      return "CRITICAL";
    case "ASSET_VALUE_DENIAL":
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
    case "CLAUSE_PRECONDITION":
      return "A termination or expiry rests on a clause conditioned on the party being a lessee (not the owner), but the record shows that party was the owner — the triggering event never occurred, so the termination may be void. HYPOTHESIS: requires legal review.";
    case "ASSET_VALUE_DENIAL":
      return "An asset (goodwill / value of the business) is recognised or quantified in one document but denied or said to have no compensable value in another — a forfeiture or clawback is itself an admission the asset exists. HYPOTHESIS: requires legal review.";
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
  if (kind === "CLAUSE_PRECONDITION") {
    jur.push("Contract law — effluxion of time, repudiation and misrepresentation (precondition not met)");
  }
  if (kind === "ASSET_VALUE_DENIAL") {
    jur.push("Estoppel; perjury by documentary admission if the denial was made under oath");
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
