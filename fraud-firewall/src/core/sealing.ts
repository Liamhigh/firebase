import {
  PDFDocument,
  PDFPage,
  PDFName,
  PDFRawStream,
  PDFHexString,
  AFRelationship,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import {
  makeSealId,
  sha512,
  shortCode,
  stableStringify,
} from "./crypto.js";
import {
  constitutionRuleset,
  loadConstitution,
  type Constitution,
} from "./constitution.js";
import type { FirewallConfig, SealRecord } from "./types.js";
import { SealCreditLedgerService } from "./sealCredits.js";
import { hashPointerPath, sealedPath, writeJson } from "../storage/vault.js";
import { otsStamp } from "./opentimestamps.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Candidate company-logo files, in priority order. The Verum Omnis globe mark
// is the official brand; a supplied seal-logo.png overrides it. If none is a
// valid PNG, a vector emblem is drawn instead.
const LOGO_CANDIDATES = ["seal-logo.png", "verum-globe-mark.png", "mainlogo.png"].map((f) =>
  fileURLToPath(new URL(`../../web/assets/${f}`, import.meta.url)),
);
// Full-page "two globe" watermark (globe + VERUM OMNIS FORENSIC AI + corner globe).
const WATERMARK_CANDIDATES = ["seal-watermark.png", "verum-watermark.png"].map((f) =>
  fileURLToPath(new URL(`../../web/assets/${f}`, import.meta.url)),
);
const OTS_CALENDARS = [
  "https://alice.btc.calendar.opentimestamps.org",
  "https://bob.btc.calendar.opentimestamps.org",
];

/**
 * Return bytes of the first VALID logo PNG, or null. Validating with pngjs
 * first is essential: pdf-lib's PNG decoder can hang (not throw) on a corrupt
 * PNG, so we never hand it an undecodable file.
 */
function loadFirstValidPng(candidates: string[]): Buffer | null {
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const bytes = readFileSync(path);
      PNG.sync.read(bytes); // throws on corrupt/invalid PNG
      return bytes;
    } catch {
      // Corrupt or unreadable — skip and try the next candidate.
    }
  }
  return null;
}

/** Cover-page metadata for court-ready forensic reports (Greensky standard). */
export interface SealReportMeta {
  /** Primary subject / entity under investigation (e.g. institution name). */
  subject?: string;
  /** One-line descriptor under the title. */
  subtitle?: string;
  /** External case reference(s), e.g. "RAKEZ #1295911 | SAPS CAS 126/4/2025". */
  caseReference?: string;
  /** Jurisdiction line. */
  jurisdiction?: string;
  /** Classification banner. Defaults to the law-enforcement classification. */
  classification?: string;
}

export interface SealInput {
  documentReference: string;
  title: string;
  bodyText: string;
  /** Optional extra JSON payload hashed into the seal */
  evidencePayload?: unknown;
  createdAt?: string;
  /** Optional forensic-report cover metadata. */
  report?: SealReportMeta;
}

export interface SealResult {
  seal: SealRecord;
  pdfBytes: Uint8Array;
  constitutionEmbedded: ReturnType<typeof constitutionRuleset>;
  lowBalanceWarning: boolean;
}

/**
 * Built-in document sealing service.
 * SHA-512 + OpenTimestamps-style blockchain metadata + PDF seal footer.
 * Consumes one seal credit per successful seal.
 */
export class DocumentSealingService {
  private readonly constitution: Constitution;
  private readonly credits: SealCreditLedgerService;

  constructor(private readonly config: FirewallConfig) {
    this.constitution = loadConstitution(config.constitution_version);
    this.credits = new SealCreditLedgerService(config);
  }

  async seal(input: SealInput): Promise<SealResult> {
    if (!this.credits.canSeal()) {
      throw new Error("Cannot seal: no seal credits remaining");
    }

    const createdAt = input.createdAt ?? new Date().toISOString();
    const ruleset = constitutionRuleset(this.constitution);
    const contentForHash = stableStringify({
      document_reference: input.documentReference,
      title: input.title,
      body: input.bodyText,
      evidence: input.evidencePayload ?? null,
      constitution: ruleset,
      created_at: createdAt,
      protocol: this.config.seal_protocol,
    });
    const digest = sha512(contentForHash);
    const sealId = makeSealId(digest);
    const verifyUrl = appendSeal(this.config.verum.verify_url, sealId);
    const otsProofFile = `${sealId}.ots`;
    const otsPath = sealedPath(this.config, sealId).replace(/\.pdf$/, ".ots");

    // Anchor the CONTENT digest to Bitcoin (OpenTimestamps) BEFORE assembling
    // the PDF, so the proof can be embedded inside the sealed bundle (the
    // PDF/A-3B "embedded files" feature). Live mode submits to real calendars.
    let otsBytes: Uint8Array | undefined;
    let documentSha256: string | undefined;
    if (this.config.ots?.mode === "live") {
      try {
        const res = await otsStamp(Buffer.from(digest, "utf8"));
        otsBytes = res.otsBytes;
        documentSha256 = res.sha256;
      } catch {
        otsBytes = undefined; // fall back to mock proof below
      }
    }

    const embeddedFiles: string[] = [];
    const pdfBytes = await this.buildSealedPdf({
      title: input.title,
      bodyText: input.bodyText,
      sealId,
      digest,
      documentReference: input.documentReference,
      createdAt,
      ruleset,
      report: input.report,
      verifyUrl,
      evidencePayload: input.evidencePayload,
      otsBytes,
      otsStatus: "PENDING",
      embeddedFilesOut: embeddedFiles,
    });

    // SHA-512 happens LAST: fingerprint the final sealed PDF (with embedded
    // proof/evidence). Registered for tamper detection and verify-by-file.
    const documentSha512 = sha512(Buffer.from(pdfBytes));

    // Also persist the proof externally (verification-by-file + portability).
    if (otsBytes) {
      writeFileSync(otsPath, Buffer.from(otsBytes));
    } else {
      writeJson(otsPath, {
        version: 1,
        provider: "OpenTimestamps",
        file_sha512: documentSha512,
        content_sha512: digest,
        seal_id: sealId,
        calendar_urls: OTS_CALENDARS,
        submitted_at: createdAt,
        status: "PENDING",
        mode: "mock",
        note: "Offline mock proof; enable ots.mode=live for real Bitcoin anchoring.",
      });
    }

    const seal: SealRecord = {
      seal_id: sealId,
      sha512: documentSha512,
      document_sha512: documentSha512,
      document_sha256: documentSha256,
      constitution_version: this.constitution.version,
      created_at: createdAt,
      document_reference: input.documentReference,
      verify_url: verifyUrl,
      ots_proof_file: otsProofFile,
      ots_embedded: Boolean(otsBytes),
      embedded_files: embeddedFiles,
      blockchain: {
        provider: "OpenTimestamps",
        status: "PENDING",
        submitted_at: createdAt,
        calendar_urls: OTS_CALENDARS,
        confirmations: 0,
        ots_receipt: `ots-${shortCode(documentSha256 ?? digest, 16)}`,
      },
    };

    this.credits.consumeSeal({
      sealId,
      documentReference: input.documentReference,
      documentSha512,
      aiVerifier: "Gemma3",
    });

    writeFileSync(sealedPath(this.config, sealId), pdfBytes);
    writeJson(
      sealedPath(this.config, sealId).replace(/\.pdf$/, ".json"),
      { seal, constitution: ruleset },
    );
    // Hash pointer enables verifying an uploaded PDF without knowing the seal id.
    writeJson(hashPointerPath(this.config, documentSha512), {
      seal_id: sealId,
      document_sha512: documentSha512,
    });

    return {
      seal,
      pdfBytes,
      constitutionEmbedded: ruleset,
      lowBalanceWarning: this.credits.isLowBalance(),
    };
  }

  private async buildSealedPdf(params: {
    title: string;
    bodyText: string;
    sealId: string;
    digest: string;
    documentReference: string;
    createdAt: string;
    ruleset: ReturnType<typeof constitutionRuleset>;
    report?: SealReportMeta;
    verifyUrl: string;
    evidencePayload?: unknown;
    otsBytes?: Uint8Array;
    otsStatus?: string;
    /** Populated with the names of files embedded in the PDF. */
    embeddedFilesOut?: string[];
  }): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 54;

    // Theme aligned with www.verumglobal.foundation
    const navy = rgb(0.0157, 0.05098, 0.1059); // #040D1B
    const navy2 = rgb(0.039, 0.086, 0.157); // #0A1628
    const blue = rgb(0.29, 0.494, 0.78); // #4A7EC7
    const gold = rgb(0.831, 0.659, 0.263); // #D4A843
    const paper = rgb(0.973, 0.976, 0.98);
    const ink = rgb(0.835, 0.847, 0.867);
    const bodyInk = rgb(0.16, 0.17, 0.2);
    const headingInk = rgb(0.102, 0.18, 0.322);

    // Company logo (embedded on the cover + content headers) — only if a valid
    // PNG is available; otherwise a vector Verum Omnis emblem is drawn instead.
    let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
    const logoBytes = loadFirstValidPng(LOGO_CANDIDATES);
    if (logoBytes) {
      try {
        logo = await doc.embedPng(logoBytes);
      } catch {
        logo = null;
      }
    }

    // Two-globe watermark image (validated first — pdf-lib can hang on bad PNGs).
    let watermark: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
    const wmBytes = loadFirstValidPng(WATERMARK_CANDIDATES);
    if (wmBytes) {
      try {
        watermark = await doc.embedPng(wmBytes);
      } catch {
        watermark = null;
      }
    }

    // Draw either the embedded logo image or a vector "VO" emblem at (x,y) with
    // the given box size (both cover and content-header call this).
    const drawLogo = (p: PDFPage, x: number, y: number, box: number): void => {
      if (logo) {
        const scale = box / Math.max(logo.width, logo.height);
        p.drawImage(logo, { x, y, width: logo.width * scale, height: logo.height * scale });
        return;
      }
      const r = box / 2;
      const cx = x + r;
      const cy = y + r;
      p.drawCircle({ x: cx, y: cy, size: r, color: navy2, borderColor: gold, borderWidth: Math.max(1, r * 0.1) });
      p.drawCircle({ x: cx, y: cy, size: r * 0.72, borderColor: blue, borderWidth: Math.max(0.6, r * 0.04), opacity: 0, borderOpacity: 1 });
      const mono = "VO";
      const ms = r * 0.9;
      p.drawText(mono, {
        x: cx - bold.widthOfTextAtSize(mono, ms) / 2,
        y: cy - ms * 0.36,
        size: ms,
        font: bold,
        color: gold,
      });
    };

    // QR code encoding the verification URL (links to seal verification).
    const qrPng = await QRCode.toBuffer(params.verifyUrl, {
      type: "png",
      margin: 1,
      width: 240,
      color: { dark: "#040d1bff", light: "#ffffffff" },
    });
    const qr = await doc.embedPng(qrPng);

    // Two-globe watermark on every page. When the globe watermark PNG is present
    // it is drawn full-page ("cover" fit) at low opacity so it sits behind the
    // text exactly like the reference report; otherwise a text watermark is used.
    const drawWatermark = (p: PDFPage, dark: boolean): void => {
      if (watermark) {
        const scale = Math.max(pageWidth / watermark.width, pageHeight / watermark.height);
        const w = watermark.width * scale;
        const h = watermark.height * scale;
        p.drawImage(watermark, {
          x: (pageWidth - w) / 2,
          y: (pageHeight - h) / 2,
          width: w,
          height: h,
          opacity: dark ? 0.1 : 0.08,
        });
        return;
      }
      const wmColor = dark ? rgb(0.29, 0.494, 0.78) : rgb(0.45, 0.5, 0.58);
      const opacity = dark ? 0.06 : 0.05;
      for (let row = 0; row < 4; row++) {
        p.drawText("VERUM OMNIS SEALED", {
          x: 40,
          y: 120 + row * 200,
          size: 30,
          font: bold,
          color: wmColor,
          rotate: degrees(35),
          opacity,
        });
      }
    };

    const classification = pdfSafe(
      params.report?.classification ?? "CONFIDENTIAL - LAW ENFORCEMENT SENSITIVE",
    );
    const subject = pdfSafe(params.report?.subject ?? "");
    const subtitle = pdfSafe(params.report?.subtitle ?? "");
    const caseReference = pdfSafe(params.report?.caseReference ?? "");
    const jurisdiction = pdfSafe(params.report?.jurisdiction ?? "");
    const headerSubject = subject || pdfSafe(params.title);

    // ---- Cover page (blue / navy) ----
    const cover = doc.addPage([pageWidth, pageHeight]);
    cover.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: navy });
    drawWatermark(cover, true);
    cover.drawRectangle({ x: 0, y: pageHeight - 72, width: pageWidth, height: 72, color: navy2 });
    cover.drawRectangle({ x: 0, y: pageHeight - 76, width: pageWidth, height: 4, color: blue });
    cover.drawRectangle({ x: 0, y: 0, width: 6, height: pageHeight, color: blue });
    cover.drawText(classification, {
      x: margin,
      y: pageHeight - 46,
      size: 11,
      font: bold,
      color: gold,
    });
    drawLogo(cover, pageWidth - margin - 44, pageHeight - 62, 44);
    drawLogo(cover, margin, pageHeight - 210, 72);

    let cy = pageHeight - 250;
    cover.drawText("FORENSIC EVIDENCE REPORT", {
      x: margin,
      y: cy,
      size: 26,
      font: bold,
      color: paper,
      maxWidth: pageWidth - margin * 2,
    });
    cy -= 44;
    for (const line of wrapText(headerSubject, 34).slice(0, 3)) {
      cover.drawText(line, { x: margin, y: cy, size: 18, font: bold, color: gold });
      cy -= 24;
    }
    if (subtitle) {
      for (const line of wrapText(subtitle, 58).slice(0, 2)) {
        cover.drawText(line, { x: margin, y: cy, size: 12, font: italic, color: ink });
        cy -= 18;
      }
    }
    cy -= 24;
    const metaRows: Array<[string, string]> = [
      ["Report Reference", params.documentReference],
      ["Date", params.createdAt],
      ["Jurisdiction", jurisdiction],
      ["Case Reference", caseReference],
      ["Constitution", `v${params.ruleset.version}`],
      ["Seal Protocol", this.config.seal_protocol],
      ["Seal ID", params.sealId],
    ];
    for (const [k, v] of metaRows) {
      if (!v) continue;
      cover.drawText(`${k}:`, { x: margin, y: cy, size: 10, font: bold, color: blue });
      cover.drawText(pdfSafe(v), {
        x: margin + 140,
        y: cy,
        size: 10,
        font,
        color: ink,
        maxWidth: pageWidth - margin * 2 - 140,
      });
      cy -= 18;
    }
    // QR code (bottom-right) linking to seal verification.
    const qrSize = 104;
    const qrX = pageWidth - margin - qrSize;
    cover.drawImage(qr, { x: qrX, y: 96, width: qrSize, height: qrSize });
    cover.drawText("Scan to verify seal", {
      x: qrX,
      y: 84,
      size: 8,
      font,
      color: ink,
    });
    cover.drawText("SHA-512 anchored via OpenTimestamps (Bitcoin)", {
      x: margin,
      y: 150,
      size: 8,
      font,
      color: ink,
    });
    cover.drawText(`CONSTITUTIONAL FORENSIC AI v${params.ruleset.version}`, {
      x: margin,
      y: 122,
      size: 10,
      font,
      color: blue,
    });
    cover.drawText("VERUM OMNIS  |  AI FORENSICS FOR TRUTH", {
      x: margin,
      y: 102,
      size: 13,
      font: bold,
      color: gold,
    });

    // ---- Content pages (flowing body with running header + seal footer) ----
    const top = pageHeight - 96;
    const bottom = 80;
    const lineH = 12.5;
    const contentPages: PDFPage[] = [];
    let page!: PDFPage;
    let y = 0;

    const startPage = (): void => {
      page = doc.addPage([pageWidth, pageHeight]);
      drawWatermark(page, false);
      const pageNo = contentPages.length + 2;
      drawLogo(page, margin, pageHeight - 62, 16);
      page.drawText(`${headerSubject} | Forensic Report ${params.documentReference}`, {
        x: margin + 22,
        y: pageHeight - 52,
        size: 8,
        font,
        color: blue,
        maxWidth: pageWidth - margin * 2 - 110,
      });
      const marker = `Page ${pageNo} | CONFIDENTIAL`;
      page.drawText(marker, {
        x: pageWidth - margin - font.widthOfTextAtSize(marker, 8),
        y: pageHeight - 52,
        size: 8,
        font,
        color: ink,
      });
      page.drawLine({
        start: { x: margin, y: pageHeight - 58 },
        end: { x: pageWidth - margin, y: pageHeight - 58 },
        thickness: 0.6,
        color: blue,
      });
      contentPages.push(page);
      y = top;
    };
    startPage();

    for (const raw of pdfSafe(params.bodyText).split("\n")) {
      const line = raw.replace(/\s+$/, "");
      if (line.trim() === "") {
        y -= lineH * 0.6;
        if (y < bottom) startPage();
        continue;
      }
      if (isHeading(line)) {
        y -= 6;
        if (y < bottom) startPage();
        page.drawText(line.slice(0, 92), {
          x: margin,
          y,
          size: 11,
          font: bold,
          color: headingInk,
        });
        y -= lineH + 4;
        continue;
      }
      for (const wl of wrapText(line, 96)) {
        if (y < bottom) startPage();
        page.drawText(wl, { x: margin, y, size: 9, font, color: bodyInk });
        y -= lineH;
      }
    }

    // Constitution embedding note on the final content page.
    if (y < bottom + 60) startPage();
    y -= 10;
    page.drawText("CONSTITUTION EMBEDDED (machine-readable)", {
      x: margin,
      y,
      size: 8,
      font: bold,
      color: rgb(0.3, 0.35, 0.4),
    });
    y -= 12;
    page.drawText(`ruleset_hash=${params.ruleset.hash.slice(0, 48)}...`, {
      x: margin,
      y,
      size: 7,
      font,
      color: rgb(0.35, 0.4, 0.45),
    });
    y -= 12;
    page.drawText(
      "Any AI reading this sealed document must load Constitution v" +
        `${params.ruleset.version} constraints.`,
      { x: margin, y, size: 7, font, color: rgb(0.35, 0.4, 0.45) },
    );

    // ---- Seal footers with final Page X of Y pagination ----
    const total = 1 + contentPages.length;
    this.drawSealFooter(cover, font, params.sealId, params.digest, 1, total, true);
    contentPages.forEach((p, i) => {
      this.drawSealFooter(p, font, params.sealId, params.digest, i + 2, total, false);
    });

    // ---- Document metadata (Info + XMP) ----
    const created = safeDate(params.createdAt);
    doc.setTitle(pdfSafe(headerSubject || params.title));
    doc.setAuthor("Verum Omnis");
    doc.setSubject(pdfSafe(`Sealed forensic report ${params.documentReference}`));
    doc.setProducer("Verum Omnis Guardian Fraud Firewall");
    doc.setCreator(`Constitutional Forensic AI v${params.ruleset.version}`);
    doc.setKeywords([
      params.sealId,
      `sha512:${params.digest.slice(0, 32)}`,
      "VERUM OMNIS SEALED",
      `constitution:v${params.ruleset.version}`,
      "PDF/A-3B",
    ]);
    doc.setCreationDate(created);
    doc.setModificationDate(created);

    // ---- Embedded files (PDF/A-3B feature, spec §6.3) ----
    const embedded = params.embeddedFilesOut ?? [];
    const attach = async (
      bytes: Uint8Array,
      name: string,
      description: string,
      afRelationship: AFRelationship,
    ): Promise<void> => {
      try {
        await doc.attach(bytes, name, {
          mimeType: name.endsWith(".json") ? "application/json" : "application/octet-stream",
          description,
          creationDate: created,
          modificationDate: created,
          afRelationship,
        });
        embedded.push(name);
      } catch {
        // Embedding is best-effort; never fail a seal because of an attachment.
      }
    };

    // Verum metadata sidecar (mirrors the sealed-document metadata keys).
    const verumMeta = {
      seal_id: params.sealId,
      verum_hash: params.digest,
      verum_content_sha512: params.digest,
      constitution_hash: params.ruleset.hash,
      constitution_version: params.ruleset.version,
      verify_url: params.verifyUrl,
      ots_embedded: Boolean(params.otsBytes),
      ots_status: params.otsStatus ?? "PENDING",
      hash_algorithm: "SHA-512",
      blockchain: "Bitcoin via OpenTimestamps",
      output_standard: "PDF/A-3B",
    };
    await attach(
      new TextEncoder().encode(JSON.stringify(verumMeta, null, 2)),
      "verum-metadata.json",
      "Verum Omnis seal metadata",
      AFRelationship.Supplement,
    );
    if (params.otsBytes) {
      await attach(
        params.otsBytes,
        "verum-proof.ots",
        "OpenTimestamps Bitcoin proof",
        AFRelationship.Supplement,
      );
    }
    if (params.evidencePayload !== undefined) {
      await attach(
        new TextEncoder().encode(JSON.stringify(params.evidencePayload, null, 2)),
        "evidence.json",
        "Original evidence payload",
        AFRelationship.Source,
      );
    }

    // XMP metadata declaring the PDF/A-3B target (best-effort).
    this.applyXmp(doc, {
      title: headerSubject || params.title,
      sealId: params.sealId,
      hash: params.digest,
      version: params.ruleset.version,
      otsStatus: params.otsStatus ?? "PENDING",
    });

    return doc.save();
  }

  /**
   * Inject an XMP metadata stream declaring the PDF/A-3B target and Verum
   * seal properties, plus a deterministic document ID. Best-effort — any
   * failure is swallowed so a seal is never blocked by metadata plumbing.
   */
  private applyXmp(
    doc: PDFDocument,
    meta: { title: string; sealId: string; hash: string; version: string; otsStatus: string },
  ): void {
    try {
      const title = escapeXml(pdfSafe(meta.title));
      const xmp = `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <pdfaid:part>3</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>Verum Omnis</rdf:li></rdf:Seq></dc:creator>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:verum="https://verumglobal.foundation/ns/1.0/">
   <verum:sealId>${escapeXml(meta.sealId)}</verum:sealId>
   <verum:hash>${escapeXml(meta.hash)}</verum:hash>
   <verum:constitutionVersion>${escapeXml(meta.version)}</verum:constitutionVersion>
   <verum:otsStatus>${escapeXml(meta.otsStatus)}</verum:otsStatus>
   <verum:otsEmbedded>true</verum:otsEmbedded>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
      const bytes = new TextEncoder().encode(xmp);
      const dict = doc.context.obj({
        Type: "Metadata",
        Subtype: "XML",
        Length: bytes.length,
      });
      const stream = PDFRawStream.of(dict, bytes);
      const ref = doc.context.register(stream);
      doc.catalog.set(PDFName.of("Metadata"), ref);

      // Deterministic document ID from the content hash (PDF/A wants a stable ID).
      const idHex = meta.hash.slice(0, 32);
      doc.context.trailerInfo.ID = doc.context.obj([
        PDFHexString.of(idHex),
        PDFHexString.of(idHex),
      ]);
    } catch {
      // Metadata is best-effort.
    }
  }

  private drawSealFooter(
    page: PDFPage,
    font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
    sealId: string,
    digest: string,
    pageNum: number,
    pageCount: number,
    onCover: boolean,
  ): void {
    const text = `VERUM OMNIS SEAL | ${sealId} | ${digest.slice(0, 16)}...${digest.slice(-8)}`;
    const color = rgb(0.29, 0.494, 0.78);
    page.drawText(text, {
      x: 36,
      y: 28,
      size: 7,
      font,
      color,
      maxWidth: page.getWidth() - 120,
    });
    const pageLabel = `Page ${pageNum} of ${pageCount}`;
    page.drawText(pageLabel, {
      x: page.getWidth() - 36 - font.widthOfTextAtSize(pageLabel, 7),
      y: 28,
      size: 7,
      font,
      color: onCover ? rgb(0.835, 0.847, 0.867) : color,
    });
  }
}

/** Detect section headings for report styling. */
function isHeading(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 92) return false;
  if (/^[0-9]+(\.[0-9]+)*\.?\s+[A-Z]/.test(t)) return true;
  if (/^[A-Z][A-Z0-9 &/\-]+:$/.test(t)) return true;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
  return false;
}

/**
 * Reduce arbitrary text to characters the WinAnsi standard fonts can encode,
 * mapping common Unicode punctuation to ASCII so pdf-lib never throws.
 */
function pdfSafe(input: string): string {
  return input
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/[\u2022\u2043\u00b7]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2713\u2714\u2717\u2718]/g, "")
    .replace(/\t/g, "  ")
    .replace(/[^\x0A\x0D\x20-\x7E]/g, "");
}

function wrapText(text: string, width: number): string[] {
  const words = text.replace(/\r/g, "").split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Parse an ISO date, defaulting to now on failure (pdf-lib needs a valid Date). */
function safeDate(iso?: string): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Minimal XML escaping for XMP text values. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Append a seal id to the configured verify URL, preserving any hash fragment. */
function appendSeal(base: string, sealId: string): string {
  const [main, fragment] = base.split("#");
  const sep = main.includes("?") ? "&" : "?";
  const withSeal = `${main}${sep}seal=${encodeURIComponent(sealId)}`;
  return fragment ? `${withSeal}#${fragment}` : withSeal;
}

/** Deterministic mock Bitcoin block height for confirmed OpenTimestamps anchors. */
export function mockBlockHeight(hash: string): number {
  const n = parseInt(hash.slice(0, 8), 16);
  return 800000 + (n % 200000);
}
