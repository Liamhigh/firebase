# Project Structure — Verum Omnis Guardian Fraud Firewall

**Document Purpose:** Purpose of every folder and file. Where new files belong.

**Version:** 5.2.7
**Last Updated:** 2026-07-13

---

## Repository Root

```
/
  README.md                    -- Entry point, quick start guide
  WHAT_THIS_IS.md              -- Master build reference
  PROMPT.md                    -- Main prompt for coding assistants
  AI_BUILD_INSTRUCTIONS.md     -- Coding assistant rules
  BUILD_STATUS.md              -- Feature completion matrix
  MASTER_TASK_LIST.md          -- Prioritized tasks
  CONSTITUTION.md              -- Constitutional governance
  ARCHITECTURE.md              -- System architecture
  FUNCTIONAL_REQUIREMENTS.md   -- Endpoint/function specs
  DEPENDENCIES.md              -- Libraries, SDKs, models, versions
  TEST_PLAN.md                 -- Test specifications
  BUILD_RULES.md               -- Non-negotiable build rules
  PROJECT_STRUCTURE.md         -- This file
  KNOWN_BUGS.md                -- Known issues and technical debt
  DONE_CRITERIA.md             -- Completion criteria
  NINE_BRAIN_RULES.md          -- Brain-specific operational rules
  REPORT_FORMAT_SPECIFICATION.md -- Court-ready report format
  AGENTS.md                    -- AI agent operating rules
  fraud-firewall/              -- The software package
```

---

## fraud-firewall/ — The Software Package

```
fraud-firewall/
  package.json                 -- Node.js manifest, scripts, dependencies
  tsconfig.json                -- TypeScript configuration (strict mode)
  .gitignore                   -- Git ignore rules
  package-lock.json            -- Locked dependency versions

  src/                         -- TypeScript source code
    core/                      -- Core business logic (no framework deps)
    pipeline/                  -- Fraud detection pipeline
    agents/                    -- Mistral agent deployment
    ai/                        -- AI model interfaces
    api/                       -- REST API endpoints
    forensics/                 -- Forensic analysis engine
    notifications/             -- Email notification system
    storage/                   -- Vault, ledger, persistence
    cli.ts                     -- Command-line interface
    index.ts                   -- Library exports

  config/                      -- Configuration files
  tests/                       -- Test suite
  docker/                      -- Docker deployment
  web/                         -- Web console UI
  docs/                        -- Additional documentation
  vault/                       -- Sealed evidence (gitignored, auto-created)
```

---

## src/core/ — Core Business Logic

No framework dependencies. Pure TypeScript.

| File | Purpose |
|------|---------|
| `constitution.ts` | Constitution v5.2.7 loading, validation, rule embedding |
| `crypto.ts` | SHA-512 hashing, AES-256-GCM encryption/decryption |
| `sealing.ts` | PDF sealing service — footers, banners, cover pages, hash generation |
| `sealCredits.ts` | Seal credit ledger — balance, consumption, purchase, audit |
| `commission.ts` | Commission calculation — 20% hard-coded rate |
| `types.ts` | Zod schemas — FraudAlert, Invoice, Ledger, Transaction, Agent |
| `config.ts` | Configuration loading — firewall.json, env var overrides |

**Rule:** All files in `core/` must be importable without any framework. They must work in Node.js with only built-in modules.

---

## src/pipeline/ — Fraud Detection Pipeline

| File | Purpose |
|------|---------|
| `firewall.ts` | Main pipeline orchestrator — ingest, evaluate, alert, seal, notify |
| `rules.ts` | Rule engine — velocity, amount, geographic, pattern, temporal rules |

**Flow:** `ingest() -> evaluateRules() -> [if failed] -> aiAnalysis() -> seal() -> notify()`

---

## src/agents/ — Mistral Agent Deployment

| File | Purpose |
|------|---------|
| `mistral.ts` | Agent creation, deployment, coordination, constitutional binding |

**Agent Types:**
- `TransactionMonitor` — Real-time transaction pattern analysis
- `AccountProfiler` — Account behavior anomaly detection
- `CommunicationAudit` — Internal communication fraud indicators

---

## src/ai/ — AI Model Interfaces

| File | Purpose |
|------|---------|
| `gemma3.ts` | Gemma 3 interface — sealing, report writing, SHA-512 verification |
| `phi3.ts` | Phi-3 interface — legal analysis, compliance, jurisdiction mapping |
| `gemma4.ts` | Gemma 4 interface — pattern detection, oversight, anomaly correlation |
| `mistral.ts` | Mistral interface — agent deployment, investigation orchestration |
| `consensus.ts` | Triple-AI consensus — Thesis/Antithesis/Synthesis coordination |
| `loader.ts` | llama.cpp integration — GGUF model loading, inference, GPU management |

---

## src/api/ — REST API Endpoints

Plain `node:http` — no framework.

| File | Purpose |
|------|---------|
| `server.ts` | HTTP server setup, request routing, middleware |
| `routes.ts` | Route definitions — GET/POST endpoints |
| `handlers.ts` | Request handlers for each endpoint |
| `middleware.ts` | Auth, rate limiting, logging, error handling |

**Endpoints:**
- `POST /v1/monitor` — Transaction monitoring
- `POST /v1/seal` — Document sealing
- `GET /v1/status` — System health
- `GET /v1/ledger` — Seal credit balance
- `GET /v1/alerts` — Fraud alerts
- `POST /v1/agents/deploy` — Deploy Mistral agent

---

## src/forensics/ — Forensic Analysis Engine

| File | Purpose |
|------|---------|
| `nineBrain.ts` | Nine-Brain Engine orchestrator |
| `b1.ts` | B1: Contradiction extraction |
| `b2.ts` | B2: Document/metadata verification |
| `b3.ts` | B3: Chat/communication analysis |
| `b4.ts` | B4: Behavioral pattern detection |
| `b5.ts` | B5: Timeline reconstruction |
| `b6.ts` | B6: Financial analysis |
| `b7.ts` | B7: Legal statute mapping |
| `b8.ts` | B8: Audio/video forensics |
| `b9.ts` | B9: Training, validation, red-teaming |

---

## src/notifications/ — Email Notification System

| File | Purpose |
|------|---------|
| `service.ts` | NotificationService — dual email system |
| `templates.ts` | Email templates — commission invoice, sealed report |
| `smtp.ts` | SMTP transport configuration and sending |

**Dual Path:**
- `sendToVerum(invoice)` — Commission invoice only (no evidence)
- `sendToBank(report)` — Full sealed evidence report

---

## src/storage/ — Persistence Layer

| File | Purpose |
|------|---------|
| `vault.ts` | Sealed document storage — SHA-512 indexed, AES-256 encrypted |
| `ledger.ts` | Seal credit ledger — transaction log, balance tracking |
| `audit.ts` | AI action audit log — append-only, cryptographically linked |

**Storage:** File-based. No database required. Files stored in `vault/` directory.

---

## config/ — Configuration Files

| File | Purpose |
|------|---------|
| `firewall.json` | Main configuration — rules, thresholds, AI mode, SMTP |
| `agents.json` | Agent deployment configuration |
| `models.json` | AI model paths, parameters, system prompts |

---

## tests/ — Test Suite

| File | Purpose |
|------|---------|
| `core.test.ts` | Unit tests for src/core/ |
| `pipeline.test.ts` | Unit tests for src/pipeline/ |
| `sealing.test.ts` | Unit tests for sealing service |
| `agents.test.ts` | Unit tests for agent deployment |
| `integration.test.ts` | End-to-end integration tests |
| `determinism.test.ts` | Determinism validation tests |
| `constitutional.test.ts` | Constitutional compliance tests |
| `api.test.ts` | API endpoint tests |

---

## docker/ — Docker Deployment

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage Docker build |
| `docker-compose.yml` | Service orchestration |
| `.dockerignore` | Files to exclude from Docker context |

---

## web/ — Web Console UI

| File | Purpose |
|------|---------|
| `index.html` | Main HTML page |
| `styles.css` | UI styling |
| `app.js` | Frontend JavaScript |

---

## Where to Add New Files

| Type | Location | Example |
|------|----------|---------|
| Core business logic | `src/core/` | `src/core/logger.ts` |
| Pipeline stage | `src/pipeline/` | `src/pipeline/batch.ts` |
| Agent type | `src/agents/` | `src/agents/fraudHunter.ts` |
| AI model interface | `src/ai/` | `src/ai/deepseek.ts` |
| API endpoint | `src/api/` | `src/api/webhooks.ts` |
| Forensic brain | `src/forensics/` | `src/forensics/evidence.ts` |
| Notification type | `src/notifications/` | `src/notifications/slack.ts` |
| Storage backend | `src/storage/` | `src/storage/s3.ts` |
| Configuration | `config/` | `config/rates.json` |
| Test | `tests/` | `tests/security.test.ts` |

---

*"The truth does not require belief. It requires only that you look."*

**Verum Omnis** — AI Forensics for Truth
