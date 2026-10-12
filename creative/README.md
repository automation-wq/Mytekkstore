# Creative Intelligence Agent

Researches the official websites of reference brands (Samsung India, LG India, Croma, or any site you add), keeps what was
observed on each page, reads it for design lessons, writes original concepts for our own products, renders the creatives
(the real product photo on a generated backdrop, words drawn exactly), checks their quality, takes approvals and exports
everything. One dashboard, one Node process, JSON files on disk. Nothing outside this machine is needed; keys add providers.

## Run

```
cd creative
node server.js            (or double-click start-creative.bat)
→ http://localhost:3200
node test.js              end-to-end self-check (temporary data folders)
```

Requirements: Node 18+ and Microsoft Edge (the headless browser the store's tests use), plus the store's `web/` folder
installed once (`cd web && npm install`) because the image work reuses its copy of `sharp`. No other dependency.

Environment (see `.env.example`): `CREATIVE_PORT` (3200), `CREATIVE_DATA_DIR` (records, screenshots, uploads, generated
files; default `creative/data`), `GEMINI_API_KEY` (+ `GEMINI_IMAGE_MODEL`), `HIGGSFIELD_API_KEY` + `HIGGSFIELD_API_URL`,
`ANTHROPIC_API_KEY` (+ `CREATIVE_MODEL`). Keys are read from the environment only.

## What each part does

| Part | File | What it does |
|---|---|---|
| Store | `lib/store.js` | JSON collections (websites, pages, references, products, analyses, concepts, assets, qc, jobs, logs, settings), atomic writes, ids never reused, structured log |
| Browser | `lib/browser.js` | Headless Edge through the DevTools protocol (`../test-ui.js`'s `launch`). `visit(url)` returns what a visitor could observe: title, meta, headings with fonts and positions, visible copy, prices, offer words, buttons, images with rendered size, structured data, big backgrounds, spec tables, links, a screenshot. One page every two seconds per host. A sign-in wall, a human check or a page that will not load is a failure, never bypassed |
| Research | `lib/research.js` | Reads `robots.txt` first and honours it; discovers same-site pages of the studied kinds (product pages first, then offers, campaigns, comparisons, listings; no query-string variants); one reference per page with **facts** (observed) separate from **notes** (interpretation); the screenshot is the reference image, the site's image files are linked, not copied; duplicates by address or by content hash; recheck by HEAD request; scheduled refresh |
| Products | `lib/extract.js` | From an official page (Product structured data + spec table + warranty line, a price conflict between data and text is flagged), from a CSV or JSON upload, or by hand. Fields not on the source stay empty |
| Analysis | `lib/analyze.js` | Visual hierarchy, design system, messaging, format, objective: facts, patterns, possible strengths, potential weaknesses, lessons, a recommended original concept, hypotheses (labelled; no performance claim from looks). With a language-model key an extra, labelled interpretation |
| Strategy | `lib/strategy.js` | Up to seven concepts per product across approaches (feature-led, minimalist, offer-led, lifestyle, specification-led, comparison, problem-solution), each with headline, copy, USP, visual direction, background, positioning, typography, palette, callouts, CTA, ratio and pixels, backdrop prompt, negative prompt, the references it learned from, how it differs, priority and why. Only the product's facts; only general lessons from references |
| Generation | `lib/generate.js` | Provider interface: `composite` (no key), `gemini`, `higgsfield`. Every provider ends with the real product photo (cutout when it is a white-background photo, with a soft shadow) composited onto the backdrop and the words drawn by the text layer, so spelling and product fidelity are exact. Versions are kept, never overwritten; nothing is marked generated until the file reads back at the requested size |
| Quality | `lib/qc.js` | Deterministic checks (file, size, ratio, headline/supporting/CTA drawn, duplicated words, text inside the canvas, contrast, product share, fidelity, every number traceable to the product's facts, USPs backed by facts, brand colours when guidelines give hex codes) scored 0–100; manual checks (spelling by eye, artefacts) listed, not scored |
| Exports | `lib/export.js` | References CSV, products CSV/JSON, approved assets ZIP with a manifest (own ZIP writer), strategy report (Markdown and HTML). Every row carries the linking ids |
| Server | `server.js` | API, job runner (pending → running → completed/failed, retry, pause/resume for research, scheduled refresh), uploads, static dashboard and files |
| Dashboard | `public/index.html` | One page, eight tabs: Overview, Reference library, Product library, Creative analysis, Creative generator, Quality control, Export centre, Settings |

## The store's hook

The shop (`../server.js`) reaches this agent through `CREATIVE_URL`: `GET /api/creative/status` and `POST /api/creative/concepts`
from the shop's admin call `GET /api/health` and `POST /api/concepts` here. The admin's banner editor then shows "creative agent
connected" and can fill a banner's words from the first concept. Without `CREATIVE_URL` it says, honestly, that it is not connected.

## What needs keys or a decision (documented, not pretended)

- Image backdrops from an AI model: `GEMINI_API_KEY` (Google AI Studio) or `HIGGSFIELD_API_KEY` + `HIGGSFIELD_API_URL` (your
  account's text-to-image endpoint; the adapter posts `{prompt, negative, width, height}` and expects `{url}` or `{image}`).
  Until then the composite provider renders a gradient or one of the store's lifestyle photos.
- A language model for labelled interpretation and tighter copy: `ANTHROPIC_API_KEY`.
- XLSX and PDF catalogues are stored as uploads; their text is not parsed (export the sheet to CSV to import rows).
- OCR of AI-generated images is not done; the text layer is always drawn here, so that check is deterministic by construction.
- A database replaces the JSON files when several people write at once; the record shapes stay.

## Sample records

The test creates its own temporary data. In the real data folder nothing is seeded: add a website and a product to begin. Any
record you add for a walkthrough should carry "sample" in its name so it is not mistaken for research.
