import type {
  Confidence,
  DetectionSignal,
  FirewallConfig,
  Transaction,
} from "../core/types.js";
import type {
  BehavioralMarker,
  FraudKeywordGroup,
  RulePackage,
} from "../core/ruleUpdate.js";

export interface RuleEngineResult {
  signals: DetectionSignal[];
  anomaly_score: number;
}

/** A downloaded fraud-keyword group flattened to matchable phrases. */
interface CompiledKeywordGroup {
  id: string;
  group: string;
  description?: string;
  produces?: string;
  phrases: string[];
  /** Positive/negative pairs — co-occurrence indicates a contradiction. */
  pairs: [string, string][];
}

/** A downloaded behavioral marker flattened to phrases + regex patterns. */
interface CompiledMarker {
  id: string;
  name: string;
  phrases: string[];
  patterns: RegExp[];
}

interface CompiledRules {
  version: string;
  keywordGroups: CompiledKeywordGroup[];
  markers: CompiledMarker[];
}

/**
 * Bank-configurable rule engine: velocity, amount, geographic checks.
 * Deterministic — same inputs produce same signals.
 *
 * Additionally, once a signed rule package has been downloaded and verified
 * (core/ruleUpdate.ts), the engine scans transaction text fields for the
 * package's fraud keywords and behavioral markers. With no downloaded rules
 * the engine behaves exactly as before (zero extra signals).
 */
export class RuleEngine {
  private downloaded: CompiledRules | null = null;

  constructor(private readonly config: FirewallConfig) {}

  /**
   * Install a verified rule package (or null to clear). Only packages that
   * passed signature verification in core/ruleUpdate.ts may reach this.
   */
  updateRules(pkg: RulePackage | null): void {
    this.downloaded = pkg ? compileDownloadedRules(pkg) : null;
  }

  /** Version of the currently installed downloaded rules, if any. */
  get downloadedRulesVersion(): string | null {
    return this.downloaded?.version ?? null;
  }

  evaluate(transactions: Transaction[]): RuleEngineResult {
    const signals: DetectionSignal[] = [];
    const sorted = [...transactions].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );

    signals.push(...this.velocityChecks(sorted));
    signals.push(...this.amountChecks(sorted));
    signals.push(...this.geoChecks(sorted));
    signals.push(...this.downloadedRuleChecks(sorted));

    const anomaly_score = scoreFromSignals(signals);
    if (anomaly_score >= this.config.rules.anomaly_score_threshold) {
      signals.push({
        source: "RuleEngine",
        fraud_type: "UNKNOWN",
        confidence: ordinalFromScore(anomaly_score),
        score: anomaly_score,
        reasons: [
          `Aggregate anomaly score ${anomaly_score.toFixed(3)} exceeds threshold ${this.config.rules.anomaly_score_threshold}`,
        ],
        related_txn_ids: sorted.map((t) => t.txn_id),
      });
    }

    return { signals, anomaly_score };
  }

  private velocityChecks(txns: Transaction[]): DetectionSignal[] {
    const { max_transactions, window_seconds } = this.config.rules.velocity;
    const byAccount = groupBy(txns, (t) => t.account_id);
    const out: DetectionSignal[] = [];

    for (const [accountId, list] of byAccount) {
      for (let i = 0; i < list.length; i++) {
        const start = new Date(list[i].timestamp).getTime();
        const windowEnd = start + window_seconds * 1000;
        const inWindow = list.filter((t) => {
          const ts = new Date(t.timestamp).getTime();
          return ts >= start && ts <= windowEnd;
        });
        if (inWindow.length > max_transactions) {
          out.push({
            source: "RuleEngine.velocity",
            fraud_type: "VELOCITY_ABUSE",
            confidence: "HIGH",
            score: Math.min(1, inWindow.length / (max_transactions * 1.5)),
            reasons: [
              `Velocity threshold exceeded for account ${accountId}: ${inWindow.length} transactions in ${window_seconds} seconds (max ${max_transactions})`,
            ],
            related_txn_ids: inWindow.map((t) => t.txn_id),
          });
          break;
        }
      }
    }
    return out;
  }

  private amountChecks(txns: Transaction[]): DetectionSignal[] {
    const threshold = this.config.rules.amount_threshold_zar;
    const out: DetectionSignal[] = [];
    for (const t of txns) {
      const zar = toZar(t.amount, t.currency);
      if (zar >= threshold) {
        out.push({
          source: "RuleEngine.amount",
          fraud_type: "AMOUNT_ANOMALY",
          confidence: zar >= threshold * 4 ? "VERY_HIGH" : "HIGH",
          score: Math.min(1, zar / (threshold * 4)),
          reasons: [
            `Amount ${t.currency} ${t.amount} exceeds threshold ZAR ${threshold}`,
          ],
          related_txn_ids: [t.txn_id],
        });
      }
    }
    return out;
  }

  private geoChecks(txns: Transaction[]): DetectionSignal[] {
    const block = new Set(this.config.rules.geo_blocklist);
    const out: DetectionSignal[] = [];
    for (const t of txns) {
      if (t.country && block.has(t.country.toUpperCase())) {
        out.push({
          source: "RuleEngine.geo",
          fraud_type: "GEO_ANOMALY",
          confidence: "HIGH",
          score: 0.85,
          reasons: [
            `Transaction ${t.txn_id} originated from blocked jurisdiction ${t.country}`,
          ],
          related_txn_ids: [t.txn_id],
        });
      }
    }
    return out;
  }

  /**
   * Scan transaction text fields for downloaded fraud keywords / behavioral
   * markers. Emits nothing at all when no verified package is installed —
   * preserving the engine's original behavior byte-for-byte.
   */
  private downloadedRuleChecks(txns: Transaction[]): DetectionSignal[] {
    if (!this.downloaded) return [];
    const texts = txns.map((t) => ({
      txn_id: t.txn_id,
      text: transactionText(t),
    }));
    const out: DetectionSignal[] = [];

    for (const group of this.downloaded.keywordGroups) {
      const hits = new Map<string, Set<string>>(); // phrase -> txn_ids
      const pairHits: { a: string; b: string; txn_id: string }[] = [];
      for (const { txn_id, text } of texts) {
        for (const phrase of group.phrases) {
          if (text.includes(phrase)) {
            const set = hits.get(phrase) ?? new Set<string>();
            set.add(txn_id);
            hits.set(phrase, set);
          }
        }
        for (const [a, b] of group.pairs) {
          if (text.includes(a) && text.includes(b)) {
            pairHits.push({ a, b, txn_id });
          }
        }
      }
      if (hits.size === 0 && pairHits.length === 0) continue;

      const matchedPhrases = [...hits.keys()];
      const txnIds = [
        ...new Set([
          ...[...hits.values()].flatMap((s) => [...s]),
          ...pairHits.map((p) => p.txn_id),
        ]),
      ];
      const reasons = [
        `Downloaded rule ${group.id} (${group.group}) matched ${matchedPhrases.length} phrase(s): ${matchedPhrases.slice(0, 6).map((p) => `"${p}"`).join(", ")}${matchedPhrases.length > 6 ? ", …" : ""}` +
          (group.description ? ` — ${group.description}` : ""),
      ];
      let score = Math.min(0.9, 0.45 + 0.1 * (matchedPhrases.length - 1));
      for (const p of pairHits.slice(0, 4)) {
        reasons.push(
          `Contradiction pair co-occurrence in ${p.txn_id}: "${p.a}" vs "${p.b}"${group.produces ? ` (produces ${group.produces})` : ""}`,
        );
      }
      if (pairHits.length > 0) score = Math.min(0.95, score + 0.15);

      out.push({
        source: `RuleEngine.downloaded.${group.id}`,
        fraud_type: "UNKNOWN",
        confidence: ordinalFromScore(score),
        score,
        reasons,
        related_txn_ids: txnIds,
      });
    }

    for (const marker of this.downloaded.markers) {
      const matchedPhrases = new Set<string>();
      const txnIds = new Set<string>();
      for (const { txn_id, text } of texts) {
        for (const phrase of marker.phrases) {
          if (text.includes(phrase)) {
            matchedPhrases.add(phrase);
            txnIds.add(txn_id);
          }
        }
        for (const pattern of marker.patterns) {
          if (pattern.test(text)) {
            matchedPhrases.add(`/${pattern.source}/`);
            txnIds.add(txn_id);
          }
        }
      }
      if (matchedPhrases.size === 0) continue;

      const listed = [...matchedPhrases];
      const score = Math.min(0.9, 0.45 + 0.1 * (listed.length - 1));
      out.push({
        source: `RuleEngine.downloaded.${marker.id}`,
        fraud_type: "UNKNOWN",
        confidence: ordinalFromScore(score),
        score,
        reasons: [
          `Behavioral marker ${marker.id} "${marker.name}" matched: ${listed.slice(0, 6).map((p) => `"${p}"`).join(", ")}${listed.length > 6 ? ", …" : ""}`,
        ],
        related_txn_ids: [...txnIds],
      });
    }

    return out;
  }
}

/* ------------------------------------------------------------------ *
 * Downloaded-rule compilation (package schema → matchable phrases)
 * ------------------------------------------------------------------ */

/** Recursively collect trimmed strings from strings/arrays/objects. */
function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length > 0) out.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
}

/** Extract [positive, negative] string pairs from a fraud_keywords `pairs` payload. */
function collectPairs(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return [];
  const out: [string, string][] = [];
  for (const entry of value) {
    if (
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === "string" &&
      typeof entry[1] === "string"
    ) {
      const a = entry[0].trim().toLowerCase();
      const b = entry[1].trim().toLowerCase();
      if (a && b) out.push([a, b]);
    }
  }
  return out;
}

function compileKeywordGroup(group: FraudKeywordGroup): CompiledKeywordGroup {
  const phrases: string[] = [];
  collectStrings(group.pairs, phrases);
  collectStrings(group.terms, phrases);
  collectStrings(group.items, phrases);
  collectStrings(group.groups, phrases);
  return {
    id: group.id,
    group: group.group,
    description: group.description,
    produces: group.produces,
    phrases: [...new Set(phrases)],
    pairs: collectPairs(group.pairs),
  };
}

function compileMarker(marker: BehavioralMarker): CompiledMarker {
  const phrases: string[] = [];
  collectStrings(marker.keywords, phrases);
  collectStrings(marker.items, phrases);
  const patterns: RegExp[] = [];
  const rawPatterns: string[] = [];
  collectStrings(marker.patterns, rawPatterns);
  for (const src of rawPatterns) {
    try {
      patterns.push(new RegExp(src, "i"));
    } catch {
      // Skip a pattern that does not compile — never let rule data crash scans.
    }
  }
  return {
    id: marker.id,
    name: marker.name,
    phrases: [...new Set(phrases)],
    patterns,
  };
}

function compileDownloadedRules(pkg: RulePackage): CompiledRules {
  return {
    version: pkg.version,
    keywordGroups: (pkg.rules.fraud_keywords ?? []).map(compileKeywordGroup),
    markers: (pkg.rules.behavioral_markers ?? []).map(compileMarker),
  };
}

/** Lowercased searchable text of a transaction's human-meaningful fields. */
function transactionText(t: Transaction): string {
  const parts: string[] = [
    t.account_id,
    t.currency,
    t.country ?? "",
    t.channel ?? "",
    t.counterparty ?? "",
  ];
  collectStrings(t.metadata ?? {}, parts);
  return parts.join("\n").toLowerCase();
}

function toZar(amount: number, currency: string): number {
  const rates: Record<string, number> = {
    ZAR: 1,
    USD: 18,
    EUR: 20,
    GBP: 23,
  };
  return amount * (rates[currency.toUpperCase()] ?? 1);
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}

function scoreFromSignals(signals: DetectionSignal[]): number {
  if (signals.length === 0) return 0;
  const max = Math.max(...signals.map((s) => s.score));
  const boost = Math.min(0.25, signals.length * 0.05);
  return Math.min(1, max + boost);
}

function ordinalFromScore(score: number): Confidence {
  if (score >= 0.9) return "VERY_HIGH";
  if (score >= 0.75) return "HIGH";
  if (score >= 0.55) return "MODERATE";
  if (score >= 0.35) return "LOW";
  return "INSUFFICIENT";
}
