// CONSTITUTION: v6.0 Final — Person-Centric Vault Tests
// Seal: VO-VAULT-v100-DIGSIM-20260715
//
// Verifies: vault creation, case management, AI memory persistence,
// cross-case pattern detection, court appearances, AI context generation.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { VaultManager } from "../src/engine/vault.js";
import { sealFindings } from "../src/engine/seal.js";
import { runScanWithFindings } from "../src/pipeline/g3HybridPipeline.js";
import { resetCounter } from "../src/engine/detector.js";

describe("Person-Centric Vault System", () => {
  let manager: VaultManager;

  beforeEach(() => {
    manager = new VaultManager();
    resetCounter();
  });

  // ── Vault Creation ─────────────────────────────────────────────────

  it("creates a vault for a person with UUID and audit trail", () => {
    const vault = manager.createVault("Gary Highcock", {
      idNumber: "5403225668186",
      email: "gary@example.com",
    });
    assert.ok(vault.person.personId, "personId must exist");
    assert.match(vault.person.personId, /^[0-9a-f-]{36}$/);
    assert.strictEqual(vault.person.name, "Gary Highcock");
    assert.strictEqual(vault.person.idNumber, "5403225668186");
    assert.strictEqual(vault.legalHistory.length, 0);
    assert.strictEqual(vault.cases.size, 0);
    assert.strictEqual(vault.auditLog.length, 1);
    assert.strictEqual(vault.auditLog[0].action, "CASE_CREATED");
    assert.ok(vault.auditLog[0].details.includes("Gary Highcock"));
  });

  it("retrieves a vault by person ID", () => {
    const vault = manager.createVault("Test Person");
    const retrieved = manager.getVault(vault.person.personId);
    assert.ok(retrieved);
    assert.strictEqual(retrieved!.person.name, "Test Person");
    assert.strictEqual(manager.getVault("nonexistent"), undefined);
  });

  // ── Case Management ────────────────────────────────────────────────

  it("adds cases to a vault and updates legal history", () => {
    const vault = manager.createVault("Gary Highcock");
    const c1 = manager.addCase(vault, "AllFuels Goodwill Theft", "Goodwill stolen via uncountersigned MOU", "Bright Idea Projects 66 t/a AllFuels");
    const c2 = manager.addCase(vault, "Palmbili Eviction", "Unlawful eviction from Port Edward Garage", "Palmbili Property Investments");

    assert.strictEqual(vault.cases.size, 2);
    assert.strictEqual(vault.legalHistory.length, 2);
    assert.strictEqual(c1.opposingEntity, "Bright Idea Projects 66 t/a AllFuels");
    assert.strictEqual(c2.opposingEntity, "Palmbili Property Investments");
    assert.ok(c1.caseId.startsWith("VO-GaryHighcock-"));
    assert.strictEqual(c1.status, "ACTIVE");
    assert.strictEqual(vault.legalHistory[0].caseName, "AllFuels Goodwill Theft");
  });

  it("seals findings into a case and updates metadata", () => {
    const vault = manager.createVault("Test Person");
    const vc = manager.addCase(vault, "Test Case", "Description", "Test Entity");

    const texts = ["Alice said X", "Alice said not X"];
    const { findings } = runScanWithFindings(texts, { caseId: vc.caseId });
    const sealed = sealFindings(findings);

    manager.sealFindingsIntoCase(vault, vc.caseId, findings, sealed);

    assert.strictEqual(vc.findingsIds.length, 1);
    assert.strictEqual(vc.findingsIds[0], sealed.seal.vault_id);
    assert.ok(vault.sealedVaults.has(sealed.seal.vault_id));
    assert.strictEqual(vc.contradictionCount, findings.contradictions.length);
    assert.strictEqual(vc.primaryContradictionTypes.length > 0, true);
    // Legal history updated
    assert.deepStrictEqual(vault.legalHistory[0].primaryContradictionTypes, vc.primaryContradictionTypes);
  });

  it("throws when sealing findings for non-existent case", () => {
    const vault = manager.createVault("Test");
    assert.throws(() => {
      manager.sealFindingsIntoCase(vault, "NONEXISTENT", {} as any, {} as any);
    }, /Case NONEXISTENT not found/);
  });

  // ── AI Memory Persistence ──────────────────────────────────────────

  it("records AI memory that persists and never gets wiped", () => {
    const vault = manager.createVault("Gary Highcock");
    const vc = manager.addCase(vault, "AllFuels", "Desc", "AllFuels");

    manager.recordAIMemory(vault, "gemma-3", vc.caseId, "REPORT_DRAFT",
      "Drafted Finding 12: Expired Term Paradox",
      ["Clause 7 has temporal limitation", "5-year period expired Dec 2023"],
      ["C-0001", "C-0002"],
    );

    manager.recordAIMemory(vault, "gemma-3", vc.caseId, "CONTRADICTION_REVIEW",
      "Reviewed 3 additional contradictions",
      ["Tacit lease confirmed by rent payments", "R11.4M payment history is irrefutable"],
      ["C-0003"],
    );

    const mem = vault.aiMemory.get("gemma-3");
    assert.ok(mem);
    assert.strictEqual(mem!.totalInteractions, 2);
    assert.strictEqual(mem!.context.length, 2);
    assert.strictEqual(mem!.context[0].type, "REPORT_DRAFT");
    assert.strictEqual(mem!.context[0].keyInsights.length, 2);
    assert.deepStrictEqual(mem!.context[0].relatedContradictionIds, ["C-0001", "C-0002"]);
  });

  it("allows multiple AIs to have separate persistent memories", () => {
    const vault = manager.createVault("Test");
    const vc = manager.addCase(vault, "Case", "Desc", "Entity");

    manager.recordAIMemory(vault, "gemma-3", vc.caseId, "REPORT_DRAFT", "Gemma wrote report", ["insight1"]);
    manager.recordAIMemory(vault, "phi-3", vc.caseId, "LEGAL_ADVICE", "Phi gave strategy", ["insight2"]);
    manager.recordAIMemory(vault, "gemma-4", vc.caseId, "CONTRADICTION_REVIEW", "Gemma4 reviewed", ["insight3"]);

    assert.strictEqual(vault.aiMemory.size, 3);
    assert.strictEqual(vault.aiMemory.get("gemma-3")!.context.length, 1);
    assert.strictEqual(vault.aiMemory.get("phi-3")!.context.length, 1);
    assert.strictEqual(vault.aiMemory.get("gemma-4")!.context.length, 1);
  });

  // ── Cross-Case Pattern Detection ───────────────────────────────────

  it("detects repeat offender patterns across cases", () => {
    const vault = manager.createVault("Multi-Victim");

    const c1 = manager.addCase(vault, "Theft 2018", "Goodwill theft Port Edward", "AllFuels");
    c1.primaryContradictionTypes = ["SHAM_TRANSACTION", "GOODWILL_THEFT"];

    const c2 = manager.addCase(vault, "Theft 2020", "Goodwill theft Glenmore", "AllFuels");
    c2.primaryContradictionTypes = ["SHAM_TRANSACTION", "PERJURY"];

    const c3 = manager.addCase(vault, "Theft 2023", "Goodwill theft Ladysmith", "AllFuels");
    c3.primaryContradictionTypes = ["GOODWILL_THEFT", "COERCIVE_CONDUCT"];

    const patterns = manager.detectCrossCasePatterns(vault);

    const repeatOffender = patterns.find((p) => p.patternType === "REPEAT_OFFENDER");
    assert.ok(repeatOffender, "should detect repeat offender");
    assert.strictEqual(repeatOffender!.primaryEntity, "AllFuels");
    assert.strictEqual(repeatOffender!.affectedCaseIds.length, 3);
    assert.strictEqual(repeatOffender!.confidence, "VERY_HIGH");

    const serialSham = patterns.find((p) => p.patternType === "SERIAL_CONTRADICTION_TYPE" && p.description.includes("SHAM_TRANSACTION"));
    assert.ok(serialSham, "should detect serial contradiction type");
  });

  it("does not detect patterns for single-case entities", () => {
    const vault = manager.createVault("Single");
    manager.addCase(vault, "Case", "Desc", "OneOffEntity");
    const patterns = manager.detectCrossCasePatterns(vault);
    assert.strictEqual(patterns.length, 0);
  });

  // ── Court Appearances ──────────────────────────────────────────────

  it("records court appearances and updates case status", () => {
    const vault = manager.createVault("Gary");
    const vc = manager.addCase(vault, "Case", "Desc", "Entity");

    manager.recordCourtAppearance(vault, vc.caseId, {
      date: "2026-03-15",
      court: "Port Shepstone Magistrate's Court",
      caseNumber: "H208/25",
      type: "HEARING",
    });

    manager.recordCourtAppearance(vault, vc.caseId, {
      date: "2026-06-20",
      court: "High Court Durban",
      caseNumber: "D4026/26",
      type: "JUDGMENT",
      outcome: "Found in favour of applicant",
      judgmentRef: "H208/25",
    });

    assert.strictEqual(vc.courtAppearances.length, 2);
    assert.strictEqual(vc.courtAppearances[0].court, "Port Shepstone Magistrate's Court");
    // Status updated to JUDICIALLY_CONFIRMED after judgment
    assert.strictEqual(vc.status, "JUDICIALLY_CONFIRMED");
    const lh = vault.legalHistory.find((h) => h.caseId === vc.caseId);
    assert.strictEqual(lh!.status, "JUDICIALLY_CONFIRMED");
  });

  // ── AI Context Generation ──────────────────────────────────────────

  it("generates AI context with full legal history", () => {
    const vault = manager.createVault("Gary Highcock");
    const vc1 = manager.addCase(vault, "AllFuels Goodwill Theft", "Desc", "AllFuels");
    const vc2 = manager.addCase(vault, "Clayton Bester Support", "Desc", "DME");

    manager.recordAIMemory(vault, "gemma-3", vc1.caseId, "REPORT_DRAFT",
      "Drafted executive summary", ["7 victims confirmed", "R246.3M losses"],
    );
    manager.recordAIMemory(vault, "gemma-3", vc1.caseId, "LEGAL_ADVICE",
      "Analysed expired term paradox", ["Clause 7 expired Dec 2023"],
    );

    // Seal some findings
    const texts = ["A said X", "A said not X"];
    const { findings } = runScanWithFindings(texts, { caseId: vc1.caseId });
    const sealed = sealFindings(findings);
    manager.sealFindingsIntoCase(vault, vc1.caseId, findings, sealed);

    // Run pattern detection
    manager.detectCrossCasePatterns(vault);

    const context = manager.getAIContext(vault, "gemma-3", vc1.caseId);

    assert.ok(context.includes("Gary Highcock"), "context must include person name");
    assert.ok(context.includes(vc1.caseName), "context must include case name");
    assert.ok(context.includes("AllFuels"), "context must include opposing entity");
    assert.ok(context.includes("REPORT_DRAFT"), "context must include prior interactions");
    assert.ok(context.includes("7 victims confirmed"), "context must include key insights");
    assert.ok(context.includes("Legal History"), "context must include legal history section");
  });

  // ── Serialization ──────────────────────────────────────────────────

  it("serializes vault to JSON", () => {
    const vault = manager.createVault("Test");
    manager.addCase(vault, "Case1", "Desc", "Entity");
    const json = manager.serializeVault(vault);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.person.name, "Test");
    assert.ok(parsed.cases);
    assert.ok(parsed.aiMemory);
  });

  // ── End-to-End: Full legal lifecycle ───────────────────────────────

  it("complete legal lifecycle: vault → case → findings → seal → AI memory → court → patterns", () => {
    const vault = manager.createVault("Gary Highcock", {
      idNumber: "5403225668186",
    });

    // Open case
    const vc = manager.addCase(vault, "AllFuels Goodwill Theft",
      "Systematic goodwill theft via uncountersigned MOU",
      "Bright Idea Projects 66 t/a AllFuels");

    // Run engine and seal findings
    const texts = [
      "I, Gary Highcock, signed the MOU on 11 December 2018",
      "AllFuels never countersigned the MOU despite 7 years of rent collection",
      "Clause 7 requires forfeiture of all goodwill under any circumstances",
    ];
    const { findings } = runScanWithFindings(texts, { caseId: vc.caseId });
    const sealed = sealFindings(findings);
    manager.sealFindingsIntoCase(vault, vc.caseId, findings, sealed);

    // AI writes report
    manager.recordAIMemory(vault, "gemma-3", vc.caseId, "REPORT_DRAFT",
      "Drafted 75-page forensic report with 15 findings",
      ["Goodwill forfeiture clause is smoking gun", "Uncountersigned = unenforceable"],
    );

    // AI gives legal advice
    manager.recordAIMemory(vault, "phi-3", vc.caseId, "LEGAL_ADVICE",
      "Advised on Four Pillars of Fraud application",
      ["Pillar 3 (dolus) satisfied by R3.8M fee demand", "Pillar 4 by R246.3M losses"],
    );

    // Court appearance
    manager.recordCourtAppearance(vault, vc.caseId, {
      date: "2026-03-15",
      court: "Port Shepstone Magistrate's Court",
      caseNumber: "H208/25",
      type: "HEARING",
    });

    // Add second case against same entity
    const vc2 = manager.addCase(vault, "Wayne Nel Support",
      "Same pattern at Glenmore Beach",
      "Bright Idea Projects 66 t/a AllFuels");
    vc2.primaryContradictionTypes = ["GOODWILL_THEFT", "COERCIVE_CONDUCT"];

    // Detect cross-case patterns
    const patterns = manager.detectCrossCasePatterns(vault);

    // Verify everything
    assert.strictEqual(vault.cases.size, 2);
    assert.strictEqual(vault.sealedVaults.size, 1);
    assert.strictEqual(vault.aiMemory.get("gemma-3")!.totalInteractions, 1);
    assert.strictEqual(vault.aiMemory.get("phi-3")!.totalInteractions, 1);
    assert.strictEqual(vc.courtAppearances.length, 1);
    assert.ok(patterns.length > 0, "cross-case patterns should be detected");

    // AI context is rich
    const ctx = manager.getAIContext(vault, "gemma-3", vc.caseId);
    assert.ok(ctx.includes("Gary Highcock"));
    assert.ok(ctx.includes("REPORT_DRAFT"));
    assert.ok(ctx.includes("Legal History"));
    assert.ok(ctx.includes("AllFuels Goodwill Theft"));
    assert.ok(ctx.includes("Wayne Nel Support"));

    // Audit trail is complete
    assert.ok(vault.auditLog.length >= 6, "should have multiple audit entries");
    const actions = vault.auditLog.map((a) => a.action);
    assert.ok(actions.includes("CASE_CREATED"));
    assert.ok(actions.includes("FINDINGS_GENERATED"));
    assert.ok(actions.includes("AI_INTERACTION"));
    assert.ok(actions.includes("COURT_RECORDED"));
    assert.ok(actions.includes("PATTERN_DETECTED"));
  });
});
