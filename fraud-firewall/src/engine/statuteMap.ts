// Verum Omnis v6 — local-statute enrichment layer (TypeScript)
// Status: RATIFIED — BINDING (founder directive, 2026-07-14)
// Spec: CANDIDATE_CONTRADICTION_TYPES_v6.md
//
// Forensic chain (ratified):
//   extraction -> contradiction -> PERSON -> PAGE -> LOCAL LAW (statute)
//
// Adds the final anchor — the LOCAL STATUTE / LAW a contradiction engages — to
// each legal hypothesis.  Pure read/transform over the findings-JSON contract;
// the sealed engine is never modified.  Citations are hypotheses, not advice.

export type Jurisdiction = "ZA" | "GENERIC";

export const DEFAULT_JURISDICTION: Jurisdiction = "ZA";

export const TYPE_SWORN_VS_SWORN = "SWORN_VS_SWORN";
export const TYPE_DEVICE_ATTRIBUTION_CHAIN = "DEVICE_ATTRIBUTION_CHAIN";
export const TYPE_CRIMINAL_CHARGE_AS_LEVERAGE = "CRIMINAL_CHARGE_AS_LEVERAGE";

export interface StatuteCitation {
  instrument: string; // short title of the Act / source of law
  citation: string; // pinpoint: section / common-law label
  note: string; // one-line applicability note
  statutory: boolean; // false => common-law / case-law anchor
}

function cite(
  instrument: string,
  citation: string,
  note: string,
  statutory = true,
): StatuteCitation {
  return { instrument, citation, note, statutory };
}

// --- ZA (South Africa) statute map -----------------------------------------
const ZA: Record<string, StatuteCitation[]> = {
  [TYPE_SWORN_VS_SWORN]: [
    cite(
      "Justices of the Peace and Commissioners of Oaths Act 16 of 1963",
      "s 9",
      "False statement in an affidavit/affirmation/solemn declaration, made knowing it to be false; liable to perjury penalties.",
    ),
    cite(
      "Perjury (common law)",
      "common-law offence",
      "Wilfully making a false statement under oath; up to 10 years imprisonment.",
      false,
    ),
    cite(
      "Criminal Procedure Act 51 of 1977",
      "s 319",
      "Admissibility/proof of a witness's previous inconsistent statement.",
    ),
  ],
  [TYPE_DEVICE_ATTRIBUTION_CHAIN]: [
    cite("Cybercrimes Act 19 of 2020", "s 2", "Unlawful and intentional access to a computer system or data."),
    cite("Cybercrimes Act 19 of 2020", "s 3", "Unlawful and intentional interception of data."),
    cite("Cybercrimes Act 19 of 2020", "s 5", "Unlawful interference with data or a computer program."),
    cite(
      "Cybercrimes Act 19 of 2020",
      "s 11",
      "Aggravated offence where the target is a restricted computer system (financial institution / organ of state).",
    ),
    cite(
      "Regulation of Interception of Communications Act 70 of 2002 (RICA)",
      "s 2",
      "Prohibition on interception of communications without authority.",
    ),
    cite(
      "Electronic Communications and Transactions Act 25 of 2002 (ECTA)",
      "s 86",
      "Legacy unauthorised access/interception provision (pre-Dec-2021 conduct).",
    ),
  ],
  [TYPE_CRIMINAL_CHARGE_AS_LEVERAGE]: [
    cite("Cybercrimes Act 19 of 2020", "s 10", "Cyber extortion where the threat/pressure is applied via data message."),
    cite(
      "Extortion (common law)",
      "common-law offence",
      "Unlawfully and intentionally applying pressure to induce a person to submit or hand over an advantage.",
      false,
    ),
    cite("Intimidation Act 72 of 1982", "s 1", "Intimidating conduct intended to compel a course of action."),
    cite(
      "Defeating or obstructing the course of justice (common law)",
      "common-law offence",
      "Abusing a criminal charge/report to derail a lawful process.",
      false,
    ),
    cite(
      "Prevention and Combating of Corrupt Activities Act 12 of 2004 (PRECCA)",
      "ss 3-7",
      "Applies where the leverage involves an offer/demand of a gratification.",
    ),
  ],
  // Existing engine types — close the local-law anchor where a confident map exists.
  CONTRADICTORY_STATEMENTS: [
    cite("Criminal Procedure Act 51 of 1977", "s 319", "Previous inconsistent statement by a witness."),
  ],
  SWORN_VS_UNSIGNED: [
    cite("Justices of the Peace and Commissioners of Oaths Act 16 of 1963", "s 9", "False statement in a sworn affidavit."),
  ],
  DOCUMENT_ALTERATION: [
    cite("Cybercrimes Act 19 of 2020", "s 9", "Cyber forgery and uttering."),
    cite("Forgery and uttering (common law)", "common-law offence", "Unlawful falsification of a document with intent to defraud.", false),
  ],
  CONTEMPT_OF_COURT_ORDER: [
    cite("Contempt of court (common law)", "common-law offence", "Wilful disobedience of a court order (e.g. judgment H208/25).", false),
  ],
  BREACH_OF_COURT_ORDER: [
    cite("Contempt of court (common law)", "common-law offence", "Wilful disobedience of a court order (e.g. judgment H208/25).", false),
  ],
};

// --- GENERIC (common-law) fallback -----------------------------------------
const GENERIC: Record<string, StatuteCitation[]> = {
  [TYPE_SWORN_VS_SWORN]: [
    cite(
      "Perjury (common law)",
      "common-law offence",
      "Two mutually exclusive sworn statements on one material fact; one deponent has sworn falsely. Confirm the local perjury statute.",
      false,
    ),
  ],
  [TYPE_DEVICE_ATTRIBUTION_CHAIN]: [
    cite(
      "Computer-misuse / unlawful-access legislation",
      "jurisdiction-specific",
      "Unauthorised access to or interception of data is an offence in virtually all jurisdictions; cite the local computer-misuse act.",
    ),
  ],
  [TYPE_CRIMINAL_CHARGE_AS_LEVERAGE]: [
    cite(
      "Extortion / blackmail (common law)",
      "common-law offence",
      "Applying pressure (including a threatened criminal charge) to extract an advantage. Confirm the local extortion/blackmail law.",
      false,
    ),
    cite(
      "Perverting / defeating the course of justice (common law)",
      "common-law offence",
      "Abusing a criminal process to obstruct a lawful one.",
      false,
    ),
  ],
};

const JURISDICTIONS: Record<Jurisdiction, Record<string, StatuteCitation[]>> = {
  ZA,
  GENERIC,
};

/** Resolve a user-supplied jurisdiction code to a known map key. */
export function normaliseJurisdiction(code?: string | null): Jurisdiction {
  if (!code) return DEFAULT_JURISDICTION;
  const c = code.trim().toUpperCase();
  if (c === "ZA" || c === "GENERIC") return c as Jurisdiction;
  if (["RSA", "SOUTH AFRICA", "ZAF", "SA"].includes(c)) return "ZA";
  return "GENERIC";
}

/** Ordered statute citations for a contradiction type, with GENERIC fallback. */
export function statutesForType(
  contradictionType: string,
  jurisdiction?: string | null,
): StatuteCitation[] {
  const j = normaliseJurisdiction(jurisdiction);
  const primary = JURISDICTIONS[j];
  const cites = primary[contradictionType];
  if (cites && cites.length) return cites.slice();
  if (j !== "GENERIC") {
    const fallback = GENERIC[contradictionType];
    if (fallback && fallback.length) return fallback.slice();
  }
  return [];
}

const JURISDICTION_NOTE: Record<Jurisdiction, string> = {
  ZA: "Local law: Republic of South Africa. Statute citations are hypotheses for legal review, not legal advice.",
  GENERIC: "Local law: common-law baseline. Confirm the equivalent statute in the governing jurisdiction.",
};

/**
 * Attach `local_statutes` + `jurisdiction` to one legal hypothesis object.
 * Returns a NEW object (does not mutate the caller's).  null in => null out.
 */
export function enrichHypothesis(
  hypothesis: Record<string, unknown> | null | undefined,
  contradictionType: string,
  jurisdiction?: string | null,
): Record<string, unknown> | null {
  if (hypothesis == null) return null;
  const j = normaliseJurisdiction(jurisdiction);
  const cites = statutesForType(contradictionType, j);
  return {
    ...hypothesis,
    jurisdiction: j,
    local_statutes: cites.map((c) => ({ ...c })),
    is_hypothesis: hypothesis.is_hypothesis ?? true,
    requires_human_review: hypothesis.requires_human_review ?? true,
    jurisdictional_note: JURISDICTION_NOTE[j],
  };
}

/**
 * Enrich every contradiction record in a findings document, in place.
 * Records without a legal_hypothesis get one synthesised so the local-law
 * anchor is never dropped.
 */
export function enrichLegalHypotheses(
  findings: Record<string, any>,
  jurisdiction?: string | null,
): Record<string, any> {
  const j = normaliseJurisdiction(jurisdiction);
  let count = 0;
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (item && typeof item === "object" && "type" in (item as any)) {
        const rec = item as Record<string, any>;
        const ctype = rec.type as string;
        if (!ctype) continue;
        const hyp =
          rec.legal_hypothesis ??
          {
            suggested_offence: null,
            legal_basis: rec.conflict_description ?? "",
            is_hypothesis: true,
            requires_human_review: true,
          };
        rec.legal_hypothesis = enrichHypothesis(hyp, ctype, j);
        rec.jurisdiction = j;
        count++;
      }
    }
  };
  for (const value of Object.values(findings)) visit(value);
  findings.statute_enrichment = {
    jurisdiction: j,
    records_enriched: count,
    note: JURISDICTION_NOTE[j],
  };
  return findings;
}
