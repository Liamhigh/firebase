import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import type { FraudFirewall } from "../pipeline/firewall.js";
import { TransactionSchema } from "../core/types.js";
import { z } from "zod";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function notFound(res: ServerResponse): void {
  sendJson(res, 404, { error: "Not found" });
}

export function startServer(firewall: FraudFirewall): {
  close: () => Promise<void>;
  url: string;
} {
  const config = firewall.getConfig();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const method = req.method ?? "GET";

      if (method === "GET" && url.pathname === "/health") {
        return sendJson(res, 200, {
          ok: true,
          service: "verum-omnis-fraud-firewall",
          constitution: config.constitution_version,
          institution: config.institution.name,
        });
      }

      if (method === "GET" && url.pathname === "/v1/credits") {
        return sendJson(res, 200, firewall.getCredits());
      }

      if (method === "GET" && url.pathname === "/v1/agents") {
        return sendJson(res, 200, { agents: firewall.listAgents() });
      }

      if (method === "POST" && url.pathname === "/v1/credits/purchase") {
        const body = JSON.parse(await readBody(req)) as {
          amount?: number;
          payment_ref?: string;
          cost_zar?: number;
        };
        if (!body.amount || !body.payment_ref) {
          return sendJson(res, 400, { error: "amount and payment_ref required" });
        }
        const ledger = firewall.addSealCredits(
          body.amount,
          body.payment_ref,
          body.cost_zar,
        );
        return sendJson(res, 200, ledger);
      }

      if (method === "POST" && url.pathname === "/v1/transactions") {
        const raw = JSON.parse(await readBody(req));
        const parsed = z.array(TransactionSchema).safeParse(
          Array.isArray(raw) ? raw : raw.transactions,
        );
        if (!parsed.success) {
          return sendJson(res, 400, { error: parsed.error.flatten() });
        }
        firewall.ingestMany(parsed.data);
        return sendJson(res, 202, {
          ingested: parsed.data.length,
          message: "Transactions buffered for monitoring",
        });
      }

      if (method === "POST" && url.pathname === "/v1/monitor") {
        const rawText = await readBody(req);
        let txns = undefined;
        if (rawText.trim()) {
          const raw = JSON.parse(rawText);
          const parsed = z.array(TransactionSchema).safeParse(
            Array.isArray(raw) ? raw : raw.transactions,
          );
          if (!parsed.success) {
            return sendJson(res, 400, { error: parsed.error.flatten() });
          }
          txns = parsed.data;
        }
        const result = await firewall.monitor(txns);
        return sendJson(res, 200, result);
      }

      if (method === "POST" && url.pathname === "/v1/seal") {
        const body = JSON.parse(await readBody(req)) as {
          document_reference?: string;
          title?: string;
          body_text?: string;
        };
        if (!body.document_reference || !body.title || !body.body_text) {
          return sendJson(res, 400, {
            error: "document_reference, title, body_text required",
          });
        }
        const sealed = await firewall.sealDocument({
          documentReference: body.document_reference,
          title: body.title,
          bodyText: body.body_text,
        });
        return sendJson(res, 200, {
          seal: sealed.seal,
          constitution_hash: sealed.constitutionEmbedded.hash,
          low_balance_warning: sealed.lowBalanceWarning,
        });
      }

      if (method === "GET" && url.pathname.startsWith("/v1/sealed/")) {
        const sealId = url.pathname.replace("/v1/sealed/", "");
        const path = `${config.storage.sealed_dir}/${sealId}.pdf`;
        if (!existsSync(path)) return notFound(res);
        const bytes = readFileSync(path);
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${sealId}.pdf"`,
        });
        return res.end(bytes);
      }

      return notFound(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("PRIVACY VIOLATION") ? 403 : 500;
      return sendJson(res, status, { error: message });
    }
  });

  server.listen(config.server.port, config.server.host);
  const url = `http://${config.server.host}:${config.server.port}`;
  console.log(`Verum Omnis Fraud Firewall listening on ${url}`);
  console.log(`Constitution v${config.constitution_version} · ${config.institution.name}`);

  return {
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
