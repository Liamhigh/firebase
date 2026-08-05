# Guardian Fraud Firewall — Design System

## Canonical sources (do not fork, do not restyle)

1. **`css/verum-ui.css`** — the portable Verum Omnis stylesheet, transcribed 1:1 from the
   production site (verumglobal.foundation). It is the design foundation of every page in
   this app. Load it **first**, then `css/theme.css` (this app's integration layer, which
   only binds JS-generated markup and legacy class hooks into the system — it introduces
   no new colors, fonts, or components of its own).
2. **`VERUM_UI_TOKENS.md`** (repo scratchpad root) — the written token specification:
   colors, typography, component anatomy, spacing, radius, motion. When code and spec
   disagree, the spec wins.

The theme is **permanently dark navy (`#040D1B` family)**. There is no light mode. Gold
(`#D4A843`) is the brand/CTA color (always navy text on gold, never white); desaturated
blue (`#4A7EC7`) is the chrome color for labels, links, and secondary UI. Headings are
Cormorant Garamond serif; labels, kickers, nav links, hashes, and footers are mono
uppercase with wide tracking; body copy is sans.

## Windows Lite (and every future client)

The future **Windows Lite app MUST use `verum-ui.css` + `VERUM_UI_TOKENS.md`** as its
design system. No parallel palettes, no re-derived styles, no light theme. Port the
tokens verbatim; reuse the component anatomy (topnav, cards, id-field rows, gold CTAs,
honesty notes, seal footer) rather than inventing new ones.

## Verification = website (Constitution Sec 7)

The firewall **seals and analyses locally; it never verifies locally.** Any UI surface
that mentions verification must be a clearly-styled link or button to the Verification
Hub:

```
https://verumglobal.foundation/verify.html
```

Label it "Verify at the Verification Hub" (or equivalent). Do not build local hash
comparison, local QR verification, or any in-app "verified" verdict UI — in this app,
in Windows Lite, or in any other client.

## Language rules (PD16)

Visible findings language is stated as fact and anchored to its source (SHA-512 +
page/line). No scores out of 100, no confidence-band wording, no hedging. The verdict on
any named person is for the court.
