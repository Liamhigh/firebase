# Architecture — Verum Omnis Guardian Fraud Firewall

**Document Purpose:** System architecture, data flows, component communication, and deployment topology.

**Version:** 5.2.7
**Last Updated:** 2026-07-13

---

## 1. Architecture Overview

The Fraud Firewall uses a 6-layer pipeline architecture. All layers are stateless except the Storage Layer. All processing is deterministic (same input = same output).

```
+-------------------------------------------------------------+
|                    LAYER 0: DATA INGESTION                   |
|  Bank Transaction Engine -> FirewallPipeline.ingest()       |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    LAYER 1: RULE ENGINE                      |
|  Configurable rules (velocity, amount, geo) + AI patterns   |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    LAYER 2: AI ANALYSIS                      |
|  Nine-Brain Engine + Triple-AI Consensus (G3/PHI3/9-Brain)  |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    LAYER 3: SEALING SERVICE                  |
|  SHA-512 -> OpenTimestamps -> PDF sealing -> Seal footer    |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    LAYER 4: NOTIFICATION                     |
|  -> Verum: Commission invoice (no evidence)                 |
|  -> Bank: Sealed evidence report (full evidence)            |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    LAYER 5: STORAGE                          |
|  Vault (sealed docs), Ledger (credits), Audit log (actions) |
+-------------------------------------------------------------+
```

---

## 2. Layer 0: Data Ingestion

### Components
- `src/pipeline/firewall.ts` — `FirewallPipeline.ingest()`
- `src/api/` — REST endpoints (`POST /v1/monitor`)

### Input
Transaction data from the bank's transaction engine:
```typescript
interface Transaction {
  id: string;
  timestamp: number; // injected, not Date.now()
  amount: number;
  currency: string;
  sourceAccount: string;
  destinationAccount: string;
  type: TransactionType;
  metadata: Record<string, unknown>;
}
```

### Flow
1. Bank's transaction engine sends transaction to `POST /v1/monitor`
2. API layer validates with Zod schema
3. Transaction enters `FirewallPipeline.ingest()`
4. Timestamp is injected from the caller (not generated internally)

---

## 3. Layer 1: Rule Engine

### Components
- `src/pipeline/rules.ts` — `RuleEngine`
- `config/firewall.json` — Bank-configurable rules

### Rule Types
| Rule | Description | Example |
|------|-------------|---------|
| Velocity | Transactions per time window | >50 transactions in 60 seconds |
| Amount | Transaction amount thresholds | >R100,000 in single transaction |
| Geographic | Geographic anomaly detection | Transaction from blocked country |
| Pattern | Known fraud pattern matching | Layering structure detected |
| Temporal | Time-based anomaly | Transactions at unusual hours |

### Flow
1. `RuleEngine.evaluate(transaction)` applies all configured rules
2. Each rule returns: PASS, FAIL, or SUSPICIOUS with confidence
3. Failed rules trigger AI analysis (Layer 2)
4. Suspicious rules accumulate for batch analysis

---

## 4. Layer 2: AI Analysis

### Components
- `src/pipeline/firewall.ts` — Pipeline orchestrator
- `src/ai/` — AI model interfaces
- `src/agents/mistral.ts` — Agent deployment
- `src/forensics/` — Nine-Brain Engine integration

### Nine-Brain Analysis
When rules trigger, the Nine-Brain Engine activates:

```
Transaction -> B1 (contradictions) -> B2 (metadata) -> B3 (comms)
     -> B4 (behavioral) -> B5 (timeline) -> B6 (financial)
     -> B7 (legal) -> B8 (audio/video) -> B9 (validation)
```

### Triple-AI Consensus
Before any alert is confirmed, three verifiers must concur:

| Verifier | Model | Checks |
|----------|-------|--------|
| Thesis | Gemma 3 | Evidence analysis, patterns, metadata |
| Antithesis | Phi-3 | Legal compliance, jurisdiction, statutes |
| Synthesis | 9-Brain Engine | Forensic validation, contradictions, anomalies |

All three return CONCURS -> Alert is CONFIRMED.
Any discrepancy -> Flagged for human review.

### Mistral Agent Deployment
For deep investigation, Mistral deploys autonomous agents:
```typescript
// Agent types
TransactionMonitor — Real-time transaction pattern analysis
AccountProfiler — Account behavior anomaly detection
CommunicationAudit — Internal communication fraud indicators
```

---

## 5. Layer 3: Sealing Service

### Components
- `src/core/sealing.ts` — `SealingService`
- `src/core/crypto.ts` — SHA-512, AES-256-GCM

### Flow
1. `SealingService.seal(document, findings)` called after AI consensus
2. SHA-512 hash computed from document bytes
3. Hash submitted to OpenTimestamps for Bitcoin blockchain anchoring
4. PDF generated with:
   - Verum Omnis front cover (logo, classification, metadata)
   - 14-section forensic report content
   - Seal footer on every page
   - Classification banners on every page
5. One seal credit consumed from ledger

### Seal Footer Format
```
VERUM OMNIS SEAL | seal-{uuid} | {hash-first-16} | {page-hash} | Page X/Y
```

---

## 6. Layer 4: Notification

### Components
- `src/notifications/` — `NotificationService`
- Email templates (commission, report)

### Dual Email System

**Path A: Commission Invoice to Verum**
```
 findings -> InvoiceGenerator -> Commission email -> admin@verumglobal.foundation
 (institution name, fraud amount, 20% commission only)
```

**Path B: Sealed Report to Bank**
```
 findings -> ReportGenerator -> Sealed PDF -> Bank fraud department
 (full evidence, all findings, complete forensic analysis)
```

### Privacy Wall
The `NotificationService` has a compile-time constraint:
- `sendToVerum()` can only send `CommissionInvoice` objects
- `sendToBank()` can send `SealedReport` objects
- `sendToVerum()` physically cannot attach sealed evidence

---

## 7. Layer 5: Storage

### Components
- `src/storage/` — Vault, Ledger, AuditLog
- `fraud-firewall/vault/` — Filesystem storage (gitignored)

### Vault
- Stores sealed PDF documents
- SHA-512 indexed for fast lookup
- AES-256-GCM encrypted at rest
- Append-only (no deletion of sealed documents)

### Ledger
- Stores seal credit transactions
- AI-maintained (Gemma 3 and Gemma 4)
- SHA-512 hashed for integrity
- Tracks: purchased, used, remaining, expired

### Audit Log
- Records every action by every AI model
- Append-only, cryptographically linked
- Entry format: `{ model, action, target, timestamp, sha512 }`

---

## 8. API Contract

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/monitor` | Submit transaction for monitoring |
| POST | `/v1/seal` | Seal a document |
| GET | `/v1/status` | System health and pipeline status |
| GET | `/v1/ledger` | Seal credit balance (auth required) |
| GET | `/v1/alerts` | List fraud alerts (auth required) |
| GET | `/v1/alerts/{id}` | Get specific alert details |
| POST | `/v1/agents/deploy` | Deploy Mistral agent (auth required) |
| GET | `/v1/agents` | List active agents |
| POST | `/v1/credits/purchase` | Purchase seal credits |

### Authentication
- API key in `X-API-Key` header
- Role-based: Compliance Officer, Analyst, Lead, Counsel, Head
- Rate limiting per institution

---

## 9. Security Model

### Authentication
- API keys for service-to-service
- Role-based access for human users
- No passwords stored in code

### Authorization
- Principle of least privilege
- Read-only access to bank systems by default
- Seal records only write permission
- Email gateway send-only

### Encryption
- At rest: AES-256-GCM
- In transit: TLS 1.3
- Hashes: SHA-512

### Audit
- Every action logged
- Every log entry SHA-512 hashed
- Audit trail is append-only
- Silence Ledger for coercion attempts

---

## 10. Deployment Topology

### On-Premise
```
Bank Data Center
  -> Docker Host
    -> Fraud Firewall Container
      -> Node.js process
        -> 4 AI models (local)
        -> Vault storage (local volume)
    -> GPU Worker (optional)
      -> llama.cpp inference
    -> Bank Systems (read-only APIs)
      -> Transaction Engine
      -> Account Database
      -> KYC System
```

### Cloud (Private VPC)
```
AWS/Azure/GCP VPC
  -> Kubernetes Cluster
    -> Firewall Pods
    -> AI Model Pods (GPU nodes)
    -> Vault Storage (encrypted persistent volume)
  -> Bank Systems (private connectivity)
```

---

## 11. Component Communication

### Internal
- All communication via function calls (same process)
- No message queue needed (single-node deployment)
- Shared memory for AI model state
- File-based storage (no database required)

### External
- Bank systems: REST API (read-only)
- OpenTimestamps: HTTPS (blockchain anchoring only)
- Verum email: SMTP (commission invoices only)
- Bank email: SMTP (sealed reports)

---

*"The truth does not require belief. It requires only that you look."*

**Verum Omnis** — AI Forensics for Truth
