import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/core/config.js";
import { FraudFirewall } from "../src/pipeline/firewall.js";
import { startServer } from "../src/api/server.js";
import type { FirewallConfig } from "../src/core/types.js";

const ALLOWED_ORIGIN = "https://verumglobal.foundation";
const DISALLOWED_ORIGIN = "https://evil.example";

function isolatedConfig(port: number, corsOrigins: string[]): FirewallConfig {
  const root = mkdtempSync(join(tmpdir(), "vo-fw-cors-"));
  const base = loadConfig(join(process.cwd(), "config/firewall.json"));
  return {
    ...base,
    storage: {
      vault_dir: root,
      ledger_file: join(root, "ledger.json"),
      audit_log: join(root, "audit.jsonl"),
      alerts_dir: join(root, "alerts"),
      invoices_dir: join(root, "invoices"),
      sealed_dir: join(root, "sealed"),
    },
    server: { host: "127.0.0.1", port, cors_allowed_origins: corsOrigins },
  };
}

describe("API CORS handling", () => {
  const config = isolatedConfig(18789, [ALLOWED_ORIGIN]);
  const server = startServer(new FraudFirewall(config));

  after(async () => {
    await server.close();
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("answers preflight OPTIONS for an allowed origin", async () => {
    const res = await fetch(`${server.url}/v1/monitor`, {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);
    assert.match(
      res.headers.get("access-control-allow-methods") ?? "",
      /POST/,
    );
    assert.equal(
      res.headers.get("access-control-allow-headers"),
      "content-type",
    );
    await res.text();
  });

  it("reflects the allowed origin on normal API responses", async () => {
    const res = await fetch(`${server.url}/health`, {
      headers: { Origin: ALLOWED_ORIGIN },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);
    assert.equal(res.headers.get("vary"), "Origin");
    const body = (await res.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  });

  it("omits CORS headers for a disallowed origin", async () => {
    const res = await fetch(`${server.url}/health`, {
      headers: { Origin: DISALLOWED_ORIGIN },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    await res.text();
  });

  it("rejects preflight OPTIONS from a disallowed origin", async () => {
    const res = await fetch(`${server.url}/v1/monitor`, {
      method: "OPTIONS",
      headers: {
        Origin: DISALLOWED_ORIGIN,
        "Access-Control-Request-Method": "POST",
      },
    });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    await res.text();
  });

  it("handles same-origin requests without CORS headers", async () => {
    const res = await fetch(`${server.url}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    await res.text();
  });
});

describe("API CORS wildcard mode", () => {
  const config = isolatedConfig(18790, ["*"]);
  const server = startServer(new FraudFirewall(config));

  after(async () => {
    await server.close();
    rmSync(config.storage.vault_dir, { recursive: true, force: true });
  });

  it("allows any origin when configured with *", async () => {
    const res = await fetch(`${server.url}/health`, {
      headers: { Origin: DISALLOWED_ORIGIN },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    await res.text();
  });

  it("answers wildcard preflight", async () => {
    const res = await fetch(`${server.url}/v1/seal`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.example",
        "Access-Control-Request-Method": "POST",
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    await res.text();
  });
});
