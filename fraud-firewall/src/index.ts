// Verum Omnis Guardian Fraud Firewall — Library Exports
export { loadConfig } from "./core/config.js";
export { loadConstitution, constitutionRuleset, systemPromptFor } from "./core/constitution.js";
export { sha512, makeSealId, stableStringify } from "./core/crypto.js";
export { SealCreditLedgerService } from "./core/sealCredits.js";
export { DocumentSealingService } from "./core/sealing.js";
export { generateCommissionInvoice, assertInvoicePrivacy } from "./core/commission.js";
export { NotificationService } from "./notifications/email.js";
export { RuleEngine } from "./pipeline/rules.js";
export {
  checkForRuleUpdate,
  loadCachedRules,
  rulesCachePath,
  canonicalJson,
  compareSemver,
  isSemver,
  parseManifest,
  verifyRulePackageSignature,
  defaultRuleManifestFetcher,
  DEFAULT_RULE_MANIFEST_URL,
  RULE_MANIFEST_URL_ENV,
  RULES_ALGORITHM,
  RULES_PUBLIC_KEY_ID,
  VO_RULES_PUBLIC_KEY_DER_B64,
} from "./core/ruleUpdate.js";
export type {
  CachedRules,
  RuleManifest,
  RuleManifestFetcher,
  RulePackage,
  RuleSet,
  RuleUpdateOptions,
  RuleUpdateOutcome,
} from "./core/ruleUpdate.js";
export { TripleAiConsensus } from "./ai/consensus.js";
export { MistralAgentPool } from "./agents/mistral.js";
export { FraudFirewall, demoTransactions } from "./pipeline/firewall.js";
export type { FraudFirewallOptions, MonitorResult } from "./pipeline/firewall.js";
export { startServer } from "./api/server.js";

// CONTRADICTION ENGINE v5.2.9 — Full forensic contradiction detection
export {
  // Enums
  ContradictionType,
  Severity,
  Confidence,
  StatementType,
  Subject,
  FileType,
  severityScore,
  confidenceScore,
  scoreToConfidence,
} from "./engine/enums.js";
export type {
  ContradictionType as CT,
  Severity as Sev,
  Confidence as Conf,
  StatementType as ST,
  Subject as Subj,
  FileType as FT,
} from "./engine/enums.js";

// Engine types
export type {
  EvidenceAtom,
  Claim,
  DetectedFact,
  LogicalPattern,
  LegalHypothesis,
  Contradiction,
  ActorProfile,
  TripleVerification,
  ForensicReport,
  SealRecord,
} from "./engine/types.js";

// Engine core
export { calibrate, reportCalibration } from "./engine/calibrator.js";
export { cosineSimilarity, negationScore, detectSemanticContradiction } from "./engine/semantic.js";
export { detectAll, resetCounter } from "./engine/detector.js";
export { allfuelsConfig, greenskyConfig, getCaseConfig } from "./engine/cases.js";
export type { CaseConfig } from "./engine/cases.js";
export {
  extractFromText,
  extractFromFile,
  extractClaims,
  hashCorpus,
} from "./engine/extractor.js";
export {
  verifyTriple,
  buildProfiles,
  generateReport,
} from "./engine/verifier.js";

// Engine orchestrator
export {
  VerumContradictionEngine,
  detectContradictions,
  detectContradictionsFromFiles,
  formatReport,
} from "./engine/index.js";
export type { EngineOptions } from "./engine/index.js";

export type * from "./core/types.js";
