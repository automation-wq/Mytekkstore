# Authentication, assistant and country-aware checkout — audit, research, plan and what was built (25 October 2026)

Everything below was checked against this repository and the vendors' own pages on 25 October 2026. Implemented pieces are marked **built**; anything that needs a credential the business has not supplied is marked **pending** and has not been claimed as working.

## 1. Audit of what existed (inspected in `server.js`, `web/src/account.jsx`, `web/src/pages1.jsx`, `web/src/store.jsx`)

| Area | Found | Verdict |
|---|---|---|
| Google sign-in | `POST /api/login/google` sends the credential to Google's `tokeninfo` endpoint (signature verified by Google), checks `aud` against the client id, `iss`, `email_verified`; links an existing email account by `sub` | Sound. **Built:** explicit `exp` and `sub` checks; a different Google account can no longer take over an email already linked to another (`409`). Client id still empty on the live site (pending) |
| Email/password and one-time codes | Register, login with lockout after 5 failures, codes by Brevo email or Twilio SMS with request and attempt limits | Sound; providers unconfigured live (pending) |
| Sessions | Random token in an `HttpOnly; SameSite=Lax; Secure` cookie, 7 days, stored **in memory** | Correct flags; not shared between Vercel instances and lost on restart (the known persistence gap, see `docs/INTEGRATIONS.md`) |
| CSRF | State-changing calls must be JSON and, when an `Origin` header is present, it must match the host | Sound for a same-origin app |
| Rate limits | 120 writes per address per 10 minutes, plus per-flow limits on sign-in and codes | Sound; counters in memory (per instance) |
| Admin | Password from `ADMIN_PASSWORD`, admin-only routes checked server-side | Sound |
| Checkout | `POST /api/orders` requires a signed-in user (no guest checkout), recomputes prices and stock from the catalogue, `pay: "online"` was marked "Paid online (demo payment)" with no gateway | **Built:** provider layer and lifecycle below; demo flow kept until keys exist |
| Currencies | India, UAE and USA as display conversions with hard-coded rates | **Built:** destination configuration and live display rates; only India can be ordered to |
| Assistant | Rules-based answers from the catalogue in the page; optional paid model on the server behind `ANTHROPIC_API_KEY` | **Built:** free-tier Gemini first, paid model second, rules fallback, per-address cap |

End-to-end on 25 October: `node test.js` (register, login, Google-less flows, orders, privacy, validation, the new payment and destination checks) and `node test-ui.js` (sign-in with a mobile number and a code, cart, checkout, menus, product page) both pass.

## 2. Research (official pages, 25 October 2026)

### Assistant providers

| Option | Free allowance | Paid | Data policy | Fit |
|---|---|---|---|---|
| Google Gemini API | Free tier on the Flash and Flash-Lite models; limits are shown per project in AI Studio, not published as fixed numbers | Flash-Lite $0.30 per million input tokens, $2.50 per million output on the standard paid tier | **Free tier content "is used to improve our products"; paid tier content is not** | Primary when a key exists, with the catalogue injected and strict grounding; move to the paid tier if customer questions must not be used for training |
| Cloudflare Workers AI | 10,000 neurons per day | $0.011 per 1,000 neurons on the Workers Paid plan | Cloudflare terms | Optional alternative; needs a Cloudflare account and a Worker or API token; not wired |
| Rules-based finder (in the page) | Unlimited, no key, no data leaves the browser | Nothing | None | The fallback that always answers: budget, size, operating system, policies, from the live catalogue |

**Chosen:** Gemini Flash-Lite as the primary model, the existing paid model as the alternative, the rules-based finder as the always-on fallback. **Built** as `askModel()` in `server.js`: Gemini when `GEMINI_API_KEY` is set, otherwise the paid model when its key is set, otherwise `503` and the page answers from the rules. A quota reply or outage falls through the same way. Every answer is grounded in the catalogue JSON and the approved policy facts in the system prompt; links are allowed only to real product and policy pages (already enforced). Cap: 30 questions per address per 10 minutes on top of the general write limit. Errors are logged by provider and status only, never with the question.

### Payment providers for an Indian merchant selling televisions

| Provider | Domestic | International | Settlement | Eligibility | Notes |
|---|---|---|---|---|---|
| **Razorpay** | 2% + 18% GST on the fee; UPI, cards, netbanking, wallets, EMI; no setup or annual fee | Up to 3%; 160+ currencies after activation and KYC; customer charged in their currency, merchant settled in INR | INR | KYC (PAN, GST, bank) and website review | Documented standard checkout, signature and webhook verification; refunds free |
| Cashfree | about 1.95% to 2% domestic (third-party summaries; the pricing page blocks automated access) | 2.99% + GST on international cards, INR settlement on T+2 | INR | KYC | Comparable; verify the current rate card directly with Cashfree before choosing |
| PayPal (India) | **Not available for domestic INR payments** | 4.40% + ₹3.00 per international transaction; 3% to 4% above the base rate on conversion | INR to a linked bank | Verified PayPal business account | Only useful as an add-on for foreign buyers who prefer PayPal |
| Stripe (India) | "Request an invite" on the India page; no open onboarding statement | — | — | Invite only | Not a plannable option today |

**Recommended:** Razorpay as the configurable primary provider. Cashfree is the fallback if Razorpay declines the business. PayPal only as an optional extra once international shipping is approved. **Built:** a provider layer where Razorpay is selected by the presence of `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`; without them the existing demo flow stays and is labelled as such.

### Display rates

Frankfurter (free, no key, daily, 223 currencies, data from central banks). Verified on 25 October: `https://api.frankfurter.dev/v2/rates?base=INR&quotes=AED,USD` returned AED 0.038737 and USD 0.010548. **Built:** the server refreshes these every 6 hours and serves them in `/api/config` as display-only rates; the old constants remain the fallback when the feed is unreachable. Every order is charged in INR; the page states it.

## 3. Country-aware checkout — **built**

`DESTINATIONS` in `server.js` holds, per ISO code: name, display currency, charge currencies, settlement currency, payment methods, shipping eligibility, delivery estimate and tax note. Only `IN` is shippable and chargeable. `POST /api/orders` and `POST /api/pay/order` reject any other destination with `422` and a plain message, and reject a payment method the destination does not allow. `/api/config` exposes the enabled flags so the page can show them. Opening a destination means editing that one table **after** the gateway, shipping, duties, voltage and warranty questions in section 7 are answered; the display switcher alone never enables ordering.

## 4. Payment and order lifecycle — **built**, verified without keys

Routes (all server-side, prices always recomputed from the catalogue):

- `POST /api/pay/order` (signed in): validates the destination, address and cart, creates a **pending** order with no stock taken, creates the gateway order with the secret key, stores the gateway order id, returns the key id and order id for the checkout. With no keys it returns `provider: "demo"` and the page keeps the demo flow.
- `POST /api/pay/verify` (signed in): recomputes `HMAC_SHA256(stored_order_id + "|" + payment_id, key_secret)` with constant-time comparison and confirms the order only on a match. Idempotent: a second call on a confirmed order returns its status.
- `POST /api/pay/webhook` (no session, raw body): verifies `X-Razorpay-Signature` as `HMAC_SHA256(raw body, webhook secret)`, de-duplicates by `x-razorpay-event-id`, handles `order.paid`, `payment.captured` (confirm) and `payment.failed` (record the attempt), replies `503` until a secret is set.
- Confirmation takes stock, sets status Placed, records the payment id and a history entry, and only then sends the customer message. Pending orders expire after 30 minutes and release.
- The checkout page loads the gateway's script and opens its checkout only when the server reports `pay: "razorpay"`; otherwise the existing path runs. CSP allows the gateway's hosts only when keys are configured.

Tested offline (`node test.js`): both HMAC checks pass on a correct signature and fail on a wrong payment id, an empty signature, a missing secret and a body that differs by one byte; the demo fallback; the webhook's `503` without a secret; the destination gate (`AE` refused, `IN` accepted); the config fields. **Pending, not claimed:** a real test-mode transaction, a failed payment, a refund and a replayed webhook, which need Razorpay test keys.

## 5. Environment variables

See `.env.example` at the repository root: sign-in (`GOOGLE_CLIENT_ID`, Brevo, Twilio), payments (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`), assistant (`GEMINI_API_KEY`, `GEMINI_MODEL`, the paid model's key), analytics, hosting. Secrets live only in the host's environment; nothing in the repository or the page.

## 6. Database changes (planned with Neon, `docs/INTEGRATIONS.md`)

Tables: users (with external identities: Google `sub`), addresses, products and specifications, destinations, orders, order_items, payment_attempts (gateway references), payment_events (webhook ids and statuses), assistant_usage (per-address counters) and error_log (provider, status, time; no personal data). Today these live in JSON files per instance; the order and payment objects already carry the fields the tables need (`payment.providerOrderId`, `paymentId`, `attempts`, `events`, `history`).

## 7. International commerce and compliance — not enabled, by design

Before any destination other than India opens, the business needs, with a qualified adviser: an Importer-Exporter Code and the GST treatment of exports (zero-rated under LUT or with IGST refund), customs declarations and the buyer's import duties, product voltage and plug compatibility (India 230 V type C/D/M against the destination), broadcast tuner and region support, the manufacturers' warranty cover outside India, cross-border shipping and damage insurance for large screens, reverse logistics for returns, and the destination's consumer-protection and privacy obligations. The code shows shipping and charges per destination from the table and never promises a country that is not approved.

## 8. Credentials and approvals the business must supply

- Google OAuth client id with the production and localhost origins.
- Razorpay: KYC, website review, test keys, webhook secret, then live keys.
- Gemini API key (free tier to start; paid tier if customer questions must not be used for training).
- Neon database URL for the persistence work.
- Real return window, delivery charges and GST number for the checkout and order messages.
- A decision on guest checkout (currently sign-in required).

## 9. Test results and limits

Passed on 25 October: `node test.js` (registration, sign-in, lockout, codes, orders, the refused `AE` order, the demo payment path, signatures, config), `node test-ui.js` (headless browser: menus, product page, cart, mobile-number sign-in, checkout) and `node test-vercel.js` (the serverless entry). The deployed site was confirmed to serve the new bundle, `pay: "demo"` and, after the config call was made to wait for the feed (commit `c32e18f`), the live Frankfurter display rates dated 25 October. Not run, pending credentials: Google registration and sign-in with a real client id, gateway test transactions, webhook replay, Gemini answers.
