// CONSTITUTION: v5.2.7 — Contradiction Detector (All 10 Types)
// Ported from Python verum_contradiction_engine_v529.py Section 4
// 10 detector functions + three-layer contradiction creation

import {
  ContradictionType,
  Severity,
  Confidence,
  StatementType,
  Subject,
  severityScore,
} from "./enums.js";
import type { Claim, Contradiction, DetectedFact, LogicalPattern, LegalHypothesis } from "./types.js";
import { calibrate } from "./calibrator.js";
import { detectSemanticContradiction } from "./semantic.js";
import type { ContradictionType as CT } from "./enums.js";

let contradictionCounter = 0;
function nextId(): string {
  contradictionCounter++;
  return `C-${contradictionCounter.toString().padStart(4, "0")}`;
}

function calculateSeverity(claimA: Claim, claimB: Claim, baseScore = 0): Severity {
  let score = baseScore;
  if (claimA.sourceType === StatementType.SWORN_STATEMENT || claimB.sourceType === StatementType.SWORN_STATEMENT) score += 40;
  if (claimA.sourceType === StatementType.CONTEMPORANEOUS || claimB.sourceType === StatementType.CONTEMPORANEOUS) score += 30;
  if (claimA.sourceType === StatementType.ADMISSION || claimB.sourceType === StatementType.ADMISSION) score += 20;
  if (claimA.subject === Subject.GOODWILL_VALUE || claimB.subject === Subject.GOODWILL_VALUE) score += 15;
  if (score >= 70) return Severity.VERY_HIGH;
  if (score >= 50) return Severity.HIGH;
  if (score >= 30) return Severity.MODERATE;
  if (score >= 10) return Severity.LOW;
  return Severity.INSUFFICIENT;
}

function isOpposing(a: Claim, b: Claim): boolean {
  const textA = a.value.toLowerCase();
  const textB = b.value.toLowerCase();
  const negations: [string, string][] = [
    ["no ", ""], ["not ", ""], ["false", "true"], ["deny", "admit"],
    ["never", "always"], ["did not", "did"], ["does not", "does"],
  ];
  for (const [neg] of negations) {
    if (neg in textA && !(neg in textB) && a.subject === b.subject) return true;
    if (neg in textB && !(neg in textA) && a.subject === b.subject) return true;
  }
  const wordsA = new Set(textA.split(/\s+/));
  const wordsB = new Set(textB.split(/\s+/));
  if (wordsA.size > 0 && wordsB.size > 0) {
    const overlap = new Set([...wordsA].filter((x) => wordsB.has(x))).size;
    const union = new Set([...wordsA, ...wordsB]).size;
    if (union > 0 && overlap / union < 0.2) {
      const negWords = new Set(["no", "not", "never", "false", "deny", "refuse", "none"]);
      if ([...wordsA].some((w) => negWords.has(w)) || [...wordsB].some((w) => negWords.has(w))) return true;
    }
  }
  if (a.subject === b.subject && a.predicate === b.predicate && a.value !== b.value) return true;
  return false;
}

function createThreeLayerContradiction(
  claimA: Claim,
  claimB: Claim,
  cType: CT,
  severity: Severity,
  baseConfidence: Confidence,
  patternType: string,
  patternDescription: string,
  supportingFacts: string[],
  score: number,
): Contradiction {
  const detectedFact: DetectedFact = {
    factText: `Actor "${claimA.actor}" stated: "${claimA.value}" | Actor "${claimB.actor}" stated: "${claimB.value}"`,
    sourceDocument: `${claimA.documentId} + ${claimB.documentId}`,
    sourcePage: claimA.pageNumber,
    sourceLine: 0,
    sha512Hash: claimA.sha512Hash,
    extractionMethod: patternType,
    confidence: baseConfidence,
  };

  const logicalPattern: LogicalPattern = {
    patternType,
    patternDescription,
    supportingFacts,
    contradictionScore: score,
    detectorVersion: "v5.2.9",
  };

  let legalHypothesis: LegalHypothesis | null = null;
  if (cType === ContradictionType.JUDICIAL_VS_DOCUMENTARY || cType === ContradictionType.PERJURY_BY_TIMELINE) {
    legalHypothesis = {
      suggestedOffence: "Perjury / Fraud on the Court",
      legalBasis: "Contradiction between sworn statement and documentary evidence",
      jurisdictionalNote: "Varies by jurisdiction — requires legal review",
      requiredAdditionalEvidence: ["Sworn statement transcript", "Original documentary evidence", "Authentication of documents"],
      isHypothesis: true,
      requiresHumanReview: true,
    };
  }

  return {
    contradictionId: nextId(),
    type: cType,
    severity,
    confidence: calibrate(baseConfidence, cType, true),
    detectedFact,
    logicalPattern,
    legalHypothesis,
    propositionAText: claimA.value,
    propositionBText: claimB.value,
    propositionAActor: claimA.actor,
    propositionBActor: claimB.actor,
    temporalAnalysis: null,
    conflictDescription: `${claimA.actor} claims: "${claimA.value}" but ${claimB.actor} claims: "${claimB.value}"`,
    verificationStatus: {},
  };
}

// ==================== 10 DETECTOR FUNCTIONS ====================

function detectStatementVsStatement(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i], b = claims[j];
      if (a.actor === b.actor && isOpposing(a, b)) {
        const [isSem, semScore] = detectSemanticContradiction(a, b);
        if (isSem || (a.subject === b.subject && a.predicate === b.predicate && a.value !== b.value)) {
          const severity = calculateSeverity(a, b, isSem ? Math.floor(semScore * 30) : 20);
          results.push(createThreeLayerContradiction(
            a, b, ContradictionType.STATEMENT_VS_STATEMENT, severity,
            isSem ? Confidence.HIGH : Confidence.MODERATE,
            "SAME_ACTOR_OPPOSING_CLAIMS",
            `Same actor "${a.actor}" made contradictory statements on the same subject`,
            [a.value, b.value], isSem ? semScore : 0.5,
          ));
        }
      }
    }
  }
  return results;
}

function detectStatementVsEvidence(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const sworn = claims.filter((c) => c.sourceType === StatementType.SWORN_STATEMENT);
  const documentary = claims.filter((c) => c.sourceType === StatementType.CONTEMPORANEOUS || c.sourceType === StatementType.CONTRACT_CLAUSE);
  for (const s of sworn) {
    for (const d of documentary) {
      if (s.subject === d.subject && isOpposing(s, d)) {
        results.push(createThreeLayerContradiction(
          s, d, ContradictionType.STATEMENT_VS_EVIDENCE, Severity.VERY_HIGH, Confidence.VERY_HIGH,
          "SWORN_STATEMENT_VS_DOCUMENTARY_EVIDENCE",
          `Sworn statement contradicted by contemporaneous documentary evidence`,
          [s.value, d.value], 0.9,
        ));
      }
    }
  }
  return results;
}

function detectFinancialIrregularity(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const financialKeywords = ["payment", "amount", "balance", "deposit", "withdrawal", "transfer", "fee", "rent", "commission"];
  const financialClaims = claims.filter((c) => financialKeywords.some((k) => c.value.toLowerCase().includes(k)));
  for (let i = 0; i < financialClaims.length; i++) {
    for (let j = i + 1; j < financialClaims.length; j++) {
      const a = financialClaims[i], b = financialClaims[j];
      if (a.actor === b.actor && a.subject === b.subject && a.value !== b.value) {
        const [isSem, semScore] = detectSemanticContradiction(a, b);
        if (isSem) {
          results.push(createThreeLayerContradiction(
            a, b, ContradictionType.FINANCIAL_IRREGULARITY, Severity.HIGH, Confidence.HIGH,
            "FINANCIAL_AMOUNT_DISCREPANCY",
            `Same actor reported inconsistent financial figures for the same subject`,
            [a.value, b.value], semScore,
          ));
        }
      }
    }
  }
  return results;
}

function detectJudicialVsDocumentary(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const judicial = claims.filter((c) => c.sourceType === StatementType.JUDICIAL_RECORD);
  const docs = claims.filter((c) => c.sourceType === StatementType.CONTRACT_CLAUSE || c.sourceType === StatementType.CONTEMPORANEOUS);
  for (const j of judicial) {
    for (const d of docs) {
      if (j.subject === d.subject && isOpposing(j, d)) {
        results.push(createThreeLayerContradiction(
          j, d, ContradictionType.JUDICIAL_VS_DOCUMENTARY, Severity.VERY_HIGH, Confidence.VERY_HIGH,
          "COURT_STATEMENT_VS_SEALED_DOCUMENT",
          `Statement made to judicial body contradicted by sealed documentary evidence`,
          [j.value, d.value], 0.95,
        ));
      }
    }
  }
  return results;
}

function detectTemporalContradiction(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i], b = claims[j];
      if (a.actor === b.actor && a.subject === b.subject && a.date !== null && b.date !== null && a.date !== b.date) {
        if (isOpposing(a, b)) {
          const gap = Math.abs(a.date! - b.date!);
          const gapDays = gap / (1000 * 60 * 60 * 24);
          let sev = Severity.MODERATE;
          if (gapDays > 730) sev = Severity.VERY_HIGH; // > 2 years = consciousness of guilt
          else if (gapDays > 365) sev = Severity.HIGH;
          results.push(createThreeLayerContradiction(
            a, b, ContradictionType.TEMPORAL_CONTRADICTION, sev, Confidence.HIGH,
            "TEMPORALLY_SEPARATED_CONTRADICTORY_STATEMENTS",
            `Same actor made contradictory statements ${Math.round(gapDays)} days apart`,
            [a.value, b.value, `Gap: ${Math.round(gapDays)} days`], Math.min(0.9, gapDays / 730),
          ));
        }
      }
    }
  }
  return results;
}

function detectConsciousnessOfGuilt(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i], b = claims[j];
      if (a.actor === b.actor && a.date !== null && b.date !== null) {
        const gapDays = Math.abs(a.date! - b.date!) / (1000 * 60 * 60 * 24);
        if (gapDays > 730 && isOpposing(a, b)) {
          results.push(createThreeLayerContradiction(
            a, b, ContradictionType.CONSCIOUSNESS_OF_GUILT, Severity.VERY_HIGH, Confidence.VERY_HIGH,
            "CONSCIOUSNESS_OF_GUILT_730DAY_GAP",
            `Actor made contradictory statements ${Math.round(gapDays)} days apart (>2yr gap proves consciousness of guilt)`,
            [a.value, b.value, `Gap: ${Math.round(gapDays)} days`], 0.95,
          ));
        }
      }
    }
  }
  return results;
}

function detectBehavioral(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const behavioralMarkers = ["agreed", "promised", "committed", "guaranteed", "assured"];
  const denialMarkers = ["denied", "refused", "rejected", "declined", "never"];
  for (const c of claims) {
    const val = c.value.toLowerCase();
    const hasBehavioral = behavioralMarkers.some((m) => val.includes(m));
    const hasDenial = denialMarkers.some((m) => val.includes(m));
    if (hasBehavioral && hasDenial) {
      results.push(createThreeLayerContradiction(
        c, c, ContradictionType.BEHAVIORAL, Severity.MODERATE, Confidence.MODERATE,
        "BEHAVIORAL_INCONSISTENCY",
        `Actor's statement contains both commitment language and denial language`,
        [c.value], 0.5,
      ));
    }
  }
  return results;
}

function detectShamTransaction(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const shamMarkers = ["arm's length", "independent", "unrelated party", "third party", "at market value"];
  const controlMarkers = ["same director", "common ownership", "related party", "subsidiary", "parent company", "controlled by"];
  const shamClaims = claims.filter((c) => shamMarkers.some((m) => c.value.toLowerCase().includes(m)));
  const controlClaims = claims.filter((c) => controlMarkers.some((m) => c.value.toLowerCase().includes(m)));
  for (const s of shamClaims) {
    for (const ctrl of controlClaims) {
      if (s.actor === ctrl.actor || s.subject === ctrl.subject) {
        results.push(createThreeLayerContradiction(
          s, ctrl, ContradictionType.SHAM_TRANSACTION, Severity.HIGH, Confidence.HIGH,
          "SHAM_TRANSACTION_DUAL_CONTROL",
          `Entity claims arm's-length transaction but evidence shows common control`,
          [s.value, ctrl.value], 0.85,
        ));
      }
    }
  }
  return results;
}

function detectTacitLeaseViolation(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const rentMarkers = ["rent", "lease", "monthly payment", "occupation", "possession"];
  const denyMarkers = ["no contract", "no lease", "expired", "not valid", "no agreement"];
  const rentClaims = claims.filter((c) => rentMarkers.some((m) => c.value.toLowerCase().includes(m)));
  const denyClaims = claims.filter((c) => denyMarkers.some((m) => c.value.toLowerCase().includes(m)));
  for (const r of rentClaims) {
    for (const d of denyClaims) {
      if (r.actor === d.actor) {
        results.push(createThreeLayerContradiction(
          r, d, ContradictionType.TACIT_LEASE_VIOLATION, Severity.HIGH, Confidence.HIGH,
          "RENT_ACCEPTANCE_WHILE_DENYING_CONTRACT",
          `Actor collected rent/payments while simultaneously denying contract existence`,
          [r.value, d.value], 0.9,
        ));
      }
    }
  }
  return results;
}

function detectPostExpiryEnforcement(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const expiryMarkers = ["expired", "terminated", "ended", "lapsed", "no longer valid"];
  const enforceMarkers = ["enforce", "demand", "require", "compel", " Clause ", "pursuant to"];
  const expiryClaims = claims.filter((c) => expiryMarkers.some((m) => c.value.toLowerCase().includes(m)));
  const enforceClaims = claims.filter((c) => enforceMarkers.some((m) => c.value.toLowerCase().includes(m)));
  for (const e of expiryClaims) {
    for (const enf of enforceClaims) {
      if (e.actor === enf.actor && e.subject === enf.subject) {
        results.push(createThreeLayerContradiction(
          e, enf, ContradictionType.POST_EXPIRY_ENFORCEMENT, Severity.VERY_HIGH, Confidence.VERY_HIGH,
          "ENFORCING_CLAUSE_AFTER_ITS_OWN_EXPIRY",
          `Actor enforced a clause after claiming the underlying agreement had expired`,
          [e.value, enf.value], 0.95,
        ));
      }
    }
  }
  return results;
}

// ==================== MAIN DETECTOR CLASS ====================

const DETECTOR_MAP: Record<string, (claims: Claim[]) => Contradiction[]> = {
  [ContradictionType.STATEMENT_VS_STATEMENT]: detectStatementVsStatement,
  [ContradictionType.STATEMENT_VS_EVIDENCE]: detectStatementVsEvidence,
  [ContradictionType.FINANCIAL_IRREGULARITY]: detectFinancialIrregularity,
  [ContradictionType.JUDICIAL_VS_DOCUMENTARY]: detectJudicialVsDocumentary,
  [ContradictionType.TEMPORAL_CONTRADICTION]: detectTemporalContradiction,
  [ContradictionType.CONSCIOUSNESS_OF_GUILT]: detectConsciousnessOfGuilt,
  [ContradictionType.BEHAVIORAL]: detectBehavioral,
  [ContradictionType.SHAM_TRANSACTION]: detectShamTransaction,
  [ContradictionType.TACIT_LEASE_VIOLATION]: detectTacitLeaseViolation,
  [ContradictionType.POST_EXPIRY_ENFORCEMENT]: detectPostExpiryEnforcement,
};

/** Run all 10 detectors and return deduplicated, sorted contradictions */
export function detectAll(claims: Claim[]): Contradiction[] {
  const all: Contradiction[] = [];
  for (const [cType, detector] of Object.entries(DETECTOR_MAP)) {
    const found = detector(claims);
    all.push(...found);
  }

  // Deduplicate by actor+type+pattern key
  const seen = new Set<string>();
  const unique: Contradiction[] = [];
  for (const c of all) {
    const key = `${c.propositionAActor}:${c.propositionBActor}:${c.type}:${c.logicalPattern.patternType}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }

  // Sort by severity (highest first)
  return unique.sort((a, b) => severityScore(b.severity) - severityScore(a.severity));
}

/** Reset counter — use only for deterministic testing */
export function resetCounter(): void {
  contradictionCounter = 0;
}
