import { createRequire } from "node:module";
import type { ForensicDocument } from "../core/types.js";

/**
 * Turn an uploaded file (PDF or text) into a ForensicDocument with per-page
 * text, so real evidence files can be loaded straight into the engine.
 */

const require = createRequire(import.meta.url);
type PdfParseResult = { pages?: Array<{ text?: string; num?: number }>; text?: string; total?: number };
type PdfParseCtor = new (opts: { data: Uint8Array }) => { getText: () => Promise<PdfParseResult> };

let PDFParse: PdfParseCtor | null = null;
function pdfParser(): PdfParseCtor {
  if (!PDFParse) {
    PDFParse = (require("pdf-parse") as { PDFParse: PdfParseCtor }).PDFParse;
  }
  return PDFParse;
}

function isPdf(bytes: Uint8Array): boolean {
  // "%PDF" magic, possibly after a small BOM/whitespace.
  const head = Buffer.from(bytes.subarray(0, 8)).toString("latin1");
  return head.includes("%PDF");
}

/** Safe evidence id from a filename (no extension, filesystem-safe). */
export function evidenceIdFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^./\\]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 60) || `DOC-${Date.now()}`;
}

export async function parseUpload(
  bytes: Uint8Array,
  filename: string,
): Promise<ForensicDocument> {
  const evidence_id = evidenceIdFromFilename(filename);
  const source_file = filename;

  if (isPdf(bytes)) {
    const parser = new (pdfParser())({ data: bytes });
    const result = await parser.getText();
    const pages = (result.pages ?? [])
      .map((p, i) => ({ page: p.num ?? i + 1, text: (p.text ?? "").trim() }))
      .filter((p) => p.text.length > 0);
    if (pages.length === 0 && (result.text ?? "").trim()) {
      pages.push({ page: 1, text: result.text!.trim() });
    }
    return { evidence_id, type: "document", source_file, pages };
  }

  // Plain text (or other) — decode as UTF-8; split on form-feeds as page breaks.
  const text = Buffer.from(bytes).toString("utf8");
  const parts = text.split("\f");
  const pages = parts
    .map((t, i) => ({ page: i + 1, text: t.trim() }))
    .filter((p) => p.text.length > 0);
  return {
    evidence_id,
    type: "document",
    source_file,
    pages: pages.length ? pages : [{ page: 1, text: text.trim() }],
  };
}
