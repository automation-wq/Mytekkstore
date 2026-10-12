// Creative Intelligence Agent: research the official websites of reference brands, keep what was observed, read it for design
// lessons, write original concepts for our own products, render the creatives (real product photo on a generated backdrop, words
// drawn exactly), check their quality, approve, export. One Node process, no framework: JSON files on disk, a job runner for the
// long work, the headless-Edge driver for permitted browsing, sharp for images. Start: node server.js  (port CREATIVE_PORT, 3200)
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const { db, add, update, remove, get, log, saveSettings, ASSETS } = require("./lib/store.js");
const research = require("./lib/research.js"), extract = require("./lib/extract.js"), { analyze, enrich } = require("./lib/analyze.js"), strategy = require("./lib/strategy.js"), gen = require("./lib/generate.js"), qc = require("./lib/qc.js"), exp = require("./lib/export.js"), llm = require("./lib/llm.js"), browser = require("./lib/browser.js");
const PORT = +process.env.CREATIVE_PORT || 3200, VERSION = "0.1.0";

// ===== jobs: one runner, every job on disk with its status, pause for research, retry for failures =====
let paused = false, running = false;
const ctl = { paused: () => paused };
const KINDS = {
  research: async j => { const w = get("websites", j.payload.websiteId); if (!w) throw new Error("Website not found."); return research.research(w, ctl); },
  collect: async j => { const w = get("websites", j.payload.websiteId); if (!w) throw new Error("Website not found."); const r = await research.collect(w, j.payload.url, j.payload.type); return { referenceId: r.id }; },
  recheck: async j => { const r = get("references", j.payload.referenceId); if (!r) throw new Error("Reference not found."); return { status: await research.recheck(r) }; },
  extract: async j => { const p = await extract.fromUrl(j.payload.url); const rec = add("products", p); return { productId: rec.id }; },
  analyze: async j => { const r = get("references", j.payload.referenceId); if (!r) throw new Error("Reference not found."); const base = analyze(r); const notes = await enrich(r, base); const a = add("analyses", { referenceId: r.id, ...base, llm: notes, provider: notes && !notes.error ? "rules + " + llm.MODEL : "rules" }); update("references", r.id, { analysisId: a.id, notes: { ...(r.notes || {}), objective: base.hypotheses[0], adaptation: base.concept, label: "interpretation, not observed facts" } }); return { analysisId: a.id }; },
  concepts: async j => { const p = get("products", j.payload.productId); if (!p) throw new Error("Product not found."); let list = strategy.concepts(p, pickRefs(j.payload.referenceIds, p), j.payload); if (j.payload.polish) list = await Promise.all(list.map(c => strategy.polish(c, p))); return { conceptIds: list.map(c => add("concepts", c).id) }; },
  generate: async j => { const c = get("concepts", j.payload.conceptId); if (!c) throw new Error("Concept not found."); const p = get("products", c.productId); if (!p) throw new Error("The concept's product is gone."); const a = await gen.generate(c, p, j.payload); update("concepts", c.id, { status: "generated" }); const q = await qc.check(a, c, p); const rec = add("qc", { assetId: a.id, conceptId: c.id, productId: p.id, ...q, status: "awaiting approval" }); update("assets", a.id, { qcId: rec.id, status: "awaiting approval" }); return { assetId: a.id, qcId: rec.id, score: q.score }; },
  qc: async j => { const a = get("assets", j.payload.assetId); if (!a) throw new Error("Asset not found."); const c = get("concepts", a.conceptId), p = get("products", a.productId); const q = await qc.check(a, c, p); const rec = add("qc", { assetId: a.id, conceptId: c.id, productId: p.id, ...q, status: a.status === "approved" ? "approved" : "awaiting approval" }); update("assets", a.id, { qcId: rec.id }); return { qcId: rec.id, score: q.score }; },
};
// the references a product's concepts learn from: chosen ids, else the library (same brand and product pages first), with their analyses
function pickRefs(ids, p) {
  const refs = ids && ids.length ? ids.map(id => get("references", id)).filter(Boolean) : db.references.filter(r => !r.broken);
  return refs.map(r => ({ ...r, analysis: db.analyses.filter(a => a.referenceId === r.id).pop() || null })).sort((a, b) => (b.brand === p.brand) - (a.brand === p.brand) || (b.pageType === "product") - (a.pageType === "product")).slice(0, 12);
}
function enqueue(kind, payload) { const j = add("jobs", { kind, payload, status: "pending", attempts: 0, error: "" }); setImmediate(run); return j; }
async function run() {
  if (running) return;
  const j = db.jobs.find(x => x.status === "pending" && !(paused && (x.kind === "research" || x.kind === "collect")));
  if (!j) return;
  running = true; update("jobs", j.id, { status: "running", attempts: j.attempts + 1, startedAt: new Date().toISOString(), error: "" });
  try { const result = await KINDS[j.kind](j); update("jobs", j.id, { status: "completed", finishedAt: new Date().toISOString(), result }); }
  catch (e) { update("jobs", j.id, { status: "failed", finishedAt: new Date().toISOString(), error: e.message }); log("error", "job failed", { id: j.id, kind: j.kind, error: e.message }); }
  running = false; setImmediate(run);
}
db.jobs.filter(j => j.status === "running").forEach(j => update("jobs", j.id, { status: "failed", error: "Interrupted by a restart; retry it." })); // a crash never leaves a job "running" forever
const wait = (id, ms = 240000) => new Promise((res, rej) => { const t0 = Date.now(); (function tick() { const j = get("jobs", id); if (j.status === "completed") return res(j); if (j.status === "failed") return rej(new Error(j.error)); if (Date.now() - t0 > ms) return rej(new Error("Timed out waiting for job " + id)); setTimeout(tick, 150); })(); });
// scheduled refresh: research every website and recheck every reference every N hours (0 = off)
setInterval(() => { if (!db.settings.refreshHours) return; const due = Date.now() - db.settings.refreshHours * 3600e3; if ((db.settings.lastRefresh || 0) < due) { saveSettings({ lastRefresh: Date.now() }); db.websites.forEach(w => enqueue("research", { websiteId: w.id })); db.references.forEach(r => enqueue("recheck", { referenceId: r.id })); } }, 60e3).unref();

// ===== HTTP =====
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = msg => { throw new HttpError(400, msg); };
const routes = [];
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp("^/api/" + pattern + "$"), fn });
const str = (v, label, max = 300) => { if (typeof v !== "string" || !(v = v.trim()) || v.length > max) bad(`${label} is required (max ${max} characters).`); return v; };
const httpUrl = (v, label) => { const s = str(v, label, 500); try { const u = new URL(s); if (!/^https?:$/.test(u.protocol)) throw 0; return u.toString(); } catch { bad(label + " must be an http(s) address."); } };
const file = (data, name) => { const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(String(data || "")); if (!m) bad("Send the file as a data URL (base64)."); const buf = Buffer.from(m[2], "base64"); if (!buf.length || buf.length > 15e6) bad("The file must be under 15 MB."); const safe = String(name || "file").replace(/[^\w.-]+/g, "-").slice(0, 80); const rel = path.join("uploads", crypto.randomBytes(4).toString("hex") + "-" + safe).replace(/\\/g, "/"); fs.writeFileSync(path.join(ASSETS, rel), buf); return { rel, type: m[1], bytes: buf.length, buf }; };
const q = req => new URL(req.url, "http://x").searchParams;

on("GET", "health", () => ({ ok: true, app: "Creative Intelligence Agent", version: VERSION, paused, counts: Object.fromEntries(["websites", "references", "products", "concepts", "assets"].map(k => [k, db[k].length])), providers: { image: db.settings.imageProvider, ready: { composite: true, gemini: !!process.env.GEMINI_API_KEY, higgsfield: !!(process.env.HIGGSFIELD_API_KEY && process.env.HIGGSFIELD_API_URL) }, llm: llm.available() ? llm.MODEL : "" } }));
on("GET", "overview", () => ({ references: db.references.length, websites: db.websites.length, products: db.products.length, analyses: db.analyses.length, concepts: db.concepts.length, assets: db.assets.length, awaiting: db.assets.filter(a => a.status === "awaiting approval").length, approved: db.assets.filter(a => a.status === "approved").length, failedJobs: db.jobs.filter(j => j.status === "failed").length, runningJobs: db.jobs.filter(j => j.status === "running" || j.status === "pending").length, missing: { productsWithoutImages: db.products.filter(p => !(p.images || []).length).length, referencesWithoutAnalysis: db.references.filter(r => !r.analysisId).length, productsWithConflicts: db.products.filter(p => (p.conflicts || []).length).length, brokenReferences: db.references.filter(r => r.broken).length }, paused, lastJobs: db.jobs.slice(-8).reverse() }));
// websites and research
on("GET", "websites", () => ({ websites: db.websites.map(w => ({ ...w, pages: db.pages.filter(p => p.websiteId === w.id).length, references: db.references.filter(r => r.websiteId === w.id).length })) }));
on("POST", "websites", ({ body }) => ({ website: add("websites", { brand: str(body.brand, "Brand", 60), url: httpUrl(body.url, "Address"), status: "added" }) }));
on("DELETE", "websites/(\\d+)", ({ params }) => { if (!remove("websites", params[0])) throw new HttpError(404, "Website not found."); return {}; });
on("POST", "websites/(\\d+)/research", ({ params }) => { if (!get("websites", params[0])) throw new HttpError(404, "Website not found."); return { job: enqueue("research", { websiteId: +params[0] }) }; });
on("POST", "research/pause", () => { paused = true; return { paused }; });
on("POST", "research/resume", () => { paused = false; setImmediate(run); return { paused }; });
on("POST", "references/collect", ({ body }) => { const w = get("websites", body.websiteId); if (!w) bad("Choose a website."); return { job: enqueue("collect", { websiteId: w.id, url: httpUrl(body.url, "Address"), type: body.type || "" }) }; });
on("GET", "jobs", ({ req }) => { const s = q(req).get("status"); return { jobs: db.jobs.filter(j => !s || j.status === s).slice(-200).reverse() }; });
on("GET", "jobs/(\\d+)", ({ params }) => { const j = get("jobs", params[0]); if (!j) throw new HttpError(404, "Job not found."); return { job: j }; });
on("POST", "jobs/(\\d+)/retry", ({ params }) => { const j = get("jobs", params[0]); if (!j) throw new HttpError(404, "Job not found."); if (j.status !== "failed") bad("Only a failed job can be retried."); update("jobs", j.id, { status: "pending", error: "" }); setImmediate(run); return { job: get("jobs", j.id) }; });
on("GET", "pages", ({ req }) => { const w = +q(req).get("websiteId"); return { pages: db.pages.filter(p => !w || p.websiteId === w) }; });
// references and analyses
on("GET", "references", ({ req }) => { const s = q(req), t = (s.get("q") || "").toLowerCase(), brand = s.get("brand"), type = s.get("type"), w = +s.get("websiteId"); return { references: db.references.filter(r => (!brand || r.brand === brand) && (!type || r.pageType === type) && (!w || r.websiteId === w) && (!t || JSON.stringify([r.brand, r.sourceUrl, r.facts.headline, r.facts.productName, r.facts.copy]).toLowerCase().includes(t))).map(r => ({ ...r, facts: { ...r.facts, specs: undefined, images: undefined }, analysed: !!r.analysisId })) }; });
on("GET", "references/(\\d+)", ({ params }) => { const r = get("references", params[0]); if (!r) throw new HttpError(404, "Reference not found."); return { reference: r, analysis: db.analyses.filter(a => a.referenceId === r.id).pop() || null, page: db.pages.find(p => p.referenceId === r.id) || null }; });
on("DELETE", "references/(\\d+)", ({ params }) => { if (!remove("references", params[0])) throw new HttpError(404, "Reference not found."); return {}; });
on("POST", "references/(\\d+)/recheck", ({ params }) => ({ job: enqueue("recheck", { referenceId: +params[0] }) }));
on("POST", "references/(\\d+)/analyze", ({ params }) => { if (!get("references", params[0])) throw new HttpError(404, "Reference not found."); return { job: enqueue("analyze", { referenceId: +params[0] }) }; });
on("GET", "analyses", ({ req }) => { const r = +q(req).get("referenceId"); return { analyses: db.analyses.filter(a => !r || a.referenceId === r) }; });
// products
on("GET", "products", () => ({ products: db.products }));
on("POST", "products", ({ body }) => ({ product: add("products", extract.clean(body)) }));
on("PUT", "products/(\\d+)", ({ params, body }) => { const p = get("products", params[0]); if (!p) throw new HttpError(404, "Product not found."); return { product: update("products", p.id, extract.clean({ ...p, ...body })) }; });
on("DELETE", "products/(\\d+)", ({ params }) => { if (!remove("products", params[0])) throw new HttpError(404, "Product not found."); return {}; });
on("POST", "products/import", ({ body }) => { const list = extract.fromRows(body.text); return { products: list.map(p => add("products", p)) }; });
on("POST", "products/extract", ({ body }) => ({ job: enqueue("extract", { url: httpUrl(body.url, "Address") }) }));
on("POST", "products/(\\d+)/images", ({ params, body }) => { const p = get("products", params[0]); if (!p) throw new HttpError(404, "Product not found."); const f = file(body.data, body.name); if (!/^image\//.test(f.type)) bad("Please upload an image."); return { product: update("products", p.id, { images: [f.rel, ...(p.images || [])].slice(0, 12) }) }; });
on("POST", "products/(\\d+)/uploads", ({ params, body }) => { const p = get("products", params[0]); if (!p) throw new HttpError(404, "Product not found."); const kind = ["catalogue", "pdf", "guidelines", "brief", "other"].includes(body.kind) ? body.kind : "other"; const f = file(body.data, body.name); const patch = { uploads: [...(p.uploads || []), { path: f.rel, kind, type: f.type, bytes: f.bytes, name: body.name || "", at: new Date().toISOString() }] }; if (kind === "guidelines" && /^text\//.test(f.type)) patch.guidelines = f.buf.toString("utf8").slice(0, 4000); if (kind === "catalogue" && /^text\/|json/.test(f.type)) { try { const rows = extract.fromRows(f.buf.toString("utf8")); patch.imported = rows.map(r => add("products", r).id); } catch (e) { patch.importError = e.message; } } return { product: update("products", p.id, patch) }; });
// concepts and generation
on("POST", "products/(\\d+)/concepts", ({ params, body, req }) => { const p = get("products", params[0]); if (!p) throw new HttpError(404, "Product not found."); const j = enqueue("concepts", { productId: p.id, objective: String(body.objective || "").slice(0, 80), placement: String(body.placement || "").slice(0, 80), referenceIds: Array.isArray(body.referenceIds) ? body.referenceIds.map(Number) : [], polish: !!body.polish }); return q(req).get("wait") ? wait(j.id).then(d => ({ job: d, concepts: d.result.conceptIds.map(id => get("concepts", id)) })) : { job: j }; });
on("GET", "concepts", ({ req }) => { const p = +q(req).get("productId"); return { concepts: db.concepts.filter(c => !p || c.productId === p).map(c => ({ ...c, assets: db.assets.filter(a => a.conceptId === c.id).length })) }; });
on("GET", "concepts/(\\d+)", ({ params }) => { const c = get("concepts", params[0]); if (!c) throw new HttpError(404, "Concept not found."); return { concept: c, product: get("products", c.productId), assets: db.assets.filter(a => a.conceptId === c.id), references: (c.references || []).map(id => get("references", id)).filter(Boolean) }; });
on("PUT", "concepts/(\\d+)", ({ params, body }) => { const c = get("concepts", params[0]); if (!c) throw new HttpError(404, "Concept not found."); const patch = {}; for (const k of ["name", "headline", "supporting", "usp", "cta", "prompt", "negative", "visual", "background", "ratio", "placement", "objective"]) if (typeof body[k] === "string") patch[k] = body[k].slice(0, k === "prompt" || k === "negative" ? 1200 : 300); if (Array.isArray(body.callouts)) patch.callouts = body.callouts.slice(0, 4).map(x => [String(x[0] || "").slice(0, 16), String(x[1] || "").slice(0, 24)]); if (Array.isArray(body.palette)) patch.palette = body.palette.slice(0, 4).map(s => String(s).slice(0, 9)); for (const k of ["width", "height"]) if (Number.isInteger(body[k]) && body[k] >= 200 && body[k] <= 4096) patch[k] = body[k]; if (patch.width && patch.height && !body.ratio) patch.ratio = (() => { const g = (a, b) => b ? g(b, a % b) : a, d = g(patch.width, patch.height); return patch.width / d + ":" + patch.height / d; })(); return { concept: update("concepts", c.id, patch) }; });
on("POST", "concepts/(\\d+)/generate", ({ params, body, req }) => { const c = get("concepts", params[0]); if (!c) throw new HttpError(404, "Concept not found."); const provider = body.provider && ["composite", "gemini", "higgsfield"].includes(body.provider) ? body.provider : undefined; const size = {}; for (const k of ["width", "height"]) if (Number.isInteger(body[k]) && body[k] >= 200 && body[k] <= 4096) size[k] = body[k]; const j = enqueue("generate", { conceptId: c.id, provider, ...size, instructions: String(body.instructions || "").slice(0, 300) }); return q(req).get("wait") ? wait(j.id).then(d => ({ job: d, asset: get("assets", d.result.assetId), qc: get("qc", d.result.qcId) })) : { job: j }; });
// the store's hook (server.js of the shop calls this with its product record): concepts for a product that may not be in the library yet
on("POST", "concepts", async ({ body }) => { const sp = body.product || {}; if (!sp.brand || !sp.name) bad("Send a product with a brand and a name."); const specs = Array.isArray(sp.specs) ? Object.fromEntries(sp.specs) : sp.specs || {}; const images = [sp.img, ...(sp.images || [])].filter(Boolean); let p = db.products.find(x => x.brand === sp.brand && x.name === sp.name); const clean = extract.clean({ ...sp, specs, images, offers: sp.emi ? ["No Cost EMI"] : [], source: "the store's catalogue", verifiedAt: new Date().toISOString() }); p = p ? update("products", p.id, clean) : add("products", clean); const list = strategy.concepts(p, pickRefs([], p), { objective: String(body.objective || ""), placement: String(body.slot || "") }).map(c => add("concepts", c)); return { productId: p.id, concepts: list.map(c => ({ id: c.id, approach: c.approach, kicker: p.brand + (p.model ? " · " + p.model : ""), headline: c.headline, supporting: c.supporting, cta: c.cta, visual: c.visual, background: c.background, palette: c.palette, prompt: c.prompt })) }; });
// assets, quality control, approval
on("GET", "assets", ({ req }) => { const s = q(req), c = +s.get("conceptId"), p = +s.get("productId"), st = s.get("status"); return { assets: db.assets.filter(a => (!c || a.conceptId === c) && (!p || a.productId === p) && (!st || a.status === st)).map(a => ({ ...a, qc: db.qc.filter(x => x.assetId === a.id).pop() || null })).reverse() }; });
on("GET", "assets/(\\d+)", ({ params }) => { const a = get("assets", params[0]); if (!a) throw new HttpError(404, "Asset not found."); const c = get("concepts", a.conceptId); return { asset: a, qc: db.qc.filter(x => x.assetId === a.id).pop() || null, concept: c, product: get("products", a.productId), reference: a.referenceId ? get("references", a.referenceId) : null, versions: db.assets.filter(x => x.conceptId === a.conceptId).map(x => ({ id: x.id, version: x.version, path: x.path, status: x.status })) }; });
on("POST", "assets/(\\d+)/qc", ({ params }) => { if (!get("assets", params[0])) throw new HttpError(404, "Asset not found."); return { job: enqueue("qc", { assetId: +params[0] }) }; });
on("POST", "assets/(\\d+)/status", ({ params, body }) => { const a = get("assets", params[0]); if (!a) throw new HttpError(404, "Asset not found."); const status = ["approved", "rejected", "revised", "awaiting approval"].includes(body.status) ? body.status : bad("Status must be approved, rejected, revised or awaiting approval."); const asset = update("assets", a.id, { status, notes: String(body.notes || "").slice(0, 500), decidedAt: new Date().toISOString() }); const last = db.qc.filter(x => x.assetId === a.id).pop(); if (last) update("qc", last.id, { status, notes: asset.notes }); update("concepts", a.conceptId, { status: status === "approved" ? "approved" : get("concepts", a.conceptId).status }); return { asset }; });
on("GET", "qc", ({ req }) => { const a = +q(req).get("assetId"); return { qc: db.qc.filter(x => !a || x.assetId === a) }; });
// settings, logs, exports
on("GET", "settings", () => ({ settings: db.settings, providers: { image: ["composite", "gemini", "higgsfield"], ready: { composite: true, gemini: !!process.env.GEMINI_API_KEY, higgsfield: !!(process.env.HIGGSFIELD_API_KEY && process.env.HIGGSFIELD_API_URL) }, llm: llm.available() ? llm.MODEL : "" } }));
on("PUT", "settings", ({ body }) => { const patch = {}; if (["composite", "gemini", "higgsfield"].includes(body.imageProvider)) patch.imageProvider = body.imageProvider; if (Number.isFinite(+body.refreshHours) && +body.refreshHours >= 0 && +body.refreshHours <= 720) patch.refreshHours = +body.refreshHours; if (Number.isInteger(+body.maxPagesPerSite) && +body.maxPagesPerSite >= 1 && +body.maxPagesPerSite <= 60) patch.maxPagesPerSite = +body.maxPagesPerSite; if (typeof body.userAgent === "string" && body.userAgent.trim()) patch.userAgent = body.userAgent.trim().slice(0, 120); return { settings: saveSettings(patch) }; });
on("GET", "logs", () => ({ logs: db.logs.slice(-200).reverse() }));
const EXPORTS = { "references.csv": () => ["text/csv; charset=utf-8", exp.referencesCsv()], "products.csv": () => ["text/csv; charset=utf-8", exp.productsCsv()], "products.json": () => ["application/json; charset=utf-8", exp.productsJson()], "approved.zip": () => ["application/zip", exp.approvedZip()], "report.md": () => ["text/markdown; charset=utf-8", exp.reportMd()], "report.html": () => ["text/html; charset=utf-8", exp.reportHtml()] };

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json", ".csv": "text/csv", ".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/markdown", ".zip": "application/zip" };
const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise((resolve, reject) => { let s = "", n = 0; req.on("data", c => { n += c.length; if (n > 24e6) { reject(new HttpError(413, "Too large.")); req.destroy(); } s += c; }); req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new HttpError(400, "Invalid JSON.")); } }); req.on("error", reject); });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x"), p = url.pathname;
  res.setHeader("x-content-type-options", "nosniff"); res.setHeader("x-frame-options", "SAMEORIGIN");
  try {
    if (p.startsWith("/api/export/")) { const f = EXPORTS[p.slice(12)]; if (!f) throw new HttpError(404, "No such export."); const [type, data] = f(); res.writeHead(200, { "content-type": type, "content-disposition": `attachment; filename="${p.slice(12)}"` }); return res.end(data); }
    if (p.startsWith("/api/")) {
      const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req);
      for (const r of routes) { const m = r.method === req.method && r.re.exec(p); if (m) return send(res, 200, await r.fn({ req, body, params: m.slice(1) })); }
      throw new HttpError(404, "Not found.");
    }
    // files: generated assets, screenshots and uploads under /files, the dashboard under /
    const root = p.startsWith("/files/") ? ASSETS : path.join(__dirname, "public"), rel = p.startsWith("/files/") ? p.slice(7) : (p === "/" ? "index.html" : p.slice(1));
    const abs = path.normalize(path.join(root, decodeURIComponent(rel)));
    if (!abs.startsWith(root) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(abs).toLowerCase()] || "application/octet-stream", "cache-control": p.startsWith("/files/") ? "no-cache" : "no-store" });
    fs.createReadStream(abs).pipe(res);
  } catch (e) { const code = e instanceof HttpError ? e.code : Number.isInteger(e.code) && e.code >= 400 && e.code < 500 ? e.code : 500; if (code === 500) log("error", "request failed", { url: req.url, error: e.message }); send(res, code, { error: code === 500 ? "Something went wrong: " + e.message : e.message }); }
});
server.wait = wait; server.enqueue = enqueue;
if (require.main === module) {
  process.on("uncaughtException", e => log("error", "unexpected error, still running", { error: e.message }));
  process.on("unhandledRejection", e => log("error", "unexpected rejection, still running", { error: e && e.message }));
  server.listen(PORT, () => console.log(`Creative Intelligence Agent at http://localhost:${PORT}  (image provider: ${db.settings.imageProvider}; keys: gemini ${!!process.env.GEMINI_API_KEY}, higgsfield ${!!process.env.HIGGSFIELD_API_KEY}, language model ${llm.available()})`));
  process.on("SIGINT", async () => { await browser.close(); process.exit(0); });
}
module.exports = server;
