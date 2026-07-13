# Test Plan — Verum Omnis Guardian Fraud Firewall

**Document Purpose:** All tests that must pass. Organized by category.

**Version:** 5.2.7
**Last Updated:** 2026-07-13

---

## Test Categories

| Category | Count | Coverage Target |
|----------|-------|----------------|
| Unit Tests — Core | 16 | 90% |
| Unit Tests — Pipeline | 12 | 85% |
| Unit Tests — Sealing | 10 | 80% |
| Unit Tests — Agents | 8 | 75% |
| Integration Tests | 14 | End-to-end |
| Determinism Tests | 6 | 100% |
| Constitutional Tests | 8 | 100% |
| API Tests | 10 | All endpoints |
| Performance Tests | 6 | Throughput |
| **TOTAL** | **90** | |

---

## Unit Tests — Core (16 tests)

| ID | Test | Status | Description |
|----|------|--------|-------------|
| UC-01 | SHA-512 hash generation | + | Produces 128-char hex string for any input |
| UC-02 | SHA-512 deterministic | + | Same input always produces same hash |
| UC-03 | AES-256-GCM encryption | + | Encrypts and decrypts correctly |
| UC-04 | AES-256-GCM tamper detection | + | Modified ciphertext fails decryption |
| UC-05 | Commission calculation 20% | + | R100,000 fraud -> R20,000 commission |
| UC-06 | Commission calculation rounding | + | Handles edge cases (0, negative, decimal) |
| UC-07 | Commission hard-coded rate | + | Rate cannot be modified at runtime |
| UC-08 | Seal credit initial balance | + | New ledger starts with 0 balance |
| UC-09 | Seal credit consumption | + | Balance decreases by 1 on consume |
| UC-10 | Seal credit insufficient | + | consumeSeal() returns false when balance <= 0 |
| UC-11 | Seal credit purchase | + | Adding credits increases balance |
| UC-12 | Constitution loading | + | Loads v5.2.7 rules from JSON |
| UC-13 | Constitution validation | + | Invalid constitution fails at startup |
| UC-14 | Config loading | + | Loads firewall.json correctly |
| UC-15 | Config env override | + | VO_FIREWALL_CONFIG overrides path |
| UC-16 | Type validation (Zod) | + | Invalid transaction data rejected |

---

## Unit Tests — Pipeline (12 tests)

| ID | Test | Status | Description |
|----|------|--------|-------------|
| UP-01 | Rule engine velocity check | + | >50 txns/60s triggers FAIL |
| UP-02 | Rule engine amount check | + | >R100K triggers FAIL |
| UP-03 | Rule engine geographic check | + | Blocked country triggers FAIL |
| UP-04 | Rule engine pattern check | + | Layering pattern triggers FAIL |
| UP-05 | Rule engine temporal check | + | Unusual hours triggers SUSPICIOUS |
| UP-06 | Rule engine PASS result | + | Normal transaction passes all rules |
| UP-07 | Firewall pipeline ingest | + | Transaction enters pipeline |
| UP-08 | Firewall pipeline alert | + | Failed rules generate alert |
| UP-09 | Firewall pipeline no alert | + | Passed rules generate no alert |
| UP-10 | Pipeline deterministic | ~ | Same input = same output |
| UP-11 | Pipeline timestamp injection | + | Uses injected timestamp, not Date.now() |
| UP-12 | Pipeline error handling | + | Invalid input handled gracefully |

---

## Unit Tests — Sealing (10 tests)

| ID | Test | Status | Description |
|----|------|--------|-------------|
| US-01 | PDF seal footer format | + | Contains "VERUM OMNIS SEAL" and seal ID |
| US-02 | PDF classification banner | ~ | Top and bottom banners present |
| US-03 | PDF cover page elements | ~ | Logo, title, metadata present |
| US-04 | SHA-512 in seal | + | Document hash embedded in seal |
| US-05 | Seal ID generation | + | Valid UUID v4 format |
| US-06 | Credit deducted on seal | + | One credit consumed per seal |
| US-07 | Seal fails with no credits | + | Returns error when balance <= 0 |
| US-08 | Blockchain anchor format | - | Valid OpenTimestamps response |
| US-09 | Seal verification pass | - | Unmodified seal returns VERIFIED |
| US-10 | Seal verification fail | - | Modified seal returns TAMPERED |

---

## Unit Tests — Agents (8 tests)

| ID | Test | Status | Description |
|----|------|--------|-------------|
| UA-01 | Agent creation | + | Creates agent with name, scope, mission |
| UA-02 | Agent constitutional binding | + | Agent has Constitution embedded |
| UA-03 | Agent constraints | + | Agent has CANNOT_SUPPRESS_FINDINGS |
| UA-04 | Agent deployment | ~ | Agent deploys and returns ID |
| UA-05 | Agent coordination | - | Multiple agents run concurrently |
| UA-06 | Agent reporting | - | Agent returns findings to Mistral |
| UA-07 | Agent timeout | - | Agent handles timeout gracefully |
| UA-08 | Agent error handling | - | Agent errors reported, not silent |

---

## Integration Tests (14 tests)

| ID | Test | Status | Description |
|----|------|--------|-------------|
| II-01 | Transaction -> Alert | - | Full flow from ingest to alert |
| II-02 | Alert -> Seal -> Notify | - | Alert to sealed report to emails |
| II-03 | Credit purchase -> Use | - | Buy credits, seal document, balance updates |
| II-04 | Commission invoice generation | - | Fraud confirmed -> invoice created |
| II-05 | Verum email (no evidence) | - | Verum email contains no customer data |
| II-06 | Bank email (with report) | - | Bank email contains sealed PDF |
| II-07 | Seal verification end-to-end | - | Create seal, verify, confirm valid |
| II-08 | Tamper detection end-to-end | - | Modify seal, verify, confirm tampered |
| II-09 | Agent -> Findings -> Report | - | Deploy agent, get findings, generate report |
| II-10 | Multi-transaction pattern | - | Multiple related transactions detected |
| II-11 | Config reload | - | Update firewall.json, system reloads |
| II-12 | API auth rejection | - | Invalid API key returns 401 |
| II-13 | API rate limiting | - | Exceeding limit returns 429 |
| II-14 | Docker container startup | - | Container starts, health check passes |

---

## Determinism Tests (6 tests)

| ID | Test | Status | Description |
|----|------|--------|-------------|
| DT-01 | Same transaction = same alert | - | Identical input produces identical output |
| DT-02 | Same document = same seal | - | Identical PDF produces identical hash |
| DT-03 | Same findings = same report | - | Identical findings produce identical report |
| DT-04 | Timestamp injection | + | Fixed timestamp produces deterministic result |
| DT-05 | No Date.now() in core | + | Static analysis confirms no Date.now() usage |
| DT-06 | No Math.random() in core | + | Static analysis confirms no randomness |

---

## Constitutional Tests (8 tests)

| ID | Test | Status | Description |
|----|------|--------|-------------|
| CT-01 | 10-word prompt limit | + | Prompt > 10 words rejected |
| CT-02 | Ordinal confidence enforced | - | Percentage-based confidence rejected |
| CT-03 | Privacy wall (Verum) | + | Evidence cannot be sent to Verum |
| CT-04 | 20% commission hard-coded | + | Rate cannot be changed |
| CT-05 | 7 categories immutable | - | Adding category fails |
| CT-06 | B9 cannot vote | - | B9 verdicts rejected |
| CT-07 | Article X enforcement | - | Weaponization attempt triggers breach flag |
| CT-08 | Silence Ledger append | - | Coercion attempt logged permanently |

---

## API Tests (10 tests)

| ID | Test | Status | Description |
|----|------|--------|-------------|
| AP-01 | POST /v1/monitor 200 | + | Valid transaction returns alert |
| AP-02 | POST /v1/monitor 400 | + | Invalid transaction returns error |
| AP-03 | POST /v1/seal 200 | + | Valid document returns seal |
| AP-04 | POST /v1/seal 403 | - | Insufficient credits returns error |
| AP-05 | GET /v1/status 200 | + | Returns system health |
| AP-06 | GET /v1/ledger 200 | - | Returns credit balance |
| AP-07 | GET /v1/ledger 401 | - | Missing API key rejected |
| AP-08 | GET /v1/alerts 200 | - | Returns alert list |
| AP-09 | POST /v1/agents/deploy 200 | - | Deploys agent |
| AP-10 | POST /v1/agents/deploy 403 | - | Unauthorized role rejected |

---

## Performance Tests (6 tests)

| ID | Test | Status | Description |
|----|------|--------|-------------|
| PT-01 | Transaction throughput | - | 1000 txns/second sustained |
| PT-02 | Seal operation latency | - | < 5 seconds per seal |
| PT-03 | API response time | - | < 500ms for rule-only evaluation |
| PT-04 | Memory usage stability | - | No memory leaks over 24 hours |
| PT-05 | AI model loading time | - | < 30 seconds for all 4 models |
| PT-06 | Concurrent agent limit | - | 10 agents running simultaneously |

---

## Test Execution

```bash
cd fraud-firewall

# Type checking
npm run lint

# Unit tests
npm test

# Integration tests (requires running server)
npm run dev &
npm run test:integration

# Performance tests
npm run test:performance

# Determinism tests
npm run test:determinism

# Constitutional tests
npm run test:constitutional

# All tests
npm run test:all
```

---

## Coverage Targets

| Package | Minimum Coverage |
|---------|-----------------|
| src/core/ | 90% |
| src/pipeline/ | 85% |
| src/agents/ | 75% |
| src/notifications/ | 70% |
| src/api/ | 80% |

---

*"The truth does not require belief. It requires only that you look."*

**Verum Omnis** — AI Forensics for Truth
