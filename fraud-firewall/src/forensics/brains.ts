import type {
  BrainFinding,
  BrainSource,
  Contradiction,
  EvidenceAtom,
  NineBrainConsensus,
  Offence,
} from "../core/types.js";
import { sha512, shortCode } from "../core/crypto.js";

/**
 * Additional deterministic Nine-Brain analysis modules (spec §1.3/§4). The
 * contradiction engine already covers B1 (Contradiction), B5 (Timeline), and
 * B6 (Financial); offences cover B7 (Legal Mapping). This module adds:
 *   B2 Document Forensics — tamper/forgery indicators
 *   B3 Communications     — deletions / gaps in threads
 *   B4 Linguistics        — evasion / gaslighting patterns
 * All offline and deterministic.
 */

interface Detector {
  brain: BrainSource;
  category: string;
  severity: BrainFinding["severity"];
  confidence: BrainFinding["confidence"];
  patterns: RegExp[];
}

const DETECTORS: Detector[] = [
  {
    brain: "B4-Linguistics",
    category: "evasion/gaslighting",
    severity: "HIGH",
    confidence: "HIGH",
    patterns: [
      /\boverreacting\b/i,
      /\bimagining (?:things|it)\b/i,
      /\bnever happened\b/i,
      /\bmaking (?:it|that|this) up\b/i,
      /\ball in (?:your|his|her|my) head\b/i,
      /\bgaslighting\b/i,
      /\btoo sensitive\b/i,
      /\bbeing (?:dramatic|paranoid|difficult)\b/i,
      /\bcalm down\b/i,
      /i never said that/i,
      /(?:mentally )?(?:broken|unstable)\b/i,
    ],
  },
  {
    brain: "B3-Communications",
    category: "communication gap/deletion",
    severity: "MODERATE",
    confidence: "MODERATE",
    patterns: [
      /\[deleted\]/i,
      /message (?:was )?(?:deleted|unavailable|recalled|removed)/i,
      /this message was removed/i,
      /no longer available/i,
      /missing (?:message|email|attachment|entry)/i,
      /unsent (?:this )?message/i,
    ],
  },
  {
    brain: "B2-DocumentForensics",
    category: "tamper/forgery indicator",
    severity: "HIGH",
    confidence: "HIGH",
    patterns: [
      /\b(?:tampered|forged|forgery|falsified)\b/i,
      /altered (?:copy|version|document|screenshot)/i,
      /metadata (?:removed|stripped|wiped)/i,
      /\bsteganograph/i,
      /edited (?:screenshot|document|image)/i,
      /cropped (?:to (?:hide|conceal)|selectively)/i,
    ],
  },
];

/** Run the additional Nine-Brain detectors over the evidence atoms. */
export function runBrainAnalysis(
  atoms: EvidenceAtom[],
  now = new Date().toISOString(),
): BrainFinding[] {
  const out: BrainFinding[] = [];
  const seen = new Set<string>();
  for (const atom of atoms) {
    for (const det of DETECTORS) {
      if (det.patterns.some((re) => re.test(atom.content))) {
        const key = `${det.brain}|${atom.sha512}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          finding_id: `BF-${shortCode(sha512(key), 10)}`,
          brain_source: det.brain,
          category: det.category,
          severity: det.severity,
          confidence: det.confidence,
          description: atom.content,
          evidence_id: atom.evidence_id,
          page: atom.page_number,
          line: Number(atom.line_range.split("-")[0]) || 0,
          sha512: atom.sha512,
        });
      }
    }
  }
  out.sort((a, b) => a.finding_id.localeCompare(b.finding_id));
  return out;
}

/**
 * Nine-Brain consensus (White Paper §4): a case conclusion is accepted only
 * when at least three independent brains have produced corroborating findings.
 */
export function computeConsensus(
  contradictions: Contradiction[],
  brainFindings: BrainFinding[],
  offences: Offence[],
  threshold = 3,
): NineBrainConsensus {
  const active = new Set<string>();
  for (const c of contradictions) active.add(c.brain_source);
  for (const f of brainFindings) active.add(f.brain_source);
  // Offences with a legal basis engage the Legal Mapping brain (B7).
  if (offences.some((o) => o.legal_basis.length > 0)) active.add("B7-LegalMapping");

  const count = active.size;
  const meets_threshold = count >= threshold;
  const anyEvidence = count > 0;
  return {
    active_brains: [...active].sort(),
    count,
    threshold,
    meets_threshold,
    verdict: meets_threshold ? "CONFIRMED" : anyEvidence ? "INSUFFICIENT" : "INDETERMINATE",
  };
}
