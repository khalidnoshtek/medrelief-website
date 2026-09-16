# MedRelief — website

One website, two audiences, switchable from a toggle in the top bar:

- **For patients** (default) — MedRelief Diagnostics, Bihar Sharif (Nalanda): book a
  test, live report tracking, WhatsApp delivery, tests & prices, centers.
- **For labs & doctors** — the AI-first lab **platform** behind MedRelief: prescription
  scan, voice, analyzer integration, part-payments, doctor portal, reporting.

**Design** follows the Claude Design handoff (`Medrelief-handoff.zip` → `MedRelief
Website.html`): cyan brand, Inter + JetBrains Mono, card system, top bar, sticky nav,
track-card, colour-topped journey steps, WhatsApp chat mock.
**Content** is written fresh and grounded in the real business — Bihar Sharif, real
address/phone/prices from the lab receipt — with no invented accreditation, stats, or
locations.

## Files
```
index.html                 the site (inline CSS + JS, no build step, no dependencies)
artifact.html              generated build with the logo inlined — the shareable Artifact
assets/mr-logo.png         brand mark
index-platform-saas.html   earlier standalone B2B-only draft (kept for reference)
```
Only external request: the Inter / JetBrains Mono web fonts (Google Fonts); degrades to
system fonts offline. The audience choice is remembered per browser (localStorage), and
`#platform` / `#doctors` / `#demo` etc. deep-link straight into the labs & doctors view.

## Preview locally
```bash
cd medrelief-website
python3 -m http.server 8791
# open http://localhost:8791
```

## Deploy (any static host)
Plain static files — Render Static Site (no build command), S3 + CloudFront, or
Vercel/Netlify/GitHub Pages. Point a domain (e.g. `medrelief.in`) at it.

## Confirm before going live (real facts I need from you)
I grounded everything I could verify and **left out anything I couldn't** — please confirm/replace:
- **Test menu & prices** — I used the five real prices from the lab receipt (CBC ₹400,
  HbA1c ₹600, Blood Sugar ₹50, LFT ₹800, KFT ₹850); the Full Body package price is "at
  booking". Swap in the authoritative price list for the full menu.
- **Accreditation** — the mockup claimed "NABL / ISO 15189 M-4821"; I **removed** it. Add
  it back only if MedRelief actually holds it (with the real certificate number).
- **Centers & timings** — real: Bihar Sharif (full address + phone) and Rajgir (city
  only — add its street/phone if it has its own). Opening hours are not stated anywhere —
  add them if you want them shown.
- **Home collection** — kept as an offered service; confirm coverage and whether it's free.
- **Entity/contact** — used "Med Relief Healthcare Pvt Ltd", CIN U85100BR2021PTC053162,
  hi@medrelief.co.in, +91 92638 40556 (from the receipt). Note the App Store legal
  entity is Collab Cubicles Private Limited — confirm which should appear publicly.
