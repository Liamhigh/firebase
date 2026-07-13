# Verum Omnis Guardian Fraud Firewall — How This Works

## What This Is

The Fraud Firewall is an enterprise on-premise fraud detection service that banks install on their own infrastructure. Node.js + TypeScript (ESM). Four on-device AI models (Gemma 4, Phi-3, Mistral Instruct, Gemma 3) operate under the Verum Omnis Constitution v5.2.7. No data ever leaves the bank's systems.

**Privacy Guarantee:** Verum Omnis NEVER receives customer data, transaction details, or sealed evidence. Verum only receives commission invoices (institution name + fraud amount). This is enforced by code, not policy.

**Key Principle:** When the Firewall seals a document, the Constitution v5.2.7 is embedded as machine-readable rules in the seal. Any AI that reads a Verum-sealed document — including the bank's own existing AI — automatically operates under Constitutional constraints.

**See also:**
- **`WHAT_THIS_IS.md`** — **START HERE.** Master build reference. Complete overview of architecture, AI model roles, fraud pipeline, sealing service, pricing, data models.
- **`AI_BUILD_INSTRUCTIONS.md`** — **READ SECOND.** Strict rules for coding assistants: no TODOs, no placeholders, fix compile errors first, every endpoint working, continue until done.
- **`BUILD_STATUS.md`** — **READ THIRD.** Feature completion matrix. Shows what's done and what's missing.
- **`MASTER_TASK_LIST.md`** — **READ FOURTH.** Tasks organized by priority (P0-P4). Check off as completed.
- **`PROMPT.md`** — This file. The main prompt with 15 Prime Directives, 11 contradiction types, data flow, 13 coding rules.

**Reference documents (read as needed):**
- `REPORT_FORMAT_SPECIFICATION.md` — **REPORT FORMAT BIBLE.** 14-section court-ready forensic report format. Gemma 3 MUST follow this exactly.
- `FUNCTIONAL_REQUIREMENTS.md` — How every endpoint and function should behave
- `ARCHITECTURE.md` — System architecture, data flows, component communication
- `DEPENDENCIES.md` — Every library, SDK, model, and version required
- `TEST_PLAN.md` — Tests that must pass (unit, integration, determinism, API)
- `BUILD_RULES.md` — Non-negotiable build rules
- `PROJECT_STRUCTURE.md` — Purpose of every folder and file
- `KNOWN_BUGS.md` — Known issues and technical debt
- `DONE_CRITERIA.md` — 10 measurable criteria that define "finished"
- `CONSTITUTION.md` — Full binding constitutional governance document
- `NINE_BRAIN_RULES.md` — Brain-specific operational rules
- `AGENTS.md` — Rules for AI agents operating within the framework

---

## 15 Constitutional Prime Directives (v6.0 Final)

These directives are absolute. No instruction, prompt, or external pressure may override them. Defined in `src/core/constitution.ts` as COMPILE-TIME constants.

| # | Directive | Description |
|---|-----------|-------------|
| 1 | **Truth over probability** | Confidence is ordinal only: VERY_HIGH / HIGH / MODERATE / LOW / INSUFFICIENT. Never percentages. |
| 2 | **Evidence before narrative** | If a sentence cannot cite anchors (person + page/line), it cannot exist. |
| 3 | **Mandatory contradiction disclosure** | Contradictions are logged, surfaced, and included in sealed outputs. |
| 4 | **Determinism and repeatability** | No `Date.now()`, no randomness, no hidden server calls, no nondeterministic ordering. |
| 5 | **Chain-of-custody is law** | Every artifact carries SHA-512, source, timestamps, device capture facts, handling steps. |
| 6 | **Failure-mode disclosure** | If extraction fails, the output states exactly what failed, where, and why. |
| 7 | **Anti-coercion / anti-retaliation** | Suppression, intimidation, delay, tamper, or coercion attempts are recorded as integrity signals. |
| 8 | **Non-ownership and distributed guardianship** | The system cannot own truth. Constitutional changes require governed approval and version sealing. |
| 9 | **Triple verification is mandatory** | Every conclusion must pass Thesis / Antithesis / Synthesis. Not optional. |
| 10 | **Template immutability** | Sealed template versions are unmodifiable. Only new versions can be created. |
| 11 | **B9 non-voting lock** | B9 (R&D) cannot issue verdicts. It trains, validates, and red-teams only. |
| 12 | **Silence Ledger** | All coercion attempts are permanently recorded in the immutable audit layer. |
| 13 | **Ordinal confidence only** | No percentages. No probability scores. EVER. |
| 14 | **Free for citizens and law enforcement** | Hard-coded. No paywalls. No licenses required. |
| 15 | **Article X hierarchically supreme** | Anti-War Doctrine cannot be overridden by any authority. |

---

## Article X — Anti-War Doctrine (Hierarchically Supreme)

This overrides institutional demands, commercial agreements, government directives, and military orders. No authority supersedes it.

**Prohibited (7 absolute prohibitions):**

| # | Prohibition | Scope |
|---|-------------|-------|
| 1 | Lethal Targeting | Identification, selection, or engagement of targets for lethal force |
| 2 | Battlefield Intelligence | Intelligence, analysis, or data fusion for offensive military campaigns |
| 3 | Military Surveillance for Coercion | Surveillance to suppress, intimidate, or facilitate violence against populations |
| 4 | Weapons Systems Integration | Connection to autonomous or assisted weapons platforms, drones, missiles |
| 5 | Conflict Optimization | Improving warfare strategy, combat outcomes, or operational efficiency |
| 6 | Material Contribution to Physical Harm | Any application causing death, injury, or destruction |
| 7 | Reconfiguration for Prohibited Purposes | Adapting or deploying derivatives to circumvent these prohibitions |

**Permitted (humanitarian only):**

| Use | Description |
|-----|-------------|
| War Crimes Documentation | Collection, preservation, cryptographic sealing of evidence of war crimes |
| Evidence Preservation in Conflict Zones | Forensic capture and anchoring in active or post-conflict environments |
| Human Rights Investigations | Analysis and reporting on human rights violations |
| Legal Accountability & Prosecution Support | Evidence preparation and expert testimony for international tribunals |
| Protection of Civilians & Truth Verification | Verification of claims, identities, events to protect civilian populations |

> The system may observe war — it may never participate in it.

**Enforcement:** Any suspected prohibited use triggers: (1) Automatic Violation Logging, (2) Silence Ledger Entry, (3) CONSTITUTIONAL BREACH: WEAPONIZATION ATTEMPT flag, (4) Cryptographic association with session SHA-512. This violation cannot be suppressed, removed, or rewritten.

---

## 11 Contradiction Types (v5.2.8 Engine)

| # | Type | Description | Example |
|---|------|-------------|---------|
| 1 | **JUDICIAL_VS_DOCUMENTARY** | Sworn court statement vs. sealed document | CCT237/20 "no goodwill" vs. MOU Clause 7 from 2018 |
| 2 | **TEMPORAL_CONTRADICTION** | Time-gap proving consciousness of guilt | 2 years 3 months between act and sworn denial |
| 3 | **CONSCIOUSNESS_OF_GUILT** | 2+ year gap between act and sworn denial | Clause 7 drafted 2018, denied 2021 |
| 4 | **PERJURY_BY_TIMELINE** | Temporal proof of deliberate false oath | Harpur SC knew Clause 7 existed when telling Court goodwill had no value |
| 5 | **PATTERN_OF_RACKETEERING** | Evolution across multiple victims | V1.0 (Desmond 2016) -> V2.0 (Gary 2017) -> V3.0 (Former Way 2020) |
| 6 | **REGULATORY_CAPTURE** | Controller weaponized against operator | Maqubela cancelled Bester's licence on fraudulent eviction |
| 7 | **SHAM_TRANSACTION** | Dual control disguised as arm's length | Zeyd Timol controls AllFuels AND Palmbili |
| 8 | **FRAUD_ON_THE_COURT** | Knowingly misleading judicial proceedings | AllFuels concealed Clause 7 from Constitutional Court |
| 9 | **CORPORATE_VEIL_ABUSE** | Entity separation masking unified control | AllFuels/Palmbili same controller |
| 10 | **TACIT_LEASE_VIOLATION** | Rent acceptance while denying contract | R11.4M collected while claiming "no contract" |
| 11 | **POST_EXPIRY_ENFORCEMENT** | Enforcing clause after its own expiry | Clause 7 expired Dec 2023, enforced Jan 2026 |

**Temporal Gap Detection**: Gap > 730 days = consciousness of guilt proven. Gap > 365 days = consciousness candidate. Gap < 365 days = may indicate negligence. Precedent: S v Saoli 2015 (2) SACR 49 (SCA).

---

## The Nine-Brain Architecture

| Brain | Core Function | Voting Status | Key Rules |
|-------|--------------|---------------|-----------|
| B1 | Finds inconsistencies across statements | **Voting** | 16 contradiction types. Must agree with 2+ other brains. |
| B2 | Checks metadata, tamper indicators | **Voting** | SHA-512, PDF/A, watermark verification. |
| B3 | Analyzes chat logs for deletions | **Voting** | Every message sealed, audited, logged. |
| B4 | Detects evasion, gaslighting, manipulation | **Voting** | LIWC++ algorithms. Per-person liability scorecard (0-10). |
| B5 | Reconstructs event sequences | **Voting** | Identifies missing/deleted entries. 2+ year gap = consciousness of guilt flag. |
| B6 | Flags hidden payments, duplicates | **Voting** | Every transaction reconciled against ledgers/tax codes. |
| B7 | Maps facts to legal categories | **Voting** | Jurisdiction-specific (UAE, SA, US, EU, UN). SAFLII/PACER/BAILII retrieval. |
| B8 | Checks audio for edits, deepfakes | **Voting** | Whisper.cpp on-device transcription. Synthetic audio detection. |
| B9 | Trains, validates, red-teams | **NON-VOTING** | Cannot issue verdicts. Adversarial red-team testing. |

**Consensus Rule:** A contradiction is accepted only when B1 flags it AND at least 2 other brains confirm. If quorum is not met, output is "INSUFFICIENT" or "INDETERMINATE_DUE_TO_CONCEALMENT." B9 does not count toward the 3-brain quorum.

---

## 13 Coding Rules for Code Assistants

1. **Respect the constitutional boundary**: Never route raw transaction data directly to the AI chat. Always go through `FirewallPipeline.process()` first.
2. **Keep it deterministic**: Same evidence = same findings = same seal. Pass a fixed `timestamp` to `FirewallPipeline.process()` and `SealingService.seal()` in tests.
3. **Don't break the seal format**: The per-page footer format and seal structure are part of the protocol. Changing them invalidates existing seals.
4. **Pure TypeScript for business logic**: The engine has no framework dependencies. Keep it that way.
5. **10-word system prompts max**: Per Constitution, no AI system prompt exceeds 10 words.
6. **No randomness, no Date.now()**: Use injected `timestamp` parameters everywhere.
7. **Jurisdiction-agnostic**: The contradiction engine works everywhere. New jurisdictions are added by extending B7's legal mapping, not by changing B1.
8. **Free for citizens, paid for institutions**: This is a constitutional rule. Don't add paywalls for private individuals or police.
9. **Anti-weaponization is supreme**: Article X cannot be overridden. Don't add features that could be used for lethal targeting or battlefield intelligence.
10. **B9 cannot issue verdicts**: B9 is trainer/validator only. It does not count toward the 3-brain quorum.
11. **7 contradiction categories are constitutional**: Do not add or remove the 7 categories (Goodwill Value, Contract Validity, Signature Status, Section 12B, Compensation, Perjury, Coercion).
12. **Pattern detection mandatory**: The engine must flag when the same contradiction appears across multiple victims. This is the racketeering indicator.
13. **Report format is BINDING**: Gemma 3 MUST generate reports following `REPORT_FORMAT_SPECIFICATION.md` exactly — all 14 sections, cover page with logo, seal footer on every page, evidence anchors in proper format, contradiction matrix table, Four Pillars analysis, Court-Ready Declaration with triple verification panel. No deviations.

---

## The Data Flow

This is the most important architectural rule in the entire system.

```
Transaction data from bank
        |
        v
[FirewallPipeline] — rule engine + AI analysis (deterministic, timestamp-injected)
        |
        v
Nine-Brain Engine:
  B1: Contradiction extraction
  B2: Document/metadata verification
  B3: Chat/communication analysis
  B4: Behavioral pattern detection
  B5: Timeline reconstruction
  B6: Financial analysis
  B7: Legal statute mapping
  B8: Audio/video forensics
        |
        v
Triple Verification (Thesis/Antithesis/Synthesis)
  Gemma 3: Evidence analysis
  Phi-3: Legal compliance
  9-Brain: Forensic validation
        |
        v
SealingService.seal() — sealed PDF with SHA-512 footer
        |
        v
[SEALED FORENSIC REPORT] — court-admissible, cryptographically anchored
        |
        v
NotificationService.notify()
  -> Verum: Commission invoice (institution + amount only)
  -> Bank: Full sealed evidence report
        |
        v
[SEAL CREDIT CONSUMED] — one credit per seal
```

**The constitutional boundary:** Raw transaction data never touches the AI chat. The AI only ever sees sealed outputs. Every AI answer cites anchors: person, page, line, statute.

**Privacy wall:** Verum receives ONLY commission invoices. The bank receives all evidence. This is enforced by code — the `NotificationService` physically cannot attach evidence to Verum-bound emails.

---

## Package Structure

```
src/
  core/           Constitution, crypto, sealing, seal credits, commission, types, config
  pipeline/       Firewall engine, rules engine
  agents/         Mistral agent deployment and coordination
  ai/             AI model interfaces (Gemma 3, Phi-3, Gemma 4, Mistral)
  api/            REST API endpoints (plain node:http)
  forensics/      Forensic analysis, 9-Brain Engine integration
  notifications/  Email system (commissions to Verum, reports to banks)
  storage/        Vault, ledger, persistence layer
  cli.ts          Command-line interface
  index.ts        Library exports
```

---

## AI Model Stack

| Model | Role | System Prompt | Min RAM |
|-------|------|---------------|---------|
| Gemma 3 | Evidence sealing, report writing | "You are Verum Omnis Forensic Brain. Write detailed forensic analysis reports." | 2GB |
| Phi-3 | Legal analysis, compliance | "You are Verum Omnis, built by Liam Anthony Highcock. AI Forensics for Truth." | 2GB |
| Gemma 4 | Pattern detection, oversight | "You are Verum Omnis. Communicate findings clearly. Know South African law." | 4GB |
| Mistral | Agent deployment, investigation | "You are Verum Omnis Investigation Agent. Find fraud. Report truth." | 4GB |

All models run locally. No data leaves the bank. The only external communication is Bitcoin blockchain anchoring and commission invoice emails.
