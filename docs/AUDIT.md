# Mytekkstore website audit, 22 October 2026

Scope: the live site https://mytekkstore.vercel.app (commit 545999d) and this repository. Written to answer the owner's brief in the order asked for: inspect first, review the audit, confirm the missing business information, then make the major changes.

## 1. How this was checked

| Method | What it covered |
|---|---|
| Real Chrome, desktop 1536 px | Every page: home, Televisions, product, offers, cart, sign-in with a one-time code, checkout, a cash-on-delivery order and its order page, account, about, contact, shipping, returns, buying guide, 404, search suggestions, help bot, country switcher |
| Headless Edge at 360, 390, 768, 1024, 1440 and 1920 px | Home, Televisions, product, cart, account, contact: page width against scroll width, fixed elements, text under 11 px, console errors. No overflow, no errors at any width |
| Lighthouse 12, mobile preset, on the live site | Home and one product page: performance, accessibility, best practices, SEO |
| Code reading | server.js (routes, SEO output, security headers, payments, orders), web/src (every page component, data.js, style.css), data/products.json, docs/ |
| Test suites | `node test.js` (API), `node test-vercel.js`, `node test-ui.js` (headless browser): all passing at 545999d |

Not verified today: the five reference sites (section 5 relies on the research of 12 and 15 October), real-user field data (none exists), screen-reader behaviour, payment gateways (none is connected).

## 2. Scorecard, current state

Scores describe what exists today, with the evidence that sets them. Targets for after the work are in section 6, kept apart from these.

| Area | Score /10 | Evidence |
|---|---|---|
| Visual quality | 7 | Coherent "studio" theme: paper background, ink buttons, brand green accent, Manrope and Space Grotesk headlines. Costs: three font families load on every page; four home sections (size, budget, OS, screen type) use the same card grid. |
| Brand identity | 6 | Logo wordmark and bolt are consistent, colour and type are consistent. No brand voice beyond "factory prices"; the brand showcases use generic lines; no Elista or Telefunken logo files (wordmarks only). |
| Homepage hierarchy | 7 | After the reorder of 22 October: hero, launches, Deals of the Day, four finders, brand showcases, bank offers, why us, care, reviews, FAQ. 13 sections over about 12 desktop screens: long. |
| Navigation | 8 | Mega menu by size, brand and OS; Brands and Best Deals; phone bottom bar; search with suggestions and keyboard support. Two bar items are dead by client decision (Washing Machines, Air Conditioners). |
| Product discovery | 8 | Seven filter groups with live counts, sort, chips, clear all, URL state, phone drawer, compare tick with sticky bar and a /compare page, three discovery tabs. No guided "find my TV" quiz. |
| Product information | 6 | Seven specification rows per TV, grouped tabs, EMI plans, pincode check, warranty box, auto-built A+ blocks. Missing: model numbers, warranty period per model, port counts, HDR, energy label, real descriptions. |
| Product imagery | 4 | Nine TVs share five renders (p0, p1, p2, p3, p34; the "-v" files are the same renders with another screen). No model has its own photo set (`images[]` is empty on all nine); the gallery pads with two shared room photos and generated studio, screen and stand crops. |
| Motion and video | 7 | Motion library, reduced-motion respected everywhere, hero loop with a static fallback, category feature band loop, A+ hero loop. Restrained. |
| Mobile usability | 6, corrected in the second pass | No horizontal overflow at any of the six widths; bottom navigation; filter drawer; sticky buy bar. Found in the second pass: the hero collapsed to 0 px below 760 px, so phones never saw the banner at all (fixed the same day, see section 9). |
| Trust and credibility | 5 | Bank offers are sample text, the two reviews are sample, the warranty Q&A is a draft, the contact page has no phone or email, no company name, GST or address anywhere, and the delivery promise ("3 to 5 days, across India") is unconfirmed. |
| Cart and checkout | 7 | Works end to end; prices and stock are re-checked on the server; cash on delivery is real; online payment is a clearly labelled demo; sign-in is required before checkout (no guest checkout). |
| Accessibility | 7 | Skip link, labelled icons, visible focus, Escape closes menus and dialogs, reduced motion. Lighthouse accessibility 91 (home) and 89 (product): buttons without an accessible name, some text below contrast, links in text not distinguishable without colour. Screen-reader run not done. |
| SEO | 9 | Server-written titles, descriptions, canonical, Open Graph, Product, Offer, BreadcrumbList, ItemList, WebSite and Organization schema, sitemap with 23 URLs, robots. Lighthouse SEO 100 on both pages. No Twitter card tags. |
| Performance | 4 | Lighthouse mobile (simulated slow 4G): performance 47 (home) and 46 (product); LCP 5.0 s and 5.1 s; total blocking time 950 ms and 1,340 ms; CLS 0; first contentful paint 4.3 s. Causes: one 519 KB JS bundle (165 KB gzip) that also carries the admin, 144 KB CSS, three font families, and a hero headline that waits for JavaScript so the LCP element is the paragraph under it. |

## 3. Findings

Priority: P1 do first, P2 next, P3 later. Effort: S under a day, M a few days, L a week or more.

| Area | Current implementation | Evidence | Problem | Recommended improvement | Sales or customer impact | Effort | Priority |
|---|---|---|---|---|---|---|---|
| Performance | One 519 KB bundle for every page, admin included; hero text rendered by JavaScript; three font families | Lighthouse 47 and 46; main-thread work 6.5 s and 7.5 s | Slow first paint on a phone network; blocking time over 900 ms | Split the admin and motion code out of the shopper bundle, defer non-critical scripts, render the hero headline as static HTML, drop one font family, serve responsive sizes for the product cut-out | High: slow pages lose mobile shoppers | M | P1 |
| Product photos | Five shared renders for nine models, no per-model gallery | products.json `images[]` empty; gallery built by `galleryOf` in data.js | A shopper comparing two Elista 43s sees the same picture; the brief forbids one generic image per model | Get the real photo sets from Elista and Telefunken (front, angle, ports, remote, stand); load through the admin or `images[]` | High: imagery is the first thing a TV buyer judges | M, needs assets | P1, blocked (Q7) |
| Trust content | Bank offers, reviews, warranty Q&A and the delivery promise are samples or drafts | data.js BANK_OFFERS "SAMPLE", WARRANTY_QA "DRAFT", two seeded reviews, POLICY draft | Sample offers can mislead; seeded reviews break the brief's rule; a wrong warranty answer is a liability | Replace with confirmed terms or remove until confirmed; show reviews only once real ones exist | High: credibility | S once confirmed | P1, blocked (Q2, Q3, Q5, Q8) |
| Contact details | CONTACT in data.js is empty, so the contact page has only a form and the category help strip stays hidden | info.jsx, category.jsx `Help()` | No phone, WhatsApp or email anywhere | Fill CONTACT (phone with country code, email, hours, address); the help strip and the call, WhatsApp and email cards switch on by themselves | High: electronics buyers call before a large purchase | S once confirmed | P1, blocked (Q9) |
| Payment | Cash on delivery is real; UPI, card and net banking open a demo window | api.js `demoPay`; checkout copy says it is a demo | Cannot take prepaid orders | Choose a gateway (Razorpay is the usual choice in India), create orders and verify signatures on the server, keep the demo labelled until keys exist | High: prepaid share of orders | M | P1, blocked (Q4) |
| Delivery coverage | "Across India, usually 3 to 5 days"; the pincode check accepts any valid India Post pincode | server.js pincode route, info.jsx | A pincode the business cannot serve still says "Delivery available" | Confirm serviceable areas and the real lead time; then the check can answer honestly | High: a wrong promise means cancelled orders | S after confirmation | P1, blocked (Q1) |
| Product data | No model numbers, no warranty row, seven spec rows | products.json | Search by model number is impossible; warranty length differs by brand and cannot be shown | Add model number, warranty period, HDMI and USB counts, HDR, energy label per TV from the brand spec sheets | Medium to high: completeness drives confidence | S to M, data entry | P1, blocked (Q6) |
| One-time code on screen | OTP_DEMO is on for the demo | live /api/config `demoCodes: true` | Must be off before real customers | Add the Brevo key and sender, or Twilio, then remove OTP_DEMO | High at launch, none for the demo | S, blocked (Q10) | P1 at launch |
| Sign-in before checkout | Required | server.js orders route; checkout.jsx redirect | An extra step for first-time buyers; the brief lists guest checkout | Allow guest orders (the API already stores orders with no user), keep the account prompt after the order | Medium: fewer drop-offs | S | P2 |
| Guided TV finder | None; the help bot answers "best under ₹30,000" by rules | chatbot.js | Brief section 10 asks for a guided finder | A four-question finder (budget, size, viewing distance, use) that opens the filtered Televisions page, built on the existing `listUrl` filters; no new data needed | Medium: helps undecided buyers | S | P2 |
| Use-case shortcuts | None | home.jsx | Brief section 9 | Derive from specs already present: 4K at 55 inch and up for films and sport, Google TV for streaming, 32 inch for small rooms; show only where the catalogue has matches | Medium | S | P2 |
| Analytics | dataLayer events: view_item, add_to_cart, purchase, chat_ask; Clarity optional | api.js `track`, server.js CLARITY | No search, filter, compare, checkout-start or cart-removal events; no tag container connected, so nothing is measured today | Add the five missing events; connect GTM or GA4 once the client gives the container id; enable Clarity with its project id | Medium: no baseline without it | S | P2, ids blocked (Q11) |
| Accessibility | Lighthouse 91 and 89 | button-name, color-contrast, link-in-text-block audits | Icon-only buttons without a name; muted text below 4.5:1; in-text links rely on colour | Add aria-labels to the unnamed buttons, darken the muted token, underline in-text links | Medium: WCAG 2.2 AA | S | P2 |
| Home length | 13 sections | home.jsx | Four finder grids repeat the same layout; the brand showcases repeat the launch cards | Merge the size, budget, OS and screen-type finders into the tabbed finder the Televisions page already has | Medium: shorter path to products | S | P2 |
| Footer | Shop, Brands, Help and Mytekkstore columns, trust row | components.jsx Footer | No company name, address, GST, support hours, social links or payment marks | Add once the business supplies them | Medium: credibility | S, blocked (Q9) | P2 |
| Announcement strip | Exists in code, hidden by the studio theme | style.css `.ticker { display:none }` | Brief section 1 wants one verified announcement | Show one line once a real offer or service message is confirmed; otherwise leave hidden | Low | S, blocked (Q12) | P3 |
| Google sign-in | Button hidden until a client id exists | live /api/config `google: ""` | Fewer sign-in options | Add GOOGLE_CLIENT_ID on Vercel | Low to medium | S, blocked (Q10) | P3 |
| Tiny text | 10.5 px captions in the delivery chip and kicker labels | probe at six widths | Below the 11 px comfort line | Raise to 12 px | Low | S | P3, done |
| Phone hero | Collapsed to 0 px below 760 px: the hero had auto height while its slides stayed absolutely positioned, so the first thing a phone showed was Latest Launches | headless probe at 412 px, hero rect height 0, launch grid at y 230 | Phones never saw the banner, the headline or the two calls to action | The slide in view sits in the flow; the photo row is 54vw so it stays the largest element on the first screen | High: most shoppers are on phones | S | P1, done |
| Dead bar items | Washing Machines and Air Conditioners are plain text | components.jsx `.soon` | A tap does nothing | Client decision of 12 October (no badge, no page); revisit when those categories go live | Low | none | Keep |
| Country switcher | India, UAE, USA with sample rates | data.js COUNTRIES | Converted prices are not real prices; checkout stays in rupees | Keep (owner decision of 22 October); real export pricing would need prices per country in the admin | Low | none | Keep |

## 4. Business information to confirm before the major changes

Only Mytekkstore or the brands can supply these. Each blocks a P1 item above. Until they arrive the site keeps its clearly marked samples and drafts.

1. **Delivery coverage.** All India, or specific states or cities? Is there a pincode list? The real lead time (the site says 3 to 5 days). Any charge for remote areas? Installation or wall mounting: offered, by whom, at what cost?
2. **Warranty.** For each brand: warranty length on the panel and on the set, who services it (brand service centre, Mytekkstore, a partner), how a claim starts, and whether an extended warranty is sold.
3. **Returns.** The 7-day return window and 7-working-day refund in POLICY are drafts. Confirm the window, the conditions, and who pays the pickup.
4. **Payment.** Which gateway and account (Razorpay, PayU, Cashfree, PhonePe), and whether cash on delivery stays. The key id and secret go into Vercel environment variables, never into the repo.
5. **Bank offers and EMI.** The four bank offers are samples. Supply the real bank, headline, terms, dates and the cards that give No Cost EMI, or the section comes out.
6. **Product catalogue.** For each of the nine TVs: model number, exact name, MRP, selling price, stock, warranty period, full spec sheet (ports, HDR, refresh rate, energy rating, speakers, OS version). Any models to add or remove.
7. **Product assets.** Per-model photo sets from Elista and Telefunken, brand logo files with permission to use them, any brand videos. Until then the five shared renders stay.
8. **Reviews.** Real customer reviews with permission, or the review section stays empty. The two seeded reviews (Vikram R., Priya S.) go before launch.
9. **Contact and company.** Support phone with +91, WhatsApp number, email, support hours, registered company name, address, GST number. These also complete the footer, Terms and Privacy pages.
10. **Sign-in and messages.** Brevo (email) or Twilio (SMS) keys so codes stop showing on screen; the Google client id for Google sign-in.
11. **Analytics.** Google Tag Manager or GA4 id; Microsoft Clarity project id. Without one the site records events locally only.
12. **Announcement.** One true line for the strip, if any (a real offer, a delivery note), or it stays hidden.
13. **Festive offer end date.** FESTIVE.ends is empty, so no countdown shows. Only a real date goes in.

## 5. Reference sites

The brief lists Samsung India, Sony India, Croma, Reliance Digital and Apple. Samsung, Sony, Croma and Apple (with LG, Flipkart, Amazon and Best Buy) were studied on 12 and 15 October for the category pages and the hero, and that work is already in the site. They were not re-opened today, and Reliance Digital has not been studied; both are limitations.

| Reference | Pattern worth learning | In Mytekkstore today | Adapt now, later, or not |
|---|---|---|---|
| Samsung India | Compare tick on every card with a sticky compare bar; size pills on cards; EMI per month on cards; spec-led product pages with a stat band | Yes: compare tick and bar, size pills, EMI line, A+ stat band | Done |
| Sony India | Calm hero with one product and two CTAs; find-by-size and budget clusters; detailed spec groups | Yes: split hero, Find your TV clusters, grouped specs | Done |
| Croma | Faceted filters with counts, "Know before you buy" explainers, a help strip (call, WhatsApp, email) at the end of category pages | Filters and explainers yes; the help strip waits for CONTACT | Help strip: now, once contact details arrive |
| Apple | Short headlines, generous whitespace, product-led storytelling, one message per section | Partly, after the restraint pass of 21 October; the home page still has 13 sections | Merge the four finder grids: now |
| LG | OS comparison table, card-style launcher explanation | Yes: OS chart | Done |
| Reliance Digital | Not studied | | Later, if a second Indian-retailer reference is wanted |

## 6. Plan

**Now, needs no business input (each item independent):**
1. Performance: split the admin and motion code out of the shopper bundle, defer non-critical scripts, static hero headline, one fewer font family, responsive product cut-outs. Target: Lighthouse mobile performance above 75, LCP under 2.5 s on the lab run.
2. Accessibility fixes for the three Lighthouse audits.
3. Guest checkout, keeping the account prompt after the order.
4. Guided TV finder on the home and Televisions pages, built on the existing filters.
5. Use-case shortcuts derived from specs.
6. Five missing analytics events: search, filter_apply, compare_open, begin_checkout, remove_from_cart.
7. Merge the four home finder grids into the tabbed finder the Televisions page already has; raise 10.5 px captions to 12 px.

**After confirmation (needs the answers in section 4):**
1. Real product photos and spec sheets loaded; galleries per model (Q6, Q7).
2. Real warranty, returns and delivery wording; the pincode check limited to serviceable areas (Q1, Q2, Q3).
3. Real bank offers or the section removed; real reviews or the section emptied (Q5, Q8).
4. Payment gateway with server-side verification; codes by email or SMS; Google sign-in (Q4, Q10).
5. Contact, footer, Terms and Privacy completed with company details; help strip on (Q9).
6. Tag manager and Clarity connected; a baseline week of data before any conversion claim (Q11).

**Not now:** semantic search, personalisation, shoppable video, WhatsApp integration beyond a link, order tracking beyond the four statuses. Each needs data, assets or a service the business does not have yet.

Targets after the work above, as goals rather than measurements: visual 8, trust 8, product information 8, imagery 8 with real assets, Lighthouse mobile performance above 75, and Core Web Vitals within Google's thresholds (LCP 2.5 s, INP 200 ms, CLS 0.1) once field data exists.

## 7. Already built, so not rebuilt

The brief's sections 2 to 15 are largely present: header with mega menus and search, split hero with video and a static fallback, trust rows, brand showcases, Deals of the Day, shop by size and budget, OS comparison, compare tool, buying guide, FAQ, footer, filters and sort with URL state, product page with gallery, zoom, pincode check, EMI plans, warranty box, A+ content, specs tabs, reviews, Q&A, compare and related rows, cart drawer, checkout with server-side validation, order page with tracking steps, account with order history, admin for products, orders, banners and the outbox, server-written SEO tags and schema, sitemap, robots, security headers, three test suites. The work ahead is content, assets, integrations, speed and a few discovery features, not a rebuild.

## 8. Limitations

No field performance data exists (no analytics connected). Lighthouse numbers are lab runs from one machine on the mobile preset. Reference sites were not re-verified today. Payment, SMS, email and Google sign-in cannot be tested until keys exist. Screen-reader testing was not done.

## 9. Second pass, same day (commits 8f29a56 and 8309e01)

The owner said the research was done and the implementation was what they still needed, so the "now" items of section 6 were built, tested and deployed. Measured again with the same Lighthouse 12 mobile preset.

| Page | Before (live) | After (live) |
|---|---|---|
| Home | performance 47, LCP 5.0 s, FCP 4.3 s, accessibility 91 | home 73 (LCP 2.4 s, FCP 1.7 s, CLS 0, accessibility 100), product page 68 (LCP 2.9 s, CLS 0), Televisions 66 (LCP 3.1 s, CLS 0); best practices and SEO 100 on all three |
| Local lab, home | 50 | 76 |
| Local lab, product | 46 | 75 |
| Local lab, Televisions | not measured | 69 |

What changed:

1. **First paint from the HTML.** The home page's header and first banner are written into the HTML shell by the server (a block beside the React root that the app removes in the same frame it draws the real page), so the page paints before the 500 KB script runs. The script itself is started two animation frames after the HTML, by a one-line boot file, so the browser always gets a frame in first. Web fonts are requested once the page is drawn rather than from the shell. The admin page is its own chunk. First paint went from 4.3 s to 1.6 s on the lab run.
2. **Phone hero bug fixed.** See the new finding in section 3. It had been live since the split-hero theme.
3. **One finder instead of four grids.** The home page's size, budget, OS and screen-type grids became the tabbed finder the Televisions page already had (now with a Budget tab), plus a four-question "Help me choose" finder with a live match count that opens the filtered Televisions page. Use cases are inside it ("Films and sport" means 4K; the room sizes are the sizes in stock), so nothing is invented.
4. **Accessibility 91 to 100** on the home page: the accent a shade darker so text in it passes 4.5:1, in-text links underlined, the help button named, A+ stat captions brighter, 10.5 px captions raised to 12 px.
5. **Analytics events** search, filter, compare_add, begin_checkout, remove_from_cart and finder, on the same dataLayer hook as before. Still nothing is connected (Q11).
6. **Cleanup step** now follows imports, after it removed the motion and admin chunks of a build.
7. **Fonts without a shift.** Web fonts are requested once the page is drawn (a font link in the shell cost 2 s of LCP in the lab model; requesting them at script start pushed the product page first paint to 4.9 s). Width-matched fallback faces for Inter, Manrope and Space Grotesk keep the text from reflowing when the fonts arrive: CLS 0 on all three pages, where a plain fallback gave 0.19 on the product page.

What is left of the "now" list: guest checkout (needs the owner's decision, since sign-in is also how the phone number gets verified before an order), the bundle itself (React and Motion are most of it; the next step would be server rendering, a larger change). The remaining LCP on the home page is the headline's font swap and React's render.

Not done and still waiting on section 4: everything in "after confirmation".
