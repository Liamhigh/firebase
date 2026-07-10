# Verum Omnis Guardian Fraud Firewall

Enterprise on-premise fraud detection package per **VO-FIREWALL-SPEC-5.2.7-2026**, governed by Constitution **v5.2.7**.

Banks install this on their own infrastructure. Four AI roles (Gemma 4, Phi-3, Mistral Instruct, Gemma 3) monitor transactions, hunt fraud, triple-verify alerts, seal evidence (SHA-512 + OpenTimestamps), and email:

- **Bank** → full sealed evidence report  
- **Verum Omnis** → commission invoice only (20%) — **never evidence**

## Quick start

```bash
cd fraud-firewall
npm install
npm test
npm run demo
npm run dev          # UI + HTTP API on :8787
# open http://localhost:8787
```

The console UI matches the live Verum theme from [www.verumglobal.foundation](https://www.verumglobal.foundation) — Cormorant Garamond / Source Sans 3 / JetBrains Mono, navy `#040D1B`–`#1A2E52`, gold `#D4A843`, blue `#4A7EC7`.

Docker:

```bash
cd fraud-firewall
docker compose -f docker/docker-compose.yml up --build
```

## Pipeline

1. Transaction ingestion (read-only bank APIs)  
2. Rule engine — velocity / amount / geo  
3. Gemma 4 — pattern & anomaly correlation  
4. Mistral agents — TransactionMonitor, AccountProfiler, CommunicationAudit  
5. Triple-AI consensus — Gemma 3 + Phi-3 + 9-Brain (all must CONCUR)  
6. Document sealing — consumes seal credits; embeds Constitution ruleset  
7. Notifications — Verum invoice (no attachments) + bank sealed PDF  

## HTTP API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| POST | `/v1/transactions` | Buffer transactions |
| POST | `/v1/monitor` | Run detection pipeline |
| POST | `/v1/seal` | Seal arbitrary document |
| GET | `/v1/credits` | Seal credit ledger |
| POST | `/v1/credits/purchase` | Add credits with payment proof |
| GET | `/v1/agents` | List Mistral agents |
| GET | `/v1/sealed/:sealId` | Download sealed PDF |

## Privacy (code-enforced)

Hard rules from the spec — enforced in `commission.ts` and `notifications/email.ts`, not by AI:

1. Verum never receives customer data  
2. Verum never receives transaction details  
3. Verum never receives sealed evidence files  
4. Verum never receives internal bank documents  
5. Verum only receives commission invoices (institution + amount)  

Verum outbound emails **cannot** carry attachments.

## Configuration

Edit `config/firewall.json` (or set `VO_FIREWALL_CONFIG`):

- Institution name / fraud desk email  
- Rule thresholds  
- Seal credit bootstrap balance  
- Vault paths  

## AI mode

Default `ai.mode` is `deterministic`: Constitution-bound offline heuristics that implement the same pipeline contracts as the four model roles. Swap adapters in `src/ai/models.ts` and `src/agents/mistral.ts` for local Gemma / Phi / Mistral runtimes without changing the firewall orchestration.

## Spec references

- `VO-FIREWALL-SPEC-5.2.7-2026` — Guardian Fraud Firewall Enterprise Technical Specification  
- Constitution v5.2.7 — embedded at `src/constitution/v5.2.7.json`  

Verum Omnis — AI Forensics for Truth  
licensing@verumglobal.foundation
