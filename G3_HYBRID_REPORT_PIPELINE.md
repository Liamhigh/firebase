# G3 Hybrid Report Pipeline (GHRP)

## Document Metadata
- **System**: Verum Omnis Constitutional Forensic Platform
- **Component**: Findings JSON contract + Gemma 3 narration layer over the sealed vault
- **Version**: 1.0.0
- **Status**: PROPOSED — pending founder ratification (not yet BINDING)
- **Constitutional Authority**: Prime Directive 2 (Evidence Before Narrative), Prime Directive 4 (Determinism), Prime Directive 13 (Ordinal Confidence Only), 3-Layer Output Model, Article X Section 3
- **Author**: Drafted with the founder, 2026-07-14

---

## 1. What This Document Covers

Gemma 3 (G3) must never access raw evidence. But the forensic engine cannot catch everything, and G3 writes the reports — so G3 needs read access to the **sealed vault**: the findings JSON plus the sealed evidence bundles. This document defines that hybrid pipeline:

1. The engine emits exactly what it found as structured findings JSON.
2. Everything is sealed into the vault (AES-256-GCM, SHA-512 per artefact).
3. G3 reads the sealed vault and writes the report in plain English.
4. Contradictions G3 spots that the engine missed are added as **G3-RAISED CANDIDATES** — anchored, hashed, flagged for verification — never presented as engine-verified.
5. Where extraction battled (OCR failures, image-only pages), G3 flags the gap in the report instead of writing around it.

## 2. The Pipeline

```
Raw documents
   |
   v
B2 Document Brain - extraction (text layer -> OCR -> vision fallback)
   |
   v
Nine-Brain Engine - deterministic detection (B1-B8)
   |
   v
FINDINGS JSON  <- exactly what the engine found, nothing more
   |
   v
SEALED VAULT (AES-256-GCM; SHA-512 per artefact; read-only downstream)
   |
   v
Gemma 3 (G3) reads: FINDINGS JSON + sealed bundles
   |
   v
FORENSIC REPORT - plain English, anchored, sealed
```

**Boundary:** G3 never touches raw incoming documents. Raw material exists only behind B2. Everything G3 reads has already been hashed and sealed - nothing G3 does can contaminate the evidence, and the vault proves what it saw.

## 3. The Findings JSON Contract (engine -> G3)

One record per contradiction. No prose, no interpretation, no percentages. Ordinal severity/confidence only. Every record carries its anchor (document, page, line, hash). If it is not anchored, it is not emitted.

```json
{
  "contradiction_id": "VO-SB-013",
  "type": "TEMPORAL_PRECEDENCE_CONFLICT",
  "severity": "CRITICAL",
  "confidence": "MODERATE",
  "proposition_a_text": "C&D 'previously served to your client on 23/04/2025'",
  "proposition_a_actor": "Faimy Amar & Co (Saqib Rizwan, 16 Jul 2025)",
  "proposition_b_text": "C&D letter dated 30 April 2025",
  "proposition_b_actor": "Faimy Amar & Co",
  "source_page": 57,
  "sha512_anchor": "<hash of source artefact>",
  "conflict_description": "A letter dated 30 April cannot have been served 23 April.",
  "verification_status": "ENGINE-VERIFIED"
}
```

Formal schema: `FINDINGS_JSON_SCHEMA.json` (this repo).
Emitters: `findings_json_emitter.py` (1verum) and `fraud-firewall/src/pipeline/findingsJsonEmitter.ts` (firebase).
Worked example: `examples/standardbank_findings_v531c.json` - 20 records produced from the 1,047-page Standard Bank master evidence bundle on 2026-07-14.

## 4. Two-Tier Rule - How G3 Adds Missed Contradictions

G3 reads the sealed bundles alongside the findings JSON. When it spots a contradiction the engine did not emit:

1. It MAY add it to the report - but only as a **G3-RAISED CANDIDATE**.
2. The candidate gets its own anchor (document, page, line) and is hashed like any other artefact.
3. It is labelled in the report: `CANDIDATE - raised by G3 from sealed bundle; pending engine/human verification`.
4. It never masquerades as engine-verified. Verification happens by engine re-run (with updated detectors) or human sign-off; only then does it promote to DetectedFact tier.

Mapping to the 3-Layer Output Model:

| Tier | Source | Status in report |
|---|---|---|
| DetectedFact | Engine findings JSON | ENGINE-VERIFIED |
| LogicalPattern | G3 candidates from sealed vault | G3-RAISED CANDIDATE (pending verification) |
| LegalHypothesis | Statutory/offence suggestions | HYPOTHESIS - always flagged |

Court-defensibility: opposing counsel cannot claim "the AI invented findings." The report shows which tier every finding sits in, and the seal proves the source.

## 5. G3 as Gap-Detector (Not Gap-Filler)

If a sealed bundle contains image-only pages, thin OCR, or missing text layers, G3 must NOT write around the hole. It adds an extraction-integrity note:

> "Extraction incomplete on pages 797-800 (image-only exhibit). Re-run vision/OCR pass. Annexure originals preserved separately (see bundle index p800)."

The reader sees the gap is known and managed. Silence about gaps is what gets reports torn apart in cross-examination.

## 6. G3 System Prompt (Report Writing)

Full prompt block: `G3_SYSTEM_PROMPT.md` (this repo). Constitutional requirement: under 10 words per instruction.

## 7. What Stays Unchanged

- B1-B8 engines: untouched. Deterministic detection remains the spine.
- Raw-evidence quarantine: untouched. G3 never sees unsealed material.
- B7 OJRS (court-record retrieval): untouched - runs off extracted entities/keywords, independent of OCR quality; G3 narrates its output like any other sealed input.
- Report sealing: unchanged - final PDF/A-3B, SHA-512 footer, QR verification.

## 8. Verification Flow for Candidates

```
G3 spots missed contradiction in sealed bundle
   |
   v
Record raised as G3-RAISED CANDIDATE (anchored + hashed)
   |
   v
Appears in report under Candidate tier, clearly labelled
   |
   v
Engine re-run with updated detector OR human sign-off
   |
   v
Promoted to ENGINE-VERIFIED (DetectedFact) - or rejected with reason logged
```

Rejected candidates are never deleted; they are sealed with their rejection reason. The record of what was considered and why is itself evidence of diligence.

---

## 9. Signature Block

This document is part of the Verum Omnis Constitutional Governance Framework.
Upon founder ratification, GHRP functionality becomes bound by CONSTITUTION.md.

**System Version**: v5.3.1c
**Document Version**: 1.0.0
**Drafted**: 2026-07-14
**Status**: PROPOSED - pending founder ratification

```
VERUM OMNIS - G3 HYBRID REPORT PIPELINE
"The engine finds. The vault seals. Gemma narrates. Every tier is labelled."
```
