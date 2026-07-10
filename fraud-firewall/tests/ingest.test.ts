import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import type { FirewallConfig } from "../src/core/types.js";
import { parseUpload, evidenceIdFromFilename } from "../src/forensics/ingest.js";
import { DocumentSealingService } from "../src/core/sealing.js";

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-ingest-"));
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
    },
  };
}

describe("evidence file ingestion", () => {
  it("derives a safe evidence id from a filename", () => {
    assert.equal(evidenceIdFromFilename("Greensky Report (1).PDF"), "Greensky-Report-1");
  });

  it("parses a UTF-8 text upload into pages (form-feed = page break)", async () => {
    const bytes = new TextEncoder().encode("Page one text.\fPage two text.");
    const doc = await parseUpload(bytes, "notes.txt");
    assert.equal(doc.evidence_id, "notes");
    assert.equal(doc.source_file, "notes.txt");
    assert.equal(doc.pages?.length, 2);
    assert.match(doc.pages![1].text, /Page two/);
  });

  it("extracts text from a real PDF upload", async () => {
    const config = isolatedConfig();
    const sealed = await new DocumentSealingService(config).seal({
      documentReference: "VO-INGEST",
      title: "Ingest Test Report",
      bodyText: "UNIQUE MARKER LINE for extraction.\nSecond line of the report body.",
      report: { subject: "Ingest Test Co" },
      createdAt: "2026-07-06T14:30:00.000Z",
    });
    const doc = await parseUpload(sealed.pdfBytes, "report.pdf");
    assert.equal(doc.type, "document");
    assert.ok((doc.pages?.length ?? 0) >= 1);
    const allText = (doc.pages ?? []).map((p) => p.text).join("\n");
    assert.match(allText, /UNIQUE MARKER LINE/);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});
