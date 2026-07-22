import { randomInt, randomBytes } from "node:crypto";
import type { Transaction } from "../src/core/types.js";

/**
 * Generates 100 synthetic fraud transactions for Week 1 testing.
 * Includes realistic patterns across 7 fraud types and 3 jurisdictions.
 */
export function generateSyntheticTransactions(seed = 42): Transaction[] {
  const transactions: Transaction[] = [];
  const fraud_types = [
    "SIM_SWAP",
    "VELOCITY_ABUSE",
    "LAYERING",
    "MULE_ACCOUNT",
    "IDENTITY_THEFT",
    "MONEY_LAUNDERING",
    "AMOUNT_ANOMALY",
  ];

  const jurisdictions = ["ZA", "US", "EU", "UK"];
  const counterparties = [
    "MULE-ACCT-001",
    "SHELL-CORP-002",
    "OVERSEAS-TRNSF",
    "CRYPTO-GATE-003",
    "CASHLOAN-LTD",
    "SUSPECT-ACCOUNT",
    "RAPID-TRANSFER",
  ];

  const muleAccounts = new Set(
    Array.from({ length: 10 }, (_, i) => `MULE-${i}`)
  );

  let txnSeq = 1;
  const now = new Date("2026-07-22T00:00:00Z");

  // Pattern 1: Velocity abuse (15 transactions) — rapid fire on single account
  for (let i = 0; i < 15; i++) {
    const accountId = `ACC-VELOCITY-001`;
    const ts = new Date(now.getTime() + i * 2000); // 2 seconds apart
    transactions.push({
      txn_id: `TXN-${String(txnSeq++).padStart(3, "0")}`,
      account_id: accountId,
      amount: 10000 + randomInt(0, 5000),
      currency: "ZAR",
      timestamp: ts.toISOString(),
      country: "ZA",
      counterparty: counterparties[i % counterparties.length],
    });
  }

  // Pattern 2: Layering (20 transactions) — fund movements across accounts
  for (let i = 0; i < 20; i++) {
    const amount = 50000 + randomInt(0, 100000);
    const ts = new Date(now.getTime() + 3600000 + i * 600000); // 1 hour offset, 10 min apart
    transactions.push({
      txn_id: `TXN-${String(txnSeq++).padStart(3, "0")}`,
      account_id: `ACC-LAYER-${String((i % 5) + 1).padStart(2, "0")}`,
      amount,
      currency: "ZAR",
      timestamp: ts.toISOString(),
      country: "ZA",
      counterparty: `LAYER-TRANSFER-${i}`,
    });
  }

  // Pattern 3: Mule accounts (15 transactions) — suspicious account patterns
  for (let i = 0; i < 15; i++) {
    const amount = 100000 + randomInt(0, 200000);
    const ts = new Date(now.getTime() + 7200000 + i * 300000); // 2 hour offset
    const muleArray = Array.from(muleAccounts);
    transactions.push({
      txn_id: `TXN-${String(txnSeq++).padStart(3, "0")}`,
      account_id: `ACC-MULE-RECV-${i % 3}`,
      amount,
      currency: "ZAR",
      timestamp: ts.toISOString(),
      country: "ZA",
      counterparty: muleArray[i % muleArray.length],
    });
  }

  // Pattern 4: Large amount anomalies (12 transactions) — exceeds thresholds
  for (let i = 0; i < 12; i++) {
    const amount = 300000 + randomInt(0, 500000); // Well above 250k threshold
    const ts = new Date(now.getTime() + 10800000 + i * 1200000); // 3 hour offset
    const jurisdiction = jurisdictions[i % jurisdictions.length];
    transactions.push({
      txn_id: `TXN-${String(txnSeq++).padStart(3, "0")}`,
      account_id: `ACC-LARGE-${i % 4}`,
      amount,
      currency: "ZAR",
      timestamp: ts.toISOString(),
      country: jurisdiction,
      counterparty: `LARGE-TXN-COUNTERPARTY-${i}`,
    });
  }

  // Pattern 5: Cross-border rapid movements (12 transactions) — jurisdiction jumping
  const borderCountries = ["ZA", "US", "EU", "UK"];
  for (let i = 0; i < 12; i++) {
    const amount = 75000 + randomInt(0, 125000);
    const ts = new Date(now.getTime() + 14400000 + i * 600000); // 4 hour offset
    const country = borderCountries[i % borderCountries.length];
    transactions.push({
      txn_id: `TXN-${String(txnSeq++).padStart(3, "0")}`,
      account_id: `ACC-BORDER-${i % 3}`,
      amount,
      currency: country === "ZA" ? "ZAR" : country === "US" ? "USD" : "EUR",
      timestamp: ts.toISOString(),
      country,
      counterparty: `OVERSEAS-${country}-${i}`,
    });
  }

  // Pattern 6: Structuring (10 transactions) — just-below-threshold amounts
  for (let i = 0; i < 10; i++) {
    const amount = 249000 + randomInt(0, 900); // Just below 250k threshold
    const ts = new Date(now.getTime() + 18000000 + i * 900000); // 5 hour offset
    transactions.push({
      txn_id: `TXN-${String(txnSeq++).padStart(3, "0")}`,
      account_id: `ACC-STRUCT-${i % 2}`,
      amount,
      currency: "ZAR",
      timestamp: ts.toISOString(),
      country: "ZA",
      counterparty: `STRUCTURE-PARTNER-${i}`,
    });
  }

  // Pattern 7: Mixed legitimate + suspicious (6 transactions) — normal baseline
  for (let i = 0; i < 6; i++) {
    const amount = 50000 + randomInt(0, 100000);
    const ts = new Date(now.getTime() + 21600000 + i * 1800000); // 6 hour offset
    transactions.push({
      txn_id: `TXN-${String(txnSeq++).padStart(3, "0")}`,
      account_id: `ACC-NORMAL-${i}`,
      amount,
      currency: "ZAR",
      timestamp: ts.toISOString(),
      country: "ZA",
      counterparty: `NORMAL-VENDOR-${i}`,
    });
  }

  return transactions;
}

/**
 * Calculates fraud detection statistics from results.
 */
export interface FraudDetectionStats {
  total_transactions: number;
  fraud_alerts: number;
  fraud_rate: number;
  confirmed: number;
  human_review: number;
  rejected: number;
  avg_response_time_ms: number;
  min_response_time_ms: number;
  max_response_time_ms: number;
  fraud_types: Record<string, number>;
  jurisdictions: Record<string, number>;
  test_status: "PASS" | "FAIL";
  pass_criteria: {
    all_completed: boolean;
    response_time_under_500ms: boolean;
    fraud_detection_rate_above_80: boolean;
  };
}

export function analyzeResults(
  transactions: Transaction[],
  responseTimes: number[],
  alerts: Array<{ fraud_type: string; country: string; status: string }>
): FraudDetectionStats {
  const fraudAlerts = alerts.filter((a) => a.status !== "REJECTED");
  const confirmed = alerts.filter((a) => a.status === "CONFIRMED").length;
  const humanReview = alerts.filter((a) => a.status === "HUMAN_REVIEW").length;
  const rejected = alerts.filter((a) => a.status === "REJECTED").length;

  const fraudTypes: Record<string, number> = {};
  const jurisdictions: Record<string, number> = {};

  for (const alert of alerts) {
    fraudTypes[alert.fraud_type] = (fraudTypes[alert.fraud_type] ?? 0) + 1;
    jurisdictions[alert.country] = (jurisdictions[alert.country] ?? 0) + 1;
  }

  const avgResponseTime =
    responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const maxResponseTime = Math.max(...responseTimes);
  const minResponseTime = Math.min(...responseTimes);

  const fraudDetectionRate = fraudAlerts.length / transactions.length;

  const passCriteria = {
    all_completed: alerts.length === transactions.length,
    response_time_under_500ms: avgResponseTime < 500,
    fraud_detection_rate_above_80: fraudDetectionRate > 0.8,
  };

  return {
    total_transactions: transactions.length,
    fraud_alerts: fraudAlerts.length,
    fraud_rate: fraudDetectionRate,
    confirmed,
    human_review: humanReview,
    rejected,
    avg_response_time_ms: Math.round(avgResponseTime * 100) / 100,
    min_response_time_ms: minResponseTime,
    max_response_time_ms: maxResponseTime,
    fraud_types: fraudTypes,
    jurisdictions,
    test_status:
      passCriteria.all_completed &&
      passCriteria.response_time_under_500ms &&
      passCriteria.fraud_detection_rate_above_80
        ? "PASS"
        : "FAIL",
    pass_criteria: passCriteria,
  };
}
