import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import type { FirewallConfig, ForensicDocument } from "../src/core/types.js";
import {
  EvidenceAtomSchema,
  ContradictionSchema,
} from "../src/core/types.js";
import { EvidenceExtractor } from "../src/forensics/extractor.js";
import { ContradictionEngine } from "../src/forensics/contradiction.js";
import { ForensicEngine, demoDocuments } from "../src/forensics/engine.js";
import {
  hashContent,
  indexLines,
  lineRangeFor,
  makeAtomId,
} from "../src/forensics/hasher.js";

const FIXED_NOW = "2026-07-06T14:32:15.000Z";

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-forensic-"));
  const base = loadConfig(join(process.cwd(), "config/firewall.json"));
  return {
    ...base,
    ots: { mode: "mock" },
    seal_credits: { initial_balance: 100, low_balance_threshold: 5 },
    storage: {
      vault_dir: root,
      ledger_file: join(root, "ledger.json"),
      audit_log: join(root, "audit.jsonl"),
      alerts_dir: join(root, "alerts"),
      invoices_dir: join(root, "invoices"),
      sealed_dir: join(root, "sealed"),
      evidence_dir: join(root, "evidence"),
      findings_dir: join(root, "findings"),
    },
  };
}

describe("hasher / anchoring", () => {
  it("computes deterministic SHA-512 (128 hex chars)", () => {
    const h = hashContent("hello world");
    assert.equal(h.length, 128);
    assert.equal(h, hashContent("hello world"));
    assert.notEqual(h, hashContent("hello world!"));
  });

  it("maps char offsets to 1-based line ranges", () => {
    const text = "line one here\nline two here\nline three here";
    const lines = indexLines(text);
    const start = text.indexOf("two");
    const { range } = lineRangeFor(lines, start, start + 3);
    assert.equal(range, "2");
  });

  it("derives stable atom ids from content", () => {
    const hash = hashContent("some claim");
    assert.equal(makeAtomId("DOC1", 1, hash), makeAtomId("DOC1", 1, hash));
    assert.ok(makeAtomId("DOC1", 1, hash).startsWith("EA-"));
  });
});

describe("evidence extractor (spec §12.1)", () => {
  const doc: ForensicDocument = {
    evidence_id: "DOC001",
    type: "document",
    source_file: "witness_statement.txt",
    jurisdiction: "ZA-KZN",
    pages: [
      {
        page: 1,
        text:
          "On 9 March 2025, Marius Nortje stated that the Kevin's Export deal fell through completely.\n" +
          "Later correspondence on 6 April 2025 confirmed that the Kevin's Export deal proceeded as planned.",
      },
    ],
  };

  it("produces anchored, schema-valid, deterministic atoms", () => {
    const extractor = new EvidenceExtractor();
    const a = extractor.extract(doc, { now: FIXED_NOW });
    const b = extractor.extract(doc, { now: FIXED_NOW });
    assert.equal(a.length, 2);
    assert.deepEqual(a, b, "extraction must be deterministic");

    for (const atom of a) {
      assert.doesNotThrow(() => EvidenceAtomSchema.parse(atom));
      assert.equal(atom.sha512.length, 128);
      assert.equal(atom.page_number, 1);
      assert.equal(atom.evidence_id, "DOC001");
      assert.equal(atom.triple_ai_consensus.quorum, true);
    }
    // Second sentence begins on line 2.
    assert.equal(a[1].line_range, "2");
  });
});

describe("contradiction engine (spec §12.2)", () => {
  const extractor = new EvidenceExtractor();
  const contradictions = new ContradictionEngine();

  function detect(doc: ForensicDocument) {
    return contradictions.detect(extractor.extract(doc, { now: FIXED_NOW }), {
      now: FIXED_NOW,
    });
  }

  it("flags a polarity contradiction as CRITICAL (B1)", () => {
    const found = detect({
      evidence_id: "DOC001",
      type: "document",
      source_file: "witness_statement.txt",
      jurisdiction: "ZA-KZN",
      pages: [
        {
          page: 1,
          text:
            "The Kevin's Export deal fell through completely.\n" +
            "The Kevin's Export deal proceeded as planned.",
        },
      ],
    });
    assert.equal(found.length, 1);
    const c = found[0];
    assert.doesNotThrow(() => ContradictionSchema.parse(c));
    assert.equal(c.brain_source, "B1-ContradictionBrain");
    assert.equal(c.severity, "CRITICAL");
    assert.equal(c.triple_ai_consensus.quorum, true);
    assert.equal(c.resolution_status, "CONFIRMED");
    assert.ok(c.claim_a.sha512 && c.claim_b.sha512);
  });

  it("flags a numeric contradiction as HIGH (B6)", () => {
    const found = detect({
      evidence_id: "DOC002",
      type: "document",
      source_file: "invoice_ledger.txt",
      jurisdiction: "ZA-KZN",
      pages: [
        {
          page: 1,
          text:
            "The shipment invoice was recorded in the ledger as ZAR 250000.\n" +
            "The shipment invoice was reported to auditors as ZAR 480000.",
        },
      ],
    });
    assert.equal(found.length, 1);
    assert.equal(found[0].brain_source, "B6-Financial");
    assert.equal(found[0].severity, "HIGH");
  });

  it("flags a date contradiction as MODERATE (B5)", () => {
    const found = detect({
      evidence_id: "DOC003",
      type: "document",
      source_file: "board_minutes.txt",
      jurisdiction: "ZA-KZN",
      pages: [
        {
          page: 1,
          text:
            "The board meeting was held on 12 February 2025 per the minutes.\n" +
            "The board meeting occurred on 18 February 2025 per the register.",
        },
      ],
    });
    assert.equal(found.length, 1);
    assert.equal(found[0].brain_source, "B5-Timeline");
    assert.equal(found[0].severity, "MODERATE");
  });

  it("does not flag consistent statements", () => {
    const found = detect({
      evidence_id: "DOC004",
      type: "document",
      source_file: "clean.txt",
      pages: [
        {
          page: 1,
          text:
            "The delivery driver arrived at the depot on time.\n" +
            "The weather that morning was clear and calm.",
        },
      ],
    });
    assert.equal(found.length, 0);
  });
});

describe("forensic engine orchestration", () => {
  it("extracts demo docs, writes findings, and optionally seals", async () => {
    const config = isolatedConfig();
    const engine = new ForensicEngine(config);
    const result = await engine.extract({
      documents: demoDocuments(),
      seal: true,
      now: FIXED_NOW,
    });

    assert.equal(result.findings.document_count, 3);
    assert.equal(result.findings.contradiction_count, 3);
    const brains = result.findings.contradictions.map((c) => c.brain_source).sort();
    assert.deepEqual(brains, [
      "B1-ContradictionBrain",
      "B5-Timeline",
      "B6-Financial",
    ]);

    assert.ok(existsSync(result.atoms_path));
    assert.ok(existsSync(result.contradictions_path));
    assert.ok(existsSync(result.manifest_path));
    assert.ok(result.seal?.seal_id.startsWith("seal-"));
    assert.ok(result.sealed_pdf_path && existsSync(result.sealed_pdf_path));

    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("registers ingested evidence with a document fingerprint", () => {
    const config = isolatedConfig();
    const engine = new ForensicEngine(config);
    const receipt = engine.ingest({
      evidence_id: "DOCX",
      source_file: "note.txt",
      text: "A short note for the record.",
    });
    assert.equal(receipt.evidence_id, "DOCX");
    assert.equal(receipt.sha512.length, 128);
    assert.equal(engine.listEvidence().length, 1);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});
