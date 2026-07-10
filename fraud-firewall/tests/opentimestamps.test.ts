import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { otsUpgradeCheck } from "../src/core/opentimestamps.js";

/**
 * Live OpenTimestamps checks hit the public calendars / Bitcoin, so they are
 * guarded behind VO_OTS_LIVE=1 to keep the default suite hermetic. They validate
 * the real CONFIRMED-detection path against a proof already anchored in Bitcoin.
 */
const LIVE = process.env.VO_OTS_LIVE === "1";
const EXAMPLE = join(
  process.cwd(),
  "node_modules/javascript-opentimestamps/examples/hello-world.txt.ots",
);

describe("opentimestamps live confirmation (guarded)", () => {
  it(
    "detects a confirmed Bitcoin attestation on an anchored proof",
    { skip: !LIVE || !existsSync(EXAMPLE) },
    async () => {
      const bytes = readFileSync(EXAMPLE);
      const check = await otsUpgradeCheck(new Uint8Array(bytes));
      assert.equal(check.status, "CONFIRMED");
      assert.ok((check.block_height ?? 0) > 0);
    },
  );
});
