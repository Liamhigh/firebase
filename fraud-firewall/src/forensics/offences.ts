import type {
  BrainSource,
  Confidence,
  Contradiction,
  FraudType,
  Offence,
  Severity,
} from "../core/types.js";
import { sha512, shortCode } from "../core/crypto.js";

const OFFENCE_TITLE: Record<BrainSource, string> = {
  "B1-ContradictionBrain": "Fraud — False Representation",
  "B2-DocumentForensics": "Document Tampering / Forgery",
  "B3-Communications": "Concealment of Communications",
  "B4-Linguistics": "Deceptive / Misleading Statements",
  "B5-Timeline": "Timeline Inconsistency / Misrepresentation",
  "B6-Financial": "Falsified Financial Records",
  "B7-LegalMapping": "Statutory Breach",
  "B8-AudioForensics": "Audio Tampering",
  "B9-RnDValidation": "Validation Finding",
};

/**
 * Offence matrix from detected contradictions (spec §5.3): each contradiction
 * maps to an offence with legal basis, evidence anchors, severity and confidence.
 */
export function buildOffencesFromContradictions(
  contradictions: Contradiction[],
): Offence[] {
  const offences = contradictions.map((c) => ({
    offence_id: `OFF-${shortCode(sha512(c.contradiction_id), 8)}`,
    title: OFFENCE_TITLE[c.brain_source] ?? "Fraud",
    legal_basis: c.applicable_law,
    evidence_anchors: [c.claim_a.source, c.claim_b.source],
    severity: c.severity,
    confidence: c.confidence,
    source: c.contradiction_id,
  }));
  return offences.sort((a, b) => a.offence_id.localeCompare(b.offence_id));
}

const FRAUD_OFFENCE_TITLE: Partial<Record<FraudType, string>> = {
  IDENTITY_THEFT: "Identity Theft",
  ACCOUNT_TAKEOVER: "Account Takeover / Unauthorised Access",
  MONEY_LAUNDERING: "Money Laundering",
  VELOCITY_ABUSE: "Structuring / Velocity Abuse",
  GEO_ANOMALY: "Sanctions / Geographic Anomaly",
  AMOUNT_ANOMALY: "Fraud — Anomalous Transfer",
  LAYERING: "Layering (Money Laundering)",
  INTERNAL_FRAUD: "Internal Fraud / Breach of Fiduciary Duty",
  UNKNOWN: "Suspected Fraud",
};

/** Offence row derived from a confirmed fraud alert (fraud pipeline). */
export function offenceFromFraud(params: {
  fraudType: FraudType;
  legalBasis: string[];
  anchors: string[];
  severity: Severity;
  confidence: Confidence;
  caseReference: string;
}): Offence {
  return {
    offence_id: `OFF-${shortCode(sha512(`${params.caseReference}|${params.fraudType}`), 8)}`,
    title: FRAUD_OFFENCE_TITLE[params.fraudType] ?? "Suspected Fraud",
    legal_basis: params.legalBasis,
    evidence_anchors: params.anchors,
    severity: params.severity,
    confidence: params.confidence,
    source: "rule-engine+triple-ai",
  };
}
