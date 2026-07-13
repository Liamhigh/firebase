# Known Bugs — Verum Omnis Guardian Fraud Firewall

**Document Purpose:** Known issues and technical debt. Update as bugs are found and fixed.

**Version:** 5.2.7
**Last Updated:** 2026-07-13

---

## Bug 1: AI Model Loading Not Implemented

**Severity:** HIGH
**Component:** `src/ai/`
**Status:** Open

**Description:** The llama.cpp integration for loading GGUF models is not yet implemented. The system runs in deterministic mode (`ai.mode: "deterministic"`) which uses hard-coded mock responses instead of actual AI inference.

**Impact:** The system can detect fraud using rule-based evaluation but cannot perform AI-enhanced analysis, triple verification, or generate forensic reports.

**Workaround:** Use deterministic mode for development and testing. Rule engine works fully.

**Proposed Fix:**
- Implement `src/ai/loader.ts` with llama.cpp bindings
- Download and cache GGUF models on first run
- Add GPU acceleration support (CUDA/ROCm)

---

## Bug 2: OpenTimestamps Blockchain Anchoring Not Implemented

**Severity:** HIGH
**Component:** `src/core/sealing.ts`
**Status:** Open

**Description:** The OpenTimestamps integration for Bitcoin blockchain anchoring is not yet implemented. Seals are generated with SHA-512 hashes but not anchored to the blockchain.

**Impact:** Seals cannot be verified via the Bitcoin blockchain. Timestamp attestation is missing.

**Workaround:** Seals contain SHA-512 hashes that can be manually verified. Blockchain anchoring must be added for court admissibility.

**Proposed Fix:**
- Integrate OpenTimestamps npm package
- Submit hash on seal creation
- Store block height in seal metadata

---

## Bug 3: SMTP Email Delivery Not Implemented

**Severity:** MEDIUM
**Component:** `src/notifications/`
**Status:** Open

**Description:** The SMTP transport for sending commission invoices and sealed reports is not yet implemented. Email templates exist but cannot be delivered.

**Impact:** Commission invoices and sealed reports are generated but not sent. They remain in the vault.

**Workaround:** Manual retrieval of generated reports from the vault directory.

**Proposed Fix:**
- Implement `src/notifications/smtp.ts`
- Add SMTP configuration to `config/firewall.json`
- Add email queue with retry logic

---

## Bug 4: Classification Banner Rendering Incomplete

**Severity:** LOW
**Component:** `src/core/sealing.ts`
**Status:** In Progress

**Description:** The classification banner rendering on sealed PDFs is partially implemented. Banners appear but the grey background is not rendered correctly on all pages.

**Impact:** Minor visual issue. Seal integrity is not affected.

**Workaround:** None needed — seals are still valid.

**Proposed Fix:**
- Fix PDF background rendering in pdf-lib
- Ensure banners appear on cover page, content pages, and appendix

---

## Bug 5: API Authentication Not Implemented

**Severity:** MEDIUM
**Component:** `src/api/`
**Status:** Open

**Description:** API endpoints (except `/v1/status`) do not require authentication. Role-based access control is not implemented.

**Impact:** Anyone with network access can call protected endpoints.

**Workaround:** Deploy behind a reverse proxy with basic auth.

**Proposed Fix:**
- Implement API key validation in `src/api/middleware.ts`
- Add role checking for protected endpoints
- Add rate limiting per API key

---

## Bug 6: Agent Coordination Not Implemented

**Severity:** MEDIUM
**Component:** `src/agents/mistral.ts`
**Status:** Open

**Description:** Multiple Mistral agents cannot run concurrently. Agent coordination and result synthesis is not implemented.

**Impact:** Only one agent can run at a time. Complex investigations requiring multiple agents are not supported.

**Workaround:** Run agents sequentially.

**Proposed Fix:**
- Implement AgentPool with concurrency management
- Add agent result aggregation
- Add timeout and error handling for concurrent agents

---

## Bug 7: Web UI Is Minimal

**Severity:** LOW
**Component:** `web/`
**Status:** Open

**Description:** The web console UI is a basic HTML page. Full dashboard, chat interface, alert viewer, and agent management are not implemented.

**Impact:** Users must use the CLI or API directly. No visual interface for monitoring or management.

**Workaround:** Use CLI (`npm run demo`) or API directly.

**Proposed Fix:**
- Build full dashboard with real-time updates
- Implement chat interface with file upload
- Add alert viewer with filtering and export

---

## Bug 8: No API Rate Limiting

**Severity:** MEDIUM
**Component:** `src/api/`
**Status:** Open

**Description:** API endpoints do not have rate limiting. A malicious client could overwhelm the system.

**Impact:** Denial of service risk.

**Workaround:** Deploy behind a reverse proxy with rate limiting (nginx, cloudflare).

**Proposed Fix:**
- Implement token bucket rate limiter in `src/api/middleware.ts`
- Per-institution rate limits
- Configurable limits in `config/firewall.json`

---

## Bug 9: Docker GPU Support Missing

**Severity:** LOW
**Component:** `docker/`
**Status:** Open

**Description:** The Dockerfile does not include NVIDIA runtime support for GPU-accelerated AI inference.

**Impact:** AI models run on CPU only, which is significantly slower.

**Workaround:** Run AI models on host machine separately, or use CPU inference (slow).

**Proposed Fix:**
- Add nvidia-docker runtime to docker-compose.yml
- Install CUDA libraries in Dockerfile
- Document GPU requirements

---

## Bug 10: No Request/Response Audit Logging

**Severity:** LOW
**Component:** `src/api/`
**Status:** Open

**Description:** API requests and responses are not fully logged. Only basic console logging exists.

**Impact:** Difficult to debug issues in production. Audit trail is incomplete.

**Workaround:** Add custom logging at reverse proxy level.

**Proposed Fix:**
- Implement structured request/response logging
- Log to file with rotation
- Include SHA-512 hash of request body for integrity

---

## Summary

| Severity | Count | Bugs |
|----------|-------|------|
| HIGH | 2 | #1 (AI loading), #2 (Blockchain) |
| MEDIUM | 4 | #3 (SMTP), #5 (Auth), #6 (Agents), #8 (Rate limit) |
| LOW | 4 | #4 (Banners), #7 (Web UI), #9 (GPU), #10 (Logging) |
| **TOTAL** | **10** | |

**Next priorities:** Fix #1 (AI loading) and #2 (Blockchain anchoring) to enable full fraud detection pipeline.

---

*Update this file as bugs are found and fixed. Mark fixed bugs as FIXED with resolution date.*
