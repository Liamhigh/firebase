import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { loadConfig } from "../src/core/config.js";
import { NotificationService } from "../src/notifications/email.js";
import type { FirewallConfig } from "../src/core/types.js";

const require = createRequire(import.meta.url);
const { SMTPServer } = require("smtp-server") as typeof import("smtp-server");

interface Captured {
  from: string;
  to: string[];
  raw: string;
}

let server: import("smtp-server").SMTPServer;
let port = 0;
const inbox: Captured[] = [];

function baseConfig(root: string): FirewallConfig {
  const base = loadConfig(join(process.cwd(), "config/firewall.json"));
  return {
    ...base,
    ots: { mode: "mock" },
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

before(async () => {
  server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (c: Buffer) => (raw += c.toString("utf8")));
      stream.on("end", () => {
        inbox.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
          to: session.envelope.rcptTo.map((r) => r.address),
          raw,
        });
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("SMTP delivery", () => {
  it("sends a bank evidence email WITH its sealed-PDF attachment", async () => {
    const root = mkdtempSync(join(tmpdir(), "vo-smtp-"));
    const config = baseConfig(root);
    config.email = { from: "firewall@bank.local", smtp: { host: "127.0.0.1", port, secure: false } };

    const pdfPath = join(root, "sealed-evidence.pdf");
    writeFileSync(pdfPath, "%PDF-1.7 fake sealed evidence\n");

    const svc = new NotificationService(config);
    const result = await svc.dispatch({
      to: "fraud@bank.local",
      subject: "[FRAUD-DETECTED] CASE-2026-0001 -- Sealed Evidence Report",
      body: "Sealed forensic evidence report attached.",
      attachments: [{ filename: "sealed-evidence.pdf", path: pdfPath }],
      recipient_role: "bank",
    });

    assert.equal(result.delivered, true);
    assert.equal(result.transport, "smtp");
    const msg = inbox.find((m) => m.to.includes("fraud@bank.local"));
    assert.ok(msg, "bank message received");
    assert.match(msg!.raw, /Content-Disposition: attachment/i);
    assert.match(msg!.raw, /sealed-evidence\.pdf/);
    rmSync(root, { recursive: true, force: true });
  });

  it("sends a Verum commission email with NO attachment (privacy)", async () => {
    const root = mkdtempSync(join(tmpdir(), "vo-smtp-"));
    const config = baseConfig(root);
    config.email = { from: "firewall@bank.local", smtp: { host: "127.0.0.1", port, secure: false } };

    const svc = new NotificationService(config);
    const result = await svc.dispatch({
      to: "admin@verumglobal.foundation",
      subject: "[FRAUD-COMMISSION] Demo Bank -- CASE-2026-0001 -- ZAR300000",
      body: "Commission invoice only. No evidence.",
      attachments: [],
      recipient_role: "verum",
    });

    assert.equal(result.delivered, true);
    const msg = inbox.find((m) => m.to.includes("admin@verumglobal.foundation"));
    assert.ok(msg, "verum message received");
    assert.doesNotMatch(msg!.raw, /Content-Disposition: attachment/i);
    rmSync(root, { recursive: true, force: true });
  });

  it("falls back to a queued JSON audit record when SMTP is not configured", async () => {
    const root = mkdtempSync(join(tmpdir(), "vo-smtp-"));
    const config = baseConfig(root); // no email/smtp
    const svc = new NotificationService(config);
    const result = await svc.dispatch({
      to: "fraud@bank.local",
      subject: "queued only",
      body: "no smtp configured",
      attachments: [],
      recipient_role: "bank",
    });
    assert.equal(result.delivered, false);
    assert.equal(result.transport, "queued");
    assert.ok(result.queued_path.endsWith(".json"));
    rmSync(root, { recursive: true, force: true });
  });
});
