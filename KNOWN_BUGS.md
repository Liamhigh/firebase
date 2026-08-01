# Known Bugs — Verum Omnis Guardian Fraud Firewall

**Document Purpose:** Known issues and technical debt. Update as bugs are found and fixed.

**Version:** 5.2.7
**Last Updated:** 2026-07-13

---

## Bug 1: AI Model Loading Not Implemented

**Severity:** HIGH
**Component:** `src/ai/`
**Status:** Open

**Description:** In-process llama.cpp bindings for loading GGUF models are not implemented. However, the hybrid pipeline now has a real inference path: `src/ai/llamaClient.ts` talks to a local llama.cpp `llama-server` (set `VO_LLAMA_URL`, e.g. `http://127.0.0.1:8080`) and is wired into (a) Gemma 3 report narration (`Gemma3Forensics.writeForensicReportNarrative`), and (b) the G3 second-pass vault review (`src/forensics/g3Review.ts`), which raises anchored `G3-RAISED CANDIDATE` records the deterministic engine missed. Candidates persist in `src/forensics/candidateStore.ts` and can be promoted into engine rules (`/v1/g3/promote`) that `ContradictionEngine.detectPromotedPairs` applies on the next extraction. Without `VO_LLAMA_URL` everything degrades to the deterministic pipeline.

**Impact:** With a local llama-server running and a Gemma 3 GGUF loaded, AI-enhanced analysis, second-pass contradiction catching, and model-written forensic report narratives all function. Without it the system remains rule-based only.

**Workaround:** Run `llama-server -m gemma-3-4b-it-Q4_K_M.gguf --port 8080` locally and set `VO_LLAMA_URL=http://127.0.0.1:8080`.

**Remaining Fix:**
- Optional in-process bindings (node-llama-cpp) as an alternative to the local server
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
