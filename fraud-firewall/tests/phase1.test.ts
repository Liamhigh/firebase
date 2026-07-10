import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import type { FirewallConfig } from "../src/core/types.js";
import { EvidenceExtractor } from "../src/forensics/extractor.js";
import { ContradictionEngine } from "../src/forensics/contradiction.js";
import {
  buildTimelineFromAtoms,
  buildTimelineFromTransactions,
  parseIsoDate,
} from "../src/forensics/timeline.js";
import { buildOffencesFromContradictions } from "../src/forensics/offences.js";
import { ForensicEngine, demoDocuments } from "../src/forensics/engine.js";
import { DocumentSealingService } from "../src/core/sealing.js";
import { verifySeal } from "../src/core/verification.js";
import { TimelineEventSchema, OffenceSchema } from "../src/core/types.js";

const NOW = "2026-07-06T14:32:15.000Z";

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-phase1-"));
  const base = loadConfig(join(process.cwd(), "config/firewall.json"));
  return {
    ...base,
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

describe("timeline reconstruction (spec §4.4)", () => {
  it("parses dates and orders events chronologically", () => {
    assert.equal(parseIsoDate("9 March 2025"), "2025-03-09");
    assert.equal(parseIsoDate("2025-04-06"), "2025-04-06");
    assert.equal(parseIsoDate("12/02/2025"), "2025-02-12");

    const atoms = new EvidenceExtractor().extract(
      {
        evidence_id: "DOC001",
        type: "document",
        source_file: "s.txt",
        pages: [
          {
            page: 1,
            text:
              "The order was confirmed on 6 April 2025 by the client.\n" +
              "The shipment left the depot on 9 March 2025 as recorded.",
          },
        ],
      },
      { now: NOW },
    );
    const timeline = buildTimelineFromAtoms(atoms);
    assert.equal(timeline.length, 2);
    for (const e of timeline) assert.doesNotThrow(() => TimelineEventSchema.parse(e));
    // Chronological: March before April.
    assert.equal(timeline[0].iso_date, "2025-03-09");
    assert.equal(timeline[1].iso_date, "2025-04-06");
  });

  it("builds a timeline from transactions", () => {
    const tl = buildTimelineFromTransactions([
      { txn_id: "T1", account_id: "A", amount: 100, currency: "ZAR", timestamp: "2026-01-02T00:00:00Z" },
      { txn_id: "T2", account_id: "A", amount: 200, currency: "ZAR", timestamp: "2026-01-01T00:00:00Z" },
    ]);
    assert.equal(tl[0].evidence_id, "T2"); // earlier timestamp first
    assert.equal(tl.length, 2);
  });
});

describe("offence matrix (spec §5.3)", () => {
  it("maps contradictions to anchored offences", () => {
    const atoms = new EvidenceExtractor().extract(
      {
        evidence_id: "DOC001",
        type: "document",
        source_file: "s.txt",
        jurisdiction: "ZA",
        pages: [
          {
            page: 1,
            text:
              "The Kevin Export deal fell through completely.\n" +
              "The Kevin Export deal proceeded as planned.",
          },
        ],
      },
      { now: NOW },
    );
    const contradictions = new ContradictionEngine().detect(atoms, { now: NOW });
    const offences = buildOffencesFromContradictions(contradictions);
    assert.equal(offences.length, contradictions.length);
    assert.ok(offences.length >= 1);
    const o = offences[0];
    assert.doesNotThrow(() => OffenceSchema.parse(o));
    assert.ok(o.offence_id.startsWith("OFF-"));
    assert.ok(o.evidence_anchors.length === 2);
  });
});

describe("extraction findings include timeline + offences", () => {
  it("writes timeline.json and offence_matrix.json", async () => {
    const config = isolatedConfig();
    const engine = new ForensicEngine(config);
    const result = await engine.extract({ documents: demoDocuments(), now: NOW });
    assert.ok(result.findings.timeline.length > 0);
    assert.equal(result.findings.offences.length, result.findings.contradiction_count);
    assert.ok(existsSync(join(config.storage.findings_dir!, "timeline.json")));
    assert.ok(existsSync(join(config.storage.findings_dir!, "offence_matrix.json")));
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});

describe("verify-by-hash (seal id resolved from the file)", () => {
  it("verifies an uploaded PDF using only its SHA-512", async () => {
    const config = isolatedConfig();
    const sealed = await new DocumentSealingService(config).seal({
      documentReference: "VO-TEST-1",
      title: "Test",
      bodyText: "A finding.",
      createdAt: NOW,
    });
    // No sealId supplied — resolved from the document hash pointer.
    const v = verifySeal(config, { sha512: sealed.seal.sha512, now: NOW });
    assert.equal(v.seal_id, sealed.seal.seal_id);
    assert.equal(v.integrity, true);
    assert.equal(v.result, "SEAL_FOUND_PENDING_CHAIN");

    // Unknown hash -> NOT_FOUND.
    const miss = verifySeal(config, { sha512: "f".repeat(128), now: NOW });
    assert.equal(miss.result, "NOT_FOUND");
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});
