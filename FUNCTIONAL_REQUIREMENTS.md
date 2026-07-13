# Functional Requirements — Verum Omnis Guardian Fraud Firewall

**Document Purpose:** How every endpoint and function should behave.

**Version:** 5.2.7
**Last Updated:** 2026-07-13

---

## FR-1: Transaction Monitoring

### FR-1.1: Transaction Ingestion
- The system SHALL accept transaction data via `POST /v1/monitor`
- Input SHALL be validated with Zod schema
- Invalid input SHALL return HTTP 400 with error details
- Valid input SHALL enter the FirewallPipeline
- The endpoint SHALL respond within 500ms for rule-only evaluation

### FR-1.2: Rule Evaluation
- The system SHALL evaluate all configured rules for every transaction
- Rules SHALL include: velocity, amount, geographic, pattern, temporal
- Each rule SHALL return: PASS, FAIL, or SUSPICIOUS
- Failed rules SHALL trigger AI analysis
- Suspicious rules SHALL accumulate for batch processing
- Rule configuration SHALL be loaded from `config/firewall.json`

### FR-1.3: Alert Generation
- When rules fail, the system SHALL generate a FraudAlert
- The alert SHALL include: transaction data, failed rules, timestamp
- Alerts SHALL be stored in the Vault with SHA-512 hash
- Alert status SHALL be: PENDING, CONFIRMED, or REJECTED

---

## FR-2: AI Analysis

### FR-2.1: Nine-Brain Engine
- When rules fail, the Nine-Brain Engine SHALL activate
- All 9 brains SHALL process the evidence
- B1 SHALL extract contradictions
- B2 SHALL verify document/metadata integrity
- B3 SHALL analyse communications
- B4 SHALL detect behavioral patterns
- B5 SHALL reconstruct timelines
- B6 SHALL analyse financial data
- B7 SHALL map to legal statutes
- B8 SHALL analyse audio/video (if present)
- B9 SHALL red-team all findings

### FR-2.2: Triple-AI Consensus
- Before confirming an alert, triple verification SHALL occur
- Gemma 3 SHALL verify evidence (Thesis)
- Phi-3 SHALL verify legal compliance (Antithesis)
- 9-Brain Engine SHALL verify forensic validity (Synthesis)
- All three SHALL return CONCURS for confirmation
- Any discrepancy SHALL flag for human review

### FR-2.3: Mistral Agent Deployment
- Investigation Leads SHALL deploy agents via chat or API
- Agents SHALL have: name, scope, mission, maxConcurrent
- Agents SHALL operate under Constitutional constraints
- Agents SHALL return findings with evidence anchors
- Agent findings SHALL undergo triple verification before inclusion

---

## FR-3: Sealing Service

### FR-3.1: Document Sealing
- The system SHALL seal documents via `POST /v1/seal`
- Sealing SHALL compute SHA-512 hash of document bytes
- Sealing SHALL generate a seal ID (UUID v4)
- Sealing SHALL embed Constitution v5.2.7 as machine-readable rules
- Sealing SHALL consume one seal credit

### FR-3.2: PDF Generation
- Sealed documents SHALL be PDF/A-3B compliant
- Every page SHALL have: seal footer, classification banners
- Cover page SHALL include: logo, title, metadata, seal ID, SHA-512
- Evidence anchors SHALL render in blue monospaced font
- Severity labels SHALL render with colored backgrounds

### FR-3.3: Blockchain Anchoring
- The system SHALL submit SHA-512 hashes to OpenTimestamps
- Anchoring SHALL produce a Bitcoin block reference
- Block reference SHALL be embedded in the seal
- Verification SHALL confirm the block on the blockchain

### FR-3.4: Seal Verification
- The system SHALL verify existing seals via API
- Verification SHALL recompute and compare SHA-512
- Verification SHALL check blockchain anchor
- Verification SHALL return: VERIFIED or TAMPERED

---

## FR-4: Notification System

### FR-4.1: Commission Invoice to Verum
- On fraud confirmation, the system SHALL send commission email to Verum
- Email SHALL include: institution name, fraud amount, 20% commission
- Email SHALL NOT include: customer data, transaction details, evidence
- Subject SHALL be: `[FRAUD-COMMISSION] {institution} — CASE-{ref} — R{amount}`
- Email SHALL be sent via configured SMTP server

### FR-4.2: Sealed Report to Bank
- On fraud confirmation, the system SHALL send sealed report to bank
- Email SHALL include: case reference, fraud amount, seal ID
- Email SHALL attach: sealed-evidence-{seal_id}.PDF
- Subject SHALL be: `[FRAUD-DETECTED] CASE-{ref} — Sealed Evidence Report`
- Email SHALL be sent to bank's fraud department

### FR-4.3: Privacy Wall
- The `sendToVerum()` function SHALL only accept CommissionInvoice objects
- The `sendToVerum()` function SHALL NOT accept SealedReport objects
- This constraint SHALL be enforced at compile time
- Attempts to send evidence to Verum SHALL fail with constitutional error

---

## FR-5: Commission System

### FR-5.1: Commission Calculation
- Commission SHALL be 20% of confirmed fraud amount
- Calculation SHALL be: `fraudAmount * 0.20`
- This rate SHALL be hard-coded (not configurable)
- Calculation SHALL use exact decimal arithmetic (no floating point errors)

### FR-5.2: Invoice Generation
- The system SHALL generate invoices automatically on fraud confirmation
- Invoice SHALL include: institution, case ref, fraud amount, commission, payment ref
- Payment reference SHALL be: `VO-COMM-{shortcode}`
- Due date SHALL be: detection date + 30 days
- Status SHALL be: ISSUED (initial), PAID, or OVERDUE

### FR-5.3: Invoice Tracking
- The system SHALL track invoice status
- Status transitions: ISSUED -> PAID, ISSUED -> OVERDUE
- OVERDUE invoices SHALL trigger follow-up notifications
- All status changes SHALL be logged in the audit trail

---

## FR-6: Seal Credit Management

### FR-6.1: Credit Ledger
- The system SHALL maintain a seal credit ledger per institution
- Ledger SHALL track: purchased, used, remaining, expired
- Ledger SHALL be AI-maintained (Gemma 3 and Gemma 4)
- Ledger SHALL be sealed and auditable

### FR-6.2: Credit Consumption
- Each seal operation SHALL consume exactly one credit
- If balance <= 0, seal SHALL fail with INSUFFICIENT_CREDITS
- Consumption SHALL be atomic (no race conditions)
- Consumption SHALL be logged with timestamp and document reference

### FR-6.3: Credit Purchase
- Credits SHALL be purchased via `POST /v1/credits/purchase`
- Purchase SHALL require payment proof
- AI SHALL verify payment proof before adding credits
- Purchase SHALL be logged in the ledger

### FR-6.4: Low Balance Alerts
- When balance drops below 10% of last purchase, system SHALL alert
- Alert SHALL be sent to bank administrators
- Alert SHALL include: current balance, seals used this month, suggested purchase

---

## FR-7: API Endpoints

### FR-7.1: POST /v1/monitor
- Accepts: Transaction data (JSON)
- Returns: `{ alertId, status, findings, confidence }`
- Auth: API key required
- Rate limit: 1000 requests/minute per institution

### FR-7.2: POST /v1/seal
- Accepts: Document (binary) + metadata (JSON)
- Returns: `{ sealId, sha512, blockHeight, pdfUrl }`
- Auth: API key + Investigation Lead role
- Consumes: 1 seal credit

### FR-7.3: GET /v1/status
- Returns: `{ version, status, pipelineState, creditBalance, modelStatus }`
- Auth: None (public health check)
- Rate limit: 60 requests/minute

### FR-7.4: GET /v1/ledger
- Returns: `{ purchased, used, remaining, expiryDate, history }`
- Auth: API key required
- Rate limit: 60 requests/minute

### FR-7.5: GET /v1/alerts
- Returns: Array of FraudAlert objects
- Auth: API key required
- Supports: pagination, filtering by date/status/severity

### FR-7.6: POST /v1/agents/deploy
- Accepts: `{ name, scope, mission, maxConcurrent }`
- Returns: `{ agentId, status, estimatedCompletion }`
- Auth: API key + Investigation Lead role
- Rate limit: 10 deployments/minute

---

## FR-8: Authentication & Authorization

### FR-8.1: API Key Authentication
- All endpoints except `/v1/status` SHALL require API key
- API key SHALL be in `X-API-Key` header
- Invalid keys SHALL return HTTP 401
- Keys SHALL be institution-scoped

### FR-8.2: Role-Based Access
- Compliance Officer: Standard chat, vault read, reports
- Fraud Analyst: Standard chat, vault read, reports
- Investigation Lead: Enhanced — seal, deploy agents, export reports
- Legal Counsel: Enhanced — seal, legal opinions, court-ready reports
- Department Head: Admin — manage access, view audit logs, configure alerts

### FR-8.3: Session Management
- Sessions SHALL expire after 8 hours of inactivity
- Multi-user sessions SHALL share context
- Role escalation SHALL require Department Head approval

---

## FR-9: Web UI

### FR-9.1: Dashboard
- SHALL display: credit balance, recent alerts, system status
- SHALL update in real-time (WebSocket or polling)
- SHALL support filtering and searching alerts

### FR-9.2: Chat Interface
- SHALL support natural language queries
- SHALL load vault files into context
- SHALL cite evidence anchors in responses
- SHALL support file upload for analysis

### FR-9.3: Alert Viewer
- SHALL display alert details with evidence
- SHALL show contradiction matrix
- SHALL show timeline reconstruction
- SHALL support exporting sealed reports

### FR-9.4: Agent Management
- SHALL list active agents
- SHALL show agent status and findings
- SHALL allow deploying new agents
- SHALL allow terminating running agents

---

*"The truth does not require belief. It requires only that you look."*

**Verum Omnis** — AI Forensics for Truth
