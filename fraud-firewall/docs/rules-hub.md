# Rules Hub — the crowd-sourced engine improvement loop

The website is where everyone verifies documents. Every contradiction the
hybrid pipeline catches there — and a human promotes — improves the shared
deterministic engine for the entire fleet.

## The loop

```
User verifies documents at the website
  → deterministic engine + Gemma 3 second pass (src/forensics/g3Review.ts)
  → missed contradictions recorded as G3-RAISED CANDIDATES
  → human promotes via POST /v1/g3/promote (or the engine re-detects)
  → Mistral curates the promoted pairs (src/core/rulePublisher.ts)
  → package signed with the vo-master key (RSASSA-PKCS1-v1_5-SHA512)
  → served at GET /api/v1/rules/manifest
  → every app pulls it:
      · Android (1verum): RuleUpdateWorker polls daily, verifies the
        signature against the pinned vo-master-1 key, merges the pairs into
        ContradictionDetectors as additive rules
      · Firewall deployments: core/ruleUpdate.ts does the same for RuleEngine
  → each app's local engine now catches what the hub learned
```

Because the hub sees every verification, the shared engine improves far
faster than any single user's app could alone — and each app still keeps its
own local loop (on-device Gemma 3 candidates + LocalRuleStore promotions)
for what it discovers privately.

## Curation rules

- Promotion is always a human (or engine re-run) decision; Mistral can only
  **veto** pairs that would be false-positive-prone — it can never add or
  edit a rule. The published package is a subset of human-promoted content.
- Publishing is idempotent: no content change → no new version. Versions are
  strict semver; clients apply accept-if-newer only.
- Downloaded rules are additive-only in every client: built-in detectors are
  never modified or removed, and a missing/invalid manifest changes nothing.

## Key provisioning

Clients pin the `vo-master-1` public key at build time. To publish, the hub
needs the matching **private** key:

- `VO_RULE_SIGNING_KEY_PEM` — inline PEM, or
- `VO_RULE_SIGNING_KEY_FILE` — path to a PEM file.

Without a key the publisher refuses (clients would reject the manifest
anyway). Keep the private key on the hub host only; rotating it requires a
client release with the new pinned public key.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/rules/manifest` (alias `/v1/rules/manifest`) | Signed manifest the fleet polls |
| POST | `/v1/rules/publish` | Curate + sign + publish now (409 if nothing changed / no key) |
| GET | `/v1/g3/candidates` | Candidates awaiting promotion |
| POST | `/v1/g3/promote` | Promote (auto-republishes when a key is provisioned) |
| POST | `/v1/g3/reject` | Reject with a sealed reason |
