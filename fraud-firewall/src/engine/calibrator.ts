// CONSTITUTION: v5.2.7 — Confidence Calibrator
// Ported from Python verum_contradiction_engine_v529.py Section 2
// Per-detector FP rates from validation against 111 AllFuels contradictions

import { Confidence, confidenceScore, scoreToConfidence } from "./enums.js";
import type { ContradictionType } from "./enums.js";

/** Per-detector false-positive rates — calibrated against AllFuels 111 contradictions */
const FP_RATES: Record<string, number> = {
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
      "Per-detector false-positive rates from validation against 111 AllFuels contradictions (528-page bundle)",
    lastCalibrated: "2026-07-12",
    validationCase: "ALLFUELS-2026 (111 contradictions, 528-page bundle)",
    engineVersion: "v5.2.9",
  };
}
