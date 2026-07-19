import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createSign,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RULE_MANIFEST_URL_ENV,
  RULES_ALGORITHM,
  RULES_PUBLIC_KEY_ID,
  canonicalJson,
  checkForRuleUpdate,
  compareSemver,
  loadCachedRules,
  rulesCachePath,
  verifyRulePackageSignature,
  type RuleManifest,
  type RulePackage,
} from "../src/core/ruleUpdate.js";
import { RuleEngine } from "../src/pipeline/rules.js";
import { FraudFirewall } from "../src/pipeline/firewall.js";
import { loadConfig } from "../src/core/config.js";
import type { FirewallConfig, Transaction } from "../src/core/types.js";

/* ------------------------------------------------------------------ *
 * In-test RSA-4096 key pair + signing helpers (no network, no pinned key)
 * ------------------------------------------------------------------ */

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 4096,
});
const TEST_PUBLIC_KEY_DER_B64 = publicKey
  .export({ format: "der", type: "spki" })
  .toString("base64");

function signPackage(pkg: RulePackage, key: KeyObject = privateKey): string {
  const signer = createSign("RSA-SHA512");
  signer.update(canonicalJson(pkg), "utf8");
  signer.end();
  return signer.sign(key).toString("base64");
}

function makePackage(version: string, extraRules?: Partial<RulePackage["rules"]>): RulePackage {
  return {
    version,
    published_at: "2026-07-19T00:00:00.000Z",
    rules: {
      contradiction_patterns: [],
      fraud_keywords: [],
      behavioral_markers: [],
      serial_patterns: [],
      case_configs: [],
      ...extraRules,
    },
    source: "in-test fixture",
  };
}

function makeManifest(pkg: RulePackage): RuleManifest {
  return {
    package: pkg,
    signature: signPackage(pkg),
    algorithm: RULES_ALGORITHM,
    publicKeyId: RULES_PUBLIC_KEY_ID,
  };
}

const fetcherReturning = (manifest: unknown) => async () => manifest;
const fetcherThrowing = (message: string) => async () => {
  throw new Error(message);
};

function tempCachePath(): { dir: string; cachePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "vo-rules-"));
  return { dir, cachePath: rulesCachePath(dir) };
}

function updateOptions(cachePath: string, fetcher: (url: string, timeoutMs: number) => Promise<unknown>) {
  return { cachePath, fetcher, publicKeyDerB64: TEST_PUBLIC_KEY_DER_B64 };
}

describe("signed rule-update client", () => {
  it("accepts a validly signed manifest and caches it", async () => {
    const { dir, cachePath } = tempCachePath();
    const pkg = makePackage("1.0.0");
    const outcome = await checkForRuleUpdate(
      updateOptions(cachePath, fetcherReturning(makeManifest(pkg))),
    );

    assert.equal(outcome.kind, "updated");
    if (outcome.kind !== "updated") return;
    assert.equal(outcome.version, "1.0.0");
    assert.equal(outcome.previousVersion, null);
    assert.ok(existsSync(cachePath), "cache file written");

    const cached = loadCachedRules(cachePath, TEST_PUBLIC_KEY_DER_B64);
    assert.equal(cached?.version, "1.0.0");
    assert.deepEqual(cached?.package, pkg);
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a tampered package (signature over different bytes)", async () => {
    const { dir, cachePath } = tempCachePath();
    const pkg = makePackage("1.0.0");
    const manifest = makeManifest(pkg);
    // Tamper after signing: attacker swaps in a different package body.
    manifest.package = makePackage("9.9.9");

    const outcome = await checkForRuleUpdate(
      updateOptions(cachePath, fetcherReturning(manifest)),
    );
    assert.equal(outcome.kind, "none");
    if (outcome.kind !== "none") return;
    assert.match(outcome.reason, /signature verification failed/);
    assert.equal(existsSync(cachePath), false, "nothing unverified is cached");
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a package signed by a different key", async () => {
    const { dir, cachePath } = tempCachePath();
    const other = generateKeyPairSync("rsa", { modulusLength: 4096 });
    const pkg = makePackage("1.0.0");
    const manifest: RuleManifest = {
      package: pkg,
      signature: signPackage(pkg, other.privateKey),
      algorithm: RULES_ALGORITHM,
      publicKeyId: RULES_PUBLIC_KEY_ID,
    };
    const outcome = await checkForRuleUpdate(
      updateOptions(cachePath, fetcherReturning(manifest)),
    );
    assert.equal(outcome.kind, "none");
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts only strictly newer versions: older rejected, equal is current", async () => {
    const { dir, cachePath } = tempCachePath();
    const v2 = makePackage("2.0.0");
    let outcome = await checkForRuleUpdate(
      updateOptions(cachePath, fetcherReturning(makeManifest(v2))),
    );
    assert.equal(outcome.kind, "updated");

    // Older validly-signed package must NOT replace the cache.
    const v1 = makePackage("1.0.0");
    outcome = await checkForRuleUpdate(
      updateOptions(cachePath, fetcherReturning(makeManifest(v1))),
    );
    assert.equal(outcome.kind, "cached");
    if (outcome.kind !== "cached") return;
    assert.equal(outcome.version, "2.0.0");
    assert.match(outcome.reason, /stale package 1\.0\.0/);
    assert.equal(
      loadCachedRules(cachePath, TEST_PUBLIC_KEY_DER_B64)?.version,
      "2.0.0",
      "cache still holds the newer package",
    );

    // Equal version verifies but changes nothing.
    outcome = await checkForRuleUpdate(
      updateOptions(cachePath, fetcherReturning(makeManifest(makePackage("2.0.0")))),
    );
    assert.equal(outcome.kind, "current");
    if (outcome.kind !== "current") return;
    assert.equal(outcome.version, "2.0.0");
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps the verified cache when offline; reports none with no cache", async () => {
    const { dir, cachePath } = tempCachePath();
    const pkg = makePackage("1.2.3");
    await checkForRuleUpdate(
      updateOptions(cachePath, fetcherReturning(makeManifest(pkg))),
    );

    const offline = await checkForRuleUpdate(
      updateOptions(cachePath, fetcherThrowing("ENOTFOUND simulated-offline")),
    );
    assert.equal(offline.kind, "cached");
    if (offline.kind !== "cached") return;
    assert.equal(offline.version, "1.2.3");
    assert.deepEqual(offline.package, pkg);

    const empty = tempCachePath();
    const none = await checkForRuleUpdate(
      updateOptions(empty.cachePath, fetcherThrowing("ENOTFOUND simulated-offline")),
    );
    assert.equal(none.kind, "none");
    if (none.kind !== "none") return;
    assert.match(none.reason, /simulated-offline/);
    rmSync(dir, { recursive: true, force: true });
    rmSync(empty.dir, { recursive: true, force: true });
  });

  it("never applies a tampered on-disk cache", async () => {
    const { dir, cachePath } = tempCachePath();
    await checkForRuleUpdate(
      updateOptions(cachePath, fetcherReturning(makeManifest(makePackage("1.0.0")))),
    );
    // Attacker edits the cached package bytes without the private key.
    const raw = JSON.parse(readFileSync(cachePath, "utf8"));
    raw.package.version = "4.5.6";
    raw.version = "4.5.6";
    writeFileSync(cachePath, JSON.stringify(raw, null, 2));
    assert.equal(loadCachedRules(cachePath, TEST_PUBLIC_KEY_DER_B64), null);
    rmSync(dir, { recursive: true, force: true });
  });

  it("honors the VO_RULE_MANIFEST_URL env override", async () => {
    const { dir, cachePath } = tempCachePath();
    const seen: string[] = [];
    process.env[RULE_MANIFEST_URL_ENV] = "https://example.test/rules.json";
    try {
      await checkForRuleUpdate({
        ...updateOptions(cachePath, async (url) => {
          seen.push(url);
          return makeManifest(makePackage("1.0.0"));
        }),
      });
    } finally {
      delete process.env[RULE_MANIFEST_URL_ENV];
    }
    assert.deepEqual(seen, ["https://example.test/rules.json"]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("canonical JSON (worker/rule-format.md)", () => {
  it("sorts keys recursively, preserves array order, compacts", () => {
    assert.equal(
      canonicalJson({ b: 1, a: [{ d: 2, c: 3 }], z: [3, 1, 2] }),
      '{"a":[{"c":3,"d":2}],"b":1,"z":[3,1,2]}',
    );
    assert.equal(canonicalJson({ n: 5, s: "x", nil: null }), '{"n":5,"nil":null,"s":"x"}');
  });

  it("emits non-ASCII as raw UTF-8 (no \\u escapes)", () => {
    const canonical = canonicalJson({ note: "café — 証人 🕵️" });
    assert.equal(canonical, '{"note":"café — 証人 🕵️"}');
    assert.ok(!canonical.includes("\\u"), "no escaped unicode");
  });

  it("object key insertion order does not change the signed bytes", () => {
    const pkg = makePackage("1.0.0", {
      fraud_keywords: [
        {
          id: "FK01",
          group: "negation_pairs",
          source_detector: "D01",
          produces: "CT01",
          description: "unicode: café 証人",
          pairs: [["paid", "not paid"]],
        },
      ],
    });
    const signature = signPackage(pkg);
    // Same logical package, every object's keys re-inserted in reverse order.
    const shuffled = JSON.parse(
      JSON.stringify(pkg, (key, value: unknown) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const reversed: Record<string, unknown> = {};
          for (const k of Object.keys(value).reverse()) {
            reversed[k] = (value as Record<string, unknown>)[k];
          }
          return reversed;
        }
        return value;
      }),
    );
    assert.notEqual(JSON.stringify(shuffled), JSON.stringify(pkg));
    assert.equal(canonicalJson(shuffled), canonicalJson(pkg));
    assert.equal(
      verifyRulePackageSignature(shuffled, signature, TEST_PUBLIC_KEY_DER_B64),
      true,
    );
  });

  it("semver compare orders numerically per component", () => {
    assert.ok(compareSemver("2.0.0", "10.0.0") < 0);
    assert.ok(compareSemver("10.0.0", "2.0.0") > 0);
    assert.equal(compareSemver("1.2.3", "1.2.3"), 0);
    assert.ok(compareSemver("1.2.10", "1.2.9") > 0);
  });
});

/* ------------------------------------------------------------------ *
 * RuleEngine: downloaded keyword / behavioral-marker scanning
 * ------------------------------------------------------------------ */

function engineConfig(): FirewallConfig {
  return loadConfig(join(process.cwd(), "config/firewall.json"));
}

function txn(partial: Partial<Transaction> & { txn_id: string }): Transaction {
  return {
    account_id: "AC-1",
    amount: 100,
    currency: "ZAR",
    timestamp: "2026-07-06T14:30:00Z",
    ...partial,
  };
}

const LIVE_SHAPED_PACKAGE = makePackage("1.0.0", {
  fraud_keywords: [
    {
      id: "FK01",
      group: "negation_pairs",
      source_detector: "D01",
      produces: "CT01",
      description: "Positive/negative statement pairs",
      pairs: [["paid", "not paid"]],
    },
    {
      id: "FK06",
      group: "suspicious_metadata_tools",
      source_detector: "D16",
      description: "Image editors in metadata",
      terms: ["photoshop", "gimp"],
    },
    {
      id: "FK04",
      group: "role_claim_requirements",
      items: [{ role: "managing director", check: "board resolution" }],
    },
  ],
  behavioral_markers: [
    {
      id: "BM01",
      name: "Urgency pressure",
      source: "SP01 stage 4",
      keywords: ["urgent", "act now"],
    },
    {
      id: "BM06",
      name: "Authority exceeded language",
      patterns: ["approved\\s+by\\s+.*?(?:clerk|assistant|junior|trainee)"],
    },
  ],
});

describe("RuleEngine downloaded rules", () => {
  it("produces zero extra signals when no rules are downloaded", () => {
    const txns = [
      txn({ txn_id: "T1", metadata: { note: "urgent: paid then not paid" } }),
    ];
    const plain = new RuleEngine(engineConfig());
    const cleared = new RuleEngine(engineConfig());
    cleared.updateRules(null);
    const withRules = new RuleEngine(engineConfig());
    withRules.updateRules(LIVE_SHAPED_PACKAGE);

    const baseline = plain.evaluate(txns);
    assert.deepEqual(cleared.evaluate(txns), baseline);
    const loaded = withRules.evaluate(txns);
    assert.ok(loaded.signals.length > baseline.signals.length);
    assert.ok(
      baseline.signals.every((s) => !s.source.includes("downloaded")),
      "no downloaded-rule signals without a package",
    );
  });

  it("matches keywords, negation pairs, and behavioral markers in txn text", () => {
    const engine = new RuleEngine(engineConfig());
    engine.updateRules(LIVE_SHAPED_PACKAGE);
    const txns = [
      txn({
        txn_id: "T1",
        counterparty: "vendor",
        metadata: { note: "He said paid, bank says not paid — urgent" },
      }),
      txn({ txn_id: "T2", metadata: { tool: "Processed with Photoshop" } }),
      txn({ txn_id: "T3", metadata: { memo: "approved by the junior clerk" } }),
      txn({ txn_id: "T4", metadata: { memo: "ordinary text" } }),
    ];
    const { signals } = engine.evaluate(txns);
    const downloaded = signals.filter((s) => s.source.includes("downloaded"));

    const fk01 = downloaded.find((s) => s.source === "RuleEngine.downloaded.FK01");
    assert.ok(fk01, "FK01 signal emitted");
    assert.ok(fk01!.related_txn_ids.includes("T1"));
    assert.ok(
      fk01!.reasons.some((r) => r.includes("co-occurrence") && r.includes("CT01")),
      "negation pair co-occurrence reported with produced contradiction type",
    );

    const fk06 = downloaded.find((s) => s.source === "RuleEngine.downloaded.FK06");
    assert.ok(fk06 && fk06.related_txn_ids.includes("T2"), "FK06 matches 'photoshop' case-insensitively");

    const bm01 = downloaded.find((s) => s.source === "RuleEngine.downloaded.BM01");
    assert.ok(bm01 && bm01.related_txn_ids.includes("T1"), "BM01 urgency marker matched");

    const bm06 = downloaded.find((s) => s.source === "RuleEngine.downloaded.BM06");
    assert.ok(bm06 && bm06.related_txn_ids.includes("T3"), "BM06 regex pattern matched");

    assert.ok(
      downloaded.every((s) => !s.related_txn_ids.includes("T4")),
      "clean transaction matches nothing",
    );
  });

  it("flattens object items (role claims) into matchable phrases", () => {
    const engine = new RuleEngine(engineConfig());
    engine.updateRules(LIVE_SHAPED_PACKAGE);
    const { signals } = engine.evaluate([
      txn({ txn_id: "T9", metadata: { claim: "signed by the managing director" } }),
    ]);
    assert.ok(
      signals.some((s) => s.source === "RuleEngine.downloaded.FK04"),
      "role claim phrase from items matched",
    );
  });
});

/* ------------------------------------------------------------------ *
 * FraudFirewall wiring: background refresh + offline cache
 * ------------------------------------------------------------------ */

function isolatedFirewallConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-rules-"));
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
    },
  };
}

describe("FraudFirewall rule-update wiring", () => {
  it("runs bank rules only when auto-update is disabled", () => {
    const config = isolatedFirewallConfig();
    const fw = new FraudFirewall(config, { autoUpdateRules: false });
    assert.equal(fw.getRulesVersion(), null);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("applies injected verified rules from the background refresh", async () => {
    const config = isolatedFirewallConfig();
    const fw = new FraudFirewall(config, {
      ruleFetcher: fetcherReturning(makeManifest(makePackage("3.1.4"))),
      rulePublicKeyDerB64: TEST_PUBLIC_KEY_DER_B64,
    });
    let version: string | null = null;
    for (let i = 0; i < 100; i++) {
      version = fw.getRulesVersion();
      if (version) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(version, "3.1.4");
    // Restart: the verified cache is picked up with no fetcher at all.
    const fw2 = new FraudFirewall(config, {
      autoUpdateRules: false,
      rulePublicKeyDerB64: TEST_PUBLIC_KEY_DER_B64,
    });
    assert.equal(fw2.getRulesVersion(), "3.1.4");
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("never throws when the fetcher fails, and keeps running without rules", async () => {
    const config = isolatedFirewallConfig();
    const fw = new FraudFirewall(config, {
      ruleFetcher: fetcherThrowing("simulated network failure"),
      log: () => undefined,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(fw.getRulesVersion(), null);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});
