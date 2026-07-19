/**
 * Signed rule-update client (worker/rule-format.md v1).
 * =====================================================
 *
 * Downloads the signed forensic rule package published by the verum-rules
 * worker (https://verumglobal.foundation/api/v1/rules/manifest), verifies the
 * RSA-4096 RSASSA-PKCS1-v1_5-SHA512 signature over the canonical JSON of the
 * package, and caches only verified packages to disk for offline starts.
 *
 * Hard guarantees:
 * - A package is applied ONLY after its signature verifies against the pinned
 *   public key (vo-master-1, SPKI/DER base64 — public by design).
 * - A package is accepted ONLY when its semver is strictly newer than the
 *   cached version; stale or equal packages never overwrite the cache.
 * - Network/signature/parse failures never throw and never clear the cache:
 *   the last verified package keeps running (offline-safe).
 * - The on-disk cache is re-verified on every load; a tampered cache file is
 *   treated as absent.
 *
 * Canonical JSON (the signed bytes), per worker/rule-format.md:
 *   1. UTF-8 encoding.
 *   2. Compact separators (`,` and `:`), no insignificant whitespace.
 *   3. Object keys sorted recursively; array order preserved.
 *   4. Strings emitted exactly as JSON.stringify produces (raw UTF-8, only
 *      the escapes JSON requires).
 *   5. Integers without decimal point/exponent (v1 packages contain only
 *      integers and strings).
 */
import { createPublicKey, createVerify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const DEFAULT_RULE_MANIFEST_URL =
  "https://verumglobal.foundation/api/v1/rules/manifest";
/** Environment override for the manifest URL (testing / staging workers). */
export const RULE_MANIFEST_URL_ENV = "VO_RULE_MANIFEST_URL";
export const RULES_ALGORITHM = "RSASSA-PKCS1-v1_5-SHA512";
export const RULES_PUBLIC_KEY_ID = "vo-master-1";
export const DEFAULT_RULE_UPDATE_TIMEOUT_MS = 10_000;

/**
 * Pinned Verum Omnis master rule-signing public key (RSA-4096,
 * SubjectPublicKeyInfo DER, base64). This key is PUBLIC — it is published in
 * webdocsol worker/public-key.der.b64 and pinned in every client build.
 * Key rotation ships a new pinned key in a client release (rule-format.md).
 */
export const VO_RULES_PUBLIC_KEY_DER_B64 =
  "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA9FQPTWCsFh1qMs/mrOOg" +
  "ZvdjCh8APmlsJlallCm3CmWgMoFAyRHRAauvXWFoBoiaUQGGx7OGtZ6eBCpBlOGL" +
  "xSnVk0T2hBgd6kxZwj1vHEITw9KmXMjy5qmUY1hd3BO3y4aAfrPKu+6ENSJo7Ax7" +
  "7fvBnHPG1oL8m3724oqU913HYI7Miob+CdL0Oi36oCBKhlw5sCYH+evMPU1PmOqT" +
  "rmz8zUkDk4osqX8INTIchmk2j3BguMw8sjmKRnrB//t6LPYme4motggMPVMNR3hL" +
  "JHX+ehCYDUtJLshZq1MPLjTT7aK36gCIPg2ja6BxWfYdx7ZzSFVcL+gapy4pA7Vn" +
  "DrhQ7jb10ojGnofssEbQEi7k9FpswMFegmGNmKEH5TQcKlI4VJvQcZddbhZXYwpf" +
  "gsL/raEFMChEuzR3A49oIXgBBmi9AdQtdEHpfb2i9/PimxsilhDxa8Pi+8cEQUMb" +
  "HcPeodfX/IWf+wotnc3VKGoffVL/8+hSU/voPhxfXyOcnbRYkFGeOZhcrE/u4Nh6" +
  "Vkq6y1+cpVUtrIzOnaeNbNF248ZS7f65IZci8MTeo4nAqkWGmXcZHrZLT7YIvHSy" +
  "AryYzBNoofm2uTuiTxp8Oiwa2yfU2UMQfg0eGZa0LBHCLbG72pxiVd2TGvdHh3Qg" +
  "uO1/zM5NNRtoUnqHfuLBOJECAwEAAQ==";

/* ------------------------------------------------------------------ *
 * Rule package model (rule-format.md "Rule package schema")
 * ------------------------------------------------------------------ */

export interface FraudKeywordGroup {
  id: string;
  group: string;
  source_detector?: string;
  produces?: string;
  description?: string;
  /** Payload shape depends on the group: string[][], string[], or objects. */
  pairs?: unknown;
  terms?: unknown;
  items?: unknown;
  groups?: unknown;
}

export interface BehavioralMarker {
  id: string;
  name: string;
  source?: string;
  keywords?: unknown;
  items?: unknown;
  /** Regex source strings (e.g. authority-exceeded language). */
  patterns?: unknown;
}

export interface SerialPatternStage {
  indicator?: string;
  keywords?: unknown;
}

export interface SerialPattern {
  id: string;
  key?: string;
  name?: string;
  severity?: number;
  category?: string;
  stages?: SerialPatternStage[];
  match_rule?: string;
}

export interface ContradictionPattern {
  id: string;
  key?: string;
  name?: string;
  desc?: string;
  severity?: number;
  category?: string;
  example?: string;
  detectors?: string[];
}

export interface RuleSet {
  contradiction_patterns: ContradictionPattern[];
  fraud_keywords: FraudKeywordGroup[];
  behavioral_markers: BehavioralMarker[];
  serial_patterns: SerialPattern[];
  case_configs: unknown[];
}

export interface RulePackage {
  version: string;
  published_at: string;
  rules: RuleSet;
  source?: string;
}

export interface RuleManifest {
  package: RulePackage;
  signature: string;
  algorithm: string;
  publicKeyId: string;
}

/** A signature-verified package persisted for offline starts. */
export interface CachedRules {
  version: string;
  published_at: string;
  fetched_at: string;
  algorithm: string;
  publicKeyId: string;
  signature: string;
  package: RulePackage;
}

export type RuleUpdateOutcome =
  | {
      kind: "updated";
      version: string;
      previousVersion: string | null;
      package: RulePackage;
    }
  | { kind: "current"; version: string; package: RulePackage }
  | {
      kind: "cached";
      version: string;
      package: RulePackage;
      reason: string;
    }
  | { kind: "none"; reason: string };

/** Injectable fetcher so tests never touch the network. */
export type RuleManifestFetcher = (
  url: string,
  timeoutMs: number,
) => Promise<unknown>;

/* ------------------------------------------------------------------ *
 * Canonical JSON (rule-format.md — follow EXACTLY)
 * ------------------------------------------------------------------ */

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k]))
      .join(",") +
    "}"
  );
}

/* ------------------------------------------------------------------ *
 * Semver (strict x.y.z)
 * ------------------------------------------------------------------ */

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function isSemver(version: string): boolean {
  return SEMVER_RE.test(version);
}

/** Returns > 0 when a is newer than b, 0 when equal, < 0 when older. */
export function compareSemver(a: string, b: string): number {
  const ma = SEMVER_RE.exec(a);
  const mb = SEMVER_RE.exec(b);
  if (!ma || !mb) {
    throw new Error(`cannot compare non-semver versions: "${a}" vs "${b}"`);
  }
  for (let i = 1; i <= 3; i++) {
    const diff = Number(ma[i]) - Number(mb[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

/* ------------------------------------------------------------------ *
 * Manifest parsing + signature verification
 * ------------------------------------------------------------------ */

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Structurally validate a decoded manifest. Throws an honest Error naming the
 * exact problem; callers treat this like a network failure (keep cache).
 */
export function parseManifest(raw: unknown): RuleManifest {
  if (!isRecord(raw)) throw new Error("manifest is not an object");
  if (!isRecord(raw.package)) throw new Error("manifest.package missing");
  if (typeof raw.signature !== "string" || raw.signature.length === 0) {
    throw new Error("manifest.signature missing");
  }
  if (raw.algorithm !== RULES_ALGORITHM) {
    throw new Error(
      `unsupported algorithm "${String(raw.algorithm)}" (expected ${RULES_ALGORITHM})`,
    );
  }
  if (raw.publicKeyId !== RULES_PUBLIC_KEY_ID) {
    throw new Error(
      `unsupported publicKeyId "${String(raw.publicKeyId)}" (expected ${RULES_PUBLIC_KEY_ID}; ` +
        "key rotation requires a client release with the new pinned key)",
    );
  }

  const pkg = raw.package;
  if (typeof pkg.version !== "string" || !isSemver(pkg.version)) {
    throw new Error(
      `package.version "${String(pkg.version)}" is not strict x.y.z semver`,
    );
  }
  if (typeof pkg.published_at !== "string" || pkg.published_at.length === 0) {
    throw new Error("package.published_at missing");
  }
  if (!isRecord(pkg.rules)) throw new Error("package.rules missing");
  const arrays = [
    "contradiction_patterns",
    "fraud_keywords",
    "behavioral_markers",
    "serial_patterns",
    "case_configs",
  ] as const;
  for (const key of arrays) {
    if (!Array.isArray(pkg.rules[key])) {
      throw new Error(`package.rules.${key} is not an array`);
    }
  }
  return raw as unknown as RuleManifest;
}

/**
 * Verify the RSASSA-PKCS1-v1_5-SHA512 signature over the canonical JSON of
 * the package. Returns false (never throws) on any mismatch or malformed
 * input — an unverified package is simply never applied.
 */
export function verifyRulePackageSignature(
  pkg: unknown,
  signatureB64: string,
  publicKeyDerB64: string = VO_RULES_PUBLIC_KEY_DER_B64,
): boolean {
  try {
    const verifier = createVerify("RSA-SHA512");
    verifier.update(canonicalJson(pkg), "utf8");
    verifier.end();
    const key = createPublicKey({
      key: Buffer.from(publicKeyDerB64, "base64"),
      format: "der",
      type: "spki",
    });
    return verifier.verify({ key }, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Disk cache (vault/rules-cache.json)
 * ------------------------------------------------------------------ */

export function rulesCachePath(vaultDir: string): string {
  return join(vaultDir, "rules-cache.json");
}

/**
 * Load the cached package, re-verifying its signature first. A missing,
 * malformed, or tampered cache yields null — unverified bytes are never
 * applied.
 */
export function loadCachedRules(
  cachePath: string,
  publicKeyDerB64: string = VO_RULES_PUBLIC_KEY_DER_B64,
): CachedRules | null {
  try {
    if (!existsSync(cachePath)) return null;
    const raw = JSON.parse(readFileSync(cachePath, "utf8")) as unknown;
    if (!isRecord(raw) || !isRecord(raw.package)) return null;
    if (typeof raw.signature !== "string") return null;
    if (typeof raw.version !== "string" || !isSemver(raw.version)) return null;
    if (!verifyRulePackageSignature(raw.package, raw.signature, publicKeyDerB64)) {
      return null;
    }
    return raw as unknown as CachedRules;
  } catch {
    return null;
  }
}

function saveCachedRules(cachePath: string, entry: CachedRules): void {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(entry, null, 2) + "\n", "utf8");
}

/* ------------------------------------------------------------------ *
 * Default fetcher (Node 20 global fetch + abort timeout)
 * ------------------------------------------------------------------ */

export const defaultRuleManifestFetcher: RuleManifestFetcher = async (
  url,
  timeoutMs,
) => {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from rule manifest endpoint`);
  }
  return res.json();
};

/* ------------------------------------------------------------------ *
 * Update check
 * ------------------------------------------------------------------ */

export interface RuleUpdateOptions {
  /** Path to the cache file, e.g. rulesCachePath(config.storage.vault_dir). */
  cachePath: string;
  /** Defaults to $VO_RULE_MANIFEST_URL or the live worker URL. */
  manifestUrl?: string;
  /** Injectable fetcher (tests). Defaults to global fetch with timeout. */
  fetcher?: RuleManifestFetcher;
  /** Fetch timeout in ms (default 10s). */
  timeoutMs?: number;
  /** Pinned key override (tests generate their own RSA-4096 pair). */
  publicKeyDerB64?: string;
  /** Quiet logger for offline/failure notes. Defaults to no-op. */
  log?: (message: string) => void;
  /** Clock override (tests). */
  now?: () => Date;
}

/**
 * Fetch → parse → verify → accept-only-if-newer → cache. Never throws.
 *
 * Outcomes:
 * - "updated": verified newer package; cache rewritten.
 * - "current": verified package, same version as cache; nothing rewritten.
 * - "cached":  fetch/parse/verify failed or package was stale; the last
 *              verified cache remains authoritative.
 * - "none":    no usable package at all (first run offline, or first fetched
 *              package invalid). Honest reason included.
 */
export async function checkForRuleUpdate(
  options: RuleUpdateOptions,
): Promise<RuleUpdateOutcome> {
  const log = options.log ?? (() => undefined);
  const key = options.publicKeyDerB64 ?? VO_RULES_PUBLIC_KEY_DER_B64;
  const url =
    options.manifestUrl ??
    process.env[RULE_MANIFEST_URL_ENV] ??
    DEFAULT_RULE_MANIFEST_URL;
  const fetcher = options.fetcher ?? defaultRuleManifestFetcher;
  const timeoutMs = options.timeoutMs ?? DEFAULT_RULE_UPDATE_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());

  const cached = loadCachedRules(options.cachePath, key);
  const fallback = (reason: string): RuleUpdateOutcome => {
    log(`[rule-update] ${reason}`);
    return cached
      ? { kind: "cached", version: cached.version, package: cached.package, reason }
      : { kind: "none", reason };
  };

  let manifest: RuleManifest;
  try {
    manifest = parseManifest(await fetcher(url, timeoutMs));
  } catch (err) {
    return fallback(`manifest unavailable (${errMessage(err)}); keeping cached rules`);
  }

  if (!verifyRulePackageSignature(manifest.package, manifest.signature, key)) {
    return fallback(
      "signature verification failed; package rejected, cached rules unchanged",
    );
  }

  const version = manifest.package.version;
  if (cached) {
    const cmp = compareSemver(version, cached.version);
    if (cmp < 0) {
      return fallback(
        `stale package ${version} (cached ${cached.version}); rejected`,
      );
    }
    if (cmp === 0) {
      return { kind: "current", version, package: cached.package };
    }
  }

  const entry: CachedRules = {
    version,
    published_at: manifest.package.published_at,
    fetched_at: now().toISOString(),
    algorithm: manifest.algorithm,
    publicKeyId: manifest.publicKeyId,
    signature: manifest.signature,
    package: manifest.package,
  };
  try {
    saveCachedRules(options.cachePath, entry);
  } catch (err) {
    // Persistence failed — the package is still verified and usable in memory.
    log(`[rule-update] could not persist rules cache (${errMessage(err)})`);
  }
  return {
    kind: "updated",
    version,
    previousVersion: cached?.version ?? null,
    package: manifest.package,
  };
}
