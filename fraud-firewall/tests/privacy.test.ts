import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import {
  assertInvoicePrivacy,
  generateCommissionInvoice,
} from "../src/core/commission.js";
import { NotificationService } from "../src/notifications/email.js";
import type { CommissionInvoice, FirewallConfig, SealRecord } from "../src/core/types.js";

function testConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-"));
  const base = loadConfig(join(process.cwd(), "config/firewall.json"));
  return {
    ...base,
    storage: {
      vault_dir: root,
      ledger_file: join(root, "ledger.json"),
      audit_log: join(root, "audit.jsonl"),
      alerts_dir: join(root, "alerts"),
      invoices_dir: join(root, "invoices"),
      sealed_dir: join(root, "sealed"),
    },
  };
}

describe("privacy hard rules", () => {
  it("commission invoice never marks evidence received by Verum", () => {
    const config = testConfig();
    const seal: SealRecord = {
      seal_id: "seal-8521b5e0b68bf138ec24cc9c",
      sha512: "a".repeat(128),
      constitution_version: "5.2.7",
      created_at: "2026-07-06T14:35:00Z",
      document_reference: "VO-FW-CASE-2026-0001",
      blockchain: { provider: "OpenTimestamps", status: "MOCK", block_height: 892345 },
    };
    const invoice = generateCommissionInvoice({
      config,
      institution: "Demo Bank",
      caseReference: "CASE-2026-0001",
      fraudAmount: 1_500_000,
      currency: "ZAR",
      seal,
      generatedAt: "2026-07-06T14:35:00Z",
    });
    assert.equal(invoice.commission_percent, 20);
    assert.equal(invoice.commission_amount, 300_000);
    assert.equal(invoice.evidence_received_by_verum, false);
    assertInvoicePrivacy(invoice);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("blocks Verum emails that try to attach evidence", () => {
    const config = testConfig();
    const notifications = new NotificationService(config);
    assert.throws(
      () =>
        notifications.enforceNoEvidenceToVerum({
          to: config.verum.commission_email,
          subject: "test",
          body: "invoice",
          attachments: [{ filename: "evidence.pdf", path: "/tmp/x.pdf" }],
          recipient_role: "verum",
        }),
      /PRIVACY VIOLATION/,
    );
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("rejects invoice objects with forbidden evidence fields", () => {
    const bad = {
      invoice_id: "x",
      institution: "Bank",
      case_reference: "CASE-1",
      fraud_amount: 100,
      commission_percent: 20,
      commission_amount: 20,
      currency: "ZAR",
      payment_reference: "x",
      due_date: "2026-08-01T00:00:00Z",
      status: "ISSUED",
      seal_id: "seal-abc",
      evidence_received_by_verum: false,
      generated_at: "2026-07-06T14:35:00Z",
      customer_account: "secret",
    } as unknown as CommissionInvoice;
    assert.throws(() => assertInvoicePrivacy(bad), /PRIVACY VIOLATION/);
  });
});
