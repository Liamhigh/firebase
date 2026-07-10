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
  return raw;
}
