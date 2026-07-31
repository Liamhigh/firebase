// v6.0 franchise/lease legal contradictions in the LIVE firewall engine
// (src/forensics). Grounded in the AllFuels / Caltex Franchise Agreement facts
// the engine previously missed because the lease agreement carrying clause 3.2.3
// was never read against the ownership record.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EvidenceExtractor } from "../src/forensics/extractor.js";
import { ContradictionEngine } from "../src/forensics/contradiction.js";
import type { ForensicDocument } from "../src/core/types.js";

const FIXED_NOW = "2026-07-27T00:00:00.000Z";

function detect(doc: ForensicDocument) {
  const extractor = new EvidenceExtractor();
  const engine = new ContradictionEngine();
  return engine.detect(extractor.extract(doc, { now: FIXED_NOW }), { now: FIXED_NOW });
}

describe("v6.0 franchise/lease legal contradictions (live forensics engine)", () => {
  it("flags the Lessee/Owner conditional-clause trap (cl. 3.2.3) as CRITICAL / B7", () => {
    const found = detect({
      evidence_id: "ALLFUELS-1",
      type: "document",
      source_file: "franchise_agreement_and_ownership.txt",
      jurisdiction: "ZA-KZN",
      pages: [{
        page: 1,
        text:
          "In the event that the FRANCHISOR is not the owner of the Premises but is the Lessee under a head lease, this Contract shall be deemed to have terminated.\n" +
          "By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.",
      }],
    });
    const hit = found.find((c) => c.legal_significance.includes("lessee"));
    assert.ok(hit, "expected a CLAUSE_PRECONDITION contradiction");
    assert.equal(hit!.brain_source, "B7-LegalMapping");
    assert.equal(hit!.severity, "CRITICAL");
  });

  it("flags goodwill recognised-then-denied as CRITICAL / B7", () => {
    const found = detect({
      evidence_id: "ALLFUELS-2",
      type: "document",
      source_file: "goodwill_recognition_vs_denial.txt",
      jurisdiction: "ZA-KZN",
      pages: [{
        page: 1,
        text:
          "The clawback shall apply in respect of the Value of the Business and the goodwill shall inure to the FRANCHISEE.\n" +
          "The respondent submitted that goodwill has no compensable value.",
      }],
    });
    const hit = found.find((c) => c.legal_significance.toLowerCase().includes("goodwill"));
    assert.ok(hit, "expected an ASSET_VALUE_DENIAL contradiction");
    assert.equal(hit!.brain_source, "B7-LegalMapping");
    assert.equal(hit!.severity, "CRITICAL");
  });

  it("does not fire on a clean franchise document", () => {
    const found = detect({
      evidence_id: "CLEAN-1",
      type: "document",
      source_file: "clean.txt",
      jurisdiction: "ZA-KZN",
      pages: [{
        page: 1,
        text:
          "The franchisee operated the site under a valid lease.\n" +
          "Rent was paid monthly and the agreement was renewed on schedule.",
      }],
    });
    assert.ok(!found.some((c) => c.brain_source === "B7-LegalMapping"),
      "no false legal-mapping contradiction on a clean document");
  });
});
