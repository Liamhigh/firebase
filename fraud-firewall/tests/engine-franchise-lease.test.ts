// v6.0 franchise/lease detectors — grounded in the AllFuels / Caltex Franchise
// Agreement fact pattern that the engine previously missed because the lease
// agreement carrying clause 3.2.3 was not read against the ownership facts.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractFromText, extractClaims } from "../src/engine/extractor.js";
import { detectAll } from "../src/engine/detector.js";
import { ContradictionType } from "../src/engine/enums.js";

// Real language from the sealed bundle (abbreviated but faithful).
const CORPUS = [
  // The 2001 Franchise Agreement, clause 3.2.3 — the conditional "Lessee" trap.
  "3.2.3 in the event that the FRANCHISOR is not the owner of the Premises, but is the Lessee in terms of a head lease agreement with a third party and such head lease terminates, then this Contract shall be deemed to have terminated or expired.",
  // The 2016 termination letter — expiry invoked by effluxion of time.
  "This Franchise Agreement expires by the effluxion of time on 31 July 2016 in terms of clause 3 and will not be renewed.",
  // Contemporaneous ownership fact — the franchisor had become the owner.
  "By 2014 Bright Idea Projects 66 (Pty) Ltd purchased the property and became the registered owner of the premises.",
  // The agreement recognises and quantifies goodwill / value of the business.
  'The clawback shall apply in respect of the Value of the Business; the goodwill arising out of the Franchised Business shall inure to the benefit of the FRANCHISEE at 100% in years 13 to 15.',
  // A later position denying goodwill has any compensable value.
  "The respondent submitted that goodwill has no compensable value and the franchisee is not entitled to any compensation.",
].join("\n");

describe("v6.0 franchise/lease detectors", () => {
  const claims = extractClaims(extractFromText(CORPUS, "AllFuels-bundle.pdf", 0));
  const contradictions = detectAll(claims);
  const types = new Set(contradictions.map((c) => c.type));

  it("flags the Lessee/Owner conditional-clause trap (cl. 3.2.3)", () => {
    assert.ok(
      types.has(ContradictionType.CONDITIONAL_CLAUSE_MISINVOKED),
      "expected CONDITIONAL_CLAUSE_MISINVOKED — termination under a lessee-only clause while the party was the owner",
    );
    const hit = contradictions.find((c) => c.type === ContradictionType.CONDITIONAL_CLAUSE_MISINVOKED);
    assert.ok(hit && hit.legalHypothesis, "carries a legal hypothesis");
    assert.equal(hit!.legalHypothesis!.isHypothesis, true);
    assert.equal(hit!.legalHypothesis!.requiresHumanReview, true);
  });

  it("flags goodwill recognised-then-denied (acknowledge then deny)", () => {
    assert.ok(
      types.has(ContradictionType.ACKNOWLEDGE_THEN_DENY),
      "expected ACKNOWLEDGE_THEN_DENY — goodwill quantified in the contract but denied later",
    );
  });

  it("does not fire on a clean corpus with no ownership/denial conflict", () => {
    const clean = extractClaims(extractFromText(
      "The franchisee operated the site under a valid lease. Rent was paid monthly and the agreement was renewed.",
      "clean.pdf", 0,
    ));
    const found = detectAll(clean).map((c) => c.type);
    assert.ok(!found.includes(ContradictionType.CONDITIONAL_CLAUSE_MISINVOKED), "no false lessee/owner trap");
    assert.ok(!found.includes(ContradictionType.ACKNOWLEDGE_THEN_DENY), "no false goodwill contradiction");
  });
});
