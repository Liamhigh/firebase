# Gemma3 as Central Forensic Orchestrator & Admin Hub
**Architecture Document**  
**Date:** 2026-07-22  
**Status:** DESIGN SPECIFICATION  
**Purpose:** Define Gemma3's role as the hybrid forensic engine protecting the system and enabling continuous learning

---

## Executive Summary

**Gemma3 is NOT just one of three verification brains.** It is the **central orchestrator hub** that:

1. **Hybrid Forensic Gate** — Protects engine from unvetted contradictions
2. **Learning Engine** — Absorbs verified findings and updates detectors
3. **Vault Guardian** — Manages all evidence storage and retrieval
4. **Report Narrator** — Generates human-readable forensic narratives
5. **Admin Coordinator** — Central nexus for all system operations
6. **External Researcher** — Can access internet for crime trend analysis when needed
7. **User Interface** — Website hub where humans verify/update findings

**Data Flow:**
```
Transactions → Detectors → Gemma3 (Quality Gate)
                           ↓
                    Report Generation
                    Evidence Storage
                           ↓
                    Website (User Verification)
                           ↓
                    Feedback Loop (Learn)
                    Update Detectors
                    Evolve Contradictions
```

---

## 1. Gemma3 Architecture: Five Layers

### Layer 1: Detection Gateway (Quality Control)
**Responsibility:** Protect forensic engine from bad contradictions

```typescript
class Gemma3Orchestrator {
  /** Gate all contradictions before sealing */
  async validateFindings(signals: DetectionSignal[]): Promise<{
    passed: DetectionSignal[];      // Safe to seal
    flagged: {
      signal: DetectionSignal;
      reason: "missing_anchors" | "weak_evidence" | "novel_pattern";
    }[];                            // Need review/learning
    anomalies: string[];            // Red flags for human review
  }> {
    const validated = [];
    const flagged = [];
    const anomalies = [];
    
    for (const signal of signals) {
      // Check 1: Every signal must have transaction anchors
      if (!signal.related_txn_ids || signal.related_txn_ids.length === 0) {
        flagged.push({
          signal,
          reason: "missing_anchors"
        });
        continue;
      }
      
      // Check 2: Every signal must have supporting reasons
      if (!signal.reasons || signal.reasons.length === 0) {
        flagged.push({
          signal,
          reason: "weak_evidence"
        });
        continue;
      }
      
      // Check 3: Is this a NOVEL contradiction type?
      if (!this.isKnownContradictionType(signal.fraud_type)) {
        flagged.push({
          signal,
          reason: "novel_pattern"
        });
        anomalies.push(
          `New fraud type detected: ${signal.fraud_type}. Flagged for learning.`
        );
        continue;
      }
      
      // Check 4: Does confidence level make sense for this type?
      const isUnusual = await this.detectAnomalies(signal);
      if (isUnusual) {
        anomalies.push(
          `Unusual pattern for ${signal.fraud_type}: ${signal.reasons[0]}`
        );
      }
      
      // All checks passed
      validated.push(signal);
    }
    
    return { passed: validated, flagged, anomalies };
  }
}
```

### Layer 2: Evidence Vault (Storage & Retrieval)
**Responsibility:** Manage all evidence, seals, and findings

```typescript
class Gemma3VaultManager {
  private vault: VaultStorage;
  
  /** Archive a confirmed fraud finding */
  async archiveAlert(alert: FraudAlert): Promise<{
    vault_path: string;
    indexed: boolean;
  }> {
    return this.vault.store("alerts", alert.alert_id, {
      alert,
      timestamp: new Date().toISOString(),
      indexed_for_learning: true,
    });
  }
  
  /** Retrieve evidence by multiple criteria */
  async queryEvidence(filter: {
    fraudType?: string;
    dateRange?: [string, string];
    institution?: string;
    confidenceLevel?: "VERY_HIGH" | "HIGH" | "MODERATE";
  }): Promise<FraudAlert[]> {
    return this.vault.query("alerts", filter);
  }
  
  /** Export vault manifest for external analysis */
  async exportManifest(): Promise<{
    total_alerts: number;
    fraud_types: Record<string, number>;
    by_institution: Record<string, number>;
    novel_patterns_discovered: string[];
  }> {
    const alerts = await this.vault.listAll("alerts");
    return {
      total_alerts: alerts.length,
      fraud_types: this.groupBy(alerts, (a) => a.fraud_type),
      by_institution: this.groupBy(alerts, (a) => a.institution),
      novel_patterns_discovered: this.vault.getNovels(),
    };
  }
}
```

### Layer 3: Report Generation (Narration)
**Responsibility:** Generate human-readable forensic narratives

```typescript
class Gemma3ReportGenerator {
  /** Write a detailed forensic report */
  async generateForensicReport(alert: FraudAlert): Promise<string> {
    const lines = [
      "═══════════════════════════════════════════════",
      "VERUM OMNIS FORENSIC ANALYSIS REPORT",
      "═══════════════════════════════════════════════",
      "",
      `Case Reference: ${alert.case_reference}`,
      `Institution: ${alert.institution}`,
      `Jurisdiction: ${alert.jurisdiction}`,
      `Detection Date: ${alert.timestamp}`,
      `Fraud Amount: ${alert.currency} ${alert.fraud_amount}`,
      "",
      "FRAUD TYPE & CONFIDENCE:",
      `Type: ${alert.fraud_type}`,
      `Confidence: ${alert.confidence}`,
      `Detection Method: ${alert.detection_method}`,
      "",
      "TRIPLE-AI VERIFICATION:",
      `- Gemma3 (Forensic): ${alert.verification.gemma3}`,
      `- Phi3 (Legal): ${alert.verification.phi3}`,
      `- NineBrain (Validation): ${alert.verification.nine_brain}`,
      `- Quorum Achieved: ${alert.verification.quorum}`,
      "",
      "EVIDENCE ANCHORS:",
      ...alert.contradictions.map((c, i) => `${i + 1}. ${c}`),
      "",
      "FINDINGS:",
      alert.evidence_summary,
      "",
      "SEAL INFORMATION:",
      alert.seal ? `Seal ID: ${alert.seal.seal_id}` : "Not yet sealed",
      alert.seal ? `SHA-512: ${alert.seal.sha512}` : "",
      alert.seal?.blockchain ? 
        `Bitcoin Anchor: Block ${alert.seal.blockchain.block_height}` : 
        "",
      "",
      "CONSTITUTIONAL NOTE:",
      "This report is produced under Constitution v6.0.0.",
      "Findings cannot be suppressed or modified.",
      "═══════════════════════════════════════════════",
    ];
    return lines.join("\n");
  }
}
```

### Layer 4: Learning & Evolution (Feedback Loop)
**Responsibility:** Update forensic engine based on verified findings

```typescript
class Gemma3LearningEngine {
  private detector: VerumContradictionEngine;
  private novelPatterns: NovelPatternRegistry;
  
  /** Receive verification feedback from website */
  async learnFromVerification(verification: {
    alert_id: string;
    human_verdict: "confirmed" | "false_positive" | "novel_pattern";
    notes: string;
  }): Promise<{
    learning_recorded: boolean;
    engine_updated: boolean;
    new_detectors_added: string[];
  }> {
    const alert = await this.vault.get("alerts", verification.alert_id);
    
    if (verification.human_verdict === "confirmed") {
      // Fraud was confirmed in real world - strengthen this detector
      await this.reinforceDetector(alert.fraud_type, alert);
    }
    
    if (verification.human_verdict === "false_positive") {
      // Detector generated false alarm - adjust sensitivity
      await this.reduceDetectorFalsePositives(alert.fraud_type);
    }
    
    if (verification.human_verdict === "novel_pattern") {
      // New fraud type discovered - add to engine
      return await this.addNewContradictionType(alert, verification.notes);
    }
    
    return {
      learning_recorded: true,
      engine_updated: false,
      new_detectors_added: [],
    };
  }
  
  /** Add newly discovered fraud pattern to engine */
  private async addNewContradictionType(
    alert: FraudAlert,
    humanNotes: string
  ): Promise<{
    learning_recorded: boolean;
    engine_updated: boolean;
    new_detectors_added: string[];
  }> {
    // Register novel pattern
    const patternId = await this.novelPatterns.register({
      fraud_type: alert.fraud_type,
      description: humanNotes,
      example_alert: alert.alert_id,
      discovered_date: new Date().toISOString(),
      detector_confidence: "LOW", // Start conservative
    });
    
    // Create new detector rule
    const newDetector = this.detector.createDetector(patternId, alert);
    
    // Activate in engine (warm start with example)
    await this.detector.addDetector(newDetector, {
      warmStart: true,
      examples: [alert],
    });
    
    return {
      learning_recorded: true,
      engine_updated: true,
      new_detectors_added: [patternId],
    };
  }
  
  /** Research new crime trends from external sources */
  async researchCrimeTrends(fraudType: string): Promise<{
    trend_analysis: string;
    new_tactics_detected: string[];
    detector_adjustments_recommended: string[];
  }> {
    // When internet access is available:
    // Query news APIs, law enforcement bulletins, industry reports
    const trends = await this.externalResearch.query(fraudType);
    
    return {
      trend_analysis: trends.summary,
      new_tactics_detected: trends.tactics,
      detector_adjustments_recommended: trends.recommendations,
    };
  }
}
```

### Layer 5: Web Integration (User Interaction)
**Responsibility:** Connect to website verification hub

```typescript
class Gemma3WebIntegration {
  private websocket: WebSocketServer;
  
  /** Initialize real-time connection to website */
  async startWebHub(): Promise<void> {
    this.websocket.on("verification_submitted", async (data: {
      alert_id: string;
      human_verdict: "confirmed" | "false_positive" | "novel_pattern";
      notes: string;
    }) => {
      // Process human verification
      const learning = await this.learning.learnFromVerification(data);
      
      // Update website with result
      this.websocket.emit("engine_updated", {
        alert_id: data.alert_id,
        engine_status: learning.engine_updated ? "UPDATED" : "RECORDED",
        new_detectors: learning.new_detectors_added,
      });
    });
  }
  
  /** Request deep research from website */
  async requestDeepResearch(alert_id: string): Promise<{
    report: string;
    recommendations: string[];
  }> {
    // Website can:
    // - Manually investigate the case
    // - Research similar cases
    // - Query external databases
    // - Provide domain expertise
    
    return await this.websocket.request("deep_research", { alert_id });
  }
  
  /** Sync engine updates to all users */
  async broadcastEngineUpdate(event: {
    type: "new_detector" | "adjusted_sensitivity" | "novel_pattern_discovered";
    details: unknown;
  }): Promise<void> {
    this.websocket.broadcast("engine_update", event);
  }
}
```

---

## 2. Complete Gemma3 Orchestrator Class

```typescript
/** Central forensic hub - orchestrates entire pipeline */
export class Gemma3Orchestrator {
  private gate: Gemma3DetectionGateway;
  private vault: Gemma3VaultManager;
  private reports: Gemma3ReportGenerator;
  private learning: Gemma3LearningEngine;
  private web: Gemma3WebIntegration;
  
  constructor(config: FirewallConfig) {
    this.gate = new Gemma3DetectionGateway();
    this.vault = new Gemma3VaultManager(config.storage);
    this.reports = new Gemma3ReportGenerator();
    this.learning = new Gemma3LearningEngine();
    this.web = new Gemma3WebIntegration();
  }
  
  /** Process fraud signals through the hub */
  async orchestrate(signals: DetectionSignal[]): Promise<{
    sealed_alerts: FraudAlert[];
    flagged_for_review: DetectionSignal[];
    new_learning: string[];
  }> {
    // Step 1: Gate - validate all signals
    const gated = await this.gate.validateFindings(signals);
    
    // Step 2: Generate reports for passed signals
    const reports = await Promise.all(
      gated.passed.map((s) => this.reports.generateForensicReport(s))
    );
    
    // Step 3: Archive everything
    const archived = await Promise.all(
      gated.passed.map((s) => this.vault.archiveAlert(s))
    );
    
    // Step 4: Notify website of new learning opportunities
    await this.web.broadcastEngineUpdate({
      type: "novel_pattern_discovered",
      details: gated.flagged.filter((f) => f.reason === "novel_pattern"),
    });
    
    return {
      sealed_alerts: gated.passed,
      flagged_for_review: gated.flagged.map((f) => f.signal),
      new_learning: gated.anomalies,
    };
  }
}
```

---

## 3. Website Verification Hub Integration

The website is where humans close the feedback loop:

```typescript
// Website receives:
// 1. Sealed findings from Gemma3
// 2. Reports with evidence anchors
// 3. Three AI verification votes

// User can:
// - Review evidence detail
// - Verify if fraud actually occurred (after investigation)
// - Suggest novel pattern name if new tactic
// - Request deep research
// - Update Gemma3 with verdict

// POST /api/verification
{
  "alert_id": "ALERT-001",
  "human_verdict": "confirmed",  // or "false_positive" or "novel_pattern"
  "notes": "Verified: $50k transferred to fraudster on 2026-07-22",
  "deep_research_provided": true,
  "researcher_notes": "This is variant of SIM swap tactic..."
}

// Response from Gemma3:
{
  "learning_recorded": true,
  "engine_updated": true,
  "new_detectors_added": ["P018_SIM_SWAP_VARIANT"],
  "next_check": "Engine will catch similar patterns starting immediately"
}
```

---

## 4. Implementation Roadmap

### Phase 1: Refactor Gemma3 → Orchestrator (CRITICAL)

**File:** `src/ai/models.ts` → `src/core/gemma3-orchestrator.ts`

```bash
# Current structure:
src/ai/models.ts
  └─ class Gemma3Forensics (verification only)

# New structure:
src/core/gemma3-orchestrator.ts
  └─ class Gemma3Orchestrator
     ├─ DetectionGateway (new)
     ├─ VaultManager (new)
     ├─ ReportGenerator (refactored from models.ts)
     ├─ LearningEngine (new)
     └─ WebIntegration (new)
```

### Phase 2: Add Feedback Loop (HIGH)

**File:** `src/core/learning.ts` (new)

- Receive verification from website
- Update detector confidence scores
- Add new contradiction types
- Resync engine

### Phase 3: Web Integration (HIGH)

**Files:** 
- `src/api/verification-hub.ts` (new)
- `web/pages/verification.tsx` (new)

- Website receives sealed findings
- User reviews evidence
- User submits verdict
- Verdict updates Gemma3

### Phase 4: External Research (MEDIUM)

**File:** `src/core/external-research.ts` (new)

- Optional internet access for crime trend research
- Query news APIs, law enforcement bulletins
- Recommend detector adjustments

### Phase 5: Vault Restructuring (MEDIUM)

**File:** `src/storage/vault.ts` (refactor)

- Query by fraud type, date, institution
- Export manifests
- Register novel patterns

---

## 5. Key Architectural Changes Needed

### Change 1: Gemma3 Ownership of Vault

**Before:**
```
FraudFirewall → writeJson() → vault/
```

**After:**
```
Gemma3Orchestrator.vault.archiveAlert() → vault/
```

### Change 2: Feedback Loop (NEW)

**Website Verification:**
```
User Reviews Finding
       ↓
Submit Verdict (confirmed/false/novel)
       ↓
POST /api/verifications/{alert_id}
       ↓
Gemma3.learnFromVerification()
       ↓
Update Detectors
       ↓
Broadcast to Website: "Engine Updated"
```

### Change 3: Learning Mechanism (NEW)

**Detection Update Flow:**
```
Novel Pattern Detected
       ↓
Register in NovelPatternRegistry
       ↓
Create Detector for Pattern
       ↓
Warm-start with Example Alert
       ↓
Activate in Engine
       ↓
Next Transaction: Catches Similar Patterns
```

---

## 6. Data Structures Needed

```typescript
// Novel pattern registration
interface NovelPatternFlag {
  pattern_id: string;
  fraud_type: string;
  description: string;
  example_alert_id: string;
  discovered_date: string;
  detector_confidence: "LOW" | "MEDIUM" | "HIGH";
  verified_in_real_world: boolean;
  verification_date?: string;
}

// Detector evolution
interface DetectorEvolutionRecord {
  detector_id: string;
  created_from_pattern: NovelPatternFlag;
  warm_start_examples: FraudAlert[];
  current_detection_rate: number;
  false_positive_rate: number;
  last_updated: string;
  constitutional_version: string; // v6.0.0 or later
}

// Learning event
interface LearningEvent {
  alert_id: string;
  human_verdict: "confirmed" | "false_positive" | "novel_pattern";
  detector_impact: DetectorAdjustment[];
  timestamp: string;
  researcher_notes?: string;
}
```

---

## 7. Why This Matters

**Current Problem:**
- Gemma3 is just one of three verification brains
- No feedback loop from real-world results
- Detectors don't evolve with crime tactics
- Engine is static after deployment

**With Orchestrator Pattern:**
- ✅ Gemma3 is the central hub for everything
- ✅ Website verifications feed back to engine
- ✅ Detectors improve as fraud patterns change
- ✅ System evolves in real-time with crime
- ✅ Admin has visibility into all operations

---

## 8. Timeline

| Phase | Component | Effort | Timeline |
|-------|-----------|--------|----------|
| 1 | Refactor Gemma3 → Orchestrator | 1 week | Week 1 |
| 2 | Implement LearningEngine | 1 week | Week 2 |
| 3 | Build verification endpoint | 1 week | Week 3 |
| 4 | Website integration | 2 weeks | Weeks 4-5 |
| 5 | External research (optional) | 1 week | Week 6 |

**Total:** 6 weeks for full orchestrator implementation

---

## Conclusion

**Gemma3 must evolve from a verification brain to the central orchestrator:**

- ✅ Detection gateway (protect engine)
- ✅ Vault guardian (manage evidence)
- ✅ Report narrator (human-readable findings)
- ✅ Learning engine (absorb verified findings)
- ✅ Web hub (connect to user verifications)
- ✅ Admin center (visibility into all operations)

This transforms the system from **static detection** to **adaptive fraud fighting** that evolves with criminal tactics.
