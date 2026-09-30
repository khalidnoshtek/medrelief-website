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
config.js      EVERYTHING editable: phone, centres, slots, tests, campaigns, lab pin + radius, app links, API
i18n.js        every patient-facing string in English and Hindi
privacy.html / terms.html
assets/brand/  Plum brand kit v1.0 (logos, favicons) · assets/qr-patient-app.svg (→ install.html?app=patient&auto=1)
```
The end-to-end workflow spec (website order → proposed bill → desk → agent → payment) and
the API contract live outside this repo — this repo is public and served as-is.
No build step, no dependencies. Only external request: Google Fonts.
When you change `config.js`, `i18n.js` or `chat.js`, bump the `?v=` stamp on their `<script>` tags in `index.html` so browsers don't mix a cached old file with a new one.

## Two modes (set in `config.js → api.baseUrl`)
| Mode | Home collection | Centre visit / partners |
|---|---|---|
| **Hand-off** (`''`, current) | Location check in the browser (≤ `homeCollection.radiusKm` of the lab), then a summary with **Call to confirm** + **Copy summary**; pay the agent at the door. | Summary + call / email. |
| **API** (medlab `feat/online-home-collection`) | Location → `POST /public/home-collection/coverage`, then `POST /public/home-collection/orders` (server re-prices + re-checks 15 km) → Razorpay Checkout, **UPI only**, inside the chat → `POST /orders/:ref/verify`. The paid order becomes a PAID bill with an **Online order** badge in the staff app. | Unchanged (hand-off) — no public endpoints for these yet. |

API mode was exercised against a local mock of those endpoints (coverage, order, stubbed
Razorpay handler, verify, dismissed payment, out-of-area). It has not yet run against a
deployed backend + real Razorpay keys. **Razorpay is in TEST mode on production** — the
flow completes in test mode only until live keys are in.

To switch on: deploy the medlab branch, set the lab pin + radius on `org_centers`
(`latitude`, `longitude`, `home_collection_radius_km`), keep `config.js → homeCollection.lab`
identical, then set `api.baseUrl`.

## Language
EN / हिंदी switch in the header (remembered per browser). All patient strings live in
`i18n.js`; package / test Hindi names are `name_hi` in `config.js`. The partner section is
English-only.

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
- **Lab pin** — `homeCollection.lab` is Bihar Sharif's city centre, not yet the exact Bhainsasur Chowk location; set the real pin here AND on the server.
