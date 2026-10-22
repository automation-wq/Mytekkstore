# Mytekkstore Online Store — Technical Requirements (TRD)

Status: draft for approval. The main decision is in section 2.

## 1. What exists today

A working store in this folder. Start it with [start.bat](../start.bat) (or `node server.js`) and open http://localhost:3000.

| Part | File | What it does |
|---|---|---|
| Server | [server.js](../server.js) | Serves the site and the API. Plain Node.js, no packages to install |
| Storefront source | [web/src/](../web/src/) | React 19 with Vite: `store.jsx` (catalogue, customer, cart, wishlist), `components.jsx` (header with the category menus, cards, forms, drawer), one file per page (`home.jsx` is the home page), `motion.js` (reveals, clips, tilt), `style.css`. `npm run build` in web/ writes the pages into public/ |
| Storefront build | [public/](../public/) | One HTML shell per address (index, category, product, offers, cart, checkout, order, account, page, admin, 404), one JavaScript bundle and one stylesheet in public/assets, images and the sample catalogue |
| Admin | [web/src/admin.jsx](../web/src/admin.jsx) | Orders and products management at /admin.html |
| Data | data/ folder (created on first start) | products.json, orders.json, users.json, outbox.json, ADMIN_LOGIN.txt |
| Starting catalogue | [public/seed-data.js](../public/seed-data.js) | Sample products, loaded into data/products.json on first start |
| Self-check | [test.js](../test.js) | Run `node test.js` to test orders, accounts, admin and request safety |
| Browser check | [test-ui.js](../test-ui.js) | Run `node test-ui.js`: drives a real headless browser (Edge or Chrome) through the category menus, cart, keyboard and phone taps |

What is real today:

- Products, stock and prices are stored on the server. The admin can add, edit and delete products.
- Orders are stored on the server. The server works out the total from its own prices and reduces stock. Cancelling an order returns the stock.
- Customers create an account and sign in to order, and see their own orders. An order page is private to its customer; the admin can open any order.
- Sign-in by mobile number with a one-time code, sign-in with Google, and SMS order confirmations work through Twilio and Google once their keys are set (section 11). Without the keys, phone sign-in still works on localhost for testing and every message is recorded in the outbox.
- A festive offers page, bank offers and a No Cost EMI tag per product (sample offers until the client supplies the real terms).
- Ratings and reviews, wishlist and recently viewed, a country selector with sample exchange rates, explore-by-size category pages, category menus, and the TV size guide.
- Passwords are stored hashed (scrypt). Sign-in uses an HttpOnly cookie. Admin pages and admin API calls are checked on the server.
- Payment is cash on delivery; online payment is a demo (see below).

What is demo only:

- **Online payment.** The checkout shows UPI, card and net banking, but it is a demo window that takes no money. To make it real, connect a gateway (for example Razorpay) in the order route of server.js and verify the gateway's payment signature before saving the order.
- **Customer messages without Twilio.** Until the Twilio variables are set, order confirmations, status updates and sign-in codes are only recorded in the outbox (shown in the admin, with a Sent column). With them set, they go out by SMS or WhatsApp as well.
- **Sample reviews.** Some products carry sample reviews from the seed file. Remove them before launch.
- **Data** is kept in JSON files on one server. Move to a database as orders grow.

## 2. Decision: how to build the real store

A real store needs a product database, an admin panel, secure sign-in, payments, order emails, tax and stock handling. There are two ways to get them.

| | Option A — Shopify with a custom theme (recommended) | Option B — fully custom build |
|---|---|---|
| What it is | Shopify provides admin, database, checkout and payments. We build the Mytekkstore design as a theme | We build everything: website, server, database, admin |
| Time to launch | About 3 to 5 weeks | About 3 to 4 months |
| Admin panel | Ready made, staff can use it on day one | Must be built |
| Payments | Built in, works with Indian gateways | Must be integrated and secured by us |
| Multi country and currency | Built in (Shopify Markets) | Must be built |
| Running cost | Monthly Shopify fee plus payment fees | Hosting plus developer maintenance |
| Design freedom | High. Checkout page layout is limited | Total |
| Risk | Low | Higher: security and payments are our responsibility |

**Recommendation: Option A.** Mytekkstore is one seller with a normal retail catalogue. Nothing in the requirements needs custom software, and the Croma look can be built as a theme. Choose Option B only if the client refuses a monthly platform fee or needs something Shopify cannot do, such as a deep link to an existing billing system.

## 3. Architecture for Option A

- **Storefront:** custom Shopify theme (Liquid, CSS, small amounts of JavaScript) matching the design document.
- **Catalogue:** Shopify products. Brand is the product vendor. Category is a collection. Specifications are stored as metafields.
- **Navigation:** collections for each category and each brand, linked from the header menu.
- **Search and filters:** Shopify Search and Discovery (brand, price, category filters).
- **Checkout and payments:** Shopify checkout with a payment gateway such as Razorpay, plus cash on delivery if required.
- **Countries:** Shopify Markets for currency and country selection.
- **Accounts and orders:** Shopify customer accounts, order emails and order status page.
- **Hosting, SSL, backups:** handled by Shopify.

## 4. Architecture for Option B (only if chosen)

- Frontend: Next.js
- Backend and database: Node.js API with PostgreSQL
- Admin: custom panel for products, stock, banners and orders
- Payments: Razorpay
- Sign-in: email or phone with one-time password
- Images: cloud storage with a content delivery network
- Hosting: Vercel for the frontend, a managed server and database for the backend

## 5. Data model (same for both options)

| Item | Main fields |
|---|---|
| Product | name, brand, category, price, MRP, stock, images, key features, specifications, warranty, No Cost EMI flag |
| Category | name, image, parent category |
| Brand | name, logo |
| Banner | image, title, link, position, start and end date |
| Customer | name, email, phone (verified or not), Google account id, addresses |
| Order | customer, items, quantities, total, address, payment status, delivery status |

## 6. Non-functional requirements

- **Speed:** main content visible in under 3 seconds on mobile. Images compressed and lazy loaded; the product photo loads first. Scripts, styles and pages are gzipped; unchanged files answer 304. (Done)
- **Mobile first:** all pages usable at 360 px width.
- **Security:** HTTPS everywhere (hosting). Card details never touch our code; the payment gateway handles them. Every response carries a content security policy, X-Frame-Options, Referrer-Policy and Permissions-Policy; HSTS once behind HTTPS. (Done)
- **SEO:** unique title, description, canonical link and sharing (Open Graph) tags per page, written by the server so search engines and WhatsApp previews see them; schema.org Product and BreadcrumbList data on product pages; /sitemap.xml and /robots.txt. (Done)
- **Accessibility:** keyboard usable (skip link, menus open on Tab and close on Escape), readable contrast, alt text on images, live regions for toasts and the delivery check.
- **Analytics:** the site pushes view_item, add_to_cart and purchase events to window.dataLayer; add the client's Google Tag Manager or GA4 snippet to the HTML shells to collect them.

## 7. Images

- Launch images come from the client: product photos and brand logos.
- Until then, the prototype uses AI-generated images for banners, categories and sample products.
- Real brand logos (Elista and Telefunken) must be supplied or approved by the client. They are not generated.
- Formats: WebP, hero 1600x600, category tile 400x400, product 800x800.

## 8. Build steps

1. Approve these four documents.
2. Upgrade the prototype to the approved design with generated images.
3. Client reviews the prototype and supplies logo, colours and product list.
4. Set up the store platform and load the catalogue.
5. Build the theme from the prototype.
6. Connect payments, shipping, emails and analytics.
7. Test orders on desktop and phone.
8. Launch on the client's domain.

## 9. Fastest path to launch

The store in this folder already works, so the months-long custom build in Option B is not needed for a first launch. The remaining work is content and accounts, not software.

| Step | Who | Rough time once inputs arrive |
|---|---|---|
| Load the real products, prices, stock and photos through the admin | Client or us | 2 to 4 days |
| Apply the Mytekkstore logo and brand colours | Us | 1 day |
| Put the server on hosting with a domain and HTTPS (set HOST=0.0.0.0, and TRUST_PROXY=1 behind the HTTPS proxy so sign-in lockouts see the real visitor address) | Us, client pays hosting | 1 to 2 days |
| Connect a payment gateway for card and UPI | Us, client opens the account | 2 to 4 days after account approval |
| Connect SMS and Google sign-in: set the Twilio and Google variables (section 11) | Us, client opens the accounts | 1 day |
| Write policies: shipping, returns, terms, privacy | Client | Client dependent |
| Test orders on phone and desktop | Us | 1 day |

Rough total: one to two weeks after the client supplies content and accounts. These are estimates, not commitments.

Limits of this fast path: data is stored in files on one server, and there are no order emails yet. That suits a small store. Move to Shopify or a database-backed build when order volume grows.

Note: Mytekkstore is the store and the vendor. The brands it sells are Elista and Telefunken.

## 10. Web standards in the store

| Standard | Where | What it gives |
|---|---|---|
| Server-written SEO and sharing tags | server.js `seoTags` | Right title, description and preview image when a product link is shared on WhatsApp or found on Google |
| schema.org JSON-LD: Product and BreadcrumbList on product pages, BreadcrumbList and ItemList on category pages, WebSite with SearchAction and Organization on the home page | server.js `seoTags` | Price, stock and star rating can appear in Google results; a search box can appear under the site result |
| Font preconnect | server.js `seoTags` | The Inter font starts loading earlier |
| /sitemap.xml and /robots.txt | server.js | Search engines find every category, product and info page; the admin page is kept out |
| gzip and Last-Modified / 304 | server.js `serveStatic` | Smaller, faster page loads; repeat visits re-download nothing unchanged |
| Content Security Policy and other security headers | server.js `SECURITY` | Blocks injected scripts, clickjacking and leaking the visitor's address |
| Web app manifest and theme colour | `public/manifest.webmanifest`, HTML shells | Can be added to a phone's home screen; the browser bar takes the brand colour |
| Lazy photos, async decoding, high-priority main photo | `Photo` in web/src/components.jsx | Faster first paint, less data on phones |
| Skip link, ARIA roles, live regions, keyboard menus | HTML shells, web/src/components.jsx | Usable with a keyboard or a screen reader |
| Web Share and Clipboard | product page Share | Native share sheet on phones, copy link on desktop |
| dataLayer analytics events | web/src/api.js `track` | Plug in Google Tag Manager or GA4 without code changes |
| Styled 404 page | `public/404.html` | A wrong address shows the store, not a blank error |
| Google Identity Services | account.html through web/src/account.jsx; the content security policy allows Google's script and frame only when GOOGLE_CLIENT_ID is set | "Continue with Google" button; the server checks the token with Google before signing the customer in |
| Twilio REST API (plain HTTPS, no package) | server.js `sendSms` | SMS or WhatsApp messages for sign-in codes and order updates |

## 11. Phone OTP sign-in, Google sign-in and SMS (built)

Both are in server.js and switch on through environment variables. Nothing else changes.

| Variable | Used for |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio account (console.twilio.com) |
| `TWILIO_FROM` | The Twilio phone number messages come from, or `whatsapp:+1...` to send through WhatsApp |
| `SMS_COUNTRY_CODE` | Added to mobile numbers typed without a country code. Default `+91` |
| `GOOGLE_CLIENT_ID` | OAuth web client id from console.cloud.google.com (APIs and Services, Credentials). Add the store's address to its authorised JavaScript origins |
| `BREVO_API_KEY`, `MAIL_FROM` | Email through Brevo (free tier: 300 emails a day). Sign-in codes typed as an email address, and order messages when there is no SMS. MAIL_FROM must be a sender verified in Brevo |
| `OTP_DEMO` | `1` shows sign-in codes on the page even on a hosted store, for a client walkthrough. Remove it before real customers use the site |

Set them in the terminal before `node server.js`, or at the top of start.bat (lines are there, commented out).

**Code sign-in (routes `POST /api/otp/send` and `POST /api/otp/verify`, body `{ to }`).** The customer types a mobile number or an email address. The server makes a 6-digit code, keeps only a hash of it for 5 minutes, and sends it by SMS (Twilio) or email (Brevo). An email code signs into the account that has that email, password or not. Limits: 3 codes per number per 10 minutes, 5 wrong tries per code, and a code works once. A new number is asked for a name, then an account is created with the number marked verified. A number that one existing customer already used on orders signs into that account instead of making a second one. Without Twilio: on localhost the code is returned to the page and shown there (for testing); on a hosted store the route answers 503 "Phone sign-in is not set up yet", and the page tells the customer to use email.

**Google sign-in (route `POST /api/login/google`).** The sign-in page loads Google's button script only when a client id is set. Google hands the page an ID token; the server sends it to Google's tokeninfo endpoint and checks the audience, issuer and that the email is verified, then signs the customer in. An existing email account with the same address is linked to the Google account; otherwise a new account is created with no password.

**Order messages.** `notify` records every message in the outbox and, with Twilio set, sends it in the background (an order is never held up by the SMS provider). The outbox entry shows sent, recorded only, or the failure reason. Messages go out on order placed and on every status change made in the admin.

**India note.** Sending SMS to Indian numbers needs DLT registration of the sender and the message templates with the operator (Twilio guides this). WhatsApp through Twilio needs an approved sender and templates too.

**Alternatives.** Firebase Authentication (phone and Google in one SDK) or an Indian SMS provider such as MSG91 can replace Twilio by changing only `sendSms` in server.js and the two environment variables.

**Config route.** `GET /api/config` tells the pages which services are on (`{ google, sms, mail, demoCodes }`), so the Google button and the "message sent" note appear only when they will work.

**Getting the free keys (about 5 minutes each).** Google: console.cloud.google.com, new project, APIs and Services, OAuth consent screen (External, app name Mytekkstore), Credentials, Create credentials, OAuth client ID, Web application, add `http://localhost:3000` and the public address to Authorised JavaScript origins, copy the client ID. Brevo: brevo.com, free account, verify your sender email, SMTP and API, create an API key. Gemini (for AI banners): aistudio.google.com, Get API key.

**Delivery check.** `GET /api/pincode/{6 digits}` asks India Post's free pincode service (api.postalpincode.in, no key) for the district and state, caches each answer for a day, and answers 404 for an unknown pincode or 503 when the service is down. The pages still accept every pincode until the client gives delivery areas.

## 12. Storefront in React

The storefront was moved from plain scripts to React (October 2026) with no change to what visitors see. Why it is safe: every address stays the same because Vite builds one HTML shell per page; the server still writes the SEO tags into those shells; all ids and class names were kept, so the browser test suite passes unchanged. The old browser-only demo mode (opening a page by double-click with no server) was retired with the port: a module bundle cannot run from a double-clicked file, and start.bat is the way to open the site. State lives in one React context (`store.jsx`): products, customer, optional services, cart, wishlist and recently viewed, with the cart and wishlist mirrored to localStorage. Clicks that appear everywhere (add to cart, quantity, wishlist, strips, drawer) are handled once in `App.jsx`. The category menus, scroll reveals, room clips, card tilt and the fly-to-cart animation use the same proven DOM code as before, wrapped in effects. The home page (`home.jsx`, October 2026) adds pointer parallax on the hero, a count-up for the numbers band (IntersectionObserver plus requestAnimationFrame) and CSS scroll-driven animations (`animation-timeline: view()`) for the photo parallax in the bento and category banners; browsers without that feature simply show the photo still. Build output is committed, so start.bat needs no Node build step; developers run `npm run build` in web/ after a change.

## 13. Showing the store on a public address

`go-live.bat` (next to start.bat) opens a free Cloudflare quick tunnel to the running store and prints an https://…trycloudflare.com address. No account, no cost; the address lasts while the window is open and changes each time. It is for demos. For a permanent site, put the folder on a small Node host (Render's free web service or any VPS), set `HOST=0.0.0.0`, `TRUST_PROXY=1` and the keys from section 11, and point the domain at it. Set `OTP_DEMO=1` only for a walkthrough where sign-in codes should appear on screen.

## 14. Gap-closing pass (2026-10-05)

After comparing the store with Croma, Samsung and Flipkart (docs/GAP_ANALYSIS.md), these were added, all in the React storefront:

- Search suggestions (`Search` in components.jsx): client-side matching over the loaded catalogue, so there is no search route. The form still submits to `category.html?q=`, which the SearchAction structured data points at.
- Faceted filters (category.jsx): the filters are React state read from the address and written back with `history.replaceState`, so every filter combination is a shareable address and the existing menu links keep working. Parameters: `cat`, `q`, `wish`, `brand` (comma-separated), `size`, `min`, `max`, `off` (minimum discount %), `instock`, `emi`, `rating`, `sort` (`low`, `high`, `off`).
- `PATCH /api/me` (sign-in required), body `{ name, phone, address, pin }`: edits the profile. Validation is the same as for orders; a changed phone number loses its verified mark until a code is verified again. Checked in test.js.
- Delivery dates (`eta` in data.js) are worked out from the standard promise of 3 to 5 days; replace it with the courier's estimate when delivery areas are known.
- The "Deliver to" chip and the product page share the pincode through localStorage (`pin`, `pinplace`).
- Phone bottom bar (`MobileNav`), EMI plans table and the profile editor use native elements (details, checkbox) rather than extra script.

## 15. Keeping the store up (2026-10-05)

The client asked that the site must never fall over. What is in place, and where:

| Measure | Where |
|---|---|
| An unexpected error is logged and the process keeps serving (uncaughtException and unhandledRejection handlers, only when server.js is run directly so the tests still fail loudly) | server.js, bottom |
| `start.bat` runs the server in a watch loop (`start.bat serve` in the minimized window): any exit restarts it after 3 seconds, except exit code 2 (a damaged data file: waits for you) and exit code 0 (port already in use, so the store is already running: closes quietly). Verified on 2026-10-05 by killing the process from Task Manager's point of view (exit code -1) | start.bat |
| Data files are written to a temporary file and renamed into place, so a file is never half-written | server.js `write()` |
| A dated copy of every data file goes to `data/backups/<date>/` at start and once a day, kept 14 days. Restore by copying one back over `data/<name>.json` | server.js `backup()` |
| A damaged data file stops the store with a message naming the backup folder instead of silently replacing the data | server.js `read()` |
| A page that throws while drawing shows a message with a way home instead of a blank screen (React error boundary `Safe`) | web/src/App.jsx |
| The pincode lookup gives up after 6 seconds and the standard delivery promise still shows | server.js, web/src/product.jsx |

Known limits: one process with JSON files (move to a database when orders grow); sessions live in memory, so a restart signs everyone out; while the store runs on the client's PC it is up only while that PC is. `docs/LAUNCH_READINESS.md` is the client-facing summary of what is ready and what is still needed.
