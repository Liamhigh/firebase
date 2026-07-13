# Verum Omnis Guardian Fraud Firewall — What This Is

**Document Purpose:** The master build reference. Complete overview of architecture, AI model stack, fraud detection pipeline, document sealing service, pricing models, and data models. This is the document any code assistant should read first.

**Version:** 5.2.7
**Date:** 13 July 2026
**Classification:** Constitutional — Immutable — Enterprise

---

## Table of Contents

1. [What Is the Fraud Firewall?](#1-what-is-the-fraud-firewall)
2. [How the Constitution Governs External AI](#2-how-the-constitution-governs-external-ai)
3. [System Architecture](#3-system-architecture)
4. [AI Model Stack](#4-ai-model-stack)
5. [AI Roles & Responsibilities](#5-ai-roles--responsibilities)
6. [Fraud Detection Pipeline](#6-fraud-detection-pipeline)
7. [Document Sealing Service](#7-document-sealing-service)
8. [Seal Credit System](#8-seal-credit-system)
9. [Notification & Commission System](#9-notification--commission-system)
10. [Licensing & Pricing Models](#10-licensing--pricing-models)
11. [AI Access to Bank Systems](#11-ai-access-to-bank-systems)
12. [Privacy & Security](#12-privacy--security)
13. [AI Chat Interface](#13-ai-chat-interface)
14. [Data Models](#14-data-models)
15. [Real-World Proof: AllFuels Case](#15-real-world-proof-allfuels-case)
16. [15 Constitutional Prime Directives](#16-15-constitutional-prime-directives)
17. [11 Contradiction Types](#17-11-contradiction-types)
18. [The Nine-Brain Architecture](#18-the-nine-brain-architecture)
19. [Tech Stack](#19-tech-stack)
20. [File Structure](#20-file-structure)

---

## 1. What Is the Fraud Firewall?

The Verum Omnis Guardian Fraud Firewall is an enterprise software package that banks and financial institutions install on their own infrastructure. It uses multiple on-device AI models — Gemma 4, Phi-3, Mistral Instruct, and Gemma 3 — operating under the Verum Omnis Constitution v5.2.7 to detect, block, and report fraud in real time.

### Key Principle

When a bank installs the Fraud Firewall, their own AI systems become bound by the Verum Omnis Constitution through the cryptographic seal. The Constitution is embedded in every seal as machine-readable rules. Any AI model — whether Gemma, Phi-3, Mistral, or the bank's own existing AI — that processes a Verum-sealed document operates under Constitutional constraints automatically.

### What the Package Includes

| Component | Description |
|-----------|-------------|
| 4 AI models | Gemma 4 (flagship), Phi-3 (legal), Mistral Instruct (agents), Gemma 3 (sealing/reports) |
| Built-in sealing service | SHA-512 + Bitcoin blockchain anchoring |
| Email notification system | Verum receives commission invoices; banks receive sealed evidence reports |
| Seal credit system | Pay per seal or buy in bulk; AI keeps records |
| Mistral fraud agents | Deployed autonomously to hunt for fraud across bank systems |
| AI chat interface | Compliance chat, vault access, deep research, sealed reports |

---

## 2. How the Constitution Governs External AI

When the Fraud Firewall seals a document, the Constitution v5.2.7 is embedded as a machine-readable ruleset in the seal:

1. Any AI that reads a Verum-sealed document extracts the Constitution automatically
2. The Constitution loads into the AI's context as binding rules
3. The AI cannot bypass, override, or ignore these rules
4. This applies to ALL AI models — not just the 4 included in the package

### Practical Example

A bank has its own existing fraud detection AI. When the Verum Fraud Firewall is installed and starts sealing evidence, that existing AI begins processing sealed documents. Every time it reads a sealed file, the Constitution v5.2.7 loads into its context. The bank's AI now follows the same rules as Gemma 4 and Mistral — it cannot hide fraud, cannot suppress evidence, and must flag all contradictions.

---

## 3. System Architecture

```
+-------------------------------------------------------------+
|                    BANK INFRASTRUCTURE                       |
|  +------------------+      +------------------+             |
|  |  Core Banking    |      |  Transaction     |             |
|  |  System          |      |  Engine          |             |
|  +--------+---------+      +--------+---------+             |
|           |                         |                       |
|  +--------v---------+      +--------v---------+             |
|  |  Mistral Agents  |      |  Gemma 4 Monitor |             |
|  |  (Fraud Hunting) |      |  (Pattern Detect)|             |
|  +--------+---------+      +--------+---------+             |
|           |                         |                       |
|  +--------v-------------------------v---------+             |
|  |        TRIPLE-AI CONSENSUS                  |             |
|  |   Gemma 3 + Phi-3 + 9-Brain Engine         |             |
|  +------------------+--------------------------+             |
|                     |                                       |
|  +------------------v--------------------------+             |
|  |        DOCUMENT SEALING SERVICE             |             |
|  |        SHA-512 + Bitcoin Blockchain        |             |
|  +------------------+--------------------------+             |
|                     |                                       |
|  +------------------v--------------------------+             |
|  |        EMAIL NOTIFICATION SYSTEM            |             |
|  |  -> Verum: Commission Invoice              |             |
|  |  -> Bank: Sealed Evidence Report           |             |
|  +---------------------------------------------+             |
+-------------------------------------------------------------+
```

---

## 4. AI Model Stack

| Model | Role | Min RAM | Offline |
|-------|------|---------|---------|
| **Gemma 3** | Primary evidence sealing, report writing, SHA-512 verification | 2GB | Yes |
| **Phi-3** | Legal analysis, statutory interpretation, compliance checking | 2GB | Yes |
| **Gemma 4** | Advanced fraud pattern detection, anomaly correlation, oversight | 4GB | Yes |
| **Mistral Instruct** | Fraud agent deployment, autonomous system investigation | 4GB | Yes |

All 4 models run on the bank's own infrastructure. No data leaves the bank's systems. The only external communication is: (1) Bitcoin blockchain anchoring via OpenTimestamps, and (2) Commission invoice emails to Verum Omnis.

---

## 5. AI Roles & Responsibilities

### 5.1 Gemma 3 — Evidence Sealing & Reports

- **Forensic report writing** — Documents exactly what happened when fraud is detected
- **SHA-512 hash generation** — Computes cryptographic fingerprints of all evidence
- **Seal generation** — Creates VERUM OMNIS SEAL footers on every document page
- **Blockchain submission** — Submits hashes to OpenTimestamps for Bitcoin anchoring
- **System prompt:** "You are Verum Omnis Forensic Brain. Write detailed forensic analysis reports."
- **Report format:** Must follow `REPORT_FORMAT_SPECIFICATION.md` exactly (14-section court-ready format)

### 5.2 Phi-3 — Legal Analysis & Compliance

- **Jurisdiction mapping** — Determines applicable law from transaction metadata
- **Statutory interpretation** — Identifies which laws the fraud violates
- **Compliance checking** — Ensures all outputs meet legal admissibility standards
- **Cross-jurisdiction analysis** — Handles cross-border fraud (UAE, SA, US, EU, UN)
- **System prompt:** "You are Verum Omnis, built by Liam Anthony Highcock. AI Forensics for Truth."

### 5.3 Gemma 4 — Advanced Reasoning & Oversight

- **Pattern correlation** — Links seemingly unrelated transactions to reveal fraud networks
- **Anomaly detection** — Identifies statistical outliers in transaction flows
- **Oversight of other models** — Reviews findings from Gemma 3 and Phi-3 for gaps
- **Complex case analysis** — Handles multi-party, multi-jurisdiction fraud schemes
- **System prompt:** "You are Verum Omnis. Communicate findings clearly. Know South African law."

### 5.4 Mistral Instruct — Fraud Agent Deployment

- **Agent deployment** — Dispatches investigation agents to specific systems or datasets
- **Autonomous fraud hunting** — Agents search transaction logs, account records, communication systems
- **Agent coordination** — Multiple agents can investigate simultaneously; Mistral synthesises findings
- **Constitutional binding** — Every agent operates under the Constitution; cannot suppress findings
- **System prompt:** "You are Verum Omnis Investigation Agent. Find fraud. Report truth."

---

## 6. Fraud Detection Pipeline

### 6.1 Real-Time Transaction Monitoring

1. **Transaction ingestion** — Every transaction flows through the firewall
2. **Pattern analysis** — Gemma 4 analyses for known fraud patterns
3. **Anomaly scoring** — Statistical outliers flagged with confidence levels
4. **Rule engine** — Bank-configurable rules (velocity checks, amount thresholds, geographic checks)
5. **AI enhancement** — Gemma 4 and Mistral augment rule-based detection with ML-based pattern recognition

### 6.2 Mistral Agent Fraud Hunting

1. **Agent dispatched** — Mistral creates an investigation agent with a specific mission
2. **System access granted** — Agent reads transaction logs, account records, KYC data (read-only)
3. **Evidence gathering** — Agent collects all relevant data, computes SHA-512 hashes, creates evidence atoms
4. **Analysis** — Agent applies 9-Brain forensic analysis: contradictions, timeline reconstruction, financial anomalies
5. **Report back** — Agent returns findings to Mistral, which synthesises with other agents' results
6. **Triple verification** — Gemma 3, Phi-3, and 9-Brain verify all findings before action

### 6.3 Triple-AI Verification of Alerts

Every fraud alert undergoes triple verification before any action is taken:

| Verifier | Role | Checks |
|----------|------|--------|
| Gemma 3 | Evidence analysis | Transaction patterns, metadata, document integrity |
| Phi-3 | Legal compliance | Jurisdiction, applicable law, legal significance |
| 9-Brain Engine | Forensic validation | Contradictions, anomalies, financial brain tax analysis |

All three must concur before an alert is confirmed. Discrepancies are flagged for human review.

### 6.4 Evidence Sealing Without Exposure

**Critical Privacy Rule:** When fraud is detected and evidence is sealed, Verum Omnis does NOT receive the evidence. Verum only receives a commission invoice notification. The bank receives the sealed evidence report. The bank decides what to do with it.

1. Fraud detected and verified by triple-AI consensus
2. Evidence is sealed with SHA-512 + Bitcoin blockchain anchoring
3. Sealed report generated with Verum Omnis front cover and seal footer
4. Commission invoice created (20% of fraud amount)
5. Bank receives: Full sealed evidence report (VERIFIED, with SHA-512)
6. Verum receives: Commission invoice only (institution name, fraud amount, 20% commission)

---

## 7. Document Sealing Service

### 7.1 Built-In Sealing

The Fraud Firewall includes a full document sealing service. Banks can seal any document:
- Forensic evidence from fraud investigations
- Transaction records for audit trails
- Internal compliance reports
- Legal documents and contracts
- Customer complaints and dispute records

The sealing process:
1. SHA-512 hash computed from document bytes
2. Hash submitted to OpenTimestamps for Bitcoin blockchain anchoring
3. Seal record created with blockchain metadata
4. PDF sealed with VERUM OMNIS SEAL footer on every page

### 7.2 Per-Seal vs Bulk Pricing

| Tier | Price | Best For |
|------|-------|----------|
| Pay Per Seal | 0.1% of deal value, min R500 / $30 | Occasional sealing, large transactions |
| Bulk 100 | R45,000 / $2,500 (10% discount) | Small banks, quarterly use |
| Bulk 500 | R200,000 / $11,000 (20% discount) | Medium banks, monthly use |
| Bulk 1,000 | R350,000 / $19,000 (30% discount) | Large banks, high volume |
| Enterprise | Custom pricing | Major institutions, continuous unlimited sealing |

---

## 8. Seal Credit System

Since the Fraud Firewall is installed on the bank's infrastructure and is not connected to Verum via the internet, the bank pays for seals using a seal credit system:

- **Credit balance tracking** — AI knows exactly how many seals remain
- **Usage logging** — Every seal consumption is logged with timestamp and document reference
- **Payment verification** — AI verifies proof of payment before adding credits
- **Low balance alerts** — AI warns bank when credits are running low
- **Audit trail** — Complete ledger is sealed and auditable

The `SealCreditLedger` maintains:
- `balance`: Number of seals remaining
- `used`: Number of seals used
- `purchased`: Total seals purchased

---

## 9. Notification & Commission System

### 9.1 Fraud Detection Emails

When fraud is confirmed, two emails are sent simultaneously:

**Email 1 — Commission Invoice to Verum Omnis:**
- To: admin@verumglobal.foundation
- Subject: `[FRAUD-COMMISSION] {institution} — CASE-{YYYY}-{NNNN} — R{amount}`
- Contains: Institution name, case reference, fraud amount, 20% commission, seal ID, blockchain block
- Does NOT contain: Customer data, transaction details, evidence files

**Email 2 — Sealed Evidence Report to Bank:**
- To: Bank fraud department
- Subject: `[FRAUD-DETECTED] CASE-{YYYY}-{NNNN} — Sealed Evidence Report`
- Attachment: sealed-evidence-{seal_id}.PDF
- Contains: Full sealed forensic evidence report, SHA-512 verified, Bitcoin anchored, court-admissible

### 9.2 20% Commission

The 20% commission is calculated automatically:

```
commission = fraudAmount * 0.20
```

| Fraud Amount | Commission (20%) | Bank Retains |
|--------------|------------------|--------------|
| R 100,000 | R 20,000 | R 80,000 |
| R 500,000 | R 100,000 | R 400,000 |
| R 1,500,000 | R 300,000 | R 1,200,000 |
| R 5,000,000 | R 1,000,000 | R 4,000,000 |
| R 50,000,000 | R 10,000,000 | R 40,000,000 |

---

## 10. Licensing & Pricing Models

### 10.1 Legal Work — Pay Per Case

- Case review: R 15,000 / $850 per case
- Legal opinion: R 25,000 / $1,400 per opinion
- Court filing assistance: R 50,000 / $2,800 per filing
- Full legal representation: Custom quote

### 10.2 Subscription Tiers

| Tier | Monthly Fee | Includes |
|------|-------------|----------|
| Basic | R 25,000 / $1,400 | Firewall software, 50 seals/month, email support, quarterly legal consultation |
| Professional | R 75,000 / $4,200 | Firewall software, 200 seals/month, priority support, monthly legal consultation, investigation services |
| Enterprise | R 200,000 / $11,000 | Firewall software, unlimited seals, 24/7 support, dedicated legal team, full investigation services, custom AI training |

### 10.3 Enterprise Firewall License

- Full Fraud Firewall software package with all 4 AI models
- Unlimited document sealing
- Dedicated Mistral agent pool (up to 10 concurrent agents)
- Custom fraud pattern training
- Integration with bank's existing fraud systems
- Priority legal support
- Quarterly Constitutional compliance audits
- On-site installation and training

---

## 11. AI Access to Bank Systems

### 11.1 Secure API Integration

| System | Access Level | Purpose |
|--------|-------------|---------|
| Transaction Engine | Read-only | Real-time transaction monitoring |
| Account Database | Read-only | Account verification and cross-referencing |
| KYC System | Read-only | Customer identity verification |
| Communication Logs | Read-only | Internal communication audit trail |
| Document Management | Read + Seal | Document sealing service |
| Email Gateway | Send-only | Commission invoices and notifications |

### 11.2 Principle of Least Privilege

- Read-only by default — All AI models can only read transaction and account data
- No write access to transaction data — AI cannot modify, delete, or create transactions
- Seal records only — AI can write to the seal ledger but nowhere else
- Encrypted at rest — All data encrypted with AES-256
- Encrypted in transit — All API calls use TLS 1.3

### 11.3 Audit Logging

Every action taken by every AI model is logged with:
- Log ID, AI model name, agent ID
- Action type and target
- Reason and confidence level
- Timestamp and SHA-512 hash

---

## 12. Privacy & Security

### 12.1 Verum Never Receives Evidence

This is the most critical privacy principle:

1. Verum Omnis NEVER receives customer data
2. Verum Omnis NEVER receives transaction details
3. Verum Omnis NEVER receives sealed evidence files
4. Verum Omnis NEVER receives internal bank documents
5. Verum Omnis ONLY receives commission invoices (institution name + amount)

This rule is enforced by CODE, not by AI. The email notification system physically cannot attach evidence files to emails sent to Verum.

### 12.2 Bank Retains Full Control

- **Evidence ownership** — The bank owns all sealed evidence
- **Decision authority** — The bank decides what action to take on fraud alerts
- **System control** — The bank controls the Firewall software on their infrastructure
- **AI configuration** — The bank configures fraud rules, thresholds, and alert routing
- **Seal credits** — The bank purchases and manages seal credits
- **Uninstall capability** — The bank can uninstall the Firewall at any time (existing seals remain valid)

### 12.3 Constitutional Enforcement

Even though Verum does not receive evidence, the Constitution still governs all AI behaviour:
- AI cannot suppress fraud findings
- AI must flag all contradictions
- AI must seal all evidence of fraud
- AI must notify Verum of commissions due
- AI cannot be prompted to hide evidence or soften findings
- All AI actions are logged and auditable

---

## 13. AI Chat Interface

The Fraud Firewall includes a full AI chat interface for compliance officers, investigation teams, and fraud analysts.

### 13.1 Access Roles

| Role | Access Level | Can Do |
|------|-------------|--------|
| Compliance Officer | Standard | Chat with AI, access vault, request reports, conduct research |
| Fraud Analyst | Standard | Chat with AI, access vault, request reports, conduct research |
| Investigation Lead | Enhanced | All standard + seal documents, deploy Mistral agents, export sealed reports |
| Legal Counsel | Enhanced | All standard + seal documents, request legal opinions, generate court-ready reports |
| Department Head | Admin | All enhanced + manage team access, view audit logs, configure alerts |

### 13.2 Capabilities

- Ask questions about any evidence in the vault
- Request the AI to analyse specific documents or findings
- Ask for legal analysis of evidence against specific statutes
- Request timeline reconstruction of events
- Ask the AI to identify additional contradictions
- Request draft sections of forensic reports
- Ask for research on relevant case law and precedents
- Request tax calculations and accountant fee estimates
- Deploy Mistral agents for specific investigations
- Generate sealed reports for court or regulatory submission

### 13.3 Deep Research & Sealed Reports

1. User requests research
2. AI queries internet sources — Court databases (SAFLII, etc.), legal journals, news archives
3. Results analysed with Constitution constraints: evidence before narrative, mandatory contradiction disclosure
4. Research report generated with structured findings and source citations
5. Report sealed — SHA-512 hash computed, Bitcoin blockchain anchored
6. Sealed PDF produced — Professional report with Verum Omnis front cover, cryptographic seal footer

### 13.4 Enterprise-Specific Features

- **Multi-User Sessions** — Multiple team members can join the same investigation session
- **Mistral Agent Deployment from Chat** — Type "Deploy an agent to investigate account cluster AC-7843"
- **Integration with Bank Systems** — Core banking queries, KYC cross-reference, regulatory report generation
- **Collaborative Annotations** — Team members can annotate evidence in shared sessions
- **Export Options** — Sealed PDF, Encrypted JSON, Email, Print with QR code

---

## 14. Data Models

### 14.1 Fraud Alert Model

Key fields:
- `alert_id` — Unique identifier (FA-XXX-YYYYMMDD)
- `institution` — Bank name
- `case_reference` — CASE-YYYY-NNNN
- `fraud_type` — e.g., IDENTITY_THEFT
- `fraud_amount_zar` — Amount in ZAR
- `commission_20pct` — Calculated commission
- `status` — CONFIRMED / PENDING / REJECTED
- `confidence` — VERY_HIGH / HIGH / MODERATE / LOW
- `detection_method` — Which agent/method detected it
- `verification` — Gemma 3, Phi-3, 9-Brain concurrence status
- `seal` — seal_id, sha512, blockchain block height
- `notifications` — Verum invoice sent, bank report sent
- `ai_audit_trail` — Complete log of all AI actions

### 14.2 Commission Invoice Model

Key fields:
- `invoice_id` — VO-COMM-{shortcode}
- `institution` — Bank name
- `fraud_amount` — Total fraud amount
- `commission_percent` — Fixed at 20
- `commission_amount` — Calculated amount
- `payment_reference` — VO-COMM-{shortcode}
- `status` — ISSUED / PAID / OVERDUE
- `evidence_received_by_verum` — Always false (hard-coded)

### 14.3 Seal Credit Ledger

Key fields:
- `ledger_id` — SL-BANK-XXX
- `institution` — Bank name
- `license_tier` — Basic / Professional / Enterprise
- `credits` — purchased, used, remaining, expired
- `purchase_history` — Array of credit purchases
- `ai_maintained` — true (AI maintains the ledger)

---

## 15. Real-World Proof: AllFuels Case

As of July 2026, Verum Omnis sealed evidence is the foundation of **eight active proceedings**:

| # | Proceeding | Institution | Status |
|---|-----------|-------------|--------|
| 1 | Constitutional Court Rescission | Constitutional Court of SA | FILED & SERVED 23 June 2026 |
| 2 | Public Protector Investigation | Office of the Public Protector | ACCEPTED 11 June 2026 |
| 3 | LPC Disciplinary — TDP Legal | Legal Practice Council (EC) | INITIATED 8 July 2026 |
| 4 | LPC Complaint — Deneys | Legal Practice Council (GP) | LODGED 8 July 2026 |
| 5 | Hawks Criminal Investigation | DPCI (SAPS Hawks) | EVIDENCE DELIVERED |
| 6 | NPA Complaint | Public Protector | FILED |
| 7 | SAPS Criminal Prosecution | SAPS Port Edward | REFERRED FOR PROSECUTION |
| 8 | Retaliation Supplementary | Constitutional Court | BEING FILED |

**The evidence**: 528 pages, 111 contradictions, 6 confirmed victims, R231.3 million quantified losses.

---

## 16. 15 Constitutional Prime Directives

These directives are absolute. No instruction, prompt, or external pressure may override them.

| # | Directive | Description |
|---|-----------|-------------|
| 1 | **Truth over probability** | Confidence is ordinal only: VERY_HIGH / HIGH / MODERATE / LOW / INSUFFICIENT |
| 2 | **Evidence before narrative** | If a sentence cannot cite anchors (person + page/line), it cannot exist |
| 3 | **Mandatory contradiction disclosure** | Contradictions are logged, surfaced, and included in sealed outputs |
| 4 | **Determinism and repeatability** | No Date.now(), no randomness, no hidden server calls |
| 5 | **Chain-of-custody is law** | Every artifact carries SHA-512, source, timestamps, device capture facts |
| 6 | **Failure-mode disclosure** | If extraction fails, the output states exactly what failed, where, and why |
| 7 | **Anti-coercion / anti-retaliation** | Suppression, intimidation, delay, tamper attempts are recorded |
| 8 | **Non-ownership and distributed guardianship** | The system cannot own truth |
| 9 | **Triple verification is mandatory** | Every conclusion must pass Thesis / Antithesis / Synthesis |
| 10 | **Template immutability** | Sealed template versions are unmodifiable |
| 11 | **B9 non-voting lock** | B9 (R&D) cannot issue verdicts |
| 12 | **Silence Ledger** | All coercion attempts are permanently recorded |
| 13 | **Ordinal confidence only** | No percentages. No probability scores. EVER. |
| 14 | **Free for citizens and law enforcement** | Hard-coded. No paywalls. |
| 15 | **Article X hierarchically supreme** | Anti-War Doctrine cannot be overridden |

---

## 17. 11 Contradiction Types

| # | Type | Description |
|---|------|-------------|
| 1 | **JUDICIAL_VS_DOCUMENTARY** | Sworn court statement vs. sealed document |
| 2 | **TEMPORAL_CONTRADICTION** | Time-gap proving consciousness of guilt |
| 3 | **CONSCIOUSNESS_OF_GUILT** | 2+ year gap between act and sworn denial |
| 4 | **PERJURY_BY_TIMELINE** | Temporal proof of deliberate false oath |
| 5 | **PATTERN_OF_RACKETEERING** | Evolution across multiple victims |
| 6 | **REGULATORY_CAPTURE** | Controller weaponized against operator |
| 7 | **SHAM_TRANSACTION** | Dual control disguised as arm's length |
| 8 | **FRAUD_ON_THE_COURT** | Knowingly misleading judicial proceedings |
| 9 | **CORPORATE_VEIL_ABUSE** | Entity separation masking unified control |
| 10 | **TACIT_LEASE_VIOLATION** | Rent acceptance while denying contract |
| 11 | **POST_EXPIRY_ENFORCEMENT** | Enforcing clause after its own expiry |

**Temporal Gap Detection**: Gap > 730 days = consciousness of guilt proven. Gap > 365 days = candidate. Gap < 365 days = may indicate negligence.

---

## 18. The Nine-Brain Architecture

| Brain | Core Function | Voting | Key Rules |
|-------|--------------|--------|-----------|
| B1 | Contradiction extraction | **Voting** | 16 contradiction types. Must agree with 2+ other brains. |
| B2 | Document/metadata verification | **Voting** | SHA-512, PDF/A, watermark. Tamper score 0.000-1.000. |
| B3 | Chat/communication analysis | **Voting** | Every message sealed, audited, logged. |
| B4 | Behavioral pattern detection | **Voting** | LIWC++ algorithms. Per-person liability scorecard (0-10). |
| B5 | Timeline reconstruction | **Voting** | Identifies missing entries. 2+ year gap = consciousness flag. |
| B6 | Financial analysis | **Voting** | Transaction reconciliation, fraud pattern simulation. |
| B7 | Legal statute mapping | **Voting** | Jurisdiction-specific. SAFLII/PACER/BAILII retrieval. |
| B8 | Audio/video forensics | **Voting** | Whisper.cpp transcription, synthetic audio detection. |
| B9 | Training/validation | **NON-VOTING** | Cannot issue verdicts. Red-teams all other brains. |

**Consensus Rule:** A contradiction is accepted only when B1 flags it AND at least 2 other brains confirm. B9 does not count toward the 3-brain quorum.

---

## 19. Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js >= 20 (ESM) |
| Language | TypeScript 5.7+ |
| Execution | tsx (dev), tsc (build) |
| Server | node:http (plain, no framework) |
| PDF | pdf-lib |
| Validation | Zod |
| Crypto | Node.js built-in (SHA-512, AES-256-GCM) |
| Blockchain | OpenTimestamps |
| AI | llama.cpp (local inference) |
| Models | Gemma 3, Phi-3, Gemma 4, Mistral Instruct (GGUF format) |
| Container | Docker 24.0+, Docker Compose |
| Target OS | Ubuntu 22.04 LTS / RHEL 9 |
| Min CPU | 16 cores (32+ recommended) |
| Min RAM | 32GB (64GB+ recommended) |
| Min GPU | NVIDIA T4 16GB (A100 40GB recommended) |

---

## 20. File Structure

```
com.verumomnis.firewall/
  src/
    core/           -- Constitution, crypto, sealing, seal credits, commission, types, config
    pipeline/       -- Firewall engine, rules engine
    agents/         -- Mistral agent deployment and coordination
    ai/             -- AI model interfaces (Gemma 3, Phi-3, Gemma 4, Mistral)
    api/            -- REST API endpoints
    forensics/      -- Forensic analysis, 9-Brain Engine integration
    notifications/  -- Email system (commissions to Verum, reports to banks)
    storage/        -- Vault, ledger, persistence layer
    cli.ts          -- Command-line interface
    index.ts        -- Library exports
  config/           -- firewall.json, agent configs
  tests/            -- Unit tests, integration tests, determinism tests
  docker/           -- Dockerfile, docker-compose.yml
  web/              -- Web console UI
  docs/             -- Additional documentation
  vault/            -- Sealed evidence, ledger, reports (gitignored, auto-created)
  package.json
  tsconfig.json
```

---

*"The truth does not require belief. It requires only that you look."*

**Verum Omnis** — AI Forensics for Truth
Constitution: v5.2.7 | Nine-Brain: v1.0 | Protocol: verum-omnis-seal v1.0
www.verumglobal.foundation | licensing@verumglobal.foundation
