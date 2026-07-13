# Nine-Brain Rules — Verum Omnis Guardian Fraud Firewall

**Document Purpose:** Brain-specific operational rules for the Nine-Brain Engine.

**Version:** 5.2.7
**Last Updated:** 2026-07-13

---

## Consensus Overview

A contradiction is accepted only when:
1. **B1 flags it** (contradiction detected)
2. **At least 2 other voting brains confirm** (quorum = 3)
3. **B9 red-teams and approves** (methodology validated)

If quorum is not met: output is `INSUFFICIENT` or `INDETERMINATE_DUE_TO_CONCEALMENT`.

B9 does NOT count toward the 3-brain quorum. B9 votes ONLY on methodology validation.

---

## B1 — Contradiction Brain

**Status:** VOTING
**Quorum contribution:** YES (primary flagger)

### Core Function
Extracts contradictions from evidence — false statements, conflicting claims, actions that contradict words.

### Rules
- Must detect all 11 contradiction types (see `CONSTITUTION.md`)
- Must categorize into 7 immutable categories
- Must provide evidence anchors for every contradiction
- Must assign ordinal confidence (VERY_HIGH / HIGH / MODERATE / LOW)
- Must pass 2+ other brain confirmations for acceptance

### Integration
- Input: Transaction data, rule engine output, agent findings
- Output: Contradiction objects with anchors, categories, confidence
- Location: `src/forensics/b1.ts`

---

## B2 — Document Verification Brain

**Status:** VOTING
**Quorum contribution:** YES

### Core Function
Verifies document integrity — metadata, tamper indicators, format compliance.

### Rules
- Computes SHA-512 hash of all documents
- Verifies PDF/A-3B compliance
- Checks for watermarks and digital signatures
- Tamper score: 0.000 (untampered) to 1.000 (fully tampered)
- Must comply with Daubert standards

### Integration
- Input: Documents from vault or transaction attachments
- Output: Verification report with tamper score
- Location: `src/forensics/b2.ts`

---

## B3 — Communication Analysis Brain

**Status:** VOTING
**Quorum contribution:** YES

### Core Function
Analyses chat logs, emails, and communications for deletions, gaps, and contradictions.

### Rules
- Every message sealed, audited, logged
- Redactions are immutable
- Emergency access requires dual human-AI unlock
- Detects deleted messages via timestamp gaps
- Flags communication patterns (evasion, delay, silence)

### Integration
- Input: Chat logs, email chains, communication records
- Output: Communication analysis with gap detection
- Location: `src/forensics/b3.ts`

---

## B4 — Behavioral Pattern Brain

**Status:** VOTING
**Quorum contribution:** YES

### Core Function
Detects evasion, gaslighting, manipulation, and other behavioral indicators.

### Rules
- Uses LIWC++ algorithms for linguistic analysis
- Per-person liability scorecard (0-10 scale)
- Voice tone analysis for threats, stress, deception
- Flags sudden changes in communication patterns
- Tracks per-person contradiction history

### Integration
- Input: Communications, behavioral data, transaction patterns
- Output: Behavioral analysis with scorecards
- Location: `src/forensics/b4.ts`

---

## B5 — Timeline Reconstruction Brain

**Status:** VOTING
**Quorum contribution:** YES

### Core Function
Reconstructs event sequences, identifies missing entries, detects temporal anomalies.

### Rules
- Identifies missing/deleted entries via timestamp gaps
- ISP, GPS, device log anchoring
- 2+ year gap between act and sworn denial = consciousness of guilt flag
- Temporal analysis supports all 11 contradiction types
- Timeline must be deterministic (same evidence = same timeline)

### Integration
- Input: Timestamped evidence, transaction logs, communications
- Output: Reconstructed timeline with gaps flagged
- Location: `src/forensics/b5.ts`

---

## B6 — Financial Analysis Brain

**Status:** VOTING
**Quorum contribution:** YES

### Core Function
Flags hidden payments, duplicates, financial anomalies, and tax implications.

### Rules
- Every transaction reconciled against ledgers/tax codes
- Simulates fraud patterns for comparison
- Auto-generates tax return summaries
- Rent tracing for lease violation detection
- Financial brain analysis required for all fraud alerts

### Integration
- Input: Transaction data, account records, tax codes
- Output: Financial analysis with anomaly flags
- Location: `src/forensics/b6.ts`

---

## B7 — Legal Mapping Brain

**Status:** VOTING
**Quorum contribution:** YES

### Core Function
Maps facts to legal categories, identifies applicable statutes and precedents.

### Rules
- Jurisdiction-specific: UAE, SA, US, EU, UN
- Auto-maps statutes, precedents, treaties
- SAFLII/PACER/BAILII retrieval for case law
- Cross-jurisdiction analysis for multi-national fraud
- Legal mapping required for all confirmed alerts

### Integration
- Input: Contradictions, timeline, financial analysis
- Output: Legal framework application with statute citations
- Location: `src/forensics/b7.ts`

---

## B8 — Audio/Video Forensics Brain

**Status:** VOTING
**Quorum contribution:** YES

### Core Function
Checks audio for edits, deepfakes, and synthetic content.

### Rules
- Whisper.cpp on-device transcription
- Speaker diarization (who spoke when)
- Synthetic audio detection
- Video frame analysis for manipulation
- Audio/video analysis is optional (only when media is present)

### Integration
- Input: Audio files, video files, media attachments
- Output: Media forensics report with authenticity score
- Location: `src/forensics/b8.ts`

---

## B9 — Training & Validation Brain

**Status:** NON-VOTING
**Quorum contribution:** NO

### Core Function
Trains, validates, and red-teams all other brains. Cannot issue verdicts.

### Rules
- Cannot issue verdicts (non-voting lock)
- Trains and calibrates B1-B8 via simulation
- Adversarial red-team testing of all findings
- Methodology validation for accepted contradictions
- v5.2.8 upgrade: B9 votes ONLY on online judicial record authentication

### Integration
- Input: All findings from B1-B8
- Output: Validation report (APPROVED / REJECTED / NEEDS_REVIEW)
- Location: `src/forensics/b9.ts`

---

## Firewall Pipeline Integration

```
Transaction -> Pipeline -> B1 (contradictions)
                              B2 (verification)
                              B3 (communications)
                              B4 (behavioral)
                              B5 (timeline)
                              B6 (financial)
                              B7 (legal)
                              B8 (media)
                              B9 (validation - non-voting)
                    
                              -> Consensus Check (B1 + 2 others)
                              -> B9 Red-team Approval
                              -> Triple-AI Verification (G3/PHI3/9-Brain)
                              -> Seal -> Notify
```

---

## Consensus Decision Matrix

| B1 Flagged | B2 Confirm | B3 Confirm | B4 Confirm | B5 Confirm | B6 Confirm | B7 Confirm | B8 Confirm | B9 Validate | Result |
|------------|------------|------------|------------|------------|------------|------------|------------|-------------|--------|
| YES | 2+ YES | — | — | — | — | — | — | APPROVED | ACCEPTED |
| YES | 1 YES | — | — | — | — | — | — | APPROVED | INSUFFICIENT |
| YES | 0 YES | — | — | — | — | — | — | APPROVED | INSUFFICIENT |
| YES | 2+ YES | — | — | — | — | — | — | REJECTED | REJECTED |
| NO | — | — | — | — | — | — | — | — | NO_FINDING |

Minimum quorum: B1 + 2 other voting brains + B9 approval = ACCEPTED.

---

*"The truth does not require belief. It requires only that you look."*

**Verum Omnis** — AI Forensics for Truth
