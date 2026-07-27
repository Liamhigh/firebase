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

  constructor(private readonly config: FirewallConfig) {
    ensureVault(config);
    this.sealing = new DocumentSealingService(config);
  }

  /** Validate + persist an original document; add it to the extraction buffer. */
  ingest(input: unknown): EvidenceReceipt {
    const doc = ForensicDocumentSchema.parse(input);
    const pages = toPages(doc);
    const digest = hashDocument(pages);
    const ingestedAt = new Date().toISOString();
    this.buffer.set(doc.evidence_id, doc);

    writeJson(evidencePath(this.config, doc.evidence_id), {
      ...doc,
      sha512: digest,
      page_count: pages.length,
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

    const findings: ExtractionFindings = {
      generated_at: now,
      constitution_version: this.config.constitution_version,
      institution: this.config.institution.name,
      document_count: docs.length,
      atom_count: atoms.length,
      contradiction_count: contradictions.length,
      atoms,
      contradictions,
    };

    const atomsPath = findingsPath(this.config, "evidence_atoms.json");
    const contradictionsPath = findingsPath(this.config, "contradictions.json");
    const manifestPath = findingsPath(this.config, "manifest.json");
    writeJson(atomsPath, atoms);
    writeJson(contradictionsPath, contradictions);
    writeJson(manifestPath, {
      generated_at: findings.generated_at,
      constitution_version: findings.constitution_version,
      institution: findings.institution,
      document_count: findings.document_count,
      atom_count: findings.atom_count,
      contradiction_count: findings.contradiction_count,
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
    "CONTRADICTIONS:",
    ...findings.contradictions.flatMap((c) => [
      `${c.contradiction_id} [${c.brain_source}] severity=${c.severity} confidence=${c.confidence} quorum=${c.triple_ai_consensus.quorum}`,
      `  A: "${c.claim_a.text}" (${c.claim_a.source})`,
      `  B: "${c.claim_b.text}" (${c.claim_b.source})`,
      `  Law: ${c.applicable_law.join("; ") || "n/a"}`,
    ]),
    "",
    "CONSTITUTIONAL NOTE:",
    "Findings produced under Constitution v6.0.0. Evidence anchors and hashes are immutable.",
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
