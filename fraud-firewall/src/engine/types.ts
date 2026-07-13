// CONSTITUTION: v5.2.7 — Three-Layer Contradiction Data Model
// Ported from Python verum_contradiction_engine_v529.py Section 1
// Layer 1: Facts (immutable) -> Layer 2: Logic (patterns) -> Layer 3: Legal (hypotheses)

import type {
  ContradictionType,
  Confidence,
  Severity,
  StatementType,
  FileType,
} from "./enums.js";

/** Raw evidence extracted from documents — Layer 0 input */
export interface EvidenceAtom {
  artifactHash: string; // SHA-512 of the content
  pageNumber: number;
  lineNumber: number;
  timestamp: number | null; // Injected timestamp (not Date.now())
  sourcePath: string;
  content: string;
  fileType: FileType;
}

/** Extracted claim from evidence — Layer 1 input */
export interface Claim {
  id: string;
  subject: string;
  predicate: string;
  value: string;
  actor: string;
  date: number | null; // Injected timestamp
  sourceType: StatementType;
  sourceLocation: string; // "Document.pdf p.3 line 15"
  documentId: string;
  sha512Hash: string;
  pageNumber: number;
  context: string;
}

/** Layer 1: Immutable fact extracted directly from evidence. No interpretation. */
export interface DetectedFact {
  factText: string;
  sourceDocument: string;
  sourcePage: number;
  sourceLine: number;
  sha512Hash: string;
  extractionMethod: string;
  confidence: Confidence;
}

/** Layer 2: The logical/mathematical contradiction pattern. Not legal interpretation. */
export interface LogicalPattern {
  patternType: string;
  patternDescription: string;
  supportingFacts: string[];
  contradictionScore: number;
  detectorVersion: string; // Always "v5.2.9"
}

/** Layer 3: Legal interpretation suggested by the pattern. ALWAYS a hypothesis. */
export interface LegalHypothesis {
  suggestedOffence: string;
  legalBasis: string;
  jurisdictionalNote: string;
  requiredAdditionalEvidence: string[];
  isHypothesis: true; // ALWAYS true — never a definitive legal conclusion
  requiresHumanReview: true; // ALWAYS true — AI cannot replace judicial process
}

/** Complete contradiction output — all three layers */
export interface Contradiction {
  contradictionId: string;
  type: ContradictionType;
  severity: Severity;
  confidence: Confidence;
  detectedFact: DetectedFact;
  logicalPattern: LogicalPattern;
  legalHypothesis: LegalHypothesis | null;
  propositionAText: string;
  propositionBText: string;
  propositionAActor: string;
  propositionBActor: string;
  temporalAnalysis: Record<string, unknown> | null;
  conflictDescription: string;
  verificationStatus: Record<string, string>;
}

/** Per-actor profile with dishonesty scoring */
export interface ActorProfile {
  name: string;
  dishonestyScore: number; // 0-100, capped
  flags: string[]; // Contradiction types this actor is involved in
  contradictions: string[]; // Contradiction IDs
  statementsMade: number;
  statementsDenied: number;
}

/** Triple verification result — Thesis/Antithesis/Synthesis */
export interface TripleVerification {
  gemma3Status: "CONCURS" | "DISSENTS" | "PENDING";
  phi3Status: "CONCURS" | "DISSENTS" | "PENDING";
  nineBrainStatus: "CONCURS" | "DISSENTS" | "PENDING";
  quorumMet: boolean;
  discrepancies: string[];
}

/** Complete forensic report output */
export interface ForensicReport {
  caseId: string;
  contradictions: Contradiction[];
  actorProfiles: ActorProfile[];
  tripleVerification: TripleVerification;
  corpusHash: string; // SHA-512 of all evidence
  confidenceCalibration: Record<string, unknown>;
  generatedAt: number; // Injected timestamp
}

/** Seal record for blockchain anchoring */
export interface SealRecord {
  sealId: string; // UUID v4
  sha512: string;
  constitutionVersion: string;
  timestamp: number;
  blockHeight: number | null;
  confirmations: number;
  status: "PENDING" | "ANCHORED" | "FAILED";
}
