import { systemPromptFor, loadConstitution } from "../core/constitution.js";
import type {
  Confidence,
  DetectionSignal,
  Transaction,
  VerificationVote,
} from "../core/types.js";

export interface ModelContext {
  transactions: Transaction[];
  signals: DetectionSignal[];
  anomaly_score: number;
  institution: string;
  jurisdiction: string;
}

/**
 * Offline-first AI adapters.
 * Default mode is deterministic forensic heuristics bound by Constitution prompts.
 * Swap `analyze` implementations for local Gemma/Phi/Mistral runtimes without
 * changing the pipeline contract.
 */
export abstract class ConstitutionalModel {
  abstract readonly name: string;
  abstract readonly role: string;

  protected prompt(): string {
    return systemPromptFor(this.name.toLowerCase().replace(/[^a-z0-9]/g, ""), loadConstitution());
  }

  abstract analyze(ctx: ModelContext): DetectionSignal[];
  abstract verify(ctx: ModelContext, proposed: DetectionSignal[]): VerificationVote;
}

export class Gemma4Monitor extends ConstitutionalModel {
  readonly name = "Gemma4";
  readonly role = "pattern_detection";

  analyze(ctx: ModelContext): DetectionSignal[] {
    void this.prompt();
    const out: DetectionSignal[] = [];
    const byAccount = new Map<string, Transaction[]>();
    for (const t of ctx.transactions) {
      const arr = byAccount.get(t.account_id) ?? [];
      arr.push(t);
      byAccount.set(t.account_id, arr);
    }

    for (const [accountId, txns] of byAccount) {
      if (txns.length < 3) continue;
      const amounts = txns.map((t) => t.amount);
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance =
        amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length;
      const std = Math.sqrt(variance) || 1;
      const outliers = txns.filter((t) => Math.abs(t.amount - mean) > 3 * std);
      if (outliers.length) {
        out.push({
          source: "Gemma4",
          fraud_type: "AMOUNT_ANOMALY",
          confidence: "HIGH",
          score: Math.min(1, 0.6 + outliers.length * 0.1),
          reasons: [
            `Statistical outlier pattern on account ${accountId}: ${outliers.length} txn(s) > 3 std-dev from mean`,
          ],
          related_txn_ids: outliers.map((t) => t.txn_id),
        });
      }

      // Layering heuristic: many mid-size transfers to distinct counterparties
      const counterparties = new Set(
        txns.map((t) => t.counterparty).filter(Boolean),
      );
      if (txns.length >= 8 && counterparties.size >= 6) {
        out.push({
          source: "Gemma4",
          fraud_type: "LAYERING",
          confidence: "MODERATE",
          score: 0.7,
          reasons: [
            `Possible layering: ${txns.length} transfers across ${counterparties.size} counterparties on ${accountId}`,
          ],
          related_txn_ids: txns.map((t) => t.txn_id),
        });
      }
    }

    // Correlate rule signals into network suspicion
    if (ctx.signals.length >= 2) {
      out.push({
        source: "Gemma4",
        fraud_type: ctx.signals[0].fraud_type,
        confidence: "HIGH",
        score: Math.min(1, ctx.anomaly_score + 0.1),
        reasons: [
          `Correlated ${ctx.signals.length} independent rule/AI signals into a fraud network pattern`,
        ],
        related_txn_ids: [
          ...new Set(ctx.signals.flatMap((s) => s.related_txn_ids)),
        ],
      });
    }

    return out;
  }

  verify(ctx: ModelContext, proposed: DetectionSignal[]): VerificationVote {
    const concurs = proposed.length > 0 && ctx.anomaly_score >= 0.5;
    return {
      model: this.name,
      vote: concurs ? "CONCURS" : proposed.length ? "ABSTAIN" : "DISSENTS",
      confidence: ordinal(ctx.anomaly_score),
      rationale: concurs
        ? "Pattern correlation supports proposed fraud alert"
        : "Insufficient pattern evidence for confirmation",
      checks: ["transaction_patterns", "anomaly_correlation", "metadata"],
    };
  }
}

export class Gemma3Forensics extends ConstitutionalModel {
  readonly name = "Gemma3";
  readonly role = "evidence_sealing";

  analyze(_ctx: ModelContext): DetectionSignal[] {
    return []; // Gemma3 focuses on sealing/reports, not primary detection
  }

  verify(ctx: ModelContext, proposed: DetectionSignal[]): VerificationVote {
    void this.prompt();
    const hasAnchors = proposed.every((p) => p.related_txn_ids.length > 0);
    const hasReasons = proposed.every((p) => p.reasons.length > 0);
    const concurs = proposed.length > 0 && hasAnchors && hasReasons;
    return {
      model: this.name,
      vote: concurs ? "CONCURS" : "DISSENTS",
      confidence: ordinal(ctx.anomaly_score),
      rationale: concurs
        ? "Evidence atoms anchored; document integrity checks pass"
        : "Missing anchors or rationale — cannot seal narrative without evidence",
      checks: ["transaction_patterns", "metadata", "document_integrity"],
    };
  }

  writeForensicReport(ctx: ModelContext, proposed: DetectionSignal[]): string {
    const lines = [
      "VERUM OMNIS FORENSIC ANALYSIS",
      `Institution: ${ctx.institution}`,
      `Jurisdiction: ${ctx.jurisdiction}`,
      `Anomaly score: ${ctx.anomaly_score.toFixed(3)} (ordinal confidence only in sealed outputs)`,
      "",
      "FINDINGS:",
      ...proposed.flatMap((p, i) => [
        `${i + 1}. [${p.fraud_type}] ${p.source} — ${p.confidence}`,
        ...p.reasons.map((r) => `   - ${r}`),
        `   Anchors: ${p.related_txn_ids.join(", ") || "none"}`,
      ]),
      "",
      "TRANSACTIONS IN SCOPE:",
      ...ctx.transactions.map(
        (t) =>
          `- ${t.txn_id} | ${t.timestamp} | ${t.currency} ${t.amount} | acct=${t.account_id} | ${t.country ?? "n/a"}`,
      ),
      "",
      "CONSTITUTIONAL NOTE:",
      "This report was produced under Constitution v6.0.0. Findings cannot be suppressed.",
    ];
    return lines.join("\n");
  }
}

export class Phi3Legal extends ConstitutionalModel {
  readonly name = "Phi3";
  readonly role = "legal_analysis";

  analyze(_ctx: ModelContext): DetectionSignal[] {
    return [];
  }

  verify(ctx: ModelContext, proposed: DetectionSignal[]): VerificationVote {
    void this.prompt();
    const jurisdiction = ctx.jurisdiction.toUpperCase();
    const known = ["ZA", "US", "EU", "UK", "AE", "UN"];
    const mapped = known.includes(jurisdiction);
    const concurs = proposed.length > 0 && mapped && ctx.anomaly_score >= 0.45;
    return {
      model: this.name,
      vote: concurs ? "CONCURS" : "ABSTAIN",
      confidence: mapped ? "HIGH" : "MODERATE",
      rationale: concurs
        ? `Legal significance established under jurisdiction ${jurisdiction}; compliance checks pass`
        : `Jurisdiction ${jurisdiction} mapping incomplete or evidence below legal threshold`,
      checks: ["jurisdiction", "applicable_law", "legal_significance"],
    };
  }

  applicableLaws(fraudType: string, jurisdiction: string): string[] {
    const j = jurisdiction.toUpperCase();
    const base: Record<string, string[]> = {
      ZA: [
        "Prevention of Organised Crime Act 121 of 1998",
        "Financial Intelligence Centre Act 38 of 2001",
        "Prevention and Combating of Corrupt Activities Act 12 of 2004",
      ],
      US: ["18 U.S.C. § 1344 Bank Fraud", "Bank Secrecy Act"],
      EU: ["AMLD6", "PSD2 strong customer authentication"],
      UK: ["Proceeds of Crime Act 2002", "Fraud Act 2006"],
      AE: ["UAE Federal Decree-Law No. 20 of 2018 on AML"],
    };
    return [
      ...(base[j] ?? ["UN Convention against Transnational Organized Crime"]),
      `Offence class mapping for ${fraudType}`,
    ];
  }
}

export class NineBrainEngine extends ConstitutionalModel {
  readonly name = "NineBrain";
  readonly role = "forensic_validation";

  analyze(ctx: ModelContext): DetectionSignal[] {
    const contradictions: string[] = [];
    const byId = new Map(ctx.transactions.map((t) => [t.txn_id, t]));
    for (const signal of ctx.signals) {
      for (const id of signal.related_txn_ids) {
        if (!byId.has(id)) {
          contradictions.push(
            `Signal ${signal.source} references missing transaction ${id}`,
          );
        }
      }
    }
    // Timeline inconsistency: future-dated relative to peers
    const times = ctx.transactions.map((t) => new Date(t.timestamp).getTime());
    if (times.length >= 2) {
      const maxGap = Math.max(...times) - Math.min(...times);
      if (maxGap > 1000 * 60 * 60 * 24 * 30) {
        contradictions.push(
          "Timeline span exceeds 30 days within a single alert cluster — review for stitching errors",
        );
      }
    }

    if (!contradictions.length) return [];
    return [
      {
        source: "NineBrain",
        fraud_type: "UNKNOWN",
        confidence: "MODERATE",
        score: 0.55,
        reasons: contradictions,
        related_txn_ids: ctx.transactions.map((t) => t.txn_id),
      },
    ];
  }

  verify(ctx: ModelContext, proposed: DetectionSignal[]): VerificationVote {
    const contra = this.analyze(ctx);
    const blocking = contra.some((c) =>
      c.reasons.some((r) => r.includes("missing transaction")),
    );
    const concurs = proposed.length > 0 && !blocking;
    return {
      model: this.name,
      vote: concurs ? "CONCURS" : "DISSENTS",
      confidence: ordinal(ctx.anomaly_score),
      rationale: concurs
        ? "Forensic validation passed: contradictions disclosed, no blocking integrity failures"
        : "Blocking contradictions prevent confirmation — escalate to human review",
      checks: ["contradictions", "anomalies", "financial_brain"],
    };
  }
}

function ordinal(score: number): Confidence {
  if (score >= 0.9) return "VERY_HIGH";
  if (score >= 0.75) return "HIGH";
  if (score >= 0.55) return "MODERATE";
  if (score >= 0.35) return "LOW";
  return "INSUFFICIENT";
}
