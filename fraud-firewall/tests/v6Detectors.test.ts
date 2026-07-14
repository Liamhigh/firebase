// Verum Omnis — v6 detector + statute-chain tests (TypeScript)
// Status: RATIFIED — BINDING (founder directive, 2026-07-14)
// Mirrors py/test_v6.py.  Validates the forensic chain:
//   extraction -> contradiction -> PERSON -> PAGE -> LOCAL LAW (statute)

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  runV6Detectors,
  detectSwornVsSworn,
  detectDeviceAttributionChain,
  detectCriminalChargeAsLeverage,
  containsTerm,
  mergeV6IntoFindings,
  resetCounter,
  type TextChunk,
  type ActorLexiconEntry,
} from "../src/engine/v6Detectors.js";
import {
  statutesForType,
  normaliseJurisdiction,
  enrichLegalHypotheses,
} from "../src/engine/statuteMap.js";

const sha = (s: string) => "sha512:" + s;

const ACTORS: ActorLexiconEntry[] = [
  { name: "Liam Highstead", aliases: ["Liam", "Highstead"], role: "complainant" },
  { name: "Green Sky", aliases: ["GreenSky", "green sky"], role: "institution" },
];

const SWORN_A: TextChunk = {
  text: "In my sworn affidavit, I Liam Highstead solemnly declare that the rental payment deposit funds were never paid into the account.",
  source: "case126.pdf", page: 3, sha512: sha("a"),
};
const SWORN_B: TextChunk = {
  text: "In the sworn affidavit the deponent Green Sky solemnly declares that the rental payment deposit funds were paid into the account.",
  source: "case126.pdf", page: 12, sha512: sha("b"),
};

describe("word-boundary precision", () => {
  it("lease does not fire inside please", () => {
    assert.equal(containsTerm("Please find attached.", "lease"), false);
  });
  it("lease fires as whole word", () => {
    assert.equal(containsTerm("The lease was signed.", "lease"), true);
  });
});

describe("v6 detectors fire on anchored text", () => {
  beforeEach(() => resetCounter());

  it("SWORN_VS_SWORN: two opposing sworn statements", () => {
    const recs = detectSwornVsSworn([SWORN_A, SWORN_B], ACTORS);
    assert.ok(recs.length > 0, "did not fire");
    assert.equal(recs[0].type, "SWORN_VS_SWORN");
    assert.notEqual(recs[0].proposition_a_actor, recs[0].proposition_b_actor);
  });

  it("DEVICE_ATTRIBUTION_CHAIN: multi-word entity + curly-quote device", () => {
    const decl: TextChunk = {
      text: "\u201cI have a PTY called South Coast Aquaculture\u2026\u201d",
      source: "case126.pdf", page: 5, sha512: sha("decl"),
    };
    const act: TextChunk = {
      text: "The attempted Gmail intrusion originated from a device labeled \u201cSCAQUACULTURE\u201d on the network.",
      source: "case126.pdf", page: 5, sha512: sha("act"),
    };
    const recs = detectDeviceAttributionChain([decl, act], ACTORS);
    assert.ok(recs.length > 0, "multi-word entity not linked to device");
    assert.ok(recs[0].proposition_b_actor.includes("SCAQUACULTURE"));
  });

  it("CRIMINAL_CHARGE_AS_LEVERAGE: charge + silencing language", () => {
    const charge: TextChunk = {
      text: "Green Sky opened a criminal case against Liam Highstead, case number CAS 142/07/2025, on 12 Jul 2025. " +
        "This was done to pressure Liam Highstead to withdraw the application and back down.",
      source: "case126.pdf", page: 20, sha512: sha("charge"),
    };
    const recs = detectCriminalChargeAsLeverage([charge], ACTORS);
    assert.ok(recs.length > 0, "did not fire");
    assert.equal(recs[0].type, "CRIMINAL_CHARGE_AS_LEVERAGE");
  });

  it("agreement is not flagged as contradiction", () => {
    const a: TextChunk = { text: "In my sworn affidavit I Liam Highstead declare the funds were paid on time.", source: "d.pdf", page: 1, sha512: sha("x") };
    const b: TextChunk = { text: "In my sworn affidavit Green Sky confirms the funds were paid on time.", source: "d.pdf", page: 2, sha512: sha("y") };
    assert.deepEqual(detectSwornVsSworn([a, b], ACTORS), []);
  });
});

describe("forensic chain closes person + page + local law", () => {
  beforeEach(() => resetCounter());

  it("every ZA finding carries person, page and local statutes", () => {
    const recs = runV6Detectors([SWORN_A, SWORN_B], ACTORS, "ZA");
    assert.ok(recs.length > 0);
    for (const r of recs) {
      assert.ok(r.proposition_a_actor || r.proposition_b_actor, "no person");
      assert.ok(typeof r.source_page === "number" && r.source_page >= 1, "no page");
      const lh = (r.legal_hypothesis as any) ?? {};
      assert.equal(lh.jurisdiction, "ZA");
      assert.ok(Array.isArray(lh.local_statutes) && lh.local_statutes.length > 0, "no statutes");
      assert.equal(lh.is_hypothesis, true);
      assert.equal(lh.requires_human_review, true);
    }
  });

  it("SWORN_VS_SWORN maps to the perjury statute", () => {
    const recs = runV6Detectors([SWORN_A, SWORN_B], ACTORS, "ZA").filter(
      (r) => r.type === "SWORN_VS_SWORN",
    );
    assert.ok(recs.length > 0);
    const instruments = ((recs[0].legal_hypothesis as any).local_statutes as any[]).map(
      (s) => s.instrument,
    );
    assert.ok(instruments.some((i: string) => i.contains("Justices of the Peace")));
  });
});

describe("statute map", () => {
  it("resolves the three v6 types under ZA", () => {
    for (const t of ["SWORN_VS_SWORN", "DEVICE_ATTRIBUTION_CHAIN", "CRIMINAL_CHARGE_AS_LEVERAGE"]) {
      assert.ok(statutesForType(t, "ZA").length > 0, `no ZA statutes for ${t}`);
    }
  });
  it("device chain cites the Cybercrimes Act", () => {
    assert.ok(statutesForType("DEVICE_ATTRIBUTION_CHAIN", "ZA").some((c) => c.instrument.contains("Cybercrimes")));
  });
  it("leverage cites cyber extortion (s 10)", () => {
    assert.ok(statutesForType("CRIMINAL_CHARGE_AS_LEVERAGE", "ZA").some((c) => c.citation === "s 10"));
  });
  it("generic fallback + jurisdiction aliases", () => {
    assert.equal(normaliseJurisdiction("south africa"), "ZA");
    assert.equal(normaliseJurisdiction("nowhere"), "GENERIC");
    assert.equal(normaliseJurisdiction(null), "ZA");
    assert.deepEqual(statutesForType("NON_EXISTENT", "ZA"), []);
  });
  it("enriches a whole findings document", () => {
    const findings = {
      contradictions: [
        { type: "SWORN_VS_SWORN", conflict_description: "x", legal_hypothesis: { is_hypothesis: true } },
        { type: "DEVICE_ATTRIBUTION_CHAIN", conflict_description: "y", legal_hypothesis: null },
      ],
    };
    const out = enrichLegalHypotheses(findings, "ZA");
    assert.equal((out.statute_enrichment as any).records_enriched, 2);
    for (const rec of out.contradictions) {
      assert.equal((rec as any).jurisdiction, "ZA");
      assert.ok(((rec as any).legal_hypothesis.local_statutes as any[]).length > 0);
    }
  });
});

describe("merge", () => {
  beforeEach(() => resetCounter());
  it("mergeV6IntoFindings recounts tiers", () => {
    const recs = runV6Detectors([SWORN_A, SWORN_B], ACTORS, "ZA");
    const findings: Record<string, any> = { contradictions: [] };
    mergeV6IntoFindings(findings, recs);
    assert.equal(findings.contradictions.length, recs.length);
    assert.equal(findings.engine_verified_count, recs.length);
    assert.equal(findings.g3_candidate_count, 0);
  });
});
