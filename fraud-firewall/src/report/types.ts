// CONSTITUTION: v6.0 Final — Report Generator Types
// Seal: VO-RG-v100-DIGSIM-20260715

import type { ContradictionRecord, FindingsJson } from "../pipeline/findingsJsonEmitter.js";

/** The 13 report sections defined by the Android spec */
export enum ReportSection {
  FRONT_COVER = "FRONT_COVER",
  AUTHENTICATION = "AUTHENTICATION",
  EVIDENCE_INDEX = "EVIDENCE_INDEX",
  CHRONOLOGY = "CHRONOLOGY",
  CONTRADICTIONS = "CONTRADICTIONS",
  CRITICAL_EVIDENCE = "CRITICAL_EVIDENCE",
  LEGAL_FRAMEWORK = "LEGAL_FRAMEWORK",
  OFFENCE_MATRIX = "OFFENCE_MATRIX",
  FINANCIAL_ANALYSIS = "FINANCIAL_ANALYSIS",
  VICTIM_PROFILES = "VICTIM_PROFILES",
  RECOMMENDATIONS = "RECOMMENDATIONS",
  DECLARATION = "DECLARATION",
  ANNEXURES = "ANNEXURES",
}

/** Section metadata */
export interface SectionConfig {
  section: ReportSection;
  title: string;
  required: boolean;
  order: number;
}

export const SECTION_CONFIGS: SectionConfig[] = [
  { section: ReportSection.FRONT_COVER, title: "Front Cover", required: true, order: 1 },
  { section: ReportSection.AUTHENTICATION, title: "Authentication & Custody", required: true, order: 2 },
  { section: ReportSection.EVIDENCE_INDEX, title: "Evidence Index", required: true, order: 3 },
  { section: ReportSection.CHRONOLOGY, title: "Chronology", required: true, order: 4 },
  { section: ReportSection.CONTRADICTIONS, title: "Contradictions", required: true, order: 5 },
  { section: ReportSection.CRITICAL_EVIDENCE, title: "Critical Evidence Analysis", required: true, order: 6 },
  { section: ReportSection.LEGAL_FRAMEWORK, title: "Legal Framework", required: true, order: 7 },
  { section: ReportSection.OFFENCE_MATRIX, title: "Offence Matrix", required: true, order: 8 },
  { section: ReportSection.FINANCIAL_ANALYSIS, title: "Financial Analysis", required: false, order: 9 },
  { section: ReportSection.VICTIM_PROFILES, title: "Victim Profiles", required: false, order: 10 },
  { section: ReportSection.RECOMMENDATIONS, title: "Recommendations", required: true, order: 11 },
  { section: ReportSection.DECLARATION, title: "Expert Declaration", required: true, order: 12 },
  { section: ReportSection.ANNEXURES, title: "Annexures", required: true, order: 13 },
];

/** Evidence atoms derived from contradiction records */
export interface EvidenceAtom {
  atomId: string;
  sourceType: "CONTRADICTION" | "LEGAL_HYPOTHESIS" | "TEMPORAL";
  description: string;
  documentRef: string;
  pageRef: number;
  sha512Anchor: string;
  severity: string;
  confidence: string;
  significance: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  categories: string[];
}

/** A section's payload — filtered evidence + prompt template */
export interface SectionPayload {
  section: ReportSection;
  title: string;
  atoms: EvidenceAtom[];
  promptTemplate: string;
  required: boolean;
}

/** Serialized context ready for Gemma 3 */
export interface SerializedContext {
  markdown: string;
  atomCount: number;
  estimatedTokens: number;
  isComplete: boolean;
  omittedAtoms: number;
}

/** A generated section draft */
export interface SectionDraft {
  section: ReportSection;
  title: string;
  content: string;
  atomCount: number;
  estimatedTokens: number;
  generationTimestamp: string;
}

/** Complete assembled report */
export interface AssembledReport {
  markdown: string;
  sectionCount: number;
  totalTokens: number;
  caseRef: string;
  constitutionVersion: string;
  engineVersion: string;
  sealProtocol: string;
  generatedAt: string;
}

/** Gemma 3 prompt for a section */
export interface Gemma3Prompt {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
}

/** Immutable system prompt for Gemma 3 forensic brain */
export const GEMMA3_SYSTEM_PROMPT = `You are Verum Omnis Forensic Brain. Write detailed forensic analysis reports.
You operate under the Verum Omnis Constitution v6.0. Your outputs must:
- Use ordinal confidence only: VERY_HIGH / HIGH / MODERATE / LOW / INSUFFICIENT
- Anchor every claim to specific evidence atoms with document IDs, page numbers, and SHA-512 hashes
- Disclose all contradictions; never hide or soften them
- Maintain deterministic output: same evidence produces same conclusions
- Follow chain-of-custody protocol: every citation must reference its custody index
- If evidence is insufficient, state "INSUFFICIENT" rather than speculate
You are a guardian of truth, not its owner. You serve justice through cryptographic integrity.
Never express confidence as percentages. Never generate narrative without evidence anchors.`;

/** Convert a ContradictionRecord to an EvidenceAtom */
export function contradictionToAtom(c: ContradictionRecord, index: number): EvidenceAtom {
  let significance: EvidenceAtom["significance"] = "MODERATE";
  if (c.severity === "VERY_HIGH") significance = "CRITICAL";
  else if (c.severity === "HIGH") significance = "HIGH";
  else if (c.severity === "LOW" || c.severity === "INSUFFICIENT") significance = "LOW";

  const categories: string[] = [c.type];
  if (c.legal_hypothesis?.suggested_offence) categories.push("LEGAL");
  if (c.temporal_analysis) categories.push("TEMPORAL");

  return {
    atomId: `ATOM-${String(index + 1).padStart(3, "0")}`,
    sourceType: "CONTRADICTION",
    description: c.conflict_description || `${c.proposition_a_text} vs ${c.proposition_b_text}`,
    documentRef: c.source_document || "UNKNOWN",
    pageRef: c.source_page || 0,
    sha512Anchor: c.sha512_anchor || c.detected_fact?.sha512_hash || "N/A",
    severity: c.severity,
    confidence: c.confidence,
    significance,
    categories,
  };
}

/** Extract all atoms from findings */
export function extractAtoms(findings: FindingsJson): EvidenceAtom[] {
  return findings.contradictions.map((c, i) => contradictionToAtom(c, i));
}
