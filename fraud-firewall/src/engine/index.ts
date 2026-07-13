// CONSTITUTION: v5.2.7 — Verum Contradiction Engine v5.2.9
// Ported from Python verum_contradiction_engine_v529.py Section 5
// Master orchestrator with dual interface (files vs texts)

import { resetCounter, detectAll } from "./detector.js";
import { extractFromFile, extractFromText, extractClaims, hashCorpus } from "./extractor.js";
import { verifyTriple, buildProfiles, generateReport } from "./verifier.js";
import { reportCalibration } from "./calibrator.js";
import { getCaseConfig } from "./cases.js";
import type { EvidenceAtom, Claim, ForensicReport, CaseConfig } from "./types.js";

export * from "./enums.js";
export * from "./types.js";
export * from "./calibrator.js";
export * from "./semantic.js";
export * from "./detector.js";
export * from "./cases.js";
export * from "./extractor.js";
export * from "./verifier.js";

export interface EngineOptions {
  caseId?: string;
  caseName?: string;
  injectedTimestamp?: number; // CONSTITUTION: injected, never Date.now()
}

/** Master contradiction engine — dual interface for Python parity */
export class VerumContradictionEngine {
  readonly caseId: string;
  private caseConfig: CaseConfig;
  private injectedTimestamp: number | null;

  constructor(options: EngineOptions = {}) {
    this.caseId = options.caseId ?? "VO-CASE-001";
    this.injectedTimestamp = options.injectedTimestamp ?? null;
    this.caseConfig = getCaseConfig(options.caseName ?? "");
    resetCounter();
  }

  /**
   * Process evidence from FILE PATHS.
   * PRIMARY interface for Node.js/CLI usage.
   * Reads files from disk, extracts atoms, runs full pipeline.
   */
  processFromFiles(filePaths: string[]): ForensicReport {
    const allAtoms: EvidenceAtom[] = [];
    for (const fp of filePaths) {
      const atoms = extractFromFile(fp, this.injectedTimestamp);
      allAtoms.push(...atoms);
    }
    return this._runPipeline(allAtoms);
  }

  /**
   * Process evidence from TEXT CONTENT.
   * PRIMARY interface for TypeScript/Android integration.
   * Creates atoms directly from text — no file I/O.
   * Matches Python process_from_texts() exactly.
   */
  processFromTexts(texts: string[], sourceNames?: string[]): ForensicReport {
    const names = sourceNames ?? texts.map((_, i) => `input_${i}`);
    const allAtoms: EvidenceAtom[] = [];
    for (let i = 0; i < texts.length; i++) {
      const atoms = extractFromText(texts[i], names[i], this.injectedTimestamp);
      allAtoms.push(...atoms);
    }
    return this._runPipeline(allAtoms);
  }

  /** Set case configuration by name ("allfuels" or "greensky") */
  setCase(caseName: string): void {
    this.caseConfig = getCaseConfig(caseName);
  }

  /** Shared pipeline: atoms -> claims -> contradictions -> verification -> report */
  private _runPipeline(allAtoms: EvidenceAtom[]): ForensicReport {
    // Step 1: Extract claims from atoms
    const claims: Claim[] = extractClaims(allAtoms, this.caseConfig);

    // Step 2: Detect all contradictions (10 detectors)
    const contradictions = detectAll(claims);

    // Step 3: Triple verification (Thesis/Antithesis/Synthesis)
    const tv = verifyTriple(claims, contradictions);

    // Step 4: Build actor profiles
    const profiles = buildProfiles(claims, contradictions);

    // Step 5: Hash corpus for blockchain anchoring
    const corpusHash = hashCorpus(allAtoms.map((a) => a.content));

    // Step 6: Assemble report
    return {
      caseId: this.caseId,
      contradictions,
      actorProfiles: profiles,
      tripleVerification: tv,
      corpusHash,
      confidenceCalibration: reportCalibration(),
      generatedAt: this.injectedTimestamp ?? 0,
    };
  }
}

// CONVENIENCE: Single-call API for simple use cases

/**
 * One-shot contradiction detection from text strings.
 * Returns a ForensicReport with all findings.
 */
export function detectContradictions(
  texts: string[],
  options: EngineOptions = {},
): ForensicReport {
  const engine = new VerumContradictionEngine(options);
  return engine.processFromTexts(texts);
}

/**
 * One-shot contradiction detection from file paths.
 * Returns a ForensicReport with all findings.
 */
export function detectContradictionsFromFiles(
  filePaths: string[],
  options: EngineOptions = {},
): ForensicReport {
  const engine = new VerumContradictionEngine(options);
  return engine.processFromFiles(filePaths);
}

/**
 * Quick report generation from an existing ForensicReport.
 */
export function formatReport(
  report: ForensicReport,
  format: "txt" | "json" | "markdown" = "txt",
): string {
  return generateReport(report, format);
}
