import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COMMISSION_RATE,
  computeQuote,
  determineBillingContext,
  estimateLawyerFee,
} from "../src/core/pricing.js";

describe("revenue model — universal 20% share", () => {
  it("uses a 20% rate everywhere", () => {
    assert.equal(COMMISSION_RATE, 0.2);
  });

  it("charges 20% of value prevented on fraud recovery", () => {
    const q = computeQuote({ category: "fraud_recovery", userType: "bank", recoveredValue: 1_500_000 });
    assert.equal(q.billable, true);
    assert.equal(q.charge, 300_000);
    assert.equal(q.rate_percent, 20);
  });

  it("charges 20% of AI company turnover on subscription", () => {
    const q = computeQuote({ category: "ai_subscription", userType: "ai_company", annualTurnover: 10_000_000 });
    assert.equal(q.charge, 2_000_000);
  });

  it("charges 20% of commercial engagement value", () => {
    const q = computeQuote({ category: "commercial", userType: "commercial", commercialValue: 500_000 });
    assert.equal(q.charge, 100_000);
  });

  it("legal share = 20% of an explicit lawyer fee", () => {
    const q = computeQuote({ category: "legal_services", userType: "bank", lawyerFee: 250_000 });
    assert.equal(q.charge, 50_000);
  });

  it("legal share benchmarks local lawyer fees when no fee is given", () => {
    const q = computeQuote({
      category: "legal_services",
      userType: "institution",
      jurisdiction: "ZA-GP",
      complexity: "moderate",
      entityType: "corporate",
    });
    assert.ok(q.benchmark);
    // 2500/hr x 20h x 2.5 = 125,000 lawyer fee -> 20% = 25,000
    assert.equal(q.benchmark!.estimated_lawyer_fee, 125_000);
    assert.equal(q.charge, 25_000);
    assert.equal(q.currency, "ZAR");
  });
});

describe("free tiers (business constitution)", () => {
  it("private individuals are free", () => {
    assert.equal(determineBillingContext("individual").billable, false);
    const q = computeQuote({ category: "commercial", userType: "individual", commercialValue: 999_999 });
    assert.equal(q.billable, false);
    assert.equal(q.charge, 0);
  });

  it("SAPS is permanently free", () => {
    assert.equal(determineBillingContext("saps").billable, false);
    const q = computeQuote({ category: "fraud_recovery", userType: "saps", recoveredValue: 1_000_000 });
    assert.equal(q.charge, 0);
  });

  it("banks and AI companies are billable", () => {
    assert.equal(determineBillingContext("bank").billable, true);
    assert.equal(determineBillingContext("ai_company").billable, true);
  });
});

describe("lawyer fee benchmark", () => {
  it("scales by complexity and entity type", () => {
    const simple = estimateLawyerFee({ jurisdiction: "ZA-KZN", complexity: "simple", entityType: "sme" });
    const complex = estimateLawyerFee({ jurisdiction: "ZA-KZN", complexity: "complex", entityType: "corporate" });
    assert.ok(complex.estimated_lawyer_fee > simple.estimated_lawyer_fee);
  });
});
