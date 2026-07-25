/**
 * Verum Omnis rules hub — publisher side of the signed rule-update channel.
 *
 * The website is where everyone verifies documents. Every contradiction the
 * hybrid pipeline catches there and a human promotes becomes part of the
 * shared engine: this module curates the promoted proposition pairs
 * (deterministically, with an optional Mistral review pass), folds them into
 * a rule package in the exact rule-format v1 shape both clients already
 * parse, signs the canonical JSON with the vo-master key, and writes the
 * manifest that `GET /api/v1/rules/manifest` serves.
 *
 * The Android app (RuleUpdateClient) and the firewall (core/ruleUpdate.ts)
 * pin the same publicKeyId ("vo-master-1") and algorithm
 * (RSASSA-PKCS1-v1_5-SHA512), so one published manifest updates every
 * deterministic engine in the fleet — the crowd-sourced improvement loop.
 *
 * Signing keys are NEVER generated here implicitly. The private key comes
 * from VO_RULE_SIGNING_KEY_PEM (inline PEM) or VO_RULE_SIGNING_KEY_FILE
 * (path); without one, publishing is refused — clients would reject an
 * unsigned or wrongly-signed manifest anyway.
 */

import { createSign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FirewallConfig } from "./types.js";
import {
  canonicalJson,
  compareSemver,
  isSemver,
  RULES_ALGORITHM,
  RULES_PUBLIC_KEY_ID,
  type RuleManifest,
  type RulePackage,
  type RuleSet,
} from "./ruleUpdate.js";
import { readJson, writeJson } from "../storage/vault.js";
import type { G3CandidateStore, PromotedPair } from "../forensics/candidateStore.js";
import type { LlamaLike } from "../ai/llamaClient.js";

/** fraud_keywords group id under which promoted G3 pairs are published. */
export const G3_PROMOTED_GROUP_ID = "G3PROM";

const MIN_PHRASE_CHARS = 4;
const MAX_PHRASE_CHARS = 300;
const MAX_PUBLISHED_PAIRS = 500;

export interface PublishOutcome {
  published: boolean;
  reason: string;
  version?: string;
  pairCount?: number;
  manifestPath?: string;
}

/** Path where the published manifest lives (served by the API). */
export function publishedManifestPath(config: FirewallConfig): string {
  return join(config.storage.vault_dir, "rules", "manifest.json");
}

export function loadPublishedManifest(config: FirewallConfig): RuleManifest | null {
  return readJson<RuleManifest>(publishedManifestPath(config));
}

/** Load the signing key from the environment; null when not provisioned. */
export function loadSigningKeyPem(): string | null {
  const inline = process.env.VO_RULE_SIGNING_KEY_PEM;
  if (inline && inline.includes("PRIVATE KEY")) return inline;
  const file = process.env.VO_RULE_SIGNING_KEY_FILE;
  if (file && existsSync(file)) {
    const pem = readFileSync(file, "utf8");
    if (pem.includes("PRIVATE KEY")) return pem;
  }
  return null;
}

/**
 * Deterministic curation of promoted pairs before publication: trim,
 * length-bound, and dedupe on the normalized pair. Order is preserved
 * (oldest promotion first) and the total is capped.
 */
export function curatePromotedPairs(pairs: PromotedPair[]): PromotedPair[] {
  const seen = new Set<string>();
  const out: PromotedPair[] = [];
  for (const pair of pairs) {
    const first = pair.first.trim();
    const second = pair.second.trim();
    if (first.length < MIN_PHRASE_CHARS || second.length < MIN_PHRASE_CHARS) continue;
    if (first.length > MAX_PHRASE_CHARS || second.length > MAX_PHRASE_CHARS) continue;
    const key = `${first.toLowerCase()}|${second.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...pair, first, second });
    if (out.length >= MAX_PUBLISHED_PAIRS) break;
  }
  return out;
}

/**
 * Optional Mistral review pass over the curated pairs. The model may only
 * VETO pairs (drop false-positive-prone ones) — it can never add or edit a
 * pair, so the published package remains a subset of human-promoted content.
 * Any failure (no runtime, malformed output) keeps the deterministic result.
 */
export async function mistralReviewPairs(
  pairs: PromotedPair[],
  llama: LlamaLike | null,
): Promise<PromotedPair[]> {
  if (!pairs.length || !llama?.enabled() || !(await llama.available())) return pairs;
  const prompt = [
    "You are Mistral, the rule curator for the Verum Omnis shared forensic engine.",
    "Each numbered pair below is an opposing-phrase contradiction rule promoted by a human.",
    "Veto ONLY pairs whose phrases are so generic they would flag innocent text",
    "(e.g. single common words, generic pleasantries). When unsure, KEEP the pair.",
    "",
    ...pairs.map((p, i) => `${i}. "${p.first}" / "${p.second}"`),
    "",
    'OUTPUT: a single JSON array of the indices to KEEP, e.g. [0,2,3]. No prose.',
  ].join("\n");
  const response = await llama.generate(prompt, { maxTokens: 512 });
  if (!response) return pairs;
  const start = response.indexOf("[");
  const end = response.indexOf("]", start);
  if (start < 0 || end < 0) return pairs;
  try {
    const parsed = JSON.parse(response.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) return pairs;
    const keep = new Set(parsed.filter((n) => typeof n === "number" && Number.isInteger(n)));
    if (keep.size === 0) return pairs; // an empty verdict is a failed review, not a purge
    return pairs.filter((_, i) => keep.has(i));
  } catch {
    return pairs;
  }
}

function emptyRuleSet(): RuleSet {
  return {
    contradiction_patterns: [],
    fraud_keywords: [],
    behavioral_markers: [],
    serial_patterns: [],
    case_configs: [],
  };
}

function bumpPatch(version: string): string {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Fold curated pairs into a new rule package on top of the previously
 * published one. Existing groups are preserved; only the G3-promoted group
 * is replaced. Returns null when the result would be identical to the
 * previous package (nothing new to publish).
 */
export function buildRulePackage(
  previous: RulePackage | null,
  pairs: PromotedPair[],
  now: string,
): RulePackage | null {
  const rules: RuleSet = previous
    ? {
        ...emptyRuleSet(),
        ...previous.rules,
        fraud_keywords: previous.rules.fraud_keywords.filter(
          (g) => g.id !== G3_PROMOTED_GROUP_ID,
        ),
      }
    : emptyRuleSet();

  const pairPayload = pairs.map((p) => [p.first, p.second]);
  if (pairPayload.length) {
    rules.fraud_keywords = [
      ...rules.fraud_keywords,
      {
        id: G3_PROMOTED_GROUP_ID,
        group: "g3_promoted_pairs",
        source_detector: "G3 vault review + human sign-off (website hub)",
        produces: "contradiction candidates via opposing-phrase co-occurrence",
        description:
          "Opposing proposition pairs from promoted G3 candidates, curated before publication.",
        pairs: pairPayload,
      },
    ];
  }

  const previousVersion = previous && isSemver(previous.version) ? previous.version : null;
  const candidate: RulePackage = {
    version: previousVersion ? bumpPatch(previousVersion) : "1.0.0",
    published_at: now,
    rules,
    source: "verum-website-hub",
  };

  if (previous) {
    const prevComparable = { ...previous, version: candidate.version, published_at: now };
    if (canonicalJson(prevComparable) === canonicalJson(candidate)) return null;
  }
  return candidate;
}

/** Sign the canonical JSON of the package with the vo-master private key. */
export function signRulePackage(pkg: RulePackage, privateKeyPem: string): RuleManifest {
  const signer = createSign("RSA-SHA512");
  signer.update(canonicalJson(pkg), "utf8");
  signer.end();
  const signature = signer.sign(privateKeyPem).toString("base64");
  return {
    package: pkg,
    signature,
    algorithm: RULES_ALGORITHM,
    publicKeyId: RULES_PUBLIC_KEY_ID,
  };
}

export interface PublishOptions {
  /** Signing key override (tests). Defaults to the environment-provisioned key. */
  privateKeyPem?: string | null;
  /** Optional Mistral runtime for the curation review pass. */
  llama?: LlamaLike | null;
  now?: string;
}

/**
 * Publish the current promoted rules as a signed manifest. Safe to call
 * often: refuses without a signing key, no-ops when nothing changed, and
 * never regresses the semver (clients apply accept-if-newer).
 */
export async function publishRules(
  config: FirewallConfig,
  candidates: G3CandidateStore,
  options: PublishOptions = {},
): Promise<PublishOutcome> {
  const key = options.privateKeyPem !== undefined ? options.privateKeyPem : loadSigningKeyPem();
  if (!key) {
    return {
      published: false,
      reason:
        "No signing key provisioned (set VO_RULE_SIGNING_KEY_PEM or VO_RULE_SIGNING_KEY_FILE). " +
        "Clients pin vo-master-1 and reject unsigned manifests.",
    };
  }

  const now = options.now ?? new Date().toISOString();
  const curated = await mistralReviewPairs(
    curatePromotedPairs(candidates.promotedPairs()),
    options.llama ?? null,
  );

  const previous = loadPublishedManifest(config)?.package ?? null;
  if (previous && !isSemver(previous.version)) {
    return { published: false, reason: `published package has invalid version "${previous.version}"` };
  }
  if (previous && compareSemver(previous.version, "0.0.0") < 0) {
    return { published: false, reason: "published package version below floor" };
  }

  const pkg = buildRulePackage(previous, curated, now);
  if (!pkg) {
    return {
      published: false,
      reason: "no changes since last published package",
      version: previous?.version,
      pairCount: curated.length,
    };
  }

  const manifest = signRulePackage(pkg, key);
  const path = publishedManifestPath(config);
  mkdirSync(dirname(path), { recursive: true });
  writeJson(path, manifest);
  return {
    published: true,
    reason: "signed manifest published",
    version: pkg.version,
    pairCount: curated.length,
    manifestPath: path,
  };
}
