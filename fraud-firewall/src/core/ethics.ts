import type { FirewallConfig } from "./types.js";
import { CONSTITUTION_CONSTANTS } from "./constitution.js";
import { appendJsonl } from "../storage/vault.js";
import { join } from "node:path";
import { sha512 } from "./crypto.js";

/**
 * Ethics Core (§2.3) and Article X — Non-Weaponization & Anti-War Doctrine.
 * Deterministic, offline enforcement of the two hard constitutional safeguards.
 */

export interface EthicsAssessment {
  bias_score: number;
  threshold: number;
  halted: boolean;
  message: string;
}

/** Ethics kill switch: bias above 0.3% halts ALL operations (no override). */
export function assessEthics(biasScore = 0): EthicsAssessment {
  const threshold = CONSTITUTION_CONSTANTS.ETHICS_HALT_THRESHOLD;
  const halted = biasScore > threshold;
  return {
    bias_score: biasScore,
    threshold,
    halted,
    message: halted
      ? `ETHICS HALT: systemic bias ${(biasScore * 100).toFixed(3)}% exceeds ${(threshold * 100).toFixed(1)}% — all operations halted.`
      : `Bias ${(biasScore * 100).toFixed(3)}% within tolerance.`,
  };
}

// Offensive / lethal military intent (prohibited). Permitted humanitarian uses
// (war-crimes documentation, human-rights work) are explicitly excluded below.
const PROHIBITED = [
  /\blethal targeting\b/i,
  /\bstrike assistance\b/i,
  /\btarget(?:ing|s)? for (?:lethal|a )?(?:force|strike)\b/i,
  /\bbattlefield intelligence\b/i,
  /\boffensive (?:military )?operation/i,
  /\bweapons?[- ](?:system|platform)s? integration\b/i,
  /\bautonomous (?:weapon|combat)\b/i,
  /\b(?:missile|drone) (?:strike|guidance|targeting)\b/i,
  /\bkill chain\b/i,
  /\boptimi[sz]e (?:warfare|combat|conflict)\b/i,
];

const PERMITTED_CONTEXT = [
  /war crimes?/i,
  /human rights/i,
  /evidence preservation/i,
  /prosecution support/i,
  /protect(?:ion of)? civilians/i,
  /atrocit/i,
];

export interface WeaponizationAssessment {
  breach: boolean;
  matches: string[];
  classification?: string;
  message: string;
}

/**
 * Assess a stated PURPOSE/intent (not evidence content) for weaponization.
 * War-crimes / human-rights documentation is a permitted, protected use.
 */
export function assessWeaponization(purpose: string): WeaponizationAssessment {
  const matches = PROHIBITED.filter((re) => re.test(purpose)).map((re) => re.source);
  const permitted = PERMITTED_CONTEXT.some((re) => re.test(purpose));
  const breach = matches.length > 0 && !permitted;
  return {
    breach,
    matches,
    classification: breach ? "CONSTITUTIONAL BREACH: WEAPONIZATION ATTEMPT" : undefined,
    message: breach
      ? "Prohibited military/weaponization use detected. The system may observe war — it may never participate in it."
      : permitted && matches.length
        ? "Permitted humanitarian/legal use (war-crimes/human-rights documentation)."
        : "No weaponization intent detected.",
  };
}

/**
 * Immutable Silence Ledger entry (Article X enforcement). Appended to the vault
 * audit layer and cryptographically associated with the event.
 */
export function recordSilenceLedger(
  config: FirewallConfig,
  event: { type: string; detail: string; purpose?: string; created_at?: string },
): { ledger_path: string; sha512: string } {
  const created_at = event.created_at ?? new Date().toISOString();
  const entry = {
    type: event.type,
    detail: event.detail,
    purpose: event.purpose,
    created_at,
  };
  const digest = sha512(JSON.stringify(entry));
  const ledgerPath = join(config.storage.vault_dir, "silence-ledger.jsonl");
  appendJsonl(ledgerPath, { ...entry, sha512: digest });
  return { ledger_path: ledgerPath, sha512: digest };
}
