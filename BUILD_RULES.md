# Build Rules — Verum Omnis Guardian Fraud Firewall

**Document Purpose:** Non-negotiable build rules. Never break these.

**Version:** 5.2.7
**Last Updated:** 2026-07-13

---

## Rule 1: No TODOs, No Placeholders, No Stubs

- Do NOT write `TODO()` in code
- Do NOT write `// TODO:` comments
- Do NOT write `// FIXME:` comments
- Do NOT write `throw new Error("Not implemented")`
- Do NOT leave empty function bodies
- Do NOT write "Coming soon" or "Not yet implemented" anywhere
- Do NOT use stubs, mocks, or fakes in production code

Every function must have a real implementation. Every endpoint must work. Every button must do something.

---

## Rule 2: No Compile Errors

```bash
cd fraud-firewall
npm run lint       # MUST pass
tsc --noEmit       # MUST pass with zero errors
```

If there are compile errors, fix them FIRST. Do not add new code on top of broken code.

---

## Rule 3: All Tests Must Pass

```bash
cd fraud-firewall
npm test           # MUST pass
```

If a test fails, fix it or document in `KNOWN_BUGS.md` why it cannot be fixed. Do not ignore failing tests.

---

## Rule 4: Every Endpoint Must Work

For every API endpoint:
- It MUST have a handler function
- It MUST return the correct HTTP status code
- It MUST return valid JSON
- It MUST not return placeholder text
- It MUST handle errors gracefully

---

## Rule 5: Every CLI Command Must Work

For every command in `cli.ts`:
- It MUST have a working implementation
- It MUST not show "Coming soon"
- It MUST handle invalid input
- It MUST return meaningful output

---

## Rule 6: Determinism Is Mandatory

- No `Date.now()` in business logic
- No `Math.random()` anywhere
- No nondeterministic ordering
- Use injected timestamps for testing
- Same input + same Constitution = same output

---

## Rule 7: Constitutional Constraints Are Hard-Coded

- Confidence is ordinal only (no percentages)
- Evidence before narrative (anchors required)
- 10-word prompt limit (enforced at runtime)
- 7 contradiction categories (immutable)
- B9 cannot vote
- 20% commission rate (fixed)
- Privacy Wall (Verum never receives evidence)
- Article X (Anti-War Doctrine)

These are not configurable. They are compile-time constants.

---

## Rule 8: No External Dependencies Without Approval

- Do not add new npm packages without documenting in `DEPENDENCIES.md`
- Do not add framework dependencies (Express, Fastify, etc.)
- Do not add database dependencies
- Do not add ORM dependencies
- Pure TypeScript + Node.js built-ins for core logic

---

## Rule 9: Type Safety Is Non-Negotiable

- `strict: true` in tsconfig — never disable
- No `any` type — use `unknown` with type guards
- Explicit return types on all exported functions
- All function parameters must be typed
- No implicit any

---

## Rule 10: Privacy Wall Is Compile-Time Enforced

- `sendToVerum()` can only accept `CommissionInvoice` objects
- `sendToVerum()` cannot accept `SealedReport` objects
- This is enforced by TypeScript types, not runtime checks
- The type system must prevent evidence leakage to Verum

---

## Rule 11: Seals Are Immutable

- Once a seal is created, it cannot be modified
- Seal verification must detect any tampering
- The SHA-512 hash is the source of truth
- Blockchain anchoring provides timestamp attestation

---

## Rule 12: Documentation Must Be Updated

When you complete a feature, update:
- `BUILD_STATUS.md` — mark the feature complete
- `MASTER_TASK_LIST.md` — check off the task
- If you fix a bug, update `KNOWN_BUGS.md`

---

## Rule 13: No Shortcuts

Do not:
- Skip tests "because the feature is simple"
- Skip type checking "because it works on my machine"
- Use `any` "just this once"
- Leave error handling "for later"
- Use `console.log` instead of proper logging
- Hard-code values that should be configurable

---

## Rule 14: Security First

- No secrets in code (API keys, passwords)
- No secrets in git history
- All data encrypted at rest (AES-256-GCM)
- All communication encrypted in transit (TLS 1.3)
- Input validation on all API endpoints (Zod)
- Rate limiting on all endpoints

---

## Rule 15: This Is Court-Admissible Evidence

Every line of code either:
- Upholds the rule of law, or
- Undermines the rule of law

There is no middle ground. People's freedom, property, and justice depend on this code working correctly. Write accordingly.

---

*"The truth does not require belief. It requires only that you look."*

**Verum Omnis** — AI Forensics for Truth
