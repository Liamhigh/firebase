import type {
  Confidence,
  DetectionSignal,
  FirewallConfig,
  Transaction,
} from "../core/types.js";

export interface RuleEngineResult {
  signals: DetectionSignal[];
  anomaly_score: number;
}

/**
 * Bank-configurable rule engine: velocity, amount, geographic checks.
 * Deterministic — same inputs produce same signals.
 */
export class RuleEngine {
  constructor(private readonly config: FirewallConfig) {}

  evaluate(transactions: Transaction[]): RuleEngineResult {
    const signals: DetectionSignal[] = [];
    const sorted = [...transactions].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );

    signals.push(...this.velocityChecks(sorted));
    signals.push(...this.amountChecks(sorted));
    signals.push(...this.geoChecks(sorted));

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
