import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { FirewallConfig } from "../core/types.js";

export function evidenceDir(config: FirewallConfig): string {
  return config.storage.evidence_dir ?? join(config.storage.vault_dir, "evidence");
}

export function findingsDir(config: FirewallConfig): string {
  return config.storage.findings_dir ?? join(config.storage.vault_dir, "findings");
}

export function ensureVault(config: FirewallConfig): void {
  const dirs = [
    config.storage.vault_dir,
    config.storage.alerts_dir,
    config.storage.invoices_dir,
    config.storage.sealed_dir,
    evidenceDir(config),
    findingsDir(config),
    dirname(config.storage.ledger_file),
    dirname(config.storage.audit_log),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export function writeJson(path: string, data: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function appendJsonl(path: string, entry: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(path, JSON.stringify(entry) + "\n", "utf8");
}

export function alertPath(config: FirewallConfig, alertId: string): string {
  return join(config.storage.alerts_dir, `${alertId}.json`);
}

export function invoicePath(config: FirewallConfig, invoiceId: string): string {
  return join(config.storage.invoices_dir, `${invoiceId}.json`);
}

export function sealedPath(config: FirewallConfig, sealId: string): string {
  return join(config.storage.sealed_dir, `${sealId}.pdf`);
}

export function evidencePath(config: FirewallConfig, evidenceId: string): string {
  return join(evidenceDir(config), `${evidenceId}.json`);
}

export function findingsPath(config: FirewallConfig, file: string): string {
  return join(findingsDir(config), file);
}
