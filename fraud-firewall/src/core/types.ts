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
  sha512: z.string(),
  constitution_version: z.string(),
  created_at: z.string(),
  document_reference: z.string(),
  blockchain: z
    .object({
      provider: z.literal("OpenTimestamps"),
      status: z.enum(["SUBMITTED", "PENDING", "CONFIRMED", "MOCK"]),
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
