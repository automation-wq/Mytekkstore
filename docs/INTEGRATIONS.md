# Sign-up, payments and the shared data store — integration plan, 25 October 2026

Facts below were checked against the vendors' own documentation on 25 October 2026 and against this repository's code the same day. Nothing here is implemented yet; this is the plan and the list of what the business must supply before it can be.

## 1. What the site does today (verified in code and by the suites)

| Area | Today | Where | State |
|---|---|---|---|
| Sign-up and sign-in | Email + password register/login; one-time code by email (Brevo) or SMS/WhatsApp (Twilio); Google sign-in if a client id is set | `server.js` routes `register`, `login`, `otp/send`, `otp/verify`, `login/google`; `web/src/account.jsx` | Works locally; the browser suite signs in with a mobile number and a code |
| Sessions | In memory (`sessions = new Map()`), a week long | `server.js` line ~102 | **Lost on every restart and not shared between Vercel instances**, so live sign-in is unreliable |
| Users and orders | JSON files in `data/` (on Vercel: `/tmp`, per instance) | `server.js` `DATA_DIR` | Same problem: live accounts and orders can vanish between requests |
| Checkout | `POST /api/orders` validates items and address server-side, prices from the catalogue, sign-in required (the route is registered with the `"user"` guard; guest checkout is an owner decision, not a current feature); `pay: "online"` is marked "Paid online (demo payment)" | `server.js` orders route; `web/src/pages1.jsx` Checkout | **No payment is taken.** COD orders are real in shape |
| Keys the server reads | `BREVO_API_KEY`, `MAIL_FROM`, `TWILIO_*`, `GOOGLE_CLIENT_ID`, `ADMIN_PASSWORD`, `CLARITY_ID`, `OTP_DEMO` | `server.js`, `start.bat` | All empty on the live site today |

End-to-end check on 25 October: `node test.js` passes (register, login, order placement, order privacy, validation); `node test-ui.js` passes including "sign in with a mobile number and a code", cart and checkout steps. The flows work; what is missing is persistence and a real gateway.

## 2. Recommendation

Three pieces, in this order of urgency:

1. **Razorpay** for payments (the money). Shopify Payments and Stripe India are not options for this merchant; Razorpay supports UPI, cards, netbanking, wallets and EMI, settles in INR, and has a documented standard checkout.
2. **Neon serverless Postgres** for orders, carts, wishlists and addresses (the reliability). Fixes the `/tmp` problem that breaks live accounts and orders.
3. **Clerk** for sign-up and sign-in (the identity). Hosted users and sessions, email codes, passwords, Google, with phone OTP available on its paid plan. Removes the in-memory session map and the Brevo/Twilio plumbing.

Why not keep the custom sign-in: it works, but it needs the business to run Brevo and Twilio accounts, store users safely, handle resets and lockouts, and it still needs a database. Clerk's free tier covers everything except SMS.

## 3. Costs (vendor pages, 25 October 2026)

| Vendor | Free | Paid | Notes |
|---|---|---|---|
| Razorpay | No setup fee, no annual charge | 2% per successful domestic transaction + 18% GST on the fee; up to 3% on international cards; refunds free | EMI through Bajaj Finance carries its own platform charge (6% to 13.5% by tenure); "No Cost EMI" is a bank/brand subvention, not a Razorpay default |
| Clerk | Hobby: 50,000 monthly retained users (a user counts only if they return after their first day) | Pro $25/month ($20 annual) | **Phone OTP by SMS is Pro only**, billed per SMS at "market rate" for India; email codes, passwords and Google are free |
| Neon | 1 GB storage per project, 100 compute hours per project, 20 GB per account | Pay as you go: $0.106 per compute hour, $0.35 per GB-month | A store this size stays inside the free plan for a long time |

## 4. How each piece fits this code

### Razorpay (Standard Checkout)
1. Server: new route `POST /api/pay/order` — takes the cart, recomputes the total from the catalogue (never from the client), calls Razorpay `POST /v1/orders` with Basic auth (`RAZORPAY_KEY_ID`:`RAZORPAY_KEY_SECRET`), amount in paise, currency INR, stores the Razorpay `order_id` against a pending order in the database. Returns `order_id`, amount and the key id.
2. Client (`pages1.jsx` Checkout): load `https://checkout.razorpay.com/v1/checkout.js`, open it with the key id and `order_id`; on success it returns `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`.
3. Server: `POST /api/pay/verify` — recompute `HMAC_SHA256(order_id + "|" + razorpay_payment_id, key_secret)` using the order id from the database, compare to the signature, then mark the order paid. Never trust the client's success alone.
4. Webhook `POST /api/pay/webhook` for `order.paid` and `payment.failed`, verified with the webhook secret, so a closed browser still results in a paid order.
5. The current "demo payment" branch stays only when no Razorpay keys are set, labelled as a demo.
6. CSP in `server.js` must allow `checkout.razorpay.com` for scripts and frames.

### Neon (Postgres)
- Tables: `users` (if Clerk is used, only the Clerk id and profile mirror), `addresses`, `orders`, `order_items`, `wishlist`, `carts`.
- Access from `server.js` with the `pg` or `@neondatabase/serverless` driver through `DATABASE_URL`; the JSON-file store becomes the local fallback when the variable is absent, so `node test.js` keeps working offline.
- `api/index.js` on Vercel reads the same variable.

### Clerk
- Backend: `@clerk/express` `clerkMiddleware()` on the API; `getAuth(req)` replaces the session-token lookup; `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
- Frontend: Clerk's React SDK with its provider around the app and its sign-in and sign-up components on `/account`; the custom register, login and OTP forms in `account.jsx` are retired.
- Google sign-in is configured in the Clerk dashboard, so `GOOGLE_CLIENT_ID` and the Brevo/Twilio keys are no longer needed.
- Orders stay keyed by the Clerk user id; checkout keeps requiring a signed-in user unless the owner decides to allow guests.

## 5. What the business must supply

| For | Needed | Who |
|---|---|---|
| Razorpay | A Razorpay account with KYC (PAN, GST, bank account), the website reviewed by Razorpay, then **test** key id and secret first, **live** keys after approval; a webhook secret | Owner |
| Clerk | A Clerk application; publishable and secret keys; Google OAuth enabled in the Clerk dashboard; Pro plan only if phone OTP is required | Owner (free tier to start) |
| Neon | A Neon project; its `DATABASE_URL` | Owner or me, under the owner's account |
| Vercel | The keys above as environment variables on the project, never in the repository | Owner grants, I set |
| Policies | The real return window, delivery charges and GST number, because the checkout and the order mail state them | Owner |

## 6. Order of work once the keys arrive

1. Neon: schema, driver, migrate orders/users/wishlist off JSON, keep the JSON fallback for local tests. Verify: place an order on the live site from two browsers and read it back from the account page.
2. Razorpay in test mode: order creation, checkout, signature verification, webhook; a test card (`4100 2800 0000 1007`) and a failed payment; refund from the Razorpay dashboard reflected on the order. Then live keys.
3. Clerk: provider and components, middleware, retire the custom forms; verify sign-up by email code, password and Google; wishlist and orders attached to the user.
4. Suites: extend `test.js` with signature verification (a pure function, testable offline) and `test-ui.js` with the test-mode checkout.

## 7. Risks and limits

- Razorpay KYC and website review take days; nothing can be charged before it.
- Clerk phone OTP for Indian numbers costs per SMS on the paid plan; email codes and Google are free and may be enough for launch.
- Any gateway work needs test keys to be verified; I will not claim it works without a test transaction.
- Prices and plan limits above are as published on 25 October 2026 and should be reconfirmed when accounts are created.

## Durable storage — built 26 October 2026, behind DATABASE_URL

**Why:** a cash-on-delivery order placed on the live site answered "Order not found": on Vercel the data sits in each serverless instance's /tmp and the sessions in its memory, so the instance that took the order is not the one that showed the order page, and the order is gone when the instance is recycled.

**What is built (server.js, no dependencies):** with DATABASE_URL set, users and orders are one row per record (table docs), sessions are rows (table sessions), and the admin-edited collections are one JSON document each (table kv), all through Neon's HTTP SQL endpoint over fetch. Every page and API request first pulls what other instances saved; every response waits for its own writes to land. Without DATABASE_URL nothing changes.

**Verified:** node test-db.js runs the whole API suite against a stand-in for the Neon endpoint and then proves the fix — an order placed through one server process is found, with the same sign-in cookie, by a second fresh process. **Not yet run against a real Neon database** (none exists yet); the first real run is the owner's next step.

**To switch it on:** Vercel → the project → Storage → Create database → Neon (free plan) → Connect to project. Vercel writes DATABASE_URL into the project's environment; redeploy. From then on orders and accounts survive instance restarts and are the same on every instance.


## Sign-up flow — built 27 October 2026 to the owner's spec, behind these keys

The flow (details → mobile → OTP → verified → create account → pincode → welcome code → dashboard; login: mobile → OTP → back to the page; Google → mobile OTP once) runs on this server. The rules of the spec are in: codes hashed only, 5-minute expiry, five attempts then a 15-minute lock, three codes per number per 15 minutes, ten per address per hour, a new code replaces the old, same-site JSON only, httpOnly cookies, prices and coupons checked on the server, an order needs a verified mobile number. WhatsApp was removed from the site on 27 October at the owner's request.

What switches each piece on (Vercel → Project → Settings → Environment Variables, then redeploy):

| Piece | Keys | Where the owner gets them |
|---|---|---|
| OTP by SMS, India | MSG91_AUTH_KEY, MSG91_TEMPLATE_ID | control.msg91.com: an account on the business's own email, DLT registration of the sender id and an OTP template whose variable is ##OTP##, then the Authkey and the template id |
| SMS outside India, order and welcome texts | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM | twilio.com |
| Bot check on send-code | RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET | google.com/recaptcha/admin → v3 → add mytekkstore.vercel.app |
| Google sign-in | GOOGLE_CLIENT_ID | console.cloud.google.com → OAuth client (web) with https://mytekkstore.vercel.app as an authorised origin |
| Use my current location | GOOGLE_MAPS_SERVER_KEY | console.cloud.google.com → Geocoding API → a server key restricted to that API |
| Email codes, order and welcome mails | BREVO_API_KEY, MAIL_FROM | brevo.com |
| Durable accounts and orders | DATABASE_URL | Vercel → Storage → Neon |

Until the SMS keys exist the code is shown on the page only on localhost or with OTP_DEMO=1; on the live site the send-code route answers 503 and the page says SMS codes are not set up yet.
