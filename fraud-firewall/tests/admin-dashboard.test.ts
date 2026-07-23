import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Skip these tests if server is not running (they require manual `npm start`)
const skipDashboardTests = process.env.SKIP_DASHBOARD_TESTS !== "false";

describe("Admin Dashboard UI", { skip: skipDashboardTests }, () => {
  const adminKey = process.env.ADMIN_KEY || "test-admin-key-placeholder";

  it("loads admin dashboard HTML with all sections", async () => {
    // Fetch the admin.html page
    const response = await fetch("http://localhost:8787/admin.html");
    assert.equal(response.status, 200);

    const html = await response.text();

    // Verify key sections exist
    assert.ok(html.includes("Verum Omnis Admin Dashboard"));
    assert.ok(html.includes("Quarterly Engine Evolution & Compliance Monitoring"));

    // Verify tabs are present
    assert.ok(html.includes('data-tab="summary"'));
    assert.ok(html.includes('data-tab="detectors"'));
    assert.ok(html.includes('data-tab="patterns"'));
    assert.ok(html.includes('data-tab="compliance"'));

    // Verify key stat cards exist
    assert.ok(html.includes("Transactions Monitored"));
    assert.ok(html.includes("Confirmed Fraud"));
    assert.ok(html.includes("False Positive Rate"));
    assert.ok(html.includes("Novel Patterns"));

    // Verify JavaScript loads admin endpoints
    assert.ok(html.includes("/api/v1/admin"));
    assert.ok(html.includes("quarterly-report"));
    assert.ok(html.includes("X-Admin-Key"));

    // SECURITY: Do NOT check for hardcoded demo key in HTML
    // Admin key should never be embedded in frontend code

    // Verify styling exists
    assert.ok(html.includes("background: linear-gradient"));
    assert.ok(html.includes("#040D1B"));
    assert.ok(html.includes("#4A7EC7"));
  });

  it("dashboard makes authenticated request to quarterly-report endpoint", async () => {
    const response = await fetch(
      "http://localhost:8787/api/v1/admin/quarterly-report?start_date=2026-07-01&end_date=2026-09-30",
      {
        headers: { "X-Admin-Key": adminKey },
      }
    );

    assert.equal(response.status, 200);
    const data = (await response.json()) as Record<string, unknown>;

    assert.ok(data.quarter);
    assert.ok(data.period);
    assert.ok(data.summary);
    assert.ok(data.detector_performance);
    assert.ok(data.constitutional_constraints_enforced);

    const summary = data.summary as Record<string, unknown>;
    assert.ok(typeof summary.total_transactions_monitored === "number");
    assert.ok(typeof summary.fraud_cases_confirmed === "number");
    assert.ok(typeof summary.false_positive_rate === "number");
  });

  it("rejects requests without admin key", async () => {
    const response = await fetch(
      "http://localhost:8787/api/v1/admin/quarterly-report?start_date=2026-07-01&end_date=2026-09-30"
    );

    assert.equal(response.status, 403);
    const data = (await response.json()) as Record<string, unknown>;
    assert.ok(
      (data.error as string).toLowerCase().includes("unauthorized")
    );
  });

  it("rejects requests with wrong admin key", async () => {
    const response = await fetch(
      "http://localhost:8787/api/v1/admin/quarterly-report?start_date=2026-07-01&end_date=2026-09-30",
      {
        headers: { "X-Admin-Key": "wrong-key" },
      }
    );

    assert.equal(response.status, 403);
  });

  it("detector-trends endpoint returns expected format", async () => {
    const response = await fetch(
      "http://localhost:8787/api/v1/admin/detector-trends?detector=AMOUNT_ANOMALY&weeks=4",
      {
        headers: { "X-Admin-Key": adminKey },
      }
    );

    assert.equal(response.status, 200);
    const data = (await response.json()) as Record<string, unknown>;

    assert.ok(data.detector);
    assert.ok(Array.isArray(data.trends));
    assert.equal((data.trends as unknown[]).length, 4);

    const trend = ((data.trends as unknown[]) || [])[0] as Record<
      string,
      unknown
    >;
    assert.ok(trend.week);
    assert.ok(typeof trend.detections === "number");
    assert.ok(typeof trend.confirmed === "number");
    assert.ok(typeof trend.accuracy === "number");
  });

  it("false-positive-analysis endpoint returns expected format", async () => {
    const response = await fetch(
      "http://localhost:8787/api/v1/admin/false-positive-analysis",
      {
        headers: { "X-Admin-Key": adminKey },
      }
    );

    assert.equal(response.status, 200);
    const data = (await response.json()) as Record<string, unknown>;

    assert.ok(typeof data.false_positives === "number");
    assert.ok(typeof data.total_alerts === "number");
    assert.ok(typeof data.rate === "number");
    assert.ok(Array.isArray(data.improvement_suggestions));
  });

  it("fraud-by-jurisdiction endpoint returns expected format", async () => {
    const response = await fetch(
      "http://localhost:8787/api/v1/admin/fraud-by-jurisdiction?start_date=2026-07-01&end_date=2026-09-30",
      {
        headers: { "X-Admin-Key": adminKey },
      }
    );

    assert.equal(response.status, 200);
    const data = (await response.json()) as Record<string, unknown>;

    assert.ok(data.period);
    assert.ok(data.jurisdictions);

    const jurisdictions = data.jurisdictions as Record<string, unknown>;
    if (Object.keys(jurisdictions).length > 0) {
      const [firstJurisdiction] = Object.entries(jurisdictions);
      const [code, details] = firstJurisdiction as [
        string,
        Record<string, unknown>,
      ];
      assert.ok(code);
      assert.ok(typeof details.transactions_monitored === "number");
      assert.ok(typeof details.fraud_confirmed === "number");
      assert.ok(typeof details.rate === "number");
      assert.ok(details.applicable_law);
      assert.ok(details.top_fraud_type);
    }
  });
});
