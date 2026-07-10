import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { FraudFirewall } from "../pipeline/firewall.js";
import { TransactionSchema } from "../core/types.js";
import { findingsPath, readJson } from "../storage/vault.js";
import type { QuoteInput } from "../core/pricing.js";
import { parseUpload } from "../forensics/ingest.js";
import { z } from "zod";

const WEB_ROOT = resolve(
  fileURLToPath(new URL("../../web/", import.meta.url)),
);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

// Reject oversized bodies early to bound memory/CPU (DoS hardening).
const MAX_BODY_BYTES = 64 * 1024 * 1024; // 64 MB
const PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE";

// Strict identifier formats — seal IDs and SHA-512 hashes are the only values
// ever interpolated into vault file paths. Anything else is rejected so no
// path traversal (../, %2f, CR/LF) can reach the filesystem or headers.
const SEAL_ID_RE = /^seal-[a-f0-9]{24}$/;
const SHA512_RE = /^[a-f0-9]{128}$/;
export const isSealId = (s: string): boolean => SEAL_ID_RE.test(s);
export const isSha512 = (s: string): boolean => SHA512_RE.test(s);

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new Error(PAYLOAD_TOO_LARGE);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error(PAYLOAD_TOO_LARGE);
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

async function readBody(req: IncomingMessage): Promise<string> {
  return (await readRawBody(req)).toString("utf8");
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

function safeWebPath(urlPath: string): string | null {
  const cleaned = decodeURIComponent(urlPath.split("?")[0] || "/");
  const relative = cleaned === "/" ? "index.html" : cleaned.replace(/^\//, "");
  const candidate = normalize(join(WEB_ROOT, relative));
  if (!candidate.startsWith(WEB_ROOT + sep) && candidate !== WEB_ROOT) {
    return null;
  }
  return candidate;
}

function serveStatic(res: ServerResponse, urlPath: string): boolean {
  const filePath = safeWebPath(urlPath);
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false;
  }
  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const bytes = readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control":
      ext === ".html" || ext === ".js" || ext === ".css"
        ? "no-cache, no-store, must-revalidate"
        : "public, max-age=3600",
  });
  res.end(bytes);
  return true;
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

      if (method === "GET" && url.pathname === "/v1/pricing") {
        return sendJson(res, 200, firewall.getPricing());
      }

      if (method === "GET" && url.pathname === "/v1/constitution") {
        return sendJson(res, 200, firewall.getConstitution());
      }

      if (method === "GET" && url.pathname === "/v1/brains") {
        return sendJson(res, 200, firewall.getBrains());
      }

      if (method === "POST" && url.pathname === "/v1/constitution/check") {
        const body = JSON.parse(await readBody(req)) as {
          purpose?: string;
          bias_score?: number;
        };
        return sendJson(
          res,
          200,
          firewall.constitutionCheck({ purpose: body.purpose, biasScore: body.bias_score }),
        );
      }

      if (method === "POST" && url.pathname === "/v1/pricing/quote") {
        const body = JSON.parse(await readBody(req)) as {
          category?: string;
          user_type?: string;
          recovered_value?: number;
          annual_turnover?: number;
          commercial_value?: number;
          lawyer_fee?: number;
          jurisdiction?: string;
          complexity?: "simple" | "moderate" | "complex";
          entity_type?: "individual" | "sme" | "corporate" | "institution";
          currency?: string;
        };
        const validCategories = ["fraud_recovery", "legal_services", "ai_subscription", "commercial"];
        const validUsers = ["individual", "saps", "bank", "ai_company", "institution", "commercial"];
        if (!body.category || !validCategories.includes(body.category)) {
          return sendJson(res, 400, { error: `category must be one of ${validCategories.join(", ")}` });
        }
        if (!body.user_type || !validUsers.includes(body.user_type)) {
          return sendJson(res, 400, { error: `user_type must be one of ${validUsers.join(", ")}` });
        }
        const quote = firewall.quote({
          category: body.category as QuoteInput["category"],
          userType: body.user_type as QuoteInput["userType"],
          recoveredValue: body.recovered_value,
          annualTurnover: body.annual_turnover,
          commercialValue: body.commercial_value,
          lawyerFee: body.lawyer_fee,
          jurisdiction: body.jurisdiction,
          complexity: body.complexity,
          entityType: body.entity_type,
          currency: body.currency,
        });
        return sendJson(res, 200, quote);
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

      if (method === "GET" && url.pathname === "/v1/evidence") {
        return sendJson(res, 200, { evidence: firewall.listEvidence() });
      }

      if (method === "POST" && url.pathname === "/v1/evidence/reset") {
        firewall.resetEvidence();
        return sendJson(res, 200, { ok: true, message: "Buffered evidence cleared." });
      }

      if (method === "POST" && url.pathname === "/v1/evidence/upload") {
        const filename = url.searchParams.get("filename") || `upload-${Date.now()}.txt`;
        const lat = url.searchParams.get("lat");
        const lon = url.searchParams.get("lon");
        const gps =
          lat && lon
            ? {
                latitude: Number(lat),
                longitude: Number(lon),
                accuracy: url.searchParams.get("acc")
                  ? Number(url.searchParams.get("acc"))
                  : undefined,
                timestamp: new Date().toISOString(),
              }
            : undefined;
        const bytes = await readRawBody(req);
        if (bytes.length === 0) {
          return sendJson(res, 400, { error: "empty upload" });
        }
        try {
          const doc = await parseUpload(new Uint8Array(bytes), filename, gps);
          const receipt = firewall.ingestEvidence(doc);
          return sendJson(res, 202, {
            ...receipt,
            source_file: filename,
            message: "Evidence ingested. POST /v1/extract to analyse buffered evidence.",
          });
        } catch (err) {
          return sendJson(res, 400, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (method === "POST" && url.pathname === "/v1/evidence") {
        const raw = JSON.parse(await readBody(req));
        const docs = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.documents)
            ? raw.documents
            : [raw];
        try {
          const receipts = docs.map((d: unknown) => firewall.ingestEvidence(d));
          return sendJson(res, 202, {
            ingested: receipts.length,
            receipts,
          });
        } catch (err) {
          return sendJson(res, 400, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (method === "POST" && url.pathname === "/v1/extract") {
        const rawText = await readBody(req);
        let documents: unknown[] | undefined;
        let seal = false;
        if (rawText.trim()) {
          const raw = JSON.parse(rawText);
          if (Array.isArray(raw)) {
            documents = raw;
          } else {
            documents = Array.isArray(raw?.documents) ? raw.documents : undefined;
            seal = Boolean(raw?.seal);
          }
        }
        try {
          const result = await firewall.extractEvidence({ documents, seal });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (method === "POST" && url.pathname === "/v1/ai/summary") {
        const rawText = await readBody(req);
        let body: { prompt?: string; use_findings?: boolean } = {};
        if (rawText.trim()) body = JSON.parse(rawText);
        const result = await firewall.aiNarrative({
          prompt: body.prompt,
          useFindings: body.use_findings,
        });
        return sendJson(res, 200, result);
      }

      if (method === "POST" && url.pathname === "/v1/ai/chat") {
        const rawText = await readBody(req);
        let body: {
          message?: string;
          history?: Array<{ role: "user" | "assistant"; content: string }>;
        } = {};
        if (rawText.trim()) body = JSON.parse(rawText);
        if (!body.message || !body.message.trim()) {
          return sendJson(res, 400, { error: "message is required" });
        }
        const result = await firewall.chat({
          message: body.message,
          history: Array.isArray(body.history) ? body.history : undefined,
        });
        return sendJson(res, 200, result);
      }

      if (method === "GET" && url.pathname === "/v1/comms/ledger") {
        return sendJson(res, 200, firewall.commsLedger());
      }

      if (method === "GET" && url.pathname === "/v1/findings") {
        const atoms = readJson<unknown[]>(findingsPath(config, "evidence_atoms.json")) ?? [];
        const contradictions =
          readJson<unknown[]>(findingsPath(config, "contradictions.json")) ?? [];
        const manifest = readJson<unknown>(findingsPath(config, "manifest.json"));
        return sendJson(res, 200, { manifest, atoms, contradictions });
      }

      if (method === "POST" && url.pathname === "/v1/verify") {
        const body = JSON.parse(await readBody(req)) as {
          seal_id?: string;
          sha512?: string;
          pdf_base64?: string;
        };
        if (!body.seal_id && !body.sha512 && !body.pdf_base64) {
          return sendJson(res, 400, {
            error: "provide seal_id, sha512, or pdf_base64",
          });
        }
        // Reject anything that isn't a well-formed id/hash — these are the only
        // values used to build vault file paths (blocks traversal).
        if (body.seal_id && !isSealId(body.seal_id)) {
          return sendJson(res, 400, { error: "invalid seal_id format" });
        }
        if (body.sha512 && !isSha512(body.sha512)) {
          return sendJson(res, 400, { error: "invalid sha512 format" });
        }
        const verification = await firewall.verifySeal({
          sealId: body.seal_id,
          sha512: body.sha512,
          pdfBase64: body.pdf_base64,
        });
        // Always 200: the verdict (incl. NOT_FOUND) is carried in the body.
        return sendJson(res, 200, verification);
      }

      if (method === "GET" && url.pathname.startsWith("/v1/verify/")) {
        const sealId = decodeURIComponent(url.pathname.replace("/v1/verify/", ""));
        if (!isSealId(sealId)) return sendJson(res, 400, { error: "invalid seal_id format" });
        const verification = await firewall.verifySeal({ sealId });
        return sendJson(res, 200, verification);
      }

      if (method === "GET" && url.pathname.startsWith("/v1/sealed/")) {
        const sealId = decodeURIComponent(url.pathname.replace("/v1/sealed/", ""));
        // Strict seal-ID allowlist blocks path traversal AND header injection
        // (the id is the only thing placed into the path and the header).
        if (!isSealId(sealId)) return notFound(res);
        const sealedRoot = resolve(config.storage.sealed_dir);
        const path = resolve(sealedRoot, `${sealId}.pdf`);
        if (path !== join(sealedRoot, `${sealId}.pdf`) || !existsSync(path)) {
          return notFound(res);
        }
        const bytes = readFileSync(path);
        // inline=1 lets the console embed the report on screen for review; the
        // default remains attachment so direct links download the sealed PDF.
        const inline = url.searchParams.get("inline") === "1";
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${sealId}.pdf"`,
          "Cache-Control": "no-store",
        });
        return res.end(bytes);
      }

      if (method === "GET") {
        if (serveStatic(res, url.pathname)) return;
        if (url.pathname !== "/" && serveStatic(res, "/index.html")) return;
      }

      return notFound(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message === PAYLOAD_TOO_LARGE
        ? 413
        : message.includes("PRIVACY VIOLATION")
          ? 403
          : 500;
      return sendJson(res, status, {
        error: status === 413 ? "Request body too large" : message,
      });
    }
  });

  server.listen(config.server.port, config.server.host);
  const url = `http://${config.server.host}:${config.server.port}`;
  console.log(`Verum Omnis Fraud Firewall listening on ${url}`);
  console.log(`UI theme aligned with www.verumglobal.foundation`);
  console.log(`Constitution v${config.constitution_version} · ${config.institution.name}`);

  return {
    url,
    close: () =>
      new Promise((resolveClose, reject) => {
        server.close((err) => (err ? reject(err) : resolveClose()));
      }),
  };
}
