// Cross-platform replacement for the Unix-only `mkdir -p dist/constitution &&
// cp src/constitution/*.json dist/constitution/` build step. Runs on Windows
// cmd.exe, PowerShell, macOS and Linux with no shell dependencies — needed so
// the firewall builds cleanly on on-prem Windows machines (e.g. a garage mini-PC).
import { mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src", "constitution");
const outDir = join(root, "dist", "constitution");

mkdirSync(outDir, { recursive: true });

const jsonFiles = readdirSync(srcDir).filter((f) => f.endsWith(".json"));
for (const f of jsonFiles) {
  copyFileSync(join(srcDir, f), join(outDir, f));
}

console.log(`[build] copied ${jsonFiles.length} constitution file(s) to dist/constitution`);
