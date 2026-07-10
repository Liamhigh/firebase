import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import type { FirewallConfig, ForensicDocument } from "../src/core/types.js";
import { EvidenceExtractor } from "../src/forensics/extractor.js";
import { extractEntities, respondentFor } from "../src/forensics/entities.js";
import { ForensicEngine } from "../src/forensics/engine.js";
import { evidencePath } from "../src/storage/vault.js";

const NOW = "2026-07-06T14:32:15.000Z";

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-ent-"));
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
      evidence_dir: join(root, "evidence"),
      findings_dir: join(root, "findings"),
    },
  };
}

const doc: ForensicDocument = {
  evidence_id: "DOC001",
  type: "document",
  source_file: "case.txt",
  jurisdiction: "UAE",
  pages: [
    {
      page: 1,
      text:
        "Marius Nortje told me the deal had fallen through completely.\n" +
        "Later Marius Nortje confirmed the deal had proceeded as planned.\n" +
        "Kevin Lappeman of Kevin's Export Co. denied any exclusivity agreement.\n" +
        "Kevin Lappeman was involved with Greensky Ornamentals FZ-LLC throughout.",
    },
  ],
};

describe("entity extraction + respondent attribution", () => {
  it("finds recurring people and organizations", () => {
    const atoms = new EvidenceExtractor().extract(doc, { now: NOW });
    const entities = extractEntities(atoms);
    const people = entities.filter((e) => e.type === "person").map((e) => e.name);
    const orgs = entities.filter((e) => e.type === "organization").map((e) => e.name);
    assert.ok(people.includes("Marius Nortje"));
    assert.ok(people.includes("Kevin Lappeman"));
    assert.ok(orgs.some((o) => /Export|Ornamentals/.test(o)));
  });

  it("attributes a contradiction to the right respondent", () => {
    const atoms = new EvidenceExtractor().extract(doc, { now: NOW });
    const people = extractEntities(atoms).filter((e) => e.type === "person");
    const r = respondentFor(
      people,
      "Marius Nortje told me the deal had fallen through completely.",
      "Later Marius Nortje confirmed the deal had proceeded as planned.",
    );
    assert.equal(r, "Marius Nortje");
  });
});

describe("uploaded evidence is sealed into the vault", () => {
  it("writes a SHA-512 chain-of-custody seal record on ingest", () => {
    const config = isolatedConfig();
    const engine = new ForensicEngine(config);
    const receipt = engine.ingest(doc);
    const sealPath = evidencePath(config, "DOC001").replace(/\.json$/, ".seal.json");
    assert.ok(existsSync(sealPath), "chain-of-custody seal record written");
    assert.equal(receipt.sha512.length, 128);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("extraction attributes respondents and lists parties", async () => {
    const config = isolatedConfig();
    const engine = new ForensicEngine(config);
    const result = await engine.extract({ documents: [doc], now: NOW });
    assert.ok(result.findings.entities.length >= 2);
    assert.ok(result.findings.contradictions.some((c) => c.respondent === "Marius Nortje"));
    assert.equal(result.findings.case_search.status, "OFFLINE");
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});
