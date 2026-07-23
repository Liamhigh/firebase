# Week 2 Tasks: Admin Dashboard & Engine Evolution

**Deadline: End of Week (7 days)**  
**Goal: Admin-Ready Engine Management System**  
**Phases: 2A (quarterly updates) → 2B (admin dashboard) → 2C (deep analytics)**

---

## Overview

Week 2 focuses on **Phi-3 Admin Hub**: administrators (bank compliance officers, Verum analysts) can log in to a dashboard to:

1. **View quarterly engine evolution JSON** — See what patterns the engine has learned
2. **Track detector performance** — Which fraud types are improving/declining
3. **Review novel patterns** — New contradictions discovered in the wild
4. **Approve/reject detector adjustments** — Control when engine updates go live
5. **Audit compliance** — See Constitutional constraints being enforced

---

## Phase 2A: Quarterly Engine Evolution JSON (Days 1-2)

### Goal: Track what the engine learns over time

**File to create:** `src/api/admin.ts`  
**Endpoint:** `GET /api/v1/admin/engine-evolution`

### Quarterly JSON Structure

```json
{
  "quarter": "Q3-2026",
  "period": {
    "start": "2026-07-01",
    "end": "2026-09-30"
  },
  "engine_version": "5.3.1c",
  "constitution_version": "6.0.0",
  "summary": {
    "total_transactions_monitored": 125000,
    "fraud_cases_confirmed": 847,
    "false_positive_rate": 0.08,
    "novel_patterns_discovered": 12,
    "detector_adjustments_approved": 5,
    "blockchain_anchors_confirmed": 789
  },
  "detector_performance": {
    "AMOUNT_ANOMALY": {
      "detections": 234,
      "confirmed": 198,
      "false_positives": 36,
      "accuracy": 0.846
    },
    "VELOCITY_ABUSE": {
      "detections": 156,
      "confirmed": 134,
      "false_positives": 22,
      "accuracy": 0.859
    },
    "LAYERING": {
      "detections": 89,
      "confirmed": 78,
      "false_positives": 11,
      "accuracy": 0.877
    },
    "SIM_SWAP": {
      "detections": 45,
      "confirmed": 43,
      "false_positives": 2,
      "accuracy": 0.956
    }
  },
  "novel_patterns": [
    {
      "pattern_id": "NP-Q3-001",
      "name": "Cross-Border Rapid Liquidation",
      "description": "Large transfer out, immediate micro-transfers back in different currency",
      "discovered_date": "2026-07-15",
      "occurrences": 7,
      "recommended_detector": "LAYERING_VARIANT",
      "confidence": "HIGH",
      "status": "PENDING_REVIEW",
      "reviewed_by": null,
      "approved": false
    },
    {
      "pattern_id": "NP-Q3-002",
      "name": "Account Ping-Pong",
      "description": "Fund movements between two accounts in 15-minute cycles",
      "discovered_date": "2026-08-03",
      "occurrences": 12,
      "recommended_detector": "VELOCITY_VARIANT",
      "confidence": "VERY_HIGH",
      "status": "APPROVED",
      "reviewed_by": "admin@bank.local",
      "approved": true,
      "approved_date": "2026-08-04"
    }
  ],
  "detector_adjustments": [
    {
      "adjustment_id": "DA-Q3-001",
      "detector": "AMOUNT_ANOMALY",
      "change": "threshold_increased",
      "from_value": 250000,
      "to_value": 300000,
      "currency": "ZAR",
      "rationale": "Reduce false positives on legitimate high-value business transfers",
      "implementation_date": "2026-07-20",
      "status": "LIVE",
      "impact": {
        "false_positives_reduced": 0.15,
        "true_positives_maintained": 0.98
      }
    }
  ],
  "constitutional_constraints_enforced": {
    "findings_never_suppressed": true,
    "triple_ai_verification_required": true,
    "evidence_always_sealed": true,
    "chain_of_custody_maintained": true,
    "no_pii_to_verum": true
  },
  "compliance_status": "COMPLIANT",
  "next_review_date": "2026-10-01"
}
```

### Implementation Tasks

- [ ] Create QuarterlyEvolution interface
- [ ] Aggregate transaction/alert data from vault
- [ ] Calculate detector performance metrics
- [ ] Collect novel patterns from findings
- [ ] Track detector adjustments made this quarter
- [ ] Verify Constitutional constraints enforced
- [ ] Output as JSON endpoint
- [ ] Store quarterly snapshots in vault/admin/

---

## Phase 2B: Admin Dashboard (Days 2-5)

### Goal: Web UI for admin operations

**Files to create:**
- `web/admin.html` — Admin dashboard
- `src/api/admin.ts` — Admin endpoints (continued)
- `web/admin.js` — Dashboard logic

### Admin Dashboard Features

#### 1. Quarterly Summary Widget
- Total transactions monitored
- Confirmed fraud cases
- False positive rate
- Novel patterns discovered
- Detector adjustments approved

#### 2. Detector Performance Table
- Each detector in a row
- Columns: Detections | Confirmed | False Positives | Accuracy %
- Sort by accuracy/detections
- Highlight improving/declining

#### 3. Novel Patterns Review Panel
- List of patterns discovered this quarter
- Status: PENDING_REVIEW | APPROVED | REJECTED
- Admin can approve/reject with notes
- Shows which detective found it + confidence

#### 4. Detector Adjustment History
- Timeline of changes made
- Before/after values
- Rationale + impact metrics
- Rollback capability (optional)

#### 5. Compliance Audit
- Constitutional constraints status
- Each constraint: ✓ ENFORCED
- Triple-AI verification: X votes reviewed
- Evidence sealing: X seals created
- Chain of custody: X findings tracked

#### 6. Export Controls
- Download quarterly JSON
- Download detector metrics CSV
- Download novel patterns report
- Export blockchain verification status

### Authentication

**For MVP:** Simple auth (hardcoded admin key in header)

```bash
curl -H "X-Admin-Key: demo-admin-key-12345" http://localhost:8787/api/v1/admin/dashboard
```

**Note:** Week 3 will add proper JWT/OAuth

---

## Phase 2C: Deep Analytics (Days 5-7)

### Goal: Insights into fraud patterns and engine effectiveness

**Endpoints:**
- `GET /api/v1/admin/analytics/detector-trends` — Performance over time
- `GET /api/v1/admin/analytics/fraud-by-jurisdiction` — Geographic breakdown
- `GET /api/v1/admin/analytics/false-positive-analysis` — Why are we wrong?
- `GET /api/v1/admin/analytics/novel-pattern-suggestions` — ML recommendations

### Detector Trends

```json
{
  "detector": "AMOUNT_ANOMALY",
  "trend": [
    {
      "week": "2026-07-08",
      "detections": 45,
      "confirmed": 38,
      "accuracy": 0.844,
      "trend_delta": "+0.03"
    },
    {
      "week": "2026-07-15",
      "detections": 52,
      "confirmed": 44,
      "accuracy": 0.846,
      "trend_delta": "+0.002"
    },
    {
      "week": "2026-07-22",
      "detections": 48,
      "confirmed": 42,
      "accuracy": 0.875,
      "trend_delta": "+0.029"
    }
  ]
}
```

### Fraud by Jurisdiction

```json
{
  "jurisdictions": {
    "ZA": {
      "transactions_monitored": 45000,
      "fraud_confirmed": 320,
      "rate": 0.0071,
      "applicable_law": "POCA 121/1998",
      "top_fraud_type": "AMOUNT_ANOMALY"
    },
    "US": {
      "transactions_monitored": 32000,
      "fraud_confirmed": 189,
      "rate": 0.0059,
      "applicable_law": "18 U.S.C. § 1344",
      "top_fraud_type": "SIM_SWAP"
    },
    "EU": {
      "transactions_monitored": 28000,
      "fraud_confirmed": 156,
      "rate": 0.0056,
      "applicable_law": "AMLD6",
      "top_fraud_type": "LAYERING"
    }
  }
}
```

### False Positive Analysis

```json
{
  "false_positives": 89,
  "total_alerts": 847,
  "rate": 0.105,
  "analysis": {
    "by_detector": {
      "AMOUNT_ANOMALY": {
        "false_positives": 36,
        "common_reasons": [
          "Large but legitimate business transfers",
          "Payroll deposits",
          "Commercial rent payments"
        ],
        "recommendation": "Increase threshold for business account types"
      },
      "VELOCITY_ABUSE": {
        "false_positives": 22,
        "common_reasons": [
          "Batch processing of invoices",
          "ATM withdrawal patterns",
          "Payment processor aggregation"
        ],
        "recommendation": "Add time-of-day heuristics"
      }
    }
  },
  "improvement_suggestions": [
    "Account type classification (personal/business/merchant)",
    "Time-zone aware velocity analysis",
    "Transaction source identification (ATM vs. online vs. branch)"
  ]
}
```

---

## Testing for Week 2

### Test Suite: `tests/week2-admin.ts`

- [ ] Admin endpoints respond with correct schema
- [ ] Quarterly JSON accurately reflects vault data
- [ ] Detective performance calculated correctly
- [ ] Novel patterns extracted from findings
- [ ] Detector adjustments tracked
- [ ] Constitutional constraints verified
- [ ] Dashboard renders (basic smoke test)
- [ ] Analytics aggregations are accurate

### Test Data

Use Week 1's test results + new Week 2 transactions:
- Generate 200+ new transactions
- Introduce 3-4 novel patterns manually
- Approve 2 patterns, reject 1, leave 1 pending
- Verify quarterly JSON reflects these

---

## Deliverables for Week 2

**By end of Week 2:**

1. ✅ **Quarterly Engine Evolution JSON**
   - Tracks all metrics for the quarter
   - Reflects detector performance
   - Captures novel patterns
   - Verifies Constitutional compliance

2. ✅ **Admin Dashboard**
   - Web UI for viewing quarterly metrics
   - Detector performance table
   - Novel patterns review panel
   - Detector adjustment history
   - Compliance audit section

3. ✅ **Deep Analytics**
   - Detector trends over time
   - Fraud by jurisdiction breakdown
   - False positive analysis
   - Recommendations for improvement

4. ✅ **Admin Authentication**
   - (MVP): Simple header-based auth
   - (Nice-to-have): JWT token support

5. ✅ **Test Suite**
   - 50+ transactions processed
   - All admin endpoints tested
   - Dashboard functionality verified

---

## Success Criteria

**By end of Week 2, this must be TRUE:**

> An admin can log into the Firewall dashboard, see quarterly engine performance, review novel patterns the engine discovered, approve/reject detector adjustments, and export compliance metrics for their board.

**Admin sees:** ✅ Engine is learning, improving, and compliant  
**Bank leadership sees:** ✅ Professional AI oversight and control  
**Regulators see:** ✅ Quarterly transparency report (optional export)

---

## Files to Touch

**Already Implemented (use from Week 1):**
- `src/core/constitution.ts` — v6.0.0 now loaded
- `src/api/server.ts` — HTTP foundation
- `src/storage/vault.ts` — Data access

**Need to Create:**
- `src/api/admin.ts` — Admin endpoints (NEW)
- `web/admin.html` — Dashboard UI (NEW)
- `web/admin.js` — Dashboard logic (NEW)
- `tests/week2-admin.ts` — Admin testing (NEW)

**Need to Modify:**
- `src/api/server.ts` — Register admin routes
- `src/core/types.ts` — Add QuarterlyEvolution, DetectorMetrics types

---

## Quick Reference: What Week 2 Enables

| Feature | Who Needs It | Why |
|---------|-------------|-----|
| Quarterly JSON | Compliance Officers | Prove to regulators that engine is learning responsibly |
| Dashboard | Bank Admins | Monitor fraud detection quality, catch degradation |
| Novel Patterns | Fraud Analysts | Understand new attack types as they emerge |
| Detector Adjustments | Risk Teams | Control when/how detection rules change |
| Analytics | Leadership | Make data-driven decisions on resources |

---

## Timeline

- **Days 1-2:** Quarterly JSON + aggregation logic
- **Days 2-5:** Admin dashboard web UI
- **Days 5-7:** Deep analytics + testing + polish

---

## Questions Before Starting

1. **Admin authentication:** Simple key for MVP, or want JWT from the start?
2. **Dashboard hosting:** Serve from `/admin/` path, or separate domain?
3. **Update approval:** Should admins approve detector changes before they go live?
4. **Reporting:** Export quarterly JSON for regulators?

**Ready to start Week 2?**
