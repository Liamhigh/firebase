import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import { DocumentSealingService } from "../src/core/sealing.js";
import {
  offlineOtsSubmitter,
  liveOtsSubmitter,
  resolveOtsSubmitter,
  otsDigest,
  type OtsSubmitter,
} from "../src/core/ots.js";
import type { FirewallConfig } from "../src/core/types.js";

function isolatedConfig(): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-ots-"));
  const base = loadConfig(join(process.cwd(), "config/firewall.json"));
  return {
    ...base,
    seal_credits: { initial_balance: 10, low_balance_threshold: 2 },
    storage: {
      vault_dir: root,
      ledger_file: join(root, "ledger.json"),
      audit_log: join(root, "audit.jsonl"),
      alerts_dir: join(root, "alerts"),
      invoices_dir: join(root, "invoices"),
      sealed_dir: join(root, "sealed"),
    },
  };
}

/** Expected digest: SHA-256 over the raw bytes of the hex SHA-512 string. */
function expectedDigest(sha512Hex: string): string {
  return createHash("sha256").update(sha512Hex, "utf8").digest("hex");
}

describe("OpenTimestamps submission — honest anchor statuses", () => {
  const savedMode = process.env.VO_OTS_MODE;
  after(() => {
    if (savedMode === undefined) delete process.env.VO_OTS_MODE;
    else process.env.VO_OTS_MODE = savedMode;
  });

  it("offline default yields PENDING_OFFLINE with no fabricated height or receipt", async () => {
    delete process.env.VO_OTS_MODE;
    const config = isolatedConfig();
    const sealing = new DocumentSealingService(config);
    const { seal } = await sealing.seal({
      documentReference: "DOC-OTS-1",
      title: "Offline seal",
      bodyText: "Sealed while offline.",
    });

    assert.equal(seal.blockchain?.provider, "OpenTimestamps");
    assert.equal(seal.blockchain?.status, "PENDING_OFFLINE");
    assert.equal(seal.blockchain?.block_height, undefined);
    assert.equal(seal.blockchain?.confirmations, undefined);
    assert.equal(seal.blockchain?.ots_receipt, undefined);
    assert.equal(seal.blockchain?.ots_digest, expectedDigest(seal.sha512));
    assert.match(seal.blockchain?.ots_note ?? "", /offline/i);

    // The persisted sidecar JSON carries the same honest record.
    const sidecar = join(config.storage.sealed_dir, `${seal.seal_id}.json`);
    assert.ok(existsSync(sidecar));
    const persisted = readFileSync(sidecar, "utf8");
    assert.match(persisted, /PENDING_OFFLINE/);
    assert.doesNotMatch(persisted, /mock/i);
    assert.doesNotMatch(JSON.stringify(seal), /mock/i);

    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("accepted calendar submission yields PENDING with attestation and no block height", async () => {
    const fakeCalendar: OtsSubmitter = async (sha512Hex) => ({
      status: "PENDING",
      digest: otsDigest(sha512Hex).toString("hex"),
      attestations: [
        {
          calendar: "https://alice.btc.calendar.opentimestamps.org",
          receipt_b64: Buffer.from("fake-attestation").toString("base64"),
        },
      ],
      note: "submitted to 1/2 OpenTimestamps calendars; awaiting Bitcoin confirmation",
    });
    const config = isolatedConfig();
    const sealing = new DocumentSealingService(config, fakeCalendar);
    const { seal } = await sealing.seal({
      documentReference: "DOC-OTS-2",
      title: "Pending seal",
      bodyText: "Sealed with a calendar attestation.",
    });

    assert.equal(seal.blockchain?.status, "PENDING");
    assert.equal(
      seal.blockchain?.ots_receipt,
      Buffer.from("fake-attestation").toString("base64"),
    );
    assert.equal(seal.blockchain?.block_height, undefined);
    assert.equal(seal.blockchain?.confirmations, undefined);
    assert.equal(seal.blockchain?.ots_digest, expectedDigest(seal.sha512));
    assert.match(seal.blockchain?.ots_note ?? "", /awaiting Bitcoin confirmation/);
    assert.doesNotMatch(JSON.stringify(seal), /mock/i);

    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("resolveOtsSubmitter defaults to offline and only VO_OTS_MODE=live goes live", () => {
    delete process.env.VO_OTS_MODE;
    assert.equal(resolveOtsSubmitter(), offlineOtsSubmitter);
    process.env.VO_OTS_MODE = "offline";
    assert.equal(resolveOtsSubmitter(), offlineOtsSubmitter);
    process.env.VO_OTS_MODE = "live";
    assert.equal(resolveOtsSubmitter(), liveOtsSubmitter);
    delete process.env.VO_OTS_MODE;
    const custom: OtsSubmitter = offlineOtsSubmitter;
    assert.equal(resolveOtsSubmitter(custom), custom);
  });

  it("digest convention matches the web sealer (SHA-256 of hex-string bytes)", () => {
    const sha512Hex = "a".repeat(128);
    assert.equal(otsDigest(sha512Hex).toString("hex"), expectedDigest(sha512Hex));
    assert.equal(otsDigest(sha512Hex).length, 32);
  });
});
