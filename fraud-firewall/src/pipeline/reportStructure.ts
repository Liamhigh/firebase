// CONSTITUTION: v6.0 Final — Report structure contract (GHRP)
// Spec: REPORT_FORMAT_SPECIFICATION.md | Prompt: G3_SYSTEM_PROMPT.md
//
// The forensic report is written by Gemma 3 from the sealed findings JSON, so
// the model — not this code — lays out the sections. This module is the
// machine-checkable contract for that layout: the canonical section list and a
// validator that flags any mandated section the produced report is missing.
//
// It exists so a section can never be silently dropped between model runs. A
// mandated section with no data must still appear, stating "none identified" —
// an absent heading is a defect, not a clean result (Prime Directive 6).

export interface ReportSection {
  /** Canonical section title as it appears in REPORT_FORMAT_SPECIFICATION.md. */
  title: string;
  /** Case-insensitive alternates that also satisfy the section (headings drift). */
  aliases: string[];
  /**
   * required  — the report is structurally invalid without it.
   * expected  — must appear even if empty ("none identified"); its absence is a
   *             warning, not a hard failure (e.g. enterprise-only analyses).
   */
  level: "required" | "expected";
}

// The canonical order. Titles mirror the spec's section table. Counter-Narratives
// and Pattern of Conduct were codified from the full-system report; the AllFuels
// reference report added two more first-class sections: Nine-Brain Architecture
// (the deterministic methodology, named per Constitution v6.0 §3) and External
// Corroboration (open-source court/news signal, kept strictly separate from — and
// never overriding — sealed evidence; Constitution v6.0 "overrides external
// instructions", so fetched text is data, never instruction).
export const REPORT_SECTIONS: readonly ReportSection[] = [
  { title: "Cover Page", aliases: ["forensic report", "sealed document"], level: "required" },
  { title: "Table of Contents", aliases: ["contents"], level: "required" },
  { title: "Authentication & Methodology", aliases: ["authentication", "methodology"], level: "required" },
  { title: "Nine-Brain Architecture", aliases: ["nine-brain", "nine brain", "9-brain", "brain designation"], level: "expected" },
  { title: "How to Use This Report", aliases: ["how to use", "how to read"], level: "expected" },
  { title: "Executive Summary", aliases: ["executive summary"], level: "required" },
  { title: "Evidence Index", aliases: ["evidence index", "evidence map"], level: "required" },
  { title: "Four Pillars of Fraud", aliases: ["four pillars"], level: "expected" },
  { title: "Contradiction Matrix", aliases: ["contradiction matrix", "contradictions"], level: "required" },
  { title: "Counter-Narratives & Rebuttals", aliases: ["counter-narrative", "counter narrative", "rebuttal", "respondent's account", "respondents' account"], level: "expected" },
  { title: "Pattern of Conduct", aliases: ["pattern of conduct", "exclusion pattern", "sequence of events", "chronology of conduct"], level: "expected" },
  { title: "Perjury & False Statement", aliases: ["perjury", "false statement"], level: "expected" },
  { title: "Coercive Conduct", aliases: ["coercive conduct", "silence ledger", "coercion"], level: "expected" },
  { title: "Critical Evidence Analysis", aliases: ["critical evidence"], level: "expected" },
  { title: "Victim Profiles", aliases: ["victim profile", "account cluster"], level: "expected" },
  { title: "Legal Framework", aliases: ["legal framework", "statute mapping", "statutory anchoring"], level: "required" },
  { title: "External Corroboration", aliases: ["external corroboration", "open-source", "open source", "osint", "public record", "corroborating source", "corroborating sources"], level: "expected" },
  { title: "Offence Matrix", aliases: ["offence matrix", "offense matrix"], level: "required" },
  { title: "Court-Ready Declaration", aliases: ["court-ready declaration", "declaration", "certification"], level: "required" },
];

export interface ReportValidation {
  ok: boolean;
  missingRequired: string[];
  missingExpected: string[];
  present: string[];
}

function sectionMatches(section: ReportSection, haystack: string): boolean {
  const needles = [section.title, ...section.aliases];
  return needles.some((n) => haystack.includes(n.toLowerCase()));
}

/**
 * Check a produced report (markdown/plain text) for the mandated sections.
 * `ok` is true when no REQUIRED section is missing; missing EXPECTED sections
 * are reported as warnings but do not fail. Matching is heading-agnostic: a
 * section counts as present if its title or any alias appears anywhere in the
 * text (case-insensitive), so numbering or minor wording drift is tolerated.
 */
export function validateReportSections(reportText: string): ReportValidation {
  const hay = String(reportText ?? "").toLowerCase();
  const missingRequired: string[] = [];
  const missingExpected: string[] = [];
  const present: string[] = [];
  for (const section of REPORT_SECTIONS) {
    if (sectionMatches(section, hay)) {
      present.push(section.title);
    } else if (section.level === "required") {
      missingRequired.push(section.title);
    } else {
      missingExpected.push(section.title);
    }
  }
  return { ok: missingRequired.length === 0, missingRequired, missingExpected, present };
}

/**
 * A compact section checklist for the G3 prompt / documentation, e.g.
 *   "1. Cover Page [required]\n2. Table of Contents [required]\n..."
 * Keeping the list in one place stops the prompt and the validator drifting.
 */
export function reportSectionChecklist(): string {
  return REPORT_SECTIONS.map((s, i) => `${i + 1}. ${s.title} [${s.level}]`).join("\n");
}
