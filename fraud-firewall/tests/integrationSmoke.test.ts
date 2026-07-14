// CONSTITUTION: v6.0 Final — Integration Smoke Test
// Seal: VO-CE-v531c-DIGSIM-20260713
//
// End-to-end smoke test: claims → detectors → findings.json
// Verifies the full v6 pipeline produces valid, structurally correct output.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { detectAll, resetCounter } from "../src/engine/detector.js";
import { engineContradictionToRecord, runScanWithFindings, G3CandidateRegistry } from "../src/pipeline/g3HybridPipeline.js";
import { STATUS_ENGINE_VERIFIED, STATUS_G3_CANDIDATE } from "../src/pipeline/findingsJsonEmitter.js";
import { ContradictionType, StatementType } from "../src/engine/enums.js";
import type { Claim } from "../src/engine/types.js";

// ── Test helpers ──────────────────────────────────────────────────────

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: `claim-${Math.random().toString(36).slice(2, 8)}`,
    subject: "GOODWILL_VALUE",
    predicate: "exists",
    value: "default value",
    actor: "TestActor",
    date: null,
    sourceType: StatementType.CLAIM,
    sourceLocation: "test",
    documentId: "doc-1",
    sha512Hash: "a".repeat(128),
    pageNumber: 1,
    context: "test context",
    ...overrides,
  };
}

// ── 1. Detector pipeline smoke test ───────────────────────────────────

describe("v6 Detector Pipeline — Smoke", () => {
  beforeEach(() => resetCounter());

  it("detects STATEMENT_VS_STATEMENT for same actor, opposing claims", () => {
    const claims: Claim[] = [
      makeClaim({ actor: "Alice", value: "I paid the full amount", subject: "PAYMENT" }),
      makeClaim({ actor: "Alice", value: "I did not pay the full amount", subject: "PAYMENT" }),
    ];
    const results = detectAll(claims);
    assert.ok(results.length > 0, "expected at least one contradiction");
    assert.strictEqual(results[0].type, ContradictionType.STATEMENT_VS_STATEMENT);
    assert.strictEqual(results[0].propositionAActor, "Alice");
    assert.strictEqual(results[0].propositionBActor, "Alice");
  });

  it("detects TEMPORAL_CONTRADICTION for same actor, same subject, different dates", () => {
    const claims: Claim[] = [
      makeClaim({ actor: "Bob", value: "the contract was signed", subject: "CONTRACT", date: 1609459200000 }),
      makeClaim({ actor: "Bob", value: "the contract was never signed", subject: "CONTRACT", date: 1640995200000 }),
    ];
    const results = detectAll(claims);
    const temporal = results.filter((r) => r.type === ContradictionType.TEMPORAL_CONTRADICTION);
    assert.ok(temporal.length > 0, "expected temporal contradiction");
  });

  it("detects DEFECTIVE_JURAT when affidavit lacks jurat elements", () => {
    const claims: Claim[] = [
      makeClaim({ value: "the affidavit was sworn before a commissioner", actor: "Clerk" }),
      makeClaim({ value: "there was no jurat and no commissioner present", actor: "Clerk" }),
    ];
    const results = detectAll(claims);
    const jurat = results.filter((r) => r.type === ContradictionType.DEFECTIVE_JURAT);
    assert.ok(jurat.length > 0, "expected defective jurat detection");
  });

  it("detects PROTECTION_ORDER_AS_LEVERAGE", () => {
    const claims: Claim[] = [
      makeClaim({ value: "filed a protection order under the harassment act", actor: "David" }),
      makeClaim({ value: "used the order as leverage to force a settlement", actor: "David" }),
    ];
    const results = detectAll(claims);
    const leverage = results.filter((r) => r.type === ContradictionType.PROTECTION_ORDER_AS_LEVERAGE);
    assert.ok(leverage.length > 0, "expected protection order leverage detection");
  });

  it("detects CHARACTER_ASSASSINATION in sworn testimony with personal attacks", () => {
    const claims: Claim[] = [
      makeClaim({
        value: "the defendant has a history of emotional instability and drinking problems",
        actor: "Witness",
        sourceType: StatementType.SWORN_STATEMENT,
      }),
    ];
    const results = detectAll(claims);
    const charAssassin = results.filter((r) => r.type === ContradictionType.CHARACTER_ASSASSINATION);
    assert.ok(charAssassin.length > 0, "expected character assassination detection");
  });

  it("produces valid three-layer output for every contradiction", () => {
    const claims: Claim[] = [
      makeClaim({ actor: "Eve", value: "I admit liability for the breach", subject: "LIABILITY" }),
      makeClaim({ actor: "Eve", value: "I deny all liability for the breach", subject: "LIABILITY" }),
    ];
    const results = detectAll(claims);
    assert.ok(results.length > 0, "expected contradictions");
    for (const c of results) {
      assert.match(c.contradictionId, /^C-\d{4}$/);
      assert.ok(c.detectedFact, "detectedFact must exist");
      assert.ok(c.detectedFact.factText.includes("Eve"), "factText must mention actor");
      assert.ok(c.logicalPattern, "logicalPattern must exist");
      assert.ok(c.logicalPattern.patternType, "patternType must be truthy");
      assert.ok(c.logicalPattern.contradictionScore >= 0 && c.logicalPattern.contradictionScore <= 1,
        "contradictionScore must be in [0,1]");
    }
  });
});

// ── 2. G3 Pipeline → Findings JSON smoke test ─────────────────────────

describe("G3 Hybrid Pipeline — Findings JSON Smoke", () => {
  beforeEach(() => resetCounter());

  it("converts engine contradictions to valid findings JSON records", () => {
    const claims: Claim[] = [
      makeClaim({ actor: "Fraudster", value: "the deposit was R50000", subject: "FINANCIAL" }),
      makeClaim({ actor: "Fraudster", value: "the deposit was only R5000", subject: "FINANCIAL" }),
    ];
    const contradictions = detectAll(claims);
    assert.ok(contradictions.length > 0, "expected contradictions");

    const records = contradictions.map(engineContradictionToRecord);
    assert.strictEqual(records.length, contradictions.length);

    for (const r of records) {
      assert.match(r.contradiction_id, /^C-\d{4}$/);
      assert.strictEqual(r.proposition_a_actor, "Fraudster");
      assert.strictEqual(r.verification_status, STATUS_ENGINE_VERIFIED);
      assert.ok(r.detected_fact, "detected_fact must exist");
      assert.ok(r.logical_pattern, "logical_pattern must exist");
    }
  });

  it("emits a complete Findings JSON document via runScanWithFindings", () => {
    const texts = [
      "Witness A stated under oath: the contract was signed on January 1st",
      "Witness A later stated: the contract was never signed at all",
      "Documentary evidence shows the contract was signed by both parties",
    ];

    const result = runScanWithFindings(texts, {
      caseId: "VO-TEST-001",
      engineVersion: "5.3.1c",
      sourceBundle: "smoke-test-bundle",
    });

    assert.ok(result.report, "report must exist");
    assert.ok(result.findings, "findings must exist");
    assert.strictEqual(result.findings.engine_version, "5.3.1c");
    assert.strictEqual(result.findings.findings_json_version, "1.0.0");
    assert.strictEqual(result.findings.source_bundle, "smoke-test-bundle");
    assert.ok(result.findings.case_ids.includes("VO-TEST-001"));
    assert.strictEqual(typeof result.findings.generated_utc, "string");
  });

  it("G3CandidateRegistry raises, promotes, rejects, and confirms candidates", () => {
    const registry = new G3CandidateRegistry("gemma-3-4b-it");

    const candidate = registry.raise({
      contradictionType: ContradictionType.SHAM_TRANSACTION,
      propositionAText: "claimed arm's length transaction",
      propositionBText: "evidence shows common directorship",
      propositionAActor: "Corp A",
      propositionBActor: "Corp B",
      sourceDocument: "doc-sham-001",
      sourcePage: 5,
      sha512Anchor: "b".repeat(128),
      severity: "HIGH",
      confidence: "HIGH",
    });

    assert.strictEqual(candidate.verification_status, STATUS_G3_CANDIDATE);
    assert.strictEqual(registry.pending().length, 1);

    // Promote
    registry.promote(candidate.contradiction_id, "engine_reverified");
    assert.strictEqual(registry.pending().length, 0);

    // Confirm judicially
    const confirmed = registry.confirmJudicially(
      candidate.contradiction_id,
      "H208/25",
      "High Court Johannesburg",
      "Case 2025/1234",
    );
    assert.strictEqual(confirmed.verification_status, "JUDICIALLY-CONFIRMED");

    // Audit trail: RAISED (from raise()) + PROMOTED + JUDICIALLY-CONFIRMED
    const audit = registry.auditTrail();
    assert.strictEqual(audit.length, 3);
    assert.strictEqual(audit[0].action, "RAISED");
    assert.strictEqual(audit[1].action, "PROMOTED");
    assert.strictEqual(audit[2].action, "JUDICIALLY-CONFIRMED");
  });

  it("merges registry into findings and recounts tiers correctly", () => {
    // First get engine findings
    const texts = [
      "Director X said: the company is independently owned",
      "SEC filing shows Director X owns 80% of the shares",
    ];
    const { findings } = runScanWithFindings(texts, { caseId: "VO-MERGE-001" });

    const registry = new G3CandidateRegistry();
    // Raise a G3 candidate
    const candidate = registry.raise({
      contradictionType: ContradictionType.PROCESS_REMEDY_CONFLICT,
      propositionAText: "institution has mandatory duty to respond",
      propositionBText: "institution bounced all submissions",
      propositionAActor: "Regulator",
      propositionBActor: "Regulator",
      sourceDocument: "doc-remedy-001",
      sourcePage: 1,
      sha512Anchor: "c".repeat(128),
      severity: "VERY_HIGH",
      confidence: "VERY_HIGH",
    });

    const merged = registry.mergeInto(findings);
    assert.strictEqual(merged.g3_candidate_count, 1);
    assert.strictEqual(merged.engine_verified_count, findings.contradictions.length);
    assert.strictEqual(merged.contradictions.length, findings.contradictions.length + 1);
  });
});

// ── 3. Full v6 round-trip ─────────────────────────────────────────────

describe("v6 Full Round-Trip", () => {
  beforeEach(() => resetCounter());

  it("processes contradictory texts end-to-end and produces sealed output", () => {
    const texts = [
      // Affidavit 1 — sworn statement
      "I, John Doe, solemnly swear that I never received any payment from Palmbili Pty Ltd for the goodwill transfer.",
      // Affidavit 2 — same actor, opposite claim
      "I, John Doe, acknowledge that Palmbili Pty Ltd paid me R2.3 million in full settlement of the goodwill dispute.",
      // Contemporaneous email contradicting both
      "From: accounts@palmbili.co.za | Date: 2023-03-15 | Subject: Goodwill payment | The EFT for R2.3m to Mr Doe cleared today.",
    ];

    const { report, findings } = runScanWithFindings(texts, {
      caseId: "VO-ROUNDTRIP-001",
      caseName: "allfuels",
      engineVersion: "5.3.1c",
    });

    // Report validations
    assert.strictEqual(report.caseId, "VO-ROUNDTRIP-001");
    assert.ok(report.contradictions.length > 0, "expected contradictions in report");
    assert.ok(report.corpusHash, "corpusHash must be truthy");

    // Findings validations
    assert.ok(findings.contradictions.length > 0, "expected contradictions in findings");
    assert.strictEqual(findings.engine_verified_count, findings.contradictions.length);

    // Every record has required fields
    for (const r of findings.contradictions) {
      assert.match(r.contradiction_id, /^C-\d{4}$/);
      assert.ok(r.type, "type must be truthy");
      assert.ok(r.severity, "severity must be truthy");
      assert.ok(r.confidence, "confidence must be truthy");
      assert.ok(r.proposition_a_text, "proposition_a_text must be truthy");
      assert.ok(r.proposition_b_text, "proposition_b_text must be truthy");
      assert.strictEqual(r.verification_status, STATUS_ENGINE_VERIFIED);
      assert.ok(r.detected_fact, "detected_fact must exist");
      assert.ok(r.logical_pattern, "logical_pattern must exist");
    }

    // JSON serialization round-trip
    const json = JSON.stringify(findings, null, 2);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.contradictions.length, findings.contradictions.length);
    assert.strictEqual(parsed.engine_version, "5.3.1c");
  });
});
