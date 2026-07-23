import { ServerInitializer } from "./server-init.js";
import { initializeDeploymentConfig } from "./model-loader.js";

async function main() {
  console.log("==========================================");
  console.log("INITIALIZING FRAUD FIREWALL DEPLOYMENT");
  console.log("==========================================");
  console.log("");

  const config = initializeDeploymentConfig();
  const initializer = new ServerInitializer(config);

  console.log("Configuration:");
  console.log(`  Institution: ${config.institution_name}`);
  console.log(`  Jurisdiction: ${config.jurisdiction}`);
  console.log(`  Models Dir: ${config.models_dir}`);
  console.log(`  Vault Dir: ${config.vault_dir}`);
  console.log("");

  const result = await initializer.initialize();

  if (!result.success) {
    console.log("❌ INITIALIZATION FAILED");
    console.log("");
    result.errors.forEach((e) => {
      console.log(`  ✗ ${e}`);
    });
    process.exit(1);
  }

  console.log("✓ Initialization successful");
  console.log("");

  if (result.warnings.length > 0) {
    console.log("Warnings:");
    result.warnings.forEach((w) => {
      console.log(`  ⚠ ${w}`);
    });
    console.log("");
  }

  console.log("Configuration Details:");
  if (result.config) {
    console.log(`  Constitution: v${result.config.constitution_version}`);
    console.log(`  Port: ${result.config.server.port}`);
    console.log(`  Vault: ${result.config.storage.vault_dir}`);
    console.log(`  Institution: ${result.config.institution.name}`);
  }

  console.log("");
  console.log("Next steps:");
  console.log("  1. Configure: Edit /opt/verum-firewall/.env");
  console.log("  2. Verify: npm run health-check");
  console.log("  3. Start: systemctl start verum-firewall");
  console.log("");
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
