import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  console.log("==========================================");
  console.log("CONSTITUTION VERIFICATION");
  console.log("==========================================");
  console.log("");

  const constitutionPath = join(process.cwd(), "constitution-v6.0.0.json");
  const appPath = join(process.cwd(), "dist", "constitution", "v6.0.0.json");

  const paths = [
    constitutionPath,
    appPath,
    "/opt/verum-firewall/app/constitution-v6.0.0.json",
  ];

  let found = false;
  let version = "UNKNOWN";
  let constraints: string[] = [];

  for (const path of paths) {
    if (existsSync(path)) {
      console.log(`✓ Constitution found at: ${path}`);
      try {
        const content = readFileSync(path, "utf8");
        const data = JSON.parse(content);

        version = data.version || "UNKNOWN";
        constraints = data.constraints || [];

        console.log(`  Version: ${version}`);
        console.log(`  Constraints: ${constraints.length}`);
        found = true;
        break;
      } catch (e) {
        console.log(`  ✗ Failed to parse: ${String(e)}`);
      }
    }
  }

  if (!found) {
    console.log("❌ Constitution not found");
    console.log("");
    console.log("Checked paths:");
    paths.forEach((p) => console.log(`  - ${p}`));
    process.exit(1);
  }

  console.log("");
  console.log("Constitutional Constraints:");
  if (constraints.length > 0) {
    constraints.forEach((c) => {
      console.log(`  ✓ ${c}`);
    });
  } else {
    console.log("  (No constraints defined in Constitution)");
  }

  console.log("");
  console.log("✓ Constitution verified: v" + version);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
