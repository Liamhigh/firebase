// VO-DSS-1.2 — Verum Omnis Document Sealing Standard v1.2 (Firewall/TypeScript)
// Source of truth: Liamhigh/webdocsol (seal-module/web). Interoperable with
// the website and the Android app: a document sealed on any platform verifies
// on every platform.

export { sha256Hex, sha512Hex, sealIdFromSha512, hexToBytes } from "./sealHasher.js";
export {
  SEAL_FORMAT_VERSION,
  VERIFY_BASE_URL,
  collectSealMetadata,
  encodeSealMetadata,
  decodeSealMetadata,
  buildVerifyUrl,
  type SealMetadata,
  type SealIdentity,
  type SealMetadataInput,
  type SealType,
} from "./sealMetadata.js";
export {
  SEAL_SUBJECT_MAGIC,
  SEAL_KEYWORDS_PREFIX,
  SEAL_PRODUCER,
  parseSealSubject,
  buildSealSubject,
  buildSealKeywords,
  previousSealsFromSubject,
  chainIdsFrom,
  type ParsedSealSubject,
  type PreviousSeal,
} from "./sealChain.js";
export { submitToOTS, OTS_CALENDARS, type OtsResult, type OtsOptions } from "./openTimestamps.js";
export {
  sealDocument,
  detectExistingSeal,
  type SealDocumentOptions,
  type SealedDocument,
} from "./documentSealer.js";
export {
  verifySealedDocument,
  type SealVerification,
  type VerificationVerdict,
} from "./sealVerifier.js";
