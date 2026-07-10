/**
 * Verum Omnis revenue model (business constitution).
 *
 * One rule: Verum takes 20% of value.
 *  - Fraud recovery: 20% of value prevented / recovered.
 *  - Legal (commercial): 20% of what lawyers would charge in that area.
 *  - AI-company subscription: 20% of turnover (+ legal 20% if used).
 *  - Any commercial institution: 20% (+ legal 20% if used).
 *  - Private individuals and SAPS are permanently FREE.
 *  - Data is never sold; no advertising; no surveillance monetization.
 *
 * All figures are deterministic and offline.
 */

export const COMMISSION_RATE = 0.2; // 20% — single source of truth, not AI-configurable.

export type UserType =
  | "individual"
  | "saps"
  | "bank"
  | "ai_company"
  | "institution"
  | "commercial";

export type QuoteCategory =
  | "fraud_recovery"
  | "legal_services"
  | "ai_subscription"
  | "commercial";

/** Permanently free actors (business constitution). */
const FREE_USER_TYPES = new Set<UserType>(["individual", "saps"]);

/** Entities excluded from fraud-recovery share. */
const FRAUD_RECOVERY_EXCLUDED = new Set<UserType>(["individual", "saps"]);

export interface BillingContext {
  user_type: UserType;
  billable: boolean;
  reason: string;
}

export function determineBillingContext(userType: UserType): BillingContext {
  if (FREE_USER_TYPES.has(userType)) {
    return {
      user_type: userType,
      billable: false,
      reason:
        userType === "saps"
          ? "SAPS is permanently free."
          : "Private individuals are permanently free.",
    };
  }
  return { user_type: userType, billable: true, reason: "Commercial use — 20% share applies." };
}

/**
 * Indicative local lawyer fees used to benchmark the 20% legal share.
 * Hourly rate (local currency) × hours-by-complexity × entity multiplier.
 */
const LAWYER_HOURLY: Record<string, { rate: number; currency: string }> = {
  "ZA-KZN": { rate: 1800, currency: "ZAR" },
  "ZA-GP": { rate: 2500, currency: "ZAR" },
  "ZA-WC": { rate: 2200, currency: "ZAR" },
  ZA: { rate: 2000, currency: "ZAR" },
  UAE: { rate: 1500, currency: "AED" },
  US: { rate: 400, currency: "USD" },
  UK: { rate: 350, currency: "GBP" },
  EU: { rate: 300, currency: "EUR" },
};

const COMPLEXITY_HOURS: Record<string, number> = {
  simple: 6,
  moderate: 20,
  complex: 60,
};

const ENTITY_MULTIPLIER: Record<string, number> = {
  individual: 1,
  sme: 1.5,
  corporate: 2.5,
  institution: 3,
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface LegalBenchmark {
  jurisdiction: string;
  currency: string;
  hourly_rate: number;
  hours: number;
  entity_multiplier: number;
  estimated_lawyer_fee: number;
}

/** Estimate what a local lawyer would charge for the work. */
export function estimateLawyerFee(params: {
  jurisdiction?: string;
  complexity?: "simple" | "moderate" | "complex";
  entityType?: "individual" | "sme" | "corporate" | "institution";
}): LegalBenchmark {
  const key = (params.jurisdiction ?? "ZA").toUpperCase();
  const bench = LAWYER_HOURLY[key] ?? LAWYER_HOURLY[key.split("-")[0]] ?? LAWYER_HOURLY.ZA;
  const hours = COMPLEXITY_HOURS[params.complexity ?? "moderate"];
  const multiplier = ENTITY_MULTIPLIER[params.entityType ?? "corporate"];
  return {
    jurisdiction: key,
    currency: bench.currency,
    hourly_rate: bench.rate,
    hours,
    entity_multiplier: multiplier,
    estimated_lawyer_fee: roundMoney(bench.rate * hours * multiplier),
  };
}

export interface Quote {
  category: QuoteCategory;
  user_type: UserType;
  billable: boolean;
  rate_percent: 20;
  currency: string;
  /** The value the 20% is applied to (recovered amount, lawyer fee, turnover, etc.). */
  base_amount: number;
  base_label: string;
  charge: number;
  benchmark?: LegalBenchmark;
  notes: string[];
}

export interface QuoteInput {
  category: QuoteCategory;
  userType: UserType;
  /** fraud_recovery */
  recoveredValue?: number;
  /** ai_subscription */
  annualTurnover?: number;
  /** commercial */
  commercialValue?: number;
  /** legal_services (explicit fee, else estimated) */
  lawyerFee?: number;
  jurisdiction?: string;
  complexity?: "simple" | "moderate" | "complex";
  entityType?: "individual" | "sme" | "corporate" | "institution";
  currency?: string;
}

/** Compute a 20% quote for any category, honouring the free tiers. */
export function computeQuote(input: QuoteInput): Quote {
  const billing = determineBillingContext(input.userType);
  const notes: string[] = [];
  let base = 0;
  let baseLabel = "";
  let currency = input.currency ?? "ZAR";
  let benchmark: LegalBenchmark | undefined;

  switch (input.category) {
    case "fraud_recovery": {
      base = input.recoveredValue ?? 0;
      baseLabel = "Value prevented / recovered";
      if (FRAUD_RECOVERY_EXCLUDED.has(input.userType)) {
        notes.push("Fraud recovery share does not apply to individuals or SAPS.");
      }
      break;
    }
    case "ai_subscription": {
      base = input.annualTurnover ?? 0;
      baseLabel = "AI company annual turnover";
      break;
    }
    case "commercial": {
      base = input.commercialValue ?? 0;
      baseLabel = "Commercial engagement value";
      break;
    }
    case "legal_services": {
      if (input.lawyerFee != null) {
        base = input.lawyerFee;
      } else {
        benchmark = estimateLawyerFee({
          jurisdiction: input.jurisdiction,
          complexity: input.complexity,
          entityType: input.entityType,
        });
        base = benchmark.estimated_lawyer_fee;
        currency = input.currency ?? benchmark.currency;
      }
      baseLabel = "Local lawyer fee (benchmark)";
      notes.push("Legal share = 20% of what lawyers would charge in that area.");
      break;
    }
  }

  const billable = billing.billable && !(input.category === "fraud_recovery" && FRAUD_RECOVERY_EXCLUDED.has(input.userType));
  const charge = billable ? roundMoney(base * COMMISSION_RATE) : 0;
  notes.unshift(billing.reason);

  return {
    category: input.category,
    user_type: input.userType,
    billable,
    rate_percent: 20,
    currency,
    base_amount: roundMoney(base),
    base_label: baseLabel,
    charge,
    benchmark,
    notes,
  };
}

/** Public description of the revenue model (for GET /v1/pricing). */
export function revenueModel() {
  return {
    rate_percent: 20,
    principle: "Verum Omnis takes 20% of value. Simple.",
    streams: {
      fraud_recovery: "20% of value prevented / recovered (civil, commercial, clawbacks, restitution).",
      legal_services: "20% of what lawyers would charge in that geographical area.",
      ai_subscription: "20% of the AI company's turnover (+ 20% legal if legal services used).",
      commercial: "Any commercial institution (banks incl.): 20% (+ 20% legal if legal services used).",
    },
    free: {
      individuals: "Private individuals are permanently free.",
      saps: "South African Police Service (SAPS) is permanently free.",
    },
    exclusions: {
      data_sales: false,
      advertising: false,
      surveillance_monetization: false,
    },
    notes: [
      "Bank document-sealing subscriptions: to be discussed.",
      "Licensing grants use of the forensic engine; not ownership.",
    ],
    legal_fee_benchmarks: LAWYER_HOURLY,
  };
}
