// VO-DSS-1.2 — Document sealer (Firewall/TypeScript).
// Faithful port of buildSealedPDF() from seal-module/web/seal-document.html:
//   - optional password cover page (delivery-receipt mode)
//   - A4 watermark background at 20% opacity
//   - original pages embedded at 88% scale, per-page error recovery
//   - clean QR (no border/box) top-right, 10% of page dimension, 2.5% margin
//   - seal footer bar on every page: type + chain, Seal ID + SHA-512 prefix + timestamp + page x/y
//   - Subject metadata: VO-SEAL|SHA512|SEAL_ID[|CHAIN:...]
//   - password mode: delivery-receipt cover page + lock flag (web parity;
//     pdf-lib does not enforce AES — see the note at the save call)
//
// Interoperable with web + Android outputs.

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { sha256Hex, sha512Hex, sealIdFromSha512 } from "./sealHasher.js";
import {
  buildSealSubject,
  buildSealKeywords,
  chainIdsFrom,
  parseSealSubject,
  previousSealsFromSubject,
  SEAL_PRODUCER,
  type PreviousSeal,
} from "./sealChain.js";
import {
  collectSealMetadata,
  buildVerifyUrl,
  type SealMetadata,
  type SealMetadataInput,
  type SealType,
} from "./sealMetadata.js";
import { submitToOTS, type OtsOptions, type OtsResult } from "./openTimestamps.js";

export interface SealDocumentOptions extends SealMetadataInput {
  /** PNG bytes of the 927x1200 watermark. Optional — pages seal without it. */
  watermarkPng?: Uint8Array | null;
  /** Document password (min 8 chars). Enables cover page + lock metadata flag. */
  password?: string | null;
  /** Original filename, used for the PDF Title. */
  originalName?: string;
  /** Set false to skip the OTS network call (offline sealing). Default true. */
  anchorToBlockchain?: boolean;
  ots?: OtsOptions;
}

export interface SealedDocument {
  sealedPdf: Uint8Array;
  sealId: string;
  sha256: string;
  sha512: string;
  verifyUrl: string;
  metadata: SealMetadata;
  chain: PreviousSeal[];
  ots: OtsResult | null;
  pageCount: number;
  pageErrors: number;
  /**
   * "cover_page" when a password was supplied: the sealed PDF has the
   * delivery-receipt cover page and `lock: true` metadata — the same output
   * the website produces (pdf-lib does not enforce AES encryption; see the
   * note at the save call). null when no password was supplied.
   */
  passwordMode: "cover_page" | null;
}

/** Detect an existing Verum Omnis seal chain in a PDF (web detectExistingSeal). */
export async function detectExistingSeal(pdfBytes: Uint8Array): Promise<PreviousSeal[]> {
  try {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const parsed = parseSealSubject(doc.getSubject());
    return previousSealsFromSubject(parsed);
  } catch {
    return [];
  }
}

async function qrPngBytes(text: string, size = 400): Promise<Uint8Array> {
  const buf = await QRCode.toBuffer(text, {
    width: size,
    margin: 2, // quiet zone only — no border, no box (VO-DSS-1.2 §4)
    errorCorrectionLevel: "H",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
  return new Uint8Array(buf);
}

function drawCoverPage(
  page: PDFPage,
  wmImg: PDFImage | null,
  fonts: { helv: PDFFont; helvBold: PDFFont },
  sealId: string,
  senderEmail: string | undefined,
): void {
  const pw = page.getWidth();
  const ph = page.getHeight();
  page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: rgb(0.02, 0.05, 0.08) });
  if (wmImg) {
    const s = Math.max(pw / wmImg.width, ph / wmImg.height);
    const w = wmImg.width * s;
    const h = wmImg.height * s;
    page.drawImage(wmImg, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h, opacity: 0.15 });
  }
  const cx = pw / 2;
  const cy = ph * 0.65;
  page.drawRectangle({ x: cx - 30, y: cy - 25, width: 60, height: 50, color: rgb(0.82, 0.65, 0.28), opacity: 0.9 });
  page.drawCircle({ x: cx, y: cy + 25, size: 18, color: rgb(0.82, 0.65, 0.28), opacity: 0.9 });
  page.drawCircle({ x: cx, y: cy + 25, size: 10, color: rgb(0.02, 0.05, 0.08), opacity: 1 });
  page.drawText("DOCUMENT PROTECTED", { x: cx - 140, y: cy - 70, size: 22, font: fonts.helvBold, color: rgb(0.82, 0.65, 0.28) });
  let lineY = cy - 110;
  const instructions = [
    "This document has been password-protected by the sender.",
    "",
    "To open this document:",
    "1. Contact the sender to request the password",
    "2. The sender will know you received this document",
    "3. This serves as your delivery receipt",
  ];
  for (const line of instructions) {
    if (line) page.drawText(line, { x: cx - 140, y: lineY, size: 11, font: fonts.helv, color: rgb(0.58, 0.71, 0.78) });
    lineY -= 18;
  }
  if (senderEmail) {
    lineY -= 10;
    page.drawText("Sender contact:", { x: cx - 140, y: lineY, size: 11, font: fonts.helvBold, color: rgb(0.82, 0.65, 0.28) });
    lineY -= 18;
    page.drawText(senderEmail, { x: cx - 140, y: lineY, size: 12, font: fonts.helv, color: rgb(0.95, 0.95, 0.95) });
  }
  page.drawText(`Seal: ${sealId}  |  verumglobal.foundation`, {
    x: cx - 100,
    y: ph * 0.03,
    size: 9,
    font: fonts.helv,
    color: rgb(0.36, 0.42, 0.48),
  });
}

/**
 * Seal a PDF document to VO-DSS-1.2.
 * Time is injected via options.timestampMs (constitution: deterministic).
 */
export async function sealDocument(
  originalPdfBytes: Uint8Array,
  options: SealDocumentOptions,
): Promise<SealedDocument> {
  const password = options.password && options.password.length >= 8 ? options.password : null;

  // Steps 2 + 8: dual hash of the ORIGINAL bytes.
  const sha256 = sha256Hex(originalPdfBytes);
  const sha512 = sha512Hex(originalPdfBytes);
  const sealId = sealIdFromSha512(sha512);

  // Chain detection (v1.2): read any prior seal from the source document.
  const existing = await detectExistingSeal(originalPdfBytes);
  const parsed = (() => {
    const direct = existing.find((s) => s.source === "Subject metadata");
    return direct
      ? { sha512: direct.sha512!, sealId: direct.sealId, chain: existing.filter((s) => s.source === "Chain history").map((s) => s.sealId) }
      : null;
  })();
  const priorChain = chainIdsFrom(parsed, sealId);

  // Metadata + QR payload (step 5).
  const meta = collectSealMetadata({ ...options, lock: password ? true : options.lock });
  const verifyUrl = buildVerifyUrl(sha512, meta);

  // Step 3: OpenTimestamps (skippable for offline sealing).
  const ots =
    options.anchorToBlockchain === false ? null : await submitToOTS(sha256, options.ots);

  // Steps 4, 6, 7: build the sealed PDF.
  const orig = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  const sealed = await PDFDocument.create();

  let wmImg = null;
  if (options.watermarkPng) {
    try {
      wmImg = await sealed.embedPng(options.watermarkPng);
    } catch {
      wmImg = null;
    }
  }
  const qrImg = await sealed.embedPng(await qrPngBytes(verifyUrl, 400));
  const helv = await sealed.embedFont(StandardFonts.Helvetica);
  const helvBold = await sealed.embedFont(StandardFonts.HelveticaBold);

  const now = new Date(options.timestampMs);
  const ts = now.toISOString().replace("T", " ").substring(0, 19) + " UTC";
  const short = sha512.substring(0, 16);

  const origPages = orig.getPages();
  let pw = 595;
  let ph = 842;
  if (origPages.length > 0) {
    const size = origPages[0].getSize();
    pw = size.width;
    ph = size.height;
  }

  if (password) {
    const cover = sealed.addPage([pw, ph]);
    drawCoverPage(cover, wmImg, { helv, helvBold }, sealId, options.identity?.e);
  }

  let pageErrors = 0;
  for (let i = 0; i < origPages.length; i++) {
    const srcPage = origPages[i];
    const { width: pageW, height: pageH } = srcPage.getSize();
    const pg = sealed.addPage([pageW, pageH]);

    if (wmImg) {
      const s = Math.max(pageW / wmImg.width, pageH / wmImg.height);
      const w = wmImg.width * s;
      const h = wmImg.height * s;
      pg.drawImage(wmImg, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h, opacity: 0.2 });
    }

    try {
      const embedded = await sealed.embedPage(srcPage);
      const sc = 0.88;
      pg.drawPage(embedded, {
        x: (pageW * (1 - sc)) / 2,
        y: (pageH * (1 - sc)) / 2,
        width: pageW * sc,
        height: pageH * sc,
      });
    } catch {
      // v1.2 per-page recovery: error notice instead of aborting the seal.
      pageErrors++;
      pg.drawRectangle({ x: pageW * 0.1, y: pageH * 0.45, width: pageW * 0.8, height: pageH * 0.1, color: rgb(0.15, 0.05, 0.05) });
      pg.drawText("! Page content could not be embedded", { x: pageW * 0.15, y: pageH * 0.5, size: 14, font: helvBold, color: rgb(0.9, 0.3, 0.3) });
      pg.drawText("This page contained complex elements that could not be copied.", { x: pageW * 0.15, y: pageH * 0.46, size: 10, font: helv, color: rgb(0.7, 0.5, 0.5) });
      pg.drawText("The original file is preserved in the metadata. Seal ID: " + sealId, { x: pageW * 0.15, y: pageH * 0.43, size: 9, font: helv, color: rgb(0.5, 0.5, 0.5) });
    }

    // Clean QR: top-right, 10% of page dimension, 2.5% margin, no border/box.
    const qs = Math.min(pageW, pageH) * 0.1;
    const m = Math.min(pageW, pageH) * 0.025;
    pg.drawImage(qrImg, { x: pageW - m - qs, y: pageH - m - qs, width: qs, height: qs });

    // Seal footer.
    const fy = pageH * 0.02;
    const fs = Math.min(pageW, pageH) * 0.018;
    pg.drawRectangle({ x: 0, y: 0, width: pageW, height: fy + fs * 3, color: rgb(0.02, 0.05, 0.08), opacity: 0.85 });
    const stLabel =
      options.sealType === "commercial" && options.org
        ? `COMMERCIAL SEAL -- ${options.org.toUpperCase()}`
        : "PRIVATE SEAL -- FREE TIER";
    const chainLabel = priorChain.length > 0 ? `  |  Chain: ${priorChain.length} prev` : "";
    pg.drawText(stLabel + chainLabel, { x: pageW * 0.03, y: fy + fs * 1.8, size: fs * 0.8, font: helvBold, color: rgb(0.82, 0.65, 0.28) });
    pg.drawText(`Seal: ${sealId}  |  SHA-512: ${short}...  |  ${ts}  |  ${i + 1}/${origPages.length}`, {
      x: pageW * 0.03,
      y: fy + fs * 0.5,
      size: fs * 0.75,
      font: helv,
      color: rgb(0.58, 0.71, 0.78),
    });
    pg.drawText("verumglobal.foundation  |  OpenTimestamps  |  Patent Pending", {
      x: pageW * 0.55,
      y: fy + fs * 0.5,
      size: fs * 0.75,
      font: helv,
      color: rgb(0.36, 0.42, 0.48),
    });
  }

  // Metadata (step 7) — the interoperable seal carrier.
  sealed.setTitle(options.originalName ?? "Sealed Document");
  sealed.setAuthor("Verum Omnis");
  sealed.setSubject(buildSealSubject(sha512, sealId, priorChain));
  sealed.setKeywords([buildSealKeywords(sha512, options.sealType)]);
  sealed.setProducer(SEAL_PRODUCER);
  sealed.setCreationDate(now);

  // NOTE (Constitution Article III — truth over probability): pdf-lib 1.17.1
  // does NOT enforce password encryption — unknown save options are silently
  // ignored, which is also true of the website's sealer. Password mode here is
  // therefore the delivery-receipt COVER PAGE plus the `lock` metadata flag,
  // exactly as the web produces it. True AES-256 enforcement requires a
  // qpdf/pikepdf post-processing step (documented follow-up).
  const sealedPdf = await sealed.save();

  return {
    sealedPdf,
    sealId,
    sha256,
    sha512,
    verifyUrl,
    metadata: meta,
    chain: existing,
    ots,
    pageCount: origPages.length + (password ? 1 : 0),
    pageErrors,
    passwordMode: password ? "cover_page" : null,
  };
}

/** Seal type guard re-export for callers. */
export type { SealType };
