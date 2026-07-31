import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PdfOcrExtractor, type PdfBackend } from "../src/forensics/pdfExtractor.js";

/**
 * A fake backend so the hybrid merge logic is tested deterministically without
 * poppler/tesseract installed. `layer` is the per-page text layer; `ocr` maps a
 * 0-based page index to its OCR text.
 */
function fakeBackend(opts: {
  layer: string[];
  ocr?: Record<number, string>;
  ocrAvailable?: boolean;
  pageCount?: number;
}): PdfBackend {
  const ocr = opts.ocr ?? {};
  return {
    async pageCount() {
      return opts.pageCount ?? opts.layer.length;
    },
    async textLayer() {
      return opts.layer;
    },
    async ocrPage(_pdf, i) {
      return ocr[i] ?? "";
    },
    async ocrAvailable() {
      return opts.ocrAvailable ?? true;
    },
  };
}

const PDF = Buffer.from("%PDF-1.4 fake");

describe("PdfOcrExtractor (firewall native hybrid)", () => {
  it("uses the text layer directly for machine-readable pages (no OCR)", async () => {
    let ocrCalls = 0;
    const backend = fakeBackend({
      layer: ["This is a full page of machine readable text about the lease.", "Second page with plenty of embedded text content here."],
    });
    const spy: PdfBackend = { ...backend, async ocrPage(p, i) { ocrCalls++; return backend.ocrPage(p, i); } };
    const res = await new PdfOcrExtractor(spy).extract(PDF);
    assert.equal(res.pages.length, 2);
    assert.match(res.pages[0].text, /machine readable text/);
    assert.equal(res.ocrPages.length, 0);
    assert.equal(ocrCalls, 0, "text-layer pages must not be OCR'd");
  });

  it("OCRs only the image-only (thin) pages", async () => {
    const backend = fakeBackend({
      layer: [
        "A fully machine-readable first page with lots of real text on it.",
        "   ", // scanned page: whitespace only
      ],
      ocr: { 1: "RECOVERED SCANNED TEXT via native tesseract" },
    });
    const res = await new PdfOcrExtractor(backend).extract(PDF);
    assert.match(res.pages[0].text, /machine-readable first page/);
    assert.match(res.pages[1].text, /RECOVERED SCANNED TEXT/);
    assert.deepEqual(res.ocrPages, [2]);
    assert.deepEqual(res.unreadablePages, []);
  });

  it("OCRs every page when the PDF has no text layer at all", async () => {
    const backend = fakeBackend({
      layer: [], // pdftotext found nothing
      pageCount: 3,
      ocr: { 0: "page one scan", 1: "page two scan", 2: "page three scan" },
    });
    const res = await new PdfOcrExtractor(backend).extract(PDF);
    assert.equal(res.pages.length, 3);
    assert.deepEqual(res.ocrPages, [1, 2, 3]);
    assert.match(res.pages[2].text, /page three scan/);
  });

  it("marks pages unreadable when OCR is unavailable and text layer is thin", async () => {
    const backend = fakeBackend({
      layer: ["good machine readable page number one here with text", ""],
      ocrAvailable: false,
    });
    const res = await new PdfOcrExtractor(backend).extract(PDF);
    assert.deepEqual(res.ocrPages, []);
    assert.deepEqual(res.unreadablePages, [2]);
    assert.equal(res.ocrAvailable, false);
  });

  it("respects the OCR cap and reports skipped pages", async () => {
    const layer = Array.from({ length: 5 }, () => "");
    const ocr: Record<number, string> = {};
    for (let i = 0; i < 5; i++) ocr[i] = `scan of page ${i + 1}`;
    const res = await new PdfOcrExtractor(fakeBackend({ layer, ocr }), {
      maxOcrPages: 2,
    }).extract(PDF);
    assert.deepEqual(res.ocrPages, [1, 2]);
    assert.deepEqual(res.skippedPages, [3, 4, 5]);
  });

  it("never throws when the backend fails; returns partial pages", async () => {
    const backend: PdfBackend = {
      async pageCount() { return 2; },
      async textLayer() { throw new Error("pdftotext blew up"); },
      async ocrPage(_p, i) { if (i === 0) throw new Error("render failed"); return "second page ocr text"; },
      async ocrAvailable() { return true; },
    };
    const res = await new PdfOcrExtractor(backend).extract(PDF);
    assert.equal(res.pages.length, 2);
    assert.match(res.pages[1].text, /second page ocr text/);
    assert.deepEqual(res.unreadablePages, [1]);
  });
});
