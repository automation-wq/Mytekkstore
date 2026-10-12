// Website research: robots.txt is read first and honoured; pages are discovered from a start page by following same-site links
// that look like category, listing, product, offer, campaign or compare pages; each page is observed in the browser and turned
// into a reference record with the observed FACTS (what was on the page) kept apart from NOTES (the agent's interpretation).
// Screenshots are kept locally as the reference image with the source URL; image files on the site are linked, not copied.
const crypto = require("crypto"), fs = require("fs"), path = require("path");
const { db, add, update, get, ASSETS, log } = require("./store.js");
const { visit } = require("./browser.js");
const { palette } = require("./image.js");

const TYPES = [
  ["compare", /compare|comparison|vs\b/i], ["offers", /offer|deal|sale|festive|diwali|promotion|discount|emi/i], ["campaign", /campaign|launch|event|week|days\b|season/i],
  ["product", /\/(p|dp|product|products)\/|\/buy\/|[-_][a-z0-9]{6,}\.html$|\/[a-z0-9-]+-(tv|television|refrigerator|washing|laptop|phone|ac)\b/i], ["listing", /\/(all|list|c|category|shop)\/|\?page=|all-tvs|televisions|appliances|laptops|smartphones/i],
];
const robotsCache = {};
async function allowed(url, ua) {
  const u = new URL(url), key = u.origin;
  if (!robotsCache[key]) {
    try { const txt = await (await fetch(key + "/robots.txt", { headers: { "user-agent": ua }, signal: AbortSignal.timeout(8000) })).text(); robotsCache[key] = parseRobots(txt); }
    catch { robotsCache[key] = { disallow: [] }; }
  }
  const p = u.pathname + u.search;
  return !robotsCache[key].disallow.some(d => d && p.startsWith(d));
}
function parseRobots(txt) { // the rules for every user-agent (*): Disallow paths
  const out = { disallow: [] }; let applies = false;
  for (const raw of txt.split(/\r?\n/)) { const line = raw.replace(/#.*/, "").trim(); if (!line) continue; const [k, ...rest] = line.split(":"); const v = rest.join(":").trim(); const key = k.trim().toLowerCase();
    if (key === "user-agent") applies = v === "*"; else if (applies && key === "disallow" && v) out.disallow.push(v.replace(/\*$/, "")); }
  return out;
}
const flatLd = ld => (ld || []).flatMap(x => Array.isArray(x) ? x : x && Array.isArray(x["@graph"]) ? x["@graph"] : [x]).filter(x => x && typeof x === "object"); // one script may hold an array or a @graph
const pageType = (url, obs) => obs && flatLd(obs.ld).some(x => x["@type"] === "Product") ? "product" : (TYPES.find(([, re]) => re.test(url)) || ["home"])[0];
const sha = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);

// discover same-site links from a visited page that look like the page types we study
// product pages first, then offers, campaigns, comparisons, listings; addresses with a query string (filters, sorts) are skipped
function discover(obs, base, max) {
  const host = new URL(base).host, seen = new Set(), out = [], rank = { product: 0, offers: 1, campaign: 2, compare: 3, listing: 4 };
  for (const href of obs.links || []) {
    let u; try { u = new URL(href, base); } catch { continue; }
    if (u.host !== host || !/^https?:$/.test(u.protocol) || u.search) continue;
    u.hash = ""; const s = u.toString();
    if (seen.has(s) || s === base) continue;
    const t = (TYPES.find(([, re]) => re.test(s)) || [null])[0];
    if (!t) continue;
    seen.add(s); out.push({ url: s, type: t });
  }
  return out.sort((a, b) => rank[a.type] - rank[b.type]).slice(0, max);
}

// one page -> one reference (or an update of the reference that already holds this URL)
async function collect(website, url, type) {
  const ua = db.settings.userAgent;
  if (!(await allowed(url, ua))) throw new Error("robots.txt disallows this page for crawlers; skipped.");
  const obs = await visit(url);
  const hero = obs.images.sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0] || null;
  const ld = flatLd(obs.ld);
  const prod = ld.find(x => x["@type"] === "Product") || null;
  const id = sha(url), imagePath = path.join("refs", id + ".png");
  fs.writeFileSync(path.join(ASSETS, imagePath), obs.png);
  const colours = await palette(obs.png, 6);
  const ctaEl = obs.buttons[0] || null, priceText = obs.prices[0] || (prod && prod.offers && (prod.offers.price || (prod.offers[0] || {}).price) ? "₹" + (prod.offers.price || prod.offers[0].price) : "");
  const facts = {
    title: obs.title, description: obs.description, headline: obs.h1 ? obs.h1.text : (obs.heads[0] || {}).text || "", copy: obs.heads.slice(0, 12).map(h => h.text), price: priceText, offers: obs.offers,
    productName: prod ? prod.name : "", model: prod ? (prod.sku || prod.mpn || prod.model || "") : "", brand: prod && prod.brand ? (prod.brand.name || prod.brand) : website.brand, category: prod ? (prod.category || "") : "",
    benefits: obs.heads.filter(h => h.tag !== "h1" && h.text.length < 80).slice(0, 8).map(h => h.text), imageUrl: hero ? hero.src : obs.ogImage, imageAlt: hero ? hero.alt : "", imageDims: hero ? { w: hero.w, h: hero.h, ratio: hero.w && hero.h ? +(hero.w / hero.h).toFixed(2) : null } : null,
    palette: colours, typography: { headline: obs.h1 ? obs.h1.font : (obs.heads[0] || {}).font || null, body: obs.bodyFont }, layout: { headline: obs.h1 ? obs.h1.box : null, price: null, cta: ctaEl ? ctaEl.box : null, image: hero ? hero.box : null, pageWidth: obs.width, pageHeight: obs.height },
    cta: ctaEl ? ctaEl.text : "", buttons: obs.buttons.map(b => b.text), backgrounds: obs.bgs.map(b => b.bg || b.img).slice(0, 6), images: obs.images.slice(0, 12).map(i => ({ src: i.src, alt: i.alt, w: i.w, h: i.h })), specs: obs.specs, screenshotDims: { w: 1366, h: Math.min(obs.height, 2400) },
  };
  const rec = { websiteId: website.id, brand: website.brand, sourceUrl: url, pageType: type || pageType(url, obs), imagePath: imagePath.replace(/\\/g, "/"), collectedAt: new Date().toISOString(), facts, notes: {}, hash: sha(facts.headline + "|" + facts.imageUrl), broken: false, status: "completed" };
  const dup = db.references.find(r => r.sourceUrl === url) || db.references.find(r => r.hash === rec.hash && r.websiteId === website.id);
  if (dup) { update("references", dup.id, { ...rec, duplicateOf: dup.sourceUrl !== url ? dup.id : undefined }); log("info", "reference refreshed", { id: dup.id, url }); return get("references", dup.id); }
  const r = add("references", rec); log("info", "reference collected", { id: r.id, url, type: r.pageType }); return r;
}

// research a website: start page, then up to settings.maxPagesPerSite discovered pages, one by one (pausable)
async function research(website, ctl) {
  const ua = db.settings.userAgent, max = db.settings.maxPagesPerSite || 12, done = [], failed = [];
  if (!(await allowed(website.url, ua))) throw new Error("robots.txt disallows the start page.");
  const first = await visit(website.url, { screenshot: false });
  const queue = discover(first, website.url, max);
  update("websites", website.id, { status: "running", pagesFound: queue.length + 1 });
  const pages = [{ url: website.url, type: pageType(website.url, first) }, ...queue];
  for (const pg of pages) {
    if (ctl && ctl.paused()) { update("websites", website.id, { status: "paused" }); return { done, failed, paused: true }; }
    const page = db.pages.find(p => p.url === pg.url) || add("pages", { websiteId: website.id, url: pg.url, type: pg.type, status: "pending" });
    try { const r = await collect(website, pg.url, pg.type); update("pages", page.id, { status: "completed", referenceId: r.id, checkedAt: new Date().toISOString(), error: "" }); done.push(r.id); }
    catch (e) { update("pages", page.id, { status: "failed", checkedAt: new Date().toISOString(), error: e.message }); failed.push({ url: pg.url, error: e.message }); log("warn", "page failed", { url: pg.url, error: e.message }); }
  }
  update("websites", website.id, { status: "completed", lastRun: new Date().toISOString(), collected: done.length, failed: failed.length });
  return { done, failed };
}
// a HEAD request per reference: a source page that vanished is marked broken (and can be rechecked later)
async function recheck(ref) {
  try { const r = await fetch(ref.sourceUrl, { method: "HEAD", redirect: "follow", headers: { "user-agent": db.settings.userAgent }, signal: AbortSignal.timeout(10000) }); update("references", ref.id, { broken: r.status >= 400, lastChecked: new Date().toISOString(), lastStatus: r.status }); return r.status; }
  catch (e) { update("references", ref.id, { broken: true, lastChecked: new Date().toISOString(), lastStatus: 0, lastError: e.message }); return 0; }
}
module.exports = { research, collect, recheck, allowed, parseRobots, pageType, discover };
