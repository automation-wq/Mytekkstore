# Mytekkstore on Shopify — theme vs Hydrogen, admin, international payments, premium storefront

Stage 1 deliverable, 22 October 2026. Research and recommendation only. **No production change was made, and no Shopify store exists yet.** Every figure below was checked against official Shopify or provider documentation on 22 October 2026; sources are listed in section 18. Prices change, so confirm them in the admin before you commit.

The one fact that decides most of this brief: **Shopify Payments is not available to merchants in India.** Everything about currency, local pricing and Markets follows from that.

---

## 1. Headline recommendation

**Build a customised premium Liquid theme on Shopify, on the Basic plan, with Razorpay as the payment gateway. Do not use Hydrogen. Sell in India first, in INR only.**

Reasoning in one paragraph: the owner needs a manageable backend far more than a bespoke frontend, and that is exactly the trade Hydrogen makes the wrong way. A Liquid theme gives the store owner the theme editor, native product and order admin, app compatibility and Shopify's own checkout with no developer in the loop for daily work. Hydrogen would hand all of that back to a developer and cost more to build and run, for a frontend the current Vercel site already matches. The international ambition does not survive contact with the payments reality: an India-registered merchant cannot charge a customer in USD or AED through Shopify's own rails, so "sell to the USA and UAE" is a later project behind real tax, shipping and gateway work, not a launch feature.

When Hydrogen would become the right call: if Mytekkstore later needs a storefront experience Liquid genuinely cannot express, or has to fold the store into a separate React app or CMS, and has a developer on retainer to run it. Not before.

---

## 2. Audit of the current website

Checked live at https://mytekkstore.vercel.app and against the source in this repo on 22 October. The existing route inventory and status table is in `docs/PLAN.md` section 2 and is not repeated here.

What exists and works: home, Televisions listing with filters/sort/compare, brand listings, product pages with gallery/zoom/EMI/pincode check/specs/A+ blocks, cart, checkout (verified locally), account sign-in code step, offers, compare, info pages, admin, sitemap and robots. Lighthouse mobile on the live site: home 91, product 73, Televisions 67, CLS 0, accessibility 100, SEO and best-practices 100.

Catalogue today: **14 products across 6 model families** (Televisions 9: Elista 5, Telefunken 4; Washing Machines 3; Air Conditioners 2). Specs are stored as label/value arrays per product, which maps cleanly onto Shopify metafields. 4 of 14 products carry reviews; those are seeded samples.

What is a prototype, not a real store: sessions and orders live in `data/*.json` (or `/tmp` on Vercel, so they do not persist across instances); payment is simulated; the 13 business facts in `docs/AUDIT.md` section 4 (delivery, warranty, returns, real catalogue, photos, reviews, contact, GST) are still unconfirmed. A migration to Shopify does not need those facts resolved first, but launch does.

Migration implication: the product data, URLs and spec structure port well. The custom Node server, the simulated checkout and the JSON stores are all replaced by Shopify's platform, which is the point — that is the code the owner should stop maintaining.

---

## 3. Theme vs Hydrogen comparison

| Dimension | Liquid theme | Hydrogen (headless) |
|---|---|---|
| Who edits the homepage, banners, menus | Store owner, in the theme editor | Developer, in React code or a metaobject system you build |
| Product/collection/order admin | Native Shopify admin | Native Shopify admin (same) |
| Checkout | Shopify checkout, maintained by Shopify | Shopify checkout (handed off), same |
| Customer accounts | Built in | Customer Account API; needs real store, HTTPS, the Headless/Hydrogen sales channel and a session manager you wire up |
| Product comparison | App (Iconic) or theme code | Custom React |
| Filters / predictive search | Search & Discovery app, native | Custom, querying the Storefront API |
| Framework | None to run; Shopify hosts Liquid | React Router 7 (or Next/Astro/etc.), deployed to Oxygen |
| Hosting | Included | Oxygen, free on all plans except Starter |
| Build cost | Theme price plus customisation | Higher: "A headless storefront costs more to build and run than a theme" (Shopify) |
| Ongoing maintenance | Owner for content, occasional dev for code | Developer for everything frontend |
| Best when | You want a premium store a non-developer can run | Liquid genuinely can't express the experience, or you're embedding commerce in another app |

Shopify's own guidance: build headless only when "a merchant's business systems, processes, or customer experience can't be achieved with Shopify's sales channels, themes, and apps." Mytekkstore does not meet that bar.

---

## 4. Theme shortlist (verified 22 October, prices one-time USD)

Confirm the live price and view the demo on each theme page before buying; demo URLs render client-side and were not extractable by the research fetch.

| Theme | Developer | Price | Fit for an electronics store | Rating |
|---|---|---|---|---|
| **Warehouse** (recommended) | Maestrooo | $320 | Explicitly built for large catalogues ("1000s of products"), filtering, mega menu, product tabs for specs, media incl. video | 84% |
| Impact | Maestrooo | $400 | 35+ sections, filtering, mega menu, product tabs, swatches; no native comparison | 85% |
| Empire | Pixel Union | $360 | Built for big catalogues with advanced filters; lists product comparison and mega menu | 79% |
| Prestige | Maestrooo | $400 | Polished, luxury-leaning; filtering and search present, comparison not native | 91% |

Recommendation: **Warehouse** — it is the one shortlisted theme that names large-catalogue electronics as its purpose, and it is the cheapest of the four. None of these ship a native spec-comparison table for electronics, so pair the theme with a comparison app (section 11) regardless of choice. A nine-to-fourteen product catalogue is small, so "large catalogue" is headroom, not a need; Warehouse still wins on filtering and product-tab specs.

---

## 5. Product and specification data model (metafields)

Model TV specs as a metaobject or a set of product metafield definitions so they are structured, filterable and reusable, not free text. Shopify metafields support text, number, **measurement** (e.g. cm, inch, Hz, W), list, rating and metaobject-reference types, and Search & Discovery can filter on them.

Suggested definitions (namespace `specs`):

| Field | Type | Example |
|---|---|---|
| Brand, Model number | single-line text | Elista, ELS-32HD |
| Screen size | measurement (dimension) | 80 cm / 32 inch |
| Resolution | single-line text (or enum) | HD Ready 1366×768 |
| Display type | enum | LED / QLED |
| Smart TV OS | enum | WebOS / Google TV |
| Refresh rate | measurement (frequency) | 60 Hz |
| Sound output | measurement (power) | 20 W |
| Ports | list of single-line text | 2 HDMI, 1 USB |
| Warranty | single-line text | 1 year + 1 year panel |
| In the box | list of single-line text | TV, stand, remote, 2 AAA |
| Dimensions, Weight | measurement | — |
| Energy rating | enum | — |

Only populate fields relevant to each product; blank fields do not render. Do not fabricate a spec — this maps to the catalogue fact (AUDIT §4.6) still owed by the client.

---

## 6. Admin capability matrix (who does what, where)

Native = Shopify admin out of the box. App = needs an installed app. Dev = one-time developer setup.

| Task | How | Native / App / Dev |
|---|---|---|
| Add/edit/duplicate/archive product | Products | Native |
| Price, compare-at, SKU, barcode, stock | Products | Native |
| Product images, alt text, video | Products | Native |
| Specs | Metafields (section 5) | Native (defs once: Dev-lite) |
| Variants | Products | Native |
| Collections, featured, brand collections | Products → Collections | Native |
| Homepage hero, banners, menus | Theme editor | Native |
| Orders, fulfilment, tracking, cancel, refund | Orders | Native |
| Discount codes, automatic discounts | Discounts | Native |
| Bulk edit / CSV import-export | Products bulk editor, CSV | Native (watch column dependencies) |
| Low-stock alert | Shopify Flow (free, all plans) — inventory-quantity-changed trigger → email | Native |
| GST invoice | **Not native** — needs an Indian GST invoicing app | App |
| Pincode serviceability | **Not native** | App (section 11) |
| COD restriction by pincode/product/value, OTP | **Not native** beyond basic COD | App (section 11) |
| Reviews | **Not native** | App (Judge.me) |
| Product comparison table | **Not native** | App (Iconic) |
| Wishlist | **Not native** | App |

Native COD exists (order marked unpaid, mark paid later) but has **no built-in restriction by product or address** — that needs an app.

---

## 7. International selling and payments — the hard constraint

**Shopify Payments does not operate in India.** Indian merchants must use an RBI-regulated third-party gateway (Razorpay, PayU, Cashfree, CCAvenue). This has three consequences that the current site's currency switcher hides:

1. **Local-currency checkout is impossible without Shopify Payments or Adyen.** Shopify: "If you use a different provider, then customers in all markets pay in your store's default currency." A third-party gateway makes the local-currency feature "only affect how prices are displayed" — the customer is still charged in INR and absorbs their bank's conversion fee.
2. **International pricing per market** needs "Shopify Payments with access to one-page checkout." Not available to this merchant.
3. **Shopify Managed Markets** (the turnkey cross-border product) is restricted to merchants in the US, Canada and the UK. India is ineligible.

So the live site's India/UAE/USA switcher is, on Shopify, a **display conversion only**. It must not imply a customer can pay in AED or USD. Keep it as an indicative price display with a clear "charged in INR" note, or drop it until genuine international fulfilment exists.

Country readiness matrix for an India-registered Mytekkstore:

| Market | Status | Why |
|---|---|---|
| India | **Ready to build** | Razorpay (UPI, cards, netbanking, wallets, EMI), INR, GST, domestic shipping |
| UAE, Saudi, USA, UK, Canada, Australia | **Not recommended yet** | No local-currency settlement via Shopify for an Indian merchant; cross-border TV shipping, duties, electrical standards and warranty all unsolved. Razorpay international charges foreign cards but settles to the Indian account in INR — that covers a foreign tourist paying, not a localised UAE storefront |

Do not mark any non-India market launch-ready. International is a Phase 3 project with its own legal, logistics and tax workstream.

---

## 8. Payments by method (India)

| Method | Via | Notes |
|---|---|---|
| UPI, cards, netbanking, wallets | **Razorpay** (recommended), or PayU/Cashfree | Razorpay app connects without API keys; owner-only; store reviewed by Razorpay first. Settles INR to Indian bank |
| EMI / No-Cost EMI | Razorpay | Real bank offers still owed by client (AUDIT §4.5) |
| Cash on Delivery | Native Shopify + Releasit app for controls | Restrict by pincode/value, OTP to cut fake orders |
| International cards | Razorpay International (160+ currencies, activation + KYC) | Settles to the Indian account in INR; this is "a foreign card can pay", not "a localised foreign storefront" |
| PayPal | PayPal Express Checkout | In India it is **USD international only** — "can't receive domestic INR payments." Not useful for a domestic Indian store |

Transaction fee on the Basic plan for a third-party gateway: **2%** on top of Razorpay's own fee. Grow 1%, Advanced 0.6%. This is the running cost of Shopify Payments being unavailable.

---

## 9. Plans and cost (India, verified 22 October)

| Plan | Monthly | Annual (per mo) | 3rd-party gateway fee |
|---|---|---|---|
| Basic (recommended) | ₹1,994 | ₹1,499 | 2% |
| Grow | ₹7,447 | ₹5,599 | 1% |
| Advanced | ₹30,164 | ₹22,680 | 0.6% |

One-off and recurring estimate for the recommended build:

- Shopify Basic, annual: ~₹1,499/mo
- Theme (Warehouse): $320 one-time (~₹27,000)
- Apps (section 11): roughly $0–$35/mo depending on tiers chosen; most of the stack has a usable free tier
- Razorpay: its own per-transaction fee plus Shopify's 2%
- GST invoicing app: a few hundred ₹/mo if needed
- Developer time: theme customisation, metafield setup, app configuration, data migration — the one-time build

Oxygen/Hydrogen hosting cost is moot since Hydrogen is not recommended; for the record Oxygen is free on all plans except Starter.

---

## 10. App and integration shortlist (minimum viable)

| Need | App | Price | Note |
|---|---|---|---|
| Search + filters (incl. metafield filters) | **Shopify Search & Discovery** | Free | Native, but recent reviews report relevance problems (2.6★); test on the real catalogue, keep a paid alternative in reserve |
| Reviews | **Judge.me** | Free; Awesome $15/mo | 5.0★, India-based, photo reviews, Google rich snippets |
| Product comparison | **Iconic Product Comparison** | Free; Growth $9.99/mo | Builds the spec table from metafields — pairs with section 5 |
| Pincode serviceability | **OC Pincode Checker** ($1.99/mo, Shiprocket link) or **PinPro** ($4.99+, per-product, disables Add-to-Cart) | — | None of the shortlisted themes do this natively |
| COD controls | **Releasit COD Form & Upsells** | Free ≤60 orders/mo; $9.99 for 360 | 4.9★, OTP, restrict by pincode/value |
| Wishlist | **Wishlist Plus** ($5.99/mo) or **Wishlist King** ($19/mo) | — | Only if the owner wants it; not launch-critical |
| GST invoice | An Indian GST invoicing app | — | Shopify does not issue a GST-compliant bill |

Prefer native before adding an app; don't stack two apps that do the same job. That keeps this list to about five installs for launch.

---

## 11. SEO, performance, accessibility

Mostly native on Shopify: canonical URLs, XML sitemap, robots, product structured data, image optimisation, semantic Liquid. Carry over from the current site as a checklist: descriptive alt text, breadcrumbs, keyboard nav, visible focus, contrast, reduced-motion (the current site already removed idle motion — keep that discipline in the theme). **Redirect mapping is the migration risk**: the current URLs like `/televisions/elista-80-cm-32-inch-hd-ready-smart-led-tv` must be mapped to the new Shopify product handles via URL redirects in admin, or SEO and any existing links break. Measure Core Web Vitals on the built theme; do not assume.

---

## 12. GST and tax (India)

- Shopify supports registration-based Indian GST but **cannot show CGST and SGST as two separate line items** — you configure the combined rate for in-state sales and IGST for out-of-state.
- Shopify does **not** produce a GST-compliant invoice with HSN codes; use a third-party GST invoicing app.
- Tax-inclusive pricing is supported (list price includes tax; Shopify back-calculates the tax portion).
- The real GST number is one of the 13 owed business facts.

---

## 13. Phased roadmap

**Phase 0 — decisions (owner).** Approve Liquid-theme-on-Basic-with-Razorpay. Supply the 13 business facts (AUDIT §4). Decide guest vs account checkout. These block launch, not the build.

**Phase 1 — Shopify setup (dev).** Development store, Basic plan. Product metafield definitions (section 5). Import the 14 products via CSV with specs. Collections: by brand, by screen size, offers, new arrivals. Navigation and mega menu. GST config. Razorpay connection (owner-only step; store must pass Razorpay review).

**Phase 2 — storefront (dev).** Install and configure Warehouse. Homepage sections per the design spec below. Product template with the spec metafields and A+ content. Collection filters via Search & Discovery. Install Judge.me, Iconic, a pincode app, Releasit. Set up URL redirects from the old site.

**Phase 3 — QA (dev + owner).** Every route, filter, sort, cart, discount, COD and card test order, refund workflow, admin-change-appears-on-storefront, accessibility, CWV. Record actual results.

**Phase 4 — launch.** Domain, DNS, SSL, Razorpay live approval, policies, inventory accuracy, analytics, cookie consent (Shopify's native customer-privacy settings), a real test order end to end. Do not launch with checkout, payment or order-management defects open.

**Phase 5 (later) — international.** Only after the legal, shipping, duty and gateway questions in section 7 are answered. Not a launch item.

---

## 14. Premium storefront design spec (homepage, top to bottom)

Carry the current site's design language (calm white theme, real lifestyle imagery, no idle motion) into the theme. Each section maps to a theme-editor block the owner can edit.

1. **Announcement bar** — one true line (a real offer or delivery note), editable; hidden until there is one.
2. **Header** — logo, predictive search, account, cart count, pincode chip, category nav (Televisions / Washing Machines / Air Conditioners), Elista and Telefunken links. INR default; indicative currency display only, "charged in INR".
3. **Hero** — lifestyle banner, one primary CTA (Shop Televisions) and one secondary (the live brand/offer).
4. **Shop by screen size** — size bands, the pattern competitors use.
5. **Featured televisions** — a hand-picked collection.
6. **Elista and Telefunken brand strips** — brand blurb and a few models each.
7. **Smart TV / resolution highlights.**
8. **Current offers** — only real bank offers; otherwise omit.
9. **Buying guide / how to choose** — links the existing guide.
10. **Delivery, payment, warranty trust row** — real policy once confirmed.
11. **Reviews** — Judge.me, only when genuine reviews exist.
12. **FAQ.**
13. **Footer** — full contact, company, GST, policy links.

Product card: image, brand + model, name, size + resolution, price, compare-at, real discount, rating (only if genuine), stock/delivery status, compare checkbox, wishlist, link. No fake reviews, no fake urgency, no unsupported discount.

Product page: breadcrumbs, gallery + zoom, title + model, price + savings + EMI, pincode serviceability, add to cart, spec table (metafields), features, warranty/installation, delivery/returns, reviews, FAQ, related and comparable models, structured data. Purchase panel first; marketing below.

---

## 15. QA checklist

Desktop, tablet, mobile. Navigation and every route; search, filter, sort; variants and pricing; cart quantity; discounts; inventory behaviour; COD and card test orders; order confirmation; refund workflow; the currency display (and its "charged in INR" caveat); admin change appearing on storefront; accessibility; CWV; SEO metadata and the migration redirects. Record pass / fail / blocked / not-run for each — do not report a feature verified until a test order has actually gone through.

---

## 16. Admin operating guide (to write after Phase 1, one page per task)

Add a TV; edit a price; replace images; update specs via metafields; change the hero banner; feature/unfeature a product; create a discount; update inventory; process and refund a test order; edit the announcement line. Each as numbered steps with the exact admin location.

---

## 17. Open decisions and risks

- **Owner decision:** Liquid-on-Basic-with-Razorpay (recommended) — confirm.
- **Owner decision:** guest checkout vs forced account.
- **Risk / fact:** the 13 business facts (AUDIT §4) still block launch.
- **Risk:** URL redirect mapping on migration — plan it or lose SEO.
- **Risk:** Search & Discovery relevance complaints — test on real data.
- **Constraint (not negotiable):** no local-currency checkout for an Indian merchant on Shopify; international selling is a separate later project.
- **Fact:** the current switcher becomes display-only on Shopify.

---

## 18. Sources (checked 22 October 2026)

- Shopify Payments supported countries (India absent): help.shopify.com/en/manual/payments/shopify-payments/supported-countries
- Local currencies require Shopify Payments or Adyen: help.shopify.com/en/manual/markets/customizations/local-currencies
- International payments / third-party display-only: help.shopify.com/en/manual/international/payments
- International pricing requires Shopify Payments + one-page checkout: help.shopify.com/en/manual/international/pricing
- Managed Markets US/CA/UK only: help.shopify.com/en/manual/international/managed-markets
- India plan pricing: shopify.com/in/pricing
- Headless guidance and cost: shopify.dev/docs/storefronts/headless
- Hydrogen overview and Customer Account API: shopify.dev/docs/storefronts/hydrogen ; .../building-with-the-customer-account-api/hydrogen
- Oxygen plan eligibility: shopify.dev changelog (Oxygen on dev/trial plans)
- Hydrogen Markets: shopify.dev/docs/storefronts/hydrogen/markets
- Metafields: help.shopify.com/en/manual/custom-data/metafields
- Shopify Flow low-stock trigger: help.shopify.com/en/manual/shopify-flow
- India GST: help.shopify.com/en/manual/taxes/india-gst
- PayPal India (USD international only): help.shopify.com/en/manual/payments/paypal/paypal-india
- Native COD: help.shopify.com/en/manual/payments/manual-payments
- Product CSV import: help.shopify.com/en/manual/products/import-export/using-csv
- Razorpay Shopify + international: razorpay.com/docs/payments/payment-gateway/ecommerce-plugins/shopify/ and .../international-payments/
- Themes: themes.shopify.com/themes/{warehouse,impact,empire,prestige}
- Apps: apps.shopify.com/{search-and-discovery, judgeme, iconic-product-comparison, oc-pincode-zipcode-checker, pincode-checker-1, releasit-cod-form, wishlist-plus, wishlist-king}
