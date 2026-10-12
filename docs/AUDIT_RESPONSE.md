# Response to the audit of 10 October 2026

The audit (`Mytekkstore-Audit-Premium-Load-Plan.docx`) was written without access to the running site, so this is the item-by-item answer against the real code: what was done on 12 October 2026, and what is a decision for the client.

## Problems found: all six fixed

| # | Audit finding | Done |
|---|---|---|
| 1 | Duplicate titles and descriptions on category, policy and account pages | Every page now has its own server-written title and description: home, all products, each category, each brand list, each product, offers, the seven info pages, account, cart, checkout, order, admin. |
| 2 | Query-string addresses | Clean addresses everywhere: `/televisions`, `/televisions/telefunken-140-cm-55-inch-4k-ultra-hd-google-tv`, `/products?brand=Elista`, `/shipping`, `/offers`, `/cart`. Every link the site builds uses them. The old addresses still work and name the clean one as canonical, so nothing already shared breaks. |
| 3 | Generic product description | The search description of each product is built from its own specifications and price. The catalogue text shown on the page is the client's to write. |
| 4 | Thin sitemap, no lastmod | The sitemap lists only clean addresses, each with a last-modified date: the product's last edit, the newest product in a list, or the build date for pages. Brand lists were added. |
| 5 | `/api/` blocked for Google's renderer | `robots.txt` now allows the three read-only calls a page makes at start (`/api/products`, `/api/config`, `/api/me`) and keeps the rest of the API and the private pages out. |
| 6 | Private pages indexable | Account, cart, checkout, order and admin carry `noindex, nofollow`. Wishlist and search result lists carry `noindex`. |

## Likely problems: checked against the code

| Audit guess | Reality |
|---|---|
| No Product structured data | It was there before the audit. It now carries the clean URL, an image array and the item condition. BreadcrumbList, ItemList, WebSite with SearchAction and Organization are also written. |
| Large, unoptimised images | Fixed. Every photo now has WebP copies at full, 960 and 480 px (`npm run images`), served with `srcset` and `sizes`, with width and height so nothing shifts. Full-size photos went from 2.2 MB of JPEG to 1.1 MB of WebP, and phones receive the 480 px copies. |
| Blank page until JavaScript runs | True for the body: the pages are React. The head, titles, descriptions and structured data are server-written, and Google's renderer can now fetch the product data. A full server-rendered rewrite is the Next.js decision below. |
| vercel.app address, Hobby plan | Decisions for the client: a custom domain, and Vercel's Pro plan before a commercial launch. |

## Load plan: what the code now does

- Writes to the API (orders, sign-ins, codes, reviews, messages) are limited to 120 per address per 10 minutes, on top of the existing sign-in and code limits. Input is validated, and prices and stock are always checked on the server.
- Bundles of the last three builds are kept, so a page that is open while a new build deploys still finds its scripts and the lazily loaded Motion features.
- The font stylesheet no longer blocks the first paint, and the first hero photo is preloaded at the right size for the screen.
- Room clips play only on screens 900 px and wider. Phones get the still photo, so nothing competes with the main image.

Not in the code, because each needs a paid service or a business decision: a database (the store keeps JSON files, which Vercel resets on each cold start), a payment gateway with webhook idempotency, an email queue, error monitoring and uptime alerts, and a load test against a staging copy.

## React Bits components: not installed, on purpose

The site already runs Motion (motion.dev), which covers every effect in the audit's list: headline reveal, count-up, tilt and spotlight on cards, bento, aurora, scroll reveal, marquee. Installing React Bits as well would add a second animation library for the same result. The two behaviours the site did not have were added with Motion instead: main buttons lean toward the pointer on desktop (Magnet), and cart lines slide in and out (AnimatedList). A multi-step checkout (Stepper) was left out: the checkout is five fields on one screen, and splitting it into four steps adds clicks without adding information.

## Measured: Lighthouse, mobile, live site, 12 October 2026

| Page | Before (performance, LCP, blocking time) | After |
|---|---|---|
| Home | not comparable: the "before" run hit a stale copy of the page with a missing stylesheet, which scores well for the wrong reason | 52 to 56, 4.3 to 4.9 s, 720 to 1,380 ms |
| Category (Televisions) | 49, 7.0 s, 950 ms | 60, 3.9 s, 960 ms |
| Product (55 inch Google TV) | 53, 5.9 s, 790 ms | 56, 4.4 s, 830 ms |

Page weight on the home page fell from 1,254 KB to 722 KB. Accessibility went to 100 on home and category (94 on product), best practices 100, SEO 100. Largest Contentful Paint improved on category and product with the WebP photos and the preloaded hero.

What remains is main-thread work: on a phone throttled four times, laying out these long pages costs 2.5 to 3 seconds and running the React app about 1 second. A `content-visibility` rule for sections below the first screen was measured locally: it cut layout work by about a quarter but left the score inside the run-to-run noise and made deep links such as `/televisions#guide` land off target, so it was not kept. The levers that would move these scores are structural: render the sections below the first screen only when they come near (a change to how the app draws pages), or the server-rendered Next.js move the audit recommends. Both are decisions, not quick fixes.

## Still the client's

Real product photos and lifestyle shots, the logo and brand colour, the store list and contact details, the policy figures (`POLICY` in `web/src/data.js`), a custom domain, Vercel Pro, a payment gateway account, and an email provider key.
