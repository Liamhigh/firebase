/**
 * G3 Hybrid Report Pipeline — second-pass vault review (GHRP section 4).
 *
 * After the deterministic ContradictionEngine has run, Gemma 3 re-reads the
 * ingested evidence looking for contradictions the engine did not emit.
 * Every catch is recorded via raiseG3Candidate() as a
 * "G3-RAISED CANDIDATE - PENDING VERIFICATION" record — never presented as
 * engine-verified.
 *
 * The anchor rule is enforced structurally: the model only NOMINATES a source
 * document by name; the SHA-512 anchor is taken from the engine's own digest
 * of that document. A candidate naming a document that was never ingested is
 * discarded. If it is not anchored, it is not emitted.
 *
 * With no llama.cpp server configured this pass is a no-op and the pipeline
 * is byte-identical to the pure deterministic engine.
 */

import type { Contradiction, ForensicDocument } from "../core/types.js";
import type { LlamaLike } from "../ai/llamaClient.js";
import { sha512 } from "../core/crypto.js";
import {
  raiseG3Candidate,
  type ContradictionRecord,
  type OrdinalConfidence,
  type OrdinalSeverity,
} from "../pipeline/findingsJsonEmitter.js";

const MAX_DOC_EXCERPT_CHARS = 4000;
const MAX_TOTAL_PROMPT_CHARS = 24000;
const MAX_CANDIDATES_PER_REVIEW = 12;

interface NominatedCandidate {
  type: string;
  proposition_a_text: string;
  proposition_a_actor: string;
  proposition_b_text: string;
  proposition_b_actor: string;
  conflict_description: string;
  source_document: string;
  source_page: number;
  severity: OrdinalSeverity;
  confidence: OrdinalConfidence;
}

export class G3ReviewPass {
  constructor(
    private readonly llama: LlamaLike | null,
    private readonly g3Model: string = "gemma-3-4b-it",
  ) {}

  /**
   * Review the ingested documents against the engine's contradictions.
   * `digests` maps evidence_id -> SHA-512 computed by the engine at ingest.
   */
  async review(
    docs: ForensicDocument[],
    contradictions: Contradiction[],
    digests: Map<string, string>,
    now: string,
  ): Promise<ContradictionRecord[]> {
    if (!docs.length || !this.llama?.enabled()) return [];
    if (!(await this.llama.available())) return [];
    const response = await this.llama.generate(buildReviewPrompt(docs, contradictions), {
      maxTokens: 2048,
    });
    if (!response) return [];

    // Ambiguous file names would anchor a candidate to the wrong digest —
    // only documents with unique names are eligible anchor targets.
    const nameCounts = new Map<string, number>();
    for (const d of docs) nameCounts.set(d.source_file, (nameCounts.get(d.source_file) ?? 0) + 1);
    const bySource = new Map(
      docs.filter((d) => nameCounts.get(d.source_file) === 1).map((d) => [d.source_file, d]),
    );
    const out: ContradictionRecord[] = [];
    for (const cand of parseCandidates(response).slice(0, MAX_CANDIDATES_PER_REVIEW)) {
      const doc = bySource.get(cand.source_document);
      if (!doc) continue;
      const digest = digests.get(doc.evidence_id);
      if (!digest) continue;
      if (duplicatesEngineFinding(cand, contradictions)) continue;
      // Content-derived id: stable across re-scans of the same catch, no
      // collisions between different catches raised in the same second.
      const contentHash = sha512(
        `${cand.proposition_a_text}|${cand.proposition_b_text}|${cand.source_document}`,
      ).slice(0, 12);
      out.push(
        raiseG3Candidate({
          candidateId: `G3-CAND-${now.slice(0, 19).replace(/[-:T]/g, "")}-${contentHash}`,
          contradictionType: cand.type,
          propositionAText: cand.proposition_a_text,
          propositionBText: cand.proposition_b_text,
          propositionAActor: cand.proposition_a_actor,
          propositionBActor: cand.proposition_b_actor,
          conflictDescription: cand.conflict_description,
          sourceDocument: doc.source_file,
          sourcePage: Math.max(0, cand.source_page),
          sha512Anchor: digest,
          severity: cand.severity,
          confidence: cand.confidence,
          g3Model: this.g3Model,
        }),
      );
    }
    return out;
  }
}

export function buildReviewPrompt(
  docs: ForensicDocument[],
  contradictions: Contradiction[],
): string {
  const lines: string[] = [
    "You are the Gemma 3 vault reviewer in the Verum Omnis hybrid forensic pipeline.",
    "The deterministic engine has already run. Your ONLY job is to find contradictions it MISSED.",
    "",
    "CONTRADICTIONS THE ENGINE ALREADY EMITTED (do NOT repeat these):",
  ];
  if (!contradictions.length) lines.push("  (none)");
  for (const c of contradictions) {
    lines.push(
      `  - ${c.contradiction_id}: "${c.claim_a.text.slice(0, 120)}" VS "${c.claim_b.text.slice(0, 120)}"`,
    );
  }
  lines.push("", "SEALED EVIDENCE DOCUMENTS:");
  let budget = MAX_TOTAL_PROMPT_CHARS - lines.join("\n").length;
  for (const doc of docs) {
    if (budget <= 0) break;
    const text = doc.pages?.map((p) => p.text).join("\n") ?? doc.text ?? "";
    const excerpt = text.slice(0, Math.min(MAX_DOC_EXCERPT_CHARS, budget));
    lines.push(`--- DOCUMENT: ${doc.source_file} ---`, excerpt);
    budget -= excerpt.length;
  }
  lines.push(
    "",
    "RULES:",
    "- Report ONLY genuine contradictions between two specific statements in the documents above.",
    "- source_document MUST be one of the exact document names listed above.",
    "- Every candidate will be labelled G3-RAISED CANDIDATE - PENDING VERIFICATION, never engine-verified.",
    "- severity: CRITICAL|VERY_HIGH|HIGH|MODERATE|LOW. confidence: VERY_HIGH|HIGH|MODERATE|LOW.",
    "- If you find nothing, output an empty array: []",
    "",
    "OUTPUT: a single JSON array, no prose before or after. Each element:",
    '{"type":"...","proposition_a_text":"...","proposition_a_actor":"...","proposition_b_text":"...","proposition_b_actor":"...","conflict_description":"...","source_document":"...","source_page":1,"severity":"MODERATE","confidence":"MODERATE"}',
  );
  return lines.join("\n");
}

/**
 * Extract the first JSON array from the model response and keep each
 * well-formed element. A malformed response yields no candidates — the
 * review pass never fails the scan.
 */
export function parseCandidates(response: string): NominatedCandidate[] {
  const start = response.indexOf("[");
  if (start < 0) return [];
  // Bracket-match while tracking string literals so brackets inside quoted
  // evidence text (e.g. "[00:12]") don't derail the scan.
  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;
  for (let i = start; i < response.length; i++) {
    const ch = response[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const severities = new Set(["CRITICAL", "VERY_HIGH", "HIGH", "MODERATE", "LOW", "INSUFFICIENT"]);
  const confidences = new Set(["DETERMINISTIC", "VERY_HIGH", "HIGH", "MODERATE", "LOW", "INSUFFICIENT"]);

  const out: NominatedCandidate[] = [];
  for (const el of parsed) {
    if (typeof el !== "object" || el === null) continue;
    const obj = el as Record<string, unknown>;
    const str = (k: string): string => (typeof obj[k] === "string" ? (obj[k] as string) : "");
    const type = str("type");
    const a = str("proposition_a_text");
    const b = str("proposition_b_text");
    const sourceDoc = str("source_document");
    if (!type || !a || !b || !sourceDoc) continue;
    const severity = str("severity").toUpperCase();
    const confidence = str("confidence").toUpperCase();
    out.push({
      type,
      proposition_a_text: a,
      proposition_a_actor: str("proposition_a_actor") || "Unknown",
      proposition_b_text: b,
      proposition_b_actor: str("proposition_b_actor") || "Unknown",
      conflict_description:
        str("conflict_description") || "Contradiction between the two propositions.",
      source_document: sourceDoc,
      source_page: typeof obj.source_page === "number" ? obj.source_page : 0,
      severity: (severities.has(severity) ? severity : "MODERATE") as OrdinalSeverity,
      confidence: (confidences.has(confidence) ? confidence : "MODERATE") as OrdinalConfidence,
    });
  }
  return out;
}

/** A candidate that restates an engine finding is a duplicate, not a catch. */
export function duplicatesEngineFinding(
  cand: Pick<NominatedCandidate, "proposition_a_text" | "proposition_b_text">,
  contradictions: Contradiction[],
): boolean {
  const a = cand.proposition_a_text.trim().toLowerCase();
  const b = cand.proposition_b_text.trim().toLowerCase();
  return contradictions.some((c) => {
    const ca = c.claim_a.text.trim().toLowerCase();
    const cb = c.claim_b.text.trim().toLowerCase();
    return (
      (overlaps(a, ca) && overlaps(b, cb)) || (overlaps(a, cb) && overlaps(b, ca))
    );
  });
}

function overlaps(x: string, y: string): boolean {
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}
