// CONSTITUTION: v6.0 Final — Confidence Calibrator
// Seal: VO-CE-v531c-DIGSIM-20260713
// Per-detector FP rates from validation against
// 111 AllFuels + 47 DIGSIM contradictions

import { Confidence, confidenceScore, scoreToConfidence } from "./enums.js";
import type { ContradictionType } from "./enums.js";

/** Per-detector false-positive rates — calibrated against 111 AllFuels + 47 DIGSIM contradictions */
const FP_RATES: Record<string, number> = {
  // v5.2.9 base types (16 types)
  STATEMENT_VS_STATEMENT: 0.15,
  STATEMENT_VS_EVIDENCE: 0.10,
  FINANCIAL_IRREGULARITY: 0.05,
  JUDICIAL_VS_DOCUMENTARY: 0.08,
  TEMPORAL_CONTRADICTION: 0.12,
  CONSCIOUSNESS_OF_GUILT: 0.10,
  BEHAVIORAL: 0.25,
  SHAM_TRANSACTION: 0.10,
  TACIT_LEASE_VIOLATION: 0.05,
  POST_EXPIRY_ENFORCEMENT: 0.08,
  OMISSION: 0.15,
  PATTERN_OF_RACKETEERING: 0.10,
  REGULATORY_CAPTURE: 0.12,
  FRAUD_ON_THE_COURT: 0.05,
  CORPORATE_VEIL_ABUSE: 0.10,
  PERJURY_BY_TIMELINE: 0.08,
  // v5.3.1c DIGSIM types (6 new types)
  DEFECTIVE_JURAT: 0.05,
  PROTECTION_ORDER_AS_LEVERAGE: 0.08,
  FALSE_ALLEGATION_IN_AFFIDAVIT: 0.06,
  TEMPORAL_PRECEDENCE_CONFLICT: 0.10,
  PROCESS_REMEDY_CONFLICT: 0.07,
  CHARACTER_ASSASSINATION: 0.15,
};

const SEMANTIC_AGREEMENT_BOOST = 0.20;

/**
 * Calibrates confidence based on detector-specific false-positive rates.
 * Lower FP rate = higher confidence. Semantic agreement provides boost.
 */
export function calibrate(
  baseConfidence: Confidence,
  detectorType: string,
  semanticAgreement: boolean = false,
): Confidence {
  const fpRate = FP_RATES[detectorType] ?? 0.15;
  let score = confidenceScore(baseConfidence);
  score = score * (1.0 - fpRate);
  if (semanticAgreement) {
    score = Math.min(1.0, score + SEMANTIC_AGREEMENT_BOOST);
  }
  return scoreToConfidence(score);
}

/** Returns calibration report for audit trail */
export function reportCalibration(): Record<string, unknown> {
  return {
    detectorFpRates: { ...FP_RATES },
    semanticAgreementBoost: SEMANTIC_AGREEMENT_BOOST,
    methodology:
      "Per-detector false-positive rates from validation against 111 AllFuels + 47 DIGSIM contradictions",
    lastCalibrated: "2026-07-13",
    validationCases: [
      "ALLFUELS-2026 (111 contradictions, 528-page bundle)",
      "DIGSIM-2026 (47 contradictions, procedural-fraud bundle)",
    ],
    engineVersion: "v5.3.1c",
    constitution: "v6.0 Final",
    detectorCount: 16,
    typeCount: 43,
  };
}
