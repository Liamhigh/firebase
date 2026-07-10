import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import {
  DeterministicProvider,
  OllamaProvider,
  createLlmProvider,
} from "../src/ai/llm.js";
import { loadConfig } from "../src/core/config.js";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { FraudFirewall } from "../src/pipeline/firewall.js";
import type { FirewallConfig } from "../src/core/types.js";

let server: Server;
let baseUrl = "";

// Minimal Ollama-compatible mock: /api/tags (health) and /api/generate.
before(async () => {
  server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/api/tags") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ models: [{ name: "phi3" }] }));
      return;
    }
    if (req.method === "POST" && req.url === "/api/generate") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            model: parsed.model,
            response: `LLM summary for: ${String(parsed.prompt).slice(0, 40)}`,
            done: true,
          }),
        );
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      baseUrl = typeof addr === "object" && addr ? `http://127.0.0.1:${addr.port}` : "";
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("LLM adapter", () => {
  it("deterministic provider is never available and returns null", async () => {
    const p = new DeterministicProvider();
    assert.equal(await p.available(), false);
    assert.equal(await p.generate({ prompt: "hi" }), null);
  });

  it("ollama provider generates against a running endpoint", async () => {
    const p = new OllamaProvider(baseUrl, "phi3", 5000);
    assert.equal(await p.available(), true);
    const out = await p.generate({ system: "sys", prompt: "summarise fraud" });
    assert.ok(out && out.startsWith("LLM summary for: summarise fraud"));
  });

  it("ollama provider returns null on connection failure (fallback)", async () => {
    const p = new OllamaProvider("http://127.0.0.1:1", "phi3", 2000);
    assert.equal(await p.available(), false);
    assert.equal(await p.generate({ prompt: "x" }), null);
  });

  it("factory picks deterministic by default, ollama when configured", () => {
    const base = loadConfig(join(process.cwd(), "config/firewall.json"));
    assert.equal(createLlmProvider(base).name, "deterministic");
    const external = {
      ...base,
      ai: {
        ...base.ai,
        mode: "external" as const,
        llm: { provider: "ollama" as const, base_url: baseUrl, model: "phi3" },
      },
    };
    assert.equal(createLlmProvider(external).name, "ollama");
  });

  it("aiNarrative uses the LLM when configured, deterministic otherwise", async () => {
    const root = mkdtempSync(join(tmpdir(), "vo-llm-"));
    const base = loadConfig(join(process.cwd(), "config/firewall.json"));
    const storage = {
      vault_dir: root,
      ledger_file: join(root, "l.json"),
      audit_log: join(root, "a.jsonl"),
      alerts_dir: join(root, "alerts"),
      invoices_dir: join(root, "inv"),
      sealed_dir: join(root, "sealed"),
    };
    const external: FirewallConfig = {
      ...base,
      ots: { mode: "mock" },
      storage,
      ai: {
        ...base.ai,
        mode: "external",
        llm: { provider: "ollama", base_url: baseUrl, model: "phi3" },
      },
    };
    const fwExternal = new FraudFirewall(external);
    const llmRes = await fwExternal.aiNarrative({ prompt: "test narrative" });
    assert.equal(llmRes.source, "llm");
    assert.ok(llmRes.summary.startsWith("LLM summary for:"));

    const deterministic: FirewallConfig = { ...base, ots: { mode: "mock" }, storage };
    const fwDet = new FraudFirewall(deterministic);
    const detRes = await fwDet.aiNarrative({ prompt: "test narrative" });
    assert.equal(detRes.source, "deterministic");

    rmSync(root, { recursive: true, force: true });
  });
});
