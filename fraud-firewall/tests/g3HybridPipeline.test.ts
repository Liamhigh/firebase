import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runScanWithFindings,
  G3CandidateRegistry,
  engineContradictionToRecord,
} from "../src/pipeline/g3HybridPipeline.js";
import {
  STATUS_ENGINE_VERIFIED,
  STATUS_G3_CANDIDATE,
  STATUS_CANDIDATE_PROMOTED,
  STATUS_CANDIDATE_REJECTED,
} from "../src/pipeline/findingsJsonEmitter.js";

const DEMO_TEXTS = [
  "On 10 March 2025 Marius stated the deal fell through and Greensky never invoiced the client.",
  "On 6 April 2025 Marius admitted that Kevin completed the deal on 13 March 2025.",
  "Standard Bank promised on 19 June 2025 that the client would be contacted by next week.",
  "Standard Bank never contacted the client. No one called. No letter arrived.",
  "The cease and desist letter was served on 23 April 2025 according to the attorney.",
  "The cease and desist letter is dated 30 April 2025 on its face.",
];

const REQUIRED_RECORD_FIELDS = [
  "contradiction_id",
  "type",
  "severity",
  "confidence",
  "proposition_a_text",
  "proposition_b_text",
  "proposition_a_actor",
  "proposition_b_actor",
  "conflict_description",
  "verification_status",
] as const;

describe("GHRP engine -> findings JSON", () => {
  const { report, findings } = runScanWithFindings(DEMO_TEXTS, {
    caseId: "VO-GHRP-TEST-001",
    sourceBundle: "ghrp_demo.txt",
    injectedTimestamp: 1,
  });

  it("detects contradictions in the demo corpus", () => {
    assert.ok(report.contradictions.length >= 1);
  });

  it("emits the findings header contract", () => {
    assert.equal(findings.findings_json_version, "1.0.0");
    assert.equal(findings.source_bundle, "ghrp_demo.txt");
    assert.equal(
      findings.contradictions.length,
      findings.engine_verified_count + findings.g3_candidate_count,
    );
  });

  it("anchors every record with required schema fields", () => {
    for (const record of findings.contradictions) {
      for (const field of REQUIRED_RECORD_FIELDS) {
        assert.ok(field in record, `record missing ${field}`);
      }
      assert.equal(record.verification_status, STATUS_ENGINE_VERIFIED);
    }
  });

  it("maps engine contradictions losslessly", () => {
    const first = report.contradictions[0];
    const record = engineContradictionToRecord(first);
    assert.equal(record.contradiction_id, first.contradictionId);
    assert.equal(record.sha512_anchor, first.detectedFact.sha512Hash);
    assert.equal(record.source_page, first.detectedFact.sourcePage);
  });
});

describe("G3 candidate registry (two-tier rule)", () => {
  const anchor = "ab".repeat(64);

  function raiseOne(registry: G3CandidateRegistry, description: string) {
    return registry.raise({
      candidateId: `G3-CAND-${description}`,
      contradictionType: "OMISSION",
      propositionAText: "Reply promised by next week",
      propositionBText: "No reply exists anywhere in the sealed vault",
      propositionAActor: "Standard Bank",
      propositionBActor: "Sealed record",
      conflictDescription: description,
      sourceDocument: "ghrp_demo.txt",
      sourcePage: 3,
      sha512Anchor: anchor,
    });
  }

  it("labels candidates pending verification", () => {
    const registry = new G3CandidateRegistry();
    const record = raiseOne(registry, "first");
    assert.equal(record.verification_status, STATUS_G3_CANDIDATE);
    assert.equal(registry.pending().length, 1);
  });

  it("refuses unanchored candidates", () => {
    const registry = new G3CandidateRegistry();
    assert.throws(() =>
      registry.raise({
        candidateId: "G3-CAND-X",
        contradictionType: "OMISSION",
        propositionAText: "x",
        propositionBText: "y",
        propositionAActor: "a",
        propositionBActor: "b",
        conflictDescription: "unanchored",
        sourceDocument: "",
        sourcePage: 0,
        sha512Anchor: "",
      }),
    );
  });

  it("promotes and rejects with audit trail", () => {
    const registry = new G3CandidateRegistry();
    const promoted = raiseOne(registry, "promote-me");
    registry.promote(promoted.contradiction_id, "engine_rerun");
    const rejected = raiseOne(registry, "reject-me");
    registry.reject(rejected.contradiction_id, "Duplicate of engine finding");

    const byId = (id: string) =>
      registry.allRecords().find((r) => r.contradiction_id === id)!;
    assert.equal(byId(promoted.contradiction_id).verification_status, STATUS_CANDIDATE_PROMOTED);
    assert.equal(byId(rejected.contradiction_id).verification_status, STATUS_CANDIDATE_REJECTED);
    assert.deepEqual(
      registry.auditTrail().map((a) => a.action).sort(),
      ["PROMOTED", "RAISED", "RAISED", "REJECTED"],
    );
  });

  it("refuses rejection without a reason", () => {
    const registry = new G3CandidateRegistry();
    const record = raiseOne(registry, "no-reason");
    assert.throws(() => registry.reject(record.contradiction_id, ""));
  });

  it("merge recounts tiers and excludes rejected", () => {
    const { findings } = runScanWithFindings(DEMO_TEXTS.slice(0, 2), {
      caseId: "VO-GHRP-TEST-002",
      injectedTimestamp: 1,
    });
    const registry = new G3CandidateRegistry();
    const promoted = raiseOne(registry, "merged-in");
    registry.promote(promoted.contradiction_id);
    const rejected = raiseOne(registry, "kept-out");
    registry.reject(rejected.contradiction_id, "Not supported by the sealed record");

    const merged = registry.mergeInto(findings);
    const ids = merged.contradictions.map((r) => r.contradiction_id);
    assert.ok(ids.includes(promoted.contradiction_id));
    assert.ok(!ids.includes(rejected.contradiction_id));
    assert.equal(
      merged.contradictions.length,
      merged.engine_verified_count + merged.g3_candidate_count,
    );
  });
});
