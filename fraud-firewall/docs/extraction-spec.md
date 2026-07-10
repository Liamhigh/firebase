# Evidence Extraction Module

Implements the forensic evidence-extraction pipeline described in
`VO-ANDROID-SPEC-5.2.7-2026` (§4.1–4.3, §7.2, §12.1–12.2) on top of the existing
Guardian Fraud Firewall. Everything is **deterministic and offline** — identical
input always yields identical atoms, contradictions, ids, and hashes (Constitution
v5.2.7 requirement). No network calls, no external LLM.

## What it does

1. **Ingest** documents (text or page-segmented), fingerprint them with SHA‑512,
   and persist originals to the vault.
2. **Extract Evidence Atoms** — verbatim, anchored sentence extracts with page +
   line ranges, per-atom SHA‑512, surrounding context, jurisdiction/GPS, ordinal
   confidence, Nine-Brain attribution, and a triple‑AI consensus block (spec §12.1).
3. **Detect Contradictions** across atoms — structured `Contradiction` records with
   two anchored claims, severity, confidence, applicable law, and triple‑AI quorum
   (spec §12.2).
4. **Persist findings** to the vault `findings/` directory and, optionally, **seal**
   the findings bundle (SHA‑512 + OpenTimestamps metadata), consuming one seal credit.

## Modules (`src/forensics/`)

| File | Responsibility |
|------|----------------|
| `hasher.ts` | SHA‑512 content/document hashing, page/line indexing, deterministic atom & contradiction ids. |
| `text.ts` | Deterministic text helpers: sentence splitting w/ offsets, topic tokens, polarity/antonym detection, date & number extraction. |
| `extractor.ts` | `EvidenceExtractor` — sentence → anchored `EvidenceAtom`. |
| `contradiction.ts` | `ContradictionEngine` — pairwise deterministic contradiction detection (B1/B5/B6). |
| `engine.ts` | `ForensicEngine` — ingest, extract, persist findings, optional seal, `demoDocuments()`. |

Data models live in `src/core/types.ts`: `ForensicDocument`, `EvidenceAtom`,
`Contradiction`, `ClaimAnchor`, `TripleAiConsensus`, `Severity`, `BrainSource`.

## Contradiction detection (deterministic heuristics)

Two atoms are compared only when they share **≥ 2 significant topic tokens**
(stopwords, month names, and polarity words excluded). The first matching rule
wins, in priority order:

| Priority | Rule | Brain | Severity |
|----------|------|-------|----------|
| 1 | Opposite polarity or an antonym pair (e.g. *fell through* vs *proceeded*) | `B1-ContradictionBrain` | CRITICAL |
| 2 | Same event, different dates | `B5-Timeline` | MODERATE |
| 3 | Same subject, different numeric values | `B6-Financial` | HIGH |

**Triple‑AI consensus** is a rule-based quorum, not an LLM: Gemma 3 (anchors present)
and 9‑Brain (topic linkage) always concur; Phi‑3 concurs when a jurisdiction→law
mapping exists. `quorum = all three concur` → `resolution_status: CONFIRMED`.

> These are transparent v1 heuristics. Because the `ForensicEngine` isolates
> extraction and detection behind clear interfaces, a local Gemma/Phi/Mistral
> runtime can later be swapped in as an *enhancement* without changing the API or
> the persisted data contracts. Deterministic/offline remains the default.

## HTTP API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/evidence` | Ingest one document or `{ "documents": [...] }`. Returns SHA‑512 receipts. |
| GET | `/v1/evidence` | List buffered evidence. |
| POST | `/v1/extract` | Body `{ "documents"?: [...], "seal"?: bool }` (or bare array). Runs extraction + detection, writes findings. |
| GET | `/v1/findings` | Return the latest `manifest`, `atoms`, and `contradictions`. |

## CLI

```bash
npm run dev            # console UI + API on :8787 (Evidence Extraction panel)
npx tsx src/cli.ts extract          # run the demo extraction
npx tsx src/cli.ts extract --seal   # also seal the findings (consumes 1 credit)
```

## Vault layout (spec §7.2)

```
vault/
├── evidence/                # original ingested documents (<evidence_id>.json)
└── findings/
    ├── evidence_atoms.json
    ├── contradictions.json
    └── manifest.json
```

Paths are configurable via `config/firewall.json` → `storage.evidence_dir` /
`storage.findings_dir` (default to `<vault_dir>/evidence` and `<vault_dir>/findings`).

## Tests

`tests/forensics.test.ts` covers hashing/anchoring determinism, schema-valid atom
extraction, each contradiction type (B1/B5/B6), the no-false-positive case, and
end-to-end engine orchestration with sealing.

```bash
npm test
```

## Roadmap (Option 3)

Timeline reconstruction (§4.4) and legal-framework mapping (§4.5) build on the
`EvidenceAtom` output and can be layered on next as `src/forensics/timeline.ts`
and `src/forensics/legalMappings.ts`.
