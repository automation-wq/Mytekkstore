# Mytekkstore online store

A working online store for **Mytekkstore**, selling **Elista** and **Telefunken** televisions, washing machines and air conditioners.

## Run it

1. Install Node.js from https://nodejs.org if it is not installed.
2. Double-click `start.bat` (or run `node server.js`). The store opens at http://localhost:3000.
3. The admin sign-in is in `data/ADMIN_LOGIN.txt`. Sign in on the site, then open http://localhost:3000/admin.html.

Nothing to install to run it: the finished storefront is already built into `public/`, and the server is plain Node.js.

The minimized "Mytekkstore store" window watches the server and starts it again within 3 seconds if it ever stops. A dated copy of the data files is kept in `data/backups/` (one per day, 14 days); to restore one, copy it back over `data/<name>.json`.

### Changing the storefront (React)

The pages are React components in `web/src`. After editing them, build once and the server serves the result:

```
cd web
npm install        (first time only)
npm run build      (writes the pages and one bundle into ../public)
```

`npm run dev` inside `web` gives a live-reloading dev server on port 5173 that talks to the store on port 3000. The server, the data folder, the admin and the tests do not change. One thing the React build does not support is opening a page by double-clicking the HTML file; run start.bat instead.

### Optional: SMS and Google sign-in

Set these before starting the server (in the terminal, or at the top of `start.bat` where the lines are ready, commented out):

| Variable | What it switches on |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Order confirmation messages and sign-in codes by SMS through Twilio. `TWILIO_FROM` is your Twilio number, or `whatsapp:+1...` for WhatsApp |
| `SMS_COUNTRY_CODE` | Country code added to mobile numbers typed without one. Default `+91` |
| `GOOGLE_CLIENT_ID` | The "Continue with Google" button on the sign-in page |
| `BREVO_API_KEY`, `MAIL_FROM` | Sign-in codes by email and order emails through Brevo (free tier) |
| `OTP_DEMO` | `1` shows sign-in codes on the page for a client walkthrough. Remove before real customers use the site |

Without the Twilio or Brevo variables, messages are recorded in the admin outbox and, on localhost only, the sign-in code is shown on the page so the flow can be tried.

### Show it to the client on a public link

With the store running, double-click `go-live.bat`. It opens a free Cloudflare quick tunnel (no account) and prints an https address you can send to anyone. Close the window to go offline. Add `set OTP_DEMO=1` to start.bat first if the walkthrough should show sign-in codes on screen.

### Put it on Vercel (public link that stays up)

Live demo: **https://mytekkstore.vercel.app** (Vercel team blooprint-ai, free Hobby plan, deployed 2026-10-06; every push to `main` redeploys it).

The repo deploys as-is: `api/index.js` runs `server.js` as one Vercel function. `vercel.json` sends the pages, robots and sitemap through it (so the SEO tags and security headers are written as on your own server) and serves scripts, styles and photos straight from Vercel's CDN.

1. Push the code to GitHub (this repo: https://github.com/automation-wq/Mytekkstore).
2. At https://vercel.com/new import the repository, leave every setting as detected, and click Deploy.
3. In the Vercel project open Settings, Environment Variables, and add `ADMIN_PASSWORD` (sign in at `/admin.html` as admin@mytekkstore.local with it). Add `OTP_DEMO=1` if the walkthrough should show sign-in codes on screen. Redeploy once after adding them.

The site is then at `https://<project-name>.vercel.app`, and every push to `main` deploys again. Set the Root Directory to the repository root and the preset to Other if Vercel guesses `web` and Vite. Vercel has no disk: orders, accounts, admin edits and uploaded photos last only until Vercel starts a fresh copy (after a few minutes with no visitors). That is fine for showing the store; move the data to a database before taking real orders.

## How it works

| Part | File | What it does |
|---|---|---|
| Server | `server.js` | Serves the pages and the `/api/...` routes. Products, orders and accounts are saved as JSON files in `data/`. Prices and stock are always checked on the server, never trusted from the browser |
| Storefront | `web/src` (React 19: components, pages, store, stylesheet; animations with Motion from motion.dev in `motion.js`, `home.jsx` and `components.jsx`), built into `public/` | Home, category pages with explore-by-size tiles and the TV size guide, product pages, festive offers page with bank offers and No Cost EMI, cart drawer, checkout, sign-in page (mobile code, email, Google), account, order page, info pages. The header category menus open by hovering (mouse), one tap (phone) or Tab (keyboard) |
| Admin | `web/src/admin.jsx` | Orders and order status, products with photo upload and the No Cost EMI flag, outbox of customer messages with their sent status |
| Sample catalogue | `public/seed-data.js` | 9 sample products. Loaded into `data/products.json` on first start |
| Clips | `public/img/v-*.mp4` | Three free Pexels clips behind the hero slides and category tiles (free licence, commercial use) |
| Web standards | `server.js` | Server-written SEO and sharing tags, schema.org product data, sitemap and robots files, gzip and caching, security headers, web app manifest (see TRD section 10) |
| Tests | `test.js`, `test-ui.js`, `test-vercel.js` | `node test.js` checks the API (orders, stock, accounts, admin, request safety). `node test-vercel.js` checks the Vercel entry. `node test-ui.js` drives a real headless Edge or Chrome through the menus, cart, keyboard and phone taps |

## Client decisions of 12 October 2026 (meeting notes)

- **Televisions only for now.** Washing machines and air conditioners stay in the data but are not served, listed, linked or sold: `HIDDEN_CATS` in `server.js`. Empty the list to bring them back; the pages, menus, sitemap and home page follow on their own. The admin page still shows and edits them (`/api/products?all=1`).
- **Shop by operating system.** Each TV carries an `os` field (Google TV, WebOS, Android TV; set it in the admin form). It drives the OS row on the home page, the OS tiles and the OS filter on the Televisions page, the OS tag on product pages, the OS row in both compare tables, and the chart that puts the systems side by side (`TV_OS` in `web/src/data.js`, general platform facts for the client to confirm). The sample catalogue's OS values are samples.
- **Removed:** the TV size guide (buyers already know the size they want) and the store locator (`SHOW_STORES` in `data.js` plus `HIDDEN_PAGES` in `server.js` bring it back).
- **Home page:** four banners (`HOME_BANNERS` in `data.js`: the factory-price message, one banner per brand with the brand's flagship TV and two or three reasons read from its products, one promotion), the numbers band, Find your TV by size and by operating system, Deals of the Day, two giant brand tiles, the OS chart, reviews, bank offers, why us, and Good to know with the warranty and returns questions. The sections the client called duplicates are gone (category tiles, bento, in-focus story, category stories, marquee, festive banner).
- **Product pages:** OS tag, a "Warranty, returns and replacement" box beside the buy button, a full "Warranty and returns" Q&A after the compare table (`WARRANTY_QA` in `data.js`, a draft of the claim process for the client to confirm), and A+ content blocks: the admin writes them (one block per line: Title | Text | photo); until then every TV page shows four blocks built from its own specifications (`autoStory` in `data.js`), so no product page is bare. The first block is a dark showcase with the TV floating beside its big numbers (inch, resolution, sound, operating system), the way Samsung and Sony lay out a model page; the floating TV cutouts come from `npm run cutouts` in `web` (the white studio background made transparent) and float on the brand banners and brand tiles too. The sample catalogue has nine TVs (five added on 12 October, reusing the four TV renders) and "coming soon" entries in the top bar for the two hidden categories (`COMING_SOON` in `data.js`).
- **Returns page** gained the same warranty Q&A; the home and category "Good to know" lists carry the two main questions.

## Addresses, photos and protection (audit pass, 12 October 2026)

- Clean addresses: `/televisions`, `/televisions/<brand-and-model>`, `/products?brand=Elista`, `/products?sort=off`, `/offers`, `/cart`, `/account`, `/shipping` and the other info pages. The server resolves them (`resolveClean` in `server.js`) and the app builds them (`catUrl`, `productUrl` and `listUrl` in `web/src/data.js`; both sides use the same slug rule). The old `.html?...` addresses keep working and name the clean one as canonical. A renamed product gets a new address and old links to it stop working, so rename with care.
- Photos: after adding or replacing photos in `public/img`, run `npm run images` inside `web` to write the WebP copies (full, 960 and 480 px). The app picks them up on its own. Uploads from the admin page and outside links are used as they are. Keep the `.jpg` originals: sharing previews use them, and photo paths are always absolute (`/img/...`), because product pages sit one level deep.
- Search: every page has its own title and description, private pages are `noindex`, the sitemap carries last-modified dates, and `robots.txt` lets search engines fetch the product data. `docs/AUDIT_RESPONSE.md` answers the October audit item by item.
- Protection: 120 API writes per address per 10 minutes, plus the sign-in and code limits. Bundles of the last three builds are kept, so pages that are open during a deploy keep working.

## Documents

- `docs/PRD.md`: what the store must do and what the client still needs to supply.
- `docs/TRD.md`: how it is built, how to launch it, and how to add OTP sign-in later.
- `docs/APP_FLOW.md`: every page and where it leads, plus what works today.
- `docs/APP_DESIGN.md`: colours, type, layouts, components and motion.
- `docs/LAUNCH_READINESS.md`: the plain answer for the client on what is ready, what keeps the store up, and what is still needed to open to the public.

## Before launch

Replace the sample products, photos, logo and colours with the client's own. The About, Contact, Store locator, Shipping, Returns, Terms and Privacy pages are full drafts written from how the store actually works (`web/src/info.jsx`): the client confirms the return and refund windows (`POLICY` in `web/src/data.js`) and fills in `CONTACT` and `STORES` there. Messages from the contact form appear in the admin page under Customer messages. Replace the sample bank offers (`BANK_OFFERS` in `web/src/data.js`) with the real terms and untick No Cost EMI on products that do not have it. Connect a payment gateway, and set the Twilio and Google variables (see `docs/TRD.md` section 11).
