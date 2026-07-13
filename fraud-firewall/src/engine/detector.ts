// CONSTITUTION: v6.0 Final — Contradiction Detector v5.3.1c
// Seal: VO-CE-v531c-DIGSIM-20260713
// 16 base detectors + 6 v5.3.1c DIGSIM detectors = 22 active
// 43 contradiction types | 17 serial patterns | 7 cases | B1-B11

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
    detectorVersion: "v5.3.1c",
  };

  let legalHypothesis: LegalHypothesis | null = null;
  if (cType === ContradictionType.JUDICIAL_VS_DOCUMENTARY || cType === ContradictionType.PERJURY_BY_TIMELINE || cType === ContradictionType.FALSE_ALLEGATION_IN_AFFIDAVIT) {
    legalHypothesis = {
      suggestedOffence: "Perjury / Fraud on the Court",
      legalBasis: "Contradiction between sworn statement and documentary evidence",
      jurisdictionalNote: "Varies by jurisdiction — requires legal review",
      requiredAdditionalEvidence: ["Sworn statement transcript", "Original documentary evidence", "Authentication of documents"],
      isHypothesis: true,
      requiresHumanReview: true,
    };
  } else if (cType === ContradictionType.DEFECTIVE_JURAT) {
    legalHypothesis = {
      suggestedOffence: "Fraudulent Affidavit / Defective Jurat",
      legalBasis: "Affidavit filed without mandatory jurat elements — no oath, no commissioner",
      jurisdictionalNote: "Perjury Act, Justices of the Peace Act — varies by jurisdiction",
      requiredAdditionalEvidence: ["Original affidavit with jurat section", "Commissioner appointment records", "Oath administration log"],
      isHypothesis: true,
      requiresHumanReview: true,
    };
  } else if (cType === ContradictionType.PROTECTION_ORDER_AS_LEVERAGE) {
    legalHypothesis = {
      suggestedOffence: "Abuse of Process / Protection from Harassment Act Misuse",
      legalBasis: "Protection order used as leverage in commercial dispute",
      jurisdictionalNote: "Protection from Harassment Act 17 of 2011 (ZA) or equivalent",
      requiredAdditionalEvidence: ["Protection order application", "Commercial dispute documentation", "Timeline of threats vs applications"],
      isHypothesis: true,
      requiresHumanReview: true,
    };
  } else if (cType === ContradictionType.PROCESS_REMEDY_CONFLICT) {
    legalHypothesis = {
      suggestedOffence: "Denial of Effective Remedy / ICCPR Article 2(3) Violation",
      legalBasis: "Institution with mandatory duty to respond remains silent or denies remedy",
      jurisdictionalNote: "ICCPR Art 2(3), UDHR Art 8 — international human rights law",
      requiredAdditionalEvidence: ["Statutory duty to respond", "Submission records", "Bounce/denial documentation"],
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

// ==================== 10 BASE DETECTORS (v5.2.9) ====================

function detectStatementVsStatement(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i], b = claims[j];
      if (a.actor === b.actor && isOpposing(a, b)) {
        const [isSem, semScore] = detectSemanticContradiction(a, b);
        if (isSem || (a.subject === b.subject && a.predicate === b.predicate && a.value !== b.value)) {
          results.push(createThreeLayerContradiction(
            a, b, ContradictionType.STATEMENT_VS_STATEMENT, severityScore(a, b, ifV(isSem, (semScore * 30).toInt(), 20)),
            ifV(isSem, Confidence.HIGH, Confidence.MODERATE),
            "SAME_ACTOR_OPPOSING_CLAIMS",
            `Same actor "${a.actor}" made contradictory statements on the same subject`,
            [a.value, b.value], ifV(isSem, semScore, 0.5),
          ));
        }
      }
    }
  }
  return results;
}

function ifV<T>(cond: boolean, t: T, f: T): T { return cond ? t : f; }

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
          const gapDays = Math.abs(a.date! - b.date!) / (1000 * 60 * 60 * 24);
          const sev = gapDays > 730 ? Severity.VERY_HIGH : gapDays > 365 ? Severity.HIGH : Severity.MODERATE;
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

// ==================== 6 v5.3.1c DIGSIM DETECTORS ====================

/** Detector 11: DEFECTIVE_JURAT — Affidavit missing mandatory jurat elements. */
function detectDefectiveJurat(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const juratMarkers = ["jurat", "oath", "commissioner", " sworn ", "affidavit", "before me"];
  const missingMarkers = ["no jurat", "missing jurat", "no oath", "no commissioner", "unsigned jurat", "blank jurat"];
  const juratClaims = claims.filter((c) => juratMarkers.some((m) => c.value.toLowerCase().includes(m)));
  const missingClaims = claims.filter((c) => missingMarkers.some((m) => c.value.toLowerCase().includes(m)));
  for (const j of juratClaims) {
    for (const m of missingClaims) {
      if (j.actor === m.actor || j.documentId == m.documentId) {
        results.push(createThreeLayerContradiction(
          j, m, ContradictionType.DEFECTIVE_JURAT, Severity.VERY_HIGH, Confidence.VERY_HIGH,
          "DEFECTIVE_JURAT_MISSING_ELEMENTS",
          `Affidavit filed without mandatory jurat elements — no oath, no commissioner = no perjury liability`,
          [j.value, m.value], 0.95,
        ));
      }
    }
  }
  return results;
}

/** Detector 12: PROTECTION_ORDER_AS_LEVERAGE — Protection from Harassment Act misuse. */
function detectProtectionOrderLeverage(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const protectionMarkers = ["protection order", "harassment act", "restrain", "interdict", "protection from harassment"];
  const leverageMarkers = ["settlement", "bargain", "leverage", "pressure", "threaten", "force agreement", "silence"];
  const protectionClaims = claims.filter((c) => protectionMarkers.some((m) => c.value.toLowerCase().includes(m)));
  const leverageClaims = claims.filter((c) => leverageMarkers.some((m) => c.value.toLowerCase().includes(m)));
  for (const p of protectionClaims) {
    for (const l of leverageClaims) {
      if (p.actor === l.actor || p.subject == l.subject) {
        results.push(createThreeLayerContradiction(
          p, l, ContradictionType.PROTECTION_ORDER_AS_LEVERAGE, Severity.HIGH, Confidence.HIGH,
          "PROTECTION_ORDER_USED_AS_LEVERAGE",
          `Protection from Harassment Act application used as bargaining tool in commercial dispute`,
          [p.value, l.value], 0.85,
        ));
      }
    }
  }
  return results;
}

/** Detector 13: FALSE_ALLEGATION_IN_AFFIDAVIT — Sworn allegation contradicted by evidence. */
function detectFalseAllegationInAffidavit(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const swornAllegations = claims.filter((c) =>
    c.sourceType === StatementType.SWORN_STATEMENT ||
    c.sourceType === StatementType.JUDICIAL_RECORD
  );
  const contemporaneous = claims.filter((c) =>
    c.sourceType === StatementType.CONTEMPORANEOUS ||
    c.sourceType === EngineStatementType.EMAIL ||
    c.sourceType === EngineStatementType.CHAT_LOG
  );
  for (const s of swornAllegations) {
    for (const e of contemporaneous) {
      if (s.actor === e.actor && s.subject === e.subject && isOpposing(s, e)) {
        results.push(createThreeLayerContradiction(
          s, e, ContradictionType.FALSE_ALLEGATION_IN_AFFIDAVIT, Severity.VERY_HIGH, Confidence.VERY_HIGH,
          "SWORN_ALLEGATION_CONTRADICTED_BY_EVIDENCE",
          `Specific factual allegation in sworn document contradicted by contemporaneous evidence`,
          [s.value, e.value], 0.95,
        ));
      }
    }
  }
  return results;
}

/** Detector 14: TEMPORAL_PRECEDENCE_CONFLICT — Event order reversed between documents. */
function detectTemporalPrecedenceConflict(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const beforeMarkers = ["before", "prior to", "preceded by", "earlier than", "first"];
  const afterMarkers = ["after", "subsequent to", "followed by", "later than", "then"];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i]; val b = claims[j];
      if (a.actor === b.actor && a.date !== null && b.date !== null) {
        val lowerA = a.value.lowercase(); val lowerB = b.value.lowercase();
        val aClaimsBefore = beforeMarkers.any { lowerA.contains(it) };
        val bClaimsAfter = afterMarkers.any { lowerB.contains(it) };
        val aClaimsAfter = afterMarkers.any { lowerA.contains(it) };
        val bClaimsBefore = beforeMarkers.any { lowerB.contains(it) };
        if ((aClaimsBefore && bClaimsBefore && a.date > b.date) || (aClaimsAfter && bClaimsAfter && a.date < b.date)) {
          results += createThreeLayerContradiction(
            a, b, ContradictionType.TEMPORAL_PRECEDENCE_CONFLICT, Severity.HIGH, Confidence.HIGH,
            "TEMPORAL_PRECEDENCE_CONFLICT",
            "Event A documented before Event B, but later document claims B before A",
            listOf(a.value, b.value, "Date A: ${a.date}, Date B: ${b.date}"), 0.85
          );
        }
      }
    }
  }
  return results;
}

/** Detector 15: PROCESS_REMEDY_CONFLICT — Institution denies effective remedy. */
function detectProcessRemedyConflict(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const dutyMarkers = ["duty to respond", "mandatory", "obligation to", "must respond", "required to"];
  const denialMarkers = ["no response", "remains silent", "bounced", "denied remedy", "no effective remedy", "ignored"];
  const dutyClaims = claims.filter((c) => dutyMarkers.some((m) => c.value.toLowerCase().includes(m)));
  const denialClaims = claims.filter((c) => denialMarkers.some((m) => c.value.toLowerCase().includes(m)));
  for (const d of dutyClaims) {
    for (const n of denialClaims) {
      if (d.subject === n.subject || d.actor == n.actor) {
        results.push(createThreeLayerContradiction(
          d, n, ContradictionType.PROCESS_REMEDY_CONFLICT, Severity.VERY_HIGH, Confidence.VERY_HIGH,
          "PROCESS_REMEDY_CONFLICT",
          `Institution with mandatory duty to respond remains silent, bounces submissions, or denies effective remedy`,
          [d.value, n.value], 0.95,
        ));
      }
    }
  }
  return results;
}

/** Detector 16: CHARACTER_ASSASSINATION — Personal attacks in sworn testimony. */
function detectCharacterAssassination(claims: Claim[]): Contradiction[] {
  const results: Contradiction[] = [];
  const swornClaims = claims.filter((c) =>
    c.sourceType === StatementType.SWORN_STATEMENT || c.sourceType === StatementType.JUDICIAL_RECORD
  );
  const personalMarkers = ["character", "reputation", "dishonest", "untrustworthy", "unreliable", "mental health", "emotional", "drinking", "personal life", "family"];
  for (const c of swornClaims) {
    val lower = c.value.toLowerCase();
    if (personalMarkers.some((m) => lower.contains(m)) && !lower.contains("relevant") && !lower.contains("material")) {
      results.push(createThreeLayerContradiction(
        c, c, ContradictionType.CHARACTER_ASSASSINATION, Severity.HIGH, Confidence.HIGH,
        "CHARACTER_ASSASSINATION_IN_SWORN_TESTIMONY",
        `Personal matters included in sworn testimony to attack credibility without relevance to legal issue`,
        [c.value], 0.8,
      ));
    }
  }
  return results;
}

// ==================== MAIN DETECTOR CLASS ====================

const DETECTOR_MAP: Record<string, (claims: Claim[]) => Contradiction[]> = {
  // v5.2.9 base detectors
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
  // v5.3.1c DIGSIM detectors
  [ContradictionType.DEFECTIVE_JURAT]: detectDefectiveJurat,
  [ContradictionType.PROTECTION_ORDER_AS_LEVERAGE]: detectProtectionOrderLeverage,
  [ContradictionType.FALSE_ALLEGATION_IN_AFFIDAVIT]: detectFalseAllegationInAffidavit,
  [ContradictionType.TEMPORAL_PRECEDENCE_CONFLICT]: detectTemporalPrecedenceConflict,
  [ContradictionType.PROCESS_REMEDY_CONFLICT]: detectProcessRemedyConflict,
  [ContradictionType.CHARACTER_ASSASSINATION]: detectCharacterAssassination,
};

/** Run all 16 detectors and return deduplicated, sorted contradictions */
export function detectAll(claims: Claim[]): Contradiction[] {
  const all: Contradiction[] = [];
  for (const [cType, detector] of Object.entries(DETECTOR_MAP)) {
    const found = detector(claims);
    all.push(...found);
  }
  // Deduplicate
  const seen = new Set<string>();
  const unique: Contradiction[] = [];
  for (const c of all) {
    val key = "${c.propositionAActor}:${c.propositionBActor}:${c.type}:${c.logicalPattern.patternType}";
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique.sort((a, b) => severityScore(b.severity) - severityScore(a.severity));
}

/** Reset counter — use only for deterministic testing */
export function resetCounter(): void {
  contradictionCounter = 0;
}
