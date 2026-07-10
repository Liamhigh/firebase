import { makeInvoiceId, shortCode } from "./crypto.js";
import type {
  CommissionInvoice,
  FirewallConfig,
  SealRecord,
} from "./types.js";

/**
 * Hard-coded 20% commission — not AI-configurable.
 * Privacy: invoice never includes customer data, transaction details, or evidence.
 */
export function generateCommissionInvoice(params: {
  config: FirewallConfig;
  institution: string;
  caseReference: string;
  fraudAmount: number;
  currency: string;
  seal: SealRecord;
  generatedAt?: string;
}): CommissionInvoice {
  const { config, institution, caseReference, fraudAmount, currency, seal } =
    params;
  if (config.verum.commission_percent !== 20) {
    throw new Error("Commission percent must be 20% (hard-coded)");
  }
  const commissionAmount = roundMoney(fraudAmount * 0.2);
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const due = new Date(generatedAt);
  due.setUTCDate(due.getUTCDate() + 30);
  const sealShort = shortCode(seal.seal_id.replace(/^seal-/, ""), 8);
  const invoiceId = makeInvoiceId(sealShort);

  const invoice: CommissionInvoice = {
    invoice_id: invoiceId,
    institution,
    case_reference: caseReference,
    fraud_amount: fraudAmount,
    commission_percent: 20,
    commission_amount: commissionAmount,
    currency,
    payment_reference: invoiceId,
    due_date: due.toISOString(),
    status: "ISSUED",
    seal_id: seal.seal_id,
    blockchain_block: seal.blockchain?.block_height,
    evidence_received_by_verum: false,
    generated_at: generatedAt,
  };

  assertInvoicePrivacy(invoice);
  return invoice;
}

/** CODE-enforced privacy: invoice payload must not contain evidence fields. */
export function assertInvoicePrivacy(invoice: CommissionInvoice): void {
  if (invoice.evidence_received_by_verum !== false) {
    throw new Error("PRIVACY VIOLATION: evidence_received_by_verum must be false");
  }
  const forbidden = [
    "customer",
    "account",
    "txn",
    "transaction",
    "evidence",
    "pii",
    "attachment",
  ];
  const keys = Object.keys(invoice).map((k) => k.toLowerCase());
  for (const key of keys) {
    for (const bad of forbidden) {
      if (key.includes(bad) && key !== "evidence_received_by_verum") {
        throw new Error(`PRIVACY VIOLATION: forbidden invoice field '${key}'`);
      }
    }
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
