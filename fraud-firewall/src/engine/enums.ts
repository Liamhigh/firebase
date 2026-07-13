// CONSTITUTION: v5.2.7 — Contradiction Engine Enums
// Ported from Python verum_contradiction_engine_v529.py Section 0
// All enums are const objects (frozen) for determinism

/** 16 contradiction types detected by the engine */
export const ContradictionType = {
  STATEMENT_VS_STATEMENT: "STATEMENT_VS_STATEMENT",
  STATEMENT_VS_EVIDENCE: "STATEMENT_VS_EVIDENCE",
  OMISSION: "OMISSION",
  BEHAVIORAL: "BEHAVIORAL",
  FINANCIAL_IRREGULARITY: "FINANCIAL_IRREGULARITY",
  JUDICIAL_VS_DOCUMENTARY: "JUDICIAL_VS_DOCUMENTARY",
  TEMPORAL_CONTRADICTION: "TEMPORAL_CONTRADICTION",
  CONSCIOUSNESS_OF_GUILT: "CONSCIOUSNESS_OF_GUILT",
  PERJURY_BY_TIMELINE: "PERJURY_BY_TIMELINE",
  PATTERN_OF_RACKETEERING: "PATTERN_OF_RACKETEERING",
  REGULATORY_CAPTURE: "REGULATORY_CAPTURE",
  SHAM_TRANSACTION: "SHAM_TRANSACTION",
  FRAUD_ON_THE_COURT: "FRAUD_ON_THE_COURT",
  CORPORATE_VEIL_ABUSE: "CORPORATE_VEIL_ABUSE",
  TACIT_LEASE_VIOLATION: "TACIT_LEASE_VIOLATION",
  POST_EXPIRY_ENFORCEMENT: "POST_EXPIRY_ENFORCEMENT",
} as const;
export type ContradictionType = (typeof ContradictionType)[keyof typeof ContradictionType];

/** Ordinal severity — no percentages, ever */
export const Severity = {
  VERY_HIGH: "VERY_HIGH",
  HIGH: "HIGH",
  MODERATE: "MODERATE",
  LOW: "LOW",
  INSUFFICIENT: "INSUFFICIENT",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

/** Confidence levels — DETERMINISTIC is highest (mathematical proof) */
export const Confidence = {
  DETERMINISTIC: "DETERMINISTIC",
  VERY_HIGH: "VERY_HIGH",
  HIGH: "HIGH",
  MODERATE: "MODERATE",
  LOW: "LOW",
  INSUFFICIENT: "INSUFFICIENT",
} as const;
export type Confidence = (typeof Confidence)[keyof typeof Confidence];

/** Statement types for evidence classification */
export const StatementType = {
  CLAIM: "CLAIM",
  DENIAL: "DENIAL",
  ADMISSION: "ADMISSION",
  DEMAND: "DEMAND",
  PROMISE: "PROMISE",
  THREAT: "THREAT",
  SWORN_STATEMENT: "SWORN_STATEMENT",
  CONTEMPORANEOUS: "CONTEMPORANEOUS",
  JUDICIAL_RECORD: "JUDICIAL_RECORD",
  CONTRACT_CLAUSE: "CONTRACT_CLAUSE",
} as const;
export type StatementType = (typeof StatementType)[keyof typeof StatementType];

/** The 7 constitutional subjects + RACKETERING + OTHER */
export const Subject = {
  GOODWILL_VALUE: "GOODWILL_VALUE",
  CONTRACT_VALIDITY: "CONTRACT_VALIDITY",
  SIGNATURE_STATUS: "SIGNATURE_STATUS",
  SECTION_12B: "SECTION_12B",
  COMPENSATION: "COMPENSATION",
  PERJURY: "PERJURY",
  COERCION: "COERCION",
  RACKETEERING: "RACKETEERING",
  OTHER: "OTHER",
} as const;
export type Subject = (typeof Subject)[keyof typeof Subject];

/** File types supported for evidence ingestion */
export const FileType = {
  PDF: "PDF",
  IMAGE: "IMAGE",
  AUDIO: "AUDIO",
  EMAIL: "EMAIL",
  CHAT_LOG: "CHAT_LOG",
  ZIP: "ZIP",
  DOCX: "DOCX",
  XLSX: "XLSX",
  TXT: "TXT",
  CSV: "CSV",
  UNKNOWN: "UNKNOWN",
} as const;
export type FileType = (typeof FileType)[keyof typeof FileType];

/** Severity score for sorting — higher = more severe */
export function severityScore(sev: Severity): number {
  return {
    [Severity.VERY_HIGH]: 5,
    [Severity.HIGH]: 4,
    [Severity.MODERATE]: 3,
    [Severity.LOW]: 2,
    [Severity.INSUFFICIENT]: 1,
  }[sev] ?? 0;
}

/** Confidence numeric score for calibration */
export function confidenceScore(c: Confidence): number {
  return {
    [Confidence.DETERMINISTIC]: 1.0,
    [Confidence.VERY_HIGH]: 0.9,
    [Confidence.HIGH]: 0.75,
    [Confidence.MODERATE]: 0.5,
    [Confidence.LOW]: 0.25,
    [Confidence.INSUFFICIENT]: 0.0,
  }[c] ?? 0.5;
}

/** Convert numeric score back to ordinal Confidence */
export function scoreToConfidence(s: number): Confidence {
  if (s >= 0.95) return Confidence.DETERMINISTIC;
  if (s >= 0.80) return Confidence.VERY_HIGH;
  if (s >= 0.60) return Confidence.HIGH;
  if (s >= 0.35) return Confidence.MODERATE;
  if (s >= 0.15) return Confidence.LOW;
  return Confidence.INSUFFICIENT;
}
