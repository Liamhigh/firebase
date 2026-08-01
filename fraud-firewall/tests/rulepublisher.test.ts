import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import type { FirewallConfig } from "../src/core/types.js";
import {
  parseManifest,
  verifyRulePackageSignature,
  canonicalJson,
} from "../src/core/ruleUpdate.js";
import {
  buildRulePackage,
  curatePromotedPairs,
  G3_PROMOTED_GROUP_ID,
  loadPublishedManifest,
  mistralReviewPairs,
  publishRules,
} from "../src/core/rulePublisher.js";
import { G3CandidateStore, type PromotedPair } from "../src/forensics/candidateStore.js";
import { RuleEngine } from "../src/pipeline/rules.js";
import { raiseG3Candidate } from "../src/pipeline/findingsJsonEmitter.js";
import type { LlamaLike, LlamaGenerateOptions } from "../src/ai/llamaClient.js";

const FIXED_NOW = "2026-07-06T14:32:15.000Z";
const roots: string[] = [];

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PRIVATE_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const PUBLIC_DER_B64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-pub-"));
  roots.push(root);
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
      evidence_dir: join(root, "evidence"),
      findings_dir: join(root, "findings"),
    },
  };
}

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function seedPromotedCandidate(config: FirewallConfig, id: string, a: string, b: string): void {
  const store = new G3CandidateStore(config);
  store.record(
    [
      raiseG3Candidate({
        candidateId: id,
        contradictionType: "OMISSION",
        propositionAText: a,
        propositionBText: b,
        propositionAActor: "Institution",
        propositionBActor: "Record",
        conflictDescription: "test",
        sourceDocument: "doc.txt",
        sourcePage: 1,
        sha512Anchor: "f".repeat(128),
      }),
    ],
    FIXED_NOW,
  );
  store.promote(id, "human_signoff", FIXED_NOW);
}

describe("rule publisher — curation", () => {
  it("dedupes, trims, and length-bounds promoted pairs", () => {
    const mk = (first: string, second: string): PromotedPair => ({
      rule_id: `${first}|${second}`,
      first,
      second,
      promoted_at: FIXED_NOW,
      method: "human_signoff",
    });
    const curated = curatePromotedPairs([
      mk("  paid in full  ", "no payment made"),
      mk("paid in full", "no payment made"), // duplicate after trim
      mk("ok", "too short"), // first side below min length
      mk("x".repeat(400), "second"), // too long
    ]);
    assert.equal(curated.length, 1);
    assert.equal(curated[0].first, "paid in full");
  });

  it("mistral review can only veto, and a failed review keeps everything", async () => {
    const pairs = curatePromotedPairs([
      { rule_id: "1", first: "paid in full", second: "no payment made", promoted_at: FIXED_NOW, method: "m" },
      { rule_id: "2", first: "very generic", second: "also generic", promoted_at: FIXED_NOW, method: "m" },
    ]);
    const veto: LlamaLike = {
      model: "mistral (stub)",
      enabled: () => true,
      available: async () => true,
      generate: async (_p: string, _o?: LlamaGenerateOptions) => "[0]",
    };
    const kept = await mistralReviewPairs(pairs, veto);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].rule_id, "1");

    const broken: LlamaLike = { ...veto, generate: async () => "no json" };
    assert.equal((await mistralReviewPairs(pairs, broken)).length, 2);
    // An empty verdict is treated as a failed review, never a purge.
    const purge: LlamaLike = { ...veto, generate: async () => "[]" };
    assert.equal((await mistralReviewPairs(pairs, purge)).length, 2);
  });
});

describe("rule publisher — signed manifest round-trip", () => {
  it("refuses to publish without a signing key", async () => {
    const config = isolatedConfig();
    const outcome = await publishRules(config, new G3CandidateStore(config), {
      privateKeyPem: null,
    });
    assert.equal(outcome.published, false);
    assert.match(outcome.reason, /signing key/i);
  });

  it("publishes a manifest the existing client code verifies and applies", async () => {
    const config = isolatedConfig();
    seedPromotedCandidate(config, "G3-CAND-TEST-1", "deal fell through completely", "deal proceeded as planned");

    const outcome = await publishRules(config, new G3CandidateStore(config), {
      privateKeyPem: PRIVATE_PEM,
      now: FIXED_NOW,
    });
    assert.equal(outcome.published, true);
    assert.equal(outcome.version, "1.0.0");
    assert.equal(outcome.pairCount, 1);

    // The served manifest must pass the same parse + signature verification
    // the fleet clients run (firewall client here; the Android client checks
    // the identical envelope, canonical JSON, algorithm, and key id).
    const manifest = loadPublishedManifest(config);
    assert.ok(manifest);
    const parsed = parseManifest(manifest);
    assert.equal(
      verifyRulePackageSignature(parsed.package, parsed.signature, PUBLIC_DER_B64),
      true,
    );
    // Tampering breaks the signature.
    const tampered = { ...parsed.package, version: "9.9.9" };
    assert.equal(verifyRulePackageSignature(tampered, parsed.signature, PUBLIC_DER_B64), false);

    // The transaction RuleEngine consumes the published group.
    const engine = new RuleEngine(config);
    engine.updateRules(parsed.package);
    assert.equal(engine.downloadedRulesVersion, "1.0.0");
    const group = parsed.package.rules.fraud_keywords.find((g) => g.id === G3_PROMOTED_GROUP_ID);
    assert.ok(group);
    assert.deepEqual(group.pairs, [["deal fell through completely", "deal proceeded as planned"]]);
  });

  it("is idempotent and bumps patch only when content changes", async () => {
    const config = isolatedConfig();
    const store = new G3CandidateStore(config);
    seedPromotedCandidate(config, "G3-CAND-TEST-A", "signed the agreement", "denies any agreement exists");

    const first = await publishRules(config, store, { privateKeyPem: PRIVATE_PEM, now: FIXED_NOW });
    assert.equal(first.version, "1.0.0");

    const again = await publishRules(config, store, { privateKeyPem: PRIVATE_PEM, now: FIXED_NOW });
    assert.equal(again.published, false);
    assert.match(again.reason, /no changes/);

    seedPromotedCandidate(config, "G3-CAND-TEST-B", "delivered the goods", "goods were never delivered");
    const second = await publishRules(config, store, { privateKeyPem: PRIVATE_PEM, now: FIXED_NOW });
    assert.equal(second.published, true);
    assert.equal(second.version, "1.0.1");
    assert.equal(second.pairCount, 2);
  });

  it("preserves foreign rule groups from a previously published package", () => {
    const previous = {
      version: "2.3.4",
      published_at: FIXED_NOW,
      rules: {
        contradiction_patterns: [{ id: "CP1" }],
        fraud_keywords: [
          { id: "FK1", group: "legacy", pairs: [["old a", "old b"]] },
          { id: G3_PROMOTED_GROUP_ID, group: "g3_promoted_pairs", pairs: [["stale", "pair"]] },
        ],
        behavioral_markers: [],
        serial_patterns: [],
        case_configs: [],
      },
    };
    const next = buildRulePackage(
      previous,
      [{ rule_id: "r", first: "fresh first", second: "fresh second", promoted_at: FIXED_NOW, method: "m" }],
      FIXED_NOW,
    );
    assert.ok(next);
    assert.equal(next.version, "2.3.5");
    assert.equal(next.rules.contradiction_patterns.length, 1);
    const ids = next.rules.fraud_keywords.map((g) => g.id);
    assert.deepEqual(ids, ["FK1", G3_PROMOTED_GROUP_ID]);
    const g3 = next.rules.fraud_keywords.find((g) => g.id === G3_PROMOTED_GROUP_ID);
    assert.deepEqual(g3?.pairs, [["fresh first", "fresh second"]]);
    // canonicalJson stability sanity: same input twice -> same bytes.
    assert.equal(canonicalJson(next), canonicalJson(next));
  });
});
