import type {
  DetectionSignal,
  FirewallConfig,
  FraudAlert,
  FraudType,
  Transaction,
  Confidence,
} from "../core/types.js";
import {
  makeAlertId,
  makeCaseReference,
} from "../core/crypto.js";
import { RuleEngine } from "./rules.js";
import { Gemma3Forensics, Gemma4Monitor, Phi3Legal } from "../ai/models.js";
import { TripleAiConsensus } from "../ai/consensus.js";
import { MistralAgentPool } from "../agents/mistral.js";
import { DocumentSealingService } from "../core/sealing.js";
import { generateCommissionInvoice } from "../core/commission.js";
import { NotificationService } from "../notifications/email.js";
import { SealCreditLedgerService } from "../core/sealCredits.js";
import { ForensicEngine } from "../forensics/engine.js";
import { verifySeal, type SealVerification } from "../core/verification.js";
import { buildTimelineFromTransactions } from "../forensics/timeline.js";
import { offenceFromFraud } from "../forensics/offences.js";
import { computeQuote, revenueModel, type QuoteInput } from "../core/pricing.js";
import { createLlmProvider, type LlmProvider } from "../ai/llm.js";
import { findingsPath, readJson } from "../storage/vault.js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Contradiction, Offence, TimelineEvent } from "../core/types.js";
import {
  assertConstitutionIntegrity,
  loadConstitution,
  type Constitution,
} from "../core/constitution.js";
import {
  assessEthics,
  assessWeaponization,
  recordSilenceLedger,
} from "../core/ethics.js";
import {
  alertPath,
  ensureVault,
  invoicePath,
  sealedPath,
  writeJson,
} from "../storage/vault.js";

export interface MonitorResult {
  alert: FraudAlert | null;
  signals: DetectionSignal[];
  invoice_path?: string;
  bank_email_path?: string;
  verum_email_path?: string;
  sealed_pdf_path?: string;
  human_review?: boolean;
  message: string;
}

export class FraudFirewall {
  private readonly rules: RuleEngine;
  private readonly gemma4: Gemma4Monitor;
  private readonly gemma3: Gemma3Forensics;
  private readonly phi3: Phi3Legal;
  private readonly consensus: TripleAiConsensus;
  private readonly sealing: DocumentSealingService;
  private readonly notifications: NotificationService;
  private readonly credits: SealCreditLedgerService;
  private readonly agents: MistralAgentPool;
  private readonly forensics: ForensicEngine;
  private readonly llm: LlmProvider;
  private readonly constitution: Constitution;
  private readonly buffer: Transaction[] = [];
  private alertSeq = 0;
  private caseSeq = 0;

  constructor(private readonly config: FirewallConfig) {
    ensureVault(config);
    this.rules = new RuleEngine(config);
    this.gemma4 = new Gemma4Monitor();
    this.gemma3 = new Gemma3Forensics();
    this.phi3 = new Phi3Legal();
    this.consensus = new TripleAiConsensus();
    this.sealing = new DocumentSealingService(config);
    this.notifications = new NotificationService(config);
    this.credits = new SealCreditLedgerService(config);
    this.agents = new MistralAgentPool(config, () => [...this.buffer]).configureDefaultPool();
    this.llm = createLlmProvider(config);
    // The engine uses the LLM for narrative authoring only; detection & sealing
    // stay fully deterministic regardless of whether a model is reachable.
    this.forensics = new ForensicEngine(config, this.llm);
    // Fail fast if the sealed Constitution has been tampered with.
    this.constitution = loadConstitution(config.constitution_version);
    assertConstitutionIntegrity(this.constitution);
  }

  /** Full machine-readable Constitution (embedded into every seal). */
  getConstitution(): Constitution {
    return this.constitution;
  }

  /** The canonical forensic Nine-Brain registry + consensus rule (§4). */
  getBrains(): NonNullable<Constitution["nine_brains"]> {
    return (
      this.constitution.nine_brains ?? {
        consensus_rule: "At least three independent brains must agree.",
        brains: [],
      }
    );
  }

  /**
   * Constitutional gate: Ethics Core kill-switch (bias > 0.3% halts) and
   * Article X non-weaponization check. A weaponization breach is recorded in
   * the immutable Silence Ledger.
   */
  constitutionCheck(input: { purpose?: string; biasScore?: number }) {
    const ethics = assessEthics(input.biasScore ?? 0);
    const weaponization = input.purpose
      ? assessWeaponization(input.purpose)
      : { breach: false, matches: [], message: "No purpose supplied." };
    let silence_ledger: { ledger_path: string; sha512: string } | undefined;
    if (weaponization.breach) {
      silence_ledger = recordSilenceLedger(this.config, {
        type: "WEAPONIZATION_ATTEMPT",
        detail: weaponization.classification ?? "CONSTITUTIONAL BREACH",
        purpose: input.purpose,
      });
    }
    return {
      allowed: !ethics.halted && !weaponization.breach,
      ethics,
      weaponization,
      silence_ledger,
    };
  }

  /**
   * Plain-English narrative of the latest findings. Uses the local LLM when
   * configured/reachable, else a deterministic templated summary. Never affects
   * the sealed forensic content.
   */
  async aiNarrative(input: { prompt?: string; useFindings?: boolean } = {}): Promise<{
    provider: string;
    source: "llm" | "deterministic";
    summary: string;
  }> {
    const context = input.useFindings === false ? "" : this.findingsContext();
    const system =
      "You are Verum Omnis. Communicate findings clearly. Cite evidence. Ordinal confidence only.";
    const ask =
      input.prompt?.trim() ||
      "Summarise the forensic findings for a bank fraud officer in a short paragraph.";
    const prompt = context ? `${ask}\n\nCONTEXT:\n${context}` : ask;

    const generated = await this.llm.generate({ system, prompt });
    if (generated) {
      return { provider: this.llm.name, source: "llm", summary: generated };
    }
    return {
      provider: "deterministic",
      source: "deterministic",
      summary: this.deterministicNarrative(ask, context),
    };
  }

  private findingsContext(): string {
    const contradictions = readJson<Contradiction[]>(
      findingsPath(this.config, "contradictions.json"),
    ) ?? [];
    const timeline = readJson<TimelineEvent[]>(findingsPath(this.config, "timeline.json")) ?? [];
    const offences = readJson<Offence[]>(findingsPath(this.config, "offence_matrix.json")) ?? [];
    if (!contradictions.length && !timeline.length && !offences.length) return "";
    const lines = [
      `Contradictions: ${contradictions.length}`,
      ...contradictions.slice(0, 5).map(
        (c) => `- [${c.severity}] ${c.claim_a.text} <-> ${c.claim_b.text}`,
      ),
      `Timeline events: ${timeline.length}`,
      ...timeline.slice(0, 5).map((e) => `- ${e.date}: ${e.description}`),
      `Offences: ${offences.length}`,
      ...offences.slice(0, 5).map((o) => `- ${o.title} (${o.severity}, ${o.confidence})`),
    ];
    return lines.join("\n");
  }

  /**
   * Conversational assistant for attorneys / compliance. It has persistent case
   * memory: it re-reads the sealed vault findings on every turn (the vault is
   * never wiped unless the user clears it). Uses the local LLM when reachable,
   * else a deterministic reply. Any output the user wants to rely on must be
   * sealed via `/v1/seal` — if it isn't on a sealed PDF, Verum Omnis never said it.
   */
  async chat(input: {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  }): Promise<{ provider: string; source: "llm" | "deterministic"; reply: string }> {
    const context = this.findingsContext();
    const system =
      "You are Verum Omnis, a constitutional forensic investigator assisting attorneys, " +
      "banks and compliance teams. You have persistent access to the case vault. Be precise, " +
      "cite sealed evidence with page anchors, use ordinal confidence words (never percentages), " +
      "and never fabricate. Remind the user that any output they intend to rely on must be sealed " +
      "as a PDF — if it is not sealed, Verum Omnis never said it.";
    const hist = (input.history ?? [])
      .slice(-8)
      .map((m) => `${m.role === "user" ? "USER" : "VERUM OMNIS"}: ${m.content}`)
      .join("\n");
    const prompt = [
      context ? `CASE VAULT CONTEXT:\n${context}` : "The case vault has no sealed findings yet.",
      hist ? `CONVERSATION SO FAR:\n${hist}` : "",
      `USER: ${input.message}`,
      "VERUM OMNIS:",
    ]
      .filter(Boolean)
      .join("\n\n");

    const generated = await this.llm.generate({ system, prompt });
    if (generated) {
      return { provider: this.llm.name, source: "llm", reply: generated };
    }
    return {
      provider: "deterministic",
      source: "deterministic",
      reply: this.deterministicChat(input.message, context),
    };
  }

  private deterministicChat(message: string, context: string): string {
    const head = context
      ? "Here is what the sealed case vault currently holds:"
      : "The case vault has no sealed findings yet. Upload and seal evidence first, then ask again.";
    return [
      `You asked: "${message.trim()}"`,
      "",
      head,
      context || "(empty vault)",
      "",
      "To take this further (deep research, drafting an affidavit or letter), configure a local",
      "LLM (ai.mode=external with Ollama). Whatever you rely on must be SEALED as a PDF — use",
      "\"Seal answer\" so it becomes court-usable evidence. If it is not sealed, Verum Omnis never said it.",
      "(Deterministic mode: no local LLM configured.)",
    ].join("\n");
  }

  /**
   * Communications ledger (anti-harassment): summarises every outbound message
   * recorded in the vault by recipient, so the operator can see how many emails
   * were sent to whom and how often before sending more.
   */
  commsLedger(): {
    total: number;
    recipients: Array<{ to: string; role: string; count: number; last_subject: string }>;
  } {
    const dir = join(this.config.storage.vault_dir, "outbound-email");
    if (!existsSync(dir)) return { total: 0, recipients: [] };
    const map = new Map<string, { to: string; role: string; count: number; last_subject: string }>();
    let total = 0;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const rec = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
          to?: string;
          subject?: string;
          recipient_role?: string;
        };
        const to = rec.to ?? "unknown";
        total += 1;
        const existing = map.get(to);
        if (existing) {
          existing.count += 1;
          existing.last_subject = rec.subject ?? existing.last_subject;
        } else {
          map.set(to, {
            to,
            role: rec.recipient_role ?? "unknown",
            count: 1,
            last_subject: rec.subject ?? "",
          });
        }
      } catch {
        /* skip unreadable record */
      }
    }
    return {
      total,
      recipients: [...map.values()].sort((a, b) => b.count - a.count),
    };
  }

  private deterministicNarrative(ask: string, context: string): string {
    if (!context) {
      return (
        "No forensic findings are currently available to summarise. Run evidence " +
        "extraction or a monitoring pass first. (Deterministic mode: no local LLM configured.)"
      );
    }
    return [
      "FORENSIC SUMMARY (deterministic — no local LLM configured):",
      context,
      "",
      "All items are anchored to sealed evidence with SHA-512 hashes and were produced",
      "under Constitution v5.2.7 with Triple-AI verification. Configure ai.mode=external",
      "with a local Ollama model for natural-language narration.",
    ].join("\n");
  }

  /** Ingest an evidence document for forensic extraction (spec §4.1). */
  ingestEvidence(doc: unknown) {
    return this.forensics.ingest(doc);
  }

  listEvidence() {
    return this.forensics.listEvidence();
  }

  /** Clear the buffered evidence documents. */
  resetEvidence(): void {
    this.forensics.reset();
  }

  /** Extract evidence atoms + contradictions from documents (spec §4.2/§4.3). */
  extractEvidence(opts: { documents?: unknown[]; seal?: boolean } = {}) {
    return this.forensics.extract(opts);
  }

  /** Revenue model (business constitution): the universal 20% share + free tiers. */
  getPricing() {
    return revenueModel();
  }

  /** Compute a 20% quote for a given category/user type (honours free tiers). */
  quote(input: QuoteInput) {
    return computeQuote(input);
  }

  /** Verify a sealed document: SHA-512 match + OpenTimestamps anchor (spec §6.4). */
  verifySeal(input: {
    sealId?: string;
    sha512?: string;
    pdfBase64?: string;
  }): Promise<SealVerification> {
    return verifySeal(this.config, input);
  }

  getConfig(): FirewallConfig {
    return this.config;
  }

  getCredits() {
    return this.credits.load();
  }

  listAgents() {
    return this.agents.list().map((a) => ({
      agent_id: a.agent_id,
      name: a.name,
      mission: a.scope.mission,
      constraints: a.constraints,
    }));
  }

  /** Ingest a single transaction into the monitoring buffer. */
  ingest(txn: Transaction): void {
    this.buffer.push(txn);
    // Keep a rolling window for velocity analysis
    if (this.buffer.length > 5000) this.buffer.splice(0, this.buffer.length - 5000);
  }

  ingestMany(txns: Transaction[]): void {
    for (const t of txns) this.ingest(t);
  }

  /**
   * Full fraud detection pipeline:
   * rules → Gemma4 → Mistral agents → triple verification → seal → notify
   */
  async monitor(transactions?: Transaction[]): Promise<MonitorResult> {
    const txns = transactions ?? [...this.buffer];
    if (transactions) this.ingestMany(transactions);

    if (txns.length === 0) {
      return { alert: null, signals: [], message: "No transactions to monitor" };
    }

    const ruleResult = this.rules.evaluate(txns);
    const modelCtxBase = {
      transactions: txns,
      signals: ruleResult.signals,
      anomaly_score: ruleResult.anomaly_score,
      institution: this.config.institution.name,
      jurisdiction: this.config.institution.jurisdiction,
    };

    const gemmaSignals = this.gemma4.analyze(modelCtxBase);
    const agentSignals = await this.agents.deployAll();
    const allSignals = [
      ...ruleResult.signals,
      ...gemmaSignals,
      ...agentSignals,
    ];

    if (allSignals.length === 0) {
      return {
        alert: null,
        signals: [],
        message: "No fraud signals detected",
      };
    }

    const proposed = selectPrimarySignals(allSignals);
    const ctx = {
      ...modelCtxBase,
      signals: allSignals,
      anomaly_score: Math.max(
        ruleResult.anomaly_score,
        ...allSignals.map((s) => s.score),
      ),
    };

    const verification = this.consensus.verify(ctx, proposed);
    const now = new Date();
    this.alertSeq += 1;
    this.caseSeq += 1;
    const alertId = makeAlertId(now, this.alertSeq);
    const caseRef = makeCaseReference(now, this.caseSeq);
    const primary = proposed[0];
    const fraudAmount = sumRelatedAmount(txns, proposed);
    const confidence = maxConfidence(proposed);

    const auditTrail = [
      {
        model: "Mistral Agent",
        action: "DETECTED",
        timestamp: now.toISOString(),
        detail: agentSignals[0]?.reasons[0],
      },
      {
        model: "Gemma 4",
        action: "PATTERN_ANALYSIS",
        timestamp: now.toISOString(),
        detail: gemmaSignals[0]?.reasons[0],
      },
      {
        model: "Gemma 3",
        action: verification.votes.gemma3.vote === "CONCURS" ? "VERIFIED" : "REVIEW",
        timestamp: now.toISOString(),
        detail: verification.votes.gemma3.rationale,
      },
      {
        model: "Phi-3",
        action: verification.votes.phi3.vote === "CONCURS" ? "VERIFIED" : "REVIEW",
        timestamp: now.toISOString(),
        detail: verification.votes.phi3.rationale,
      },
      {
        model: "9-Brain",
        action:
          verification.votes.nine_brain.vote === "CONCURS" ? "VERIFIED" : "REVIEW",
        timestamp: now.toISOString(),
        detail: verification.votes.nine_brain.rationale,
      },
    ];

    let alert: FraudAlert = {
      alert_id: alertId,
      institution: this.config.institution.name,
      case_reference: caseRef,
      fraud_type: primary.fraud_type,
      fraud_amount: fraudAmount,
      currency: txns[0]?.currency ?? "ZAR",
      commission_20pct: Math.round(fraudAmount * 0.2 * 100) / 100,
      status: verification.status === "CONFIRMED" ? "CONFIRMED" : verification.status === "HUMAN_REVIEW" ? "HUMAN_REVIEW" : "REJECTED",
      confidence,
      detection_method: primary.source,
      verification: {
        gemma3: verification.votes.gemma3.vote,
        phi3: verification.votes.phi3.vote,
        nine_brain: verification.votes.nine_brain.vote,
        quorum: verification.quorum,
      },
      ai_audit_trail: auditTrail,
      evidence_summary: this.gemma3.writeForensicReport(ctx, proposed),
      contradictions: allSignals
        .filter((s) => s.source === "NineBrain")
        .flatMap((s) => s.reasons),
      timestamp: now.toISOString(),
    };

    if (verification.status !== "CONFIRMED") {
      writeJson(alertPath(this.config, alertId), alert);
      return {
        alert,
        signals: allSignals,
        human_review: verification.status === "HUMAN_REVIEW",
        message: verification.summary,
      };
    }

    // Confirmed → seal evidence (bank-side) + commission invoice (Verum-only)
    const laws = this.phi3.applicableLaws(
      alert.fraud_type,
      this.config.institution.jurisdiction,
    );
    const timeline = buildTimelineFromTransactions(txns);
    const offence = offenceFromFraud({
      fraudType: alert.fraud_type,
      legalBasis: laws,
      anchors: [...new Set(proposed.flatMap((p) => p.related_txn_ids))].slice(0, 12),
      severity: alert.confidence === "VERY_HIGH" ? "CRITICAL" : "HIGH",
      confidence: alert.confidence,
      caseReference: caseRef,
    });
    const bankRetains = Math.round((alert.fraud_amount - alert.commission_20pct) * 100) / 100;
    const reportBody = [
      alert.evidence_summary,
      "",
      "CHRONOLOGY OF EVENTS:",
      ...timeline.map((e) => `- ${e.date} — ${e.description}`),
      "",
      "APPLICABLE LAW:",
      ...laws.map((l) => `- ${l}`),
      "",
      "OFFENCE MATRIX:",
      `${offence.offence_id} ${offence.title} — severity=${offence.severity} confidence=${offence.confidence}`,
      `  Legal basis: ${offence.legal_basis.join("; ")}`,
      `  Evidence anchors: ${offence.evidence_anchors.join(", ") || "n/a"}`,
      "",
      "FINANCIAL ANALYSIS:",
      `- Fraud amount: ${alert.currency} ${alert.fraud_amount}`,
      `- Verum Omnis commission (20%): ${alert.currency} ${alert.commission_20pct}`,
      `- Institution retains (80%): ${alert.currency} ${bankRetains}`,
      `- Transactions in scope: ${txns.length}`,
      "",
      "TRIPLE-AI VERIFICATION:",
      `- Gemma3: ${verification.votes.gemma3.vote}`,
      `- Phi3: ${verification.votes.phi3.vote}`,
      `- 9-Brain: ${verification.votes.nine_brain.vote}`,
      `- Quorum: ${verification.quorum}`,
      "",
      "COURT-READY DECLARATION:",
      "Prepared under Constitution v5.2.7 with Triple-AI verification. Every finding is anchored",
      "to sealed evidence with SHA-512 hashes. Ordinal confidence only; contradictions disclosed.",
    ].join("\n");

    const sealed = await this.sealing.seal({
      documentReference: `VO-FW-${caseRef}`,
      title: `Fraud Detection Report — ${caseRef}`,
      bodyText: reportBody,
      evidencePayload: {
        alert_id: alertId,
        fraud_type: alert.fraud_type,
        related_signals: proposed,
        // Full txn detail stays in bank vault only
        transactions: txns,
      },
      createdAt: now.toISOString(),
      report: {
        subject: this.config.institution.name,
        subtitle: `${alert.fraud_type} — Guardian Fraud Firewall Investigation`,
        caseReference: caseRef,
        jurisdiction: this.config.institution.jurisdiction,
      },
    });

    const invoice = generateCommissionInvoice({
      config: this.config,
      institution: alert.institution,
      caseReference: caseRef,
      fraudAmount: alert.fraud_amount,
      currency: alert.currency,
      seal: sealed.seal,
      generatedAt: now.toISOString(),
    });

    const pdfPath = sealedPath(this.config, sealed.seal.seal_id);
    const verumEmail = this.notifications.buildVerumCommissionEmail(invoice);
    const bankEmail = this.notifications.buildBankEvidenceEmail({
      alert,
      seal: sealed.seal,
      sealedPdfPath: pdfPath,
    });
    const verumQueued = await this.notifications.dispatch(verumEmail);
    const bankQueued = await this.notifications.dispatch(bankEmail);

    alert = {
      ...alert,
      seal: sealed.seal,
      notifications: {
        verum_invoice_sent: true,
        bank_report_sent: true,
        timestamp: now.toISOString(),
      },
    };

    writeJson(alertPath(this.config, alertId), alert);
    writeJson(invoicePath(this.config, invoice.invoice_id), invoice);

    return {
      alert,
      signals: allSignals,
      invoice_path: invoicePath(this.config, invoice.invoice_id),
      bank_email_path: bankQueued.queued_path,
      verum_email_path: verumQueued.queued_path,
      sealed_pdf_path: pdfPath,
      message: sealed.lowBalanceWarning
        ? "Fraud confirmed, sealed, and notified. WARNING: seal credits running low."
        : "Fraud confirmed, sealed, and notified. Verum received commission invoice only.",
    };
  }

  /** Seal an arbitrary bank document using the credit system. */
  async sealDocument(input: {
    documentReference: string;
    title: string;
    bodyText: string;
  }) {
    return this.sealing.seal(input);
  }

  addSealCredits(amount: number, paymentRef: string, costZar?: number) {
    return this.credits.addCredits(amount, paymentRef, costZar);
  }
}

function selectPrimarySignals(signals: DetectionSignal[]): DetectionSignal[] {
  const ranked = [...signals].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top) return [];
  // Keep top signal + same-type corroborating signals
  return ranked.filter(
    (s) => s.fraud_type === top.fraud_type || s.score >= top.score * 0.9,
  ).slice(0, 5);
}

function sumRelatedAmount(
  txns: Transaction[],
  signals: DetectionSignal[],
): number {
  const ids = new Set(signals.flatMap((s) => s.related_txn_ids));
  const related = txns.filter((t) => ids.has(t.txn_id));
  const pool = related.length ? related : txns;
  return Math.round(pool.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
}

function maxConfidence(signals: DetectionSignal[]): Confidence {
  const order: Confidence[] = [
    "INSUFFICIENT",
    "LOW",
    "MODERATE",
    "HIGH",
    "VERY_HIGH",
  ];
  let best: Confidence = "INSUFFICIENT";
  for (const s of signals) {
    if (order.indexOf(s.confidence) > order.indexOf(best)) best = s.confidence;
  }
  return best;
}

export function demoTransactions(): Transaction[] {
  const base = new Date("2026-07-06T14:30:00Z").getTime();
  const txns: Transaction[] = [];
  for (let i = 0; i < 25; i++) {
    txns.push({
      txn_id: `TXN-20260706-${884300 + i}`,
      account_id: "AC-7843",
      amount: i === 20 ? 1500000 : 12000 + i * 500,
      currency: "ZAR",
      timestamp: new Date(base + i * 2000).toISOString(),
      country: i === 22 ? "KP" : "ZA",
      channel: "EFT",
      counterparty: `CP-${(i % 9) + 1}`,
      metadata: i === 21 ? { internal_note: "urgent override" } : undefined,
    });
  }
  return txns;
}

export type { FraudType };
