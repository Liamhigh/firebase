// CONSTITUTION: v5.2.7 — Case Configuration
// Ported from Python Addition 1 (lines 898-942)
// Per-case keyword dictionaries — AllFuels and Greensky

export interface CaseConfig {
  name: string;
  liabilityAdmit: string[];
  liabilityDeny: string[];
  liabilityConceal: string[];
  topicKeywords: string[];
  entityKeywords: string[];
  legalSubjects: Record<string, string[]>;
}

/** AllFuels Energy (Pty) Ltd — Petroleum franchise fraud */
export function allfuelsConfig(): CaseConfig {
  return {
    name: "AllFuels Energy (Pty) Ltd",
    liabilityAdmit: ["admit", "confess", "yes it was", "i did", "my fault"],
    liabilityDeny: [
      "deny", "not true", "false", "never happened", "didn't",
      "i reject", "no goodwill", "never existed", "cancelled",
    ],
    liabilityConceal: [
      "hidden", "withheld", "didn't tell", "omitted", "bcc",
      "blind copy", "never told",
    ],
    topicKeywords: [
      "goodwill", "franchise", "petroleum", "section 12B",
      "eviction", "rent", "clause 7", "MOU", "AllFuels",
    ],
    entityKeywords: ["AllFuels", "Palmbili", "Zeyd Timol", "Petroleum Products Act"],
    legalSubjects: {
      "Goodwill Value": ["goodwill", "compensable", "entrenched value", "brand fee"],
      "Contract Validity": ["contract", "agreement", "binding", "countersign"],
      "Signature Status": ["signature", "signed", "blank", "unsigned"],
      "Section 12B": ["section 12B", "arbitration", "referral", "Business Zone"],
      "Compensation": ["fee", "payment", "rent", "compensation", "deposit"],
      "Perjury": ["perjury", "Constitutional Court", "sworn", "CCT"],
    },
  };
}

/** Greensky/GreenSky — RAKEZ shareholder oppression (UAE) */
export function greenskyConfig(): CaseConfig {
  return {
    name: "Greensky (RAKEZ Case #1295911)",
    liabilityAdmit: [
      "admit", "confess", "yes it was", "i did", "my fault",
      "proceeded", "went ahead", "executed",
    ],
    liabilityDeny: [
      "deny", "not true", "false", "never happened", "didn't",
      "i reject", "no exclusivity", "never existed", "cancelled",
      "fell through",
    ],
    liabilityConceal: [
      "hidden", "withheld", "didn't tell", "omitted", "bcc",
      "copied you in", "blind copy", "never told",
    ],
    topicKeywords: [
      "deal", "order", "invoice", "shipment", "payment", "profit",
      "goodwill", "agreement", "exclusivity", "meeting", "access",
      "email", "camera", "theft", "fraud",
    ],
    entityKeywords: [
      "RAKEZ", "Greensky", "Article 84", "Article 110",
      "Marius", "Kevin", "Liam", "30%", "exclusivity",
    ],
    legalSubjects: {
      "Shareholder Oppression": [
        "meeting", "excluded", "private meeting",
        "shareholder", "denied", "no vote", "kept out",
      ],
      "Breach of Fiduciary Duty": [
        "duty", "loyalty", "good faith",
        "fiduciary", "trust", "best interest",
      ],
      "Fraudulent Evidence": [
        "screenshot", "whatsapp", "fake", "doctored",
        "fabricated", "cropped", "missing context",
      ],
      "Cybercrime": [
        "gmail", "access", "hack", "unauthorized",
        "archive", "device", "google account",
      ],
      "Emotional Exploitation": [
        "mental", "emotional", "gaslight",
        "vulnerable", "trauma", "broken", "manipulate",
      ],
      "Concealment": [
        "withheld", "hid", "didn't tell", "secret",
        "copied", "bcc", "blind copied",
      ],
    },
  };
}

/** Get configuration by case name */
export function getCaseConfig(caseName: string): CaseConfig {
  const normalized = caseName.toLowerCase().trim();
  if (normalized.includes("greensky") || normalized.includes("green sky") || normalized.includes("rakez")) {
    return greenskyConfig();
  }
  // Default to AllFuels
  return allfuelsConfig();
}
