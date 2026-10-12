// Browser automation for permitted research: the same headless Edge driver (Chrome DevTools Protocol, no extra package) that the
// store's browser tests use (../test-ui.js exports launch()). visit(url) opens a page like a visitor would and returns what can be
// observed: title, meta, headings, visible copy, prices, buttons, images with their rendered size, structured data, computed
// typography and the positions of the headline, price and buttons, plus a screenshot. Nothing is bypassed: if a page asks for a
// sign-in, a CAPTCHA or blocks the visit, that is reported as a failure.
const { launch } = require("../../test-ui.js");
const { log } = require("./store.js");

let browser = null, lastHost = {};
const PORT = 9580 + Math.floor(Math.random() * 100);
async function get() {
  if (browser) return browser;
  browser = await launch({ width: 1366, height: 900, mobile: false, port: PORT });
  return browser;
}
async function close() { if (browser) { try { await browser.close(); } catch {} browser = null; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// at most one visit every 2 s per host, so a site never sees a burst
async function polite(url) { const h = new URL(url).host, wait = (lastHost[h] || 0) + 2000 - Date.now(); if (wait > 0) await sleep(wait); lastHost[h] = Date.now(); }

const OBSERVE = `(() => {
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const box = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  const font = el => { const s = getComputedStyle(el); return { family: s.fontFamily.split(",")[0].replace(/["']/g, "").trim(), size: Math.round(parseFloat(s.fontSize)), weight: s.fontWeight, color: s.color, transform: s.textTransform, letterSpacing: s.letterSpacing }; };
  const text = el => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const meta = n => (document.querySelector('meta[name="' + n + '"], meta[property="' + n + '"]') || {}).content || "";
  const body = document.body;
  const heads = [...document.querySelectorAll("h1,h2,h3")].filter(vis).slice(0, 40).map(el => ({ tag: el.tagName.toLowerCase(), text: text(el).slice(0, 200), box: box(el), font: font(el) })).filter(h => h.text);
  const h1 = [...document.querySelectorAll("h1")].find(el => vis(el) && parseFloat(getComputedStyle(el).fontSize) >= 14) || null; // not a 1px heading kept for screen readers
  const all = text(body);
  const prices = [...new Set((all.match(/(?:₹|Rs\\.?|INR)\\s?[\\d,]{3,}(?:\\.\\d+)?(?:\\s?\\/\\s?mo(?:nth)?\\.?|\\s?per month)?/gi) || []).slice(0, 30))];
  const offers = [...new Set((all.match(/\\b\\d{1,2}%\\s?(?:off|discount)|no cost emi|cashback|exchange|free (?:delivery|shipping|installation)|limited (?:time|period)|save ₹[\\d,]+/gi) || []).map(s => s.toLowerCase()).slice(0, 20))];
  const buttons = [...document.querySelectorAll("a,button")].filter(el => vis(el) && /^(buy|shop|add to cart|learn more|know more|explore|see|view|compare|order|get|pre-?order|discover|check)/i.test(text(el))).slice(0, 20).map(el => ({ text: text(el).slice(0, 60), href: el.href || "", box: box(el), font: font(el) }));
  const images = [...document.images].filter(vis).map(i => ({ src: i.currentSrc || i.src, alt: (i.alt || "").slice(0, 160), w: i.naturalWidth, h: i.naturalHeight, box: box(i) })).filter(i => i.box.w >= 120 && i.box.h >= 80 && /^https?:/.test(i.src)).slice(0, 60);
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent); } catch { return null; } }).filter(Boolean);
  const bgs = [...document.querySelectorAll("section,header,div")].filter(vis).map(el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return { bg: s.backgroundColor, img: s.backgroundImage !== "none" ? s.backgroundImage.slice(0, 200) : "", area: r.width * r.height }; }).filter(b => b.area > 200000 && (b.img || !/rgba\\(0, 0, 0, 0\\)/.test(b.bg))).slice(0, 12);
  const specs = {}; document.querySelectorAll("table tr, dl").forEach(row => { const cells = row.matches("dl") ? [...row.children] : [...row.children]; for (let i = 0; i + 1 < cells.length; i += 2) { const k = text(cells[i]).slice(0, 60), v = text(cells[i + 1]).slice(0, 200); if (k && v && k.length < 60 && Object.keys(specs).length < 80) specs[k] = v; } });
  const blocked = /captcha|access denied|verify you are human|sign in to continue|enable javascript/i.test(all.slice(0, 2000)) && all.length < 3000;
  const links = [...new Set([...document.links].map(a => a.href).filter(h => /^https?:/.test(h)))].slice(0, 500);
  return { url: location.href, title: document.title, links, description: meta("description"), ogImage: meta("og:image"), ogTitle: meta("og:title"), h1: h1 ? { text: text(h1).slice(0, 200), box: box(h1), font: font(h1) } : null, heads, bodyFont: font(body), copy: all.slice(0, 4000), prices, offers, buttons, images, ld, bgs, specs, blocked, width: innerWidth, height: document.documentElement.scrollHeight };
})()`;

async function visit(url, { screenshot = true } = {}) {
  await polite(url);
  const b = await get();
  await b.goto(url);
  await sleep(1500);
  // scroll through once so lazy images and reveals have loaded, then back to the top
  const total = Math.min(await b.ev("document.documentElement.scrollHeight"), 6000);
  for (let y = 0; y < total; y += 700) { await b.ev(`scrollTo({ top: ${y}, behavior: "instant" })`); await sleep(150); }
  await b.ev('scrollTo({ top: 0, behavior: "instant" })'); await sleep(400);
  const obs = await b.ev(OBSERVE);
  const err = /\b(ERR_[A-Z_]+)\b/.exec((obs.copy || "").slice(0, 600));
  if (err || /^chrome-error:/.test(obs.url) || /^chrome-error:/.test(await b.ev("document.URL"))) throw new Error("The page could not be loaded" + (err ? " (" + err[1] + ")" : "") + ".");
  if (obs.blocked) throw new Error("The page asks for a sign-in or a human check; it was not bypassed.");
  const png = screenshot ? Buffer.from((await b.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1366, height: Math.min(obs.height, 2400), scale: 1 }, captureBeyondViewport: true })).data, "base64") : null;
  return { ...obs, png };
}
process.on("exit", () => { if (browser) try { browser.close(); } catch {} });
module.exports = { visit, close, sleep };
