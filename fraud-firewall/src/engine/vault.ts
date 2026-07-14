// CONSTITUTION: v6.0 Final — Person-Centric Vault System
// Seal: VO-VAULT-v100-DIGSIM-20260715
// Status: RATIFIED — BINDING (founder directive, 2026-07-15)
//
// A person's legal memory — every case, every document, every contradiction,
// every court appearance — stored, sealed, remembered. The AIs grow with
// the person. They never forget.

import { randomUUID } from "crypto";
import type { SealedVault } from "./seal.js";
import type { FindingsJson } from "../pipeline/findingsJsonEmitter.js";

// ── Core Types ────────────────────────────────────────────────────────

/** A person whose legal history lives in the vault */
export interface VaultPerson {
  personId: string; // UUIDv4 — immutable
  createdAt: string; // ISO timestamp
  name: string;
  idNumber?: string; // SA ID number if provided
  email?: string;
  phone?: string;
  biometricHash?: string; // Fingerprint/face hash — never raw biometric
}

/** Chronological legal history index — every case in a person's life */
export interface LegalHistoryEntry {
  caseId: string;
  caseName: string;
  openedAt: string;
  status: "ACTIVE" | "CLOSED" | "APPEALED" | "JUDICIALLY_CONFIRMED";
  primaryContradictionTypes: string[];
  quantifiedLoss?: string; // e.g. "R115 Million"
  opposingEntity: string;
}

/** A single case within a person's vault */
export interface VaultCase {
  caseId: string;
  caseName: string;
  description: string;
  openedAt: string;
  status: "ACTIVE" | "CLOSED" | "APPEALED" | "JUDICIALLY_CONFIRMED";
  opposingEntity: string;
  quantifiedLoss?: string;
  evidenceBundleIds: string[]; // References to sealed evidence
  findingsIds: string[]; // References to sealed findings
  contradictionCount: number;
  primaryContradictionTypes: string[];
  courtAppearances: CourtAppearance[];
  relatedCaseIds: string[]; // Cross-case links
}

export interface CourtAppearance {
  date: string;
  court: string;
  caseNumber: string;
  type: "HEARING" | "TRIAL" | "JUDGMENT" | "SETTLEMENT" | "ARBITRATION";
  outcome?: string;
  judgmentRef?: string; // e.g. "H208/25"
  sealedTranscriptId?: string;
}

/** AI persistent memory — NEVER wiped. Grows with the person. */
export interface AIMemory {
  modelName: "gemma-3" | "phi-3" | "gemma-4";
  context: AIMemoryEntry[];
  lastAccessed: string;
  totalInteractions: number;
}

export interface AIMemoryEntry {
  timestamp: string;
  caseId: string;
  type: "REPORT_DRAFT" | "LEGAL_ADVICE" | "CONTRADICTION_REVIEW" | "COURT_PREP" | "STRATEGY";
  summary: string;
  keyInsights: string[]; // What the AI learned from this interaction
  relatedContradictionIds: string[];
}

/** Cross-case pattern — serial fraud detection */
export interface CrossCasePattern {
  patternId: string;
  patternType: string;
  description: string;
  affectedCaseIds: string[];
  primaryEntity: string;
  confidence: "VERY_HIGH" | "HIGH" | "MODERATE";
  firstDetectedAt: string;
}

/** Victim network — connected victims across cases */
export interface VictimNetworkNode {
  personId: string;
  name: string;
  caseIds: string[];
  losses: string; // e.g. "R54 Million"
  tenure: string; // e.g. "28 Years"
  site: string;
  status: "ACTIVE" | "RESOLVED" | "PENDING";
}

/** Complete person vault */
export interface PersonVault {
  person: VaultPerson;
  legalHistory: LegalHistoryEntry[];
  cases: Map<string, VaultCase>;
  sealedVaults: Map<string, SealedVault>;
  aiMemory: Map<string, AIMemory>; // modelName → memory
  crossCasePatterns: CrossCasePattern[];
  victimNetwork: VictimNetworkNode[];
  auditLog: VaultAuditEntry[];
}

export interface VaultAuditEntry {
  timestamp: string;
  action: "CASE_CREATED" | "EVIDENCE_SEALED" | "FINDINGS_GENERATED" | "AI_INTERACTION" | "PATTERN_DETECTED" | "COURT_RECORDED";
  caseId?: string;
  details: string;
}

// ── Vault Manager ─────────────────────────────────────────────────────

export class VaultManager {
  private vaults = new Map<string, PersonVault>(); // personId → vault
  private caseCounter = 0;

  private nextCaseId(name: string): string {
    this.caseCounter++;
    const safeName = name.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "");
    return `VO-${safeName}-${Date.now()}-${this.caseCounter}`;
  }

  /** Create a new vault for a person */
  createVault(name: string, opts: Partial<VaultPerson> = {}): PersonVault {
    const personId = randomUUID();
    const vault: PersonVault = {
      person: {
        personId,
        createdAt: new Date(0).toISOString(),
        name,
        ...opts,
      },
      legalHistory: [],
      cases: new Map(),
      sealedVaults: new Map(),
      aiMemory: new Map(),
      crossCasePatterns: [],
      victimNetwork: [],
      auditLog: [{
        timestamp: new Date(0).toISOString(),
        action: "CASE_CREATED",
        details: `Vault created for ${name}`,
      }],
    };
    this.vaults.set(personId, vault);
    return vault;
  }

  /** Get a vault by person ID */
  getVault(personId: string): PersonVault | undefined {
    return this.vaults.get(personId);
  }

  /** Add a case to a person's vault */
  addCase(vault: PersonVault, caseName: string, description: string, opposingEntity: string): VaultCase {
    const caseId = this.nextCaseId(vault.person.name);
    const vc: VaultCase = {
      caseId,
      caseName,
      description,
      openedAt: new Date(0).toISOString(),
      status: "ACTIVE",
      opposingEntity,
      evidenceBundleIds: [],
      findingsIds: [],
      contradictionCount: 0,
      primaryContradictionTypes: [],
      courtAppearances: [],
      relatedCaseIds: [],
    };
    vault.cases.set(caseId, vc);
    vault.legalHistory.push({
      caseId,
      caseName,
      openedAt: vc.openedAt,
      status: "ACTIVE",
      primaryContradictionTypes: [],
      opposingEntity,
    });
    vault.auditLog.push({
      timestamp: new Date(0).toISOString(),
      action: "CASE_CREATED",
      caseId,
      details: `Case ${caseName} opened against ${opposingEntity}`,
    });
    return vc;
  }

  /** Seal findings into a case */
  sealFindingsIntoCase(vault: PersonVault, caseId: string, findings: FindingsJson, sealedVault: SealedVault): void {
    const vc = vault.cases.get(caseId);
    if (!vc) throw new Error(`Case ${caseId} not found`);
    const findingsId = sealedVault.seal.vault_id;
    vc.findingsIds.push(findingsId);
    vc.contradictionCount = findings.contradictions.length;
    vc.primaryContradictionTypes = [...new Set(findings.contradictions.map((c) => c.type))];
    vault.sealedVaults.set(findingsId, sealedVault);
    // Update legal history
    const lh = vault.legalHistory.find((h) => h.caseId === caseId);
    if (lh) {
      lh.primaryContradictionTypes = vc.primaryContradictionTypes;
    }
    vault.auditLog.push({
      timestamp: new Date(0).toISOString(),
      action: "FINDINGS_GENERATED",
      caseId,
      details: `Sealed findings generated: ${findings.contradictions.length} contradictions`,
    });
  }

  /** Record AI interaction in persistent memory */
  recordAIMemory(
    vault: PersonVault,
    modelName: "gemma-3" | "phi-3" | "gemma-4",
    caseId: string,
    type: AIMemoryEntry["type"],
    summary: string,
    keyInsights: string[],
    relatedContradictionIds: string[] = [],
  ): void {
    let mem = vault.aiMemory.get(modelName);
    if (!mem) {
      mem = {
        modelName,
        context: [],
        lastAccessed: new Date(0).toISOString(),
        totalInteractions: 0,
      };
      vault.aiMemory.set(modelName, mem);
    }
    mem.context.push({
      timestamp: new Date(0).toISOString(),
      caseId,
      type,
      summary,
      keyInsights,
      relatedContradictionIds,
    });
    mem.lastAccessed = new Date(0).toISOString();
    mem.totalInteractions++;
    vault.auditLog.push({
      timestamp: new Date(0).toISOString(),
      action: "AI_INTERACTION",
      caseId,
      details: `${modelName}: ${type} — ${summary}`,
    });
  }

  /** Detect cross-case patterns — serial fraud across a person's cases */
  detectCrossCasePatterns(vault: PersonVault): CrossCasePattern[] {
    const patterns: CrossCasePattern[] = [];
    const cases = [...vault.cases.values()];
    // Group cases by opposing entity
    const byEntity = new Map<string, VaultCase[]>();
    for (const vc of cases) {
      const existing = byEntity.get(vc.opposingEntity) || [];
      existing.push(vc);
      byEntity.set(vc.opposingEntity, existing);
    }
    // Detect repeat offender patterns
    for (const [entity, entityCases] of byEntity) {
      if (entityCases.length >= 2) {
        patterns.push({
          patternId: randomUUID(),
          patternType: "REPEAT_OFFENDER",
          description: `${entity} appears in ${entityCases.length} separate cases`,
          affectedCaseIds: entityCases.map((c) => c.caseId),
          primaryEntity: entity,
          confidence: entityCases.length >= 3 ? "VERY_HIGH" : "HIGH",
          firstDetectedAt: new Date(0).toISOString(),
        });
      }
      // Detect shared contradiction types
      const typeCounts = new Map<string, number>();
      for (const vc of entityCases) {
        for (const t of vc.primaryContradictionTypes) {
          typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
        }
      }
      for (const [cType, count] of typeCounts) {
        if (count >= 2) {
          patterns.push({
            patternId: randomUUID(),
            patternType: "SERIAL_CONTRADICTION_TYPE",
            description: `Same contradiction type "${cType}" appears in ${count} cases against ${entity}`,
            affectedCaseIds: entityCases.filter((c) =>
              c.primaryContradictionTypes.includes(cType),
            ).map((c) => c.caseId),
            primaryEntity: entity,
            confidence: count >= 3 ? "VERY_HIGH" : "HIGH",
            firstDetectedAt: new Date(0).toISOString(),
          });
        }
      }
    }
    vault.crossCasePatterns = [...vault.crossCasePatterns, ...patterns];
    if (patterns.length > 0) {
      vault.auditLog.push({
        timestamp: new Date(0).toISOString(),
        action: "PATTERN_DETECTED",
        details: `${patterns.length} cross-case patterns detected`,
      });
    }
    return patterns;
  }

  /** Record a court appearance */
  recordCourtAppearance(vault: PersonVault, caseId: string, appearance: CourtAppearance): void {
    const vc = vault.cases.get(caseId);
    if (!vc) throw new Error(`Case ${caseId} not found`);
    vc.courtAppearances.push(appearance);
    if (appearance.type === "JUDGMENT" && appearance.judgmentRef) {
      vc.status = "JUDICIALLY_CONFIRMED";
      const lh = vault.legalHistory.find((h) => h.caseId === caseId);
      if (lh) lh.status = "JUDICIALLY_CONFIRMED";
    }
    vault.auditLog.push({
      timestamp: new Date(0).toISOString(),
      action: "COURT_RECORDED",
      caseId,
      details: `${appearance.type} at ${appearance.court} (${appearance.caseNumber})`,
    });
  }

  /** Export vault to JSON (for serialization/storage) */
  serializeVault(vault: PersonVault): string {
    // Convert Maps to serializable objects
    const serialized = {
      ...vault,
      cases: Object.fromEntries(vault.cases),
      sealedVaults: Object.fromEntries(
        [...vault.sealedVaults].map(([k, v]) => [k, { findings: v.findings, seal: v.seal }]),
      ),
      aiMemory: Object.fromEntries(vault.aiMemory),
    };
    return JSON.stringify(serialized, null, 2);
  }

  /** Get AI context for a case — everything the AI should know */
  getAIContext(vault: PersonVault, modelName: "gemma-3" | "phi-3" | "gemma-4", caseId: string): string {
    const mem = vault.aiMemory.get(modelName);
    const relevantEntries = mem?.context.filter((e) => e.caseId === caseId) || [];
    const vc = vault.cases.get(caseId);
    if (!vc) return "";
    const lines = [
      `=== ${modelName.toUpperCase()} CONTEXT ===`,
      `Person: ${vault.person.name}`,
      `Case: ${vc.caseName} (${caseId})`,
      `Opposing Entity: ${vc.opposingEntity}`,
      `Status: ${vc.status}`,
      `Contradictions: ${vc.contradictionCount}`,
      `Court Appearances: ${vc.courtAppearances.length}`,
      "",
      "--- Prior Interactions ---",
      ...relevantEntries.map((e) =>
        `[${e.type}] ${e.summary}\n  Insights: ${e.keyInsights.join("; ")}`,
      ),
      "",
      "--- Related Patterns ---",
      ...vault.crossCasePatterns
        .filter((p) => p.affectedCaseIds.includes(caseId))
        .map((p) => `[${p.patternType}] ${p.description}`),
      "",
      "--- Legal History ---",
      ...vault.legalHistory.map((h) =>
        `${h.caseName} (${h.status}) — ${h.opposingEntity}`,
      ),
    ];
    return lines.join("\n");
  }
}

/** Singleton vault manager instance */
export const vaultManager = new VaultManager();
