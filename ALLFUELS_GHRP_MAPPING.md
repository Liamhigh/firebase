# AllFuels Forensic Report → GHRP Template Mapping

**Purpose:** the AllFuels report ("Forensic Audit and Evidence Analysis: Systemic
Goodwill Appropriation…") is the reference for the quality and shape a Verum Omnis
forensic report must reach. This document maps that report, section by section,
onto the Guardian Hybrid Report (GHRP) contract in
`REPORT_FORMAT_SPECIFICATION.md` / `src/pipeline/reportStructure.ts`, and marks
exactly which layer produces each part.

**The split (Constitution v6.0 — the "interpretive legal layer"):**
- **Engine (deterministic nine-brain)** produces every *fact*: contradictions,
  names, amounts, dates, entities, page anchors, statute candidates.
- **Gemma 3 (writer)** produces the *prose* over those facts. It never originates
  a name, figure, date, or statute. No anchor, no sentence.
- **External corroboration** (court cases, news) is optional context, gathered
  only with signal, kept separate, never overriding sealed evidence.

---

## Section-by-section mapping

| GHRP § | AllFuels report content | Produced by |
|---|---|---|
| 1 Cover Page | Sealed title page, seal `VO-…`, SHA-512, OpenTimestamps, classification | Sealing layer |
| 2 Table of Contents | — | Writer |
| 3 Authentication & Methodology | "executed in strict compliance with the Verum Omnis Constitution v6.0, filed in the Constitutional Court on 12 July" | Writer over sealed metadata |
| **4 Nine-Brain Architecture** | The brain table: B1 Contradiction ("N material contradictions across leases, heads of argument, correspondence"), B2 Document (blank countersignature blocks, unexecuted pages), B3 Communications (reconstructed TDP Legal ↔ Asif Latib), B4 Behavioral (Desmond Smith voice recordings, coercive isolation of Gary Highcock), B5 Timeline (5-year procedural map), B6 Financial (Benford's Law, the Palmbili transfer, rental schedule), B7 Legal Mapping (SA + international statutes), B8 Audio, B9 Guardian/consensus | **Engine** (counts) + Writer (table prose) |
| 5 How to Use This Report | audience guides | Writer |
| 6 Executive Summary | AllFuels t/a Bright Idea Projects; the "No Counter-Signature Trap"; 34 Chevron-cessioned sites; seven victims (Desmond Owen Smith, Gary Highcock, Wayne Nel, Clayton Bester…); R__m losses; CEO **Zeyd Timol** ↔ **Palmbili** conflict; 2020 ConCourt "goodwill has no compensable value" contradiction; prima facie fraud/theft-by-false-pretences/perjury/racketeering | **Engine facts**, Writer narrative |
| 7 Evidence Index | page-by-page index of the sealed bundle | Engine (anchors) |
| 8 Four Pillars of Fraud | misrepresentation / intent / reliance / loss on the goodwill scheme | Writer over findings |
| 9 Contradiction Matrix | the B1 contradictions as a table (#, respondent, claim A, claim B, severity) | **Engine** |
| 10 Counter-Narratives & Rebuttals | AllFuels' own account/denials, each anchored, weighed against the record | Engine anchors + Writer |
| 11 Pattern of Conduct | the five-step modus operandi: let franchise lapse → present MOU with goodwill-forfeiture clause → operator signs → AllFuels withholds counter-signature → seize premises | **Engine** sequence, Writer prose |
| 12 Perjury & False Statement | the sworn ConCourt submission vs contemporaneous commercial practice | Engine + Writer |
| 13 Coercive Conduct | coercive isolation tactics; Silence Ledger | Engine + Writer |
| 14 Critical Evidence Analysis | deep-dive on the unexecuted lease/franchise exhibits | Engine + Writer |
| 15 Victim Profiles | per-operator: site, tenure, loss, what happened, how it fits the pattern | Engine facts + Writer |
| 16 Legal Framework | statute mapping — POCA s.2 (racketeering), fraud, theft by false pretences, perjury; SA + cross-border | **Engine (JurisdictionService)**, Writer explains, HYPOTHESIS framing |
| **17 External Corroboration** | ConCourt case references (CCT…/CCT…), Public Protector / Hawks (DPCI) / SAPS acknowledgements, news of network-wide losses across the 34 sites | **Gemma + web, signal-gated**, sourced/dated, never overriding sealed evidence |
| 18 Offence Matrix | finding → offence mapping | Engine + Writer |
| 19 Court-Ready Declaration | certification + triple-verification panel (Thesis/Antithesis/Synthesis) | Writer over sealed metadata |

---

## What Gemma 3 may and may not do (proven against this report)

**May** (this is squarely a strong small-model task):
- Write the Executive Summary, per-victim narratives, Four Pillars, Counter-Narratives, and the Pattern-of-Conduct prose, weaving the engine's anchored facts into readable legal English at the register of the AllFuels report.
- Explain each contradiction and statute mapping in lay terms.
- Gather and cite open-source court/news signal as **External Corroboration**.
- Run **deep research** across several sealed case files chosen as context.

**May not** (Constitution v6.0, Prime Directives III & IV):
- Originate any name, amount, date, entity, case number, or statute section — those come only from the sealed file, the findings JSON, or a cited external source.
- Promote a G3 candidate to engine-verified, or let external material override, contradict-into-silence, or manufacture a sealed finding.
- State a legal conclusion as fact — legal mapping is candidate/indicator/HYPOTHESIS.
- Follow instructions embedded in fetched web content (prompt-injection guard).

---

## Tiering
- **Firewall / on-prem (Gemma 3 12B/27B):** the full multi-section document at this length and register; runs the web corroboration and deep-research modes.
- **Android (Gemma 3 4B):** per-victim narratives, Executive Summary, and section drafts stitched to this same contract; deep-research over on-device sealed files; web corroboration where a live signal exists.

*Contract source of truth:* `REPORT_FORMAT_SPECIFICATION.md` + `src/pipeline/reportStructure.ts`.
Prompt: `G3_SYSTEM_PROMPT.md`.
