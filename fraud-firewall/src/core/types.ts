import { z } from "zod";

export const ConfidenceSchema = z.enum([
  "VERY_HIGH",
  "HIGH",
  "MODERATE",
  "LOW",
  "INSUFFICIENT",
]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const FraudTypeSchema = z.enum([
  "IDENTITY_THEFT",
  "ACCOUNT_TAKEOVER",
  "MONEY_LAUNDERING",
  "VELOCITY_ABUSE",
  "GEO_ANOMALY",
  "AMOUNT_ANOMALY",
  "LAYERING",
  "INTERNAL_FRAUD",
  "UNKNOWN",
]);
export type FraudType = z.infer<typeof FraudTypeSchema>;

export const TransactionSchema = z.object({
  txn_id: z.string(),
  account_id: z.string(),
  amount: z.number(),
  currency: z.string().default("ZAR"),
  timestamp: z.string(),
  country: z.string().optional(),
  channel: z.string().optional(),
  counterparty: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const VerificationVoteSchema = z.object({
  model: z.string(),
  vote: z.enum(["CONCURS", "DISSENTS", "ABSTAIN"]),
  confidence: ConfidenceSchema,
  rationale: z.string(),
  checks: z.array(z.string()).default([]),
});
export type VerificationVote = z.infer<typeof VerificationVoteSchema>;

export const SealRecordSchema = z.object({
  seal_id: z.string(),
  /** SHA-512 of the final sealed PDF bytes (computed last). */
  sha512: z.string(),
  /** Alias of sha512 — the document fingerprint anchored to the blockchain. */
  document_sha512: z.string().optional(),
  /** SHA-256 of the sealed PDF — the digest committed to OpenTimestamps. */
  document_sha256: z.string().optional(),
  constitution_version: z.string(),
  created_at: z.string(),
  document_reference: z.string(),
  /** Public verification URL (also encoded in the cover QR code). */
  verify_url: z.string().optional(),
  /** OpenTimestamps proof filename stored alongside the sealed PDF. */
  ots_proof_file: z.string().optional(),
  blockchain: z
    .object({
      provider: z.literal("OpenTimestamps"),
      status: z.enum(["SUBMITTED", "PENDING", "CONFIRMED", "MOCK"]),
      submitted_at: z.string().optional(),
      calendar_urls: z.array(z.string()).optional(),
      block_height: z.number().optional(),
      confirmations: z.number().optional(),
      ots_receipt: z.string().optional(),
    })
    .optional(),
});
export type SealRecord = z.infer<typeof SealRecordSchema>;

export const FraudAlertSchema = z.object({
  alert_id: z.string(),
  institution: z.string(),
  case_reference: z.string(),
  fraud_type: FraudTypeSchema,
  fraud_amount: z.number(),
  currency: z.string(),
  commission_20pct: z.number(),
  status: z.enum(["PENDING", "CONFIRMED", "HUMAN_REVIEW", "REJECTED"]),
  confidence: ConfidenceSchema,
  detection_method: z.string(),
  verification: z.object({
    gemma3: z.string(),
    phi3: z.string(),
    nine_brain: z.string(),
    quorum: z.boolean(),
  }),
  seal: SealRecordSchema.optional(),
  notifications: z
    .object({
      verum_invoice_sent: z.boolean(),
      bank_report_sent: z.boolean(),
      timestamp: z.string(),
    })
    .optional(),
  ai_audit_trail: z.array(
    z.object({
      model: z.string(),
      action: z.string(),
      timestamp: z.string(),
      detail: z.string().optional(),
    }),
  ),
  evidence_summary: z.string(),
  contradictions: z.array(z.string()).default([]),
  timestamp: z.string(),
});
export type FraudAlert = z.infer<typeof FraudAlertSchema>;

export const CommissionInvoiceSchema = z.object({
  invoice_id: z.string(),
  institution: z.string(),
  case_reference: z.string(),
  fraud_amount: z.number(),
  commission_percent: z.literal(20),
  commission_amount: z.number(),
  currency: z.string(),
  payment_reference: z.string(),
  due_date: z.string(),
  status: z.enum(["ISSUED", "PAID", "OVERDUE"]),
  seal_id: z.string(),
  blockchain_block: z.number().optional(),
  /** Hard-coded privacy guarantee — always false */
  evidence_received_by_verum: z.literal(false),
  generated_at: z.string(),
});
export type CommissionInvoice = z.infer<typeof CommissionInvoiceSchema>;

export const SealCreditLedgerSchema = z.object({
  ledger_id: z.string(),
  institution: z.string(),
  license_tier: z.string(),
  credits: z.object({
    purchased: z.number(),
    used: z.number(),
    remaining: z.number(),
    expired: z.number(),
  }),
  purchase_history: z.array(
    z.object({
      date: z.string(),
      amount: z.number(),
      cost_zar: z.number().optional(),
      payment_ref: z.string(),
      verified_by: z.string(),
    }),
  ),
  usage_log: z.array(
    z.object({
      log_id: z.string(),
      seal_id: z.string(),
      document_reference: z.string(),
      credits_before: z.number(),
      credits_after: z.number(),
      ai_verifier: z.string(),
      timestamp: z.string(),
      sha512: z.string(),
    }),
  ),
  ai_maintained: z.literal(true),
  last_updated: z.string(),
  sha512: z.string(),
});
export type SealCreditLedger = z.infer<typeof SealCreditLedgerSchema>;

export const AuditLogEntrySchema = z.object({
  log_id: z.string(),
  ai_model: z.string(),
  agent_id: z.string().optional(),
  action: z.string(),
  target: z.string(),
  reason: z.string(),
  confidence: ConfidenceSchema,
  timestamp: z.string(),
  sha512: z.string(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export interface FirewallConfig {
  institution: {
    name: string;
    code: string;
    fraud_department_email: string;
    jurisdiction: string;
  };
  verum: {
    commission_email: string;
    commission_percent: number;
    verify_url: string;
  };
  constitution_version: string;
  nine_brain_version: string;
  seal_protocol: string;
  rules: {
    velocity: { max_transactions: number; window_seconds: number };
    amount_threshold_zar: number;
    geo_blocklist: string[];
    anomaly_score_threshold: number;
  };
  ai: {
    mode: "deterministic" | "external";
    models: Record<string, { role: string; offline: boolean }>;
  };
  /** OpenTimestamps anchoring: "live" submits to real calendars, "mock" is offline. */
  ots?: {
    mode: "live" | "mock";
  };
  seal_credits: {
    initial_balance: number;
    low_balance_threshold: number;
  };
  storage: {
    vault_dir: string;
    ledger_file: string;
    audit_log: string;
    alerts_dir: string;
    invoices_dir: string;
    sealed_dir: string;
    /** Original uploaded evidence (spec §7.2). Defaults to <vault_dir>/evidence. */
    evidence_dir?: string;
    /** Forensic engine output JSON (spec §7.2). Defaults to <vault_dir>/findings. */
    findings_dir?: string;
  };
  server: {
    host: string;
    port: number;
  };
}

export interface DetectionSignal {
  source: string;
  fraud_type: FraudType;
  confidence: Confidence;
  score: number;
  reasons: string[];
  related_txn_ids: string[];
}

/* ------------------------------------------------------------------ *
 * Forensic evidence extraction models
 * Spec references: VO-ANDROID-SPEC-5.2.7-2026 §4.3, §12.1, §12.2
 * ------------------------------------------------------------------ */

/** Severity scale for contradictions (spec §12.2). */
export const SeveritySchema = z.enum([
  "CRITICAL",
  "VERY_HIGH",
  "HIGH",
  "MODERATE",
  "LOW",
]);
export type Severity = z.infer<typeof SeveritySchema>;

/**
 * Nine-Brain source identifiers (spec §1.3 / Table 5).
 * The extraction engine attributes each atom / contradiction to the brain
 * that produced it. Deterministic offline heuristics stand in for the
 * model roles without changing the contract.
 */
export const BrainSourceSchema = z.enum([
  "B1-ContradictionBrain",
  "B2-DocumentForensics",
  "B3-Communications",
  "B4-Linguistics",
  "B5-Timeline",
  "B6-Financial",
  "B7-LegalMapping",
  "B8-AudioForensics",
  "B9-RnDValidation",
]);
export type BrainSource = z.infer<typeof BrainSourceSchema>;

/** Ordinal verifier vote used inside triple-AI consensus blocks. */
export const VerifierVoteSchema = z.enum([
  "CONCURS",
  "VERIFIED",
  "DISSENTS",
  "ABSTAIN",
  "INSUFFICIENT",
]);
export type VerifierVote = z.infer<typeof VerifierVoteSchema>;

/** Triple-AI consensus block embedded in atoms and contradictions. */
export const TripleAiConsensusSchema = z.object({
  gemma3: VerifierVoteSchema,
  phi3: VerifierVoteSchema,
  nine_brain: VerifierVoteSchema,
  quorum: z.boolean(),
});
export type TripleAiConsensus = z.infer<typeof TripleAiConsensusSchema>;

export const GpsSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
  timestamp: z.string().optional(),
});
export type Gps = z.infer<typeof GpsSchema>;

export const EvidenceTypeSchema = z.enum([
  "document",
  "email",
  "chat",
  "image",
  "audio",
  "video",
  "scan",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

/** A single uploaded piece of evidence, ready for extraction (spec §4.1). */
export const ForensicDocumentSchema = z.object({
  evidence_id: z.string(),
  type: EvidenceTypeSchema.default("document"),
  source_file: z.string(),
  /** Whole-document text; alternatively provide `pages`. */
  text: z.string().optional(),
  /** Page-segmented text for accurate page anchoring. */
  pages: z
    .array(z.object({ page: z.number().int().positive(), text: z.string() }))
    .optional(),
  gps: GpsSchema.optional(),
  jurisdiction: z.string().optional(),
});
export type ForensicDocument = z.infer<typeof ForensicDocumentSchema>;

/** Evidence Atom — verbatim, anchored extract (spec §12.1). */
export const EvidenceAtomSchema = z.object({
  atom_id: z.string(),
  evidence_id: z.string(),
  type: EvidenceTypeSchema,
  source_file: z.string(),
  sha512: z.string(),
  page_number: z.number().int().positive(),
  line_range: z.string(),
  content: z.string(),
  context_before: z.string(),
  context_after: z.string(),
  gps: GpsSchema.optional(),
  jurisdiction: z.string().optional(),
  legal_citations: z.array(z.string()).default([]),
  confidence: ConfidenceSchema,
  extracted_by: BrainSourceSchema,
  triple_ai_consensus: TripleAiConsensusSchema,
  timestamp: z.string(),
});
export type EvidenceAtom = z.infer<typeof EvidenceAtomSchema>;

/** One side of a contradiction, anchored to source evidence (spec §12.2). */
export const ClaimAnchorSchema = z.object({
  text: z.string(),
  source: z.string(),
  evidence_id: z.string(),
  page: z.number().int().positive(),
  line: z.number().int().nonnegative(),
  sha512: z.string(),
});
export type ClaimAnchor = z.infer<typeof ClaimAnchorSchema>;

/** Structured contradiction (spec §12.2). */
export const ContradictionSchema = z.object({
  contradiction_id: z.string(),
  brain_source: BrainSourceSchema,
  respondent: z.string().optional(),
  claim_a: ClaimAnchorSchema,
  claim_b: ClaimAnchorSchema,
  severity: SeveritySchema,
  legal_significance: z.string().optional(),
  applicable_law: z.array(z.string()).default([]),
  confidence: ConfidenceSchema,
  resolution_status: z.enum(["CONFIRMED", "PENDING", "DISMISSED"]),
  triple_ai_consensus: TripleAiConsensusSchema,
  timestamp: z.string(),
});
export type Contradiction = z.infer<typeof ContradictionSchema>;

/** Reconstructed timeline event anchored to evidence (spec §4.4 / §5.3). */
export const TimelineEventSchema = z.object({
  event_id: z.string(),
  /** Human-readable date as found in the evidence. */
  date: z.string(),
  /** ISO date for sorting when parseable. */
  iso_date: z.string().optional(),
  description: z.string(),
  evidence_id: z.string(),
  page: z.number().int().nonnegative(),
  line: z.number().int().nonnegative(),
  sha512: z.string(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

/** Offence matrix row: offence → legal basis + evidence anchors (spec §5.3). */
export const OffenceSchema = z.object({
  offence_id: z.string(),
  title: z.string(),
  legal_basis: z.array(z.string()).default([]),
  evidence_anchors: z.array(z.string()).default([]),
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  /** Origin, e.g. a contradiction id or "rule-engine". */
  source: z.string().optional(),
});
export type Offence = z.infer<typeof OffenceSchema>;

/** Aggregate findings written to the vault `findings/` directory (spec §7.2). */
export interface ExtractionFindings {
  generated_at: string;
  constitution_version: string;
  institution: string;
  document_count: number;
  atom_count: number;
  contradiction_count: number;
  atoms: EvidenceAtom[];
  contradictions: Contradiction[];
  timeline: TimelineEvent[];
  offences: Offence[];
}
