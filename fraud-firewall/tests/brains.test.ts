import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import type { Contradiction, FirewallConfig, ForensicDocument } from "../src/core/types.js";
import { EvidenceExtractor } from "../src/forensics/extractor.js";
import { runBrainAnalysis, computeConsensus } from "../src/forensics/brains.js";
import { ForensicEngine, demoDocuments } from "../src/forensics/engine.js";
import { BrainFindingSchema } from "../src/core/types.js";

const NOW = "2026-07-06T14:32:15.000Z";

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-brains-"));
  const base = loadConfig(join(process.cwd(), "config/firewall.json"));
  return {
    ...base,
    ots: { mode: "mock" },
    storage: {
      vault_dir: root,
      ledger_file: join(root, "l.json"),
      audit_log: join(root, "a.jsonl"),
      alerts_dir: join(root, "alerts"),
      invoices_dir: join(root, "inv"),
      sealed_dir: join(root, "sealed"),
      findings_dir: join(root, "findings"),
      evidence_dir: join(root, "evidence"),
    },
  };
}

function atomsFrom(text: string) {
  const doc: ForensicDocument = {
    evidence_id: "DOCX",
    type: "document",
    source_file: "x.txt",
    pages: [{ page: 1, text }],
  };
  return new EvidenceExtractor().extract(doc, { now: NOW });
}

describe("Nine-Brain detectors (B2/B3/B4)", () => {
  it("B4 Linguistics flags gaslighting/evasion", () => {
    const f = runBrainAnalysis(atomsFrom("You are overreacting and imagining things. That never happened."), NOW);
    assert.ok(f.some((x) => x.brain_source === "B4-Linguistics"));
    for (const x of f) assert.doesNotThrow(() => BrainFindingSchema.parse(x));
  });

  it("B3 Communications flags deletions/gaps", () => {
    const f = runBrainAnalysis(atomsFrom("The earlier message was deleted and is no longer available."), NOW);
    assert.ok(f.some((x) => x.brain_source === "B3-Communications"));
  });

  it("B2 Document Forensics flags tamper indicators", () => {
    const f = runBrainAnalysis(atomsFrom("The screenshot was cropped selectively and metadata stripped."), NOW);
    assert.ok(f.some((x) => x.brain_source === "B2-DocumentForensics"));
  });

  it("does not flag benign text", () => {
    assert.equal(runBrainAnalysis(atomsFrom("The invoice was paid on time and delivered."), NOW).length, 0);
  });
});

describe("Nine-Brain consensus (>=3 brains)", () => {
  const c = (brain: Contradiction["brain_source"]): Contradiction => ({
    contradiction_id: `C-${brain}`,
    brain_source: brain,
    claim_a: { text: "a", source: "s", evidence_id: "D", page: 1, line: 1, sha512: "a" },
    claim_b: { text: "b", source: "s", evidence_id: "D", page: 1, line: 2, sha512: "b" },
    severity: "HIGH",
    applicable_law: [],
    confidence: "HIGH",
    resolution_status: "CONFIRMED",
    triple_ai_consensus: { gemma3: "CONCURS", phi3: "CONCURS", nine_brain: "CONCURS", quorum: true },
    timestamp: NOW,
  });

  it("CONFIRMED when >=3 distinct brains are active", () => {
    const r = computeConsensus([c("B1-ContradictionBrain"), c("B5-Timeline"), c("B6-Financial")], [], []);
    assert.equal(r.count, 3);
    assert.equal(r.meets_threshold, true);
    assert.equal(r.verdict, "CONFIRMED");
  });

  it("INSUFFICIENT with fewer than 3 brains", () => {
    assert.equal(computeConsensus([c("B1-ContradictionBrain")], [], []).verdict, "INSUFFICIENT");
  });

  it("INDETERMINATE with no findings", () => {
    assert.equal(computeConsensus([], [], []).verdict, "INDETERMINATE");
  });
});

describe("extraction findings include brains + consensus", () => {
  it("writes brain_findings.json and a consensus verdict", async () => {
    const config = isolatedConfig();
    const engine = new ForensicEngine(config);
    const result = await engine.extract({ documents: demoDocuments(), now: NOW });
    assert.ok(Array.isArray(result.findings.brain_findings));
    assert.ok(result.findings.consensus.count >= 3); // B1 + B5 + B6 from demo
    assert.equal(result.findings.consensus.verdict, "CONFIRMED");
    assert.ok(existsSync(join(config.storage.findings_dir!, "brain_findings.json")));
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});
