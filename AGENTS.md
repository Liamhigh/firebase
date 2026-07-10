# AGENTS.md

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
