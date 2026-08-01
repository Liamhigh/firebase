import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_SECTIONS,
  validateReportSections,
  reportSectionChecklist,
} from "../src/pipeline/reportStructure.js";

// A report that includes every canonical section title (what a compliant G3 run
// should emit). Used as the baseline "good" document.
const FULL_REPORT = REPORT_SECTIONS.map((s, i) => `## ${i + 1}. ${s.title}\nbody text\n`).join("\n");

describe("report structure contract", () => {
  it("passes a report that contains every mandated section", () => {
    const v = validateReportSections(FULL_REPORT);
    assert.equal(v.ok, true);
    assert.equal(v.missingRequired.length, 0);
    assert.equal(v.missingExpected.length, 0);
    assert.equal(v.present.length, REPORT_SECTIONS.length);
  });

  it("fails when a REQUIRED section is missing", () => {
    const noDeclaration = FULL_REPORT.replace(/Court-Ready Declaration/g, "")
      .replace(/declaration/gi, "")
      .replace(/certification/gi, "");
    const v = validateReportSections(noDeclaration);
    assert.equal(v.ok, false);
    assert.ok(v.missingRequired.includes("Court-Ready Declaration"));
  });

  it("warns (does not fail) when only an EXPECTED section is missing", () => {
    // Drop Four Pillars (expected) but keep all required sections.
    const noPillars = FULL_REPORT.replace(/Four Pillars of Fraud/g, "").replace(/four pillars/gi, "");
    const v = validateReportSections(noPillars);
    assert.equal(v.ok, true, "missing expected section must not fail the report");
    assert.ok(v.missingExpected.includes("Four Pillars of Fraud"));
  });

  it("codifies the two sections the full-system report demonstrated", () => {
    const titles = REPORT_SECTIONS.map((s) => s.title);
    assert.ok(titles.includes("Counter-Narratives & Rebuttals"), "counter-narratives is a section");
    assert.ok(titles.includes("Pattern of Conduct"), "pattern of conduct is a section");
  });

  it("codifies the two sections the AllFuels reference report added", () => {
    const titles = REPORT_SECTIONS.map((s) => s.title);
    assert.ok(titles.includes("Nine-Brain Architecture"), "nine-brain architecture is a section");
    assert.ok(titles.includes("External Corroboration"), "external corroboration is a section");
    // Both are expected (not required): a report on an offline device with no web
    // signal, or one that omits the methodology table, must still validate.
    const byTitle = Object.fromEntries(REPORT_SECTIONS.map((s) => [s.title, s.level]));
    assert.equal(byTitle["Nine-Brain Architecture"], "expected");
    assert.equal(byTitle["External Corroboration"], "expected");
  });

  it("resolves the new sections by alias (heading drift)", () => {
    const v = validateReportSections(
      [FULL_REPORT, "9-Brain methodology", "Corroborating sources (open source)"].join("\n"),
    );
    assert.ok(v.present.includes("Nine-Brain Architecture"));
    assert.ok(v.present.includes("External Corroboration"));
  });

  it("matches sections by alias, tolerating heading drift", () => {
    // Use aliases instead of canonical titles for the required sections.
    const aliased = [
      "Verum Omnis Sealed Document — Forensic Report",
      "Contents",
      "Authentication and full Methodology",
      "Executive Summary",
      "Evidence Map by page",
      "Contradictions",
      "Statutory anchoring and legal framework",
      "Offense Matrix", // US spelling alias
      "Certification and triple verification",
    ].join("\n");
    const v = validateReportSections(aliased);
    // All required sections should resolve via aliases → no required missing.
    assert.deepEqual(v.missingRequired, []);
  });

  it("empty report is missing every required section", () => {
    const v = validateReportSections("");
    assert.equal(v.ok, false);
    const requiredCount = REPORT_SECTIONS.filter((s) => s.level === "required").length;
    assert.equal(v.missingRequired.length, requiredCount);
  });

  it("checklist lists all sections with their level", () => {
    const list = reportSectionChecklist();
    assert.ok(list.includes("Cover Page [required]"));
    assert.ok(list.includes("Counter-Narratives & Rebuttals [expected]"));
    assert.equal(list.split("\n").length, REPORT_SECTIONS.length);
  });
});
