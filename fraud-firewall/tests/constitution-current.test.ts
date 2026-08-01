import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  loadConstitution,
  CURRENT_CONSTITUTION_VERSION,
  systemPromptFor,
} from "../src/core/constitution.js";
import { loadConfig } from "../src/core/config.js";

// Constitution drift lock. The default constitution sat at v5.2.7 after v6.0.0
// was ratified: seals were stamped 6.0.0 (config) while the AI system prompts
// (models.ts / mistral.ts call loadConstitution() bare) were still built from
// the superseded text. These tests make that split-brain impossible to
// reintroduce silently.
describe("constitution version lock (no drift)", () => {
  it("the bare default loads the NEWEST constitution on disk", () => {
    const dir = join(process.cwd(), "src", "constitution");
    const versions = readdirSync(dir)
      .filter((f) => /^v\d+\.\d+\.\d+\.json$/.test(f))
      .map((f) => f.slice(1, -5));
    const newest = versions.sort((a, b) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
    })[versions.length - 1];
    assert.equal(
      CURRENT_CONSTITUTION_VERSION,
      newest,
      `CURRENT_CONSTITUTION_VERSION (${CURRENT_CONSTITUTION_VERSION}) must be the newest ratified constitution on disk (${newest}) — bump the constant when a new version is ratified`,
    );
    assert.equal(loadConstitution().version, newest);
  });

  it("seal config and AI prompts run under the SAME constitution version", () => {
    const config = loadConfig(join(process.cwd(), "config/firewall.json"));
    assert.equal(
      config.constitution_version,
      CURRENT_CONSTITUTION_VERSION,
      "config.constitution_version (used for seals) must match the default the AI prompts are built from",
    );
  });

  it("v6.0.0 genuinely supersedes v5.2.7 (no downgraded doctrine)", () => {
    const v6 = loadConstitution("6.0.0");
    const v5 = loadConstitution("5.2.7");
    assert.ok(
      v6.prime_directives.length >= v5.prime_directives.length,
      "a newer constitution may not carry fewer prime directives",
    );
    for (const model of ["gemma3", "gemma4", "phi3", "mistral"]) {
      const prompt = systemPromptFor(model, v6);
      assert.ok(prompt && prompt.length > 0, `v6.0.0 provides a system prompt for ${model}`);
    }
  });
});
