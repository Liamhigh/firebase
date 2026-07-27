# Candidate Contradiction Types v6 + GHRP Amendment

## Document Metadata
- **System**: Verum Omnis Constitutional Forensic Platform
- **Component**: Contradiction Engine taxonomy extension candidates + GHRP promotion-path amendment
- **Version**: 1.0.0
- **Status**: PROPOSED — CANDIDATE (awaiting founder ratification)
- **Evidence basis**: Engine run VO-GS-CASE126-REVIEW (2026-07-14) over case126 (SAPS correspondence) + greenskyabass (EIB complaint, WhatsApp record, H208/25 judgment)
- **Constitutional Authority**: Prime Directive 2 (Evidence Before Narrative), 3-Layer Output Model, GHRP two-tier rule

---

## 1. Why This Document Exists

On 2026-07-14 the v5.3.1c engine was run against new case material. It found 15
contradictions in 34 seconds — including SPOLIATION_OF_EVIDENCE,
PROCESS_REMEDY_CONFLICT, and DEFAMATION_THREAT — proving the taxonomy reaches
this case class. But three load-bearing patterns in the material have **no home
in the 43 types**, and one structural gap in the GHRP promotion rule became
visible. This document registers them as candidates. Nothing here changes the
sealed engine; ratified candidates become new detectors built **onto** it.

---

## 2. Candidate Type 1 — SWORN_VS_SWORN (Cross-Deponent Perjury Conflict)

**Gap.** `STATEMENT_VS_STATEMENT` requires the *same* actor on both sides
(same-actor opposing claims). When two *different* deponents contradict each
other under oath on one material fact, no detector fires — yet one of them is
necessarily perjuring.

**Definition.** Two sworn statements (affidavits, sworn declarations, judicial
records) from different actors assert mutually exclusive versions of the same
material fact.

**Trigger conditions.**
- Both claims: `sourceType = SWORN_STATEMENT | JUDICIAL_RECORD`
- `actorA != actorB`, `subjectA == subjectB`
- `isOpposing(A, B)` true (negation asymmetry or semantic contradiction)

**Severity.** VERY_HIGH when both are sworn on the same subject; HIGH when one
side is contemporaneous corroboration. Confidence: HIGH (two sworn sources —
trier of fact must resolve).

**Legal hypothesis (always flagged).** Perjury — one deponent has sworn falsely.
Jurisdictional note: perjury statutes vary; requires human legal review.

**Worked example (case material).**
- Kevin's sworn statement: he personally paid for the camera.
- Belinda Fraser's sworn statement: the camera was lost in a courier scam.
- Liam's account: Marius Nortje paid for it.
Three sworn versions of one purchase. Exactly one can be true.

---

## 3. Candidate Type 2 — DEVICE_ATTRIBUTION_CHAIN (Declaration-Linked Digital Attribution)

**Gap.** `CYBERCRIME_EVIDENCE` covers the intrusive *act* (unauthorised access
attempts, interception). Nothing covers the *attribution*: linking the device/
account that performed the act to a named actor through that actor's own
declarations.

**Definition.** An actor declares ownership of, or association with, an entity
(name, company, handle); a device, account, or network identifier sharing that
declared name subsequently performs an adverse act against the declarant's
opponent.

**Trigger conditions.**
- Declaration claim: actor X states ownership of entity E
  ("I have a PTY called South Coast Aquaculture")
- Adverse-act claim: device/account/hostname matching E performed intrusion,
  interception, deletion, or access attempt
- Temporal proximity: adverse act follows the declaration or a case milestone

**Severity.** HIGH (attribution is circumstantial but corroborating); promotes
to VERY_HIGH when the adverse act is itself a CYBERCRIME_EVIDENCE finding on
the same corpus. Confidence: MODERATE — attribution is never proof alone;
the report must say so (Constitution Art. III).

**Legal hypothesis.** Aids identification of the perpetrator for cybercrime
statutes (unauthorised access / interception). Hypothesis only.

**Worked example (case material).**
- Kevin's WhatsApp: "I have a PTY called South Coast Aquaculture."
- Gmail archive attempt traced to a device named "SCAQUACULTURE".
The declaration is the link; the engine currently cannot express it.

---

## 4. Candidate Type 3 — CRIMINAL_CHARGE_AS_LEVERAGE (Retaliatory Prosecution)

**Gap.** `PROTECTION_ORDER_AS_LEVERAGE` covers civil harassment orders weaponised
in commercial disputes. Its criminal-law twin — a criminal complaint laid by the
opposing party in a civil matter to silence or pressure — has no type.

**Definition.** A criminal charge is laid by (or at the instance of) a party
adverse to the complainant in ongoing civil proceedings, where the charge
concerns the same subject matter or assets as the civil dispute, and timing
correlates with case milestones.

**Trigger conditions.**
- Criminal-charge claim: charge laid by party A against party B
- Civil-dispute claim: A and B are opposing parties in pending civil proceedings
- Subject overlap: charge concerns property/assets/facts in the civil dispute
- Temporal correlation: charge follows a civil-case milestone adverse to A
- Optional aggravator: charge later withdrawn, nolle prosequi, or evidentially
  thin (consciousness-of-guilt signal)

**Severity.** VERY_HIGH when charge + civil overlap + milestone timing all
present. Confidence: MODERATE-to-HIGH — motive inference; the pattern (not the
accusation) is what the engine asserts.

**Legal hypothesis.** Abuse of process / defeating the ends of justice.
Hypothesis only; requires human legal review.

**Worked example (case material).**
- "This whole theft charge of the camera was to silence me."
- The camera charge was laid by the respondent in the civil fraud matter,
  concerning an asset inside that dispute, after the sealed forensic record
  was served.

---

## 5. GHRP Amendment — Judicial Confirmation as a Third Promotion Path

**Gap.** The GHRP two-tier rule promotes a G3-RAISED CANDIDATE to
ENGINE-VERIFIED by (a) engine re-run with updated detectors, or (b) human
sign-off. The case material contains a stronger external confirmation: a court
has already ruled on the pattern.

**Amendment.** Add a third promotion path:

> **JUDICIALLY-CONFIRMED** — a candidate (or engine finding) is promoted when a
> court of competent jurisdiction makes a finding that confirms the pattern.
> The promotion record carries: case number, court, judgment date, the
> confirming passage's anchor (page/paragraph), and the judgment's SHA-512.
> The judgment itself is sealed into the vault as the anchor artefact.

**Tier mapping.** JUDICIALLY-CONFIRMED sits above ENGINE-VERIFIED in
court-defensibility: opposing counsel cannot argue the finding is machine
speculation when a court has found the same thing.

**Worked example (case material).** The H208/25 judgment (02 Oct 2025)
dismissed the harassment application and found the evidence compilation was
undertaken in good faith. Any engine/G3 finding asserting
PROTECTION_ORDER_AS_LEVERAGE or good-faith-evidence-compilation in this matter
promotes to JUDICIALLY-CONFIRMED with that judgment as anchor.

**Registry change (all three platforms).** Add status constant
`GHRP_STATUS_JUDICIALLY_CONFIRMED = "JUDICIALLY-CONFIRMED"` and a
`confirm_judicially(candidate_id, case_number, court, judgment_date,
passage_anchor, judgment_sha512)` method that seals the anchor metadata with
the record. Audit action: `JUDICIALLY-CONFIRMED`.

---

## 6. Engine Precision Note — Word-Boundary Keyword Matching

**Finding.** The run produced a clear false positive: TACIT_LEASE_VIOLATION
fired on the sentence "Please confirm receipt of this update" because the
lexicon matcher tests `keyword in text` and **"lease" is a substring of
"please"**. NO_COUNTERSIGNATURE_TRAP and BEHAVIORAL hits in the same run show
the same collision signature.

**Recommendation (non-breaking).** In the detector lexicon matching, match on
word boundaries (`\blease\b` semantics) rather than raw substrings, for all
keyword lists whose terms are short English words. This is a precision-only
change — it removes false positives without weakening any true detection, and
it can ship as a companion-layer filter without touching the sealed engine.

**Evidence.** Run VO-GS-CASE126-REVIEW: 15 findings, of which at least 3 trace
to substring collisions (lease/please class). Triage table in §7.

---

## 7. Findings Triage — Run VO-GS-CASE126-REVIEW (diligence record)

15 findings, reviewed one by one. This table is itself evidence of diligence
(GHRP §8: what was considered, and why).

| Finding | Type | Verdict on review |
|---|---|---|
| UN Article 39 submissions ignored | PROCESS_REMEDY_CONFLICT | **HOLDS** — matches correspondence |
| Deleted licenses / MOA / invoices | SPOLIATION_OF_EVIDENCE | **HOLDS** — core case fact |
| Perjury re: theft case opening | DEFAMATION_THREAT | **HOLDS** — camera charge as silencing |
| 6 Apr 2025 admission vs later position | TEMPORAL_CONTRADICTION | **HOLDS** — dated admission email |
| 451-page sealed record, no SAPS action | INSTITUTIONAL_CAPTURE_PROSECUTORIAL | **HOLDS** — plausible, correctly typed |
| "Please confirm receipt" | TACIT_LEASE_VIOLATION | **FALSE POSITIVE** — lease/please substring (§6) |
| Case reference number sentence | NO_COUNTERSIGNATURE_TRAP | **FALSE POSITIVE** — keyword collision |
| UN Article 39 (second hit) | BEHAVIORAL | **WEAK** — keyword collision |
| Affidavit/jurat mention in letter | DEFECTIVE_JURAT | **UNVERIFIED** — needs the underlying affidavit |
| Update letter vs status request pairing | TEMPORAL_PRECEDENCE_CONFLICT | **WEAK** — pairing is thin |
| 5 further records | various | Review on re-run with case config |

**Known run limitations (method note).** Actor attribution returned "unknown"
throughout because the input was raw page-chunks without a case configuration /
actor dictionary; with case config, actors resolve properly. A rendering
artifact (`Text(value=`) appeared on some B-propositions and is logged for
fixing in the emitter layer. Neither affects detection counts; both affect
report readability and are noted honestly here.

---

## 8. Signature Block

This document is part of the Verum Omnis Constitutional Governance Framework.
It is PROPOSED: the three candidate types, the GHRP amendment, and the
word-boundary recommendation take effect only on founder ratification, and are
then implemented **onto** the engine (new detectors / registry methods) — the
sealed v5.3.1c engine file remains byte-identical.

**System Version**: v5.3.1c + GHRP 1.0.0
**Document Version**: 1.0.0
**Drafted**: 2026-07-14
**Status**: PROPOSED — CANDIDATE

```
VERUM OMNIS — CANDIDATE CONTRADICTION TYPES v6
"The taxonomy grows by evidence. Every candidate is anchored. Nothing enters unverified."
```
