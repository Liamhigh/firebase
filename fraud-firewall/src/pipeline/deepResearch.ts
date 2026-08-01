// CONSTITUTION: v6.0 Final — Deep Research (case-files-as-context) v1.0.0
// Spec: REPORT_FORMAT_SPECIFICATION.md §18 | Prompt: G3_SYSTEM_PROMPT.md
//
// A user (private citizen or law enforcement) selects sealed case files from the
// Vault and asks Verum Omnis a research question across them. The deterministic
// engine's findings remain the factual spine; external corroboration is added
// under the §17 rules. This module orchestrates that, enforcing two invariants:
//
//   * Only SEALED files may be used as context (their SHA-512 fixes the content).
//   * Every downstream rule of externalCorroboration still applies (entitlement,
//     signal-or-silence, corroboration-only, sanitisation).

import { runScanWithFindings } from "./g3HybridPipeline.js";
import type { FindingsJson } from "./findingsJsonEmitter.js";
import {
  gatherExternalCorroboration,
  type CorroborationEntitlement,
  type CorroborationFetcher,
  type CorroborationResult,
} from "./externalCorroboration.js";

/** One file offered as research context. `sealed` MUST be true to be used. */
export interface ContextFile {
  caseId?: string;
  name: string;
  text: string;
  sealed: boolean;
}

export interface DeepResearchOptions {
  entitlement: CorroborationEntitlement;
  /** Injected fetcher; omit to run with no external corroboration. */
  fetcher?: CorroborationFetcher;
  injectedTimestamp?: number;
  now?: () => string;
}

export interface DeepResearchResult {
  question: string;
  /** Every file used as context, by name — printed as the report Scope line. */
  scope: string[];
  findings: FindingsJson;
  corroboration: CorroborationResult | null;
}

export class UnsealedContextError extends Error {
  constructor(public readonly unsealed: string[]) {
    super(
      "Deep research context must be sealed files only. Unsealed: " +
        unsealed.join(", ") +
        ". Seal them first — their SHA-512 fingerprint is what makes them usable as context.",
    );
    this.name = "UnsealedContextError";
  }
}

/**
 * Run a deep-research pass over selected sealed files. Throws
 * UnsealedContextError if any supplied file is not sealed.
 */
export async function runDeepResearch(
  files: ContextFile[],
  question: string,
  opts: DeepResearchOptions,
): Promise<DeepResearchResult> {
  if (!files.length) {
    throw new Error("Deep research needs at least one sealed file as context.");
  }
  const unsealed = files.filter((f) => !f.sealed).map((f) => f.name);
  if (unsealed.length) throw new UnsealedContextError(unsealed);

  const scope = files.map((f) => f.name);
  const { findings } = runScanWithFindings(
    files.map((f) => f.text),
    {
      caseName: `Deep research: ${question}`.slice(0, 120),
      caseIds: files.map((f, i) => f.caseId ?? `CTX-${i + 1}`),
      injectedTimestamp: opts.injectedTimestamp,
      sourceBundle: scope.join(" + "),
    },
  );

  let corroboration: CorroborationResult | null = null;
  if (opts.fetcher) {
    corroboration = await gatherExternalCorroboration(findings, {
      entitlement: opts.entitlement,
      fetcher: opts.fetcher,
      now: opts.now,
    });
  }

  return { question, scope, findings, corroboration };
}
