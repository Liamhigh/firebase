import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import { FraudFirewall, demoTransactions } from "../src/pipeline/firewall.js";
import { TripleAiConsensus } from "../src/ai/consensus.js";
import { SealCreditLedgerService } from "../src/core/sealCredits.js";
import type { FirewallConfig } from "../src/core/types.js";

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-pipe-"));
  const base = loadConfig(join(process.cwd(), "config/firewall.json"));
  return {
    ...base,
    ots: { mode: "mock" },
    seal_credits: { initial_balance: 100, low_balance_threshold: 5 },
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

describe("fraud detection pipeline", () => {
  it("detects, confirms, seals, and notifies without sending evidence to Verum", async () => {
    const config = isolatedConfig();
    const fw = new FraudFirewall(config);
    const result = await fw.monitor(demoTransactions());

    assert.ok(result.alert, "expected an alert");
    assert.equal(result.alert!.status, "CONFIRMED");
    assert.equal(result.alert!.verification.quorum, true);
    assert.ok(result.alert!.seal?.seal_id.startsWith("seal-"));
    assert.ok(result.sealed_pdf_path && existsSync(result.sealed_pdf_path));
    assert.ok(result.invoice_path && existsSync(result.invoice_path));
    assert.ok(result.verum_email_path && existsSync(result.verum_email_path));
    assert.ok(result.bank_email_path && existsSync(result.bank_email_path));

    const credits = fw.getCredits();
    assert.equal(credits.credits.used, 1);
    assert.equal(credits.credits.remaining, 99);

    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("consumes seal credits and refuses when empty", async () => {
    const config = isolatedConfig();
    config.seal_credits.initial_balance = 1;
    const credits = new SealCreditLedgerService(config);
    assert.equal(credits.canSeal(), true);
    credits.consumeSeal({
      sealId: "seal-test",
      documentReference: "DOC-1",
      documentSha512: "b".repeat(128),
    });
    assert.equal(credits.canSeal(), false);
    assert.throws(
      () =>
        credits.consumeSeal({
          sealId: "seal-test-2",
          documentReference: "DOC-2",
          documentSha512: "c".repeat(128),
        }),
      /No seal credits/,
    );
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("requires triple concurrence for quorum", () => {
    const consensus = new TripleAiConsensus();
    const empty = consensus.verify(
      {
        transactions: [],
        signals: [],
        anomaly_score: 0,
        institution: "Demo",
        jurisdiction: "ZA",
      },
      [],
    );
    assert.equal(empty.quorum, false);
    assert.equal(empty.status, "REJECTED");
  });
});
