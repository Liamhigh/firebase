// CONSTITUTION: v6.0 Final — Seal Engine Tests
// Seal: VO-SE-v100-DIGSIM-20260714
//
// Verifies tamper-evident sealing: individual record anchors + master vault hash.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  sealFindings,
  verifySeal,
  detectTampering,
  chainVault,
  serializeVault,
  parseVault,
} from "../src/engine/seal.js";
import { runScanWithFindings } from "../src/pipeline/g3HybridPipeline.js";
import { resetCounter } from "../src/engine/detector.js";
import type { SealedVault } from "../src/engine/seal.js";

describe("Seal Engine v1.0.0", () => {
  beforeEach(() => resetCounter());

  function makeVault(): SealedVault {
    const texts = [
      "Alice stated: I paid the deposit in full on 1 January 2023",
      "Alice later stated: I never paid any deposit",
      "Bank record shows EFT of R50000 from Alice to Bob on 2023-01-01",
    ];
    const { findings } = runScanWithFindings(texts, {
      caseId: "VO-SEAL-TEST-001",
      engineVersion: "5.3.1c",
    });
    return sealFindings(findings);
  }

  it("seals a findings document with individual record anchors", () => {
    const vault = makeVault();
    assert.ok(vault.seal, "seal must exist");
    assert.ok(vault.seal.vault_id, "vault_id must exist");
    assert.strictEqual(vault.seal.seal_engine_version, "1.0.0");
    assert.strictEqual(vault.seal.record_count, vault.findings.contradictions.length);
    assert.strictEqual(vault.seal.record_seals.length, vault.findings.contradictions.length);

    for (const rs of vault.seal.record_seals) {
      assert.match(rs.contradiction_id, /^C-\d{4}$/);
      assert.strictEqual(rs.sha512_anchor.length, 128); // hex SHA-512 = 128 chars
      assert.strictEqual(rs.seal_version, "1.0.0");
    }
  });

  it("produces a 128-char hex master SHA-512 hash", () => {
    const vault = makeVault();
    assert.strictEqual(vault.seal.master_sha512.length, 128);
    assert.match(vault.seal.master_sha512, /^[0-9a-f]{128}$/);
  });

  it("verifySeal returns true for untampered vault", () => {
    const vault = makeVault();
    assert.strictEqual(verifySeal(vault), true);
  });

  it("verifySeal returns false when a record is modified", () => {
    const vault = makeVault();
    // Tamper with a record
    vault.findings.contradictions[0].proposition_a_text = "TAMPERED TEXT";
    assert.strictEqual(verifySeal(vault), false);
  });

  it("verifySeal returns false when a record is added", () => {
    const vault = makeVault();
    // Add a fake record
    vault.findings.contradictions.push({
      contradiction_id: "C-9999",
      type: "FAKE",
      severity: "CRITICAL",
      confidence: "DETERMINISTIC",
      proposition_a_text: "injected",
      proposition_a_actor: "Nobody",
      proposition_b_text: "injected",
      proposition_b_actor: "Nobody",
      conflict_description: "This record was injected after sealing",
      verification_status: "ENGINE-VERIFIED",
    } as any);
    vault.findings.engine_verified_count++;
    assert.strictEqual(verifySeal(vault), false);
  });

  it("verifySeal returns false when a record is removed", () => {
    const vault = makeVault();
    // Remove a record
    vault.findings.contradictions.pop();
    assert.strictEqual(verifySeal(vault), false);
  });

  it("detectTampering identifies which records were modified", () => {
    const vault = makeVault();
    const originalId = vault.findings.contradictions[0].contradiction_id;
    vault.findings.contradictions[0].proposition_a_text = "TAMPERED";

    const tampered = detectTampering(vault);
    assert.ok(tampered.some((t) => t.includes(originalId)), "should identify tampered record");
  });

  it("detectTampering identifies added records", () => {
    const vault = makeVault();
    vault.findings.contradictions.push({
      contradiction_id: "C-9999",
      type: "FAKE",
      severity: "CRITICAL",
      confidence: "DETERMINISTIC",
      proposition_a_text: "injected",
      proposition_a_actor: "Nobody",
      proposition_b_text: "injected",
      proposition_b_actor: "Nobody",
      conflict_description: "injected after sealing",
      verification_status: "ENGINE-VERIFIED",
    } as any);

    const tampered = detectTampering(vault);
    assert.ok(tampered.some((t) => t.includes("ADDED:C-9999")), "should identify added record");
  });

  it("detectTampering identifies removed records", () => {
    const vault = makeVault();
    const removedId = vault.findings.contradictions[0].contradiction_id;
    vault.findings.contradictions.shift();

    const tampered = detectTampering(vault);
    assert.ok(tampered.some((t) => t.includes(`MISSING:${removedId}`)), "should identify missing record");
  });

  it("chains vaults for audit trail continuity", () => {
    const vault1 = makeVault();
    const vault2 = chainVault(vault1.findings, vault1);

    assert.strictEqual(vault2.seal.previous_vault_id, vault1.seal.vault_id);
    assert.notStrictEqual(vault2.seal.vault_id, vault1.seal.vault_id);
    assert.strictEqual(verifySeal(vault2), true);
  });

  it("serializes and parses round-trip without data loss", () => {
    const vault = makeVault();
    const serialized = serializeVault(vault);
    const parsed = parseVault(serialized);

    assert.strictEqual(parsed.seal.vault_id, vault.seal.vault_id);
    assert.strictEqual(parsed.seal.master_sha512, vault.seal.master_sha512);
    assert.strictEqual(parsed.findings.contradictions.length, vault.findings.contradictions.length);
    assert.strictEqual(verifySeal(parsed), true);
  });

  it("rejects parsing invalid vault JSON", () => {
    assert.throws(() => parseVault('{"invalid": true}'), /Invalid vault/);
    assert.throws(() => parseVault("not json at all"), /Unexpected token/);
  });

  it("produces deterministic record seals for identical input", () => {
    const texts = ["Alice said yes", "Alice said no"];
    const { findings } = runScanWithFindings(texts, { caseId: "VO-DET-001" });

    const vault1 = sealFindings(findings);
    const vault2 = sealFindings(findings);

    // Same findings should produce identical record seals
    for (let i = 0; i < vault1.seal.record_seals.length; i++) {
      assert.strictEqual(
        vault1.seal.record_seals[i].sha512_anchor,
        vault2.seal.record_seals[i].sha512_anchor,
        `record seal ${i} should be deterministic`,
      );
    }

    // But different vault IDs (random UUID)
    assert.notStrictEqual(vault1.seal.vault_id, vault2.seal.vault_id);
  });
});
