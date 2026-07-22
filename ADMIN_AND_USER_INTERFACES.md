# Admin Dashboard & User Chat Interfaces
**Architecture Document**  
**Date:** 2026-07-22  
**Purpose:** Define admin dashboard for engine evolution updates and user chat for deep research

---

## Executive Summary

**Two parallel interfaces:**

### 1. **Admin Dashboard (Web)**
- **Audience:** Bank administrators & compliance officers
- **Purpose:** Monitor forensic engine evolution
- **Updates:** Quarterly JSON downloads of new detectors, adjusted sensitivity, novel patterns
- **Owner:** Phi-3 (admin operations hub)

### 2. **User Chat (Web)**
- **Audience:** Bank fraud analysts, investigators
- **Models:** Phi-3 or Gemma4 (selectable)
- **Capability:** Select vault files for context, request deep research reports
- **Coordinator:** Gemma3 (produces reports in the middle)

**Critical Requirement:** All documents ingested must carry **GPS coordinates** for jurisdiction tracking

---

## 1. Admin Dashboard

### 1.1 Purpose

Administrators need visibility into **how the forensic engine is evolving**:
- New fraud patterns discovered
- Adjusted detector sensitivity
- False positive improvements
- Quarterly engine update packages

### 1.2 Main Dashboard Page

```
┌─────────────────────────────────────────────────────────────┐
│  VERUM OMNIS ADMIN DASHBOARD                                │
│  Institution: FirstBank ZA | Jurisdiction: ZA              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ENGINE STATUS                    QUARTERLY UPDATES          │
│  ├─ Active Detectors: 43          Q3 2026: Ready            │
│  ├─ Novel Patterns: 7              Q4 2026: Oct 15          │
│  ├─ False Positive Rate: 2.3%      Q1 2027: Jan 15          │
│  └─ Last Updated: Jul 22           [DOWNLOAD JSON]          │
│                                                              │
│  RECENT FINDINGS                   CONFIDENCE CALIBRATION    │
│  ├─ Identity Theft: 12             Very High: 94%           │
│  ├─ Money Laundering: 8            High: 87%                │
│  ├─ Velocity Abuse: 5              Moderate: 72%            │
│  └─ Novel Patterns: 2              Low: 31%                 │
│                                                              │
│  NOVEL PATTERNS DISCOVERED (Q3 2026)                        │
│  ├─ P018_SIM_SWAP_VARIANT (Confirmed, Jul 15)              │
│  ├─ P019_CROSS_BORDER_LAYER (Under Review, Jul 18)         │
│  └─ P020_CHARITY_FRAUD (Novel, Jul 20)                     │
│                                                              │
│  JURISDICTION TRACKING                                      │
│  ├─ ZA: 45 findings (South African law applied)            │
│  ├─ US: 12 findings (18 U.S.C. § 1344 referenced)          │
│  ├─ EU: 8 findings (AMLD6 applied)                         │
│  └─ AE: 3 findings (UAE AML Decree-Law applied)            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Engine Evolution JSON

**Downloaded quarterly by administrators**

```json
{
  "engine_update": {
    "version": "6.0.2",
    "date": "2026-10-15",
    "organization": "FirstBank ZA",
    "update_type": "quarterly",
    "new_detectors_added": [
      {
        "detector_id": "P018_SIM_SWAP_VARIANT",
        "name": "SIM Swap Attack — Variant Pattern",
        "description": "Fraudster obtains victim's phone number via social engineering, transfers to new SIM, accesses accounts",
        "confidence": "HIGH",
        "warm_start_examples": 3,
        "false_positive_rate": 1.2,
        "detection_rate": 94,
        "applicable_jurisdictions": ["ZA", "US", "EU", "UK"],
        "applicable_laws": [
          "Prevention of Organised Crime Act 121 of 1998 (ZA)",
          "18 U.S.C. § 1344 Bank Fraud (US)"
        ]
      }
    ],
    "detectors_adjusted": [
      {
        "detector_id": "AMOUNT_ANOMALY",
        "change": "sensitivity_reduced",
        "reason": "False positive rate was 5.2%, reduced threshold from 3-sigma to 2.5-sigma",
        "new_false_positive_rate": 2.1,
        "impact": "Will reduce false alerts by ~40% while maintaining 98% true positive rate"
      }
    ],
    "novel_patterns_discovered": [
      {
        "pattern_id": "P019_CROSS_BORDER_LAYER",
        "fraud_type": "MONEY_LAUNDERING",
        "description": "Layering scheme using cross-border transfers to obscure source",
        "examples": ["ALERT-0847", "ALERT-0923"],
        "jurisdiction_correlation": "Found across ZA, EU, AE jurisdictions",
        "status": "UNDER_REVIEW",
        "recommendation": "Monitor next 10 cases to establish threshold for new detector"
      }
    ],
    "constitutional_version": "6.0.0",
    "seal_protocol": "verum-omnis-seal v1.0",
    "signature": "SHA-512-hash-of-entire-update"
  }
}
```

### 1.4 Phi-3 as Admin Hub

**Location:** `src/api/admin-hub.ts` (new)

```typescript
export class Phi3AdminHub {
  private learningRegistry: NovelPatternRegistry;
  private detectorDB: DetectorDatabase;
  
  /** Generate quarterly engine evolution report */
  async generateQuarterlyUpdate(quarter: string): Promise<EngineEvolutionJSON> {
    return {
      engine_update: {
        version: this.getEngineVersion(),
        date: new Date().toISOString(),
        organization: this.config.institution.name,
        update_type: "quarterly",
        
        // New detectors activated this quarter
        new_detectors_added: await this.detectorDB.getNewDetectors(quarter),
        
        // Existing detectors that were tweaked
        detectors_adjusted: await this.detectorDB.getAdjustedDetectors(quarter),
        
        // Novel patterns discovered but not yet detectors
        novel_patterns_discovered: await this.learningRegistry.getNovelPatterns(quarter),
        
        constitutional_version: loadConstitution().version,
        seal_protocol: "verum-omnis-seal v1.0",
        signature: this.signUpdate(), // Cryptographic signature
      },
    };
  }
  
  /** Admins can download quarterly updates */
  async downloadEngineUpdate(quarter: string): Promise<{
    json_path: string;
    checksum: string;
    timestamp: string;
  }> {
    const update = await this.generateQuarterlyUpdate(quarter);
    const path = `updates/engine-evolution-${quarter}.json`;
    await this.storage.write(path, update);
    
    return {
      json_path: path,
      checksum: sha512(JSON.stringify(update)),
      timestamp: new Date().toISOString(),
    };
  }
}
```

### 1.5 Admin Dashboard Endpoints

```typescript
// GET /api/admin/dashboard
{
  "engine_status": {
    "active_detectors": 43,
    "novel_patterns": 7,
    "false_positive_rate": 2.3,
    "last_updated": "2026-07-22T14:30:00Z"
  },
  "recent_findings": {
    "identity_theft": 12,
    "money_laundering": 8,
    "velocity_abuse": 5,
    "novel_patterns": 2
  },
  "jurisdiction_distribution": {
    "ZA": { count: 45, applicable_laws: ["POCA 121/1998", ...] },
    "US": { count: 12, applicable_laws: ["18 U.S.C. § 1344", ...] },
    "EU": { count: 8, applicable_laws: ["AMLD6", ...] },
    "AE": { count: 3, applicable_laws: ["Decree-Law 20/2018", ...] }
  }
}

// GET /api/admin/engine-evolution/quarterly
{
  "available_quarters": [
    { quarter: "Q3-2026", date: "2026-10-15", status: "ready" },
    { quarter: "Q4-2026", date: "2026-11-15", status: "scheduled" }
  ]
}

// GET /api/admin/engine-evolution/download?quarter=Q3-2026
→ Returns JSON file (see above)
```

---

## 2. User Chat Interface

### 2.1 Purpose

Bank fraud analysts and investigators need:
- Interactive chat with AI models
- Ability to load vault files as context
- Request deep research reports
- Get Phi-3's legal verification

### 2.2 Chat Interface

```
┌─────────────────────────────────────────────────────────────┐
│  VERUM OMNIS INVESTIGATION CHAT                             │
│  Model: [Phi-3 Legal ▼]  Institution: FirstBank ZA         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Analyst: Load evidence for ALERT-0847                      │
│           [Select from Vault ▼]                            │
│                                                              │
│  Phi-3:   Evidence loaded:                                  │
│           • alert_0847.json (5.2 KB)                        │
│           • transaction_log_0847.csv (12 KB)                │
│           Ready for analysis. What do you need?             │
│                                                              │
│  Analyst: Is this SIM swap fraud? Check against ZA law      │
│           Request deep research report                      │
│                                                              │
│  Phi-3:   ANALYZING...                                      │
│           Evidence Review: ✓ Passed                         │
│           Legal Jurisdiction: South Africa (GPS coords)     │
│           Applicable Law: Prevention of Organised Crime     │
│                           Act 121 of 1998                   │
│                                                              │
│           DEEP RESEARCH REPORT:                             │
│           SIM Swap Pattern Analysis                         │
│           ├─ Victim phone number ported to attacker's SIM   │
│           ├─ Unauthorized account access within 2 hours     │
│           ├─ Transfer of R47,500 to mule account            │
│           └─ Matches P018_SIM_SWAP_VARIANT pattern          │
│                                                              │
│           TRIPLE VERIFICATION:                              │
│           • Phi-3 (Legal): VERIFIED under POCA Act 121      │
│           • Gemma3 (Forensic): Anchors confirmed            │
│           • NineBrain (Validation): No blocking issues      │
│           → VERDICT: Confirmed Fraud                        │
│                                                              │
│  Analyst: Good. Recommend to management                     │
│                                                              │
│  Phi-3:   Report generated and sealed. Case reference:     │
│           VO-FW-CASE-0847 | Seal ID: seal-abc123...        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Chat Features

**Model Selection:**
```
[Phi-3 Legal ▼]     [Gemma4 Monitor ▼]     [Gemma3 Forensics]
  (Legal analysis)    (Pattern detection)     (Read-only reports)
```

**Vault File Selection:**
```
[Select from Vault ▼]
├─ Recent Alerts
│  ├─ ALERT-0847 (SIM Swap)
│  ├─ ALERT-0923 (Money Laundering)
│  └─ ALERT-0901 (Identity Theft)
├─ Evidence Atoms
│  ├─ transaction_log_*.csv
│  ├─ email_exchange_*.txt
│  └─ bank_statement_*.pdf
└─ Seals
   ├─ seal-abc123.pdf (Confirmed)
   └─ seal-def456.pdf (Confirmed)
```

**Capabilities by Model:**

| Feature | Phi-3 Legal | Gemma4 Monitor | Gemma3 Forensics |
|---------|-------------|---|---|
| Legal analysis | ✅ | — | — |
| Jurisdiction verification | ✅ | — | — |
| Deep research reports | ✅ | — | — |
| Pattern detection | — | ✅ | — |
| Anomaly analysis | — | ✅ | — |
| Report review | — | — | ✅ |
| Evidence verification | — | — | ✅ |
| Triple verification | ✅ | ✅ | ✅ |

### 2.4 Deep Research Report Request

```typescript
// User request:
{
  "chat_message": "Request deep research report for ALERT-0847",
  "alert_id": "ALERT-0847",
  "model": "Phi-3",
  "analysis_depth": "comprehensive"
}

// Phi-3 generates report via Gemma3:
{
  "report_type": "deep_research",
  "title": "SIM Swap Fraud — Deep Investigation",
  "sections": [
    {
      "section": "Evidence Summary",
      "content": "Victim's phone number ported to attacker's SIM..."
    },
    {
      "section": "Applicable Law",
      "jurisdiction": "South Africa",
      "laws": [
        "Prevention of Organised Crime Act 121 of 1998",
        "Criminal Procedure Act 51 of 1977"
      ],
      "analysis": "Meets elements of racketeering per POCA..."
    },
    {
      "section": "Triple Verification",
      "phi3": "CONCURS — Legal elements satisfied",
      "gemma3": "CONCURS — Evidence properly anchored",
      "ninebrain": "CONCURS — No blocking contradictions"
    },
    {
      "section": "Recommendation",
      "content": "Escalate to law enforcement with sealed evidence"
    }
  ],
  "seal_id": "seal-xyz789",
  "generated_at": "2026-07-22T15:45:00Z"
}
```

---

## 3. GPS Coordinates & Jurisdiction Tracking

### 3.1 Critical Requirement

**All documents ingested must carry GPS coordinates** for automatic jurisdiction determination.

### 3.2 Document Ingestion with GPS

```typescript
// File upload with metadata
POST /api/v1/evidence
{
  "document": {
    "file": <binary>,
    "filename": "atm_receipt_2026-07-22.pdf",
    "gps_latitude": -25.7461,        // Johannesburg, ZA
    "gps_longitude": 28.2311,
    "timestamp": "2026-07-22T14:30:00Z",
    "device_id": "ATM-KINGSWAY-001"
  }
}

// Response:
{
  "evidence_id": "ATOM-abc123",
  "jurisdiction_detected": "ZA (South Africa)",
  "applicable_laws": [
    "Prevention of Organised Crime Act 121 of 1998",
    "Financial Intelligence Centre Act 38 of 2001"
  ],
  "gps_recorded": true,
  "legal_framework_loaded": true
}
```

### 3.3 GPS to Jurisdiction Mapping

```typescript
class JurisdictionResolver {
  async resolveFromGPS(lat: number, lon: number): Promise<{
    jurisdiction_code: string;
    jurisdiction_name: string;
    applicable_laws: string[];
    phi3_model_variant: string; // Phi-3-ZA, Phi-3-US, etc.
  }> {
    // Reverse geocode GPS to country/region
    const location = await this.geocoder.reverse(lat, lon);
    
    // Map to jurisdiction code
    const jurisdiction = JURISDICTION_MAP[location.country];
    
    // Load applicable laws for this jurisdiction
    const laws = LEGAL_FRAMEWORK[jurisdiction];
    
    // Select Phi-3 variant with jurisdiction-specific knowledge
    const modelVariant = this.selectPhiVariant(jurisdiction);
    
    return {
      jurisdiction_code: jurisdiction,
      jurisdiction_name: location.country,
      applicable_laws: laws,
      phi3_model_variant: modelVariant,
    };
  }
}

// Jurisdiction codes:
const JURISDICTION_MAP = {
  "ZA": "ZA",      // South Africa
  "US": "US",      // United States
  "GB": "UK",      // United Kingdom
  "DE": "EU",      // Germany (EU)
  "AE": "AE",      // United Arab Emirates
  "SG": "APAC",    // Singapore
  // ... more jurisdictions
};
```

### 3.4 Phi-3 Jurisdiction-Aware Response

Once jurisdiction is determined, Phi-3 adjusts analysis:

```typescript
// Phi-3 knows:
// - Applicable laws for the jurisdiction
// - Applicable penalties and severity
// - Required reporting procedures
// - Mutual legal assistance treaties
// - Safe harbor requirements

// For ZA jurisdiction:
const phi3_za = {
  primary_laws: [
    "Prevention of Organised Crime Act 121 of 1998",
    "Financial Intelligence Centre Act 38 of 2001",
  ],
  regulator: "Financial Intelligence Centre (FIC)",
  reporting_requirement: "Suspicious Transaction Report (STR)",
  prosecution_authority: "National Prosecuting Authority (NPA)",
};

// For US jurisdiction:
const phi3_us = {
  primary_laws: [
    "18 U.S.C. § 1344 (Bank Fraud)",
    "31 U.S.C. § 5318 (AML/CFT)",
  ],
  regulator: "FinCEN, OCC, FDIC",
  reporting_requirement: "Suspicious Activity Report (SAR)",
  prosecution_authority: "U.S. Department of Justice",
};
```

---

## 4. Roles & Permissions

### 4.1 Admin Role

**Access:**
- Dashboard (engine status, novel patterns, jurisdiction distribution)
- Download quarterly engine evolution JSON
- View detector adjustments & false positive improvements
- Cannot make decisions about findings (read-only)

### 4.2 Investigator/Analyst Role

**Access:**
- Chat with Phi-3 or Gemma4
- Select vault files for context
- Request deep research reports
- View sealed findings with evidence anchors
- Submit verification verdicts (confirmed/false/novel)
- Cannot modify engine directly (feedback only)

### 4.3 Compliance Officer Role

**Access:**
- Dashboard (full)
- Chat (read-only, cannot request deep research)
- View jurisdiction tracking
- Generate compliance reports

---

## 5. Implementation Roadmap

### Phase 1: Admin Dashboard (MEDIUM - 2 weeks)
- [ ] Build Phi-3AdminHub class
- [ ] Generate quarterly update JSON
- [ ] Dashboard UI showing engine status
- [ ] Download endpoint for engine evolution

### Phase 2: User Chat (HIGH - 3 weeks)
- [ ] Chat interface with model selection
- [ ] Vault file selection dropdown
- [ ] Deep research report generation
- [ ] Triple verification display

### Phase 3: GPS & Jurisdiction (HIGH - 2 weeks)
- [ ] GPS metadata collection in document ingestion
- [ ] JurisdictionResolver class
- [ ] Phi-3 variant selection by jurisdiction
- [ ] Applicable laws loaded per jurisdiction

### Phase 4: Phi-3 Dual Role (MEDIUM - 2 weeks)
- [ ] Admin operations (engine evolution reporting)
- [ ] Legal verification (jurisdiction analysis)
- [ ] Split responsibilities cleanly

**Total:** ~9 weeks

---

## 6. Key APIs

```typescript
// Admin endpoints
GET    /api/admin/dashboard
GET    /api/admin/engine-evolution/quarterly
GET    /api/admin/engine-evolution/download?quarter=Q3-2026

// Chat endpoints
POST   /api/chat/message
POST   /api/chat/load-vault-file
POST   /api/chat/deep-research
GET    /api/chat/models

// Evidence ingestion with GPS
POST   /api/v1/evidence (with GPS coordinates)
GET    /api/v1/evidence/{evidence_id}

// Jurisdiction lookup
GET    /api/jurisdiction/from-gps?lat={lat}&lon={lon}
GET    /api/jurisdiction/{code}/applicable-laws
```

---

## 7. Conclusion

**Admin Dashboard:**
- Admins get quarterly JSON updates of engine evolution
- Phi-3 manages engine reporting and versioning
- Transparent view of new detectors, adjustments, novel patterns

**User Chat:**
- Bank analysts chat with Phi-3 (legal) or Gemma4 (patterns)
- Load vault files for context
- Request deep research reports produced by Gemma3
- Phi-3 triple-verifies with jurisdiction-specific laws

**GPS Requirement:**
- All documents must carry GPS coordinates
- Automatic jurisdiction determination
- Phi-3 adjusts analysis per applicable laws
- Ensures legal compliance per jurisdiction

This creates two tight feedback loops:
1. **Admin loop:** Engine evolution → quarterly updates → admin dashboard
2. **User loop:** Chat + deep research → verification verdicts → engine learning
