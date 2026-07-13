// CONSTITUTION: v5.2.7 — Claim Extractor & File Handler
// Ported from Python verum_contradiction_engine_v529.py
// Extracts evidence atoms from files/text, then converts to claims

import { createHash } from "crypto";
import { FileType, StatementType } from "./enums.js";
import type { EvidenceAtom, Claim } from "./types.js";
import type { CaseConfig } from "./cases.js";
import { readFileSync } from "fs";

/** Extract evidence atoms from text content (no file I/O) */
export function extractFromText(
  text: string,
  sourceName: string,
  injectedTimestamp: number | null = null,
): EvidenceAtom[] {
  const atoms: EvidenceAtom[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    atoms.push({
      artifactHash: createHash("sha512").update(line).digest("hex"),
      pageNumber: 0,
      lineNumber: i + 1,
      timestamp: injectedTimestamp,
      sourcePath: sourceName,
      content: line,
      fileType: FileType.TXT,
    });
  }
  return atoms;
}

/** Extract evidence atoms from a file path */
export function extractFromFile(
  filePath: string,
  injectedTimestamp: number | null = null,
): EvidenceAtom[] {
  const content = readFileSync(filePath, "utf-8");
  return extractFromText(content, filePath, injectedTimestamp);
}

/** Hash a corpus of evidence texts for blockchain anchoring */
export function hashCorpus(texts: string[]): string {
  const h = createHash("sha512");
  for (const t of texts) h.update(t);
  return h.digest("hex");
}

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  GOODWILL_VALUE: ["goodwill", "brand", "franchise", "entrenched"],
  CONTRACT_VALIDITY: ["contract", "agreement", "binding", "countersign", "lease"],
  SIGNATURE_STATUS: ["signature", "signed", "blank", "unsigned"],
  SECTION_12B: ["section 12B", "arbitration", "referral", "Business Zone"],
  COMPENSATION: ["fee", "payment", "rent", "compensation", "deposit"],
  PERJURY: ["perjury", "Constitutional Court", "sworn", "CCT", "affidavit"],
  COERCION: ["coerce", "threat", "intimidate", "suppress", "silence"],
  RACKETEERING: ["pattern", "systematic", "multiple victims", "scheme"],
};

const ACTOR_PATTERNS = [
  /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, // Full names
  /\b(I|we|our company)\b/gi, // First person
];

function detectSubject(text: string): string {
  const lower = text.toLowerCase();
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) return subject;
  }
  return "OTHER";
}

function detectActor(text: string): string {
  for (const pattern of ACTOR_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) return matches[0];
  }
  return "UNKNOWN";
}

function detectStatementType(text: string): StatementType {
  const lower = text.toLowerCase();
  if (lower.includes("sworn") || lower.includes("affidavit") || lower.includes("under oath"))
    return StatementType.SWORN_STATEMENT;
  if (lower.includes("admit") || lower.includes("confess")) return StatementType.ADMISSION;
  if (lower.includes("deny") || lower.includes("reject") || lower.includes("false"))
    return StatementType.DENIAL;
  if (lower.includes("demand") || lower.includes("require")) return StatementType.DEMAND;
  if (lower.includes("promise") || lower.includes("guarantee")) return StatementType.PROMISE;
  if (lower.includes("threat") || lower.includes("intimidate")) return StatementType.THREAT;
  if (lower.includes("clause") || lower.includes("section") || lower.includes("agreement"))
    return StatementType.CONTRACT_CLAUSE;
  if (lower.includes("court") || lower.includes("CCT") || lower.includes("judgment"))
    return StatementType.JUDICIAL_RECORD;
  return StatementType.CLAIM;
}

/** Convert EvidenceAtoms to Claims with subject/actor/predicate detection */
export function extractClaims(atoms: EvidenceAtom[], caseConfig?: CaseConfig): Claim[] {
  const claims: Claim[] = [];
  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    const subject = detectSubject(atom.content);
    const actor = detectActor(atom.content);
    const sourceType = detectStatementType(atom.content);

    // Use case config for enhanced entity detection if available
    let enhancedSubject = subject;
    let enhancedActor = actor;
    if (caseConfig) {
      const lower = atom.content.toLowerCase();
      for (const [subj, keywords] of Object.entries(caseConfig.legalSubjects)) {
        if (keywords.some((k) => lower.includes(k.toLowerCase()))) {
          enhancedSubject = subj.toUpperCase().replace(/\s+/g, "_");
        }
      }
      for (const entity of caseConfig.entityKeywords) {
        if (lower.includes(entity.toLowerCase())) {
          enhancedActor = entity;
        }
      }
    }

    claims.push({
      id: `claim-${i + 1}`,
      subject: enhancedSubject,
      predicate: "states",
      value: atom.content,
      actor: enhancedActor,
      date: atom.timestamp,
      sourceType,
      sourceLocation: `${atom.sourcePath} p.${atom.pageNumber} line ${atom.lineNumber}`,
      documentId: atom.sourcePath,
      sha512Hash: atom.artifactHash,
      pageNumber: atom.pageNumber,
      context: "",
    });
  }
  return claims;
}
