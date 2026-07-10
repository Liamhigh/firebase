import type { Entity, EvidenceAtom } from "../core/types.js";

/**
 * Deterministic, heuristic entity extraction (parties of interest). Not a full
 * NER model — it finds recurring proper-name people and organisations so the
 * report can anchor each contradiction to a respondent and drive case lookups.
 */

// Capitalised phrases that are NOT personal names (geography, roles, structure).
const NON_NAME = new Set(
  [
    "Hong Kong", "South Africa", "Ras Al", "Al Khaimah", "General Manager",
    "Executive Summary", "Legal Relevance", "Legal Grounds", "Legal Claims",
    "Annual General", "General Meeting", "Memorandum", "Association",
    "Shareholders Agreement", "Sealife Hong", "Confidential", "Economic Zone",
    "Commercial Register", "Court", "Key Findings", "Next Steps", "Order Details",
    "Registrar", "Companies", "Marius Admission", "Section", "Forensic Report",
    "Client Order", "Group Meeting", "Resolution Meeting", "Meeting Invitation",
  ].map((s) => s.toLowerCase()),
);

const ORG_SUFFIX =
  /\b([A-Z][A-Za-z&'’.-]+(?:\s+[A-Z][A-Za-z&'’.-]+){0,3}\s+(?:Co\.?|Ltd\.?|LLC|FZ-?LLC|Pty\.?|Inc\.?|Corporation|Corp\.?|Authority|Bank|Export|Exports|Ornamentals|Aquaculture|Holdings|Group))\b/g;

const PERSON = /\b([A-Z][a-z]{1,}(?:\s+[A-Z][a-z’'-]{1,}){1,3})\b/g;

// Tokens that mark a capitalised phrase as a legal/business concept, NOT a
// personal name. A candidate containing any of these is rejected as a person.
// Prevents dense contracts from mis-attributing contradictions to phantom
// "people" like "Franchised Business" or "Franchise Agreement".
const NON_NAME_TOKENS = new Set([
  "business", "businesses", "agreement", "agreements", "manual", "product",
  "products", "interest", "fuel", "fuels", "station", "stations", "terms",
  "rental", "rentals", "premises", "equipment", "franchise", "franchised",
  "franchisor", "franchisee", "lessor", "lessee", "court", "act", "report",
  "bank", "ltd", "company", "companies", "project", "projects", "petroleum",
  "energy", "service", "lease", "tripartite", "particular", "annexure",
  "annexures", "forecourt", "outlet", "outlets", "system", "holdings", "group",
  "authority", "register", "registrar", "section", "schedule", "clause",
  "appendix", "motor", "properties", "investments", "committee", "board",
  "department", "trust", "estate", "protocol", "standard", "standards",
]);

function looksLikeConcept(name: string): boolean {
  return name
    .split(/\s+/)
    .some((tok) => NON_NAME_TOKENS.has(tok.replace(/[^a-z]/gi, "").toLowerCase()));
}

// Sentence-leading / connector words that get glued to a following name.
const LEADING_STOP = new Set([
  "later", "the", "also", "on", "in", "this", "that", "when", "he", "she",
  "they", "dear", "mr", "mrs", "ms", "dr", "from", "to", "subject", "re",
  "however", "therefore", "meanwhile", "subsequently", "further", "and", "but",
  "signed", "quoted", "section", "part", "date", "event", "title", "email",
  "confidential", "page", "witness", "respondent", "complainant", "submitted",
]);

/** Trim leading connector/stopwords from a capitalised name candidate. */
function trimName(raw: string): string | null {
  let tokens = raw.split(/\s+/);
  while (tokens.length && LEADING_STOP.has(tokens[0].toLowerCase())) tokens = tokens.slice(1);
  // Keep at most a First Last (Middle) — drop a trailing connector too.
  while (tokens.length && LEADING_STOP.has(tokens[tokens.length - 1].toLowerCase())) {
    tokens = tokens.slice(0, -1);
  }
  if (tokens.length < 2 || tokens.length > 3) return tokens.length === 2 ? tokens.join(" ") : null;
  return tokens.join(" ");
}

interface Acc {
  name: string;
  type: "person" | "organization";
  mentions: number;
  first_seen: { evidence_id: string; page: number; line: number };
}

function keyOf(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function extractEntities(atoms: EvidenceAtom[], minMentions = 2): Entity[] {
  const acc = new Map<string, Acc>();
  const bump = (
    name: string,
    type: "person" | "organization",
    atom: EvidenceAtom,
  ): void => {
    const cleaned = name.replace(/\s+/g, " ").trim();
    const k = `${type}:${keyOf(cleaned)}`;
    const existing = acc.get(k);
    if (existing) {
      existing.mentions += 1;
    } else {
      acc.set(k, {
        name: cleaned,
        type,
        mentions: 1,
        first_seen: {
          evidence_id: atom.evidence_id,
          page: atom.page_number,
          line: Number(atom.line_range.split("-")[0]) || 0,
        },
      });
    }
  };

  for (const atom of atoms) {
    const text = atom.content;
    // Organizations first (so their words aren't double-counted as people).
    const orgNames = new Set<string>();
    for (const m of text.matchAll(ORG_SUFFIX)) {
      const name = m[1].trim();
      orgNames.add(keyOf(name));
      bump(name, "organization", atom);
    }
    for (const m of text.matchAll(PERSON)) {
      const name = trimName(m[1].trim());
      if (!name) continue;
      const k = keyOf(name);
      if (NON_NAME.has(k)) continue;
      if (looksLikeConcept(name)) continue;
      if ([...orgNames].some((o) => o.includes(k) || k.includes(o))) continue;
      bump(name, "person", atom);
    }
  }

  return [...acc.values()]
    // Organisations carry a legal suffix (Co./LLC/Ltd/…) so one mention is
    // high-confidence; people need repetition to avoid false positives.
    .filter((e) => (e.type === "organization" ? e.mentions >= 1 : e.mentions >= minMentions))
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name))
    .slice(0, 40)
    .map((e) => ({
      name: e.name,
      type: e.type,
      mentions: e.mentions,
      first_seen: e.first_seen,
    }));
}

/** Pick the most likely respondent (person) referenced by two claim texts. */
export function respondentFor(
  people: Entity[],
  claimA: string,
  claimB: string,
): string | undefined {
  const hay = `${claimA}\n${claimB}`.toLowerCase();
  const present = people
    .filter((p) => p.type === "person" && hay.includes(p.name.toLowerCase()))
    .sort((a, b) => b.mentions - a.mentions);
  return present[0]?.name;
}
