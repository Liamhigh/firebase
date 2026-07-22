import { describe, it } from "node:test";
import assert from "node:assert/strict";

const skipIfServerNotRunning = process.env.SKIP_DASHBOARD_TESTS !== "false";

describe("Week 3: PDF Report Export", { skip: skipIfServerNotRunning }, () => {
  const ADMIN_KEY = "demo-admin-key-12345";
  const API_BASE = "http://localhost:8787/api/v1/admin";

  it("generates PDF compliance report with valid credentials", async () => {
    const response = await fetch(
      `${API_BASE}/compliance-report/pdf?start_date=2026-07-01&end_date=2026-07-22`,
      {
        headers: { "X-Admin-Key": ADMIN_KEY },
      }
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "application/pdf");

    const buffer = await response.arrayBuffer();
    assert.ok(buffer.byteLength > 0);

    // Check for PDF header
    const view = new Uint8Array(buffer);
    const pdfHeader = String.fromCharCode(...view.slice(0, 4));
    assert.equal(pdfHeader, "%PDF");
  });

  it("rejects PDF request without admin key", async () => {
    const response = await fetch(
      `${API_BASE}/compliance-report/pdf?start_date=2026-07-01&end_date=2026-07-22`
    );

    assert.equal(response.status, 403);
  });

  it("rejects PDF request with wrong admin key", async () => {
    const response = await fetch(
      `${API_BASE}/compliance-report/pdf?start_date=2026-07-01&end_date=2026-07-22`,
      {
        headers: { "X-Admin-Key": "wrong-key" },
      }
    );

    assert.equal(response.status, 403);
  });

  it("requires start_date and end_date parameters for PDF", async () => {
    const response = await fetch(
      `${API_BASE}/compliance-report/pdf?start_date=2026-07-01`,
      {
        headers: { "X-Admin-Key": ADMIN_KEY },
      }
    );

    assert.equal(response.status, 400);
    const data = (await response.json()) as Record<string, unknown>;
    assert.ok((data.error as string).includes("start_date and end_date"));
  });

  it("generates JSON audit log with valid credentials", async () => {
    const response = await fetch(
      `${API_BASE}/audit-log/json?start_date=2026-07-01&end_date=2026-07-22`,
      {
        headers: { "X-Admin-Key": ADMIN_KEY },
      }
    );

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("Content-Type"),
      "application/json; charset=utf-8"
    );

    const data = (await response.json()) as Record<string, unknown>;
    assert.ok(data.generated_at);
    assert.ok(data.report_version);
    assert.ok(data.compliance_framework);
    assert.ok(data.quarter);
    assert.ok(data.period);
    assert.ok(data.engine_version);
    assert.ok(data.constitution_version);
    assert.ok(data.summary);
    assert.ok(data.detector_performance);
    assert.ok(data.compliance_status);
  });

  it("rejects audit log request without admin key", async () => {
    const response = await fetch(
      `${API_BASE}/audit-log/json?start_date=2026-07-01&end_date=2026-07-22`
    );

    assert.equal(response.status, 403);
  });

  it("audit log includes all required compliance fields", async () => {
    const response = await fetch(
      `${API_BASE}/audit-log/json?start_date=2026-07-01&end_date=2026-07-22`,
      {
        headers: { "X-Admin-Key": ADMIN_KEY },
      }
    );

    const data = (await response.json()) as Record<string, unknown>;
    const summary = data.summary as Record<string, unknown>;
    const constraints = data
      .constitutional_constraints_enforced as Record<string, unknown>;

    assert.ok(typeof summary.total_transactions_monitored === "number");
    assert.ok(typeof summary.fraud_cases_confirmed === "number");
    assert.ok(typeof summary.false_positive_rate === "number");
    assert.ok(typeof summary.novel_patterns_discovered === "number");
    assert.ok(typeof summary.detector_adjustments_approved === "number");
    assert.ok(typeof summary.blockchain_anchors_confirmed === "number");

    assert.ok(typeof constraints.findings_never_suppressed === "boolean");
    assert.ok(typeof constraints.triple_ai_verification_required === "boolean");
    assert.ok(typeof constraints.evidence_always_sealed === "boolean");
    assert.ok(typeof constraints.chain_of_custody_maintained === "boolean");
    assert.ok(typeof constraints.no_pii_to_verum === "boolean");
  });

  it("PDF report has valid headers for download", async () => {
    const response = await fetch(
      `${API_BASE}/compliance-report/pdf?start_date=2026-07-01&end_date=2026-07-22`,
      {
        headers: { "X-Admin-Key": ADMIN_KEY },
      }
    );

    assert.ok(response.headers.get("Content-Disposition"));
    assert.ok(
      (response.headers.get("Content-Disposition") as string).includes(
        "attachment"
      )
    );
    assert.ok(
      (response.headers.get("Content-Disposition") as string).includes(
        ".pdf"
      )
    );
  });

  it("audit log has valid headers for download", async () => {
    const response = await fetch(
      `${API_BASE}/audit-log/json?start_date=2026-07-01&end_date=2026-07-22`,
      {
        headers: { "X-Admin-Key": ADMIN_KEY },
      }
    );

    assert.ok(response.headers.get("Content-Disposition"));
    assert.ok(
      (response.headers.get("Content-Disposition") as string).includes(
        "attachment"
      )
    );
    assert.ok(
      (response.headers.get("Content-Disposition") as string).includes(
        ".json"
      )
    );
  });

  it("handles date ranges correctly", async () => {
    // Test with a short range
    const response = await fetch(
      `${API_BASE}/audit-log/json?start_date=2026-07-22&end_date=2026-07-22`,
      {
        headers: { "X-Admin-Key": ADMIN_KEY },
      }
    );

    assert.equal(response.status, 200);
    const data = (await response.json()) as Record<string, unknown>;
    const period = data.period as Record<string, string>;
    assert.equal(period.start, "2026-07-22");
    assert.equal(period.end, "2026-07-22");
  });
});
