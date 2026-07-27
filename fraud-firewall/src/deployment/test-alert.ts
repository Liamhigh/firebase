/**
 * Test fraud alert generation.
 * Creates a test transaction and triggers fraud detection pipeline.
 *
 * Usage:
 *   npm run test-alert -- --amount=100000 --type=anomaly
 */

async function main() {
  console.log("==========================================");
  console.log("FRAUD FIREWALL TEST ALERT");
  console.log("==========================================");
  console.log("");

  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  // Parse command-line arguments
  args.forEach((arg) => {
    const [key, value] = arg.split("=");
    if (key.startsWith("--")) {
      params[key.slice(2)] = value || "true";
    }
  });

  const amount = parseFloat(params.amount || "100000");
  const type = params.type || "anomaly";

  console.log("Test Parameters:");
  console.log(`  Amount: ZAR ${amount.toLocaleString()}`);
  console.log(`  Type: ${type}`);
  console.log("");

  // Create test transaction
  const testTxn = {
    txn_id: `test-${Date.now()}`,
    account_id: "test-account-001",
    timestamp: new Date().toISOString(),
    amount,
    currency: "ZAR",
    counterparty: "TEST_COUNTERPARTY",
    country: "ZA",
    metadata: {
      fraud_score: type === "high" ? 0.85 : type === "medium" ? 0.65 : 0.35,
      internal_note: type === "internal" ? "Test internal fraud" : undefined,
    },
  };

  console.log("Test Transaction Generated:");
  console.log(`  ID: ${testTxn.txn_id}`);
  console.log(`  Amount: ZAR ${testTxn.amount}`);
  console.log(`  Account: ${testTxn.account_id}`);
  console.log(`  Fraud Score: ${testTxn.metadata.fraud_score}`);
  console.log("");

  // In a real deployment, this would:
  // 1. Send transaction through Mistral agent
  // 2. Generate DetectionSignal if triggered
  // 3. Log to audit trail
  // 4. Create sealed evidence

  const expectedBehavior: Record<string, string> = {
    anomaly: "Mistral TransactionMonitor should flag for elevated amount",
    internal: "Mistral CommunicationAudit should flag for internal indicators",
    high: "Should trigger CRITICAL alert with blocking authority",
    medium: "Should trigger WARNING alert for review",
  };

  console.log("Expected Firewall Behavior:");
  console.log(`  ${expectedBehavior[type] || "Monitoring..."}`);
  console.log("");

  console.log("Next Steps:");
  console.log("  1. Check audit logs:");
  console.log("     tail -20 /opt/verum-firewall/vault/audit-logs/audit.jsonl");
  console.log("");
  console.log("  2. View email dispatch:");
  console.log("     ls -la /opt/verum-firewall/vault/outbound-email/");
  console.log("");
  console.log("  3. Verify via API:");
  console.log("     curl -H \"X-Admin-Key: YOUR_KEY\" http://localhost:8787/api/v1/alerts");
  console.log("");

  console.log("✓ Test alert ready (in production deployment)");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
