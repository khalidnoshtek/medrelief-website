# MedRelief — website

One page, chat-first. Patients land, pick an action, and the always-open assistant takes
them through it — no sub-pages.

- **Patients** (default): four actions — *Home sample collection · Schedule a centre visit ·
  Track my report · Get the patient app (QR)* — a campaign ticker, centres. Every action
  opens the assistant at that step.
- **Labs, doctors & partners** (top-bar switch, or `#partners`): refer patients, send
  samples, use our collection agents, become a collection agent, track submissions
  (partner portal). API / website integration is set up by our team, not self-service.
- **Assistant** (`chat.js`): docked on the right on desktop (≥1080px), a bottom sheet on
  phones. Predefined options at every step plus free text; a **Chat | Call an agent**
  switch is always in the header. Offer details (included tests, standard price, savings,
  home collection / centre visit) open as cards inside the chat.

## Files
```
index.html     the page (inline CSS + small page script)
chat.js        the assistant — flows, validation, hand-off / API adapter
config.js      EVERYTHING editable: phone, centres, slots, tests, campaigns, app links, API
privacy.html / terms.html
assets/        logo, patient-app QR (qr-patient-app.svg → install.html?app=patient&auto=1)
```
The end-to-end workflow spec (website order → proposed bill → desk → agent → payment) and
the API contract live outside this repo — this repo is public and served as-is.
No build step, no dependencies. Only external request: Google Fonts.

## Two modes (set in `config.js → api.baseUrl`)
| Mode | When | What "Confirm booking" does |
|---|---|---|
| **Hand-off** (`''`, current) | until the medlab public API ships | Shows the booking summary with **Call to confirm** + **Copy summary** (+ **Send on WhatsApp** only if `whatsapp` is a human-read number). Nothing leaves the browser. |
| **API** | once `/public/*` exists in medlab | Mobile is OTP-verified, then `POST /public/home-collection-orders` / `centre-bookings` / `partner-leads`; tracking via `GET /public/track`. Falls back to hand-off on any error. |

Contract: workflow spec §7. API mode was exercised against a local
mock (OTP → order → reference); it has **not** run against a real backend (none exists yet).

## Campaigns
`config.js → campaigns[]`: `code` = `mdm_packages.code`, `price` = offer price, `tests` =
`[name, MRP]` pairs (standard price and savings are computed from them). Set
`active:false` to pull one. Current five = the Nirogyam packages (offer prices from the
package master, MRPs from the current test list).

## Preview locally
```bash
python3 -m http.server 8791   # then open http://localhost:8791
```

## Deploy
GitHub Pages serves `main` → pushing to `main` publishes publicly. Work on a branch.

## Confirm before going live
- **Slots / hours** — `config.slots` are placeholders; the centres' real windows are not stated anywhere.
- **Home-collection charge and coverage pincodes** — `config.homeCollection` (unset = "confirmed by our team").
- **WhatsApp hand-off number** — leave `whatsapp: ''` unless a person reads that number; a WhatsApp Business API number has no human inbox.
- **Prices** — check the five campaigns and the test list against the live rate plan.
- **Entity** — confirm the legal entity shown in the footer.
- **iPhone patient app** — shown as "coming soon"; set `apps.patientIos` when it's live.
- **Hindi** — the assistant is English-only today; Bihar patients will likely want Hindi.
