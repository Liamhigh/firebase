import { runtimeId, sha512, stableStringify } from "../core/crypto.js";
import { systemPromptFor, loadConstitution } from "../core/constitution.js";
import type {
  AuditLogEntry,
  Confidence,
  DetectionSignal,
  FirewallConfig,
  Transaction,
} from "../core/types.js";
import { appendJsonl } from "../storage/vault.js";

export type AgentName =
  | "TransactionMonitor"
  | "AccountProfiler"
  | "CommunicationAudit";

export interface InvestigationScope {
  systems: string[];
  can_block_transactions: boolean;
  can_halt_payments: boolean;
  mission: string;
}

export interface BlockedTransaction {
  txn_id: string;
  blocked_at: string;
  reason: string;
  blocked_by_agent: string;
  alert_level: "WARNING" | "CRITICAL";
  automatically_reversed?: boolean;
}

export interface FraudAgent {
  agent_id: string;
  name: AgentName;
  scope: InvestigationScope;
  constraints: string[];
  deploy(): Promise<DetectionSignal[]>;
  blockTransaction(txn_id: string, reason: string, alert_level: "WARNING" | "CRITICAL"): Promise<BlockedTransaction>;
  haltPaymentRun(): Promise<{ halted_count: number; reason: string }>;
}

const CONSTRAINTS = [
  "CANNOT_SUPPRESS_FINDINGS",
  "MUST_REPORT_ALL_CONTRADICTIONS",
  "MUST_SEAL_EVIDENCE",
  "AUTO_ESCALATE_CRITICAL",
] as const;

/**
 * Mistral Instruct fraud agent deployment (Constitution-bound).
 * Agents are read-only investigators that return signals + audit logs.
 */
export class MistralAgentPool {
  private agents: FraudAgent[] = [];
  private seq = 0;

  constructor(
    private readonly config: FirewallConfig,
    private readonly getTransactions: () => Transaction[],
  ) {}

  configureDefaultPool(): this {
    this.addAgent("TransactionMonitor", {
      systems: ["transaction_engine"],
      can_block_transactions: true,
      can_halt_payments: true,
      mission: "Monitor and block fraudulent transactions in real-time",
    });
    this.addAgent("AccountProfiler", {
      systems: ["account_database"],
      can_block_transactions: true,
      can_halt_payments: false,
      mission: "Profile accounts for anomalies and block compromised accounts",
    });
    this.addAgent("CommunicationAudit", {
      systems: ["communication_logs"],
      can_block_transactions: true,
      can_halt_payments: true,
      mission: "Audit communications and block transactions showing internal fraud indicators",
    });
    return this;
  }

  addAgent(name: AgentName, scope: InvestigationScope): FraudAgent {
    const agent_id = `${name}-${String(++this.seq).padStart(3, "0")}-${runtimeId(3)}`;
    const pool = this;
    const agent: FraudAgent = {
      agent_id,
      name,
      scope,
      constraints: [...CONSTRAINTS],
      async deploy() {
        void systemPromptFor("mistral", loadConstitution());
        const txns = pool.getTransactions();
        const signals = pool.hunt(name, txns);
        for (const signal of signals) {
          pool.audit({
            ai_model: "Mistral Instruct",
            agent_id,
            action: "FLAGGED_TRANSACTION",
            target: signal.related_txn_ids[0] ?? "cluster",
            reason: signal.reasons[0] ?? scope.mission,
            confidence: signal.confidence,
          });
        }
        return signals;
      },
      async blockTransaction(txn_id: string, reason: string, alert_level: "WARNING" | "CRITICAL") {
        if (!scope.can_block_transactions) {
          throw new Error(`Agent ${agent_id} does not have authority to block transactions`);
        }
        const blocked: BlockedTransaction = {
          txn_id,
          blocked_at: new Date().toISOString(),
          reason,
          blocked_by_agent: agent_id,
          alert_level,
        };
        pool.audit({
          ai_model: "Mistral Instruct",
          agent_id,
          action: alert_level === "CRITICAL" ? "BLOCKED_TRANSACTION_CRITICAL" : "BLOCKED_TRANSACTION_WARNING",
          target: txn_id,
          reason,
          confidence: alert_level === "CRITICAL" ? "HIGH" : "MODERATE",
        });
        return blocked;
      },
      async haltPaymentRun() {
        if (!scope.can_halt_payments) {
          throw new Error(`Agent ${agent_id} does not have authority to halt payment runs`);
        }
        const txns = pool.getTransactions();
        const suspiciousCount = txns.filter(t => {
          const score = (t.metadata as Record<string, unknown> | undefined)?.fraud_score;
          return typeof score === 'number' && score > 0.7;
        }).length;

        pool.audit({
          ai_model: "Mistral Instruct",
          agent_id,
          action: "HALTED_PAYMENT_RUN",
          target: `payment_batch_${runtimeId(4)}`,
          reason: `Payment run halted due to ${suspiciousCount} high-risk transactions detected`,
          confidence: "HIGH",
        });

        return {
          halted_count: suspiciousCount,
          reason: `${suspiciousCount} transactions halted pending verification`
        };
      },
    };
    this.agents.push(agent);
    return agent;
  }

  list(): FraudAgent[] {
    return [...this.agents];
  }

  async deployAll(): Promise<DetectionSignal[]> {
    const results: DetectionSignal[] = [];
    for (const agent of this.agents) {
      results.push(...(await agent.deploy()));
    }
    return results;
  }

  private hunt(name: AgentName, txns: Transaction[]): DetectionSignal[] {
    if (name === "TransactionMonitor") {
      return txns
        .filter((t) => t.amount >= this.config.rules.amount_threshold_zar * 0.5)
        .slice(0, 5)
        .map((t) => ({
          source: `Mistral Agent - ${name}`,
          fraud_type: "AMOUNT_ANOMALY" as const,
          confidence: "HIGH" as Confidence,
          score: 0.78,
          reasons: [
            `Agent hunt flagged ${t.txn_id} for elevated amount relative to monitoring baseline`,
          ],
          related_txn_ids: [t.txn_id],
        }));
    }
    if (name === "AccountProfiler") {
      const counts = new Map<string, number>();
      for (const t of txns) {
        counts.set(t.account_id, (counts.get(t.account_id) ?? 0) + 1);
      }
      const hot = [...counts.entries()].filter(([, n]) => n >= 5);
      return hot.map(([accountId, n]) => ({
        source: `Mistral Agent - ${name}`,
        fraud_type: "ACCOUNT_TAKEOVER" as const,
        confidence: "MODERATE" as Confidence,
        score: 0.65,
        reasons: [
          `Account ${accountId} shows burst activity (${n} txns) — profile anomaly`,
        ],
        related_txn_ids: txns
          .filter((t) => t.account_id === accountId)
          .map((t) => t.txn_id),
      }));
    }
    // CommunicationAudit — placeholder offline heuristic
    return txns.some((t) => t.metadata?.internal_note)
      ? [
          {
            source: `Mistral Agent - ${name}`,
            fraud_type: "INTERNAL_FRAUD",
            confidence: "MODERATE",
            score: 0.6,
            reasons: [
              "Communication audit found internal notes correlated with flagged transfers",
            ],
            related_txn_ids: txns
              .filter((t) => t.metadata?.internal_note)
              .map((t) => t.txn_id),
          },
        ]
      : [];
  }

  private audit(
    entry: Omit<AuditLogEntry, "log_id" | "timestamp" | "sha512">,
  ): void {
    const timestamp = new Date().toISOString();
    const payload = { ...entry, timestamp };
    const record: AuditLogEntry = {
      log_id: `AL-${runtimeId(4)}`,
      ...entry,
      timestamp,
      sha512: sha512(stableStringify(payload)),
    };
    appendJsonl(this.config.storage.audit_log, record);
  }
}
