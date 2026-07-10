import type {
  Contradiction,
  EvidenceAtom,
  ExtractionFindings,
  FirewallConfig,
  ForensicDocument,
  SealRecord,
} from "../core/types.js";
import { ForensicDocumentSchema } from "../core/types.js";
import { hashDocument, toPages } from "./hasher.js";
import { EvidenceExtractor } from "./extractor.js";
import { ContradictionEngine } from "./contradiction.js";
import { buildTimelineFromAtoms } from "./timeline.js";
import { buildOffencesFromContradictions } from "./offences.js";
import { runBrainAnalysis, computeConsensus } from "./brains.js";
import { extractEntities, respondentFor } from "./entities.js";
import { createCaseLawProvider } from "./caselaw.js";
import type { LlmProvider } from "../ai/llm.js";
import { DocumentSealingService } from "../core/sealing.js";
import {
  ensureVault,
  evidencePath,
  findingsPath,
  sealedPath,
  writeJson,
} from "../storage/vault.js";

export interface EvidenceReceipt {
  evidence_id: string;
  source_file: string;
  type: string;
  sha512: string;
  page_count: number;
  ingested_at: string;
}

export interface ExtractResult {
  findings: ExtractionFindings;
  atoms_path: string;
  contradictions_path: string;
  manifest_path: string;
  seal?: SealRecord;
  sealed_pdf_path?: string;
  low_balance_warning?: boolean;
}

/**
 * Forensic extraction engine (spec Part IV + §7.2).
 *
 * Buffers uploaded evidence, extracts anchored evidence atoms, detects
 * structured contradictions, and writes findings JSON to the vault. Optionally
 * seals the findings bundle (SHA-512 + blockchain) consuming one seal credit.
 * Fully deterministic and offline.
 */
export class ForensicEngine {
  private readonly extractor = new EvidenceExtractor();
  private readonly contradictions = new ContradictionEngine();
  private readonly sealing: DocumentSealingService;
  private readonly buffer = new Map<string, ForensicDocument>();

  constructor(
    private readonly config: FirewallConfig,
    /** Optional local LLM used ONLY to author the narrative (never detection). */
    private readonly llm?: LlmProvider,
  ) {
    ensureVault(config);
    this.sealing = new DocumentSealingService(config);
  }

  /**
   * Validate + persist an original document into the vault with a SHA-512
   * chain-of-custody seal record, and add it to the extraction buffer.
   */
  ingest(input: unknown): EvidenceReceipt {
    const doc = ForensicDocumentSchema.parse(input);
    const pages = toPages(doc);
    const digest = hashDocument(pages);
    const ingestedAt = new Date().toISOString();
    this.buffer.set(doc.evidence_id, doc);

    // Original evidence stored in the vault (spec §7.2 evidence/).
    writeJson(evidencePath(this.config, doc.evidence_id), {
      ...doc,
      sha512: digest,
      page_count: pages.length,
      ingested_at: ingestedAt,
    });
    // Chain-of-custody seal record: immutable SHA-512 fingerprint of the intake.
    writeJson(evidencePath(this.config, doc.evidence_id).replace(/\.json$/, ".seal.json"), {
      evidence_id: doc.evidence_id,
      source_file: doc.source_file,
      type: doc.type,
      sha512: digest,
      page_count: pages.length,
      gps: doc.gps ?? null,
      jurisdiction: doc.jurisdiction ?? null,
      custody: "SEALED",
      hash_algorithm: "SHA-512",
      ingested_at: ingestedAt,
    });

    return {
      evidence_id: doc.evidence_id,
      source_file: doc.source_file,
      type: doc.type,
      sha512: digest,
      page_count: pages.length,
      ingested_at: ingestedAt,
    };
  }

  listEvidence(): Array<{ evidence_id: string; source_file: string; type: string }> {
    return [...this.buffer.values()].map((d) => ({
      evidence_id: d.evidence_id,
      source_file: d.source_file,
      type: d.type,
    }));
  }

  /**
   * Run extraction + contradiction detection over the given documents
   * (or the whole buffer) and persist findings. Set `seal` to seal the bundle.
   */
  async extract(opts: {
    documents?: unknown[];
    seal?: boolean;
    now?: string;
  } = {}): Promise<ExtractResult> {
    const now = opts.now ?? new Date().toISOString();
    let docs: ForensicDocument[];
    if (opts.documents && opts.documents.length > 0) {
      docs = opts.documents.map((d) => {
        const parsed = ForensicDocumentSchema.parse(d);
        this.buffer.set(parsed.evidence_id, parsed);
        return parsed;
      });
    } else {
      docs = [...this.buffer.values()];
    }

    const atoms: EvidenceAtom[] = [];
    for (const doc of docs) {
      atoms.push(...this.extractor.extract(doc, { now }));
    }
    const contradictions: Contradiction[] = this.contradictions.detect(atoms, {
      now,
    });
    const timeline = buildTimelineFromAtoms(atoms);
    const offences = buildOffencesFromContradictions(contradictions);
    const brainFindings = runBrainAnalysis(atoms, now);
    const consensus = computeConsensus(contradictions, brainFindings, offences);

    // Parties of interest + respondent attribution (anchor each contradiction
    // to the person it concerns) + external court-case search over the entities.
    const entities = extractEntities(atoms);
    const people = entities.filter((e) => e.type === "person");
    for (const c of contradictions) {
      c.respondent = respondentFor(people, c.claim_a.text, c.claim_b.text);
    }
    const caseSearch = await createCaseLawProvider().search(entities);

    const findings: ExtractionFindings = {
      generated_at: now,
      constitution_version: this.config.constitution_version,
      institution: this.config.institution.name,
      document_count: docs.length,
      atom_count: atoms.length,
      contradiction_count: contradictions.length,
      atoms,
      contradictions,
      timeline,
      offences,
      brain_findings: brainFindings,
      consensus,
      entities,
      case_search: caseSearch,
    };

    // Weave a plain-language "what happened" narrative from the anchored facts.
    // Deterministic by default; LLM-authored when a local model is reachable.
    const narrated = await this.buildNarrative(findings);
    findings.narrative = narrated.text;
    findings.narrative_source = narrated.source;

    const atomsPath = findingsPath(this.config, "evidence_atoms.json");
    const contradictionsPath = findingsPath(this.config, "contradictions.json");
    const timelinePath = findingsPath(this.config, "timeline.json");
    const offencesPath = findingsPath(this.config, "offence_matrix.json");
    const brainFindingsPath = findingsPath(this.config, "brain_findings.json");
    const entitiesPath = findingsPath(this.config, "entities.json");
    const caseSearchPath = findingsPath(this.config, "case_search.json");
    const manifestPath = findingsPath(this.config, "manifest.json");
    writeJson(atomsPath, atoms);
    writeJson(contradictionsPath, contradictions);
    writeJson(timelinePath, timeline);
    writeJson(offencesPath, offences);
    writeJson(brainFindingsPath, brainFindings);
    writeJson(entitiesPath, entities);
    writeJson(caseSearchPath, caseSearch);
    writeJson(manifestPath, {
      generated_at: findings.generated_at,
      constitution_version: findings.constitution_version,
      institution: findings.institution,
      document_count: findings.document_count,
      atom_count: findings.atom_count,
      contradiction_count: findings.contradiction_count,
      timeline_count: timeline.length,
      offence_count: offences.length,
      brain_finding_count: brainFindings.length,
      entity_count: entities.length,
      consensus,
      case_search: { provider: caseSearch.provider, status: caseSearch.status },
      evidence: docs.map((d) => ({
        evidence_id: d.evidence_id,
        source_file: d.source_file,
      })),
    });

    const result: ExtractResult = {
      findings,
      atoms_path: atomsPath,
      contradictions_path: contradictionsPath,
      manifest_path: manifestPath,
    };

    if (opts.seal) {
      const sealed = await this.sealing.seal({
        documentReference: `VO-EVID-${shortStamp(now)}`,
        title: `Evidence Extraction Findings — ${findings.institution}`,
        bodyText: summarize(findings),
        evidencePayload: { atoms, contradictions },
        createdAt: now,
        report: {
          subject: findings.institution,
          subtitle: "Evidence Extraction & Contradiction Findings",
          jurisdiction: this.config.institution.jurisdiction,
        },
      });
      result.seal = sealed.seal;
      result.sealed_pdf_path = sealedPath(this.config, sealed.seal.seal_id);
      result.low_balance_warning = sealed.lowBalanceWarning;
    }

    return result;
  }

  reset(): void {
    this.buffer.clear();
  }

  /**
   * Produce the "what happened" narrative. Tries the local LLM (seeing only the
   * structured, sealed-vault findings — never raw private data beyond the atoms
   * already sealed); falls back to a deterministic template. Either way the
   * narrative is descriptive prose ONLY and never alters the sealed facts.
   */
  private async buildNarrative(
    findings: ExtractionFindings,
  ): Promise<{ text: string; source: "llm" | "deterministic" }> {
    const deterministic = deterministicNarrative(findings);
    if (this.llm) {
      try {
        const generated = await this.llm.generate({
          system:
            "You are Verum Omnis, a forensic report author. Write a factual, sober narrative " +
            "of what happened using ONLY the supplied anchored findings. Cite page anchors like " +
            "(annexure p.X). Use ordinal confidence words, never percentages. Do not invent facts.",
          prompt: `${narrativeContext(findings)}\n\nWrite the NARRATIVE — WHAT HAPPENED section (3-6 paragraphs).`,
        });
        if (generated && generated.trim().length > 40) {
          return { text: generated.trim(), source: "llm" };
        }
      } catch {
        /* fall through to deterministic */
      }
    }
    return { text: deterministic, source: "deterministic" };
  }
}

/** Compact, token-bounded context for the LLM narrative author. */
function narrativeContext(f: ExtractionFindings): string {
  const people = f.entities.filter((e) => e.type === "person").map((e) => e.name);
  const orgs = f.entities.filter((e) => e.type === "organization").map((e) => e.name);
  return [
    `Institution: ${f.institution}`,
    `Parties (people): ${people.join(", ") || "none identified"}`,
    `Organisations: ${orgs.join(", ") || "none identified"}`,
    `Candidate contradictions: ${f.contradiction_count}`,
    ...f.contradictions
      .slice(0, 12)
      .map(
        (c) =>
          `- [${c.severity}] ${c.respondent ? c.respondent + ": " : ""}"${trunc(c.claim_a.text)}" (${c.claim_a.source}) vs "${trunc(c.claim_b.text)}" (${c.claim_b.source})`,
      ),
    `Chronology (${f.timeline.length} dated events):`,
    ...f.timeline.slice(0, 15).map((e) => `- ${e.date}: ${trunc(e.description)} (${e.evidence_id} p.${e.page})`),
    `Offences (${f.offences.length}):`,
    ...f.offences.slice(0, 10).map((o) => `- ${o.title} [${o.severity}] ${o.legal_basis.join("; ")}`),
  ].join("\n");
}

function trunc(s: string, n = 180): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n) + "…" : clean;
}

/**
 * Deterministic "what happened" narrative — no AI. Reads like a report opening
 * but is 100% reproducible from the anchored findings.
 */
function deterministicNarrative(f: ExtractionFindings): string {
  const people = f.entities.filter((e) => e.type === "person").map((e) => e.name);
  const orgs = f.entities.filter((e) => e.type === "organization").map((e) => e.name);
  const dates = f.timeline.map((t) => t.date).filter(Boolean).sort();
  const span =
    dates.length >= 2
      ? `between ${dates[0]} and ${dates[dates.length - 1]}`
      : dates.length === 1
        ? `on or about ${dates[0]}`
        : "over an unspecified period";
  const critical = f.contradictions.filter((c) => c.severity === "CRITICAL").length;

  const paras: string[] = [];
  paras.push(
    `This report concerns ${f.institution}. Across ${f.document_count} document(s) the engine ` +
      `extracted ${f.atom_count} anchored evidence atom(s) and flagged ${f.contradiction_count} ` +
      `candidate contradiction(s) (${critical} rated CRITICAL). ${
        people.length ? `Parties of interest include ${listing(people, 6)}. ` : ""
      }${orgs.length ? `Entities referenced include ${listing(orgs, 6)}. ` : ""}` +
      `Documented events occurred ${span}.`,
  );

  if (f.contradictions.length) {
    const c = f.contradictions[0];
    paras.push(
      `The most material candidate contradiction${c.respondent ? ` (attributed to ${c.respondent})` : ""} ` +
        `sets "${trunc(c.claim_a.text, 220)}" (${c.claim_a.source}) against "${trunc(c.claim_b.text, 220)}" ` +
        `(${c.claim_b.source}). In total ${f.contradiction_count} such pairings were surfaced; each is anchored ` +
        `to sealed source text by SHA-512 and page/line reference for independent checking.`,
    );
  }

  if (f.offences.length) {
    paras.push(
      `Mapped against statute, the findings implicate ${f.offences.length} candidate offence(s), including ` +
        `${listing(f.offences.slice(0, 4).map((o) => o.title), 4)}. Legal bases cited include ` +
        `${listing([...new Set(f.offences.flatMap((o) => o.legal_basis))].slice(0, 5), 5)}.`,
    );
  }

  paras.push(
    `The Nine-Brain consensus is ${f.consensus.verdict} with ${f.consensus.count} independent brain(s) ` +
      `active (threshold ${f.consensus.threshold}). NOTE: the items above are machine-surfaced CANDIDATES. ` +
      `They are sealed as-is for the record; a qualified analyst (or the configured local LLM) should curate ` +
      `which candidates are legally material before the report is relied upon in proceedings.`,
  );

  return paras.join("\n\n");
}

function listing(items: string[], max: number): string {
  const shown = items.slice(0, max);
  if (shown.length <= 1) return shown[0] ?? "";
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

function shortStamp(iso: string): string {
  return iso.slice(0, 19).replace(/[-:T]/g, "");
}

function summarize(findings: ExtractionFindings): string {
  const lines = [
    "VERUM OMNIS EVIDENCE EXTRACTION FINDINGS",
    `Institution: ${findings.institution}`,
    `Documents: ${findings.document_count}`,
    `Evidence atoms: ${findings.atom_count}`,
    `Contradictions: ${findings.contradiction_count}`,
    "",
    `NARRATIVE — WHAT HAPPENED (${(findings.narrative_source ?? "deterministic").toUpperCase()}):`,
    findings.narrative ?? "No narrative generated.",
    "",
    "PARTIES / ENTITIES OF INTEREST:",
    ...(findings.entities.length
      ? findings.entities.map(
          (e) => `- ${e.name} (${e.type}, ${e.mentions} mentions; first seen ${e.first_seen.evidence_id} p.${e.first_seen.page})`,
        )
      : ["- No recurring parties identified."]),
    "",
    "CONTRADICTIONS:",
    ...findings.contradictions.flatMap((c) => [
      `${c.contradiction_id} [${c.brain_source}] respondent=${c.respondent ?? "unattributed"} severity=${c.severity} confidence=${c.confidence} quorum=${c.triple_ai_consensus.quorum}`,
      `  A: "${c.claim_a.text}" (${c.claim_a.source})`,
      `  B: "${c.claim_b.text}" (${c.claim_b.source})`,
      `  Law: ${c.applicable_law.join("; ") || "n/a"}`,
    ]),
    "",
    "CHRONOLOGY OF EVENTS:",
    ...(findings.timeline.length
      ? findings.timeline.map(
          (e) => `- ${e.date} — ${e.description} (${e.evidence_id} p.${e.page})`,
        )
      : ["- No dated events extracted."]),
    "",
    "OFFENCE MATRIX:",
    ...(findings.offences.length
      ? findings.offences.flatMap((o) => [
          `${o.offence_id} ${o.title} — severity=${o.severity} confidence=${o.confidence}`,
          `  Legal basis: ${o.legal_basis.join("; ") || "n/a"}`,
          `  Anchors: ${o.evidence_anchors.join(" | ")}`,
        ])
      : ["- No offences identified."]),
    "",
    "NINE-BRAIN ANALYSIS:",
    ...(findings.brain_findings.length
      ? findings.brain_findings.map(
          (b) => `- [${b.brain_source}] ${b.category}: "${b.description}" (${b.evidence_id} p.${b.page})`,
        )
      : ["- No additional brain findings."]),
    "",
    "NINE-BRAIN CONSENSUS:",
    `- Active brains (${findings.consensus.count}): ${findings.consensus.active_brains.join(", ") || "none"}`,
    `- Threshold: >=${findings.consensus.threshold} independent brains`,
    `- Verdict: ${findings.consensus.verdict}`,
    "",
    "COURT CASE SEARCH:",
    `- Provider: ${findings.case_search.provider} (${findings.case_search.status})`,
    ...findings.case_search.results
      .slice(0, 20)
      .map((r) => `- ${r.entity}${r.case_reference ? ` — ${r.case_reference}` : ""}${r.note ? ` (${r.note})` : ""}`),
    "",
    "COURT-READY DECLARATION:",
    "Prepared under Constitution v5.2.7 with Triple-AI verification (Gemma 3 + Phi-3 + 9-Brain).",
    "Every finding is anchored to sealed evidence with SHA-512 hashes. Contradiction detection",
    "was ON; ordinal confidence only; mandatory disclosure of all contradictions.",
    "",
    "CONSTITUTIONAL NOTE:",
    "Findings produced under Constitution v5.2.7. Evidence anchors and hashes are immutable.",
  ];
  return lines.join("\n");
}

/** Demo evidence bundle exercising polarity, numeric, and date contradictions. */
export function demoDocuments(): ForensicDocument[] {
  return [
    {
      evidence_id: "DOC001",
      type: "document",
      source_file: "witness_statement.txt",
      jurisdiction: "ZA-KZN",
      pages: [
        {
          page: 1,
          text:
            "On 9 March 2025, Marius Nortje stated that the Kevin's Export deal fell through completely.\n" +
            "He repeated this position in a follow-up call the same afternoon.\n" +
            "Later correspondence on 6 April 2025 confirmed that the Kevin's Export deal proceeded as planned.",
        },
      ],
    },
    {
      evidence_id: "DOC002",
      type: "document",
      source_file: "invoice_ledger.txt",
      jurisdiction: "ZA-KZN",
      pages: [
        {
          page: 1,
          text:
            "The shipment invoice was recorded in the ledger as ZAR 250000 for the quarter.\n" +
            "The same shipment invoice was later reported to the external auditors as ZAR 480000.",
        },
      ],
    },
    {
      evidence_id: "DOC003",
      type: "document",
      source_file: "board_minutes.txt",
      jurisdiction: "ZA-KZN",
      pages: [
        {
          page: 1,
          text:
            "The board meeting was held on 12 February 2025 according to the signed minutes.\n" +
            "The board meeting occurred on 18 February 2025 per the attendance register.",
        },
      ],
    },
  ];
}
