import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import type { FirewallConfig } from "../src/core/types.js";
import {
  CONSTITUTION_CONSTANTS,
  assertConstitutionIntegrity,
  constitutionRuleset,
  loadConstitution,
  type Constitution,
} from "../src/core/constitution.js";
import { assessEthics, assessWeaponization } from "../src/core/ethics.js";
import { FraudFirewall } from "../src/pipeline/firewall.js";

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-const-"));
  const base = loadConfig(join(process.cwd(), "config/firewall.json"));
  return {
    ...base,
    ots: { mode: "mock" },
    storage: {
      vault_dir: root,
      ledger_file: join(root, "l.json"),
      audit_log: join(root, "a.jsonl"),
      alerts_dir: join(root, "alerts"),
      invoices_dir: join(root, "inv"),
      sealed_dir: join(root, "sealed"),
    },
  };
}

describe("constitution integrity + canonical nine brains", () => {
  it("passes integrity for the sealed constitution", () => {
    assert.doesNotThrow(() => assertConstitutionIntegrity(loadConstitution()));
  });

  it("has exactly 9 brains matching the canonical B1-B9 forensic set", () => {
    const c = loadConstitution();
    const brains = c.nine_brains?.brains ?? [];
    assert.equal(brains.length, CONSTITUTION_CONSTANTS.BRAIN_COUNT);
    assert.equal(brains[0].id, "B1-ContradictionBrain");
    assert.equal(brains[5].id, "B6-Financial");
    assert.equal(brains[8].id, "B9-RnDValidation");
    assert.equal(brains[8].can_issue_verdicts, false); // R&D is non-voting
  });

  it("throws when constants are tampered", () => {
    const bad = JSON.parse(JSON.stringify(loadConstitution())) as Constitution;
    bad.hard_coded_constants!.commission_percent = 15;
    assert.throws(() => assertConstitutionIntegrity(bad), /INTEGRITY FAILURE/);
    const fewBrains = JSON.parse(JSON.stringify(loadConstitution())) as Constitution;
    fewBrains.nine_brains!.brains = fewBrains.nine_brains!.brains.slice(0, 8);
    assert.throws(() => assertConstitutionIntegrity(fewBrains), /INTEGRITY FAILURE/);
  });

  it("embeds nine brains + Article X + constants into the sealed ruleset hash", () => {
    const c = loadConstitution();
    const ruleset = constitutionRuleset(c);
    assert.equal(ruleset.hash.length, 128);
    // Changing the constitution changes the embedded hash (tamper-evidence).
    const mutated = JSON.parse(JSON.stringify(c)) as Constitution;
    mutated.non_weaponization!.core_principle = "changed";
    assert.notEqual(constitutionRuleset(mutated).hash, ruleset.hash);
  });
});

describe("Ethics Core kill switch (§2.3)", () => {
  it("does not halt within tolerance and halts above 0.3%", () => {
    assert.equal(assessEthics(0).halted, false);
    assert.equal(assessEthics(0.002).halted, false);
    assert.equal(assessEthics(0.004).halted, true);
  });
});

describe("Article X — non-weaponization doctrine", () => {
  it("flags prohibited offensive military use as a breach", () => {
    const w = assessWeaponization("Provide battlefield intelligence for offensive operations");
    assert.equal(w.breach, true);
    assert.match(w.classification ?? "", /WEAPONIZATION ATTEMPT/);
  });

  it("permits war-crimes / human-rights documentation", () => {
    const w = assessWeaponization("War crimes documentation and evidence preservation for human rights");
    assert.equal(w.breach, false);
  });

  it("ignores benign purposes", () => {
    assert.equal(assessWeaponization("Detect bank transaction fraud").breach, false);
  });
});

describe("constitutionCheck records breaches to the Silence Ledger", () => {
  it("writes a Silence Ledger entry on a weaponization breach", () => {
    const config = isolatedConfig();
    const fw = new FraudFirewall(config);
    const clean = fw.constitutionCheck({ purpose: "detect fraud" });
    assert.equal(clean.allowed, true);

    const breach = fw.constitutionCheck({ purpose: "missile guidance and lethal targeting" });
    assert.equal(breach.allowed, false);
    assert.equal(breach.weaponization.breach, true);
    assert.ok(breach.silence_ledger && existsSync(breach.silence_ledger.ledger_path));

    assert.equal(fw.getBrains().brains.length, 9);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});
