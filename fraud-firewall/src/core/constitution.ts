import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha512, stableStringify } from "./crypto.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Constitution {
  version: string;
  title: string;
  status: string;
  priority: string;
  prime_directives: Array<{ id: number; name: string; rule: string }>;
  triple_verification: {
    thesis: string;
    antithesis: string;
    synthesis: string;
  };
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
