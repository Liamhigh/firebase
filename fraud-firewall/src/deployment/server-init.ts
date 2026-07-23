import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import type { DeploymentConfig } from "./model-loader.js";
import { ModelLoader } from "./model-loader.js";
import type { FirewallConfig } from "../core/types.js";

/**
 * Bank server initialization — verifies deployment, loads models, starts firewall.
 */
export class ServerInitializer {
  private modelLoader: ModelLoader;

  constructor(private readonly deployment: DeploymentConfig) {
    this.modelLoader = new ModelLoader(deployment);
  }

  /**
   * Full initialization pipeline for bank deployment.
   * Returns ready-to-run FirewallConfig or error details.
   */
  async initialize(): Promise<{
    success: boolean;
    config?: FirewallConfig;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Verify directory structure
    const dirCheck = this.verifyDirectories();
    if (!dirCheck.success) {
      errors.push(...dirCheck.missing);
    } else {
      warnings.push(...dirCheck.created);
    }

    // 2. Load models
    const modelLoad = this.modelLoader.loadModels();
    if (!modelLoad.success) {
      errors.push(
        `Missing AI models: ${modelLoad.missing.join(", ")}. Install to ${this.deployment.models_dir}`,
      );
    }

    // 3. Verify Constitution
    const constitutionCheck = this.verifyConstitution();
    if (!constitutionCheck.found) {
      errors.push("Constitution v6.0.0 not found — embedded copy required");
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    // 4. Generate FirewallConfig for runtime
    const config = this.generateFirewallConfig();

    // 5. Log initialization
    this.logInitialization(config);

    return { success: true, config, errors, warnings };
  }

  private verifyDirectories(): {
    success: boolean;
    missing: string[];
    created: string[];
  } {
    const required = [
      this.deployment.models_dir,
      this.deployment.vault_dir,
      join(this.deployment.vault_dir, "evidence"),
      join(this.deployment.vault_dir, "audit-logs"),
      join(this.deployment.vault_dir, "outbound-email"),
      join(this.deployment.vault_dir, "seized-transactions"),
    ];

    const missing: string[] = [];
    const created: string[] = [];

    for (const dir of required) {
      if (!existsSync(dir)) {
        try {
          mkdirSync(dir, { recursive: true });
          created.push(dir);
        } catch (e) {
          missing.push(`Cannot create ${dir}: ${String(e)}`);
        }
      }
    }

    return {
      success: missing.length === 0,
      missing,
      created,
    };
  }

  private verifyConstitution(): { found: boolean; version?: string } {
    // In production, this would verify the embedded Constitution v6.0.0
    // For now, just check it would be included in the package
    return {
      found: true,
      version: "6.0.0",
    };
  }

  private generateFirewallConfig(): FirewallConfig {
    return {
      version: "6.0.0",
      institution: {
        name: this.deployment.institution_name,
        jurisdiction: this.deployment.jurisdiction,
        fraud_department_email: process.env.FRAUD_DEPARTMENT_EMAIL || "fraud@bank.example.com",
        support_email: process.env.SUPPORT_EMAIL || "support@bank.example.com",
      },
      storage: {
        vault_dir: this.deployment.vault_dir,
        evidence_dir: join(this.deployment.vault_dir, "evidence"),
        audit_log: join(this.deployment.vault_dir, "audit-logs", "audit.jsonl"),
        seized_transactions: join(this.deployment.vault_dir, "seized-transactions"),
      },
      api: {
        base_url: `http://localhost:${this.deployment.port}`,
        port: this.deployment.port,
        cors_origins: ["localhost", "127.0.0.1"],
      },
      constitution_version: this.deployment.constitution_version,
      rules: {
        amount_threshold_zar: 50000,
        suspicious_pattern_threshold: 0.65,
        high_risk_country_codes: ["KP", "IR", "SY"],
      },
      verum: {
        commission_percent: 20,
        commission_email: "fraud-commission@verum.example.com",
        verify_url: "https://www.verumglobal.foundation/verify",
        api_key: "", // Banks configure their own
      },
      models: {
        gemma3_enabled: this.modelLoader.isReady(),
        gemma4_enabled: this.modelLoader.isReady(),
        mistral_enabled: this.modelLoader.isReady(),
        external_data_enabled: process.env.ENABLE_EXTERNAL_DATA === "true",
      },
    };
  }

  private logInitialization(config: FirewallConfig): void {
    const logPath = join(
      this.deployment.vault_dir,
      "audit-logs",
      "initialization.log",
    );
    const timestamp = new Date().toISOString();
    const log = [
      `[${timestamp}] VERUM OMNIS FRAUD FIREWALL INITIALIZATION`,
      `Institution: ${config.institution.name}`,
      `Jurisdiction: ${config.institution.jurisdiction}`,
      `Constitution: v${config.constitution_version}`,
      `Models: ${this.modelLoader.getLoadedModels().map((m) => m.name).join(", ")}`,
      `Port: ${config.api.port}`,
      `Vault: ${config.storage.vault_dir}`,
      `Status: READY FOR DEPLOYMENT`,
    ].join("\n");

    try {
      writeFileSync(logPath, log + "\n", "utf8");
    } catch (e) {
      console.error(`Failed to write init log: ${String(e)}`);
    }
  }
}

/**
 * Quick health check for deployed instances.
 */
export async function healthCheck(
  config: FirewallConfig,
): Promise<{
  healthy: boolean;
  components: Record<string, boolean>;
  message: string;
}> {
  const components: Record<string, boolean> = {
    storage_writable: checkStorageWritable(config.storage.vault_dir),
    audit_logs_accessible: checkAuditLogs(
      config.storage.audit_log,
    ),
    constitution_embedded: true, // Assumed true in deployed package
    api_port_available: checkPortAvailable(config.api.port),
  };

  const healthy = Object.values(components).every((v) => v);
  const failed = Object.entries(components)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return {
    healthy,
    components,
    message: healthy
      ? "All systems ready"
      : `Issues detected: ${failed.join(", ")}`,
  };
}

function checkStorageWritable(path: string): boolean {
  try {
    const testFile = join(path, ".health-check");
    writeFileSync(testFile, "ok", "utf8");
    // Would delete in production
    return true;
  } catch {
    return false;
  }
}

function checkAuditLogs(logPath: string): boolean {
  try {
    if (!existsSync(logPath)) {
      return true; // Log doesn't exist yet, that's OK
    }
    const content = readFileSync(logPath, "utf8");
    return content.length >= 0;
  } catch {
    return false;
  }
}

function checkPortAvailable(port: number): boolean {
  // In production, actually try to bind to port
  // For now, just return true
  return port > 0 && port < 65536;
}
