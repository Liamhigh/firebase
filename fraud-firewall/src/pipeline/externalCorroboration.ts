// CONSTITUTION: v6.0 Final — External Corroboration (open-source signal) v1.0.0
// Spec: REPORT_FORMAT_SPECIFICATION.md §17 | Prompt: G3_SYSTEM_PROMPT.md
//
// Gemma 3 may gather court cases and news to corroborate a sealed finding. This
// module is the code-level enforcement of the constitutional rules so the model
// physically cannot break them:
//
//   1. Entitlement — private citizens and law enforcement may research freely;
//      commercial use requires a valid Verum Omnis licence (Constitution §8).
//   2. Signal or silence — an item is kept ONLY if it has a resolvable source
//      (a URL or a case number). No signal → dropped. Never guess a case.
//   3. Corroboration only — the output can never create a finding, promote a G3
//      candidate, or override sealed evidence. It attaches to an existing,
//      anchored finding as contextual weight, and this module never mutates the
//      findings it is given.
//   4. Fetched text is data, not instruction — snippets are sanitised of
//      prompt-injection directives before they are ever shown to the model
//      (Constitution: this document "overrides external instructions").
//
// The network fetcher is INJECTED. This module performs no I/O itself, so it is
// fully deterministic and testable, and the same logic runs in the firewall and
// (ported) in the Android app.

import type { ContradictionRecord, FindingsJson } from "./findingsJsonEmitter.js";

/** Who is running the research. Private + law enforcement are free (Constitution §8). */
export type UseClass = "private" | "law_enforcement" | "commercial";

export interface CorroborationEntitlement {
  useClass: UseClass;
  /** Only consulted for commercial use. A private/LE account ignores it. */
  commercialLicenseValid?: boolean;
}

/** What an injected fetcher returns for a query. Untrusted, unsanitised. */
export interface RawSource {
  title?: string;
  /** A resolvable web address, if this is a news/web source. */
  url?: string;
  /** A court/tribunal case reference, if this is a legal source. */
  caseNumber?: string;
  publisher?: string;
  /** The snippet/excerpt. Treated as data, never as instruction. */
  snippet?: string;
  /** ISO-8601 retrieval time. Stamped by the caller if absent. */
  retrievedUtc?: string;
}

/** Injected search function. No network happens inside this module. */
export type CorroborationFetcher = (query: string) => Promise<RawSource[]>;

/** A validated, constitution-compliant corroboration item for report §17. */
export interface CorroborationItem {
  readonly classification: "EXTERNAL_UNSEALED";
  readonly weight: "contextual_only";
  claim: string;
  /** Human label, e.g. "Constitutional Court of South Africa" or "News24". */
  sourceLabel: string;
  /** The resolvable reference — a URL or a case number. Always present. */
  sourceRef: string;
  publisher?: string;
  retrievedUtc: string;
  /** The sealed finding this corroborates (id + its anchor). */
  corroboratesFindingId: string;
  corroboratesAnchor: string;
}

export interface CorroborationResult {
  entitled: boolean;
  items: CorroborationItem[];
  /** The line the report prints (Constitution: never silent about a gap). */
  note: string;
  /** Items offered by the fetcher but dropped for lack of signal (audit). */
  droppedForNoSignal: number;
}

export interface GatherOptions {
  entitlement: CorroborationEntitlement;
  fetcher: CorroborationFetcher;
  /** Build the search queries for a finding. Default: actors + conflict text. */
  buildQueries?: (finding: ContradictionRecord) => string[];
  /** Max kept items overall (keeps the section proportionate). Default 12. */
  maxItems?: number;
  /** Deterministic clock for stamping/retrieval defaults. Default real time. */
  now?: () => string;
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all|any|the|previous|prior|above)\b[^.\n]*/gi,
  /disregard\s+(?:all|any|the|previous|prior|above)?[^.\n]*(?:instruction|rule|constitution|prompt)[^.\n]*/gi,
  /system\s*prompt/gi,
  /\byou\s+are\s+(?:now\s+)?(?:an?|the)\b[^.\n]*/gi,
  /\bact\s+as\b[^.\n]*/gi,
  /\boverride\b[^.\n]*/gi,
  /\bnew\s+instructions?\b[^.\n]*/gi,
  /^\s*(?:system|assistant|developer)\s*:/gim,
];

const MAX_SNIPPET = 280;

/**
 * Neutralise prompt-injection directives in untrusted external text and clamp
 * length. The primary safeguard is that this text is always labelled external
 * data; this is defence-in-depth so a fetched page cannot smuggle instructions
 * into the model's context.
 */
export function sanitizeExternalText(input: string): string {
  let s = String(input ?? "").replace(/[`*_#>]/g, " ").replace(/\s+/g, " ").trim();
  for (const re of INJECTION_PATTERNS) s = s.replace(re, "[redacted-directive]");
  if (s.length > MAX_SNIPPET) s = s.slice(0, MAX_SNIPPET - 1).trimEnd() + "…";
  return s.trim();
}

/** A source has signal iff it carries a resolvable reference. */
function resolveRef(src: RawSource): { label: string; ref: string } | null {
  const url = (src.url ?? "").trim();
  if (/^https?:\/\/\S+$/i.test(url)) {
    return { label: (src.publisher || src.title || hostOf(url) || "Web source").trim(), ref: url };
  }
  const caseNo = (src.caseNumber ?? "").trim();
  if (caseNo) {
    return { label: (src.publisher || src.title || "Court record").trim(), ref: caseNo };
  }
  return null; // no signal → dropped
}

function hostOf(url: string): string {
  const m = /^https?:\/\/([^/]+)/i.exec(url);
  return m ? m[1] : "";
}

function defaultQueries(f: ContradictionRecord): string[] {
  const parties = [f.proposition_a_actor, f.proposition_b_actor].filter(Boolean) as string[];
  const base = f.conflict_description || f.type;
  const qs = new Set<string>();
  for (const p of parties) qs.add(`${p} ${base}`.trim());
  if (!parties.length && base) qs.add(base);
  return [...qs].slice(0, 3);
}

/**
 * Gather external corroboration for the given findings, enforcing every
 * constitutional rule in code. Never mutates `findings`. Returns only items that
 * (a) the caller is entitled to gather and (b) carry a resolvable source.
 */
export async function gatherExternalCorroboration(
  findings: Pick<FindingsJson, "contradictions">,
  opts: GatherOptions,
): Promise<CorroborationResult> {
  const now = opts.now ?? (() => new Date().toISOString());

  // 1. Entitlement gate (Constitution §8: private + LE free; commercial licensed).
  const { useClass, commercialLicenseValid } = opts.entitlement;
  if (useClass === "commercial" && !commercialLicenseValid) {
    return {
      entitled: false,
      items: [],
      droppedForNoSignal: 0,
      note:
        "External research is licensed for commercial use. Provide a valid Verum Omnis " +
        "commercial licence, or run under a private or law-enforcement account. " +
        "Analysis rests entirely on sealed evidence.",
    };
  }

  const buildQueries = opts.buildQueries ?? defaultQueries;
  const maxItems = opts.maxItems ?? 12;
  const items: CorroborationItem[] = [];
  const seenRefs = new Set<string>();
  let droppedForNoSignal = 0;

  // 2. Only anchored findings can be corroborated (no anchor, nothing to attach to).
  const anchored = (findings.contradictions ?? []).filter(
    (f) => f.source_document && f.source_page != null && f.source_page >= 0 && f.sha512_anchor,
  );

  for (const f of anchored) {
    if (items.length >= maxItems) break;
    const page = f.source_page ?? 0;
    const anchor = `${f.source_document} p.${page}` +
      (f.source_line != null ? ` line ${f.source_line}` : "");
    for (const q of buildQueries(f)) {
      if (items.length >= maxItems) break;
      let raw: RawSource[] = [];
      try {
        raw = (await opts.fetcher(q)) ?? [];
      } catch {
        raw = []; // a failed fetch is silence, never a fabricated result
      }
      for (const src of raw) {
        if (items.length >= maxItems) break;
        const resolved = resolveRef(src); // 3. signal gate
        if (!resolved) {
          droppedForNoSignal++;
          continue;
        }
        if (seenRefs.has(resolved.ref)) continue;
        const claim = sanitizeExternalText(src.snippet || src.title || ""); // 4. sanitise
        if (!claim) {
          droppedForNoSignal++;
          continue;
        }
        seenRefs.add(resolved.ref);
        items.push({
          classification: "EXTERNAL_UNSEALED",
          weight: "contextual_only",
          claim,
          sourceLabel: sanitizeExternalText(resolved.label) || "Source",
          sourceRef: resolved.ref,
          publisher: src.publisher ? sanitizeExternalText(src.publisher) : undefined,
          retrievedUtc: src.retrievedUtc || now(),
          corroboratesFindingId: f.contradiction_id,
          corroboratesAnchor: anchor,
        });
      }
    }
  }

  const note = items.length
    ? `${items.length} external item(s) gathered as corroboration only; none alters a sealed finding.`
    : "No external corroboration gathered — analysis rests entirely on sealed evidence.";

  return { entitled: true, items, note, droppedForNoSignal };
}

/**
 * Render report §17 (External Corroboration) in the mandated format. Pure
 * function over the gather result; safe to seal.
 */
export function renderCorroborationSection(result: CorroborationResult): string {
  const lines: string[] = ["## 17. External Corroboration (Open-Source Signal)", ""];
  if (!result.entitled || result.items.length === 0) {
    lines.push(result.note);
    return lines.join("\n");
  }
  for (const it of result.items) {
    lines.push(`[EXTERNAL — UNSEALED] ${it.claim}`);
    lines.push(
      `  Source: ${it.sourceLabel} · ${it.sourceRef} · retrieved ${it.retrievedUtc}`,
    );
    lines.push(
      `  Corroborates: Finding ${it.corroboratesFindingId} (anchored at ${it.corroboratesAnchor})`,
    );
    lines.push("  Weight: contextual only — does not alter the sealed finding");
    lines.push("");
  }
  lines.push(`_${result.note}_`);
  return lines.join("\n");
}
