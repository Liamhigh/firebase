# AGENTS.md

> **System context (read first):** this repository is ONE SURFACE of the Verum Omnis
> system. The cross-repo AI code-assistant system prompt —
> [`VERUM_OMNIS_SYSTEM_PROMPT.md`](./VERUM_OMNIS_SYSTEM_PROMPT.md) — is identical in
> every Verum Omnis repository and governs how all surfaces fit together (models,
> Nine-Brain architecture, Triple Verification, the 16 Prime Directives, sealing).
> The **legal chat interface is a required feature of the Windows surface**, and a
> **Windows Lite personal edition** (Android-style: 3 small models, vault, sealing,
> legal chat — no firewall) is a planned surface; see §9-Lite / §12.4 of that document.

**UI design (binding):** [`VERUM_UI_TOKENS.md`](./VERUM_UI_TOKENS.md) is the canonical
design specification for EVERY Verum Omnis surface — website, Android app, Fraud
Firewall and Windows Lite. It was extracted verbatim from the production site and it
is not a suggestion: any new screen or page must use its palette (dark navy #040D1B,
gold #D4A843, blue #4A7EC7), its type scale (Cormorant Garamond serif headings, mono
uppercase kicker labels, sans body) and its component anatomy (cards with id-field
rows, gold CTAs, honesty-note callouts, seal-footer strips). Web surfaces import
[`verum-ui.css`](./verum-ui.css) directly; native surfaces port the same tokens.
Document verification is ALWAYS a link to the Verification Hub
(verumglobal.foundation/verify.html) — no surface verifies locally.

## Cursor Cloud specific instructions

### Repository layout
- The runnable/testable product lives entirely in [`fraud-firewall/`](./fraud-firewall/) — the **Verum Omnis Guardian Fraud Firewall**, a Node.js + TypeScript (ESM, `tsx`) on-premise fraud-detection service. There is no root-level `package.json`; run all `npm` commands from inside `fraud-firewall/`.
- The root `README.md` references a separate Vite web app (`npm run dev` on :5173). That app has no source in this repo (only the `verum-omnis-v2-fixed.zip` archive), so ignore it for dev setup.

### Commands (run from `fraud-firewall/`)
Standard scripts are defined in `fraud-firewall/package.json`:
- Lint / typecheck: `npm run lint` (`tsc --noEmit`)
- Tests: `npm test` (Node built-in test runner via `tsx`)
- Demo pipeline (no server): `npm run demo`
- Dev server (UI + HTTP API): `npm run dev` — serves the console UI and REST API on `http://localhost:8787` (host `0.0.0.0`, port from `config/firewall.json`).

### Non-obvious notes
- The dev server is plain `node:http` (no framework) started via `tsx watch src/cli.ts serve`. It requires no database or external services — all fraud detection is offline/deterministic (`ai.mode: "deterministic"` in `config/firewall.json`).
- Running the pipeline (via `demo`, the UI "Run Detection Demo" button, or `POST /v1/monitor` / `POST /v1/seal`) **consumes seal credits** and writes artifacts (sealed PDFs, invoices, outbound emails, ledger) into `fraud-firewall/vault/`. The `vault/` dir is gitignored and auto-created on startup; delete it to reset credit balance / ledger state.
- Config path can be overridden with the `VO_FIREWALL_CONFIG` env var.
- Docker deploy (`docker compose -f docker/docker-compose.yml up --build`) references `docker/Dockerfile`; use only for production-style runs, not local dev.
