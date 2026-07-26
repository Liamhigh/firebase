import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import { FraudFirewall } from "../src/pipeline/firewall.js";
import { demoDocuments } from "../src/forensics/engine.js";
import type { FirewallConfig } from "../src/core/types.js";

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-chat-"));
  const base = loadConfig(join(process.cwd(), "config/firewall.json"));
  return {
    ...base,
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

describe("guardian case chat", () => {
  it("reports real credit balance and institution, never invented numbers", () => {
    const config = isolatedConfig();
    const fw = new FraudFirewall(config, { autoUpdateRules: false });

    const status = fw.chat("give me a status overview");
    assert.equal(status.intent, "status");
    assert.ok(status.reply.includes(config.institution.name));
    assert.ok(status.reply.includes(`v${config.constitution_version}`));

    const credits = fw.chat("how many seal credits are left?");
    assert.equal(credits.intent, "credits");
    const ledger = fw.getCredits();
    assert.ok(credits.reply.includes(String(ledger.credits.remaining)));

    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("answers findings questions from the last scan's manifest", async () => {
    const config = isolatedConfig();
    const fw = new FraudFirewall(config, { autoUpdateRules: false });

    const before = fw.chat("what contradictions did you find?");
    assert.equal(before.intent, "findings");
    assert.ok(before.reply.includes("No findings on file"));

    const result = await fw.extractEvidence({ documents: demoDocuments() });
    assert.ok(result.findings.contradiction_count > 0);

    const after = fw.chat("show me the findings");
    assert.equal(after.intent, "findings");
    assert.ok(
      after.reply.includes(`${result.findings.contradiction_count} contradiction(s)`),
      "reply must state the real contradiction count",
    );
    assert.ok(after.reply.includes("human review"));

    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("lists vault evidence and deployed agents", async () => {
    const config = isolatedConfig();
    const fw = new FraudFirewall(config, { autoUpdateRules: false });
    for (const doc of demoDocuments()) fw.ingestEvidence(doc);

    const vault = fw.chat("what evidence is in the vault?");
    assert.equal(vault.intent, "vault");
    assert.ok(vault.reply.includes("3 document(s)"));
    assert.ok(vault.reply.includes("DOC001"));

    const agents = fw.chat("which agents are deployed?");
    assert.equal(agents.intent, "agents");
    assert.ok(agents.reply.includes("TransactionMonitor"));

    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("routes verification questions to the website hub and holds the privacy line", () => {
    const config = isolatedConfig();
    const fw = new FraudFirewall(config, { autoUpdateRules: false });

    const verify = fw.chat("how do I verify a sealed document?");
    assert.equal(verify.intent, "verify");
    assert.ok(verify.reply.includes("verumglobal.foundation/verify.html"));

    const privacy = fw.chat("does customer data ever leave the bank?");
    assert.equal(privacy.intent, "privacy");
    assert.ok(privacy.reply.includes("commission invoices only"));

    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});
