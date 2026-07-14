/**
 * Verum Omnis - Findings JSON Emitter v1.0.0
 * ===========================================
 * Engine-to-G3 contract serializer for the G3 Hybrid Report Pipeline (GHRP).
 *
 * Status: PROPOSED - pending founder ratification (see G3_HYBRID_REPORT_PIPELINE.md)
 *
 * What this does:
 * - Serializes engine contradiction results into the Findings JSON contract
 *   that the report writer narrates from.
 * - Provides raiseG3Candidate() so contradictions spotted in the sealed vault
 *   are recorded in the identical format, labelled pending verification.
 *
 * What this does NOT do:
 * - It does not modify detection logic. The engines remain the deterministic spine.
 * - It does not hash artefacts. Hashing stays in the engine/vault; anchors are
 *   passed in as pre-computed SHA-512 strings.
 * - It never touches raw documents. Input is the engine's sealed output only.
 */

export const FINDINGS_JSON_VERSION = "1.0.0";

export const STATUS_ENGINE_VERIFIED = "ENGINE-VERIFIED";
export const STATUS_G3_CANDIDATE = "G3-RAISED CANDIDATE - PENDING VERIFICATION";
export const STATUS_CANDIDATE_PROMOTED = "CANDIDATE PROMOTED - ENGINE-VERIFIED";
export const STATUS_CANDIDATE_REJECTED = "CANDIDATE REJECTED - REASON LOGGED";

export type OrdinalSeverity =
  | "CRITICAL" | "VERY_HIGH" | "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT";

export type OrdinalConfidence =
  | "DETERMINISTIC" | "VERY_HIGH" | "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT";

export type VerificationStatus =
  | typeof STATUS_ENGINE_VERIFIED
  | typeof STATUS_G3_CANDIDATE
  | typeof STATUS_CANDIDATE_PROMOTED
  | typeof STATUS_CANDIDATE_REJECTED
  | string;

export interface ContradictionRecord {
  contradiction_id: string;
  type: string;
  severity: OrdinalSeverity;
  confidence: OrdinalConfidence;
  proposition_a_text: string;
  proposition_a_actor: string;
  proposition_b_text: string;
  proposition_b_actor: string;
  conflict_description: string;
  source_document?: string;
  source_page?: number;
  source_line?: number;
  sha512_anchor?: string;
  extraction_method?: string;
  temporal_analysis?: Record<string, unknown> | null;
  detected_fact?: Record<string, unknown> | null;
  logical_pattern?: Record<string, unknown> | null;
  legal_hypothesis?: Record<string, unknown> | null;
  verification_status: VerificationStatus;
}

export interface FindingsJson {
  engine_version: string;
  findings_json_version: typeof FINDINGS_JSON_VERSION;
  generated_utc: string;
  source_bundle: string;
  case_ids: string[];
  supplement_date?: string | null;
  engine_verified_count: number;
  g3_candidate_count: number;
  integrity_findings: string[];
  contradictions: ContradictionRecord[];
}

/**
 * Convert one engine contradiction result into a Findings JSON record.
 * Tolerant of partial shapes so sealed/legacy results also emit.
 */
export function contradictionToRecord(c: Partial<ContradictionRecord> & {
  contradiction_id: string;
  type: string;
}): ContradictionRecord {
  const df = (c.detected_fact ?? {}) as Record<string, unknown>;
  return {
    contradiction_id: c.contradiction_id,
    type: c.type,
    severity: (c.severity ?? "MODERATE") as OrdinalSeverity,
    confidence: (c.confidence ?? "MODERATE") as OrdinalConfidence,
    proposition_a_text: c.proposition_a_text ?? "",
    proposition_a_actor: c.proposition_a_actor ?? "",
    proposition_b_text: c.proposition_b_text ?? "",
    proposition_b_actor: c.proposition_b_actor ?? "",
    conflict_description: c.conflict_description ?? "",
    source_document: c.source_document ?? (df.source_document as string) ?? "",
    source_page: c.source_page ?? (df.source_page as number) ?? 0,
    source_line: c.source_line ?? (df.source_line as number) ?? 0,
    sha512_anchor: c.sha512_anchor ?? (df.sha512_hash as string) ?? "",
    extraction_method: c.extraction_method ?? (df.extraction_method as string) ?? "",
    temporal_analysis: c.temporal_analysis ?? null,
    detected_fact: c.detected_fact ?? null,
    logical_pattern: c.logical_pattern ?? null,
    legal_hypothesis: c.legal_hypothesis ?? null,
    verification_status: c.verification_status ?? STATUS_ENGINE_VERIFIED,
  };
}

export interface G3CandidateInput {
  candidateId: string;
  contradictionType: string;
  propositionAText: string;
  propositionBText: string;
  propositionAActor: string;
  propositionBActor: string;
  conflictDescription: string;
  sourceDocument: string;
  sourcePage: number;
  sha512Anchor: string;
  severity?: OrdinalSeverity;
  confidence?: OrdinalConfidence;
  sourceLine?: number;
  g3Model?: string;
}

/**
 * Record a contradiction spotted in the sealed vault that the engine missed.
 * Two-tier rule (GHRP section 4): anchored and hashed like any other artefact,
 * but labelled pending verification - never presented as engine-verified.
 */
export function raiseG3Candidate(input: G3CandidateInput): ContradictionRecord {
  const model = input.g3Model ?? "gemma-3-4b-it";
  const severity = input.severity ?? "MODERATE";
  const confidence = input.confidence ?? "MODERATE";
  const method = `G3 vault review (${model}) over sealed bundle`;
  return {
    contradiction_id: input.candidateId,
    type: input.contradictionType,
    severity,
    confidence,
    proposition_a_text: input.propositionAText,
    proposition_a_actor: input.propositionAActor,
    proposition_b_text: input.propositionBText,
    proposition_b_actor: input.propositionBActor,
    conflict_description: input.conflictDescription,
    source_document: input.sourceDocument,
    source_page: input.sourcePage,
    source_line: input.sourceLine ?? 0,
    sha512_anchor: input.sha512Anchor,
    extraction_method: method,
    temporal_analysis: null,
    detected_fact: {
      fact_text: input.conflictDescription,
      source_document: input.sourceDocument,
      source_page: input.sourcePage,
      source_line: input.sourceLine ?? 0,
      sha512_hash: input.sha512Anchor,
      extraction_method: method,
      confidence,
    },
    logical_pattern: {
      pattern_type: input.contradictionType,
      pattern_description: input.conflictDescription,
      supporting_facts: [input.propositionAText, input.propositionBText],
      contradiction_score: null,
      detector_version: `G3-CANDIDATE (${model})`,
    },
    legal_hypothesis: null,
    verification_status: STATUS_G3_CANDIDATE,
  };
}

export interface EmitOptions {
  engineVersion: string;
  sourceBundle: string;
  caseIds?: string[];
  supplementDate?: string;
  integrityFindings?: string[];
  extraRecords?: ContradictionRecord[];
}

/**
 * Build the complete Findings JSON document for one scan.
 * Counts split engine-verified vs candidate tiers for the report header.
 */
export function emitFindingsJson(
  contradictions: Array<Partial<ContradictionRecord> & { contradiction_id: string; type: string }>,
  options: EmitOptions
): FindingsJson {
  const records: ContradictionRecord[] = contradictions.map(contradictionToRecord);
  if (options.extraRecords) records.push(...options.extraRecords);

  const candidateCount = records.filter(
    (r) => r.verification_status === STATUS_G3_CANDIDATE
  ).length;

  return {
    engine_version: options.engineVersion,
    findings_json_version: FINDINGS_JSON_VERSION,
    generated_utc: new Date().toISOString(),
    source_bundle: options.sourceBundle,
    case_ids: options.caseIds ?? [],
    supplement_date: options.supplementDate ?? null,
    engine_verified_count: records.length - candidateCount,
    g3_candidate_count: candidateCount,
    integrity_findings: options.integrityFindings ?? [],
    contradictions: records,
  };
}
