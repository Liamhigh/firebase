# Week 1 Tasks: Compliance MVP Implementation
**Deadline: End of Week (7 days)**  
**Goal: Audit-Ready Compliance System**  
**Phases: 1A (monitoring) → 1B (sealing) → 1C (export)**

---

## Phase 1A: Transaction Monitoring (Days 1-2)
**Goal:** `POST /v1/monitor` accepts transactions → produces FraudAlert

### Task 1A.1: Verify `/v1/monitor` endpoint works
**File:** `src/api/server.ts`  
**Status:** Already exists  
**What to do:**
- [ ] Test endpoint accepts transaction JSON
- [ ] Verify all 43 detectors run
- [ ] Confirm triple-AI verification completes
- [ ] Check FraudAlert is saved to vault

**Test command:**
```bash
curl -X POST http://localhost:3000/v1/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "txn_id": "TXN-001",
        "account_id": "ACC-123",
        "amount": 50000,
        "currency": "ZAR",
        "timestamp": "2026-07-22T14:30:00Z",
        "country": "ZA",
        "counterparty": "MULE-ACCT"
      }
    ]
  }'
```

**Expected output:**
```json
{
  "alert": {
    "alert_id": "ALERT-001",
    "status": "CONFIRMED",
    "fraud_type": "AMOUNT_ANOMALY",
    "confidence": "HIGH",
    "verification": {
      "gemma3": "CONCURS",
      "phi3": "CONCURS",
      "nine_brain": "CONCURS",
      "quorum": true
    }
  }
}
```

### Task 1A.2: Test with 100 synthetic transactions
**File:** Create `tests/week1-synthetic-transactions.ts` (new)  
**What to do:**
- [ ] Generate 100 realistic test transactions
- [ ] Mix fraud types (SIM swap, layering, velocity abuse, etc.)
- [ ] Mix jurisdictions (ZA, US, EU)
- [ ] Send all to `/v1/monitor`
- [ ] Capture response times
- [ ] Verify no crashes or silent failures

**Success criteria:**
- All 100 complete without error
- Response time < 500ms per request
- Fraud detection rate > 80% (realistic for test data)
- All alerts saved to vault

**Deliverable:** `test-results-week1.json` with statistics

---

## Phase 1B: Sealed Evidence (Days 2-4)
**Goal:** Findings are sealed as PDFs with Constitutional proof

### Task 1B.1: Verify PDF seal generation works
**File:** `src/core/sealing.ts`  
**Status:** Already exists  
**What to do:**
- [ ] Test `seal()` function with alert
- [ ] Verify PDF is generated and saved
- [ ] Check PDF includes seal footer
- [ ] Verify seal ID is UUID v4
- [ ] Confirm SHA-512 hash is computed

**Test command:**
```bash
curl -X POST http://localhost:3000/v1/seal \
  -H "Content-Type: application/json" \
  -d '{
    "document_reference": "VO-FW-CASE-0847",
    "title": "Fraud Detection Report — CASE-0847",
    "body_text": "SIM Swap fraud detected..."
  }'
```

**Verify PDF contains:**
```
VERUM OMNIS SEAL | seal-{uuid} | {hash} | Page 1/1
[Classification Banner: CONFIDENTIAL - LAW ENFORCEMENT]
[Evidence Anchors]
[Triple-AI Verification]
[Constitution v6.0.0 embedded]
```

### Task 1B.2: Add proper seal footer & classification banners
**File:** `src/core/sealing.ts` (modify `buildSealedPdf()`)  
**What's needed:**
- [ ] **Seal Footer** on every page:
  ```
  VERUM OMNIS SEAL | seal-{uuid} | {hash-truncated} | {page-hash} | Page X/Y
  ```
- [ ] **Classification Banner** (top):
  ```
  ╔════════════════════════════════════════════════════════╗
  ║  CONFIDENTIAL - LAW ENFORCEMENT / BANKING REGULATOR    ║
  ║  SEALED UNDER CONSTITUTION v6.0.0                      ║
  ║  CHAIN-OF-CUSTODY PROTECTED - FORENSIC EVIDENCE        ║
  ╚════════════════════════════════════════════════════════╝
  ```
- [ ] **Classification Banner** (bottom):
  ```
  END OF SEALED REPORT - Seal: {seal_id} | Verified: {blockchain_status}
  ```

**Verify each sealed PDF has:**
- [ ] Seal footer on every page
- [ ] Classification banners (top & bottom)
- [ ] Constitution v6.0.0 text embedded
- [ ] Evidence anchors visible (transaction IDs)
- [ ] Triple-AI verification votes listed

### Task 1B.3: Verify Bitcoin blockchain anchor works (or handles offline gracefully)
**File:** `src/core/ots.ts`  
**What to do:**
- [ ] Test OpenTimestamps submission
- [ ] Verify `ots_digest` is SHA-256
- [ ] Confirm `ots_receipt` is returned
- [ ] Test blockchain anchor retrieval
- [ ] If offline: gracefully return `PENDING` status (not error)

**Expected seal record:**
```json
{
  "seal_id": "seal-abc123",
  "sha512": "...",
  "constitution_version": "6.0.0",
  "blockchain": {
    "provider": "OpenTimestamps",
    "status": "CONFIRMED",
    "block_height": 750123,
    "ots_digest": "...",
    "ots_receipt": "..."
  }
}
```

**Offline handling:**
```json
{
  "blockchain": {
    "provider": "OpenTimestamps",
    "status": "PENDING",
    "ots_note": "Awaiting calendar confirmation"
  }
}
```

### Task 1B.4: Test seal verification
**File:** Verify seal verification works  
**What to do:**
- [ ] Recompute SHA-512 from sealed PDF
- [ ] Compare to stored seal hash
- [ ] Verify blockchain anchor (if confirmed)
- [ ] Output VERIFIED or TAMPERED

**Test:**
```bash
# Verify a sealed PDF
curl -X GET http://localhost:3000/api/v1/seal-verify?seal_id=seal-abc123
```

**Expected:**
```json
{
  "seal_id": "seal-abc123",
  "status": "VERIFIED",
  "sha512_match": true,
  "blockchain_anchor": "Bitcoin block 750123",
  "constitution_version": "6.0.0",
  "tamper_detected": false
}
```

---

## Phase 1C: Export for Regulators (Days 4-6)
**Goal:** Audit-ready ZIP file that regulators can verify

### Task 1C.1: Create export endpoint
**File:** `src/api/export.ts` (new)  
**What to create:**
```typescript
// GET /api/v1/export/findings?start_date=2026-01-01&end_date=2026-07-22

interface ExportRequest {
  start_date: string;  // ISO 8601
  end_date: string;
  institution?: string;
  jurisdiction?: string;
}

interface ExportResponse {
  export_id: string;
  zip_file_path: string;
  total_findings: number;
  confirmed: number;
  false_positives: number;
  under_review: number;
  jurisdictions: string[];
  created_at: string;
}
```

**Endpoint should:**
- [ ] Query alerts from vault by date range
- [ ] Include all sealed PDFs
- [ ] Create manifest JSON
- [ ] Create chain-of-custody log
- [ ] Create verification statistics
- [ ] Zip everything
- [ ] Return download path

### Task 1C.2: Create manifest JSON
**File:** Inside export ZIP → `manifest.json`  
**What to include:**
```json
{
  "export_id": "EXPORT-2026-Q3",
  "institution": "FirstBank ZA",
  "export_date": "2026-07-22T16:00:00Z",
  "date_range": {
    "start": "2026-07-01",
    "end": "2026-07-22"
  },
  "summary": {
    "total_findings": 87,
    "confirmed_fraud": 23,
    "false_positives": 8,
    "under_review": 5,
    "rejected": 51
  },
  "by_fraud_type": {
    "IDENTITY_THEFT": 12,
    "MONEY_LAUNDERING": 8,
    "VELOCITY_ABUSE": 3
  },
  "by_jurisdiction": {
    "ZA": {
      "count": 45,
      "applicable_laws": ["POCA 121/1998", "FICA 38/2001"]
    },
    "US": {
      "count": 23,
      "applicable_laws": ["18 U.S.C. § 1344"]
    },
    "EU": {
      "count": 19,
      "applicable_laws": ["AMLD6"]
    }
  },
  "constitution_version": "6.0.0",
  "sealing_protocol": "verum-omnis-seal v1.0",
  "blockchain_provider": "OpenTimestamps (Bitcoin)",
  "auditable": true,
  "tamper_proof": true
}
```

### Task 1C.3: Create chain-of-custody log
**File:** Inside export ZIP → `chain-of-custody.csv`  
**Format:**
```csv
alert_id,seal_id,fraud_type,amount,currency,jurisdiction,detected_at,sealed_at,blockchain_block,sha512_hash,status
ALERT-0847,seal-abc123,SIM_SWAP,47500,ZAR,ZA,2026-07-15T10:30:00Z,2026-07-15T10:32:00Z,750123,abc123def456...,CONFIRMED
ALERT-0923,seal-def456,MONEY_LAUNDERING,120000,ZAR,ZA,2026-07-18T14:15:00Z,2026-07-18T14:17:00Z,750145,def456ghi789...,CONFIRMED
```

### Task 1C.4: ZIP all findings
**What to include in export ZIP:**
```
findings-Q3-2026.zip
├─ manifest.json
├─ chain-of-custody.csv
├─ seals/
│  ├─ seal-abc123.pdf (with footer, banners, anchors)
│  ├─ seal-def456.pdf
│  ├─ seal-ghi789.pdf
│  └─ ... (all 23 confirmed fraud findings)
├─ verification/
│  ├─ seal-abc123-verification.json (blockchain proof)
│  ├─ seal-def456-verification.json
│  └─ ... (verification for each seal)
└─ README.txt
   This ZIP contains auditable evidence of fraud investigation.
   All seals are tamper-proof and blockchain-anchored.
   Verify with: curl /api/v1/seal-verify?seal_id={id}
```

---

## Days 6-7: Testing & Validation

### Task 1X.1: End-to-end test
**What to do:**
- [ ] Send 100 test transactions
- [ ] Capture confirmed fraud cases
- [ ] Seal each finding
- [ ] Export all findings
- [ ] Extract and verify seals
- [ ] Confirm no data loss

**Checklist:**
- [ ] All seals are valid (SHA-512 matches)
- [ ] All seals have blockchain anchor (or PENDING)
- [ ] All PDFs include seal footer + banners
- [ ] All evidence anchors are present
- [ ] Chain of custody log is complete
- [ ] Export ZIP is intact

### Task 1X.2: Compliance readiness audit
**What to verify:**
- [ ] Regulator can download export ZIP ✅
- [ ] Regulator can verify seal SHA-512 ✅
- [ ] Regulator can check blockchain anchor ✅
- [ ] Regulator can see evidence anchors ✅
- [ ] Regulator can see triple-AI votes ✅
- [ ] Regulator can see jurisdiction mapping ✅
- [ ] No PII in any file ✅
- [ ] No transaction details in commission invoice ✅

**Deliverable:** `compliance-audit-checklist-PASSED.md`

---

## Deliverables for Week 1

**By end of Week 1, ready for demonstration:**

1. ✅ **Working `/v1/monitor` endpoint**
   - Processes transactions
   - Runs all 43 detectors
   - Returns FraudAlert with triple-AI verification

2. ✅ **Working `/v1/seal` endpoint**
   - Produces sealed PDF with proper footer/banners
   - Includes evidence anchors
   - Submits blockchain anchor (or queues if offline)

3. ✅ **Working `/api/v1/export/findings` endpoint**
   - Exports audit-ready ZIP
   - Includes manifest, seals, chain of custody
   - Includes verification log

4. ✅ **Test Results**
   - 100 transactions processed
   - Fraud detection rate > 80%
   - All seals verified
   - Export ZIP complete and auditable

5. ✅ **Compliance Audit Checklist**
   - Ready for regulator review
   - All tamper-proofs verified
   - All blockchain anchors confirmed or pending

---

## Success Criteria

**By end of Week 1, this must be TRUE:**

> A bank can run the Firewall for one week, generate sealed findings, export them in an audit-ready ZIP, and show a regulator: "Here's proof we investigated fraud using professional forensic methodology. All evidence is sealed and tamper-proof."

**Regulator sees:** ✅ COMPLIANT  
**Bank avoids:** ❌ Multi-million dollar fine  
**Firewall status:** ✅ DEPLOYMENT-READY for compliance

---

## Quick Reference: Files to Touch

**Already Implemented (verify/test):**
- `src/api/server.ts` — Monitor endpoint
- `src/pipeline/firewall.ts` — Orchestrator
- `src/core/sealing.ts` — PDF generation
- `src/core/ots.ts` — Blockchain anchor
- `src/notifications/email.ts` — Notifications
- `src/storage/vault.ts` — Evidence storage

**Need to Create:**
- `src/api/export.ts` — Export endpoint (NEW)
- `tests/week1-synthetic-transactions.ts` — Test data (NEW)

**Need to Modify:**
- `src/core/sealing.ts` — Add seal footer + classification banners
- `src/api/server.ts` — Add export endpoint registration

---

## Questions Before Starting

1. **Test data:** Do you have real bank transactions to test with, or should I generate synthetic data?
2. **Bitcoin network:** Should the firewall use real OpenTimestamps (live) or test mode (offline)?
3. **Running the system:** Do you have Node.js + npm set up to run the firewall locally?
4. **Database:** Is the vault using local file storage (current) or do you need to add database support?

**Ready to start Day 1?**
