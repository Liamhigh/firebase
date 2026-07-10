# Sealing, Watermarking & Blockchain Verification

Every PDF Verum Omnis produces is a court-ready forensic report that is **sealed,
watermarked, and anchored to the Bitcoin blockchain** via OpenTimestamps
(`VO-*-SPEC-5.2.7`, §6). One sealing service (`src/core/sealing.ts`) is used by
the fraud pipeline, the evidence-extraction engine, and the `seal` CLI/API — so
all outputs share the same standard.

## What each sealed PDF contains

- **Blue forensic cover** with the **company logo** (embedded PNG if a valid
  `web/assets/seal-logo.png` / `mainlogo.png` is present; otherwise a vector
  "VO" emblem), the `CONFIDENTIAL - LAW ENFORCEMENT SENSITIVE` banner, title,
  subject/subtitle, metadata block, and Verum branding.
- **"VERUM OMNIS SEALED" watermark** tiled diagonally on **every page**.
- **Running header + seal footer** on content pages, with `Page X of Y`.
- **QR code** on the cover encoding the verification URL (`{verify_url}?seal={seal_id}`).

## The hash happens last

`seal.sha512` (= `document_sha512`) is the SHA-512 of the **final rendered PDF
bytes**, computed after the cover, logo, watermark, QR, and footers are drawn.
This is the fingerprint that is:

- committed to the OpenTimestamps proof (`vault/sealed/<seal_id>.ots`), and
- re-computed and compared at verification time.

> A file's own hash cannot be printed *inside* that same file (it would change
> the hash). Following the OpenTimestamps model, the QR carries the verify link +
> seal id; the SHA-512 is anchored externally, and verification re-hashes the
> distributed file and compares it to the anchored value.

## Blockchain anchoring (OpenTimestamps)

New seals are recorded as `PENDING` — Bitcoin confirmation can take a few hours.
`src/core/verification.ts` models this deterministically: a seal is `PENDING`
until `OTS_CONFIRM_WINDOW_MS` (2h) after `submitted_at`, then `CONFIRMED`.

## Verifying a seal

- `POST /v1/verify` — body `{ seal_id, sha512?, pdf_base64? }`.
- `GET /v1/verify/:sealId` — re-hashes the stored sealed PDF server-side.
- **Console UI → Verify Seal panel**: paste the seal id, optionally select the
  sealed PDF (the browser computes SHA-512 locally), and verify.

Results:

| Result | Meaning |
|--------|---------|
| `VERIFIED` | SHA-512 matches **and** the OTS anchor is confirmed on Bitcoin. |
| `SEAL_FOUND_PENDING_CHAIN` | SHA-512 matches; blockchain anchor still **pending**. |
| `TAMPERED` | SHA-512 does **not** match the sealed fingerprint. |
| `NOT_FOUND` | No sealed record for that seal id. |

> The public verification website (verumglobal.foundation/#verify) is outside
> this repo; it consumes the same `document_sha512` + OTS proof and mirrors this
> logic. The firewall app implements the flow end-to-end here.

## Supplying the real company logo

`web/assets/mainlogo.png` is currently a **corrupt PNG** (fails CRC / zlib
decode), so a vector emblem is drawn instead. Drop a valid PNG at
`web/assets/seal-logo.png` (or fix `mainlogo.png`) and it will be embedded
automatically — the loader validates the PNG with `pngjs` before handing it to
`pdf-lib` (which can otherwise hang on a corrupt PNG).
