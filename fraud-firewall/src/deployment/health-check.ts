import { ServerInitializer, healthCheck } from "./server-init.js";
import { initializeDeploymentConfig } from "./model-loader.js";

async function main() {
  console.log("==========================================");
  console.log("VERUM OMNIS FIREWALL HEALTH CHECK");
  console.log("==========================================");
  console.log("");

  const config = initializeDeploymentConfig();
  const initializer = new ServerInitializer(config);

  // Initialize and verify deployment
  const initResult = await initializer.initialize();

  if (!initResult.success) {
    console.log("❌ INITIALIZATION FAILED");
    console.log("");
    if (initResult.errors.length > 0) {
      console.log("Errors:");
      initResult.errors.forEach((e) => console.log(`  - ${e}`));
    }
    process.exit(1);
  }

  console.log("✓ Initialization successful");
  console.log("");

  if (initResult.warnings.length > 0) {
    console.log("Warnings:");
    initResult.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    console.log("");
  }

  // Run health check
  const health = await healthCheck(initResult.config!);

  console.log("Component Status:");
  Object.entries(health.components).forEach(([name, status]) => {
    const icon = status ? "✓" : "✗";
    console.log(`  ${icon} ${name.replace(/_/g, " ")}: ${status ? "OK" : "FAILED"}`);
  });
  console.log("");

  console.log("Overall Status: ", health.healthy ? "✓ READY" : "✗ ISSUES DETECTED");
  console.log(`Message: ${health.message}`);
  console.log("");

  if (!health.healthy) {
    console.log("Troubleshooting:");
    console.log("  1. Check /opt/verum-firewall/.env configuration");
    console.log("  2. Verify all AI models are installed");
    console.log("  3. Ensure vault directory has write permissions");
    console.log("  4. Review installation guide: BANK_INSTALLATION_GUIDE.md");
    process.exit(1);
  }

  console.log("==========================================");
  console.log("✓ Health check passed");
  console.log("==========================================");
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
