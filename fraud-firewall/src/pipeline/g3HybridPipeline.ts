// CONSTITUTION: v6.0 Final — G3 Hybrid Report Pipeline (GHRP) v1.0.0
// Status: RATIFIED — BINDING (founder directive, 2026-07-14)
// Spec: G3_HYBRID_REPORT_PIPELINE.md | Schema: FINDINGS_JSON_SCHEMA.json
//
// Builds on the engine. Deletes nothing, changes nothing.
// Wires VerumContradictionEngine output into the Findings JSON contract
// that Gemma 3 narrates from the sealed vault, and enforces the two-tier
// rule for G3-raised candidates.

import { VerumContradictionEngine } from "../engine/index.js";
import type { Contradiction, ForensicReport } from "../engine/types.js";
import {
  emitFindingsJson,
  raiseG3Candidate,
  STATUS_ENGINE_VERIFIED,
  STATUS_G3_CANDIDATE,
  STATUS_CANDIDATE_PROMOTED,
  STATUS_CANDIDATE_REJECTED,
  STATUS_JUDICIALLY_CONFIRMED,
  type ContradictionRecord,
  type FindingsJson,
  type G3CandidateInput,
} from "./findingsJsonEmitter.js";

/** Map one engine contradiction (camelCase) to a findings record (snake_case). */
export function engineContradictionToRecord(c: Contradiction): ContradictionRecord {
  const fact = c.detectedFact;
  const status =
    (c.verificationStatus?.["status"] as string | undefined) ?? STATUS_ENGINE_VERIFIED;
  return {
    contradiction_id: c.contradictionId,
    type: c.type,
    severity: c.severity as ContradictionRecord["severity"],
    confidence: c.confidence as ContradictionRecord["confidence"],
    proposition_a_text: c.propositionAText,
    proposition_a_actor: c.propositionAActor,
    proposition_b_text: c.propositionBText,
    proposition_b_actor: c.propositionBActor,
    conflict_description: c.conflictDescription,
    source_document: fact.sourceDocument,
    source_page: fact.sourcePage,
    source_line: fact.sourceLine,
    sha512_anchor: fact.sha512Hash,
    extraction_method: fact.extractionMethod,
    temporal_analysis: c.temporalAnalysis,
    detected_fact: {
      fact_text: fact.factText,
      source_document: fact.sourceDocument,
      source_page: fact.sourcePage,
      source_line: fact.sourceLine,
      sha512_hash: fact.sha512Hash,
      extraction_method: fact.extractionMethod,
      confidence: fact.confidence,
    },
    logical_pattern: {
      pattern_type: c.logicalPattern.patternType,
      pattern_description: c.logicalPattern.patternDescription,
      supporting_facts: c.logicalPattern.supportingFacts,
      contradiction_score: c.logicalPattern.contradictionScore,
      detector_version: c.logicalPattern.detectorVersion,
    },
    legal_hypothesis: c.legalHypothesis
      ? {
          suggested_offence: c.legalHypothesis.suggestedOffence,
          legal_basis: c.legalHypothesis.legalBasis,
          jurisdictional_note: c.legalHypothesis.jurisdictionalNote,
          required_additional_evidence: c.legalHypothesis.requiredAdditionalEvidence,
          is_hypothesis: c.legalHypothesis.isHypothesis,
          requires_human_review: c.legalHypothesis.requiresHumanReview,
        }
      : null,
    verification_status: status,
  };
}

export interface ScanWithFindingsOptions {
  caseId?: string;
  caseName?: string;
  injectedTimestamp?: number;
  engineVersion?: string;
  sourceBundle?: string;
  caseIds?: string[];
  integrityFindings?: string[];
}

export interface ScanWithFindingsResult {
  report: ForensicReport;
  findings: FindingsJson;
}

/**
 * Run a full engine scan and emit the Findings JSON contract in one call.
 * The report feeds sealing; the findings feed Gemma 3 narration.
 */
export function runScanWithFindings(
  texts: string[],
  options: ScanWithFindingsOptions = {},
): ScanWithFindingsResult {
  const engine = new VerumContradictionEngine({
    caseId: options.caseId ?? "VO-CASE-001",
    caseName: options.caseName,
    injectedTimestamp: options.injectedTimestamp,
  });
  const report = engine.processFromTexts(texts);
  const findings = emitFindingsJson(
    report.contradictions.map(engineContradictionToRecord),
    {
      engineVersion: options.engineVersion ?? "5.3.1c",
      sourceBundle: options.sourceBundle ?? report.caseId,
      caseIds: options.caseIds ?? [report.caseId],
      integrityFindings: options.integrityFindings,
    },
  );
  return { report, findings };
}

export interface CandidateAuditEntry {
  action: "RAISED" | "PROMOTED" | "REJECTED" | "JUDICIALLY-CONFIRMED";
  candidateId: string;
  detail: string;
  utc: string;
}

/**
 * Two-tier rule machinery (GHRP spec section 4).
 *
 * When Gemma 3, reading the SEALED vault, spots a contradiction the engine
 * did not emit, it is recorded here as a G3-RAISED CANDIDATE — anchored and
 * hashed like any other artefact, labelled pending verification. Promotion
 * happens by engine re-run or human sign-off. Rejected candidates are never
 * deleted; the rejection reason is sealed with them.
 */
export class G3CandidateRegistry {
  private readonly candidates = new Map<string, ContradictionRecord>();
  private readonly audit: CandidateAuditEntry[] = [];

  constructor(private readonly g3Model: string = "gemma-3-4b-it") {}

  /** Record a G3-raised candidate. Anchored input is mandatory. */
  raise(input: G3CandidateInput): ContradictionRecord {
    if (!input.sourceDocument || input.sourcePage < 0 || !input.sha512Anchor) {
      throw new Error(
        "GHRP two-tier rule: candidates must be anchored " +
          "(sourceDocument, sourcePage, sha512Anchor). " +
          "If it is not anchored, it is not emitted.",
      );
    }
    const record = raiseG3Candidate({ ...input, g3Model: this.g3Model });
    this.candidates.set(record.contradiction_id, record);
    this.audit.push({
      action: "RAISED",
      candidateId: record.contradiction_id,
      detail: input.contradictionType,
      utc: new Date(0).toISOString(),
    });
    return record;
  }

  /** Promote a candidate to engine-verified after re-run or human sign-off. */
  promote(candidateId: string, method: string = "human_signoff"): ContradictionRecord {
    const record = this.candidates.get(candidateId);
    if (!record) throw new Error(`Unknown candidate ${candidateId}`);
    record.verification_status = STATUS_CANDIDATE_PROMOTED;
    (record as unknown as Record<string, unknown>).promotion_method = method;
    this.audit.push({ action: "PROMOTED", candidateId, detail: method, utc: new Date(0).toISOString() });
    return record;
  }

  /** Reject a candidate. Never deleted — the reason is sealed with it. */
  reject(candidateId: string, reason: string): ContradictionRecord {
    if (!reason) {
      throw new Error("Rejection requires a reason. The record of why is itself evidence.");
    }
    const record = this.candidates.get(candidateId);
    if (!record) throw new Error(`Unknown candidate ${candidateId}`);
    record.verification_status = STATUS_CANDIDATE_REJECTED;
    (record as unknown as Record<string, unknown>).rejection_reason = reason;
    this.audit.push({ action: "REJECTED", candidateId, detail: reason, utc: new Date(0).toISOString() });
    return record;
  }

  /**
   * Confirm a record as JUDICIALLY-CONFIRMED — a court has itself found the
   * fact.  Highest evidentiary tier, above ENGINE-VERIFIED.  Requires a
   * judgment reference (e.g. sealed judgment H208/25); the anchor is sealed
   * with the record.  Promotable from any tier; never deleted.
   */
  confirmJudicially(
    candidateId: string,
    judgmentRef: string,
    court: string = "",
    caseNumber: string = "",
  ): ContradictionRecord {
    if (!judgmentRef || !judgmentRef.trim()) {
      throw new Error(
        "Judicial confirmation requires a judgment reference " +
          "(e.g. sealed judgment H208/25). The court anchor is itself evidence.",
      );
    }
    const record = this.candidates.get(candidateId);
    if (!record) throw new Error(`Unknown candidate ${candidateId}`);
    record.verification_status = STATUS_JUDICIALLY_CONFIRMED;
    (record as unknown as Record<string, unknown>).judicial_confirmation = {
      judgment_ref: judgmentRef.trim(),
      court,
      case_number: caseNumber,
      confirmed_utc: new Date(0).toISOString(),
    };
    this.audit.push({
      action: "JUDICIALLY-CONFIRMED",
      candidateId,
      detail: judgmentRef.trim(),
      utc: new Date(0).toISOString(),
    });
    return record;
  }

  pending(): ContradictionRecord[] {
    return [...this.candidates.values()].filter(
      (r) => r.verification_status === STATUS_G3_CANDIDATE,
    );
  }

  allRecords(): ContradictionRecord[] {
    return [...this.candidates.values()];
  }

  auditTrail(): CandidateAuditEntry[] {
    return [...thisthis.audit];
  }

  /**
   * Merge registry candidates into a findings document and recount tiers.
   * Rejected candidates stay out of the report body but remain in the registry.
   */
  mergeInto(findings: FindingsJson): FindingsJson {
    const toMerge = [...this.candidates.values()].filter(
      (r) => r.verification_status !== STATUS_CANDIDATE_REJECTED,
    );
    const merged = [...findings.contradictions, ...toMerge];
    const candidateCount = merged.filter(
      (r) => r.verification_status === STATUS_G3_CANDIDATE,
    ).length;
    const judiciallyConfirmedCount = merged.filter(
      (r) => r.verification_status === STATUS_JUDICIALLY_CONFIRMED,
    ).length;
    return {
      ...findings,
      contradictions: merged,
      engine_verified_count: merged.length - candidateCount,
      g3_candidate_count: candidateCount,
      judicially_confirmed_count: judiciallyConfirmedCount,
    };
  }
}
