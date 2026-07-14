import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  sha256Hex,
  sha512Hex,
  sealIdFromSha512,
  collectSealMetadata,
  encodeSealMetadata,
  decodeSealMetadata,
  buildVerifyUrl,
  parseSealSubject,
  buildSealSubject,
  sealDocument,
  verifySealedDocument,
  submitToOTS,
  type SealMetadata,
} from "../src/seal/index.js";

const FIXED_TS = 1720934400000; // deterministic — constitution PD4

async function makeSimplePdf(pages = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Original evidence page ${i + 1}`, { x: 50, y: 700, size: 18, font });
  }
  return new Uint8Array(await doc.save());
}

describe("VO-DSS-1.2 hashing + seal ID", () => {
  it("computes deterministic dual hashes", () => {
    const bytes = new TextEncoder().encode("standard bank evidence");
    assert.equal(sha256Hex(bytes).length, 64);
    assert.equal(sha512Hex(bytes).length, 128);
    assert.equal(sha512Hex(bytes), sha512Hex(bytes));
  });

  it("derives the Seal ID as VO- + first 12 upper hex", () => {
    const sha = "a1c825e8" + "0".repeat(120);
    assert.equal(sealIdFromSha512(sha), "VO-A1C825E80000");
  });
});

describe("VO-DSS-1.2 metadata + QR verify URL", () => {
  const meta = collectSealMetadata({
    timestampMs: FIXED_TS,
    identity: { n: "John van der Merwe", id: "760101 1234 087", a: "12 Main Street, Sandton", e: "john@email.com" },
    lock: true,
    gps: { lat: "-26.204100", lng: "28.047300", accuracy: 10.4 },
    device: "Android|8|Africa/Johannesburg",
    sealType: "commercial",
    org: "Standard Bank",
  });

  it("builds the schema-compliant metadata object", () => {
    assert.equal(meta.v, "1.2");
    assert.equal(meta.t, FIXED_TS);
    assert.equal(meta.type, "commercial");
    assert.equal(meta.org, "Standard Bank");
    assert.equal(meta.lock, true);
    assert.equal(meta.gps, "-26.204100,28.047300");
    assert.equal(meta.acc, 10); // rounded
    assert.equal(meta.dev, "Android|8|Africa/Johannesburg");
    assert.equal(meta.id?.n, "John van der Merwe");
  });

  it("round-trips through base64 + percent encoding", () => {
    const encoded = encodeSealMetadata(meta);
    const decoded = decodeSealMetadata(encoded);
    assert.deepEqual(decoded, meta);
  });

  it("builds the standard verify URL with 32-hex hash prefix", () => {
    const sha = "f".repeat(128);
    const url = buildVerifyUrl(sha, meta);
    assert.ok(url.startsWith("https://verumglobal.foundation/verify.html?h=" + "f".repeat(32) + "&m="));
    const mParam = url.split("&m=")[1];
    assert.deepEqual(decodeSealMetadata(mParam), meta);
  });

  it("omits empty identity and rejects garbage on decode", () => {
    const bare = collectSealMetadata({ timestampMs: FIXED_TS, sealType: "private" });
    assert.equal(bare.id, undefined);
    assert.equal(bare.lock, undefined);
    assert.equal(decodeSealMetadata("!!!not-base64!!!"), null);
  });
});

describe("VO-DSS-1.2 seal chain subject format", () => {
  it("round-trips subject with chain", () => {
    const subject = buildSealSubject("a".repeat(128), "VO-NEW", ["VO-OLD1", "VO-OLD2"]);
    assert.equal(subject, `VO-SEAL|${"a".repeat(128)}|VO-NEW|CHAIN:VO-OLD1,VO-OLD2`);
    const parsed = parseSealSubject(subject);
    assert.equal(parsed?.sealId, "VO-NEW");
    assert.equal(parsed?.sha512, "a".repeat(128));
    assert.deepEqual(parsed?.chain, ["VO-OLD1", "VO-OLD2"]);
  });

  it("parses chain-free subjects and rejects foreign subjects", () => {
    const plain = buildSealSubject("b".repeat(128), "VO-SOLO", []);
    const parsed = parseSealSubject(plain);
    assert.equal(parsed?.sealId, "VO-SOLO");
    assert.deepEqual(parsed?.chain, []);
    assert.equal(parseSealSubject("Some random subject"), null);
    assert.equal(parseSealSubject(null), null);
  });
});

describe("VO-DSS-1.2 document sealing round-trip", () => {
  it("seals a PDF and embeds an interoperable seal", async () => {
    const original = await makeSimplePdf(3);
    const result = await sealDocument(original, {
      timestampMs: FIXED_TS,
      sealType: "private",
      anchorToBlockchain: false,
      originalName: "evidence.pdf",
    });

    assert.equal(result.pageCount, 3);
    assert.equal(result.pageErrors, 0);
    assert.match(result.sealId, /^VO-[A-F0-9]{12}$/);
    assert.equal(result.sha512, sha512Hex(original));
    assert.equal(result.sha256, sha256Hex(original));
    assert.equal(result.metadata.lock, undefined);
    assert.equal(result.ots, null);

    // The sealed PDF must carry the seal in its Subject metadata.
    const sealed = await PDFDocument.load(result.sealedPdf);
    const parsed = parseSealSubject(sealed.getSubject());
    assert.equal(parsed?.sealId, result.sealId);
    assert.equal(parsed?.sha512, result.sha512);
    assert.deepEqual(parsed?.chain, []);
    // pdf-lib overwrites Producer with its own string on save — the website's
    // sealer has the identical behaviour, so this is exact web parity. The
    // authoritative seal carrier is Subject (above), not Producer.
    assert.match(sealed.getProducer() ?? "", /^pdf-lib/);
    assert.ok(sealed.getKeywords()?.includes("verum,seal," + result.sha512.substring(0, 16)));
    assert.equal(sealed.getPageCount(), 3);

    // Verify: intact document.
    const v1 = await verifySealedDocument(result.sealedPdf, result.sha512.substring(0, 32));
    assert.equal(v1.verdict, "VERIFIED");
    assert.equal(v1.metadataSource, "PDF Subject metadata");

    // Verify: no expected hash → SEAL_FOUND.
    const v2 = await verifySealedDocument(result.sealedPdf);
    assert.equal(v2.verdict, "SEAL_FOUND");

    // Tamper: a DIFFERENT file whose embedded seal does not match this QR hash.
    const other = await sealDocument(await makeSimplePdf(1), {
      timestampMs: FIXED_TS,
      sealType: "private",
      anchorToBlockchain: false,
    });
    const v3 = await verifySealedDocument(other.sealedPdf, result.sha512.substring(0, 32));
    assert.equal(v3.verdict, "TAMPERED");
    assert.ok(v3.reason.includes("altered"));
  });

  it("preserves the seal chain when re-sealing (v1.2)", async () => {
    const original = await makeSimplePdf(1);
    const first = await sealDocument(original, {
      timestampMs: FIXED_TS,
      sealType: "private",
      anchorToBlockchain: false,
    });
    const second = await sealDocument(first.sealedPdf, {
      timestampMs: FIXED_TS + 5000,
      sealType: "private",
      anchorToBlockchain: false,
    });

    assert.notEqual(second.sealId, first.sealId);
    const sealed = await PDFDocument.load(second.sealedPdf);
    const parsed = parseSealSubject(sealed.getSubject());
    assert.equal(parsed?.sealId, second.sealId);
    assert.deepEqual(parsed?.chain, [first.sealId]);

    const v = await verifySealedDocument(second.sealedPdf);
    assert.equal(v.verdict, "SEAL_FOUND");
    assert.deepEqual(v.seal?.chain, [first.sealId]);
  });

  it("password mode produces cover page + lock flag (pdf-lib does not enforce AES — web parity)", async () => {
    const original = await makeSimplePdf(1);
    const result = await sealDocument(original, {
      timestampMs: FIXED_TS,
      sealType: "private",
      anchorToBlockchain: false,
      password: "delivery-receipt-8chars",
      identity: { e: "sender@email.com" },
    });
    assert.equal(result.pageCount, 2); // cover + 1 original
    assert.equal(result.metadata.lock, true);
    assert.equal(result.passwordMode, "cover_page");

    // Honest parity with the website: pdf-lib ignores save() encryption options,
    // so the file is NOT encrypted at rest — the cover page + lock flag carry
    // the delivery-receipt semantics. Verify still reads the seal metadata.
    const v = await verifySealedDocument(result.sealedPdf, result.sha512.substring(0, 32));
    assert.equal(v.verdict, "VERIFIED");
    assert.equal(v.isEncrypted, false);
  });

  it("reports NO_SEAL for an unsealed PDF, with the recomputed fingerprint (verify.html parity)", async () => {
    const plain = await makeSimplePdf(1);
    const v = await verifySealedDocument(plain);
    assert.equal(v.verdict, "NO_SEAL");
    assert.equal(v.seal, null);
    assert.equal(v.computedSha512, sha512Hex(plain));
  });
});

describe("VO-DSS-1.2 OpenTimestamps submission", () => {
  it("degrades gracefully when all calendars fail", async () => {
    const res = await submitToOTS("0".repeat(64), {
      calendars: ["http://127.0.0.1:1/unreachable"],
      timeoutMs: 500,
    });
    assert.equal(res.success, false);
    if (!res.success) assert.match(res.error, /hash recorded for retry/);
  });

  it("returns the proof bytes from the first healthy calendar", async () => {
    const proof = new Uint8Array([0x00, 0x4f, 0x54, 0x53]);
    const fakeFetch: typeof fetch = (async () => new Response(proof, { status: 200 })) as typeof fetch;
    const res = await submitToOTS("a".repeat(64), { calendars: ["https://calendar.example/digest"], fetchImpl: fakeFetch });
    assert.equal(res.success, true);
    if (res.success) {
      assert.deepEqual(res.proof, proof);
      assert.equal(res.calendar, "https://calendar.example/digest");
    }
  });
});

describe("VO-DSS-1.2 cross-platform QR payload", () => {
  it("produces the exact URL shape the website emits", () => {
    const sha = "1234567890abcdef".repeat(8);
    const meta: SealMetadata = { v: "1.2", t: FIXED_TS, type: "private" };
    const url = buildVerifyUrl(sha, meta);
    const encoded = encodeSealMetadata(meta);
    assert.equal(url, `https://verumglobal.foundation/verify.html?h=${sha.substring(0, 32)}&m=${encoded}`);
    // Web-encode compatibility: base64 of the JSON, percent-encoded (identical for ASCII JSON).
    const expectedB64 = Buffer.from(JSON.stringify(meta), "utf8").toString("base64");
    assert.equal(encoded, encodeURIComponent(expectedB64));
  });
});
