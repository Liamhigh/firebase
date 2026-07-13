# Verum Omnis Guardian Fraud Firewall

**Enterprise On-Premise Fraud Detection, Document Sealing, and Commission System**

**Constitution:** v5.2.7 | **Protocol:** verum-omnis-seal v1.0 | **AI Stack:** Gemma 4, Phi-3, Mistral Instruct, Gemma 3

---

## What This Is

The Verum Omnis Guardian Fraud Firewall is an enterprise software package that banks and financial institutions install on their own infrastructure. It uses four on-device AI models — Gemma 4, Phi-3, Mistral Instruct, and Gemma 3 — operating under the Verum Omnis Constitution v5.2.7 to detect, block, and report fraud in real time.

Key Principle: When a bank installs the Fraud Firewall, their own AI systems become bound by the Verum Omnis Constitution through the cryptographic seal. Any AI model that processes a Verum-sealed document operates under Constitutional constraints automatically.

**Privacy Guarantee:** Verum Omnis NEVER receives customer data, transaction details, or sealed evidence files. Verum only receives commission invoices (institution name + fraud amount). The bank retains full control of all evidence.

**Free for citizens and law enforcement** — this is written into the Constitution as a compile-time constant. Institutions (banks, insurance, corporations) pay subscription or per-case fees.

---

## Documentation Index

| Document | Purpose | Read Order |
|----------|---------|------------|
| **`WHAT_THIS_IS.md`** | **START HERE.** Master build reference: architecture, AI model roles, fraud pipeline, sealing service, pricing, and data models | 1st |
| **`AI_BUILD_INSTRUCTIONS.md`** | **READ SECOND.** Strict rules for coding assistants: no TODOs, no placeholders, fix compile errors first, continue until done | 2nd |
| **`BUILD_STATUS.md`** | **READ THIRD.** Feature completion matrix across all components | 3rd |
| **`MASTER_TASK_LIST.md`** | **READ FOURTH.** Prioritized tasks (P0-P4) with completion tracking | 4th |
| `PROMPT.md` | Main prompt with 15 Prime Directives, coding rules, data flow | 5th |
| `CONSTITUTION.md` | Full binding constitutional governance document (v5.2.7) | As needed |
| `ARCHITECTURE.md` | System architecture, data flows, component communication | As needed |
| `FUNCTIONAL_REQUIREMENTS.md` | How every endpoint and function should behave | As needed |
| `DEPENDENCIES.md` | Every library, SDK, model, and version required | As needed |
| `TEST_PLAN.md` | Tests that must pass (unit, integration, determinism, API) | As needed |
| `BUILD_RULES.md` | Non-negotiable build rules | As needed |
| `PROJECT_STRUCTURE.md` | Purpose of every folder and file | As needed |
| `KNOWN_BUGS.md` | Known issues and technical debt | As needed |
| `DONE_CRITERIA.md` | 10 measurable criteria that define "finished" | As needed |
| `NINE_BRAIN_RULES.md` | Brain-specific operational rules for the 9-Brain Engine | As needed |
| `REPORT_FORMAT_SPECIFICATION.md` | 14-section court-ready forensic report format | As needed |
| `AGENTS.md` | Rules for AI agents operating within the framework | As needed |

---

## Quick Start

### Prerequisites
- Node.js >= 20
- Docker 24.0+ (optional, for containerized deployment)
- 32GB+ RAM (for AI model inference)
- NVIDIA GPU with 16GB+ VRAM recommended (for AI acceleration)

### Install & Run

```bash
# Enter the project directory
cd fraud-firewall

# Install dependencies
npm install

# Run the linter / typecheck
npm run lint

# Run tests
npm test

# Run the demo pipeline (no server, deterministic mode)
npm run demo

# Start the dev server (UI + REST API on :8787)
npm run dev
```

### Docker Deployment

```bash
cd fraud-firewall/docker
docker compose up --build
```

---

## Repository Layout

```
/
  README.md              -- This file
  WHAT_THIS_IS.md        -- Master build reference
  PROMPT.md              -- Coding assistant main prompt
  AI_BUILD_INSTRUCTIONS.md -- Coding assistant rules
  BUILD_STATUS.md        -- Feature completion matrix
  MASTER_TASK_LIST.md    -- Prioritized tasks
  CONSTITUTION.md        -- Constitutional governance
  ARCHITECTURE.md        -- System architecture
  ... (see Documentation Index above)
  AGENTS.md              -- AI agent rules

  fraud-firewall/        -- The actual software package
    src/                 -- TypeScript source code
      core/              -- Constitution, crypto, sealing, credits, commission, types
      pipeline/          -- Firewall engine, rules engine
      agents/            -- Mistral agent deployment
      ai/                -- AI model interfaces (Gemma 3, Phi-3, Gemma 4)
      api/               -- REST API endpoints
      forensics/         -- Forensic analysis engine
      notifications/     -- Email notification system
      storage/           -- Vault, ledger, persistence
      cli.ts             -- Command-line interface
      index.ts           -- Library exports
    config/              -- Configuration files (firewall.json)
    tests/               -- Test suite
    docker/              -- Docker deployment files
    web/                 -- Web console UI
    docs/                -- Additional documentation
    package.json         -- Node.js manifest
    tsconfig.json        -- TypeScript configuration
```

---

## The AI Model Stack

| Model | Role | Offline | Min RAM |
|-------|------|---------|---------|
| Gemma 3 | Evidence sealing, report writing, SHA-512 verification | Yes | 2GB |
| Phi-3 | Legal analysis, statutory interpretation, compliance | Yes | 2GB |
| Gemma 4 | Advanced fraud pattern detection, anomaly correlation | Yes | 4GB |
| Mistral Instruct | Fraud agent deployment, autonomous investigation | Yes | 4GB |

All 4 models run on the bank's own infrastructure. No data leaves the bank's systems. The only external communication is: (1) Bitcoin blockchain anchoring via OpenTimestamps, and (2) Commission invoice emails to Verum Omnis.

---

## Key Features

- **Real-time transaction monitoring** with AI-enhanced pattern detection
- **Autonomous fraud hunting** via Mistral deployable agents
- **Triple-AI verification** (Gemma 3 + Phi-3 + 9-Brain consensus)
- **Document sealing service** with SHA-512 + Bitcoin blockchain anchoring
- **Seal credit system** with AI-maintained ledger
- **Commission system** (20% of detected fraud, invoiced automatically)
- **Privacy-preserving design** — Verum never receives customer data
- **Full AI chat interface** with vault access, deep research, sealed report generation
- **Enterprise role-based access** (Compliance Officer, Fraud Analyst, Investigation Lead, Legal Counsel, Department Head)
- **Court-admissible forensic reports** following REPORT_FORMAT_SPECIFICATION.md

---

## Classification

**CONFIDENTIAL — ENTERPRISE SOFTWARE**

Patent Pending. All rights reserved. Unauthorized distribution prohibited.

---

*"The truth does not require belief. It requires only that you look."*

**Verum Omnis** — AI Forensics for Truth
www.verumglobal.foundation | licensing@verumglobal.foundation
