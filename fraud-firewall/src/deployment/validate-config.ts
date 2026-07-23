import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface ConfigError {
  field: string;
  issue: string;
}

function parseEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(path, "utf8");
    content.split("\n").forEach((line) => {
      line = line.trim();
      if (line && !line.startsWith("#")) {
        const [key, ...valueParts] = line.split("=");
        if (key) {
          env[key.trim()] = valueParts.join("=").trim();
        }
      }
    });
  } catch {
    // File doesn't exist yet
  }
  return env;
}

async function main() {
  console.log("==========================================");
  console.log("CONFIGURATION VALIDATION");
  console.log("==========================================");
  console.log("");

  const envPath = "/opt/verum-firewall/.env";
  const exists = existsSync(envPath);

  if (!exists) {
    console.log("⚠ Configuration file not found: " + envPath);
    console.log("");
    console.log("Create configuration from template:");
    console.log("  cp /opt/verum-firewall/.env.template /opt/verum-firewall/.env");
    console.log("  nano /opt/verum-firewall/.env");
    console.log("");
    process.exit(1);
  }

  const env = parseEnv(envPath);
  const errors: ConfigError[] = [];

  console.log("Validating configuration: " + envPath);
  console.log("");

  // Required fields
  const required = [
    "INSTITUTION_NAME",
    "JURISDICTION",
    "FIREWALL_MODELS_DIR",
    "FIREWALL_VAULT_DIR",
    "FIREWALL_PORT",
  ];

  for (const field of required) {
    if (!env[field] || env[field].includes("***")) {
      errors.push({
        field,
        issue: `Missing or not configured: ${field}`,
      });
    }
  }

  // Validate port number
  if (env.FIREWALL_PORT) {
    const port = parseInt(env.FIREWALL_PORT);
    if (isNaN(port) || port < 1024 || port > 65535) {
      errors.push({
        field: "FIREWALL_PORT",
        issue: `Invalid port number: ${env.FIREWALL_PORT} (must be 1024-65535)`,
      });
    }
  }

  // Validate jurisdiction
  if (env.JURISDICTION) {
    const valid = ["ZA", "US", "EU", "UK", "AE", "UN"];
    if (!valid.includes(env.JURISDICTION)) {
      console.log(`⚠ JURISDICTION: ${env.JURISDICTION} is not in standard list`);
    }
  }

  if (errors.length > 0) {
    console.log("❌ CONFIGURATION ERRORS:");
    console.log("");
    errors.forEach((err) => {
      console.log(`  ✗ ${err.field}`);
      console.log(`    ${err.issue}`);
    });
    console.log("");
    console.log("Fix issues and try again:");
    console.log("  nano " + envPath);
    process.exit(1);
  }

  console.log("✓ Configuration Valid");
  console.log("");
  console.log("Loaded Configuration:");
  Object.entries(env)
    .filter(([key]) => !key.includes("KEY") && !key.includes("PASSWORD"))
    .slice(0, 15)
    .forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

  if (Object.keys(env).length > 15) {
    console.log(`  ... and ${Object.keys(env).length - 15} more fields`);
  }

  console.log("");
  console.log("✓ All validation checks passed");
  console.log("");
  console.log("Ready for deployment. Next:");
  console.log("  npm run health-check");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
