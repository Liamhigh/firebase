# Dependencies — Verum Omnis Guardian Fraud Firewall

**Document Purpose:** Every library, SDK, model, and version required.

**Version:** 5.2.7
**Last Updated:** 2026-07-13

---

## Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `pdf-lib` | ^1.17.1 | PDF creation, modification, sealing |
| `zod` | ^3.23.8 | Runtime type validation, schema parsing |

### Why These Dependencies

**pdf-lib** — Pure JavaScript PDF library. No native dependencies. Supports PDF creation, modification, form filling, and embedding. Required for the sealing service to add footers, banners, and metadata to PDFs.

**zod** — TypeScript-first schema validation with static type inference. Required for API input validation, configuration parsing, and type-safe data handling.

### Runtime Constraints
- Zero framework dependencies (no Express, Fastify, etc.)
- Zero database dependencies (file-based storage)
- Zero ORM dependencies
- All runtime deps must work offline

---

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.7.2 | Type checking, compilation |
| `tsx` | ^4.19.2 | TypeScript execution (dev + tests) |
| `@types/node` | ^22.10.2 | Node.js type definitions |

### Why These Dev Dependencies

**typescript** — Strict mode enabled. Required for type safety, compile-time error detection, and deterministic builds.

**tsx** — Fast TypeScript execution via esbuild. Used for `npm run dev` (watch mode), `npm test`, and `npm run demo`. Faster than ts-node for development.

**@types/node** — Type definitions for Node.js built-in modules (crypto, fs, http, etc.).

---

## AI Models (GGUF Format)

| Model | Size | Purpose | Download |
|-------|------|---------|----------|
| Gemma 3 4B IT Q4_K_M | ~3.2GB | Evidence sealing, report writing | Hugging Face |
| Gemma 3 12B IT Q4_K_M | ~7.8GB | Evidence sealing (enhanced) | Hugging Face |
| Phi-3 Mini 4K Instruct Q4_K_M | ~2.3GB | Legal analysis, compliance | Hugging Face |
| Phi-3 Medium 128K Instruct Q4_K_M | ~8.1GB | Legal analysis (enhanced) | Hugging Face |
| Gemma 4 9B IT Q4_K_M | ~6.2GB | Pattern detection, oversight | Hugging Face |
| Gemma 4 27B IT Q4_K_M | ~17.1GB | Pattern detection (enhanced) | Hugging Face |
| Mistral 7B Instruct v0.3 Q4_K_M | ~4.1GB | Agent deployment, investigation | Hugging Face |
| Mistral Nemo 12B Instruct Q4_K_M | ~7.5GB | Agent deployment (enhanced) | Hugging Face |

### Model Selection Strategy
- **Entry tier:** Gemma 3 4B + Phi-3 Mini + Mistral 7B (min 8GB VRAM)
- **Standard tier:** Gemma 3 12B + Phi-3 Medium + Gemma 4 9B (min 24GB VRAM)
- **Enterprise tier:** Gemma 4 27B + Phi-3 Medium + Mistral Nemo (min 48GB VRAM)

### Model Quantization
- Q4_K_M is the default (good quality, reasonable size)
- Q5_K_M available for higher quality (larger files)
- Q3_K_M available for constrained hardware (lower quality)

---

## System Requirements

### Minimum
| Component | Spec |
|-----------|------|
| CPU | 16 cores |
| RAM | 32GB |
| GPU | NVIDIA T4 (16GB VRAM) |
| Storage | 500GB SSD |
| Network | 1Gbps internal |
| OS | Ubuntu 22.04 LTS |
| Node.js | >= 20 |
| Docker | 24.0+ |

### Recommended
| Component | Spec |
|-----------|------|
| CPU | 32+ cores |
| RAM | 64GB+ |
| GPU | NVIDIA A100 (40GB VRAM) |
| Storage | 2TB NVMe SSD |
| Network | 10Gbps internal |
| OS | RHEL 9 / Ubuntu 24.04 |
| Kubernetes | 1.28+ |

---

## External Services (Optional)

| Service | Purpose | Required |
|---------|---------|----------|
| OpenTimestamps | Bitcoin blockchain anchoring | Yes (for sealing) |
| SMTP server | Email notifications | Yes (for notifications) |
| Bank Transaction API | Transaction data ingestion | Yes (for monitoring) |
| Bank Account API | Account verification | No (optional) |
| Bank KYC API | Identity verification | No (optional) |
| SAFLII | South African case law | No (optional, B7) |
| PACER | US court records | No (optional, B7) |
| BAILII | UK case law | No (optional, B7) |

---

## Version Pinning Rationale

All versions are pinned with `^` (caret) to allow patch and minor updates:
- **Patch updates** (x.x.X) — Bug fixes, security patches. Always accepted.
- **Minor updates** (x.X.x) — New features, backward compatible. Reviewed before acceptance.
- **Major updates** (X.x.x) — Breaking changes. Require full regression test suite.

**Exceptions** (pinned exactly):
- Constitution version: 5.2.7 (never auto-updates)
- Seal protocol version: 1.0 (never auto-updates)
- Commission rate: 0.20 (never changes)

---

## Future Dependencies (Under Evaluation)

| Package | Purpose | Status |
|---------|---------|--------|
| `nodemailer` | SMTP email delivery | Evaluating |
| `ws` | WebSocket for real-time UI | Evaluating |
| `argon2` | Password hashing (auth) | Evaluating |
| `jose` | JWT token handling (auth) | Evaluating |

---

*"The truth does not require belief. It requires only that you look."*

**Verum Omnis** — AI Forensics for Truth
