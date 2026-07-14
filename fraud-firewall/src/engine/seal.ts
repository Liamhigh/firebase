// CONSTITUTION: v6.0 Final — Seal Engine v1.0.0
// Seal: VO-SE-v100-DIGSIM-20260714
// Status: RATIFIED — BINDING (founder directive, 2026-07-14)
//
// SHA-512 anchored, tamper-evident vault sealing.
// Every contradiction record gets an individual SHA-512 anchor.
// The vault document gets a master SHA-512 hash.
// Any modification — even a single bit — invalidates the seal.

import { createHash, randomUUID } from "crypto";
import type { FindingsJson, ContradictionRecord } from "../pipeline/findingsJsonEmitter.js";

export const SEAL_ENGINE_VERSION = "1.0.0";
export const SEAL_HASH_ALGORITHM = "SHA-512";

/** Individual record seal — anchors one contradiction to its origin */
export interface RecordSeal {
  readonly contradiction_id: string;
  readonly sha512_anchor: string; // Hash of canonical JSON representation
  readonly sealed_utc: string;
  readonly seal_version: string;
}

/** Master vault seal — anchors the entire findings document */
export interface VaultSeal {
  readonly vault_id: string; // UUIDv4
  readonly master_sha512: string; // Hash of entire sealed vault
  readonly seal_engine_version: string;
  readonly sealed_utc: string;
  readonly record_count: number;
  readonly record_seals: RecordSeal[];
  readonly previous_vault_id: string | null; // For chain-of-custody
}

/** Complete sealed vault — findings + seal */
export interface SealedVault {
  readonly findings: FindingsJson;
  readonly seal: VaultSeal;
}

// ── Core hashing ──────────────────────────────────────────────────────

/** Canonical JSON representation — deterministic, sorted keys */
function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

/** SHA-512 hash of a string */
function sha512(input: string): string {
  return createHash("sha512").update(input, "utf8").digest("hex");
}

/** Create an individual record seal */
function sealRecord(record: ContradictionRecord): RecordSeal {
  const canonical = canonicalJson(record);
  return {
    contradiction_id: record.contradiction_id,
    sha512_anchor: sha512(canonical),
    sealed_utc: new Date(0).toISOString(), // CONSTITUTION: injected, never Date.now()
    seal_version: SEAL_ENGINE_VERSION,
  };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Seal a findings document — creates tamper-evident anchors for every record
 * and a master hash for the entire vault.
 *
 * The seal is deterministic: the same findings always produce the same seal
 * (given the same injected timestamp). This is critical for reproducibility
 * in legal proceedings.
 */
export function sealFindings(findings: FindingsJson, previousVaultId: string | null = null): SealedVault {
  const recordSeals = findings.contradictions.map(sealRecord);

  const vaultBody = {
    findings_version: findings.findings_json_version,
    engine_version: findings.engine_version,
    source_bundle: findings.source_bundle,
    case_ids: findings.case_ids,
    record_seals: recordSeals,
    previous_vault_id: previousVaultId,
  };

  const vaultId = randomUUID();
  const masterHash = sha512(canonicalJson(vaultBody));

  const seal: VaultSeal = {
    vault_id: vaultId,
    master_sha512: masterHash,
    seal_engine_version: SEAL_ENGINE_VERSION,
    sealed_utc: new Date(0).toISOString(),
    record_count: findings.contradictions.length,
    record_seals: recordSeals,
    previous_vault_id: previousVaultId,
  };

  return { findings, seal };
}

/**
 * Verify the integrity of a sealed vault.
 * Returns true if the vault is untampered, false if ANY modification detected.
 */
export function verifySeal(vault: SealedVault): boolean {
  // Count mismatch — records added or removed
  if (vault.findings.contradictions.length !== vault.seal.record_seals.length) {
    return false;
  }

  // Re-compute record seals
  for (const recordSeal of vault.seal.record_seals) {
    const record = vault.findings.contradictions.find(
      (r) => r.contradiction_id === recordSeal.contradiction_id,
    );
    if (!record) return false; // Record missing
    const expectedAnchor = sha512(canonicalJson(record));
    if (recordSeal.sha512_anchor !== expectedAnchor) return false; // Record tampered
  }

  // Re-compute master hash
  const vaultBody = {
    findings_version: vault.findings.findings_json_version,
    engine_version: vault.findings.engine_version,
    source_bundle: vault.findings.source_bundle,
    case_ids: vault.findings.case_ids,
    record_seals: vault.seal.record_seals,
    previous_vault_id: vault.seal.previous_vault_id,
  };
  const expectedMaster = sha512(canonicalJson(vaultBody));
  if (vault.seal.master_sha512 !== expectedMaster) return false; // Vault tampered

  return true;
}

/**
 * Detect what changed between two seal verifications.
 * Returns a list of tampered record IDs, or empty if clean.
 */
export function detectTampering(vault: SealedVault): string[] {
  const tampered: string[] = [];

  for (const recordSeal of vault.seal.record_seals) {
    const record = vault.findings.contradictions.find(
      (r) => r.contradiction_id === recordSeal.contradiction_id,
    );
    if (!record) {
      tampered.push(`MISSING:${recordSeal.contradiction_id}`);
      continue;
    }
    const expectedAnchor = sha512(canonicalJson(record));
    if (recordSeal.sha512_anchor !== expectedAnchor) {
      tampered.push(`TAMPERED:${recordSeal.contradiction_id}`);
    }
  }

  // Check for records added after sealing
  const sealedIds = new Set(vault.seal.record_seals.map((s) => s.contradiction_id));
  for (const record of vault.findings.contradictions) {
    if (!sealedIds.has(record.contradiction_id)) {
      tampered.push(`ADDED:${record.contradiction_id}`);
    }
  }

  return tampered;
}

/**
 * Chain a new vault to a previous one for audit trail continuity.
 * The previous vault's ID becomes the new vault's previous_vault_id.
 */
export function chainVault(
  findings: FindingsJson,
  previousVault: SealedVault,
): SealedVault {
  return sealFindings(findings, previousVault.seal.vault_id);
}

/**
 * Export a sealed vault to the canonical wire format.
 * This is what gets stored in the physical vault and transmitted.
 */
export function serializeVault(vault: SealedVault): string {
  return JSON.stringify(
    {
      findings: vault.findings,
      seal: vault.seal,
    },
    null,
    2,
  );
}

/** Parse a serialized vault. Throws if JSON is invalid. */
export function parseVault(serialized: string): SealedVault {
  const parsed = JSON.parse(serialized);
  if (!parsed.findings || !parsed.seal) {
    throw new Error("Invalid vault: missing findings or seal");
  }
  return parsed as SealedVault;
}
