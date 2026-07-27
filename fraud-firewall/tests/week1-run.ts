import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateSyntheticTransactions, analyzeResults } from "./week1-synthetic-transactions.js";

/**
 * Task 1A.2: Run 100 synthetic transactions through /v1/monitor
 * and collect response times, alert rates, and verification results.
 *
 * Usage: npx tsx tests/week1-run.ts
 */
export async function runWeek1Test() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("WEEK 1 COMPLIANCE MVP TEST: 100 SYNTHETIC TRANSACTIONS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const transactions = generateSyntheticTransactions();
  const responseTimes: number[] = [];
  const alerts: Array<{
    txn_id: string;
    fraud_type: string;
    country: string;
    status: string;
  }> = [];

  console.log(`Generated ${transactions.length} synthetic transactions\n`);
  console.log("Transaction distribution:");
  console.log("  • 15 velocity abuse (rapid-fire)\n");
  console.log("  • 20 layering (cross-account transfers)\n");
  console.log("  • 15 mule accounts (suspicious patterns)\n");
  console.log("  • 12 large anomalies (>250k ZAR)\n");
  console.log("  • 12 cross-border (jurisdiction jumping)\n");
  console.log("  • 10 structuring (just-below-threshold)\n");
  console.log("  • 6 baseline/normal\n");

  console.log("Running fraud monitoring...\n");

  const baseUrl = "http://localhost:8787";

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];
    const startTime = Date.now();

    try {
      const response = await fetch(`${baseUrl}/v1/monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: [txn] }),
      });

      const elapsed = Date.now() - startTime;
      responseTimes.push(elapsed);

      if (!response.ok) {
        console.error(`  ✗ TXN-${String(i + 1).padStart(3, "0")}: HTTP ${response.status}`);
        continue;
      }

      const result = await response.json() as {
        alert?: { alert_id: string; fraud_type: string; status: string } | null;
      };

      if (result.alert) {
        const status = result.alert.status ?? "UNKNOWN";
        const emoji =
          status === "CONFIRMED"
            ? "✓"
            : status === "HUMAN_REVIEW"
              ? "?"
              : "○";
        console.log(
          `  ${emoji} ${txn.txn_id}: ${status.padEnd(12)} | ${result.alert.fraud_type.padEnd(16)} | ${txn.country} | ${txn.amount} ${txn.currency} | ${elapsed}ms`
        );

        alerts.push({
          txn_id: txn.txn_id,
          fraud_type: result.alert.fraud_type,
          country: txn.country,
          status,
        });
      } else {
        console.log(
          `  ○ ${txn.txn_id}: NO ALERT          | (clean) | ${txn.country} | ${txn.amount} ${txn.currency} | ${elapsed}ms`
        );
        alerts.push({
          txn_id: txn.txn_id,
          fraud_type: "NONE",
          country: txn.country,
          status: "REJECTED",
        });
      }

      if ((i + 1) % 25 === 0) {
        const avgSoFar =
          responseTimes.slice(-25).reduce((a, b) => a + b, 0) / 25;
        console.log(
          `  ⏱  Batch average (last 25): ${Math.round(avgSoFar)}ms\n`
        );
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      responseTimes.push(elapsed);
      console.error(
        `  ✗ ${txn.txn_id}: Error — ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Analyze results
  const stats = analyzeResults(transactions, responseTimes, alerts);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("TEST RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log(`Total Transactions: ${stats.total_transactions}`);
  console.log(`Fraud Alerts Generated: ${stats.fraud_alerts}`);
  console.log(
    `Fraud Detection Rate: ${(stats.fraud_rate * 100).toFixed(1)}% (target: >80%)`
  );
  console.log(`\nAlert Status Breakdown:`);
  console.log(`  • Confirmed: ${stats.confirmed}`);
  console.log(`  • Human Review: ${stats.human_review}`);
  console.log(`  • Rejected: ${stats.rejected}`);

  console.log(`\nResponse Times:`);
  console.log(`  • Average: ${stats.avg_response_time_ms}ms`);
  console.log(`  • Min: ${stats.min_response_time_ms}ms`);
  console.log(`  • Max: ${stats.max_response_time_ms}ms`);
  console.log(
    `  • Target: <500ms — ${stats.pass_criteria.response_time_under_500ms ? "✓ PASS" : "✗ FAIL"}`
  );

  console.log(`\nFraud Type Distribution:`);
  for (const [type, count] of Object.entries(stats.fraud_types).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  • ${type}: ${count}`);
  }

  console.log(`\nJurisdiction Distribution:`);
  for (const [country, count] of Object.entries(stats.jurisdictions).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  • ${country}: ${count}`);
  }

  console.log(`\nPASS/FAIL CRITERIA:`);
  console.log(
    `  ${stats.pass_criteria.all_completed ? "✓" : "✗"} All 100 transactions completed`
  );
  console.log(
    `  ${stats.pass_criteria.response_time_under_500ms ? "✓" : "✗"} Avg response time <500ms`
  );
  console.log(
    `  ${stats.pass_criteria.fraud_detection_rate_above_80 ? "✓" : "✗"} Fraud detection rate >80%`
  );

  console.log(`\nOVERALL TEST: ${stats.test_status === "PASS" ? "✓ PASSED" : "✗ FAILED"}\n`);

  // Write detailed results to file
  const resultsFile = resolve("test-results-week1.json");
  writeFileSync(
    resultsFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: stats,
        transactions: transactions.map((t, i) => ({
          ...t,
          alert: alerts[i],
          response_time_ms: responseTimes[i],
        })),
      },
      null,
      2
    )
  );

  console.log(`✓ Detailed results saved to: ${resultsFile}\n`);

  return stats.test_status === "PASS" ? 0 : 1;
}

// Run the test
runWeek1Test()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  });
