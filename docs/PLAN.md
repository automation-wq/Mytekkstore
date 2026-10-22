# Mytekkstore premium redesign blueprint, 22 October 2026

Gates 1 to 3 of the control section: research, inventories, audit findings and competitor comparison; design system, page plans, card specification and image plan; prioritised backlog with dependencies and risks. Nothing in this document is implemented unless it says so and names the commit. Code changes wait for approval (Gate 4).

Companion: docs/AUDIT.md (the measured audit and the 13 business facts, sections 1 to 10).

## 1. Executive audit summary

- The store works end to end: catalogue, filters, compare, product pages, cart, one-time-code sign-in, checkout, cash-on-delivery orders, account, admin, SEO output, three passing test suites. Verified on the live site on 22 October (docs/AUDIT.md sections 1, 9, 10).
- What holds it back is content and assets, not code: five shared renders for nine TVs, sample bank offers, two seeded reviews, draft warranty and returns, no contact details, no payment gateway, no analytics connected. All of these need the business (the 13 facts in docs/AUDIT.md section 4).
- Speed on phones was the one technical weakness; after today's passes the home page measures Lighthouse mobile 73 (was 47), first paint 1.7 s (was 4.3 s), layout shift 0. A phone-only bug that hid the hero entirely was found and fixed.
- The owner's visual direction, confirmed today: lifestyle photography stays, nothing loops or "vibrates", cards clean, product pages information-led.
- Live demo caveat: on Vercel, sessions and accounts live inside each serverless instance, so sign-in is flaky across instances; it works on one server. A shared store is needed before real customers.

## 2. Route inventory and verification status

Verified = opened on the live site on 22 October and exercised. Rendered = returns 200 and draws, interactions not all exercised.

| Route | Template | Data | Status |
|---|---|---|---|
| / | index.html, home.jsx | products, banners (slot home), config | Verified: hero, launches, deals, four finders, help-me-choose, brands, offers, FAQ |
| /televisions | category.html, category.jsx | products | Verified: filters, sort, chips, compare tick and bar, discovery tabs with Budget |
| /televisions/<brand-model> | product.html, product.jsx | product, banners (slot product:id) | Verified: gallery, zoom, price, EMI, pincode check, add to cart, A+ blocks, specs, compare |
| /products, ?brand=, ?q=, ?wish=1 | category.html | products | Verified: brand list, search results; wishlist rendered |
| /offers | offers.html, pages1.jsx Offers | products | Verified |
| /cart | cart.html, pages1.jsx Cart | localStorage cart, products | Verified: lines, totals, checkout link |
| /checkout | checkout.html, pages1.jsx Checkout | me, cart | Verified locally with an order; live only on one instance |
| /order?id= | order.html, pages1.jsx Order | order (owner only) | Verified locally |
| /account | account.html, account.jsx | me, orders | Sign-in code step verified live; full account verified locally; flaky across Vercel instances |
| /compare?ids= | compare.html, category.jsx ComparePage | products | Rendered |
| /campaigns/<slug> | campaign.html, campaign.jsx | campaigns | Not verified (no live campaign seeded) |
| /about, /contact, /shipping, /returns, /terms, /privacy, /buying-guide | page.html, info.jsx | FAQ, policy, contact constants | Verified: all 200 and drawn; contact form posts to the admin outbox (verified locally earlier) |
| /admin | admin.html, admin.jsx (own chunk) | all, admin session | Rendered ("Admins only" gate); editing verified in earlier sessions, not today |
| /sitemap.xml, /robots.txt | server.js | products, pages | Verified: 23 URLs |
| /api/* | server.js | JSON files in data/ (or /tmp on Vercel) | API suite passes |
| 404 | 404.html | | Verified |

## 3. Competitor evidence, observed 22 October

| Source | What was observed | Why it matters | Apply to Mytekkstore |
|---|---|---|---|
| Croma TV listing, https://www.croma.com/televisions-accessories/televisions/c/997 | A location modal asks for a pincode first. Filters as dropdown chips (Categories, Brand, Price, Screen Size in inches), sort by relevancy, 460 items. Each card: image with a size callout, heart and a Compare checkbox top right, two-line name, rating with count, price large, MRP struck, "(Save ₹3,510)", "27% Off" chip, "Standard Delivery by Tomorrow", then two offer chips. | Price, saving, delivery date and compare are the first things a shopper reads; offers are chips, not banners. | Keep our card's price, saving and EMI. Replace "Free delivery · get it by" on every card with one trust line on the page, as the audit suggested; keep compare and heart. Offer chips only once bank offers are real (Q5). |
| Croma product page, https://www.croma.com/croma-80-cm-32-inch-1-star-hd-ready-led-tv-with-bezel-less-display-2026-model-/p/323781 | Vertical thumbnails with a video thumb, Compare, "Connect to Store", "Shop with Video". Right column: name, three offer chips, rating and review count, price, "(incl. all Taxes)", EMI per month link, MRP and saving, exchange choice, screen size selector, "Super Savings (6 offers)" carousel, a bundle (TV + soundbar), delivery box for the pincode, "Key Features" bullets (resolution, energy rating, refresh rate, 2 x HDMI / 2 x USB, speaker, panel grade, warranty), then a 25-section specification sheet, "Keep it safe" (protection plan). Sticky bottom bar with name, price, Buy Now, Add to Cart. | The purchase panel is the whole first screen; key features are seven precise bullets; the full sheet is long and grouped. | Our product page already has the same skeleton (gallery, offers, EMI, size chips, key specs strip, delivery pill, sticky bar on phones). What is missing is data: ports count, energy rating, warranty period, in-the-box, dimensions (Q6). Add "In the box" and "Dimensions" groups once supplied. |
| Reliance Digital TV listing, https://www.reliancedigital.in/collection/televisions | Left filter rail: Available (in stock), Screen Size bands (33 to 44, 45 to 50, 51 to 55, 56 to 65, 66 and above), Price slider, Discount, Brand with search. Cards: "NEWLY_LAUNCHED" tag, two-line name, price with "% OFF" in green, MRP, a "Best Price with offers" strip, Compare link and an outlined Add to Cart. 28 pages of pagination. | Size bands rather than exact inches; the "best price with offers" strip is the only coloured element. | Our filters already cover brand, OS, resolution, price, discount, stock, EMI, rating. Size filtering is exact inch, which fits a nine-model catalogue. No pagination needed yet. |
| Vijay Sales TV listing, https://www.vijaysales.com/c/televisions | Festive hero banner over the listing. Filters: Category by resolution, Brand, Price slider, Technology (LED, OLED, QLED, QNED), Operating System (Google TV / Android TV, webOS, Linux, Coolita), Resolution. List layout: large image, name, rating, four spec bullets (resolution, Dolby Audio, OS, warranty years), price, "% Off", MRP, "Extra Deals Available", EMI from ₹/month, bank discount, exchange, "Free delivery by Tomorrow", heart and cart icons. "300+ Bought" tag. | Four spec bullets on the card answer the four questions buyers ask; warranty years on the card. | Add the warranty period to cards and the compare table once known (Q2, Q6). Our Technology and OS filters match this pattern. |
| Elista official, https://www.elistaworld.com/ and https://www.elistaworld.com/googletv | Festive EMI banner (fixed EMI at ₹2,020 with Bajaj Finserv, offer valid 15 September to 15 November 2026), "Elista in News" logos, category tiles (TV, Air Conditioner, more), footer with Service Centres, Service Policies, Warranty Registration. TV families: Google TV, QLED, Mini LED, 4K Ultra HD Smart TV, Smart Android TV FHD and HD. The Google TV page shows a range tile, no model numbers on that page. Feature marks shown: 4K UHD HDR, bezel-less, Dolby Audio, Chromecast built in, HDR10, Netflix, YouTube, Prime Video, Hey Google. | The brand sells on EMI and on named platform features; warranty registration and service centres are first-class links. | Model names, images and specifications must come from Elista's own pages or sheets (Q6, Q7). Link "Warranty registration" and "Service centres" on our product and returns pages once the brand confirms the URLs. Mini LED and QLED families are not in our catalogue; the finder's screen-type tab will show them when they are. |
| Telefunken | No official India website was found (Bing, 22 October). telefunken.com/en/tv-sets is the global licensing site; Telefunken entered India in 2019 (electronicsforu.com, 27 January 2020). | Brand assets and spec sheets must come through the Indian licensee or distributor. | Ask the client who supplies Telefunken in India and request logo, photos and sheets from them (Q7). |
| Earlier research, 12 and 15 October (Samsung, Sony, LG, Apple, Flipkart, Amazon, Best Buy) | Compare tick with sticky bar, size pills on cards, EMI per month on cards, stat band on product pages, calm split hero with two CTAs, OS comparison table. | Already built into the site. | Keep. |

Not copied: any competitor's layout, colours, logos or copy. Only the shopping patterns above.

## 4. Inventories

### 4.1 Product-card components and where they appear

| Component | File | Appears on | Shows |
|---|---|---|---|
| Card | web/src/components.jsx | Home deals, Televisions grid, brand and search lists, wishlist, offers, cart "You may also like", order page, account rows, 404 | Image with discount badge and Quick view, heart, brand · OS, name, stars (when reviews), size pills (category only), price, MRP, "Save", EMI per month, "Free delivery · get it by", Add to cart or stepper, Compare tick (category only) |
| Line | components.jsx | Cart page, cart drawer, checkout summary | Thumb, name, stepper, line total, Remove |
| OrderItems | components.jsx | Order page | Thumb, name, qty, line total |
| QuickView | components.jsx | Any Card's Quick view | Big photo, brand · OS, name, stars, price, EMI, first five specs, Buy, Buy now, heart, link |
| CompareAll and Compare | category.jsx, product.jsx | Televisions page, /compare, product page | Photo, name, price, rating, OS, every spec row, EMI, Buy |
| Discover card (dcard) | category.jsx, home.jsx | Televisions tabs; home finders | Photo, label, note, from price |
| nprod / ntile | components.jsx | Header mega menu | Thumb, brand, name, price; tile image and label |

### 4.2 Product-detail components

Breadcrumbs, optional admin banner (Banner), sub-nav (desktop), gallery with zoom, full-screen dialog, thumbnails and 360 (Spin, when frames exist), brand and OS tags, title, rating line, price with MRP and badge, EMI line and plans, offers box, stock line and bar, size chips, key-specs strip, delivery pill, pincode form, bundle box (other categories, hidden while TVs only), actions row, perks, warranty box, share row, A+ section (hero with stats, showcase, blocks), tabs (description, specifications grouped, delivery, reviews with form), compare table, warranty Q&A, questions and answers, related rows.

### 4.3 Shared UI

Header (search with suggestions, pincode chip, country switcher, account, wishlist, cart, mega menus), Footer, Chrome (drawer, toast, progress bar, back to top, mobile bottom nav, chat widget), Form, Icon and Ico, Strip and Row, Box, BankOffers, OsChart, Qa, Photo and KvImg.

### 4.4 Data sources and integrations

| Source | Where | Notes |
|---|---|---|
| Products | data/products.json, seeded from public/seed-data.js | 9 TVs, 7 spec rows each, no model numbers, no images[], no warranty row, 2 with reviews |
| Banners, campaigns | seed-content.js, data/banners.json when the admin saves | 2 home banners, 1 product banner |
| Users, sessions, codes, orders, outbox | data/*.json and in-memory Maps | Per instance on Vercel (/tmp) |
| Pincode | api.postalpincode.in | Free; any valid pincode is accepted |
| SMS, email, Google, Clarity, chat assistant, creative agent | env keys | None configured on the live deployment |
| Analytics | window.dataLayer events | No tag container connected |

### 4.5 Image and video assets (public/img)

| Group | Files | Used by | Note |
|---|---|---|---|
| Hero photos | hero-a, hero-b, hero0, hero1, hero2 (jpg + webp at 480 and 960) | Home hero slides, A+ hero, OS card | hero-a has a 352 KB loop clip |
| Lifestyle | life-01 to life-15 (jpg + webp sizes) | Launch cards, size cards, OS cards, resolution cards, A+ blocks, category opener (slot map in web/src/lifestyle.json) | Generated earlier with tools/tv-images; plain room scenes, no specific model |
| Brand showcases | show-elista, show-telefunken (+ mp4) | Featured brands | Generated |
| Category openers | kv-tv, kv-wash, kv-ac | Category and info-page openers | kv-wash and kv-ac only on hidden categories' info pages |
| Renders | p0 to p34 and -v variants, with -cut.webp cut-outs | Product photos | 9 live TVs use p0, p1, p2, p3, p34 and variants; renders are not the real models |
| Gallery crops | img/g/*-studio, -screen, -stand (30 files) | Product gallery slots 3, 4, 6 | Generated from the renders |
| Clips | hero-a.mp4, hero0.mp4, show-elista.mp4, show-telefunken.mp4, v-tv, v-wash, v-ac | Only hero-a.mp4 plays now (home hero); the rest are no longer referenced after today's motion pass | Candidates for removal |

Missing: per-model product photo sets, brand logo files, a portrait hero crop for phones, any real product video.

### 4.6 Tests

test.js (API: products, orders, stock, accounts, admin, request safety), test-vercel.js (entry), test-ui.js (headless browser: menus, cart, keyboard, phone taps). All pass at commit 557c358. No visual-regression suite; Lighthouse run by hand.

### 4.7 Known errors and dependencies

Vercel per-instance state (sessions, users, codes, orders); OTP shown on screen (OTP_DEMO); the 13 business facts; prerender not verifiable from this machine; Telefunken source unknown.

## 5. Design system (proposed, measurable)

Mostly what the site already uses, made explicit; the two real changes are marked.

| Token | Value |
|---|---|
| Background | #f5f4f0 paper; cards #ffffff; tiles #f1efe9; lines #e6e3dc |
| Text | #0f1115 ink; #3a3f47 body; #6f7680 muted |
| Accent | #06735a for text and buttons (passes 4.5:1 on paper); logo keeps #08805f; dark panels #0b0e14 |
| States | success green as accent; low stock amber #b45309; out of stock #c62828 |
| Type | Inter body 15 px / 1.5 (15.5 on phones); Manrope 800 for headings; Space Grotesk 700 for the hero and section headlines only (change: limit it to those two places so the page carries two voices, not three) |
| Type scale | 12, 13, 14, 15, 17, 22, 28, 34 and clamp(32, 9vw, 46) hero |
| Spacing | 4-base: 4, 8, 12, 16, 20, 24, 28, 36, 48, 56 (section gap 48 desktop, 56 phones) |
| Widths | content 1200 px; hero and brand showcases full-bleed on desktop; reading copy 68 ch |
| Grid | product grid 3 columns at 1200, 2 at 760, 2 on phones; discovery cards 5, 4, 2, 1 |
| Image ratios | product 1:1 at 800; card photo 4:3; tall card 3:4; hero 16:9 at 1376 × 768 desktop, 4:5 at 1080 × 1350 phones (change: add the portrait crop) |
| Radius | cards 18 to 22 px; pills 999; buttons 999 ink style |
| Shadows | one soft shadow for raised cards only; none on text or badges |
| Buttons | primary ink #0f1115 on white, 10 × 24 px, 600; ghost outlined; accent only for links, prices and states |
| Badges | discount pill on the image, one per card; low-stock chip; nothing pulsing |
| Header | sticky, white, search, pincode, country, account, wishlist, cart; mega menus; phone bottom bar |
| Breakpoints | 520, 760, 860, 900, 1000, 1240 (existing) |
| Motion | arrival only (fade and 18 px rise, headline words rise), hover lift 2 to 4 px, springs for drawer and toast, reduced-motion honoured, no infinite loops (rule at the end of style.css), one looping clip (home hero) |
| Accessibility | WCAG 2.2 AA: 4.5:1 text, focus visible, skip link, named buttons, in-text links underlined, Escape closes overlays, 44 px tap targets on phones |

## 6. Page plans

### 6.1 Home (desktop)

| Order | Section | Keep, improve, move, remove | Why |
|---|---|---|---|
| 1 | Split hero, photo and clip, two CTAs | Keep | Verified premium pattern; now paints before the script |
| 2 | Latest Launches (5 photo cards) | Keep | Lifestyle imagery the owner wants |
| 3 | Deals of the Day (5 cards) | Keep | Products within two screens |
| 4 | Every room (size photo cards) | Keep | Restored today at the owner's request |
| 5 | Shop by budget | Keep | |
| 6 | Entertainment, your way (OS) | Keep | |
| 7 | See every detail (screen type and resolution) | Keep | |
| 8 | Help me choose (four questions) | Keep | Built today |
| 9 | Featured brands (two showcases) | Improve: real brand logo and real room shots once supplied (Q7) | |
| 10 | Bank offers | Keep only with real terms, else remove (Q5) | |
| 11 | Why Mytekkstore | Keep | |
| 12 | Product care | Remove or merge into Why (duplicate promise) | Three sections say the same four promises |
| 13 | Customer reviews | Keep only with real reviews (Q8) | |
| 14 | FAQ (6) | Keep | |
| 15 | Recently viewed | Keep | |

Acceptance: first paint under 2 s on the lab run, layout shift 0, every section links to a real list, no sample content on launch.

### 6.2 Televisions listing

Keep the opener, the discovery tabs (size, budget, OS, screen type), the filter rail with counts, chips, sort, compare bar, the grid of Cards with size pills. Improve: card density (see 7), add warranty years to cards and compare once known. Phones: filter drawer and bottom bar as now.

### 6.3 Brand listing (/products?brand=)

Today a filtered list with the brand name as title. Improve into a brand landing: brand showcase strip at the top (logo, one line, room photo), then the same grid. Needs Q7.

### 6.4 Offers

Keep; the countdown appears only with a real end date (Q13); bank offers only when real (Q5).

### 6.5 Search results

Keep the suggestions and the results list; add "Searched for" chip and a zero-result finder link (Help me choose). Model-number search needs Q6.

### 6.6 Product detail

Above the fold: breadcrumbs, gallery, title with brand and OS tags, rating, price and saving, EMI, key specs strip, delivery pill and pincode, actions, perks. Below: A+ (hero with four stats, showcase, blocks), tabs (description, specifications grouped, delivery, reviews), compare, warranty Q&A, questions, related. Improve: add "In the box", "Dimensions", "Ports" and "Warranty" groups when the sheets arrive (Q6); descriptions from the brand; per-model galleries (Q7). Remove nothing.

### 6.7 Cart, checkout, order, account

Keep the flows. Improve checkout with the gateway (Q4) and guest checkout (owner decision). Account: shared store before real use.

### 6.8 Phones

Purpose-built already: bottom bar, filter drawer, sticky buy bar, hero stacked (fixed today), finders as horizontal strips. Verified no overflow at 360 to 1920.

### 6.9 Footer and supporting pages

Add company name, address, GST, support hours, social links, payment marks (Q9). Policy pages keep their structure; wording from Q1 to Q3.

## 7. Product-card specification

Current card fields are listed in 4.1. Proposed minimum for a clean card, in order:

1. Image, 1:1, white tile, one discount pill top left, heart top right, Compare tick (category only).
2. Brand · OS, small caps.
3. Model name, two lines, clamped with an ellipsis (change: today long names can push the price down; clamp at two lines).
4. Size pills (category only, as now).
5. Price, MRP struck, "Save ₹".
6. One line: "No Cost EMI · ₹/month" when the TV carries it.
7. Primary action: Add to cart, becoming the stepper.

Move off the card: "Free delivery · get it by date" (goes to one trust line above the grid), Quick view (keep the button on hover only on desktop, which it already is).

Representative states, checked against the catalogue and the code:

| Case | Behaviour | Status |
|---|---|---|
| Long name (45 to 50 characters) | Wraps to two lines, price stays aligned | Rendered; no clamp yet (P2) |
| Missing image | No fallback: a broken image would show | Not reproducible with the current catalogue (every TV has an image); code has no placeholder (P2) |
| No reviews | Stars hidden | Verified in code and on cards |
| Discount 0 | Badge and "Save" hidden | Verified in code |
| Out of stock | Button disabled "Out of stock" | Verified in code; no out-of-stock TV in the catalogue today |
| Low stock (1 to 5) | Stock bar on the product page | Verified in code |
| EMI absent | EMI line hidden | Verified in code (all nine carry EMI today) |
| Variants | Size pills link to the sibling model | Verified live |
| Loading | Skeleton (static shell on the home page) | Verified |
| Empty list | "No products found" with Clear filters | Verified in code |
| Error | "Something went wrong" box | Verified in code |

Quick add, compare and wishlist: justified (all three exist and work; compare mirrors Croma and Reliance Digital). Nothing else added.

## 8. Lifestyle image and asset plan

| Asset | Purpose | Ratio and size | Source | Phone crop | Status |
|---|---|---|---|---|---|
| Home hero (desktop) | First impression | 16:9, 1376 × 768 | hero-a.jpg + hero-a.mp4 (existing) | Separate 4:5 file, 1080 × 1350 | Desktop exists; portrait crop missing |
| Home hero (phone) | Same | 4:5 | Generate from the same scene | | Missing |
| Launch cards (5) | Editorial grid | 16:9 at 960 | life-02, 03, 04, 11, 05 (existing) | Same files | Exists |
| Size cards (5) | Rooms by size | 4:3 at 800 | life-01, 10, 08, 15, 13 | Same | Exists; 75-inch card says "Coming soon" because no 75-inch TV exists |
| OS cards (2) | Google TV, WebOS rooms | 16:9 | life-07, 08 | Same | Exists |
| Screen-type cards (4) | LED, 4K, Full HD, HD Ready | 3:4 | life-09, 14, 04, 06 | Same | Exists |
| Brand showcases (2) | Elista bright room, Telefunken cinema room | 16:9 | show-elista, show-telefunken | Same | Exists, generated; replace with brand-approved scenes if offered (Q7) |
| Product photos (9 × 6) | Gallery | 1:1 at 1200 | Brand photo sets | Same | Missing (Q7); renders in place |
| Brand logos (2) | Header menu, brand pages, cards | SVG | Brand | | Missing (Q7) |
| Buying-guide illustrations | Size and distance | 16:9 | Can be drawn (SVG) | | Not started, P3 |
| Feature images | Only where a genuine feature is documented | | Brand | | Blocked on Q6 |

Rules: WebP with 480 and 960 variants (web/images.js), width and height on every image, lazy below the fold, the hero preloaded. Generation: the existing tools/tv-images pipeline (Gemini) with prompts.json; its daily limit stopped the last run. Nothing is replaced in production until the new files are reviewed.

## 9. Technical plan, file level

| Area | Change | Files |
|---|---|---|
| Reuse | Card, Discover, Finder, Qa, BankOffers, Banner, Form | no change |
| Refactor | Card: two-line clamp, image placeholder, trust line moved out | components.jsx, style.css |
| Refactor | Product page: new spec groups (ports, in the box, dimensions, warranty) once data exists | data.js SPEC_GROUPS, product.jsx |
| New | Brand landing strip | category.jsx (small), data.js BRAND_SHOW |
| Data | Model number, warranty, ports, energy, HDR per TV; images[] per TV | public/seed-data.js, data/products.json via admin |
| Assets | Portrait hero; remove unused clips | public/img, shells.js preload |
| Integrations | Payment gateway (server route + signature check), Brevo or Twilio, GTM, Clarity | server.js, checkout.jsx, env |
| Store | Shared storage for users, sessions, codes, orders on Vercel (KV or a database) | server.js storage layer |
| Tests | Add card-state cases and a checkout regression to test-ui.js; Lighthouse script in tools/ | test-ui.js, tools/ |
| Performance | Optional: client-side router or server rendering for instant page changes (needs approval, larger) | main.jsx, App.jsx, server.js |
| Accessibility | Product page 97: two remaining contrast spots in the A+ captions | style.css |

No architecture change is proposed. The multi-page React app, the Node server and the JSON data stay; only the storage layer must become shared for production.

## 10. Prioritised backlog

| # | Priority | Task | Evidence | Impact | Change | Components | Complexity | Depends on | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| 1 | P0 | Shared store for sessions, users, codes, orders | Live sign-in lost across instances (22 Oct) | Orders and accounts reliable | KV or database behind the storage functions | server.js | M | Client choice of store | Sign in, order, revisit on a fresh instance: all persist |
| 2 | P0 | Codes by SMS or email, OTP_DEMO off | Codes on screen | Security | Keys | server.js env | S | Q10 | No code visible on the page |
| 3 | P0 | Real warranty, returns, delivery text | Drafts live | Liability | Replace constants | data.js, info.jsx | S | Q1 to Q3 | Client sign-off |
| 4 | P1 | Payment gateway | Demo only | Prepaid orders | Server-side order and verification | server.js, pages1.jsx | M | Q4 | Test payment succeeds and fails correctly |
| 5 | P1 | Real product photos and sheets | Shared renders | Trust, conversion | images[] and specs per TV | admin, products.json | M | Q6, Q7 | Each TV shows its own set and sheet |
| 6 | P1 | Remove sample offers and reviews or replace | Samples live | Honesty | Constants | data.js, seed | S | Q5, Q8 | No sample text on launch |
| 7 | P1 | Contact and company details | Empty | Trust | Constants | data.js | S | Q9 | Contact page shows call, WhatsApp, email |
| 8 | P2 | Card density: two-line clamp, placeholder image, trust line out | Section 7 | Cleaner grid | CSS and Card | components.jsx, style.css | S | none | Cards align at every width |
| 9 | P2 | Brand landing strip | Brand lists are bare | Discovery | Small component | category.jsx | S | Q7 for logos | /products?brand= shows the strip |
| 10 | P2 | Portrait hero for phones | Landscape crop on phones | First impression | Asset + source element | shells.js, home.jsx | S | Image generation | Phone hero shows the TV |
| 11 | P2 | Analytics connected | Nothing measured | Baseline | GTM id | server.js | S | Q11 | Events arrive in GA4 |
| 12 | P2 | Guest checkout | Sign-in required | Fewer drop-offs | Route and page | server.js, pages1.jsx | S | Owner decision | Order without an account |
| 13 | P2 | Instant page changes (router or SSR) | Navigation 1 s on phones | Speed | Larger | main.jsx, App.jsx | L | Approval | Click to drawn under 300 ms warm |
| 14 | P3 | Remove unused clips; buying-guide illustrations; Space Grotesk limited to two places | Assets and type | Polish | Assets, CSS | public/img, style.css | S | none | Build size down; two type voices |
| 15 | P3 | Search by model number | No model numbers | Discovery | Data | products.json | S | Q6 | "32" and model code both find the TV |

## 11. Testing and acceptance plan

- Automated: node test.js, node test-vercel.js, node test-ui.js on every change (all pass at 557c358).
- Browser matrix: Chrome desktop 1536, phone 390 and 412 (headless with touch), widths 360, 768, 1024, 1440, 1920 for overflow.
- Flows: browse, filter, compare, product, add to cart, sign in, checkout, order, account, contact form, admin edit.
- Card states in section 7 on every card surface.
- Lighthouse mobile on home, listing and product; targets: performance 75 or more, layout shift under 0.1, accessibility 100, SEO 100.
- Each task reports passed, failed, blocked, not run or not applicable.

## 12. Risks, dependencies and open questions

- The 13 business facts (docs/AUDIT.md section 4) gate every P0 and P1 item except the shared store.
- Vercel: per-instance state; bundles must stay on the CDN (routing them through the function broke the site on 22 October); pages validated by build stamp now.
- Prerender on hover is deployed but unverified from this machine.
- Telefunken India source unknown.
- Image generation depends on the Gemini daily limit in tools/tv-images.
- Guest checkout and the router or SSR need the owner's decision.

## 13. Recommended sequence (Gate 4, on approval)

1. Store and keys (P0 1 to 3) as soon as the client answers.
2. Card density, brand strip, portrait hero, unused clips (P2 8, 9, 10, 14): no business input, about a day.
3. Analytics and guest checkout once decided (11, 12).
4. Gateway, photos, sheets, offers, reviews, contact as the facts arrive (4 to 7).
5. Router or SSR as a separate approved project (13).

Each step ends with the three suites, the browser matrix and a Lighthouse run, reported as passed, failed, blocked or not run.

## 14. Gate 4, batch 1, done 22 October (owner asked to start without waiting)

Implemented, built, tested (API, Vercel entry and headless browser suites) and verified locally; pushed as the commit named in docs/AUDIT.md when live:

- Cards: no delivery line on every card; one trust line above each list (Televisions, brand and search lists) and in the Deals lead; names clamp at two lines so prices align; a photo that fails to load shows a "Photo coming soon" tile (public/img/placeholder.svg).
- Brand pages (/products?brand=): open with the brand's strip (room photo, name, model count, what the brand stands for, reasons read from its models); the category tiles stay on the all-products page only. Logo files wait for Q7.
- Phone hero: a portrait 4:5 crop of the existing hero photo (hero-a-m) is served to phones, in the HTML shell and the app, with its own preload; the TV is now centred on a phone's first screen.
- Unused clips removed (hero0, v-tv, v-wash, v-ac); the home hero loop and the two brand showcases remain.
- Last contrast spot on the product page (the price under a selected size chip) fixed.

Not started from the backlog: the shared store, keys, payment, photos and sheets, offers and reviews, contact (all need the 13 facts); guest checkout and the router or SSR (need the owner's decision); buying-guide illustrations.
