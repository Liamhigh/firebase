import { ModelLoader, initializeDeploymentConfig } from "./model-loader.js";

async function main() {
  console.log("==========================================");
  console.log("AI MODEL VERIFICATION");
  console.log("==========================================");
  console.log("");

  const config = initializeDeploymentConfig();
  const loader = new ModelLoader(config);

  console.log(`Models Directory: ${config.models_dir}`);
  console.log("");

  const result = loader.loadModels();

  if (result.loaded.length === 0 && result.missing.length > 0) {
    console.log("❌ No models found");
    console.log("");
    console.log("Missing models:");
    result.missing.forEach((m) => {
      console.log(`  - ${m}`);
    });
    console.log("");
    console.log("Installation:");
    console.log(`  1. Extract model files to: ${config.models_dir}`);
    console.log(`  2. Each model requires: {model}/*.onnx`);
    console.log(`  3. Run: npm run verify-models`);
    process.exit(1);
  }

  console.log("Loaded Models:");
  result.loaded.forEach((m) => {
    console.log(`  ✓ ${m.name}`);
    console.log(`    Format: ${m.format}`);
    console.log(`    Size: ~${m.size_mb} MB`);
    console.log(`    Version: ${m.version}`);
  });
  console.log("");

  if (result.missing.length > 0) {
    console.log("⚠ Missing Models:");
    result.missing.forEach((m) => {
      console.log(`  - ${m}`);
    });
    console.log("");
    console.log("Some models are not available. Install missing models before deployment.");
  }

  console.log("");
  console.log("Total: " + result.loaded.length + "/3 models loaded");
  console.log("");

  if (result.success) {
    console.log("✓ All models verified");
  } else {
    console.log("✗ Model verification incomplete");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
