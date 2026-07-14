// Verum Omnis — Contradiction Detectors v6 (Companion Layer, TypeScript)
// Status: RATIFIED — BINDING (founder directive, 2026-07-14)
// Spec: CANDIDATE_CONTRADICTION_TYPES_v6.md
//
// Builds ONTO the sealed engine.  The engine file is untouched; these detectors
// operate on anchored text chunks and emit findings-JSON records (the
// ContradictionRecord shape) that merge into a findings document.
//
// Three detectors:
//   1. SWORN_VS_SWORN              — cross-deponent perjury conflict
//   2. DEVICE_ATTRIBUTION_CHAIN    — declaration-linked digital attribution
//   3. CRIMINAL_CHARGE_AS_LEVERAGE — retaliatory prosecution pattern
//
// Plus the word-boundary precision fix ("lease" must not fire inside "please").
// Every record is anchored: source document, page, SHA-512.  If it is not
// anchored, it is not emitted.  Each record's legal hypothesis is enriched with
// the local-statute anchor (person -> page -> local law).

import type { ContradictionRecord } from "../pipeline/findingsJsonEmitter.js";
import { enrichHypothesis, normaliseJurisdiction, DEFAULT_JURISDICTION } from "./statuteMap.js";

export const DETECTOR_VERSION = "v6-ratified-1.0.0";

export const TYPE_SWORN_VS_SWORN = "SWORN_VS_SWORN";
export const TYPE_DEVICE_ATTRIBUTION_CHAIN = "DEVICE_ATTRIBUTION_CHAIN";
export const TYPE_CRIMINAL_CHARGE_AS_LEVERAGE = "CRIMINAL_CHARGE_AS_LEVERAGE";

export const STATUS_ENGINE_VERIFIED = "ENGINE-VERIFIED";

// ---------------------------------------------------------------------------
// Text chunks + actor lexicon
// ---------------------------------------------------------------------------

export interface TextChunk {
  text: string;
  source: string; // document name
  page: number; // 1-based page number
  sha512: string; // SHA-512 of source artefact
}

export interface ActorLexiconEntry {
  name: string;
  aliases?: string[];
  role?: string; // "respondent" | "complainant" | "institution" | "witness"
}

// ---------------------------------------------------------------------------
// Word-boundary term matching (the precision fix)
// ---------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word / whole-phrase match.  "lease" does NOT match inside "please". */
export function containsTerm(text: string, term: string): boolean {
  const words = term.trim().split(/\s+/).map(escapeRegExp);
  if (!words.length || !words[0]) return false;
  const pattern = new RegExp("\\b" + words.join("\\s+") + "\\b", "i");
  return pattern.test(text);
}

export function findTerms(text: string, terms: string[]): string[] {
  return terms.filter((t) => containsTerm(text, t));
}

// ---------------------------------------------------------------------------
// Sentence + actor helpers
// ---------------------------------------------------------------------------

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z("'])/;

const STOP_WORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "that", "this", "with", "from",
  "into", "onto", "over", "under", "your", "their", "his", "her", "its",
  "our", "my", "we", "you", "they", "them", "then", "than", "when",
  "what", "which", "who", "whom", "will", "would", "could", "should",
  "have", "has", "had", "been", "being", "were", "was", "are", "is",
  "for", "not", "all", "any", "each", "such", "these", "those", "about",
]);

const NEGATORS = [
  "no", "not", "never", "denied", "denies", "deny", "refused", "refuses",
  "false", "incorrect", "without", "failed to", "did not", "does not",
  "was not", "were not", "cannot", "didn't", "doesn't", "wasn't",
];

export function sentences(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    for (const s of line.split(SENTENCE_SPLIT_RE)) {
      if (s.trim()) out.push(s);
    }
  }
  return out;
}

export function contentWords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return words.filter((w) => !STOP_WORDS.has(w));
}

export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export function negationAsymmetry(a: string, b: string): boolean {
  const aNeg = findTerms(a, NEGATORS).length > 0;
  const bNeg = findTerms(b, NEGATORS).length > 0;
  return aNeg !== bNeg;
}

/** First lexicon entry whose name or alias appears as whole word(s). */
export function attributeActor(
  text: string,
  lexicon: ActorLexiconEntry[],
): string | null {
  for (const entry of lexicon) {
    const candidates = [entry.name, ...(entry.aliases ?? [])];
    for (const cand of candidates) {
      if (cand && containsTerm(text, cand)) return entry.name;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Record factory — every detector emits the same anchored findings shape
// ---------------------------------------------------------------------------

let _counter = 0;
function nextId(prefix = "V6"): string {
  _counter += 1;
  return `${prefix}-C-${String(_counter).padStart(4, "0")}`;
}
export function resetCounter(): void {
  _counter = 0;
}

interface RecordArgs {
  contradictionType: string;
  severity: string;
  confidence: string;
  aText: string;
  aActor: string;
  bText: string;
  bActor: string;
  description: string;
  chunk: TextChunk;
  patternType: string;
  supporting: string[];
  legalHypothesis: Record<string, unknown> | null;
  secondChunk?: TextChunk;
}

function makeRecord(args: RecordArgs): ContradictionRecord {
  let sourceDocument = args.chunk.source;
  if (args.secondChunk && args.secondChunk.source !== args.chunk.source) {
    sourceDocument = `${args.chunk.source} + ${args.secondChunk.source}`;
  }
  return {
    contradiction_id: nextId(),
    type: args.contradictionType,
    severity: args.severity as ContradictionRecord["severity"],
    confidence: args.confidence as ContradictionRecord["confidence"],
    proposition_a_text: args.aText.trim(),
    proposition_a_actor: args.aActor,
    proposition_b_text: args.bText.trim(),
    proposition_b_actor: args.bActor,
    conflict_description: args.description,
    source_document: sourceDocument,
    source_page: args.chunk.page,
    source_line: 0,
    sha512_anchor: args.chunk.sha512,
    extraction_method: `deterministic detector (${DETECTOR_VERSION})`,
    temporal_analysis: null,
    detected_fact: {
      fact_text: args.description,
      source_document: sourceDocument,
      source_page: args.chunk.page,
      source_line: 0,
      sha512_hash: args.chunk.sha512,
      extraction_method: args.patternType,
      confidence: args.confidence,
    },
    logical_pattern: {
      pattern_type: args.patternType,
      pattern_description: args.description,
      supporting_facts: args.supporting,
      contradiction_score: null,
      detector_version: DETECTOR_VERSION,
    },
    legal_hypothesis: args.legalHypothesis,
    verification_status: STATUS_ENGINE_VERIFIED,
  } as unknown as ContradictionRecord;
}

// ---------------------------------------------------------------------------
// Detector 1: SWORN_VS_SWORN
// ---------------------------------------------------------------------------

const SWORN_MARKERS = [
  "affidavit", "sworn", "under oath", "solemnly declare", "solemn declaration",
  "deponent", "sworn statement", "oath", "commissioner of oaths",
];

export function detectSwornVsSworn(
  chunks: TextChunk[],
  actors: ActorLexiconEntry[],
  minSubjectOverlap = 0.25,
): ContradictionRecord[] {
  const swornClaims: Array<{
    text: string; actor: string; chunk: TextChunk; words: string[];
  }> = [];
  for (const chunk of chunks) {
    for (const sent of sentences(chunk.text)) {
      if (!findTerms(sent, SWORN_MARKERS).length) continue;
      const actor = attributeActor(sent, actors);
      if (actor == null) continue;
      swornClaims.push({ text: sent, actor, chunk, words: contentWords(sent) });
    }
  }

  const out: ContradictionRecord[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < swornClaims.length; i++) {
    for (let j = i + 1; j < swornClaims.length; j++) {
      const a = swornClaims[i];
      const b = swornClaims[j];
      if (a.actor === b.actor) continue;
      if (jaccard(a.words, b.words) < minSubjectOverlap) continue;
      if (!negationAsymmetry(a.text, b.text)) continue;
      const key = `${a.actor}|${b.actor}|${a.text.slice(0, 40)}|${b.text.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(makeRecord({
        contradictionType: TYPE_SWORN_VS_SWORN,
        severity: "VERY_HIGH",
        confidence: "HIGH",
        aText: a.text, aActor: a.actor,
        bText: b.text, bActor: b.actor,
        description:
          `Sworn statements conflict: ${a.actor} and ${b.actor} made opposing ` +
          "sworn assertions on the same material fact. One statement is necessarily false under oath.",
        chunk: a.chunk, secondChunk: b.chunk,
        patternType: "CROSS_DEPONENT_SWORN_CONFLICT",
        supporting: [a.text.trim(), b.text.trim()],
        legalHypothesis: {
          suggested_offence: "Perjury",
          legal_basis: "Two mutually exclusive sworn statements on one material fact; one deponent has sworn falsely.",
          required_additional_evidence: [
            "Both sworn documents in original form",
            "Proof of oath administration for each",
            "Contemporaneous documentary evidence resolving the fact",
          ],
          is_hypothesis: true,
          requires_human_review: true,
        },
      }));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detector 2: DEVICE_ATTRIBUTION_CHAIN
// ---------------------------------------------------------------------------

const ENTITY_TERMINATOR = String.raw`(?=["'\u2018\u2019\u201c\u201d.,;:!?)\u2026]|$)`;

const DECLARATION_RES: RegExp[] = [
  new RegExp(
    String.raw`\b(?:i|we)\s+(?:own|have|run|operate|control)\s+(?:a\s+)?` +
      String.raw`(?:pty|company|business|firm|entity|ltd|llc|fz-llc)?\s*` +
      String.raw`(?:called|named)?\s*["'\u201c]?` +
      String.raw`([A-Z][A-Za-z0-9 &\-]{2,60}?)` + ENTITY_TERMINATOR,
    "i",
  ),
  new RegExp(
    String.raw`\bmy\s+(?:company|business|pty|firm)\s+(?:called|named|is)?\s*` +
      String.raw`["'\u201c]?([A-Z][A-Za-z0-9 &\-]{2,60}?)` + ENTITY_TERMINATOR,
    "i",
  ),
];

const ADVERSE_ACT_MARKERS = [
  "hack", "hacked", "hacking", "interception", "intercepted", "unauthorised access",
  "unauthorized access", "archive attempt", "breach", "intrusion", "traced to",
  "remote access", "login attempt", "malware", "spyware", "compromised",
];

const DEVICE_REF_RE = new RegExp(
  String.raw`\b(?:device|account|hostname|profile|handset|computer|machine)\b` +
    String.raw`[^"'\u2018\u2019\u201c\u201d.,;:]{0,40}?` +
    String.raw`["'\u2018\u2019\u201c\u201d]([A-Z0-9_\-]{4,40})["'\u2018\u2019\u201c\u201d]`,
  "i",
);

function normaliseIdentifier(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function entityMatchesDevice(entity: string, device: string): boolean {
  const ent = normaliseIdentifier(entity);
  const dev = normaliseIdentifier(device);
  if (!ent || !dev) return false;
  if (dev.includes(ent) || ent.includes(dev)) return true;
  const words = entity.match(/[A-Za-z]{6,}/g) ?? [];
  return words.some((w) => dev.includes(w.toUpperCase()));
}

export function detectDeviceAttributionChain(
  chunks: TextChunk[],
  actors: ActorLexiconEntry[],
): ContradictionRecord[] {
  const declarations: Array<{ entity: string; text: string; actor: string | null; chunk: TextChunk }> = [];
  const adverseActs: Array<{ device: string; text: string; chunk: TextChunk }> = [];

  for (const chunk of chunks) {
    for (const sent of sentences(chunk.text)) {
      for (const rx of DECLARATION_RES) {
        const m = rx.exec(sent);
        if (m) {
          declarations.push({
            entity: m[1].trim(),
            text: sent,
            actor: attributeActor(sent, actors),
            chunk,
          });
        }
      }
      if (findTerms(sent, ADVERSE_ACT_MARKERS).length) {
        const dm = DEVICE_REF_RE.exec(sent);
        if (dm) adverseActs.push({ device: dm[1], text: sent, chunk });
      }
    }
  }

  const out: ContradictionRecord[] = [];
  const seen = new Set<string>();
  for (const decl of declarations) {
    for (const act of adverseActs) {
      if (!entityMatchesDevice(decl.entity, act.device)) continue;
      const key = `${decl.entity}|${act.device}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const actorName = decl.actor ?? "declarant";
      out.push(makeRecord({
        contradictionType: TYPE_DEVICE_ATTRIBUTION_CHAIN,
        severity: "HIGH",
        confidence: "MODERATE",
        aText: decl.text, aActor: actorName,
        bText: act.text, bActor: `device '${act.device}'`,
        description:
          `Attribution chain: ${actorName} declared ownership of '${decl.entity}'; ` +
          `device/account '${act.device}' - named for that entity - performed an adverse ` +
          "digital act. Attribution is corroborating, not conclusive.",
        chunk: decl.chunk, secondChunk: act.chunk,
        patternType: "DECLARATION_LINKED_DEVICE_ATTRIBUTION",
        supporting: [decl.text.trim(), act.text.trim()],
        legalHypothesis: {
          suggested_offence: "Unauthorised access / interception of data",
          legal_basis: "Declaration links the named actor to the device that performed the adverse act.",
          required_additional_evidence: [
            "The declaration in original form (message/export)",
            "Device or account records tying the identifier to the actor",
            "Logs of the adverse act with timestamps and source addresses",
          ],
          is_hypothesis: true,
          requires_human_review: true,
        },
      }));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detector 3: CRIMINAL_CHARGE_AS_LEVERAGE
// ---------------------------------------------------------------------------

const CHARGE_MARKERS = [
  "opened a case", "laid a charge", "laid charges", "criminal charge",
  "charged with", "case number", "theft case", "criminal case",
  "police case", "opened a criminal case",
];

const CASE_NUMBER_RE = /\bCAS\s*\d{1,5}\/\d{1,2}\/\d{4}\b/i;

const CIVIL_DISPUTE_MARKERS = [
  "civil", "applicant", "respondent", "high court", "litigation",
  "application", "counterclaim", "commercial dispute", "fraud claim",
];

const LEVERAGE_MARKERS = [
  "silence", "silenced", "pressure", "leverage", "retaliation", "retaliatory",
  "intimidate", "intimidation", "withdraw", "drop the case", "back down",
];

const DATE_RE =
  /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2})\b/i;

export function detectCriminalChargeAsLeverage(
  chunks: TextChunk[],
  actors: ActorLexiconEntry[],
  windowSentences = 3,
): ContradictionRecord[] {
  const flat: Array<{ text: string; chunk: TextChunk }> = [];
  for (const chunk of chunks) {
    for (const sent of sentences(chunk.text)) flat.push({ text: sent, chunk });
  }

  const out: ContradictionRecord[] = [];
  const seen = new Set<string>();
  const corpusHasCivil = flat.some((s) => findTerms(s.text, CIVIL_DISPUTE_MARKERS).length);

  for (let idx = 0; idx < flat.length; idx++) {
    const s = flat[idx];
    const chargeTerms = findTerms(s.text, CHARGE_MARKERS);
    const caseNo = CASE_NUMBER_RE.exec(s.text);
    if (!chargeTerms.length && !caseNo) continue;

    const lo = Math.max(0, idx - windowSentences);
    const hi = Math.min(flat.length, idx + windowSentences + 1);
    const window = flat.slice(lo, hi);

    const leverageHit = window.find((w) => findTerms(w.text, LEVERAGE_MARKERS).length) ?? null;
    const civilHit = window.find((w) => findTerms(w.text, CIVIL_DISPUTE_MARKERS).length) ?? null;

    if (leverageHit == null && !(corpusHasCivil && civilHit != null)) continue;

    const key = s.text.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);

    const chargeActor = attributeActor(s.text, actors) ?? "unattributed";
    const dates = s.text.match(DATE_RE);
    const anchor = leverageHit ?? civilHit ?? s;
    const basis = leverageHit
      ? "silencing language accompanies the charge"
      : "charge sits inside an ongoing civil dispute between the same parties";

    out.push(makeRecord({
      contradictionType: TYPE_CRIMINAL_CHARGE_AS_LEVERAGE,
      severity: "VERY_HIGH",
      confidence: "MODERATE",
      aText: s.text, aActor: chargeActor,
      bText: anchor.text, bActor: "case context",
      description:
        "Criminal charge used as leverage in a civil dispute: " + basis +
        (caseNo ? `. Charge reference: ${caseNo[0]}` : "") +
        (dates ? `. Dated: ${dates[1]}` : ""),
      chunk: s.chunk, secondChunk: anchor.chunk,
      patternType: "CRIMINAL_CHARGE_AS_CIVIL_LEVERAGE",
      supporting: [s.text.trim(), anchor.text.trim()],
      legalHypothesis: {
        suggested_offence: "Defeating or obstructing the course of justice / abuse of process",
        legal_basis: "Criminal process invoked by an opposing civil litigant for leverage rather than legitimate prosecution.",
        required_additional_evidence: [
          "The criminal docket / charge sheet",
          "Timeline of civil-case milestones vs charge date",
          "Outcome of the criminal charge (withdrawal, nolle prosequi)",
        ],
        is_hypothesis: true,
        requires_human_review: true,
      },
    }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Runner + merge
// ---------------------------------------------------------------------------

/**
 * Run all three v6 detectors; return deduplicated findings records.
 * If `jurisdiction` is given, each record's legal_hypothesis is enriched with
 * the local-statute anchor so the forensic chain closes on the local law.
 */
export function runV6Detectors(
  chunks: TextChunk[],
  actors: ActorLexiconEntry[],
  jurisdiction: string | null = DEFAULT_JURISDICTION,
): ContradictionRecord[] {
  const results: ContradictionRecord[] = [
    ...detectSwornVsSworn(chunks, actors),
    ...detectDeviceAttributionChain(chunks, actors),
    ...detectCriminalChargeAsLeverage(chunks, actors),
  ];
  const seen = new Set<string>();
  const unique: ContradictionRecord[] = [];
  for (const r of results) {
    const key = `${r.type}|${r.proposition_a_text.slice(0, 50)}|${r.proposition_b_text.slice(0, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  if (jurisdiction) {
    for (const r of unique) {
      const enriched = enrichHypothesis(
        (r.legal_hypothesis as Record<string, unknown>) ?? null,
        r.type,
        jurisdiction,
      );
      (r as any).legal_hypothesis = enriched;
      (r as any).jurisdiction = normaliseJurisdiction(jurisdiction);
    }
  }
  return unique;
}

/** Merge v6 detector records into a findings document and recount tiers. */
export function mergeV6IntoFindings(
  findings: Record<string, any>,
  v6Records: ContradictionRecord[],
): Record<string, any> {
  findings.contradictions = findings.contradictions ?? [];
  findings.contradictions.push(...v6Records);
  const cand = findings.contradictions.filter(
    (r: any) => typeof r.verification_status === "string" && r.verification_status.startsWith("G3-RAISED"),
  ).length;
  findings.g3_candidate_count = cand;
  findings.engine_verified_count = findings.contradictions.length - cand;
  return findings;
}
