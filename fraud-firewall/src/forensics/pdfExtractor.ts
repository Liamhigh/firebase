/**
 * Native server-side hybrid PDF text extractor for the Guardian Fraud Firewall
 * (the on-premise / Windows deployment).
 *
 * Strategy — identical philosophy to the Android app's PdfOcrExtractor, but
 * using the platform's *native* tools instead of an in-app engine:
 *
 *   1. Embedded text layer is read per page with poppler's `pdftotext -layout`
 *      (fast, exact, preserves column layout).
 *   2. Only pages whose text layer is thin/empty — scanned exhibits,
 *      photographed documents — are rendered with `pdftoppm` and read with the
 *      native `tesseract` OCR engine.
 *
 * Native poppler + tesseract are a materially higher OCR ceiling than the
 * website's WebAssembly Tesseract (full training data, LSTM engine, real page
 * rasterisation at 300 dpi), which is exactly the "the desktop/firewall build
 * should extract better than the site" guarantee.
 *
 * Everything is deterministic for a given input + tool version, does no network
 * I/O, and degrades gracefully: if a binary is absent the extractor returns
 * whatever it could read and marks the rest as unreadable — it never throws and
 * never fabricates text. The native calls sit behind an injectable {@link
 * PdfBackend} seam so the merge logic is unit-testable without the binaries.
 */

import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Per-page text of a PDF, page numbers 1-based. */
export interface PdfPage {
  page: number;
  text: string;
}

export interface PdfExtractionResult {
  pages: PdfPage[];
  /** Pages whose text came from OCR (1-based). */
  ocrPages: number[];
  /** Pages that could not be read at all (no text layer, OCR unavailable/failed). */
  unreadablePages: number[];
  /** Pages skipped because the OCR cap was reached (1-based). */
  skippedPages: number[];
  /** Whether native OCR tooling was available for this run. */
  ocrAvailable: boolean;
}

/**
 * The two native operations, isolated so the merge logic can be tested with
 * fakes. Defaults shell out to poppler + tesseract.
 */
export interface PdfBackend {
  /** Total page count, or 0 if it cannot be determined. */
  pageCount(pdf: Buffer): Promise<number>;
  /** Per-page embedded text layer. Empty array if no text-layer tool exists. */
  textLayer(pdf: Buffer): Promise<string[]>;
  /** OCR a single 0-based page. Returns "" if OCR is unavailable or the page is blank. */
  ocrPage(pdf: Buffer, pageIndex: number): Promise<string>;
  /** Whether any OCR capability exists (for report notes). */
  ocrAvailable(): Promise<boolean>;
}

export interface PdfOcrOptions {
  /** Per-page text-layer length below which a page is treated as image-only. */
  thinPageChars?: number;
  /** Cap on pages to OCR, to bound worst-case time on very large scans. */
  maxOcrPages?: number;
}

export class PdfOcrExtractor {
  private readonly thinPageChars: number;
  private readonly maxOcrPages: number;

  constructor(
    private readonly backend: PdfBackend = new PopplerTesseractBackend(),
    options: PdfOcrOptions = {},
  ) {
    this.thinPageChars = options.thinPageChars ?? 30;
    this.maxOcrPages = options.maxOcrPages ?? 200;
  }

  /**
   * Extract page-segmented text from PDF bytes, OCR'ing only image-only pages.
   * Never throws — returns partial results with the unreadable pages flagged.
   */
  async extract(pdf: Buffer): Promise<PdfExtractionResult> {
    const ocrAvailable = await this.backend.ocrAvailable().catch(() => false);

    let layer: string[] = [];
    try {
      layer = (await this.backend.textLayer(pdf)).map((t) => (t ?? "").trim());
    } catch {
      layer = [];
    }

    // Determine how many pages we're working with.
    let total = layer.length;
    if (total === 0) {
      total = await this.backend.pageCount(pdf).catch(() => 0);
    }

    // Which pages need OCR (thin/empty text layer, or unknown text layer).
    const needsOcr: number[] = [];
    for (let i = 0; i < total; i++) {
      const t = layer[i] ?? "";
      if (t.length < this.thinPageChars) needsOcr.push(i);
    }

    const ocrByPage = new Map<number, string>();
    const skipped: number[] = [];
    let ocrd = 0;
    if (ocrAvailable) {
      for (const idx of needsOcr) {
        if (ocrd >= this.maxOcrPages) {
          skipped.push(idx + 1);
          continue;
        }
        let text = "";
        try {
          text = (await this.backend.ocrPage(pdf, idx)).trim();
        } catch {
          text = "";
        }
        if (text.length > 0) ocrByPage.set(idx, text);
        ocrd += 1;
      }
    }

    const pages: PdfPage[] = [];
    const ocrPages: number[] = [];
    const unreadable: number[] = [];
    for (let i = 0; i < total; i++) {
      const l = layer[i] ?? "";
      const ocr = ocrByPage.get(i);
      let text: string;
      if (l.length >= this.thinPageChars) {
        text = l;
      } else if (ocr && ocr.length > 0) {
        text = ocr;
        ocrPages.push(i + 1);
      } else {
        text = l; // may be a short-but-real line, or empty
        if (l.length === 0 && !skipped.includes(i + 1)) unreadable.push(i + 1);
      }
      pages.push({ page: i + 1, text });
    }

    return {
      pages,
      ocrPages,
      unreadablePages: unreadable,
      skippedPages: skipped,
      ocrAvailable,
    };
  }
}

/* ------------------------------------------------------------------------- *
 * Default native backend: poppler (pdftotext, pdftoppm, pdfinfo) + tesseract.
 * ------------------------------------------------------------------------- */

function run(bin: string, args: string[], opts: { cwd?: string } = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { cwd: opts.cwd, maxBuffer: 64 * 1024 * 1024, encoding: "buffer", windowsHide: true },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout as Buffer);
      },
    );
  });
}

/** True if a binary can be invoked (used for capability probing). */
async function hasBinary(bin: string): Promise<boolean> {
  // `--version` is supported by pdftotext, pdftoppm, pdfinfo and tesseract and
  // exits 0 when the tool is present.
  try {
    await run(bin, ["--version"]);
    return true;
  } catch (err: unknown) {
    // Non-zero exit still proves the binary exists; only ENOENT means absent.
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    return code !== "ENOENT";
  }
}

export class PopplerTesseractBackend implements PdfBackend {
  private cache: { pdftotext?: boolean; pdftoppm?: boolean; pdfinfo?: boolean; tesseract?: boolean } = {};

  private async has(bin: "pdftotext" | "pdftoppm" | "pdfinfo" | "tesseract"): Promise<boolean> {
    if (this.cache[bin] === undefined) this.cache[bin] = await hasBinary(bin);
    return this.cache[bin] as boolean;
  }

  private withTemp<T>(pdf: Buffer, fn: (dir: string, pdfPath: string) => Promise<T>): Promise<T> {
    const dir = mkdtempSync(join(tmpdir(), "vo-fw-ocr-"));
    const pdfPath = join(dir, "in.pdf");
    writeFileSync(pdfPath, pdf);
    return fn(dir, pdfPath).finally(() => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best-effort cleanup */
      }
    });
  }

  async pageCount(pdf: Buffer): Promise<number> {
    if (!(await this.has("pdfinfo"))) return 0;
    return this.withTemp(pdf, async (_dir, pdfPath) => {
      try {
        const out = (await run("pdfinfo", [pdfPath])).toString("utf8");
        const m = out.match(/^Pages:\s+(\d+)/m);
        return m ? Number(m[1]) : 0;
      } catch {
        return 0;
      }
    });
  }

  async textLayer(pdf: Buffer): Promise<string[]> {
    if (!(await this.has("pdftotext"))) return [];
    return this.withTemp(pdf, async (_dir, pdfPath) => {
      try {
        // `-layout` preserves columns; pages are separated by the form-feed \f.
        const out = (await run("pdftotext", ["-layout", "-enc", "UTF-8", pdfPath, "-"])).toString("utf8");
        const pages = out.split("\f");
        // pdftotext appends a trailing \f after the last page; drop the empty tail.
        if (pages.length > 0 && pages[pages.length - 1].trim() === "") pages.pop();
        return pages;
      } catch {
        return [];
      }
    });
  }

  async ocrAvailable(): Promise<boolean> {
    return (await this.has("pdftoppm")) && (await this.has("tesseract"));
  }

  async ocrPage(pdf: Buffer, pageIndex: number): Promise<string> {
    if (!(await this.ocrAvailable())) return "";
    const pageNo = pageIndex + 1;
    return this.withTemp(pdf, async (dir, pdfPath) => {
      try {
        // Render just this page to PNG at 300 dpi (grayscale) for best OCR.
        const prefix = join(dir, "pg");
        await run("pdftoppm", [
          "-png", "-r", "300", "-gray",
          "-f", String(pageNo), "-l", String(pageNo),
          pdfPath, prefix,
        ]);
        const png = readdirSync(dir).find((f) => f.startsWith("pg") && f.endsWith(".png"));
        if (!png) return "";
        const imgPath = join(dir, png);
        // tesseract <image> stdout — LSTM engine, page-segmentation "auto".
        const out = (await run("tesseract", [imgPath, "stdout", "--psm", "3"])).toString("utf8");
        return out.trim();
      } catch {
        return "";
      }
    });
  }
}
