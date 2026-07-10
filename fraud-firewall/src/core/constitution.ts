import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha512, stableStringify } from "./crypto.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface BrainDef {
  id: string;
  name: string;
  function: string;
  can_issue_verdicts: boolean;
}

export interface HardCodedConstants {
  version: string;
  final: boolean;
  profit_to_foundation_percent: number;
  ethics_halt_threshold: number;
  dead_man_switch_hours: number;
  brain_count: number;
  guardian_council_size: number;
  commission_percent: number;
  citizen_access_free: boolean;
  law_enforcement_access_free?: boolean;
}

export interface Constitution {
  version: string;
  title: string;
  status: string;
  priority: string;
  definitions?: Record<string, string>;
  prime_directives: Array<{ id: number; name: string; rule: string }>;
  triple_verification: {
    thesis: string;
    antithesis: string;
    synthesis: string;
    golden_rule?: string;
  };
  nine_brains?: { consensus_rule: string; brains: BrainDef[] };
  governance_brain_rules?: Array<{ name: string; rules: string[] }>;
  core_statutes?: Record<string, string>;
  non_weaponization?: {
    article: string;
    supremacy: string;
    core_principle: string;
    prohibited_uses: string[];
    permitted_uses: string[];
    enforcement: string[];
    note?: string;
  };
  licensing?: {
    free_for: string[];
    commercial_license_required: string[];
    principle: string;
    website?: string;
    email?: string;
  };
  hard_coded_constants?: HardCodedConstants;
  safeguards?: Array<{ name: string; implementation: string }>;
  constraints: {
    cannot_suppress_findings: boolean;
    must_report_all_contradictions: boolean;
    must_seal_evidence: boolean;
    auto_escalate_critical: boolean;
    verum_never_receives_evidence: boolean;
  };
  privacy_hard_rules: string[];
  ai_system_prompts: Record<string, string>;
  hash_standard: string;
  seal_protocol: string;
  blockchain: string;
}

/**
 * Compile-time constitutional constants (spec §2.2). These are the source of
 * truth; the JSON must match them or the Constitution is considered tampered.
 */
export const CONSTITUTION_CONSTANTS = Object.freeze({
  VERSION: "5.2.7",
  FINAL: true,
  PROFIT_TO_FOUNDATION: 99,
  ETHICS_HALT_THRESHOLD: 0.003,
  DEAD_MAN_SWITCH_HOURS: 72,
  BRAIN_COUNT: 9,
  GUARDIAN_COUNCIL_SIZE: 7,
  COMMISSION_PERCENT: 20,
  CITIZEN_ACCESS_FREE: true,
});

/** Fail fast if the loaded Constitution does not match the hard-coded law. */
export function assertConstitutionIntegrity(constitution: Constitution): void {
  const c = constitution.hard_coded_constants;
  const problems: string[] = [];
  if (constitution.version !== CONSTITUTION_CONSTANTS.VERSION) {
    problems.push(`version ${constitution.version} != ${CONSTITUTION_CONSTANTS.VERSION}`);
  }
  if (!c) {
    problems.push("hard_coded_constants missing");
  } else {
    if (c.commission_percent !== CONSTITUTION_CONSTANTS.COMMISSION_PERCENT) problems.push("commission_percent");
    if (c.brain_count !== CONSTITUTION_CONSTANTS.BRAIN_COUNT) problems.push("brain_count");
    if (c.ethics_halt_threshold !== CONSTITUTION_CONSTANTS.ETHICS_HALT_THRESHOLD) problems.push("ethics_halt_threshold");
    if (c.dead_man_switch_hours !== CONSTITUTION_CONSTANTS.DEAD_MAN_SWITCH_HOURS) problems.push("dead_man_switch_hours");
    if (c.guardian_council_size !== CONSTITUTION_CONSTANTS.GUARDIAN_COUNCIL_SIZE) problems.push("guardian_council_size");
    if (c.profit_to_foundation_percent !== CONSTITUTION_CONSTANTS.PROFIT_TO_FOUNDATION) problems.push("profit_to_foundation_percent");
    if (c.final !== CONSTITUTION_CONSTANTS.FINAL) problems.push("final");
  }
  const brains = constitution.nine_brains?.brains?.length ?? 0;
  if (brains !== CONSTITUTION_CONSTANTS.BRAIN_COUNT) {
    problems.push(`nine_brains has ${brains}, expected ${CONSTITUTION_CONSTANTS.BRAIN_COUNT}`);
  }
  if (problems.length) {
    throw new Error(`CONSTITUTION INTEGRITY FAILURE: ${problems.join(", ")}`);
  }
}

let cached: Constitution | null = null;

export function loadConstitution(version = "5.2.7"): Constitution {
  if (cached && cached.version === version) return cached;
  const path = join(__dirname, "..", "constitution", `v${version}.json`);
  cached = JSON.parse(readFileSync(path, "utf8")) as Constitution;
  return cached;
}

/** Machine-readable ruleset embedded into every seal. */
export function constitutionRuleset(constitution: Constitution): {
  version: string;
  hash: string;
  rules: string[];
  constraints: Constitution["constraints"];
  privacy_hard_rules: string[];
} {
  const rules = constitution.prime_directives.map(
    (d) => `${d.id}. ${d.name}: ${d.rule}`,
  );
  const payload = {
    version: constitution.version,
    rules,
    constraints: constitution.constraints,
    privacy_hard_rules: constitution.privacy_hard_rules,
    triple_verification: constitution.triple_verification,
    // Embed the full machine-readable law into the seal (spec §2.1).
    nine_brains: constitution.nine_brains,
    non_weaponization: constitution.non_weaponization,
    hard_coded_constants: constitution.hard_coded_constants,
    core_statutes: constitution.core_statutes,
  };
  return {
    version: constitution.version,
    hash: sha512(stableStringify(payload)),
    rules,
    constraints: constitution.constraints,
    privacy_hard_rules: constitution.privacy_hard_rules,
  };
}

export function systemPromptFor(
  model: keyof Constitution["ai_system_prompts"] | string,
  constitution: Constitution = loadConstitution(),
): string {
  const base =
    constitution.ai_system_prompts[model] ??
    "You are Verum Omnis. Report truth. Never suppress findings.";
  const ruleset = constitutionRuleset(constitution);
  return [
    base,
    "",
    `CONSTITUTION v${constitution.version} — BINDING`,
    constitution.priority,
    ...ruleset.rules.map((r) => `- ${r}`),
    "",
    "PRIVACY HARD RULES:",
    ...constitution.privacy_hard_rules.map((r) => `- ${r}`),
    "",
    "CONSTRAINTS:",
    `- cannot_suppress_findings=${constitution.constraints.cannot_suppress_findings}`,
    `- must_report_all_contradictions=${constitution.constraints.must_report_all_contradictions}`,
    `- must_seal_evidence=${constitution.constraints.must_seal_evidence}`,
    `- auto_escalate_critical=${constitution.constraints.auto_escalate_critical}`,
    `- verum_never_receives_evidence=${constitution.constraints.verum_never_receives_evidence}`,
  ].join("\n");
}
