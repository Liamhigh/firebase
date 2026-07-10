import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import type { FirewallConfig } from "../src/core/types.js";
import { DocumentSealingService } from "../src/core/sealing.js";
import { verifySeal, OTS_CONFIRM_WINDOW_MS } from "../src/core/verification.js";
import { sha512 } from "../src/core/crypto.js";
import { sealedPath } from "../src/storage/vault.js";

const CREATED = "2026-07-06T14:30:00.000Z";

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-seal-"));
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

async function sealOne(config: FirewallConfig) {
  const svc = new DocumentSealingService(config);
  return svc.seal({
    documentReference: "VO-TEST-0001",
    title: "Test Forensic Report",
    bodyText: "SECTION ONE\nThe first material finding.\nSECTION TWO\nThe second finding.",
    report: { subject: "Test Institution", jurisdiction: "ZA" },
    createdAt: CREATED,
  });
}

describe("sealing produces a watermarked, anchored forensic PDF", () => {
  it("computes SHA-512 last, writes an OTS proof, and records PENDING", async () => {
    const config = isolatedConfig();
    const sealed = await sealOne(config);

    // SHA-512 of the final PDF equals the recorded document hash (hash last).
    const fileHash = sha512(Buffer.from(sealed.pdfBytes));
    assert.equal(sealed.seal.sha512.length, 128);
    assert.equal(sealed.seal.sha512, fileHash);
    assert.equal(sealed.seal.document_sha512, fileHash);
    assert.ok(sealed.seal.verify_url?.includes(sealed.seal.seal_id));
    assert.equal(sealed.seal.blockchain?.status, "PENDING");

    const otsPath = sealedPath(config, sealed.seal.seal_id).replace(/\.pdf$/, ".ots");
    assert.ok(existsSync(otsPath), "OTS proof written");
    const ots = JSON.parse(readFileSync(otsPath, "utf8"));
    assert.equal(ots.file_sha512, fileHash);

    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("embeds evidence + verum metadata as PDF/A-3B attachments", async () => {
    const config = isolatedConfig();
    const svc = new DocumentSealingService(config);
    const sealed = await svc.seal({
      documentReference: "VO-TEST-EMB",
      title: "Embedded Test",
      bodyText: "Body.",
      evidencePayload: { atoms: 3, contradictions: 1 },
      report: { subject: "Test Co" },
      createdAt: CREATED,
    });
    assert.ok(sealed.seal.embedded_files?.includes("verum-metadata.json"));
    assert.ok(sealed.seal.embedded_files?.includes("evidence.json"));
    // Mock OTS mode does not embed a live proof.
    assert.equal(sealed.seal.ots_embedded, false);
    // The XMP metadata stream (uncompressed) declares the PDF/A-3B target.
    const pdf = Buffer.from(sealed.pdfBytes).toString("latin1");
    assert.match(pdf, /pdfaid:part/);
    assert.match(pdf, /pdfaid:conformance/);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});

describe("seal verification (spec §6.4)", () => {
  it("matches SHA-512 but reports PENDING immediately after sealing", async () => {
    const config = isolatedConfig();
    const sealed = await sealOne(config);
    const v = await verifySeal(config, {
      sealId: sealed.seal.seal_id,
      sha512: sealed.seal.sha512,
      now: CREATED,
    });
    assert.equal(v.result, "SEAL_FOUND_PENDING_CHAIN");
    assert.equal(v.integrity, true);
    assert.equal(v.blockchain?.status, "PENDING");
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("reports VERIFIED once the OTS confirmation window has passed", async () => {
    const config = isolatedConfig();
    const sealed = await sealOne(config);
    const later = new Date(new Date(CREATED).getTime() + OTS_CONFIRM_WINDOW_MS + 1000).toISOString();
    const v = await verifySeal(config, {
      sealId: sealed.seal.seal_id,
      sha512: sealed.seal.sha512,
      now: later,
    });
    assert.equal(v.result, "VERIFIED");
    assert.equal(v.integrity, true);
    assert.equal(v.blockchain?.status, "CONFIRMED");
    assert.ok((v.blockchain?.block_height ?? 0) > 0);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("flags a tampered document", async () => {
    const config = isolatedConfig();
    const sealed = await sealOne(config);
    const v = await verifySeal(config, {
      sealId: sealed.seal.seal_id,
      sha512: "0".repeat(128),
      now: CREATED,
    });
    assert.equal(v.result, "TAMPERED");
    assert.equal(v.integrity, false);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("re-hashes the stored PDF when no hash is supplied", async () => {
    const config = isolatedConfig();
    const sealed = await sealOne(config);
    const v = await verifySeal(config, { sealId: sealed.seal.seal_id, now: CREATED });
    assert.equal(v.integrity, true);
    assert.equal(v.computed_sha512, sealed.seal.sha512);
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("returns NOT_FOUND for an unknown seal", async () => {
    const config = isolatedConfig();
    const v = await verifySeal(config, { sealId: "seal-does-not-exist" });
    assert.equal(v.result, "NOT_FOUND");
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });
});
