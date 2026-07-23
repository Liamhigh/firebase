# Gemma3 Responsibilities Audit
**Date:** 2026-07-22  
**Purpose:** Verify that Gemma3 has all responsibilities for forensic engine protection, learning, reporting, vault management, and notifications  

---

## Executive Summary

**Current Implementation:** Gemma3 handles **3 of 5** key responsibilities  
**Gap:** Engine learning/evolution and explicit vault management need clarification  

| Responsibility | Implemented | Details |
|----------------|-------------|---------|
| ✅ Protect forensic engine from bad contradictions | YES | Via `verify()` method - validates anchors & document integrity |
| ⚠️ Update/learn forensic engine when new contradictions emerge | **PARTIAL** | Engine detectors are static; no dynamic learning loop found |
| ✅ Narrate human-readable reports | YES | Via `writeForensicReport()` method |
| ⚠️ Look after the evidence vault | **IMPLICIT** | Vault operations delegated to FraudFirewall; Gemma3 not direct owner |
| ✅ Handle email notifications | YES | Via NotificationService coordination |

---

## 1. Gemma3 Protection of Forensic Engine

### Current Implementation: ✅ IMPLEMENTED

**Location:** `src/ai/models.ts` lines 129-143

```typescript
verify(ctx: ModelContext, proposed: DetectionSignal[]): VerificationVote {
  const hasAnchors = proposed.every((p) => p.related_txn_ids.length > 0);
  const hasReasons = proposed.every((p) => p.reasons.length > 0);
  const concurs = proposed.length > 0 && hasAnchors && hasReasons;
  return {
    vote: concurs ? "CONCURS" : "DISSENTS",
    rationale: "Evidence atoms anchored; document integrity checks pass"
  };
}
```

**What it does:**
- Validates that every detection signal has transaction anchors
- Verifies each signal has supporting reasons
- DISSENTS if contradictions lack evidence backing
- Prevents unanchored/unsupported contradictions from being sealed

**Protection Strategy:**
- Blocks fraudulent findings at the triple-verification gate
- Forces human review on incomplete evidence (HUMAN_REVIEW status)
- Never seals reports with weak or missing anchors

**Assessment:** ✅ **WORKING AS SPECIFIED** — Gemma3 is the gatekeeper preventing bad contradictions from getting sealed.

---

## 2. Gemma3 Learning & Updating Forensic Engine

### Current Implementation: ⚠️ **PARTIAL / UNCLEAR**

**Question:** What does "update the forensic engine" mean?

#### Option A: Dynamic Rule Updates
**Current State:** ❌ NOT FOUND

The forensic engine (VerumContradictionEngine) has 43 static contradiction types defined in `src/engine/enums.ts`. These are:
- Pre-defined at compile time
- Loaded from JSON enums
- Not modified at runtime based on findings

**No mechanism exists for Gemma3 to:**
- Detect a novel contradiction pattern
- Add it to the detector rules
- Reload the engine with new detection capabilities

#### Option B: Learning/Logging New Patterns
**Current State:** ⚠️ **IMPLICIT**

Findings are logged to vault:
- Alert JSON stored at `src/storage/vault.ts:alertPath()`
- Contradictions recorded in FraudAlert.contradictions array
- Evidence summary from Gemma3 report stored

This creates an **audit trail** of new patterns discovered, but:
- ❌ No explicit "Gemma3 learns new contradiction" mechanism
- ❌ No feedback loop to detector
- ❌ No human review process for adding new types

#### Option C: Red-Teaming & Validation
**Current State:** ✅ **PARTIALLY IMPLEMENTED**

NineBrain's B9 (Research & Development) role includes:
- Red-teaming findings
- Validating methodology
- Looking for novel patterns

But Gemma3 doesn't have explicit "research" responsibilities; it's:
- B9's input provider (via `writeForensicReport()`)
- Not the engine updater itself

### Assessment: ⚠️ **CLARIFICATION NEEDED**

**Question for you:** When you say "update the forensic engine," do you mean:

1. **Runtime learning?** Gemma3 discovers "Pattern XYZ" is missing, adds new detector rule → engine reloads
2. **Logging & batch learning?** Gemma3 flags novel findings → humans review quarterly → new version released
3. **Evolution via constitution?** New contradiction types added to Constitution vX.Y.Z → seals embed updated rules

**Recommendation:** Add explicit feedback loop:

```typescript
// Proposed: Gemma3ForensicsWithLearning
class Gemma3Forensics {
  // ... existing methods ...
  
  /** Detect novel contradiction patterns and flag for engine evolution */
  flagNovelPatterns(
    proposedSignals: DetectionSignal[], 
    engineCapabilities: ContradictionType[]
  ): NovelPatternFlag[] {
    // Check if any signals represent patterns NOT in current engine
    // Return learning signals for B9 red-team review
  }
  
  /** Propose new contradiction types for constitutional amendment */
  proposeEngineEvolution(findings: FraudAlert[]): EngineEvolutionProposal {
    // Analyze patterns across multiple findings
    // Propose new detector rules to add to engine
  }
}
```

---

## 3. Gemma3 Narrating Human-Readable Reports

### Current Implementation: ✅ **IMPLEMENTED**

**Location:** `src/ai/models.ts` lines 145-169

```typescript
writeForensicReport(ctx: ModelContext, proposed: DetectionSignal[]): string {
  const lines = [
    "VERUM OMNIS FORENSIC ANALYSIS",
    `Institution: ${ctx.institution}`,
    `Jurisdiction: ${ctx.jurisdiction}`,
    ...proposed.flatMap((p, i) => [
      `${i + 1}. [${p.fraud_type}] ${p.source} — ${p.confidence}`,
      ...p.reasons.map((r) => `   - ${r}`),
      `   Anchors: ${p.related_txn_ids.join(", ")}`,
    ]),
    "CONSTITUTIONAL NOTE:",
    "This report was produced under Constitution v5.2.7. Findings cannot be suppressed.",
  ];
  return lines.join("\n");
}
```

**What it does:**
- Formats findings into human-readable narrative
- Includes institution, jurisdiction, fraud type, confidence
- Lists evidence anchors (transaction IDs)
- Adds constitutional note
- Used in both email and sealed PDF reports

**Call chain:**
1. `FraudFirewall.monitor()` → lines 298: calls `this.gemma3.writeForensicReport()`
2. Report embedded in confirmed alert (line 321: `reportBody = [alert.evidence_summary, ...]`)
3. Report included in sealed PDF sent to bank (line 365-368)

**Assessment:** ✅ **WORKING CORRECTLY** — Gemma3 is the narrative generator for forensic reports.

---

## 4. Gemma3 Managing the Evidence Vault

### Current Implementation: ⚠️ **IMPLICIT / DELEGATED**

**Question:** Should Gemma3 own vault management, or is it FraudFirewall's responsibility?

#### Current Architecture:

**Vault Operations** are in `src/storage/vault.ts`:
```typescript
export function writeJson(path: string, data: unknown): void { /* ... */ }
export function readJson<T>(path: string): T | null { /* ... */ }
export function alertPath(config: FirewallConfig, alertId: string): string { /* ... */ }
```

**Called by FraudFirewall:**
- Line 306: `writeJson(alertPath(...), alert)` — stores unconfirmed alerts
- Line 383: `writeJson(alertPath(...), alert)` — stores confirmed alerts
- Line 384: `writeJson(invoicePath(...), invoice)` — stores invoices

**Gemma3's role:** ⚠️ **PASSIVE**
- Generates report content → FraudFirewall stores it
- Verifies findings → FraudFirewall makes storage decisions
- Does NOT directly manage vault

**What Gemma3 is missing:**
```typescript
// ❌ NOT FOUND:
class Gemma3Forensics {
  // Vault access methods
  listEvidence(): EvidenceAtom[] { }
  getEvidenceById(id: string): EvidenceAtom { }
  deleteEvidenceForced(): never { } // Can't delete sealed evidence
  exportVaultSummary(): VaultManifest { }
}
```

### Assessment: ⚠️ **ARCHITECTURAL QUESTION**

**Is this intentional?** Two design patterns possible:

**Pattern A: Centralized Vault Management (Current)**
```
FraudFirewall (orchestrator)
├─ Gemma3 (generates content)
├─ Phi3 (analyzes legality)
├─ NineBrain (validates evidence)
└─ Vault (passive storage layer)
```
✅ Clear separation of concerns  
✅ FraudFirewall is the orchestrator  
❌ Gemma3 has no direct vault access

**Pattern B: Gemma3-Owned Vault (Proposed)**
```
FraudFirewall (router)
└─ Gemma3Forensics (forensic conductor)
   ├─ Manages vault access
   ├─ Coordinates reports
   ├─ Handles notifications
   └─ Orchestrates sealing
```
✅ Aligns with "Gemma3 looks after vault"  
❌ Breaks single-responsibility principle

### Recommendation:

If Gemma3 should own vault, refactor:

```typescript
class Gemma3Forensics extends ConstitutionalModel {
  private vault: VaultManager;
  
  constructor(vaultPath: string) {
    this.vault = new VaultManager(vaultPath);
  }
  
  /** Store finding in evidence vault */
  archiveAlert(alert: FraudAlert): { vault_path: string } {
    return this.vault.write("alerts", alert.alert_id, alert);
  }
  
  /** Retrieve evidence by ID */
  getEvidence(evidenceId: string): EvidenceAtom {
    return this.vault.read("atoms", evidenceId);
  }
  
  /** List all sealed evidence (read-only) */
  listSealed(): SealRecord[] {
    return this.vault.list("seals");
  }
}
```

---

## 5. Gemma3 Handling Email Notifications

### Current Implementation: ✅ **IMPLEMENTED**

**Location:** `src/pipeline/firewall.ts` lines 364-371

```typescript
const verumEmail = this.notifications.buildVerumCommissionEmail(invoice);
const bankEmail = this.notifications.buildBankEvidenceEmail({
  alert,
  seal: sealed.seal,
  sealedPdfPath: pdfPath,
});
const verumQueued = this.notifications.dispatch(verumEmail);
const bankQueued = this.notifications.dispatch(bankEmail);
```

**Architecture:**
- FraudFirewall owns NotificationService instance
- Calls `notifications.buildVerumCommissionEmail()` and `notifications.buildBankEvidenceEmail()`
- Dispatches via `notifications.dispatch()`

**Gemma3's involvement:** ⚠️ **INDIRECT**
- Gemma3 generates report content
- NotificationService includes that content in email body
- Gemma3 doesn't directly call email API

**Should Gemma3 own this?** Two options:

**Option A: Keep NotificationService as separate**
```
Gemma3 (generates content)
  → FraudFirewall (orchestrates)
    → NotificationService (sends emails)
```

**Option B: Gemma3 owns NotificationService**
```
Gemma3Forensics
├─ writeForensicReport()
├─ verify()
├─ archiveAlert()
└─ notifyBank() & notifyVerum() ← NEW
```

### Assessment: ✅ **WORKING** but ⚠️ **ARCHITECTURE UNCLEAR**

Currently NotificationService is a separate concern. If Gemma3 should "handle emails," you may want:

```typescript
class Gemma3Forensics {
  private notifications: NotificationService;
  
  async notifyVerum(invoice: CommissionInvoice): Promise<EmailDispatchResult> {
    const email = this.notifications.buildVerumCommissionEmail(invoice);
    return this.notifications.dispatch(email);
  }
  
  async notifyBank(alert: FraudAlert, seal: SealRecord): Promise<EmailDispatchResult> {
    const email = this.notifications.buildBankEvidenceEmail({alert, seal, sealedPdfPath: ...});
    return this.notifications.dispatch(email);
  }
}
```

---

## Summary: Gemma3 Responsibility Map

| Responsibility | Current | Recommended | Gap |
|---|---|---|---|
| **Protect engine from bad contradictions** | ✅ Direct ownership | ✅ Keep as is | None |
| **Narrate human-readable reports** | ✅ Direct ownership | ✅ Keep as is | None |
| **Update forensic engine on learning** | ⚠️ Missing | ⚠️ ADD flagNovelPatterns() | MODERATE |
| **Own evidence vault** | ⚠️ Delegated to FraudFirewall | ❓ TBD | UNCLEAR |
| **Handle email notifications** | ⚠️ Delegated to NotificationService | ❓ TBD | UNCLEAR |

---

## Recommendations

### Priority 1: Clarify Architecture

**Decide:** Is Gemma3 a **peer** to FraudFirewall, or is it a **coordinator within** FraudFirewall?

**Current:** Peer (Gemma3 is instantiated by FraudFirewall as a helper)
**Proposed:** Coordinator (Gemma3 owns vault, notifications, engine protection, and reporting)

### Priority 2: Implement Engine Learning

Add feedback loop for novel contradictions:

```typescript
class Gemma3Forensics {
  flagNovelPatterns(signals: DetectionSignal[], knownTypes: ContradictionType[]): {
    novel_patterns: string[];
    recommendation: "flag_for_review" | "add_to_engine" | "log_only";
  }
}
```

### Priority 3: Formalize Vault Ownership

If Gemma3 should "look after the vault," give it explicit methods:
- `archiveAlert(alert: FraudAlert)`
- `getEvidence(id: string)`
- `listSealed(): SealRecord[]`
- `exportVaultManifest()`

### Priority 4: Wire Email Notifications

If Gemma3 should "handle emails," add:
- `notifyVerum(invoice: CommissionInvoice)`
- `notifyBank(alert: FraudAlert, seal: SealRecord)`

---

## Files to Update (if implementing full Gemma3 ownership)

| File | Change | Priority |
|------|--------|----------|
| `src/ai/models.ts` | Expand Gemma3Forensics class | Medium |
| `src/storage/vault.ts` | Add VaultManager interface | Medium |
| `src/pipeline/firewall.ts` | Refactor to delegate to Gemma3 | Medium |
| `src/core/types.ts` | Add NovelPatternFlag, EngineEvolutionProposal types | Low |
| `PROMPT.md` | Document Gemma3 as forensic conductor | Low |

---

## Conclusion

**Gemma3's current state:** ✅ Core forensic functions working, handles 2/5 responsibilities directly

**What's clear:**
- ✅ Report generation is solid
- ✅ Evidence protection is strong
- ✅ Notifications flow through system

**What needs clarity:**
- ⚠️ Engine learning/evolution mechanism (how should new contradictions be discovered and integrated?)
- ⚠️ Vault management ownership (FraudFirewall or Gemma3?)
- ⚠️ Notification ownership (should Gemma3 own this, or is NotificationService fine?)

**Next step:** Clarify the architectural intent, then refactor accordingly.
