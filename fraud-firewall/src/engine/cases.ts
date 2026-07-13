// CONSTITUTION: v6.0 Final — Case Configuration
// Engine: v5.3.1c | Seal: VO-CE-v531c-DIGSIM-20260713
// 7 cases: AllFuels, Greensky, Southbridge, Louw v Moolla,
//          Liebenberg v Standard Bank, Louw v Olivier, Mostert v Digsim

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
      "i reject", "no exclusivity", "never existed", "cancelled", "fell through",
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
        "duty", "loyalty", "good faith", "fiduciary", "trust", "best interest",
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

/** Southbridge — Cross-border systematic fraud (VO-HR-2025/11) */
export function southbridgeConfig(): CaseConfig {
  return {
    name: "Southbridge (VO-HR-2025/11)",
    liabilityAdmit: ["admit", "confess", "yes it was", "i did", "proceeded", "executed", "agreed", "accepted"],
    liabilityDeny: ["deny", "not true", "false", "never happened", "didn't", "i reject", "no such agreement", "never existed"],
    liabilityConceal: ["hidden", "withheld", "didn't tell", "omitted", "bcc", "blind copy", "never disclosed"],
    topicKeywords: ["Southbridge", "cross-border", "systematic", "fraud", "remedy", "denied", "institutional", "mandate", "abandoned", "silence", "bounce", "submission"],
    entityKeywords: ["Southbridge", "VO-HR-2025/11", "cross-border", "institutional silence", "mandate abandonment"],
    legalSubjects: {
      "Cross-Border Fraud": ["cross-border", "jurisdiction", "international", "treaty", "extradition", "mutual legal assistance"],
      "Mandate Abandonment": ["abandoned", "failed to act", "mandate", "duty", "responsibility", "negligence"],
      "Institutional Silence": ["silence", "no response", "bounced", "ignored", "failed to respond", "remains silent"],
      "Effective Remedy Denial": ["effective remedy", "ICCPR", "Article 2(3)", "denied remedy", "no recourse"],
    },
  };
}

/** Louw v Moolla — South Africa (SAPS 1754) */
export function louwVMoollaConfig(): CaseConfig {
  return {
    name: "Louw v Moolla (SAPS 1754)",
    liabilityAdmit: ["admit", "confess", "yes it was", "i did", "proceeded"],
    liabilityDeny: ["deny", "not true", "false", "never happened", "didn't", "i reject", "never authorized"],
    liabilityConceal: ["hidden", "withheld", "didn't tell", "omitted", "never disclosed", "concealed"],
    topicKeywords: ["Louw", "Moolla", "SAPS 1754", "South Africa", "contract", "breach", "fraud", "misrepresentation", "property", "dispute"],
    entityKeywords: ["Louw", "Moolla", "SAPS", "South Africa", "Section 1754"],
    legalSubjects: {
      "Contract Breach": ["contract", "breach", "violation", "terms", "agreement", "failed to perform"],
      "Misrepresentation": ["misrepresent", "false statement", "deceive", "fraudulent", "induce"],
      "Property Dispute": ["property", "title", "ownership", "transfer", "conveyance", "deed"],
    },
  };
}

/** Liebenberg v Standard Bank — South Africa */
export function liebenbergVStandardBankConfig(): CaseConfig {
  return {
    name: "Liebenberg v Standard Bank",
    liabilityAdmit: ["admit", "confess", "yes it was", "i did"],
    liabilityDeny: ["deny", "not true", "false", "never happened", "didn't", "i reject", "no such record"],
    liabilityConceal: ["hidden", "withheld", "didn't tell", "omitted", "concealed", "destroyed"],
    topicKeywords: ["Liebenberg", "Standard Bank", "South Africa", "banking", "fraud", "account", "transaction", "unauthorized", "debit", "credit"],
    entityKeywords: ["Liebenberg", "Standard Bank", "South Africa", "banking fraud", "unauthorized transaction"],
    legalSubjects: {
      "Banking Fraud": ["bank", "account", "unauthorized", "debit", "credit", "transaction", "fraudulent"],
      "Financial Misconduct": ["misconduct", "negligence", "breach of duty", "fiduciary", "banking regulations"],
      "Consumer Protection": ["consumer", "protection", "NCA", "FAIS", "ombudsman", "complaint"],
    },
  };
}

/** Louw v Olivier — South Africa (SAPS 147/12/2025) */
export function louwVOlivierConfig(): CaseConfig {
  return {
    name: "Louw v Olivier (SAPS 147/12/2025)",
    liabilityAdmit: ["admit", "confess", "yes it was", "i did", "proceeded"],
    liabilityDeny: ["deny", "not true", "false", "never happened", "didn't", "i reject", "no knowledge"],
    liabilityConceal: ["hidden", "withheld", "didn't tell", "omitted", "concealed", "never disclosed"],
    topicKeywords: ["Louw", "Olivier", "SAPS 147/12/2025", "South Africa", "criminal", "fraud", "theft", "forgery", "document", "false"],
    entityKeywords: ["Louw", "Olivier", "SAPS", "South Africa", "criminal fraud", "forgery"],
    legalSubjects: {
      "Criminal Fraud": ["fraud", "criminal", "theft", "deceive", "dishonest", "unlawful"],
      "Forgery": ["forge", "fabricated", "false document", "signature", "counterfeit", "altered"],
      "Document Tampering": ["tamper", "alter", "modify", "destroy", "conceal document", "evidence destruction"],
    },
  };
}

/** Mostert v Digsim — Protection from Harassment Act (PHA 2026/06) */
export function mostertVDigsimConfig(): CaseConfig {
  return {
    name: "Mostert v Digsim (PHA 2026/06)",
    liabilityAdmit: ["admit", "confess", "yes it was", "i did", "used", "leverage", "pressure"],
    liabilityDeny: ["deny", "not true", "false", "never happened", "didn't", "i reject", "no protection order"],
    liabilityConceal: ["hidden", "withheld", "didn't tell", "omitted", "concealed purpose", "misrepresented"],
    topicKeywords: [
      "Mostert", "Digsim", "PHA 2026/06", "South Africa",
      "Protection from Harassment Act", "protection order",
      "leverage", "bargaining", "commercial dispute",
      "jurat", "defective", "oath", "commissioner",
      "harassment", "interdict", "restrain",
      "character", "assassination", "credibility",
    ],
    entityKeywords: ["Mostert", "Digsim", "PHA", "South Africa", "Protection from Harassment Act", "defective jurat", "commissioner", "oath"],
    legalSubjects: {
      "Protection Order Abuse": ["protection order", "harassment act", "interdict", "restrain", "leverage", "bargaining tool", "commercial dispute", "misuse"],
      "Defective Jurat": ["jurat", "oath", "commissioner", "defective", "missing jurat", "no oath", "sworn", "before me", "Justice of the Peace"],
      "Character Assassination": ["character", "reputation", "dishonest", "untrustworthy", "mental health", "emotional", "personal attack", "credibility", "irrelevant"],
      "False Allegation in Affidavit": ["false allegation", "sworn", "affidavit", "contradicted", "contemporaneous evidence", "perjury"],
      "Process Remedy Denial": ["effective remedy", "ICCPR", "mandatory duty", "institutional silence", "bounce", "no response", "denied remedy"],
    },
  };
}

/** Get configuration by case name — supports all 7 cases. */
export function getCaseConfig(caseName: string): CaseConfig {
  const normalized = caseName.toLowerCase().trim();
  if (normalized.includes("greensky") || normalized.includes("green sky") || normalized.includes("rakez")) {
    return greenskyConfig();
  }
  if (normalized.includes("southbridge") || normalized.includes("vo-hr-2025")) {
    return southbridgeConfig();
  }
  if (normalized.includes("louw") && normalized.includes("moolla")) {
    return louwVMoollaConfig();
  }
  if (normalized.includes("louw") && normalized.includes("olivier")) {
    return louwVOlivierConfig();
  }
  if (normalized.includes("liebenberg") || normalized.includes("standard bank")) {
    return liebenbergVStandardBankConfig();
  }
  if (normalized.includes("mostert") || normalized.includes("digsim") || normalized.includes("pha 2026")) {
    return mostertVDigsimConfig();
  }
  // Default to AllFuels
  return allfuelsConfig();
}
