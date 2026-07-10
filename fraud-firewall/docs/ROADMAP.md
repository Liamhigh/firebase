# Guardian Fraud Firewall — Completion Roadmap

Scope: `VO-FIREWALL-SPEC-5.2.7-2026` (Parts I–X). Android-app–only features
(standalone tax module, AI compliance chat) are **out of scope**; timeline
reconstruction, offence matrix, and financial analysis remain in scope because
§5.3 requires them as sealed-report content.

## Status legend
✅ done · 🟡 partial · ⛔ not started

## Current state (matches spec)

| Area | Spec | Status |
|---|---|---|
| Architecture, Constitution-through-seal | I | ✅ |
| Detection pipeline (rules → Gemma4 → Mistral agents → triple-AI) | II, III | ✅ (deterministic stand-ins) |
| Document sealing (SHA-512 last, blue forensic PDF, watermark, QR, logo) | IV, §6 | ✅ |
| Seal credit ledger + AI record-keeping | IV §4.2/§4.4 | ✅ |
| Commission (20%) + code-enforced privacy | V, VIII | ✅ |
| Data models & HTTP API | X | ✅ |
| Evidence atoms + structured contradictions | (report content) | ✅ |
| OpenTimestamps anchoring | IV, §6.2 | ✅ real calendar stamping + Bitcoin confirmation (mock fallback) |
| Email delivery | V | ✅ real SMTP send (nodemailer) + queued JSON audit; privacy preserved |
| Real local LLMs (Gemma/Phi/Mistral) | II | ✅ LLM adapter (Ollama) for narrative; deterministic core unchanged. Needs a model on the laptop. |
| Sealed-report content: timeline, offence matrix, financial analysis | V §5.3 | 🟡 Phase 1 |
| Licensing / pricing (universal 20% model + free tiers) | VI, business constitution | ✅ pricing engine + quotes; SMTP delivery still pending |
| Bank system integration (read-only APIs) | VII | ⛔ (in-memory buffer) |
| Cloud deployment / system requirements | IX | 🟡 on-prem Docker only |

## Phases

### Phase 1 — Complete the sealed report + detection (offline, no external deps)
- Timeline reconstruction from evidence atoms / transactions.
- Offence matrix from contradictions and fraud signals (legal basis + anchors + confidence).
- Financial-analysis and court-ready-declaration sections in the sealed report (§5.3).
- Verify-by-PDF: look up a seal from the uploaded file's SHA-512 (no seal id required).
- Broaden detection heuristics across `FraudType`s.
- Touches: `forensics/`, `pipeline/`, `core/verification.ts`, `api/server.ts`, `web/`. Risk: low.

### Phase 2 — Real blockchain anchoring ✅ DONE
- ✅ Real OpenTimestamps stamping to public calendars on seal (`core/opentimestamps.ts`),
  storing a real binary `.ots` proof; `config.ots.mode` (`live`/`mock`) with automatic
  offline fallback to the deterministic mock.
- ✅ Verification upgrades the proof and detects the Bitcoin attestation: genuine
  PENDING until confirmation, CONFIRMED with real block height once anchored.
- ⛔ (remaining) Optional PDF/A-3B conformance + embed original evidence (§5.3).
- Dep: OTS network egress. Risk: medium.

### Phase 3 — Notifications + licensing/pricing
- ✅ **Pricing engine** (`core/pricing.ts`): universal **20% share** model per the business
  constitution — fraud recovery (20% of value prevented), legal services (20% of local
  lawyer fees, geographically benchmarked), AI-company subscription (20% of turnover),
  any commercial engagement (20%). Private individuals + SAPS permanently **free**; data
  never sold. `GET /v1/pricing`, `POST /v1/pricing/quote`, console Pricing panel.
- ✅ **Real SMTP delivery** (`notifications/email.ts` via nodemailer): async `dispatch`
  sends over SMTP when configured and always writes the queued JSON audit record.
  Bank emails carry the sealed-PDF attachment; Verum emails never carry evidence
  (code-enforced). Enable by setting env secrets: `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (a bank SMTP relay works).
  Without them it safely falls back to queued JSON. Verified end-to-end against a
  local SMTP server.
- ⏸ Bank document-sealing subscriptions — to be discussed (per operator).

### Phase 4 — Bank system integration
- Read-only connectors (Transaction Engine, Account DB, KYC, Comms logs) behind a `BankSource` interface + dev mock; data-access controls; per-access audit logging; wire Mistral agents to real sources (VII §7.1–7.4, VIII).
- Dep: bank API access/credentials. Risk: high.

### Phase 5 — Real local LLMs ✅ ADAPTER DONE
- ✅ `ai/llm.ts`: `LlmProvider` abstraction with an **Ollama** provider (small models like
  `phi3` / `gemma2:2b` on a laptop) and a `DeterministicProvider` default; factory driven
  by `config.ai.mode`/`config.ai.llm`. `FraudFirewall.aiNarrative` + `POST /v1/ai/summary`
  + console **AI Assist** panel. Any LLM error/timeout falls back to a deterministic summary.
- ✅ Detection / contradictions / timeline / offences / sealing remain **deterministic**
  (constitutional requirement) — the LLM only writes narrative.
- To use a real model on the laptop: install Ollama, `ollama pull phi3`, then set
  `ai.mode: "external"` and `ai.llm = { provider: "ollama", base_url: "http://localhost:11434", model: "phi3" }`.
- Remaining: optionally let the LLM also back agent/chat roles.

### Phase 6 — Deployment & hardening
- Cloud manifests (compose/k8s), system-requirements doc, API auth, health/metrics/observability (IX).

## External prerequisites (gate Phases 2–5)
OpenTimestamps egress · SMTP credentials · local-LLM runtime/hardware · bank API access. Provide as secrets/egress when starting those phases.
