import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import type { FirewallConfig, ForensicDocument } from "../src/core/types.js";
import { ForensicEngine, demoDocuments } from "../src/forensics/engine.js";
import { parseCandidates, duplicatesEngineFinding } from "../src/forensics/g3Review.js";
import { G3CandidateStore } from "../src/forensics/candidateStore.js";
import {
  STATUS_CANDIDATE_PROMOTED,
  STATUS_CANDIDATE_REJECTED,
  STATUS_G3_CANDIDATE,
  STATUS_ENGINE_VERIFIED,
} from "../src/pipeline/findingsJsonEmitter.js";
import type { LlamaLike, LlamaGenerateOptions } from "../src/ai/llamaClient.js";

const FIXED_NOW = "2026-07-06T14:32:15.000Z";
const roots: string[] = [];

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-g3-"));
  roots.push(root);
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

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

class StubLlama implements LlamaLike {
  readonly model = "gemma-3-4b-it (stub)";
  constructor(private readonly response: string | null) {}
  enabled(): boolean {
    return true;
  }
  async available(): Promise<boolean> {
    return true;
  }
  async generate(_prompt: string, _opts?: LlamaGenerateOptions): Promise<string | null> {
    return this.response;
  }
}

function candidateResponse(sourceFile: string): string {
  return [
    "Here is what the engine missed:",
    JSON.stringify([
      {
        type: "OMISSION",
        proposition_a_text: "A reply was promised within seven days",
        proposition_a_actor: "Institution",
        proposition_b_text: "No reply appears anywhere in the record",
        proposition_b_actor: "Sealed record",
        conflict_description: "Undertaking never honoured in the vault.",
        source_document: sourceFile,
        source_page: 1,
        severity: "HIGH",
        confidence: "MODERATE",
      },
    ]),
  ].join("\n");
}

describe("GHRP findings JSON contract emission", () => {
  it("extract() writes findings.json with engine-verified tier and counts", async () => {
    const engine = new ForensicEngine(isolatedConfig(), { llama: null });
    const result = await engine.extract({ documents: demoDocuments(), now: FIXED_NOW });

    assert.ok(result.findings_json);
    assert.equal(result.findings_json.findings_json_version, "1.0.0");
    assert.equal(result.g3_candidate_count, 0);
    assert.ok(result.findings_json.engine_verified_count > 0);
    assert.equal(
      result.findings_json.engine_verified_count,
      result.findings.contradiction_count,
    );
    for (const record of result.findings_json.contradictions) {
      assert.equal(record.verification_status, STATUS_ENGINE_VERIFIED);
      assert.ok(record.sha512_anchor && record.sha512_anchor.length === 128);
    }
  });
});

describe("G3 second-pass review", () => {
  it("raises anchored candidates from model output, merged into findings.json", async () => {
    const docs = demoDocuments();
    const engine = new ForensicEngine(isolatedConfig(), {
      llama: new StubLlama(candidateResponse(docs[0].source_file)),
    });
    const result = await engine.extract({ documents: docs, now: FIXED_NOW });

    assert.equal(result.g3_candidate_count, 1);
    const candidate = result.findings_json.contradictions.find(
      (c) => c.verification_status === STATUS_G3_CANDIDATE,
    );
    assert.ok(candidate);
    assert.equal(candidate.source_document, docs[0].source_file);
    // The anchor must be the engine's own digest of the document — 128 hex chars.
    assert.match(candidate.sha512_anchor ?? "", /^[0-9a-f]{128}$/);
    assert.match(candidate.extraction_method ?? "", /G3 vault review/);
    // Candidate tier never inflates the engine-verified count.
    assert.equal(
      result.findings_json.engine_verified_count,
      result.findings_json.contradictions.length - 1,
    );
  });

  it("discards candidates naming documents that were never ingested", async () => {
    const engine = new ForensicEngine(isolatedConfig(), {
      llama: new StubLlama(candidateResponse("never_ingested.txt")),
    });
    const result = await engine.extract({ documents: demoDocuments(), now: FIXED_NOW });
    assert.equal(result.g3_candidate_count, 0);
  });

  it("survives malformed model output", async () => {
    const engine = new ForensicEngine(isolatedConfig(), {
      llama: new StubLlama("no json here at all"),
    });
    const result = await engine.extract({ documents: demoDocuments(), now: FIXED_NOW });
    assert.equal(result.g3_candidate_count, 0);
  });

  it("parseCandidates extracts the first JSON array and skips bad elements", () => {
    const parsed = parseCandidates(
      'prose [ {"type":"T","proposition_a_text":"a","proposition_b_text":"b","source_document":"d.txt"}, {"bad":true} ] trailing',
    );
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].severity, "MODERATE");
  });

  it("dedupes candidates that restate engine findings", async () => {
    const docs = demoDocuments();
    const engineOnly = new ForensicEngine(isolatedConfig(), { llama: null });
    const baseline = await engineOnly.extract({ documents: docs, now: FIXED_NOW });
    const existing = baseline.findings.contradictions[0];
    assert.ok(existing);
    assert.equal(
      duplicatesEngineFinding(
        {
          proposition_a_text: existing.claim_a.text,
          proposition_b_text: existing.claim_b.text,
        },
        baseline.findings.contradictions,
      ),
      true,
    );
  });
});

describe("G3 candidate promotion feedback loop", () => {
  it("promote() persists status, emits an engine rule, and the engine re-detects", async () => {
    const config = isolatedConfig();
    const docs = demoDocuments();
    const engine = new ForensicEngine(config, {
      llama: new StubLlama(candidateResponse(docs[0].source_file)),
    });
    const first = await engine.extract({ documents: docs, now: FIXED_NOW });
    assert.equal(first.g3_candidate_count, 1);
    const candidateId = first.findings_json.contradictions.find(
      (c) => c.verification_status === STATUS_G3_CANDIDATE,
    )!.contradiction_id;

    const store = new G3CandidateStore(config);
    const promoted = store.promote(candidateId, "human_signoff", FIXED_NOW);
    assert.equal(promoted.verification_status, STATUS_CANDIDATE_PROMOTED);
    assert.equal(store.promotedPairs().length, 1);
    assert.equal(store.promotedPairs()[0].rule_id, `G3_${candidateId}`);

    // Engine re-run with a document containing both promoted phrases: the
    // deterministic engine itself now detects the contradiction.
    const reRunDoc: ForensicDocument = {
      evidence_id: "DOC100",
      type: "document",
      source_file: "follow_up.txt",
      jurisdiction: "ZA-KZN",
      pages: [
        {
          page: 1,
          text:
            "The institution confirmed a reply was promised within seven days of filing.\n" +
            "Careful search shows no reply appears anywhere in the record to date.",
        },
      ],
    };
    const engine2 = new ForensicEngine(config, { llama: null });
    const second = await engine2.extract({ documents: [reRunDoc], now: FIXED_NOW });
    const promotedHit = second.findings.contradictions.find((c) =>
      (c.legal_significance ?? "").includes(`Promoted G3 rule G3_${candidateId}`),
    );
    assert.ok(promotedHit, "engine should re-detect the promoted contradiction");
    assert.equal(promotedHit.brain_source, "B9-RnDValidation");
  });

  it("reject() requires a reason and seals it with the record", async () => {
    const config = isolatedConfig();
    const docs = demoDocuments();
    const engine = new ForensicEngine(config, {
      llama: new StubLlama(candidateResponse(docs[0].source_file)),
    });
    const result = await engine.extract({ documents: docs, now: FIXED_NOW });
    const candidateId = result.findings_json.contradictions.find(
      (c) => c.verification_status === STATUS_G3_CANDIDATE,
    )!.contradiction_id;

    const store = new G3CandidateStore(config);
    assert.throws(() => store.reject(candidateId, "  "));
    const rejected = store.reject(candidateId, "Restates a dismissed allegation", FIXED_NOW);
    assert.equal(rejected.verification_status, STATUS_CANDIDATE_REJECTED);
    assert.equal(rejected.rejection_reason, "Restates a dismissed allegation");
    // Never deleted.
    assert.equal(store.list().length, 1);
    // A rejected candidate cannot be promoted afterwards.
    assert.throws(() => store.promote(candidateId));
  });

  it("re-recording the same candidate id never resets a decided status", async () => {
    const config = isolatedConfig();
    const docs = demoDocuments();
    const makeEngine = () =>
      new ForensicEngine(config, {
        llama: new StubLlama(candidateResponse(docs[0].source_file)),
      });
    const first = await makeEngine().extract({ documents: docs, now: FIXED_NOW });
    const candidateId = first.findings_json.contradictions.find(
      (c) => c.verification_status === STATUS_G3_CANDIDATE,
    )!.contradiction_id;
    const store = new G3CandidateStore(config);
    store.promote(candidateId, "human_signoff", FIXED_NOW);

    // Same fixed timestamp → same candidate id raised again on re-scan.
    await makeEngine().extract({ documents: docs, now: FIXED_NOW });
    const again = store.list().find((c) => c.contradiction_id === candidateId);
    assert.equal(again?.verification_status, STATUS_CANDIDATE_PROMOTED);
  });
});
