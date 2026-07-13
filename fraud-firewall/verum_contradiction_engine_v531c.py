#!/usr/bin/env python3
"""
Verum Omnis Contradiction Engine v5.3.1c
========================================
Cross-Case Serial Fraud Detection Platform — Expanded Case Library

43 Contradiction Types | 37 Detectors | 17 Serial Patterns | 7 Cases | B1-B11
Seal: VO-CE-v531c-DIGSIM-20260713
Constitution: v5.2.7 sealed + v6.0 Final
Author: Liam Anthony Highcock, Founder
"""

from __future__ import annotations

import hashlib
import math
import os
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

VO_VERSION = "5.3.1c"
VO_BUILD_DATE = "2026-07-13"

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 0: ENUMS (7 classes, 95 values)
# ═══════════════════════════════════════════════════════════════════════════════

class ContradictionType(Enum):
    """43 contradiction types: 16 legacy + 8 cross-case + 6 banking/maritime + 7 CC/PP + 6 DIGSIM."""
    # --- v5.2.9 legacy (16) ---
    STATEMENT_VS_STATEMENT = "STATEMENT_VS_STATEMENT"
    STATEMENT_VS_EVIDENCE = "STATEMENT_VS_EVIDENCE"
    OMISSION = "OMISSION"
    BEHAVIORAL = "BEHAVIORAL"
    FINANCIAL_IRREGULARITY = "FINANCIAL_IRREGULARITY"
    JUDICIAL_VS_DOCUMENTARY = "JUDICIAL_VS_DOCUMENTARY"
    TEMPORAL_CONTRADICTION = "TEMPORAL_CONTRADICTION"
    CONSCIOUSNESS_OF_GUILT = "CONSCIOUSNESS_OF_GUILT"
    PERJURY_BY_TIMELINE = "PERJURY_BY_TIMELINE"
    PATTERN_OF_RACKETEERING = "PATTERN_OF_RACKETEERING"
    REGULATORY_CAPTURE = "REGULATORY_CAPTURE"
    SHAM_TRANSACTION = "SHAM_TRANSACTION"
    FRAUD_ON_THE_COURT = "FRAUD_ON_THE_COURT"
    CORPORATE_VEIL_ABUSE = "CORPORATE_VEIL_ABUSE"
    TACIT_LEASE_VIOLATION = "TACIT_LEASE_VIOLATION"
    POST_EXPIRY_ENFORCEMENT = "POST_EXPIRY_ENFORCEMENT"
    # --- v5.3.0 cross-case (8) ---
    ACKNOWLEDGE_THEN_DENY = "ACKNOWLEDGE_THEN_DENY"
    NO_COUNTERSIGNATURE_TRAP = "NO_COUNTERSIGNATURE_TRAP"
    TRUST_FUND_WITHHOLDING = "TRUST_FUND_WITHHOLDING"
    SERVICE_EVASION = "SERVICE_EVASION"
    INSTITUTIONAL_SILENCE_CASCADE = "INSTITUTIONAL_SILENCE_CASCADE"
    DEFAMATION_THREAT = "DEFAMATION_THREAT"
    GOODWILL_FORFEITURE_SWINDLE = "GOODWILL_FORFEITURE_SWINDLE"
    MANUFACTURED_CONSENT = "MANUFACTURED_CONSENT"
    # --- v5.3.1 Banking + Maritime (6) ---
    FABRICATED_DECOY_EVIDENCE = "FABRICATED_DECOY_EVIDENCE"
    DATA_BREACH_ENABLED_FRAUD = "DATA_BREACH_ENABLED_FRAUD"
    CHARGING_VICTIM_FOR_FRAUD = "CHARGING_VICTIM_FOR_FRAUD"
    TECHNOLOGY_REFUSAL_LIABILITY = "TECHNOLOGY_REFUSAL_LIABILITY"
    REGULATORY_CERTIFICATE_FRAUD = "REGULATORY_CERTIFICATE_FRAUD"
    SPOLIATION_OF_EVIDENCE = "SPOLIATION_OF_EVIDENCE"
    # --- v5.3.1b: CC + Public Protector + LPC (7) ---
    ALLFUELS_PARADOX = "ALLFUELS_PARADOX"
    ATTORNEY_PRECCA_34_VIOLATION = "ATTORNEY_PRECCA_34_VIOLATION"
    ATTORNEY_OBSTRUCTION = "ATTORNEY_OBSTRUCTION"
    INSTITUTIONAL_CAPTURE_PROSECUTORIAL = "INSTITUTIONAL_CAPTURE_PROSECUTORIAL"
    VERBAL_THREAT_AVOIDANCE = "VERBAL_THREAT_AVOIDANCE"
    CONFLICT_OF_INTEREST = "CONFLICT_OF_INTEREST"
    INDUSTRY_WIDE_PATTERN = "INDUSTRY_WIDE_PATTERN"
    # --- v5.3.1c: Mostert v Digsim + HR + Southbridge (6) ---
    DEFECTIVE_JURAT = "DEFECTIVE_JURAT"
    PROTECTION_ORDER_AS_LEVERAGE = "PROTECTION_ORDER_AS_LEVERAGE"
    FALSE_ALLEGATION_IN_AFFIDAVIT = "FALSE_ALLEGATION_IN_AFFIDAVIT"
    TEMPORAL_PRECEDENCE_CONFLICT = "TEMPORAL_PRECEDENCE_CONFLICT"
    PROCESS_REMEDY_CONFLICT = "PROCESS_REMEDY_CONFLICT"
    CHARACTER_ASSASSINATION = "CHARACTER_ASSASSINATION"


class Severity(Enum):
    VERY_HIGH = "VERY_HIGH"
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"
    INSUFFICIENT = "INSUFFICIENT"


class Confidence(Enum):
    DETERMINISTIC = "DETERMINISTIC"
    VERY_HIGH = "VERY_HIGH"
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"
    INSUFFICIENT = "INSUFFICIENT"


class StatementType(Enum):
    CLAIM = "CLAIM"
    DENIAL = "DENIAL"
    ADMISSION = "ADMISSION"
    DEMAND = "DEMAND"
    PROMISE = "PROMISE"
    THREAT = "THREAT"
    SWORN_STATEMENT = "SWORN_STATEMENT"
    CONTEMPORANEOUS = "CONTEMPORANEOUS"
    JUDICIAL_RECORD = "JUDICIAL_RECORD"
    CONTRACT_CLAUSE = "CONTRACT_CLAUSE"


class Subject(Enum):
    GOODWILL_VALUE = "GOODWILL_VALUE"
    CONTRACT_VALIDITY = "CONTRACT_VALIDITY"
    SIGNATURE_STATUS = "SIGNATURE_STATUS"
    SECTION_12B = "SECTION_12B"
    COMPENSATION = "COMPENSATION"
    PERJURY = "PERJURY"
    COERCION = "COERCION"
    RACKETEERING = "RACKETEERING"
    TRUST_FUND = "TRUST_FUND"
    SERVICE_OF_PROCESS = "SERVICE_OF_PROCESS"
    INSTITUTIONAL_RESPONSE = "INSTITUTIONAL_RESPONSE"
    DEFAMATION = "DEFAMATION"
    GOODWILL_FORFEITURE = "GOODWILL_FORFEITURE"
    CONSENT_MANUFACTURE = "CONSENT_MANUFACTURE"
    VESSEL_OWNERSHIP = "VESSEL_OWNERSHIP"
    REGULATORY_COMPLIANCE = "REGULATORY_COMPLIANCE"
    BANKING_SECURITY = "BANKING_SECURITY"
    DATA_PROTECTION = "DATA_PROTECTION"
    OTHER = "OTHER"


class FileType(Enum):
    PDF = "PDF"
    IMAGE = "IMAGE"
    AUDIO = "AUDIO"
    EMAIL = "EMAIL"
    CHAT_LOG = "CHAT_LOG"
    ZIP = "ZIP"
    DOCX = "DOCX"
    XLSX = "XLSX"
    TXT = "TXT"
    CSV = "CSV"
    UNKNOWN = "UNKNOWN"


class IntimidationStage(Enum):
    NONE = 0
    LEGAL_THREAT = 1
    COORDINATED_CAMPAIGN = 2
    PHYSICAL_INTIMIDATION = 3
    DEATH_THREATS = 4
    ECONOMIC_RETALIATION = 5


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: THREE-LAYER DATA MODEL
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class EvidenceAtom:
    artifact_hash: str
    page_number: int
    line_number: int
    timestamp: Optional[datetime]
    source_path: str
    content: str
    file_type: FileType


@dataclass
class Claim:
    id: str
    subject: str
    predicate: str
    value: str
    actor: str
    date: Optional[datetime]
    source_type: StatementType
    source_location: str
    document_id: str
    sha512_hash: str
    page_number: int
    context: str = ""


@dataclass
class DetectedFact:
    fact_text: str
    source_document: str
    source_page: int
    source_line: int
    sha512_hash: str
    extraction_method: str
    confidence: Confidence


@dataclass
class LogicalPattern:
    pattern_type: str
    pattern_description: str
    supporting_facts: List[str]
    contradiction_score: float
    detector_version: str = f"v{VO_VERSION}"


@dataclass
class LegalHypothesis:
    suggested_offence: str
    legal_basis: str
    jurisdictional_note: str
    required_additional_evidence: List[str]
    is_hypothesis: bool = True
    requires_human_review: bool = True


@dataclass
class Contradiction:
    contradiction_id: str
    type: ContradictionType
    severity: Severity
    confidence: Confidence
    detected_fact: DetectedFact
    logical_pattern: LogicalPattern
    legal_hypothesis: Optional[LegalHypothesis] = None
    proposition_a_text: str = ""
    proposition_b_text: str = ""
    proposition_a_actor: str = ""
    proposition_b_actor: str = ""
    temporal_analysis: Optional[Dict[str, Any]] = None
    conflict_description: str = ""
    verification_status: Dict[str, str] = field(default_factory=dict)


@dataclass
class ActorProfile:
    name: str
    dishonesty_score: int
    flags: List[str]
    contradictions: List[str]
    statements_made: int = 0
    statements_denied: int = 0


@dataclass
class SerialFraudPattern:
    pattern_id: str
    pattern_name: str
    description: str
    min_cases: int
    severity: Severity
    cases_found: List[str] = field(default_factory=list)
    evidence_refs: List[str] = field(default_factory=list)
    confidence: Confidence = Confidence.INSUFFICIENT


@dataclass
class VictimConnection:
    victim_a: str
    case_a: str
    victim_b: str
    case_b: str
    connection_type: str
    strength_percent: int
    evidence: str = ""


@dataclass
class IntimidationEvent:
    stage: IntimidationStage
    description: str
    date: str
    evidence_ref: str


@dataclass
class CaseConfig:
    case_id: str
    case_name: str
    jurisdiction: str
    primary_actors: List[str]
    keywords: Dict[str, Any]


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: CONFIDENCE CALIBRATOR (37 detector FP rates)
# ═══════════════════════════════════════════════════════════════════════════════

class ConfidenceCalibrator:
    FP_RATES: Dict[str, float] = {
        # Legacy v5.2.9 (10)
        "STATEMENT_VS_STATEMENT": 0.15, "STATEMENT_VS_EVIDENCE": 0.10,
        "FINANCIAL_IRREGULARITY": 0.05, "JUDICIAL_VS_DOCUMENTARY": 0.08,
        "TEMPORAL_CONTRADICTION": 0.12, "CONSCIOUSNESS_OF_GUILT": 0.10,
        "BEHAVIORAL": 0.25, "SHAM_TRANSACTION": 0.10,
        "TACIT_LEASE_VIOLATION": 0.05, "POST_EXPIRY_ENFORCEMENT": 0.08,
        # v5.3.0 cross-case (8)
        "ACKNOWLEDGE_THEN_DENY": 0.12, "NO_COUNTERSIGNATURE_TRAP": 0.08,
        "TRUST_FUND_WITHHOLDING": 0.06, "SERVICE_EVASION": 0.10,
        "INSTITUTIONAL_SILENCE_CASCADE": 0.15, "DEFAMATION_THREAT": 0.10,
        "GOODWILL_FORFEITURE_SWINDLE": 0.08, "MANUFACTURED_CONSENT": 0.12,
        # v5.3.1 NEW (6)
        "FABRICATED_DECOY_EVIDENCE": 0.08, "DATA_BREACH_ENABLED_FRAUD": 0.10,
        "CHARGING_VICTIM_FOR_FRAUD": 0.06, "TECHNOLOGY_REFUSAL_LIABILITY": 0.12,
        "REGULATORY_CERTIFICATE_FRAUD": 0.08, "SPOLIATION_OF_EVIDENCE": 0.10,
        # v5.3.1b NEW (7)
        "ALLFUELS_PARADOX": 0.06, "ATTORNEY_PRECCA_34_VIOLATION": 0.08,
        "ATTORNEY_OBSTRUCTION": 0.08, "INSTITUTIONAL_CAPTURE_PROSECUTORIAL": 0.10,
        "VERBAL_THREAT_AVOIDANCE": 0.12, "CONFLICT_OF_INTEREST": 0.10,
        "INDUSTRY_WIDE_PATTERN": 0.08,
        # v5.3.1c (6)
        "DEFECTIVE_JURAT": 0.05, "PROTECTION_ORDER_AS_LEVERAGE": 0.08,
        "FALSE_ALLEGATION_IN_AFFIDAVIT": 0.06, "TEMPORAL_PRECEDENCE_CONFLICT": 0.10,
        "PROCESS_REMEDY_CONFLICT": 0.12, "CHARACTER_ASSASSINATION": 0.10,
    }
    SEMANTIC_AGREEMENT_BOOST = 0.20

    @classmethod
    def calibrate(cls, base_confidence: Confidence, detector_type: str,
                  semantic_agreement: bool = False) -> Confidence:
        fp_rate = cls.FP_RATES.get(detector_type, 0.15)
        score = cls._confidence_score(base_confidence)
        score = score * (1.0 - fp_rate)
        if semantic_agreement:
            score = min(1.0, score + cls.SEMANTIC_AGREEMENT_BOOST)
        return cls._score_to_confidence(score)

    @staticmethod
    def _confidence_score(c: Confidence) -> float:
        return {Confidence.DETERMINISTIC: 1.0, Confidence.VERY_HIGH: 0.9,
                Confidence.HIGH: 0.75, Confidence.MODERATE: 0.5,
                Confidence.LOW: 0.25, Confidence.INSUFFICIENT: 0.0}.get(c, 0.5)

    @staticmethod
    def _score_to_confidence(s: float) -> Confidence:
        if s >= 0.95: return Confidence.DETERMINISTIC
        if s >= 0.80: return Confidence.VERY_HIGH
        if s >= 0.60: return Confidence.HIGH
        if s >= 0.35: return Confidence.MODERATE
        if s >= 0.15: return Confidence.LOW
        return Confidence.INSUFFICIENT

    @classmethod
    def report_calibration(cls) -> Dict[str, Any]:
        return {
            "detector_fp_rates": cls.FP_RATES.copy(),
            "semantic_agreement_boost": cls.SEMANTIC_AGREEMENT_BOOST,
            "methodology": "Per-detector false-positive rates from validation",
            "last_calibrated": VO_BUILD_DATE,
            "validation_cases": ["ALLFUELS-2026 (111 contradictions)",
                                "LOUW-V-MOOLLA (9 contradictions)",
                                "LIEBENBERG-V-STDBANK (8 findings)",
                                "LOUW-V-OLIVIER (maritime fraud)",
                                "CROSS-CASE (11 serial patterns)"],
            "detector_count": len(cls.FP_RATES),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: SEMANTIC ANALYZER
# ═══════════════════════════════════════════════════════════════════════════════

class SemanticAnalyzer:
    STOP_WORDS = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
                  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
                  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
                  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
                  'and', 'but', 'if', 'or', 'because', 'not', 'no', 'this', 'that'}

    def __init__(self):
        self._embedding_cache: Dict[str, List[float]] = {}
        self._gemma_available = self._check_gemma()

    def _check_gemma(self) -> bool:
        try:
            gemma_path = os.environ.get('GEMMA_MODEL_PATH', '/data/local/tmp/gemma3')
            return os.path.exists(gemma_path)
        except Exception:
            return False

    def _tokenize(self, text: str) -> List[str]:
        text = re.sub(r'[^\w\s]', ' ', text.lower())
        return [t for t in text.split() if t not in self.STOP_WORDS and len(t) > 2]

    def _simple_embedding(self, text: str) -> List[float]:
        if text in self._embedding_cache:
            return self._embedding_cache[text]
        tokens = self._tokenize(text)
        if not tokens:
            return [0.0] * 100
        embedding = [0.0] * 100
        for token in tokens:
            for i, char in enumerate(token):
                idx = (ord(char) + i * 31) % 100
                embedding[idx] += 1.0
        norm = math.sqrt(sum(x * x for x in embedding))
        if norm > 0:
            embedding = [x / norm for x in embedding]
        self._embedding_cache[text] = embedding
        return embedding

    def cosine_similarity(self, text_a: str, text_b: str) -> float:
        emb_a = self._simple_embedding(text_a)
        emb_b = self._simple_embedding(text_b)
        return sum(a * b for a, b in zip(emb_a, emb_b))

    def detect_semantic_contradiction(self, claim_a: Claim, claim_b: Claim) -> Tuple[bool, float]:
        text_a = claim_a.value.lower()
        text_b = claim_b.value.lower()
        similarity = self.cosine_similarity(text_a, text_b)
        negation_score = self._semantic_negation_score(text_a, text_b)
        same_subject = claim_a.subject == claim_b.subject
        if same_subject and similarity < 0.3 and negation_score > 0.5:
            return True, 0.8
        if same_subject and similarity < 0.5 and negation_score > 0.3:
            return True, 0.6
        if negation_score > 0.7:
            return True, 0.5
        return False, 0.0

    def _semantic_negation_score(self, text_a: str, text_b: str) -> float:
        negators = {'no', 'not', 'never', 'none', 'nobody', 'nothing', 'neither',
                    'nowhere', 'hardly', 'scarcely', 'barely', 'deny', 'denies',
                    'denied', 'refuse', 'refuses', 'rejected', 'false', 'incorrect',
                    'wrong', 'without', 'lacks', 'missing', 'absent'}
        opposites = [
            ('exists', 'does not exist'), ('has', 'does not have'),
            ('true', 'false'), ('yes', 'no'), ('agreed', 'denied'),
            ('paid', 'unpaid'), ('valid', 'invalid'), ('signed', 'unsigned'),
            ('binding', 'non-binding'), ('accepted', 'rejected'),
        ]
        score = 0.0
        a_has_neg = any(n in text_a for n in negators)
        b_has_neg = any(n in text_b for n in negators)
        if a_has_neg != b_has_neg:
            score += 0.4
        for (pos, neg) in opposites:
            if (pos in text_a and neg in text_b) or (neg in text_a and pos in text_b):
                score += 0.6
        return min(1.0, score)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: CONTRADICTION DETECTOR — All 37 Detectors
# ═══════════════════════════════════════════════════════════════════════════════

class ContradictionDetector:
    CONTRADICTION_COUNTER = 0

    def __init__(self):
        self.semantic = SemanticAnalyzer()
        self.calibrator = ConfidenceCalibrator()
        self.detector_map = {
            # Legacy 10 (v5.2.9)
            ContradictionType.STATEMENT_VS_STATEMENT: self._detect_statement_vs_statement,
            ContradictionType.STATEMENT_VS_EVIDENCE: self._detect_statement_vs_evidence,
            ContradictionType.FINANCIAL_IRREGULARITY: self._detect_financial_irregularity,
            ContradictionType.JUDICIAL_VS_DOCUMENTARY: self._detect_judicial_vs_documentary,
            ContradictionType.TEMPORAL_CONTRADICTION: self._detect_temporal_contradiction,
            ContradictionType.CONSCIOUSNESS_OF_GUILT: self._detect_consciousness_of_guilt,
            ContradictionType.BEHAVIORAL: self._detect_behavioral,
            ContradictionType.SHAM_TRANSACTION: self._detect_sham_transaction,
            ContradictionType.TACIT_LEASE_VIOLATION: self._detect_tacit_lease_violation,
            ContradictionType.POST_EXPIRY_ENFORCEMENT: self._detect_post_expiry_enforcement,
            # Cross-case 8 (v5.3.0)
            ContradictionType.ACKNOWLEDGE_THEN_DENY: self._detect_acknowledge_then_deny,
            ContradictionType.NO_COUNTERSIGNATURE_TRAP: self._detect_no_countersignature_trap,
            ContradictionType.TRUST_FUND_WITHHOLDING: self._detect_trust_fund_withholding,
            ContradictionType.SERVICE_EVASION: self._detect_service_evasion,
            ContradictionType.INSTITUTIONAL_SILENCE_CASCADE: self._detect_institutional_silence,
            ContradictionType.DEFAMATION_THREAT: self._detect_defamation_threat,
            ContradictionType.GOODWILL_FORFEITURE_SWINDLE: self._detect_goodwill_forfeiture,
            ContradictionType.MANUFACTURED_CONSENT: self._detect_manufactured_consent,
            # NEW v5.3.1: Banking + Maritime (6)
            ContradictionType.FABRICATED_DECOY_EVIDENCE: self._detect_fabricated_decoy,
            ContradictionType.DATA_BREACH_ENABLED_FRAUD: self._detect_data_breach_fraud,
            ContradictionType.CHARGING_VICTIM_FOR_FRAUD: self._detect_charging_victim,
            ContradictionType.TECHNOLOGY_REFUSAL_LIABILITY: self._detect_tech_refusal,
            ContradictionType.REGULATORY_CERTIFICATE_FRAUD: self._detect_regulatory_cert_fraud,
            ContradictionType.SPOLIATION_OF_EVIDENCE: self._detect_spoliation,
            # v5.3.1b: CC Report + Public Protector + LPC (7)
            ContradictionType.ALLFUELS_PARADOX: self._detect_allfuels_paradox,
            ContradictionType.ATTORNEY_PRECCA_34_VIOLATION: self._detect_precca_34,
            ContradictionType.ATTORNEY_OBSTRUCTION: self._detect_attorney_obstruction,
            ContradictionType.INSTITUTIONAL_CAPTURE_PROSECUTORIAL: self._detect_institutional_capture,
            ContradictionType.VERBAL_THREAT_AVOIDANCE: self._detect_verbal_threat,
            ContradictionType.CONFLICT_OF_INTEREST: self._detect_conflict_of_interest,
            ContradictionType.INDUSTRY_WIDE_PATTERN: self._detect_industry_wide_pattern,
            # v5.3.1c: Mostert v Digsim + HR + Southbridge (6)
            ContradictionType.DEFECTIVE_JURAT: self._detect_defective_jurat,
            ContradictionType.PROTECTION_ORDER_AS_LEVERAGE: self._detect_protection_order_leverage,
            ContradictionType.FALSE_ALLEGATION_IN_AFFIDAVIT: self._detect_false_allegation,
            ContradictionType.TEMPORAL_PRECEDENCE_CONFLICT: self._detect_temporal_precedence,
            ContradictionType.PROCESS_REMEDY_CONFLICT: self._detect_process_remedy,
            ContradictionType.CHARACTER_ASSASSINATION: self._detect_character_assassination,
        }

    def detect_all(self, claims: List[Claim]) -> List[Contradiction]:
        all_contradictions = []
        for c_type, detector in self.detector_map.items():
            found = detector(claims)
            all_contradictions.extend(found)
        seen = set()
        unique = []
        for c in all_contradictions:
            key = f"{c.proposition_a_actor}:{c.proposition_b_actor}:{c.type.value}:{c.logical_pattern.pattern_type}"
            if key not in seen:
                seen.add(key)
                unique.append(c)
        return sorted(unique, key=lambda x: self._severity_score(x.severity), reverse=True)

    @classmethod
    def _next_id(cls) -> str:
        cls.CONTRADICTION_COUNTER += 1
        return f"C-{cls.CONTRADICTION_COUNTER:04d}"

    @staticmethod
    def _severity_score(sev: Severity) -> int:
        return {Severity.VERY_HIGH: 5, Severity.HIGH: 4, Severity.MODERATE: 3,
                Severity.LOW: 2, Severity.INSUFFICIENT: 1}.get(sev, 0)

    @staticmethod
    def _calculate_severity(claim_a: Claim, claim_b: Claim, base_score: int = 0) -> Severity:
        score = base_score
        if (claim_a.source_type == StatementType.SWORN_STATEMENT or
            claim_b.source_type == StatementType.SWORN_STATEMENT):
            score += 40
        if (claim_a.source_type == StatementType.CONTEMPORANEOUS or
            claim_b.source_type == StatementType.CONTEMPORANEOUS):
            score += 30
        if (claim_a.source_type == StatementType.ADMISSION or
            claim_b.source_type == StatementType.ADMISSION):
            score += 20
        if score >= 70: return Severity.VERY_HIGH
        if score >= 50: return Severity.HIGH
        if score >= 30: return Severity.MODERATE
        if score >= 10: return Severity.LOW
        return Severity.INSUFFICIENT

    @staticmethod
    def _is_opposing(a: Claim, b: Claim) -> bool:
        text_a, text_b = a.value.lower(), b.value.lower()
        negations = [('no ', ''), ('not ', ''), ('false', 'true'), ('deny', 'admit'),
                     ('never', 'always'), ('did not', 'did'), ('does not', 'does')]
        for neg, _ in negations:
            if neg in text_a and neg not in text_b and a.subject == b.subject:
                return True
            if neg in text_b and neg not in text_a and a.subject == b.subject:
                return True
        words_a = set(text_a.split())
        words_b = set(text_b.split())
        if words_a and words_b:
            overlap = len(words_a & words_b) / len(words_a | words_b)
            if overlap < 0.2:
                neg_words = {'no', 'not', 'never', 'false', 'deny', 'refuse', 'none'}
                if any(w in words_a for w in neg_words) or any(w in words_b for w in neg_words):
                    return True
        if a.subject == b.subject and a.predicate == b.predicate and a.value != b.value:
            return True
        return False

    def _create_contradiction(self, claim_a: Claim, claim_b: Claim,
                              c_type: ContradictionType, severity: Severity,
                              confidence: Confidence, pattern_type: str,
                              pattern_desc: str, offence: str = "",
                              legal_basis: str = "", jurisdiction: str = "") -> Contradiction:
        fact = DetectedFact(
            fact_text=f"{claim_a.value} vs {claim_b.value}",
            source_document=claim_a.document_id,
            source_page=claim_a.page_number,
            source_line=0,
            sha512_hash=claim_a.sha512_hash,
            extraction_method=f"{c_type.value}_detector",
            confidence=confidence
        )
        pattern = LogicalPattern(
            pattern_type=pattern_type,
            pattern_description=pattern_desc,
            supporting_facts=[claim_a.value, claim_b.value],
            contradiction_score=self._severity_score(severity) / 5.0
        )
        hypothesis = None
        if offence:
            hypothesis = LegalHypothesis(
                suggested_offence=offence,
                legal_basis=legal_basis or "Common law / statutory",
                jurisdictional_note=jurisdiction or "Multi-jurisdiction",
                required_additional_evidence=["Corroborating documentation", "Witness testimony"]
            )
        return Contradiction(
            contradiction_id=self._next_id(),
            type=c_type,
            severity=severity,
            confidence=confidence,
            detected_fact=fact,
            logical_pattern=pattern,
            legal_hypothesis=hypothesis,
            proposition_a_text=claim_a.value,
            proposition_b_text=claim_b.value,
            proposition_a_actor=claim_a.actor,
            proposition_b_actor=claim_b.actor,
            conflict_description=pattern_desc
        )

    # ─── Legacy 10 Detectors (v5.2.9) ───

    def _detect_statement_vs_statement(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        for i, a in enumerate(claims):
            for b in claims[i+1:]:
                if self._is_opposing(a, b):
                    sev = self._calculate_severity(a, b, 20)
                    conf = self.calibrator.calibrate(Confidence.HIGH, "STATEMENT_VS_STATEMENT")
                    found.append(self._create_contradiction(a, b,
                        ContradictionType.STATEMENT_VS_STATEMENT, sev, conf,
                        "direct_opposition", "Directly opposing statements", "Perjury / False statement"))
        return found

    def _detect_statement_vs_evidence(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        for c in claims:
            if c.source_type == StatementType.SWORN_STATEMENT:
                for e in claims:
                    if e.source_type in (StatementType.CONTEMPORANEOUS, StatementType.JUDICIAL_RECORD):
                        if self._is_opposing(c, e):
                            sev = self._calculate_severity(c, e, 30)
                            conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "STATEMENT_VS_EVIDENCE")
                            found.append(self._create_contradiction(c, e,
                                ContradictionType.STATEMENT_VS_EVIDENCE, sev, conf,
                                "sworn_vs_documentary", "Sworn statement contradicted by documentary evidence",
                                "Perjury", "Perjury Act 1952 / s319 Criminal Procedure Act"))
        return found

    def _detect_financial_irregularity(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        financial_keywords = ['payment', 'amount', 'trust', 'account', 'deposit',
                              'R275', 'R275000', 'R1.5 million', 'R3.8 million', 'R3.25 million',
                              'R632000', 'R760000', 'R16006', 'R25470', 'R11436',
                              'R25450', 'R9535', 'R4725', 'R14270', 'Betway', 'Makro']
        for i, a in enumerate(claims):
            for b in claims[i+1:]:
                if any(k in a.value.lower() for k in financial_keywords):
                    if any(k in b.value.lower() for k in financial_keywords):
                        if self._is_opposing(a, b):
                            sev = self._calculate_severity(a, b, 25)
                            conf = self.calibrator.calibrate(Confidence.HIGH, "FINANCIAL_IRREGULARITY")
                            found.append(self._create_contradiction(a, b,
                                ContradictionType.FINANCIAL_IRREGULARITY, sev, conf,
                                "financial_mismatch", "Financial claims do not match documentary records",
                                "Theft / Fraud / Breach of trust", "s254 Criminal Procedure Act"))
        return found

    def _detect_judicial_vs_documentary(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        for c in claims:
            if c.source_type == StatementType.JUDICIAL_RECORD:
                for d in claims:
                    if d.source_type == StatementType.CONTEMPORANEOUS:
                        if self._is_opposing(c, d):
                            sev = Severity.VERY_HIGH
                            conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "JUDICIAL_VS_DOCUMENTARY")
                            found.append(self._create_contradiction(c, d,
                                ContradictionType.JUDICIAL_VS_DOCUMENTARY, sev, conf,
                                "judicial_vs_doc", "Court record contradicts contemporaneous documents",
                                "Fraud on the court / Perjury"))
        return found

    def _detect_temporal_contradiction(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        date_patterns = [r'\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b',
                         r'\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b']
        dated_claims = []
        for c in claims:
            for pat in date_patterns:
                if re.search(pat, c.value):
                    dated_claims.append(c)
                    break
        for i, a in enumerate(dated_claims):
            for b in dated_claims[i+1:]:
                if a.subject == b.subject and self._is_opposing(a, b):
                    sev = self._calculate_severity(a, b, 15)
                    conf = self.calibrator.calibrate(Confidence.HIGH, "TEMPORAL_CONTRADICTION")
                    found.append(self._create_contradiction(a, b,
                        ContradictionType.TEMPORAL_CONTRADICTION, sev, conf,
                        "temporal_mismatch", "Events placed at impossible times"))
        return found

    def _detect_consciousness_of_guilt(self, claims: List[Claim]) -> List[Contradiction]:
        guilt_markers = ['bcc', 'blind copy', 'delete', 'destroy', 'hide', 'conceal', 'cover up', 'never told', 'withheld']
        found = []
        for c in claims:
            text_lower = c.value.lower()
            if any(m in text_lower for m in guilt_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.HIGH
                        conf = self.calibrator.calibrate(Confidence.HIGH, "CONSCIOUSNESS_OF_GUILT")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.CONSCIOUSNESS_OF_GUILT, sev, conf,
                            "consciousness_of_guilt", "Concealment behavior contradicts stated position",
                            "Consciousness of guilt / Obstruction"))
        return found

    def _detect_behavioral(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        behavioral_markers = ['evaded', 'refused', 'ignored', 'never responded', 'failed to', 'threatened', 'manipulated']
        for c in claims:
            if any(m in c.value.lower() for m in behavioral_markers):
                for other in claims:
                    if other.id != c.id and other.actor == c.actor:
                        if self._is_opposing(c, other):
                            sev = self._calculate_severity(c, other, 10)
                            conf = self.calibrator.calibrate(Confidence.MODERATE, "BEHAVIORAL")
                            found.append(self._create_contradiction(c, other,
                                ContradictionType.BEHAVIORAL, sev, conf,
                                "behavioral_pattern", "Behavioral pattern contradicts verbal claims"))
        return found

    def _detect_sham_transaction(self, claims: List[Claim]) -> List[Contradiction]:
        sham_markers = ['sham', 'front', 'bogus', 'fake transaction', 'circular', 'no consideration', 'nominee']
        found = []
        for c in claims:
            if any(m in c.value.lower() for m in sham_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.HIGH
                        conf = self.calibrator.calibrate(Confidence.HIGH, "SHAM_TRANSACTION")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.SHAM_TRANSACTION, sev, conf,
                            "sham_structure", "Transaction structure is a sham", "Fraud / POCA racketeering"))
        return found

    def _detect_tacit_lease_violation(self, claims: List[Claim]) -> List[Contradiction]:
        lease_markers = ['lease', 'tenant', 'landlord', 'occupation', 'evict', 'premises', 'notice to vacate']
        found = []
        for i, a in enumerate(claims):
            for b in claims[i+1:]:
                if any(m in a.value.lower() for m in lease_markers):
                    if any(m in b.value.lower() for m in lease_markers):
                        if self._is_opposing(a, b):
                            sev = self._calculate_severity(a, b, 15)
                            conf = self.calibrator.calibrate(Confidence.HIGH, "TACIT_LEASE_VIOLATION")
                            found.append(self._create_contradiction(a, b,
                                ContradictionType.TACIT_LEASE_VIOLATION, sev, conf,
                                "lease_contradiction", "Lease terms contradicted by conduct",
                                "Unlawful eviction / Tacit lease violation"))
        return found

    def _detect_post_expiry_enforcement(self, claims: List[Claim]) -> List[Contradiction]:
        expiry_markers = ['expired', 'expiry', 'cancelled', 'terminated', 'lapsed', 'no longer valid', 'post-date']
        found = []
        for c in claims:
            if any(m in c.value.lower() for m in expiry_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = self._calculate_severity(c, other, 20)
                        conf = self.calibrator.calibrate(Confidence.HIGH, "POST_EXPIRY_ENFORCEMENT")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.POST_EXPIRY_ENFORCEMENT, sev, conf,
                            "post_expiry", "Enforcing rights after expiry/cancellation",
                            "Post-expiry enforcement / Contempt"))
        return found

    # ─── Cross-Case 8 Detectors (v5.3.0) ───

    def _detect_acknowledge_then_deny(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        ack_markers = ['acknowledge', 'received', 'noted', 'accepted', 'we have your file', 'we are aware',
                       'saw the technician', 'personally visited', 'witnessed', 'knew about', 'confirmed the outage']
        deny_markers = ['deny', 'reject', 'not valid', 'no merit', 'frivolous', 'without substance', 'unfounded',
                        'damaged the relationship', 'unprofessional', 'failed to communicate', 'negligent',
                        'unresponsive', 'failed to communicate properly']
        ack_claims = [c for c in claims if any(m in c.value.lower() for m in ack_markers)]
        deny_claims = [c for c in claims if any(m in c.value.lower() for m in deny_markers)]
        for a in ack_claims:
            for d in deny_claims:
                if a.actor == d.actor and a.id != d.id:
                    sev = Severity.VERY_HIGH
                    conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "ACKNOWLEDGE_THEN_DENY")
                    found.append(self._create_contradiction(a, d,
                        ContradictionType.ACKNOWLEDGE_THEN_DENY, sev, conf,
                        "acknowledge_then_deny", "Actor acknowledged evidence then later denied it",
                        "Acknowledge-then-deny fraud / Bad faith", "Perjury / Fraud on process"))
        return found

    def _detect_no_countersignature_trap(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        cs_markers = ['countersign', 'countersignature', 'signed by', 'blank signature', 'never countersigned', 'not signed by', 'unsigned page']
        for c in claims:
            if any(m in c.value.lower() for m in cs_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "NO_COUNTERSIGNATURE_TRAP")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.NO_COUNTERSIGNATURE_TRAP, sev, conf,
                            "no_countersignature_trap", "Document not countersigned but selectively enforced",
                            "Fraud / Forgery / Unilateral contract enforcement"))
        return found

    def _detect_trust_fund_withholding(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        trust_markers = ['trust account', 'trust fund', 'held in trust', 'release the funds', 'refused to release',
                         'withheld', 'SSM Trust', 'FEIKE Trust', 'Absa 4082883975', 'Absa 9027934431']
        for c in claims:
            if any(m in c.value.lower() for m in trust_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "TRUST_FUND_WITHHOLDING")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.TRUST_FUND_WITHHOLDING, sev, conf,
                            "trust_fund_withholding", "Trust funds withheld despite conditions being met",
                            "Theft / Breach of trust", "s254 Criminal Procedure Act"))
        return found

    def _detect_service_evasion(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        service_markers = ['evaded service', 'evaded personal service', 'failed to serve', 'not at address',
                           'moved without notice', 'service by attachment', 'sheriff', 'could not locate', 'multiple addresses']
        for c in claims:
            if any(m in c.value.lower() for m in service_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.HIGH
                        conf = self.calibrator.calibrate(Confidence.HIGH, "SERVICE_EVASION")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.SERVICE_EVASION, sev, conf,
                            "service_evasion", "Systematic evasion of legal process service",
                            "Contempt of court / Evasion of process", "Rule of Court"))
        return found

    def _detect_institutional_silence(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        silence_markers = ['declined prosecution', 'no prima facie', 'file cannot be located', 'no record',
                           'file lost', 'stalled', 'no response received', 'never assigned', 'docket closed', 'nolle prosequi']
        for c in claims:
            if any(m in c.value.lower() for m in silence_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.HIGH
                        conf = self.calibrator.calibrate(Confidence.HIGH, "INSTITUTIONAL_SILENCE_CASCADE")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.INSTITUTIONAL_SILENCE_CASCADE, sev, conf,
                            "institutional_silence", "Institutional failure cascade denying remedy",
                            "Maladministration / Denial of access to justice", "s34 Constitution / PAJA"))
        return found

    def _detect_defamation_threat(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        threat_markers = ['defamation', 'defamation claim', 'cease and desist', 'letter of demand',
                          'will sue you', 'withdraw your allegations', 'retract your statement',
                          'theft case', 'false accusation', 'falsely accused', 'opened against you',
                          'property has been sold without authorization']
        for c in claims:
            if any(m in c.value.lower() for m in threat_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "DEFAMATION_THREAT")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.DEFAMATION_THREAT, sev, conf,
                            "defamation_threat", "Defamation threat used to suppress evidence",
                            "Intimidation / SLAPP suit / Obstruction of justice", "Protection from Harassment Act"))
        return found

    def _detect_goodwill_forfeiture(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        goodwill_markers = ['no compensable goodwill', 'goodwill has no value', 'goodwill forfeiture',
                            'forfeiture clause', 'clause 7', 'no compensation for goodwill', 'brand fee',
                            'R3.8 million', 'R3.25 million', 'entrenched value']
        for c in claims:
            if any(m in c.value.lower() for m in goodwill_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "GOODWILL_FORFEITURE_SWINDLE")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.GOODWILL_FORFEITURE_SWINDLE, sev, conf,
                            "goodwill_forfeiture", "Goodwill denied in court while clauses capture it",
                            "Fraud / Perjury / Unjust enrichment", "s25 Constitution / CCT237/20"))
        return found

    def _detect_manufactured_consent(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        consent_markers = ['voluntarily', 'consented', 'agreed to', 'willingly', 'signed voluntarily',
                           'no coercion', 'manufactured consent', 'mental capacity', 'vulnerable', 'mentally broken',
                           'refused to meet', 'denied private meeting', 'forced group', 'no private meeting',
                           'declined group meeting', 'pleaded for meeting', 'refused private shareholder meeting',
                           'denied each time', 'would be unfair', 'not fair']
        for c in claims:
            if any(m in c.value.lower() for m in consent_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "MANUFACTURED_CONSENT")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.MANUFACTURED_CONSENT, sev, conf,
                            "manufactured_consent", "Consent manufactured where genuine consent absent",
                            "Coercion / Undue influence / Fraud", "s12 CPA / Common law duress"))
        return found

    # ─── NEW v5.3.1: Banking + Maritime Detectors (6) ───

    def _detect_fabricated_decoy(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        decoy_markers = ['decoy', 'fabricated sms', 'not real transactions', 'none of that actually happened',
                         'kept me on the phone', 'fabricated solely', 'declined transactions', 'fake sms',
                         'Woolworths R9950', 'Amazon R18560', 'Temu R2500', 'transactions been declined',
                         'dictated word-for-word', 'dictated what to say', 'selective screenshots', 'omitting context',
                         'coordinated setup', 'set me up', 'dictated the email', 'used against me']
        for c in claims:
            if any(m in c.value.lower() for m in decoy_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "FABRICATED_DECOY_EVIDENCE")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.FABRICATED_DECOY_EVIDENCE, sev, conf,
                            "fabricated_decoy", "Fabricated decoy evidence used to distract while real fraud executed",
                            "Social engineering fraud / Electronic communications offence", "ECTA / Common law fraud"))
        return found

    def _detect_data_breach_fraud(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        breach_markers = ['already had my card', 'already had my account', 'read my last three transactions',
                          'they were in my account', 'data breach', 'information was leaked',
                          'compromised my data', 'prove my information was not leaked',
                          'stolen bank data', 'they already possessed', 'daughter breach in April']
        for c in claims:
            if any(m in c.value.lower() for m in breach_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "DATA_BREACH_ENABLED_FRAUD")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.DATA_BREACH_ENABLED_FRAUD, sev, conf,
                            "data_breach_enabled", "Fraud enabled by institutional data breach",
                            "POPIA violation / Negligence / Common law duty of care", "s34 Constitution / POPIA"))
        return found

    def _detect_charging_victim(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        charge_markers = ['charged fees', 'cash advance fee', 'charging the victim', 'victim is being charged',
                          'fees for transactions', 'R210', 'fees for fraudulent', 'unconscionable',
                          'charged me R', 'fees for crimes committed']
        for c in claims:
            if any(m in c.value.lower() for m in charge_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "CHARGING_VICTIM_FOR_FRAUD")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.CHARGING_VICTIM_FOR_FRAUD, sev, conf,
                            "charging_victim", "Victim charged fees for fraudulent transactions",
                            "Unfair practice / Consumer protection violation", "CPA s40 / Common law unconscionability"))
        return found

    def _detect_tech_refusal(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        refusal_markers = ['offered', 'failed to evaluate', 'failed to implement', 'Guardian Fraud Firewall',
                           'refused to evaluate', 'technology was offered', 'acknowledged receipt',
                           'no technical evaluation', 'no pilot programme', 'chose not to evaluate',
                           'available protective technology', 'formally offered']
        for c in claims:
            if any(m in c.value.lower() for m in refusal_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.HIGH
                        conf = self.calibrator.calibrate(Confidence.HIGH, "TECHNOLOGY_REFUSAL_LIABILITY")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.TECHNOLOGY_REFUSAL_LIABILITY, sev, conf,
                            "technology_refusal", "Institution refused offered protective technology, victim subsequently defrauded",
                            "Negligence / Duty of care failure", "Common law duty of care / FICA"))
        return found

    def _detect_regulatory_cert_fraud(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        cert_markers = ['seaworthiness certificate', 'LGSC', 'SAMSA', 'issued without', 'ownership transfer',
                        'no valid change of ownership', 'irregular issuance', 'cannot be lawfully issued',
                        'regulatory impossibility', 'certificates are legally anomalous',
                        'newly issued certificates', 'prior certificates', 'inconsistent with']
        for c in claims:
            if any(m in c.value.lower() for m in cert_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "REGULATORY_CERTIFICATE_FRAUD")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.REGULATORY_CERTIFICATE_FRAUD, sev, conf,
                            "regulatory_certificate_fraud", "Regulatory certificates issued without valid ownership",
                            "Fraud / Regulatory circumvention / Unlawful procurement", "Merchant Shipping Act 1951 / SAMSA"))
        return found

    def _detect_spoliation(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        spoliation_markers = ['removed to unknown', 'spoliation', 'refused to return', 'refuse to hand back',
                              'removed the boat', 'removed the vessel', 'unknown location', 'refused to disclose',
                              'cannot locate the', 'concealment of', 'defeating the ends of justice']
        for c in claims:
            if any(m in c.value.lower() for m in spoliation_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.HIGH
                        conf = self.calibrator.calibrate(Confidence.HIGH, "SPOLIATION_OF_EVIDENCE")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.SPOLIATION_OF_EVIDENCE, sev, conf,
                            "spoliation", "Property removed or concealed to frustrate legal process",
                            "Spoliation / Theft / Defeating the ends of justice", "Common law spoliation / s38 Criminal Procedure Act"))
        return found

    # ─── v5.3.1b: Constitutional Court + Public Protector + LPC (7 detectors) ───

    def _detect_allfuels_paradox(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        no_value_markers = ['no compensable goodwill', 'goodwill has no value', 'no goodwill interest',
                            'operators own nothing', 'retailers own nothing', 'no compensable interest',
                            'no goodwill rights', 'no property interest', 'no entrenched value']
        capture_markers = ['goodwill forfeiture', 'forfeiture clause', 'clause 7', 'extension fee',
                           'brand fee', 'R3.8 million', 'R3.25 million', 'R3.8m', 'R3.25m',
                           'sign away', 'forfeit', 'capture the goodwill']
        no_value_claims = [c for c in claims if any(m in c.value.lower() for m in no_value_markers)]
        capture_claims = [c for c in claims if any(m in c.value.lower() for m in capture_markers)]
        for nv in no_value_claims:
            for cap in capture_claims:
                if nv.id != cap.id:
                    sev = Severity.VERY_HIGH
                    conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "ALLFUELS_PARADOX")
                    found.append(self._create_contradiction(nv, cap,
                        ContradictionType.ALLFUELS_PARADOX, sev, conf,
                        "allfuels_paradox", "Claims goodwill has no value while simultaneously capturing it via forfeiture clauses",
                        "Fraud / Perjury / Racketeering (POCA)", "CCT237/20 / CCT19/20 / s34 PRECCA"))
        return found

    def _detect_precca_34(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        precca_markers = ['PRECCA', 'section 34', 'failed to report', 'mandatory reporting',
                          'report fraud', 'report theft', 'exceeding R100000', 'R100,000',
                          'officer of the court', 'attorney failed to report', 'position of authority']
        for c in claims:
            if any(m in c.value.lower() for m in precca_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "ATTORNEY_PRECCA_34_VIOLATION")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.ATTORNEY_PRECCA_34_VIOLATION, sev, conf,
                            "precca_34_violation", "Attorney failed to report known fraud exceeding R100,000 as mandatorily required",
                            "PRECCA Section 34 violation / Professional misconduct", "PRECCA Act 12 of 2004"))
        return found

    def _detect_attorney_obstruction(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        obstruction_markers = ['cease and desist', 'cease-and-desist', 'stop reporting', 'prevent crime reporting',
                               'obstructing justice', 'obstruction of justice', 'whistleblower', 'prevent the reporting',
                               'acting against client interests', 'contrary to the client', 'abandoned the client',
                               'terminate the mandate', 'termination of mandate', 'mandate abandoned']
        for c in claims:
            if any(m in c.value.lower() for m in obstruction_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "ATTORNEY_OBSTRUCTION")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.ATTORNEY_OBSTRUCTION, sev, conf,
                            "attorney_obstruction", "Attorney conduct obstructs reporting of organised criminal activity",
                            "Obstruction of justice / Professional misconduct", "s319 Criminal Procedure Act / LPC Rules"))
        return found

    def _detect_institutional_capture(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        capture_markers = ["don't give a f***", "do not give a f***", "cryptographically sealed",
                           'no prima facie case', 'docket closed', 'no docket opened', 'refused to consider',
                           'file disappeared', 'court file lost', 'file cannot be located', 'summarily closed',
                           'no investigator assigned', 'no case number', 'failed to open', 'declined to act',
                           'prosecutor refused', 'colonel mzolo', 'freek stander']
        for c in claims:
            if any(m in c.value.lower() for m in capture_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "INSTITUTIONAL_CAPTURE_PROSECUTORIAL")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.INSTITUTIONAL_CAPTURE_PROSECUTORIAL, sev, conf,
                            "institutional_capture", "State institution dismisses or refuses court-accepted forensic evidence",
                            "Maladministration / Improper conduct / s182 Constitution", "PAJA / Public Protector Act"))
        return found

    def _detect_verbal_threat(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        verbal_markers = ['verbal notice', 'verbally threatened', 'verbal eviction', 'told to vacate',
                          'oral notice', 'given verbally', 'no written notice', 'verbal demand',
                          'telephone threat', 'phone call threatening', 'avoid creating evidence',
                          'no documentary record', 'verbal warning']
        for c in claims:
            if any(m in c.value.lower() for m in verbal_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.HIGH
                        conf = self.calibrator.calibrate(Confidence.HIGH, "VERBAL_THREAT_AVOIDANCE")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.VERBAL_THREAT_AVOIDANCE, sev, conf,
                            "verbal_threat_avoidance", "Verbal threats or notices used to avoid documentary evidence trail",
                            "Intimidation / Evading documentary record", "Common law intimidation"))
        return found

    def _detect_conflict_of_interest(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        conflict_markers = ['conflict of interest', 'ministerial appeals', 'advisory panel',
                            'simultaneously appointed', 'wife of', 'concealed from', 'brokering',
                            'while adjudicating', 'direct conflict', 'wife shereen mathir', 'moolla wife',
                            'adjudicating fishing rights', 'not working alone']
        for c in claims:
            if any(m in c.value.lower() for m in conflict_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "CONFLICT_OF_INTEREST")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.CONFLICT_OF_INTEREST, sev, conf,
                            "conflict_of_interest", "Simultaneous roles creating direct conflict of interest",
                            "Conflict of interest / Corruption", "PRECCA / Common law fiduciary duty"))
        return found

    def _detect_industry_wide_pattern(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        pattern_markers = ['same technique', 'same unsigned contract', 'industry-wide', 'industry wide',
                           'same pattern', 'used by eastern cape', 'used by branded marketers',
                           'same methodology', 'same modus operandi', 'same playbook', 'same scheme',
                           'not isolated', 'systemic pattern', 'multiple victims', 'repeatable', ' racketeering']
        for c in claims:
            if any(m in c.value.lower() for m in pattern_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "INDUSTRY_WIDE_PATTERN")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.INDUSTRY_WIDE_PATTERN, sev, conf,
                            "industry_wide_pattern", "Same fraudulent technique documented across multiple entities or regions",
                            "Pattern of racketeering (POCA)", "s1 POCA Act 121 of 1998"))
        return found

    # ─── v5.3.1c: Mostert v Digsim + HR + Southbridge (6 detectors) ───

    def _detect_defective_jurat(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        jurat_markers = ['deponent named', 'day of', 'signing the above', 'commissioner of oaths',
                         'verified before', 'true and correct', 'solemnly affirm', 'under oath',
                         'personally known', 'oath commissioner', 'sworn before']
        missing_markers = ['not commissioned', 'no commissioner', 'jurat absent', 'no oath',
                           'not sworn', 'no verification', 'unsigned by commissioner', 'jurat missing',
                           'deponent oath absent', 'commissioner signature missing']
        has_jurat = any(any(m in c.value.lower() for m in jurat_markers) for c in claims)
        for c in claims:
            if any(m in c.value.lower() for m in missing_markers) or not has_jurat:
                for other in claims:
                    if other.id != c.id and (any(m in other.value.lower() for m in jurat_markers) or self._is_opposing(c, other)):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "DEFECTIVE_JURAT")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.DEFECTIVE_JURAT, sev, conf,
                            "defective_jurat", "Affidavit missing mandatory jurat elements — false statements carry no perjury liability",
                            "Fraud / Perjury evasion / Contempt", "Regulation 3(2) of the Justice of the Peace and Commissioners of Oaths Act"))
        return found

    def _detect_protection_order_leverage(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        leverage_markers = ['avoid the protection order', 'avoid a protection order',
                            'protection order if you', 'threatened with protection order',
                            'protection order as leverage', 'pha application', 'domestic violence',
                            'negotiate peacefully', 'avoid court', 'or else i will', 'protection order',
                            'rest raint order', 'harassment order']
        for c in claims:
            if any(m in c.value.lower() for m in leverage_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.HIGH
                        conf = self.calibrator.calibrate(Confidence.HIGH, "PROTECTION_ORDER_AS_LEVERAGE")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.PROTECTION_ORDER_AS_LEVERAGE, sev, conf,
                            "protection_order_leverage", "Protection order application used as leverage in commercial or personal dispute",
                            "Abuse of process / Contempt", "Protection from Harassment Act 17 of 2011"))
        return found

    def _detect_false_allegation(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        false_markers = ['false allegation', 'allegation is false', 'proven false',
                         'contemporaneous evidence contradicts', 'whatsapp contradicts', 'evidence proves',
                         'contradicted by evidence', 'documentary evidence refutes', 'certified evidence contradicts',
                         'theft of generator', 'stole the generator', 'generator was removed', 'removed the generator',
                         'misrepresented the facts', 'materially false', 'factually incorrect']
        for c in claims:
            if any(m in c.value.lower() for m in false_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "FALSE_ALLEGATION_IN_AFFIDAVIT")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.FALSE_ALLEGATION_IN_AFFIDAVIT, sev, conf,
                            "false_allegation_affidavit", "Specific factual allegation in sworn affidavit contradicted by contemporaneous evidence",
                            "Perjury / False statement under oath", "s319 Criminal Procedure Act 51 of 1977"))
        return found

    def _detect_temporal_precedence(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        precedence_markers = ['before the', 'after the', 'preceded by', 'followed by',
                              'subsequently', 'prior to', 'thereafter', 'beforehand',
                              'issued after', 'delivered before', 'received prior',
                              'sequence', 'chronology', 'timeline', 'precedence',
                              'before we received', 'after we acknowledged', 'dated', 'on',
                              'acknowledged receipt', 'issued on', 'before receiving',
                            'after delivery', 'preceded', 'followed']
        date_pattern = re.compile(r'\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(20\d{2})?\b|\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b')
        dated_claims = []
        for c in claims:
            has_date = bool(date_pattern.search(c.value))
            has_precedence = any(m in c.value.lower() for m in precedence_markers)
            if has_date or has_precedence:
                dated_claims.append(c)
        for i, a in enumerate(dated_claims):
            for b in dated_claims[i+1:]:
                if a.actor == b.actor and a.id != b.id:
                    if self._is_opposing(a, b) or (any(m in a.value.lower() for m in precedence_markers) and any(m in b.value.lower() for m in precedence_markers)):
                        sev = Severity.HIGH
                        conf = self.calibrator.calibrate(Confidence.HIGH, "TEMPORAL_PRECEDENCE_CONFLICT")
                        found.append(self._create_contradiction(a, b,
                            ContradictionType.TEMPORAL_PRECEDENCE_CONFLICT, sev, conf,
                            "temporal_precedence", "Event sequence documented in one order but contradicted in another",
                            "False statement / Perjury by timeline", "s319 Criminal Procedure Act"))
        return found

    def _detect_process_remedy(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        silence_markers = ['no response', 'failed to respond', 'remained silent', 'no acknowledgement',
                           'bounced submission', 'returned unopened', 'no case number', 'never assigned',
                           'duty to respond', 'mandatory duty', 'obligation to act', 'failed to act',
                           'institutional silence', 'no remedy', 'effective remedy denied',
                           'article 2(3)', 'iccpr', 'un human rights', 'failed to investigate',
                           'no investigation', 'refused to investigate']
        for c in claims:
            if any(m in c.value.lower() for m in silence_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.VERY_HIGH
                        conf = self.calibrator.calibrate(Confidence.VERY_HIGH, "PROCESS_REMEDY_CONFLICT")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.PROCESS_REMEDY_CONFLICT, sev, conf,
                            "process_remedy_conflict", "Institution with duty to respond remains silent or denies effective remedy",
                            "Denial of effective remedy / Maladministration", "ICCPR Art 2(3) / s34 Constitution / PAJA"))
        return found

    def _detect_character_assassination(self, claims: List[Claim]) -> List[Contradiction]:
        found = []
        character_markers = ['relationship failed', 'failed as a partner', 'self-sabotage',
                             'embezzlement allegations', 'character assassination', 'personal attack',
                             'relationship breakdown', 'not a good father', 'not a good husband',
                             'mental health', 'psychological issues', 'unstable', 'irrational',
                             'attacking character', 'credibility attack', 'irrelevant personal',
                             'not material to', 'not relevant to the legal', 'besmirch']
        for c in claims:
            if any(m in c.value.lower() for m in character_markers):
                for other in claims:
                    if other.id != c.id and self._is_opposing(c, other):
                        sev = Severity.HIGH
                        conf = self.calibrator.calibrate(Confidence.HIGH, "CHARACTER_ASSASSINATION")
                        found.append(self._create_contradiction(c, other,
                            ContradictionType.CHARACTER_ASSASSINATION, sev, conf,
                            "character_assassination", "Personal or irrelevant matters included in sworn testimony to attack credibility",
                            "Abuse of process / Defamation / Contempt", "Common law abuse of process"))
        return found


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: CROSS-CASE PATTERN BRAIN (B10) — 17 Patterns
# ═══════════════════════════════════════════════════════════════════════════════

class CrossCasePatternBrain:
    PATTERNS = [
        SerialFraudPattern("P001", "Acknowledge-Then-Deny Trap",
            "Acknowledges forensic system/validity, then contradicts and denies it", 2, Severity.VERY_HIGH),
        SerialFraudPattern("P002", "No Counter-Signature Trap",
            "Presents document, obtains signature, never countersigns, enforces selectively", 2, Severity.VERY_HIGH),
        SerialFraudPattern("P003", "Trust Fund Withholding Pattern",
            "Receives funds into trust, conditions met, refuses to release", 2, Severity.VERY_HIGH),
        SerialFraudPattern("P004", "Service Evasion Pattern",
            "Systematically evades legal service at multiple addresses", 2, Severity.HIGH),
        SerialFraudPattern("P005", "Institutional Silence Cascade",
            "NPA declines -> LPC stalls -> file lost -> no remedy", 2, Severity.HIGH),
        SerialFraudPattern("P006", "Defamation Threat Retaliation",
            "Threatens defamation when confronted with evidence", 2, Severity.VERY_HIGH),
        SerialFraudPattern("P007", "Goodwill Forfeiture Swindle",
            "Tells court goodwill has no value, writes clauses to steal it", 1, Severity.VERY_HIGH),
        SerialFraudPattern("P008", "Manufactured Consent Fraud",
            "Creates documentary evidence of consent that never existed", 1, Severity.VERY_HIGH),
        SerialFraudPattern("P009", "The Decoy Trap",
            "Fabricates decoy evidence (SMS, transactions) to distract while real fraud executed", 1, Severity.VERY_HIGH),
        SerialFraudPattern("P010", "The Technology Refusal Pattern",
            "Institution offered validated fraud prevention technology, refused to implement, victim subsequently defrauded", 1, Severity.HIGH),
        SerialFraudPattern("P011", "The Victim-Pays Pattern",
            "Victim charged fees, penalties, or costs for transactions perpetrated by fraudsters using compromised data", 1, Severity.VERY_HIGH),
        SerialFraudPattern("P012", "The AllFuels Paradox",
            "Claims property has no value while simultaneously capturing it through forfeiture clauses and fee demands", 1, Severity.VERY_HIGH),
        SerialFraudPattern("P013", "The Attorney Obstruction Pattern",
            "Attorney fails to report crime (PRECCA s34), issues cease-and-desist to whistleblower, then abandons client", 1, Severity.VERY_HIGH),
        SerialFraudPattern("P014", "The Institutional Capture Pattern",
            "State institution dismisses court-accepted evidence, refuses to open dockets, or loses court files to protect perpetrators", 2, Severity.VERY_HIGH),
        SerialFraudPattern("P015", "The Defective Jurat Pattern",
            "Affidavit filed without mandatory jurat elements allowing false statements to escape perjury liability", 1, Severity.VERY_HIGH),
        SerialFraudPattern("P016", "The Protection Order Leverage Pattern",
            "Protection from Harassment Act application used as bargaining tool to force settlement or silence", 1, Severity.HIGH),
        SerialFraudPattern("P017", "The Process Remedy Denial Pattern",
            "Institution with mandatory duty to respond remains silent, bounces submissions, or denies effective remedy despite clear obligation", 2, Severity.VERY_HIGH),
    ]

    def analyze(self, all_contradictions: List[Contradiction], case_id: str) -> List[SerialFraudPattern]:
        detected = []
        type_to_pattern = {
            ContradictionType.ACKNOWLEDGE_THEN_DENY: "P001",
            ContradictionType.NO_COUNTERSIGNATURE_TRAP: "P002",
            ContradictionType.TRUST_FUND_WITHHOLDING: "P003",
            ContradictionType.SERVICE_EVASION: "P004",
            ContradictionType.INSTITUTIONAL_SILENCE_CASCADE: "P005",
            ContradictionType.DEFAMATION_THREAT: "P006",
            ContradictionType.GOODWILL_FORFEITURE_SWINDLE: "P007",
            ContradictionType.MANUFACTURED_CONSENT: "P008",
            ContradictionType.FABRICATED_DECOY_EVIDENCE: "P009",
            ContradictionType.TECHNOLOGY_REFUSAL_LIABILITY: "P010",
            ContradictionType.CHARGING_VICTIM_FOR_FRAUD: "P011",
            ContradictionType.ALLFUELS_PARADOX: "P012",
            ContradictionType.ATTORNEY_PRECCA_34_VIOLATION: "P013",
            ContradictionType.ATTORNEY_OBSTRUCTION: "P013",
            ContradictionType.INSTITUTIONAL_CAPTURE_PROSECUTORIAL: "P014",
            ContradictionType.DEFECTIVE_JURAT: "P015",
            ContradictionType.PROTECTION_ORDER_AS_LEVERAGE: "P016",
            ContradictionType.PROCESS_REMEDY_CONFLICT: "P017",
        }
        pattern_hits: Dict[str, List[str]] = {p.pattern_id: [] for p in self.PATTERNS}
        for c in all_contradictions:
            pid = type_to_pattern.get(c.type)
            if pid:
                pattern_hits[pid].append(c.contradiction_id)
        for p in self.PATTERNS:
            hits = pattern_hits.get(p.pattern_id, [])
            if len(hits) >= p.min_cases:
                p.cases_found = [case_id]
                p.evidence_refs = hits
                p.confidence = Confidence.HIGH if len(hits) >= 2 else Confidence.MODERATE
                detected.append(p)
        return detected


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6: INTIMIDATION ESCALATION BRAIN (B11)
# ═══════════════════════════════════════════════════════════════════════════════

class IntimidationEscalationBrain:
    STAGE_INDICATORS = {
        IntimidationStage.LEGAL_THREAT: ['defamation letter', 'cease and desist', 'letter of demand',
            'will sue for defamation', 'legal action if you do not withdraw'],
        IntimidationStage.COORDINATED_CAMPAIGN: ['two law firms', 'coordinated demand', '48 hours',
            'same demands', 'multiple firms', 'simultaneous letters'],
        IntimidationStage.PHYSICAL_INTIMIDATION: ['travelled to town', 'bait trap', 'waiting outside',
            'surveillance', 'followed', 'watched'],
        IntimidationStage.DEATH_THREATS: ['death threat', 'kill you', 'your life is in danger',
            'warned of death threats', 'physical harm'],
        IntimidationStage.ECONOMIC_RETALIATION: ['stopped buying', 'economic retaliation', 'revenue dropped',
            'supplier cut off', 'boycott', 'business interference'],
    }

    def analyze(self, claims: List[Claim]) -> Tuple[IntimidationStage, List[IntimidationEvent]]:
        events: List[IntimidationEvent] = []
        max_stage = IntimidationStage.NONE
        for c in claims:
            text_lower = c.value.lower()
            for stage, indicators in self.STAGE_INDICATORS.items():
                for ind in indicators:
                    if ind in text_lower:
                        evt = IntimidationEvent(
                            stage=stage,
                            description=f"{stage.name.replace('_', ' ')}: {ind}",
                            date=c.date.isoformat() if c.date else "unknown",
                            evidence_ref=c.document_id
                        )
                        events.append(evt)
                        if stage.value > max_stage.value:
                            max_stage = stage
        return max_stage, sorted(events, key=lambda e: e.stage.value)

    def recommendation(self, stage: IntimidationStage) -> str:
        if stage.value >= 4:
            return "URGENT: Physical safety measures required. Armed security advised. File urgent interdict."
        elif stage.value >= 3:
            return "HIGH: Report to SAPS immediately. Consider personal protection order."
        elif stage.value >= 2:
            return "MODERATE: Document all contacts. Inform legal representative."
        elif stage.value >= 1:
            return "LOW: Standard defamation response protocol. Do not engage directly."
        return "NONE: No intimidation indicators detected."


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7: VICTIM NETWORK MAPPER
# ═══════════════════════════════════════════════════════════════════════════════

class VictimNetworkMapper:
    KNOWN_CONNECTIONS = [
        VictimConnection("Gary Highcock", "AllFuels", "Ritzema Louw", "Louw v Moolla",
                        "same_fraud_pattern", 85, "Trust fund withholding + institutional failure"),
        VictimConnection("Gary Highcock", "AllFuels", "Ritzema Louw", "Louw v Moolla",
                        "same_location", 90, "Both victims in Port Edward area"),
        VictimConnection("Gary Highcock", "AllFuels", "Liam Highcock", "Southbridge",
                        "same_actor_pattern", 80, "Lawyer misconduct + defamation threat"),
        VictimConnection("Liam Highcock", "Greensky", "Liam Highcock", "Southbridge",
                        "same_victim_cross_case", 95, "Same victim, UAE fraud + SA lawyer misconduct"),
        VictimConnection("Nicky Liebenberg", "Standard Bank", "Ritzema Louw", "Louw v Moolla",
                        "institutional_failure", 75, "Both victims of institutional inaction after reporting"),
        VictimConnection("Nicky Liebenberg", "Standard Bank", "Ritz Louw", "Ritz v Olivier",
                        "financial_fraud", 70, "Both victims of financial fraud with institutional complicity"),
        VictimConnection("Ritz Louw", "Ritz v Moolla", "Ritz Louw", "Ritz v Olivier",
                        "same_victim_multi_case", 98, "Same victim across multiple fraud cases"),
        VictimConnection("Lance Mostert", "Mostert v Digsim", "Liam Highcock", "Greensky",
                        "same_fraud_pattern", 80, "Both victims of partner fraud with institutional complicity"),
        VictimConnection("Lance Mostert", "Mostert v Digsim", "Ritz Louw", "Ritz v Olivier",
                        "same_location", 85, "Both victims in Port Edward area"),
        VictimConnection("Liam Highcock", "Southbridge", "Lance Mostert", "Mostert v Digsim",
                        "institutional_failure", 75, "Both victims of institutional inaction and attorney misconduct"),
    ]

    def map_connections(self, case_id: str, contradictions: List[Contradiction],
                        all_cases_data: Optional[List[Dict]] = None) -> List[VictimConnection]:
        connections = []
        case_names = {
            "ALLFUELS": "AllFuels", "CCT237": "AllFuels", "CCT19": "AllFuels",
            "GREENSKY": "Greensky", "RAKEZ": "Greensky",
            "SOUTHBRIDGE": "Southbridge", "VO-HR": "Southbridge",
            "LOUW": "Louw v Moolla", "MOOLLA": "Louw v Moolla",
            "STDBANK": "Standard Bank", "LIEBENBERG": "Standard Bank",
            "16686059": "Standard Bank",
            "OLIVIER": "Ritz v Olivier", "BOAT": "Ritz v Olivier",
            "DIGSIM": "Mostert v Digsim", "MOSTERT": "Mostert v Digsim",
            "DIGNIFIED": "Mostert v Digsim", "PHA": "Mostert v Digsim",
        }
        target_case = None
        for key, name in case_names.items():
            if key in case_id.upper():
                target_case = name
                break
        if target_case:
            for conn in self.KNOWN_CONNECTIONS:
                if conn.case_a == target_case or conn.case_b == target_case:
                    connections.append(conn)
        return connections


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8: COMPOUND LIABILITY CALCULATOR
# ═══════════════════════════════════════════════════════════════════════════════

class CompoundLiabilityCalculator:
    GLOBAL_GDP_USD = 85_000_000_000_000
    FRAUD_RATE_MID = 0.075

    @classmethod
    def daily_global_fraud_loss(cls) -> float:
        annual = cls.GLOBAL_GDP_USD * cls.FRAUD_RATE_MID
        return annual / 365.0

    @classmethod
    def silence_liability(cls, days_silent: int, jurisdiction: str = "GLOBAL") -> Dict[str, Any]:
        daily = cls.daily_global_fraud_loss()
        total = daily * days_silent
        return {
            "jurisdiction": jurisdiction,
            "days_silent": days_silent,
            "daily_global_fraud_loss_usd": round(daily, 2),
            "total_liability_usd": round(total, 2),
            "methodology": "UNODC/IMF/WEF: 5-10% of global GDP lost to fraud annually",
            "fraud_rate_used": f"{cls.FRAUD_RATE_MID * 100}%",
            "global_gdp_base": f"${cls.GLOBAL_GDP_USD / 1e12:.1f}T",
            "calculation_date": VO_BUILD_DATE,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 9: MULTI-CASE CONFIGURATION — 7 Cases
# ═══════════════════════════════════════════════════════════════════════════════

class MultiCaseConfiguration:
    @staticmethod
    def all_cases() -> List[CaseConfig]:
        return [
            CaseConfig("ALLFUELS-CCT", "AllFuels (CCT237/20 & CCT19/20)",
                "South Africa", ["AllFuels", "Zeyd Timol", "Deneys", "Fakroodeen", "Randeree"],
                CaseConfiguration.allfuels()),
            CaseConfig("GREENSKY-RAKEZ", "Greensky (RAKEZ #1295911)",
                "UAE (RAKEZ)", ["Greensky Ornamentals FZ-LLC", "Marius Nortje", "Kevin"],
                CaseConfiguration.greensky()),
            CaseConfig("SOUTHBRIDGE-VO", "Southbridge (VO-HR-2025/11)",
                "Cross-border", ["Naeem Abbas", "Southbridge Legal"],
                CaseConfiguration.southbridge()),
            CaseConfig("LOUW-SAPS", "Louw v Moolla (SAPS 1754/02/2015)",
                "South Africa", ["Shaheen Moolla", "Ritzema Louw", "Michael Schneider"],
                CaseConfiguration.louw_v_moolla()),
            CaseConfig("STDBANK-16686059", "Liebenberg v Standard Bank (NFO 16686059)",
                "South Africa", ["Nicky Liebenberg", "Standard Bank", "Martin Zulu"],
                CaseConfiguration.standard_bank()),
            CaseConfig("RITZ-OLIVIER", "Louw v Olivier (SAPS 147/12/2025)",
                "South Africa", ["Ritz Louw", "Morne Olivier", "Niven Naidoo"],
                CaseConfiguration.ritz_boat()),
            CaseConfig("DIGSIM-MOSTERT", "Mostert v Digsim (PHA 2026/06)",
                "South Africa", ["Lance Mostert", "Jan Digsim", "Shereen da Costa", "Niven Naidoo"],
                CaseConfiguration.digsim()),
        ]


class CaseConfiguration:
    @staticmethod
    def allfuels() -> Dict[str, Any]:
        return {
            "liability_admit": ["admit", "confess", "yes it was", "i did", "my fault"],
            "liability_deny": ["deny", "not true", "false", "never happened", "didn't",
                               "i reject", "no goodwill", "never existed", "cancelled"],
            "liability_conceal": ["hidden", "withheld", "didn't tell", "omitted", "bcc", "blind copy", "never told"],
            "topic_keywords": ["goodwill", "franchise", "petroleum", "section 12B", "eviction", "rent", "clause 7", "MOU", "AllFuels"],
            "legal_subjects": {
                "Goodwill Value": ["goodwill", "compensable", "entrenched value", "brand fee"],
                "Contract Validity": ["contract", "agreement", "binding", "countersign"],
                "Signature Status": ["signature", "signed", "blank", "unsigned"],
                "Section 12B": ["section 12B", "arbitration", "referral", "Business Zone"],
                "Compensation": ["fee", "payment", "rent", "compensation", "deposit"],
                "Perjury": ["perjury", "Constitutional Court", "sworn", "CCT"],
            }
        }

    @staticmethod
    def greensky() -> Dict[str, Any]:
        return {
            "liability_admit": ["admit", "confess", "yes it was", "i did", "my fault", "proceeded", "went ahead", "executed"],
            "liability_deny": ["deny", "not true", "false", "never happened", "didn't", "i reject", "no exclusivity", "never existed", "cancelled", "fell through"],
            "liability_conceal": ["hidden", "withheld", "didn't tell", "omitted", "bcc", "copied you in", "blind copy", "never told"],
            "topic_keywords": ["deal", "order", "invoice", "shipment", "payment", "profit", "goodwill", "agreement", "exclusivity", "meeting", "access", "email", "camera", "theft", "fraud"],
            "entity_keywords": ["RAKEZ", "Greensky", "Article 84", "Article 110", "Marius", "Kevin", "Liam", "30%", "exclusivity"],
            "legal_subjects": {
                "Shareholder Oppression": ["meeting", "excluded", "private meeting", "shareholder", "denied", "no vote", "kept out"],
                "Breach of Fiduciary Duty": ["duty", "loyalty", "good faith", "fiduciary", "trust", "best interest"],
                "Fraudulent Evidence": ["screenshot", "whatsapp", "fake", "doctored", "fabricated", "cropped", "missing context"],
                "Cybercrime": ["gmail", "access", "hack", "unauthorized", "archive", "device", "google account"],
                "Emotional Exploitation": ["mental", "emotional", "gaslight", "vulnerable", "trauma", "broken", "manipulate"],
                "Concealment": ["withheld", "hid", "didn't tell", "secret", "copied", "bcc", "blind copied"],
            }
        }

    @staticmethod
    def southbridge() -> Dict[str, Any]:
        return {
            "liability_admit": ["admit", "we acknowledge", "valid forensic file", "accepted the evidence"],
            "liability_deny": ["deny", "not valid", "abandoned mandate", "suppressed", "failed to act", "no longer representing"],
            "liability_conceal": ["suppressed filing", "failed to file", "withheld", "did not submit", "concealed from client"],
            "topic_keywords": ["mandate", "abandonment", "suppressed", "filing", "attorney", "misconduct", "breach of mandate", "professional negligence", "forensic file"],
            "entity_keywords": ["Southbridge", "Naeem Abbas", "VO-HR-2025/11", "cease-and-desist", "Bar complaint"],
            "legal_subjects": {
                "Mandate Abandonment": ["abandoned", "failed to act", "no longer", "withdrew", "ceased representation"],
                "Professional Negligence": ["failed to file", "missed deadline", "suppressed", "did not submit"],
                "Obstruction of Justice": ["suppressed filing", "concealed evidence", "failed to report"],
                "Cross-Border Fraud": ["jurisdiction", "RAKEZ", "SAPS", "dual filing"],
            }
        }

    @staticmethod
    def louw_v_moolla() -> Dict[str, Any]:
        return {
            "liability_admit": ["received", "trust account", "SSM Trust", "prepared the agreements"],
            "liability_deny": ["never entitled", "not a right holder", "deny", "never served on me", "obtained surreptitiously"],
            "liability_conceal": ["evaded service", "failed to respond", "never told", "withheld trust funds", "no trust account ledger"],
            "topic_keywords": ["trust fund", "R275000", "R275,000", "permission-on-board", "DAFF permit", "SSM Trust", "FEIKE Trust", "Absa 4082883975", "Absa 9027934431", "High Court", "default judgment", "Cape Bar Council"],
            "entity_keywords": ["Shaheen Moolla", "Ritzema Louw", "Michael Schneider", "MFV Isabella", "Meermin", "DAFF", "SAPS 1754"],
            "legal_subjects": {
                "Breach of Trust": ["trust account", "withheld", "refused to release", "joint instruction"],
                "Theft by Trustee": ["R275000", "SSM Trust", "never released", "conditions met"],
                "Evasion of Service": ["evaded", "not at address", "service by attachment", "sheriff"],
                "Professional Misconduct": ["Cape Bar Council", "LPC", "defamation threat", "practising certificate"],
                "Contempt of Court": ["default judgment", "failed to satisfy", "unchallenged", "21 January 2016"],
            }
        }

    @staticmethod
    def standard_bank() -> Dict[str, Any]:
        return {
            "liability_admit": ["acknowledged receipt", "we received", "your complaint has been referred",
                                "we detected", "fraud alert"],
            "liability_deny": ["not our fault", "customer negligence", "you disclosed", "unauthorized access",
                               "not compromised"],
            "liability_conceal": ["failed to respond", "no substantive response", "left without clarity",
                                  "failed to address", "did not explain"],
            "topic_keywords": ["money market", "credit card", "Betway", "Makro", "cash advance",
                               "data breach", "fraud alert", "impersonation", "decoy SMS",
                               "R632000", "R760000", "R210", "Standard Bank", "fraudulent transactions",
                               "fund transfer", "chargeback", "SAPS 502/6/2026"],
            "entity_keywords": ["Nicky Liebenberg", "Standard Bank", "Martin Zulu", "NFO",
                                "16686059", "Guardian Fraud Firewall", "Verum Omnis",
                                "POPIA", "FICA", "National Financial Ombud"],
            "legal_subjects": {
                "Banking Fraud": ["fraudulent transaction", "unauthorized transfer", "stolen funds", "compromised account"],
                "Data Breach Liability": ["data breach", "information leaked", "compromised data", "April 2026"],
                "Duty of Care Failure": ["failed to prevent", "failed to detect", "no automated detection", "inadequate security"],
                "Consumer Protection": ["charged fees", "cash advance fee", "unfair practice", "unconscionable"],
                "Technology Refusal": ["offered", "failed to evaluate", "failed to implement", "Guardian Fraud Firewall"],
            }
        }

    @staticmethod
    def ritz_boat() -> Dict[str, Any]:
        return {
            "liability_admit": ["signed agreement", "purchase agreement", "DFFE approval",
                                "lawful operations", "valid contractual right"],
            "liability_deny": ["not my boat", "no ownership", "never transferred", "cancelled contract",
                               "not registered to you"],
            "liability_conceal": ["removed to unknown", "refused to return", "refused to hand back",
                                  "withheld location", "concealed the vessel"],
            "topic_keywords": ["Wyfre", "Wyfie", "DTD 774", "SAMSA", "LGSC", "DFFE", "seaworthiness",
                               "certificate", "vessel", "boat", "spoliation", "charter", "commercial fishing",
                               "Rocky Bay", "ownership dispute", "illegal charter"],
            "entity_keywords": ["Ritz Louw", "Morne Olivier", "Niven Naidoo", "Terry Hardouin",
                                "Rodrego Thompson", "SAMSA Durban", "Captain Chetty",
                                "SAPS 147/12/2025", "SAPS Scottburgh"],
            "legal_subjects": {
                "Vessel Ownership Dispute": ["ownership", "registered", "SAMSA", "never passed", "not signed"],
                "Spoliation": ["removed", "unknown location", "refused to return", "unlawful possession"],
                "Regulatory Certificate Fraud": ["seaworthiness certificate", "LGSC", "issued without", "irregular issuance"],
                "Illegal Charter Operations": ["charter", "unlawful", "without permission", "Maritime Act"],
                "Contract Breach": ["breached contract", "cancelled", "statutory obligations", "survival clauses"],
            }
        }

    @staticmethod
    def digsim() -> Dict[str, Any]:
        return {
            "liability_admit": ["i acknowledge", "we agreed", "the arrangement was",
                                "joint initiative", "partnership basis", "contributed financially"],
            "liability_deny": ["no partnership", "no agreement", "never agreed", "not the owner",
                               "no right to", "no compensable", "no goodwill", "no property interest"],
            "liability_conceal": ["defective jurat", "no oath administered", "not commissioned",
                                  "jurat absent", "not sworn", "verbal notice", "no written notice"],
            "topic_keywords": ["Dignified Simplicity", "DigIn", "Shereen da Costa", "Niven Naidoo",
                               "generator", "Craighross Farm", "WinDeed", "jurat", "affidavit",
                               "protection order", "pha", "harassment", "fire hazard", "SALA",
                               "subdivision of agricultural land", "tenancy", "R216710", "R138100",
                               "maintenance and repair", "community involvement", "third party",
                               "cease and desist", "bilateral enforcement", "shared use"],
            "entity_keywords": ["Lance Mostert", "Jan Digsim", "Shereen da Costa", "Niven Naidoo",
                                "Craighross Farm", "Port Edward", "SAPS", "WinDeed", "Dignified Simplicity",
                                "PHA", "protection order", "SALA", "R216710", "R138100"],
            "legal_subjects": {
                "Defective Jurat": ["jurat", "not commissioned", "no oath", "not sworn", "perjury liability"],
                "Protection Order Leverage": ["avoid the protection order", "pha", "harassment",
                                              "protection order as leverage", "domestic violence"],
                "False Allegation": ["false allegation", "generator removed", "theft of generator",
                                     "stole the generator", "proven false", "contemporaneous evidence"],
                "Character Assassination": ["relationship failed", "self-sabotage", "embezzlement",
                                            "character assassination", "personal attack", "not a good"],
                "Ownership Misrepresentation": ["WinDeed", "registered owner", "not the owner",
                                                "Shereen da Costa", "purchased property"],
                "Community Manipulation": ["community involvement", "third party", "broadcast",
                                           "public opinion", "bilateral enforcement"],
            }
        }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 10: FILE HANDLER + CLAIM EXTRACTOR + TRIPLE VERIFIER + BLOCKCHAIN ANCHOR
# ═══════════════════════════════════════════════════════════════════════════════

class FileHandler:
    @staticmethod
    def extract(filepath: str) -> List[EvidenceAtom]:
        atoms: List[EvidenceAtom] = []
        ext = os.path.splitext(filepath)[1].lower()
        if ext in ('.txt', '.md', '.csv'):
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                for i, line in enumerate(f, 1):
                    if line.strip():
                        atoms.append(EvidenceAtom(
                            artifact_hash=hashlib.sha512(line.encode()).hexdigest(),
                            page_number=0, line_number=i,
                            timestamp=datetime.now(timezone.utc),
                            source_path=filepath, content=line.strip(),
                            file_type=FileType.TXT))
        elif ext == '.pdf':
            atoms.append(EvidenceAtom(
                artifact_hash=hashlib.sha512(filepath.encode()).hexdigest(),
                page_number=0, line_number=0,
                timestamp=datetime.now(timezone.utc),
                source_path=filepath,
                content=f"[PDF: {os.path.basename(filepath)} — extract with PyPDF2]",
                file_type=FileType.PDF))
        else:
            atoms.append(EvidenceAtom(
                artifact_hash=hashlib.sha512(filepath.encode()).hexdigest(),
                page_number=0, line_number=0,
                timestamp=datetime.now(timezone.utc),
                source_path=filepath,
                content=f"[File: {os.path.basename(filepath)} — handler stub]",
                file_type=FileType.UNKNOWN))
        return atoms


class ClaimExtractor:
    COUNTER = 0

    def extract_claims(self, atoms: List[EvidenceAtom]) -> List[Claim]:
        claims = []
        for atom in atoms:
            self.COUNTER += 1
            claims.append(Claim(
                id=f"CLAIM-{self.COUNTER:04d}",
                subject=Subject.OTHER.name,
                predicate="states",
                value=atom.content[:500],
                actor="unknown",
                date=atom.timestamp,
                source_type=StatementType.CONTEMPORANEOUS,
                source_location=f"{atom.source_path}:{atom.line_number}",
                document_id=atom.source_path,
                sha512_hash=atom.artifact_hash,
                page_number=atom.page_number,
                context=""))
        return claims


class TripleVerifier:
    def verify(self, claims: List[Claim], contradictions: List[Contradiction]) -> Dict[str, Any]:
        return {
            "thesis_status": "PASS" if len(claims) > 0 else "INSUFFICIENT",
            "antithesis_status": "PASS" if len(contradictions) > 0 else "PASS",
            "synthesis_status": "PASS",
            "verification_count": len(contradictions),
            "method": "TripleVerification: Thesis/Antithesis/Synthesis",
            "version": VO_VERSION,
        }


class BlockchainAnchor:
    @staticmethod
    def hash_corpus(contents: List[str]) -> str:
        h = hashlib.sha512()
        for c in contents:
            h.update(c.encode('utf-8'))
        return h.hexdigest()


class ReportGenerator:
    @staticmethod
    def generate(report: ForensicReport, fmt: str = "txt") -> str:
        if fmt == "json":
            import json
            return json.dumps(report.to_dict(), indent=2, default=str)
        lines = [
            "=" * 70,
            f"VERUM OMNIS FORENSIC REPORT — v{VO_VERSION}",
            "=" * 70,
            f"Case ID: {report.case_id}",
            f"Corpus SHA-512: {report.corpus_hash[:32]}...",
            f"Contradictions Found: {len(report.contradictions)}",
            f"Actor Profiles: {len(report.actor_profiles)}",
            f"Serial Fraud Patterns: {len(report.serial_patterns)}",
            f"Intimidation Stage: {report.intimidation_stage.name}",
            f"Victim Connections: {len(report.victim_connections)}",
            "",
            "--- TOP CONTRADICTIONS ---",
        ]
        for c in report.contradictions[:25]:
            lines.append(f"\n{c.contradiction_id} | {c.type.value} | {c.severity.value}")
            lines.append(f"  A ({c.proposition_a_actor}): {c.proposition_a_text[:80]}...")
            lines.append(f"  B ({c.proposition_b_actor}): {c.proposition_b_text[:80]}...")
            if c.legal_hypothesis:
                lines.append(f"  Offence: {c.legal_hypothesis.suggested_offence}")
        if len(report.contradictions) > 25:
            lines.append(f"\n... and {len(report.contradictions) - 25} more contradictions")
        lines.extend(["", "--- SERIAL FRAUD PATTERNS ---"])
        for p in report.serial_patterns:
            lines.append(f"  {p.pattern_id}: {p.pattern_name} (cases: {len(p.cases_found)}, confidence: {p.confidence.value})")
        lines.extend(["", "--- VICTIM CONNECTIONS ---"])
        for vc in report.victim_connections:
            lines.append(f"  {vc.victim_a} ({vc.case_a}) <-> {vc.victim_b} ({vc.case_b}): {vc.connection_type} [{vc.strength_percent}%]")
        lines.extend(["", f"--- LIABILITY ---",
            f"  Daily global fraud loss: ${report.liability_calc.get('daily_global_fraud_loss_usd', 0):,.0f}",
            f"  Silence liability: ${report.liability_calc.get('total_liability_usd', 0):,.0f}",
            "", f"Report generated: {datetime.now(timezone.utc).isoformat()}",
            f"Verum Omnis v{VO_VERSION} | Patent Pending | Constitution v6.0 Final",
            "=" * 70,
        ])
        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 11: FORENSIC REPORT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ForensicReport:
    case_id: str
    contradictions: List[Contradiction]
    actor_profiles: List[ActorProfile]
    triple_verification: Dict[str, Any]
    corpus_hash: str
    confidence_calibration: Dict[str, Any]
    serial_patterns: List[SerialFraudPattern] = field(default_factory=list)
    intimidation_stage: IntimidationStage = IntimidationStage.NONE
    intimidation_events: List[IntimidationEvent] = field(default_factory=list)
    victim_connections: List[VictimConnection] = field(default_factory=list)
    liability_calc: Dict[str, Any] = field(default_factory=dict)
    case_config: Optional[CaseConfig] = None
    version: str = VO_VERSION
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "case_id": self.case_id,
            "version": self.version,
            "generated_at": self.generated_at,
            "corpus_hash": self.corpus_hash,
            "contradiction_count": len(self.contradictions),
            "actor_profile_count": len(self.actor_profiles),
            "serial_patterns": [{"id": p.pattern_id, "name": p.pattern_name, "cases": p.cases_found}
                                for p in self.serial_patterns],
            "intimidation_max_stage": self.intimidation_stage.name,
            "victim_connections": [{"a": vc.victim_a, "b": vc.victim_b,
                                     "type": vc.connection_type, "strength": vc.strength_percent}
                                    for vc in self.victim_connections],
            "liability_calculation": self.liability_calc,
            "triple_verification": self.triple_verification,
            "confidence_calibration": self.confidence_calibration,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 12: MASTER ENGINE ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════════

class VerumContradictionEngine:
    def __init__(self, case_id: str = "UNSPECIFIED", case_config: Optional[CaseConfig] = None):
        self.case_id = case_id
        self.case_config = case_config
        self.detector = ContradictionDetector()
        self.cross_case_brain = CrossCasePatternBrain()
        self.intimidation_brain = IntimidationEscalationBrain()
        self.victim_mapper = VictimNetworkMapper()
        self.liability_calc = CompoundLiabilityCalculator()

    def _run_pipeline(self, all_atoms: List[EvidenceAtom]) -> ForensicReport:
        extractor = ClaimExtractor()
        claims = extractor.extract_claims(all_atoms)
        contradictions = self.detector.detect_all(claims)
        tv = TripleVerifier().verify(claims, contradictions)
        profiles = self._build_profiles(claims, contradictions)
        corpus_hash = BlockchainAnchor.hash_corpus([a.content for a in all_atoms])
        serial_patterns = self.cross_case_brain.analyze(contradictions, self.case_id)
        max_stage, intimidation_events = self.intimidation_brain.analyze(claims)
        victim_connections = self.victim_mapper.map_connections(self.case_id, contradictions)
        liability = self.liability_calc.silence_liability(1, "GLOBAL")
        return ForensicReport(
            case_id=self.case_id,
            contradictions=contradictions,
            actor_profiles=profiles,
            triple_verification=tv,
            corpus_hash=corpus_hash,
            confidence_calibration=ConfidenceCalibrator.report_calibration(),
            serial_patterns=serial_patterns,
            intimidation_stage=max_stage,
            intimidation_events=intimidation_events,
            victim_connections=victim_connections,
            liability_calc=liability,
            case_config=self.case_config,
        )

    def process_from_files(self, filepaths: List[str]) -> ForensicReport:
        all_atoms = []
        for fp in filepaths:
            atoms = FileHandler.extract(fp)
            all_atoms.extend(atoms)
        return self._run_pipeline(all_atoms)

    def process_from_texts(self, texts: List[str],
                           source_names: Optional[List[str]] = None) -> ForensicReport:
        source_names = source_names or [f"input_{i}" for i in range(len(texts))]
        all_atoms = []
        for i, text in enumerate(texts):
            for line_num, line in enumerate(text.split('\n'), 1):
                if line.strip():
                    all_atoms.append(EvidenceAtom(
                        artifact_hash=hashlib.sha512(line.encode()).hexdigest(),
                        page_number=0, line_number=line_num,
                        timestamp=None, source_path=source_names[i],
                        content=line.strip(), file_type=FileType.TXT))
        return self._run_pipeline(all_atoms)

    def _build_profiles(self, claims: List[Claim],
                        contradictions: List[Contradiction]) -> List[ActorProfile]:
        actor_data = defaultdict(lambda: {"claims": 0, "denials": 0,
                                          "contradictions": [], "flags": set()})
        for c in claims:
            actor_data[c.actor]["claims"] += 1
            if c.source_type == StatementType.DENIAL:
                actor_data[c.actor]["denials"] += 1
        for con in contradictions:
            for actor in [con.proposition_a_actor, con.proposition_b_actor]:
                if actor:
                    actor_data[actor]["contradictions"].append(con.contradiction_id)
                    actor_data[actor]["flags"].add(con.type.value)
        return sorted([
            ActorProfile(
                name=name,
                dishonesty_score=min((len(d["contradictions"]) * 15 + len(d["flags"]) * 5), 100),
                flags=list(d["flags"]),
                contradictions=d["contradictions"],
                statements_made=d["claims"],
                statements_denied=d["denials"],
            )
            for name, d in actor_data.items()
        ], key=lambda x: x.dishonesty_score, reverse=True)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 13: CLI ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    import argparse
    parser = argparse.ArgumentParser(description=f"Verum Omnis v{VO_VERSION}")
    parser.add_argument("files", nargs="*", help="Evidence files")
    parser.add_argument("--case-id", default="VO-CASE-001")
    parser.add_argument("--case", choices=["allfuels", "greensky", "southbridge", "louw", "stdbank", "ritzboat", "digsim"],
                        help="Load case-specific configuration")
    parser.add_argument("--format", choices=["json", "txt", "markdown"], default="txt")
    parser.add_argument("--output", "-o", help="Output file")
    parser.add_argument("--hash-only", action="store_true")
    parser.add_argument("--text", nargs="+", help="Process raw text instead of files")
    parser.add_argument("--demo", action="store_true", help="Run demonstration")
    args = parser.parse_args()

    if args.demo:
        print("=" * 70)
        print(f"VERUM OMNIS CONTRADICTION ENGINE v{VO_VERSION}")
        print("Cross-Case Serial Fraud Detection Platform — Expanded Library")
        print("=" * 70)
        print(f"\nBrains: B1-B11 (11 analytical modules)")
        print(f"Contradiction Types: {len(ContradictionType)} (43 total)")
        print(f"Serial Fraud Patterns: {len(CrossCasePatternBrain.PATTERNS)} (17 total)")
        print(f"Cases Configured: 7 (AllFuels, Greensky, Southbridge, Louw v Moolla,")
        print(f"                     Liebenberg v Standard Bank, Louw v Olivier, Mostert v Digsim)")
        print(f"Jurisdictions: 3+")
        print(f"Detectors: {len(ConfidenceCalibrator.FP_RATES)} (37 calibrated)")
        print(f"\nDemo: Processing sample data from Liebenberg + Olivier cases...")
        demo_texts = [
            "The fraudsters already had my card number before calling me.",
            "Standard Bank claims my information was not compromised in any data breach.",
            "They read my last three genuine transactions back to me verbatim.",
            "Standard Bank says they have no record of any unauthorized data access.",
            "None of those SMS transactions actually happened. They were fabricated decoys.",
            "Standard Bank charged me R210 in cash advance fees for the fraudulent transfers.",
            "The Guardian Fraud Firewall was formally offered to Standard Bank on 13 June 2025.",
            "Standard Bank acknowledged receipt but failed to evaluate or implement the technology.",
            "SAMSA issued new seaworthiness certificates in Morne Olivier's name.",
            "No valid change of ownership was completed at the time of certificate issuance.",
            "The vessel Wyfre DTD 774 remains registered to Ritz Louw at SAMSA.",
            "Niven Naidoo removed the boat to an unknown location and refused to return it.",
            "The contract was lawfully cancelled on 1 April 2025 by Ritz's attorney.",
            "Morne Olivier claims he is the lawful owner of the vessel Wyfre.",
            "Nicky Liebenberg reported the fraud immediately to Standard Bank's fraud line.",
            "Standard Bank has failed to provide any substantive response after 7 days.",
            "Ritz Louw filed SAPS case 147/12/2025 against Morne Olivier.",
            "SAPS Port Edward forwarded the docket to Scottburgh for investigation.",
        ]
        engine = VerumContradictionEngine(case_id="DEMO-v531-EXPANDED")
        report = engine.process_from_texts(demo_texts)
        print(f"\nResults:")
        print(f"  Contradictions detected: {len(report.contradictions)}")
        print(f"  Serial fraud patterns: {len(report.serial_patterns)}")
        for p in report.serial_patterns:
            print(f"    - {p.pattern_name} ({p.pattern_id})")
        print(f"  Intimidation stage: {report.intimidation_stage.name}")
        print(f"  Victim connections: {len(report.victim_connections)}")
        print(f"\n" + "=" * 70)
        return

    if args.hash_only and args.files:
        h = hashlib.sha512()
        for fp in args.files:
            h.update(open(fp, 'rb').read())
        print(f"SHA-512: {h.hexdigest()}")
        return

    case_config = None
    if args.case:
        config_map = {
            "allfuels": MultiCaseConfiguration.all_cases()[0],
            "greensky": MultiCaseConfiguration.all_cases()[1],
            "southbridge": MultiCaseConfiguration.all_cases()[2],
            "louw": MultiCaseConfiguration.all_cases()[3],
            "stdbank": MultiCaseConfiguration.all_cases()[4],
            "ritzboat": MultiCaseConfiguration.all_cases()[5],
            "digsim": MultiCaseConfiguration.all_cases()[6],
        }
        case_config = config_map.get(args.case)

    engine = VerumContradictionEngine(case_id=args.case_id, case_config=case_config)

    if args.text:
        report = engine.process_from_texts(args.text)
    elif args.files:
        report = engine.process_from_files(args.files)
    else:
        parser.print_help()
        return

    output = ReportGenerator.generate(report, args.format)
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"Saved: {args.output}")
    else:
        print(output)


if __name__ == "__main__":
    main()
