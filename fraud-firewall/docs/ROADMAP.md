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
| OpenTimestamps anchoring | IV, §6.2 | 🟡 deterministic mock + `.ots` proof |
| Email delivery | V | 🟡 writes queued JSON (no SMTP) |
| Real local LLMs (Gemma/Phi/Mistral) | II | 🟡 deterministic heuristics |
| Sealed-report content: timeline, offence matrix, financial analysis | V §5.3 | 🟡 Phase 1 |
| Licensing / pricing tiers | VI, IV §4.3 | ⛔ |
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

### Phase 2 — Real blockchain anchoring
- Real OpenTimestamps submit/upgrade + Bitcoin confirmation lookup; offline fallback flag.
- Optional PDF/A-3B conformance + embed original evidence (§5.3).
- Dep: OTS network egress. Risk: medium.

### Phase 3 — Notifications + licensing/pricing
- Real SMTP "send-only" email gateway behind `NotificationService` (VII), with delivery audit.
- Pricing tables + subscription tiers (Basic/Professional/Enterprise), per-seal vs bulk, license-tier enforcement (VI, §4.3).
- Dep: SMTP credentials. Risk: medium.

### Phase 4 — Bank system integration
- Read-only connectors (Transaction Engine, Account DB, KYC, Comms logs) behind a `BankSource` interface + dev mock; data-access controls; per-access audit logging; wire Mistral agents to real sources (VII §7.1–7.4, VIII).
- Dep: bank API access/credentials. Risk: high.

### Phase 5 — Real local LLMs
- Adapter so real Gemma 4/3, Phi-3, Mistral back `ConstitutionalModel`/agents/chat; deterministic remains default/fallback (II).
- Dep: model runtime/hardware. Risk: high.

### Phase 6 — Deployment & hardening
- Cloud manifests (compose/k8s), system-requirements doc, API auth, health/metrics/observability (IX).

## External prerequisites (gate Phases 2–5)
OpenTimestamps egress · SMTP credentials · local-LLM runtime/hardware · bank API access. Provide as secrets/egress when starting those phases.
