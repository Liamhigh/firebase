// CONSTITUTION: v6.0 Final — Verum Contradiction Engine v5.3.1c
// Seal: VO-CE-v531c-DIGSIM-20260713
// 43 types | 37 detectors | 17 serial patterns | 7 cases | B1-B11
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

/** Master contradiction engine — dual interface */
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

  /** Set case configuration by name ("allfuels", "greensky", "southbridge", "digsim", etc.) */
  setCase(caseName: string): void {
    this.caseConfig = getCaseConfig(caseName);
  }

  /** Process evidence from FILE PATHS. For CLI/background. */
  processFromFiles(filePaths: string[]): ForensicReport {
    const allAtoms: EvidenceAtom[] = [];
    for (const fp of filePaths) {
      try {
        const atoms = extractFromFile(fp, this.injectedTimestamp);
        allAtoms.push(...atoms);
      } catch (e) {
        // File read failed — log and continue
      }
    }
    return this._runPipeline(allAtoms);
  }

  /** Process evidence from TEXT CONTENT. PRIMARY for Android/UI. */
  processFromTexts(texts: string[], sourceNames?: string[]): ForensicReport {
    const names = sourceNames ?? texts.map((_, i) => `input_${i}`);
    const allAtoms: EvidenceAtom[] = [];
    for (let i = 0; i < texts.length; i++) {
      const atoms = extractFromText(texts[i], names[i], this.injectedTimestamp);
      allAtoms.push(...atoms);
    }
    return this._runPipeline(allAtoms);
  }

  /** Shared pipeline: atoms -> claims -> 16 detectors -> verification -> report */
  private _runPipeline(allAtoms: EvidenceAtom[]): ForensicReport {
    const claims: Claim[] = extractClaims(allAtoms, this.caseConfig);
    const contradictions = detectAll(claims);
    const tv = verifyTriple(claims, contradictions);
    val profiles = buildProfiles(claims, contradictions);
    val corpusHash = hashCorpus(allAtoms.map { it.content });
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

// Convenience functions
export function detectContradictions(
  texts: string[], options: EngineOptions = {},
): ForensicReport {
  return new VerumContradictionEngine(options).processFromTexts(texts);
}

export function detectContradictionsFromFiles(
  filePaths: string[], options: EngineOptions = {},
): ForensicReport {
  return new VerumContradictionEngine(options).processFromFiles(filePaths);
}

export function formatReport(
  report: ForensicReport, format: "txt" | "json" | "markdown" = "txt",
): string {
  return generateReport(report, format);
}
