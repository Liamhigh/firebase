import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { FirewallConfig } from "./types.js";

const DEFAULT_CONFIG_PATH = resolve(
  process.cwd(),
  "config",
  "firewall.json",
);

export function loadConfig(path = process.env.VO_FIREWALL_CONFIG): FirewallConfig {
  const configPath = resolve(path || DEFAULT_CONFIG_PATH);
  if (!existsSync(configPath)) {
    throw new Error(`Firewall config not found: ${configPath}`);
  }
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as FirewallConfig;
  if (raw.verum.commission_percent !== 20) {
    throw new Error(
      "Commission percent is hard-coded to 20% per VO-FIREWALL-SPEC-5.2.7",
    );
  }
  applyEmailEnv(raw);
  return raw;
}

/**
 * Populate SMTP settings from environment secrets when present. Env wins over
 * any file config so credentials never need to live in firewall.json.
 */
function applyEmailEnv(config: FirewallConfig): void {
  const host = process.env.SMTP_HOST;
  const from = process.env.EMAIL_FROM;
  const enabledEnv = process.env.EMAIL_ENABLED;
  if (!host && !from && !config.email && enabledEnv === undefined) return;
  config.email = config.email ?? {};
  if (from) config.email.from = from;
  // Emails only actually send when explicitly enabled. This keeps forensic
  // document scans and demos silent even when SMTP creds are present in env.
  if (enabledEnv !== undefined) {
    config.email.enabled = enabledEnv === "true";
  } else if (host) {
    // SMTP configured purely from env with no explicit switch → default OFF
    // (send nothing) so nobody is surprised by mail during testing.
    config.email.enabled = config.email.enabled ?? false;
  }
  if (host) {
    config.email.smtp = {
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      requireTLS: process.env.SMTP_REQUIRE_TLS
        ? process.env.SMTP_REQUIRE_TLS === "true"
        : undefined,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }
}
