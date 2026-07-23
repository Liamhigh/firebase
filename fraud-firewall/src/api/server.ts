import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { FraudFirewall } from "../pipeline/firewall.js";
import { TransactionSchema } from "../core/types.js";
import { findingsPath, readJson } from "../storage/vault.js";
import { exportFindings } from "./export.js";
import { AdminService } from "./admin.js";
import { generateComplianceReport, generateAuditLog } from "./pdf-export.js";
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
  ".pdf": "application/pdf",
};

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

/**
 * Resolve the request's Origin against the configured CORS allow-list.
 * Returns the origin value to reflect, or null when the request is not
 * cross-origin or the origin is not allowed.
 */
function corsOriginFor(req: IncomingMessage, allowed: string[]): string | null {
  const origin = req.headers.origin;
  if (!origin) return null;
  if (allowed.includes("*")) return "*";
  return allowed.includes(origin) ? origin : null;
}

/**
 * Attach CORS response headers for an allowed origin.
 * Must be called before writeHead; setHeader values merge into writeHead.
 */
function applyCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  origin: string,
): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  const requested = req.headers["access-control-request-headers"];
  res.setHeader(
    "Access-Control-Allow-Headers",
    typeof requested === "string" && requested.length > 0
      ? requested
      : "Content-Type, Authorization",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
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

      // CORS: reflect allowed origins on every response; answer preflight.
      const allowedOrigins = config.server.cors_allowed_origins ?? [];
      const corsOrigin = corsOriginFor(req, allowedOrigins);
      if (corsOrigin) applyCorsHeaders(req, res, corsOrigin);

      if (method === "OPTIONS") {
        // Preflight from a disallowed origin is rejected outright.
        if (req.headers.origin && !corsOrigin) {
          return sendJson(res, 403, { error: "Origin not allowed by CORS policy" });
        }
        res.writeHead(204);
        return res.end();
      }

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

      if (method === "GET" && url.pathname === "/v1/evidence") {
        return sendJson(res, 200, { evidence: firewall.listEvidence() });
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

      if (method === "GET" && url.pathname === "/v1/findings") {
        const atoms = readJson<unknown[]>(findingsPath(config, "evidence_atoms.json")) ?? [];
        const contradictions =
          readJson<unknown[]>(findingsPath(config, "contradictions.json")) ?? [];
        const manifest = readJson<unknown>(findingsPath(config, "manifest.json"));
        return sendJson(res, 200, { manifest, atoms, contradictions });
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

      if (method === "GET" && url.pathname === "/v1/export/findings") {
        const start = url.searchParams.get("start_date");
        const end = url.searchParams.get("end_date");
        if (!start || !end) {
          return sendJson(res, 400, {
            error: "start_date and end_date required (ISO 8601 format)",
          });
        }
        try {
          const result = await exportFindings(config, {
            start_date: start,
            end_date: end,
            jurisdiction: url.searchParams.get("jurisdiction") ?? undefined,
            institution: url.searchParams.get("institution") ?? undefined,
          });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Admin API (MVP: simple key-based auth)
      if (url.pathname.startsWith("/api/v1/admin/")) {
        const adminKey = req.headers["x-admin-key"];
        const expectedKey = process.env.ADMIN_KEY;

        if (!expectedKey) {
          return sendJson(res, 500, {
            error: "Server error: ADMIN_KEY not configured. Set ADMIN_KEY environment variable."
          });
        }

        if (adminKey !== expectedKey) {
          return sendJson(res, 403, { error: "Unauthorized" });
        }

        const admin = new AdminService(config);

        if (method === "GET" && url.pathname === "/api/v1/admin/quarterly-report") {
          const start = url.searchParams.get("start_date");
          const end = url.searchParams.get("end_date");
          if (!start || !end) {
            return sendJson(res, 400, {
              error: "start_date and end_date required (format: YYYY-MM-DD)",
            });
          }

          // Validate date format and parse
          const startDate = new Date(start);
          const endDate = new Date(end);

          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return sendJson(res, 400, {
              error: "Invalid date format. Use YYYY-MM-DD (e.g., 2026-07-01)",
            });
          }

          try {
            const report = admin.generateQuarterlyReport(startDate, endDate);
            return sendJson(res, 200, report);
          } catch (err) {
            return sendJson(res, 400, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (method === "GET" && url.pathname === "/api/v1/admin/detector-trends") {
          const detector = url.searchParams.get("detector") || "AMOUNT_ANOMALY";
          const weeks = parseInt(url.searchParams.get("weeks") || "12", 10);
          try {
            const trends = admin.getDetectorTrends(detector, weeks);
            return sendJson(res, 200, { detector, trends });
          } catch (err) {
            return sendJson(res, 400, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (method === "GET" && url.pathname === "/api/v1/admin/false-positive-analysis") {
          try {
            const analysis = admin.getFalsePositiveAnalysis();
            return sendJson(res, 200, analysis);
          } catch (err) {
            return sendJson(res, 400, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (method === "GET" && url.pathname === "/api/v1/admin/fraud-by-jurisdiction") {
          const start = url.searchParams.get("start_date");
          const end = url.searchParams.get("end_date");
          if (!start || !end) {
            return sendJson(res, 400, {
              error: "start_date and end_date required",
            });
          }
          try {
            const analysis = admin.getFraudByJurisdiction(
              new Date(start),
              new Date(end)
            );
            return sendJson(res, 200, analysis);
          } catch (err) {
            return sendJson(res, 400, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (method === "GET" && url.pathname === "/api/v1/admin/compliance-report/pdf") {
          const start = url.searchParams.get("start_date");
          const end = url.searchParams.get("end_date");
          if (!start || !end) {
            return sendJson(res, 400, {
              error: "start_date and end_date required",
            });
          }
          try {
            const report = admin.generateQuarterlyReport(
              new Date(start),
              new Date(end)
            );
            const pdfPath = `/tmp/compliance-report-${Date.now()}.pdf`;
            generateComplianceReport(report, pdfPath);
            const pdfBytes = readFileSync(pdfPath);
            res.writeHead(200, {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="compliance-report-${report.quarter}.pdf"`,
            });
            return res.end(pdfBytes);
          } catch (err) {
            return sendJson(res, 400, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (method === "GET" && url.pathname === "/api/v1/admin/audit-log/json") {
          const start = url.searchParams.get("start_date");
          const end = url.searchParams.get("end_date");
          if (!start || !end) {
            return sendJson(res, 400, {
              error: "start_date and end_date required",
            });
          }
          try {
            const report = admin.generateQuarterlyReport(
              new Date(start),
              new Date(end)
            );
            const auditLog = generateAuditLog(report);
            res.writeHead(200, {
              "Content-Type": "application/json; charset=utf-8",
              "Content-Disposition": `attachment; filename="audit-log-${report.quarter}.json"`,
            });
            return res.end(auditLog);
          } catch (err) {
            return sendJson(res, 400, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        return notFound(res);
      }

      if (method === "GET") {
        if (serveStatic(res, url.pathname)) return;
        if (url.pathname !== "/" && serveStatic(res, "/index.html")) return;
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
