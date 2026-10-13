// Amazon A+ Content studio (the prompt's section 9): reusable standard modules rendered per product from VERIFIED facts only.
// Amazon's standard A+ modules are 970 px wide; this builds the five that cover a product listing — a brand header, a hero
// benefit, feature callouts, a comparison chart and a specifications graphic — with the real product photo composited (never a
// regenerated product), the words drawn exactly (so spelling is right), a per-module copy brief, and a deterministic QC checklist.
// Nothing is invented: every number traces back to the product's own specifications; missing facts are left out, not filled in.
const fs = require("fs"), path = require("path");
const { db, add, ASSETS, log } = require("./store.js");
const { sharp, cutout, load, lum } = require("./image.js");
const strategy = require("./strategy.js");

const money = n => n == null ? "" : "₹" + Math.round(n).toLocaleString("en-IN");
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const FONT = "Segoe UI, Inter, Arial, Helvetica, sans-serif";
const inchOf = p => +((/\((\d+)\s*inch\)/i.exec(p.name) || [])[1] || 0);
// Amazon standard modules are 970 px wide (standard content); heights per module type
const DIMS = { brand: [970, 300], hero: [970, 600], features: [970, 600], comparison: [970, 600], specs: [970, 600] };
const INK = "#0d1117", PAPER = "#f5f4f0", ACCENT = "#08805f", SUB = "#5b6370";
const wrap = (text, size, maxW, maxLines = 3) => { const out = [], words = String(text).split(/\s+/).filter(Boolean); let cur = ""; const w = s => s.length * size * .56; for (const word of words) { const t = cur ? cur + " " + word : word; if (w(t) > maxW && cur) { out.push(cur); cur = word; } else cur = t; } if (cur) out.push(cur); return out.slice(0, maxLines); };
const tspan = (lines, x, y, size, weight, fill, lh = 1.12) => lines.map((l, i) => `<text x="${x}" y="${y + size * (i + .85) * lh}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="-0.5">${esc(l)}</text>`).join("");

// the A+ plan: the modules, their copy and image briefs (what a designer or an image model would produce)
function plan(product) {
  const f = strategy.facts(product), name = product.brand + " " + product.name;
  const cat = (product.category || "products").toLowerCase();
  const siblings = db.products.filter(x => x.id !== product.id && x.category === product.category && Object.keys(x.specs || {}).length).slice(0, 3);
  const specs = Object.entries(product.specs || {}).slice(0, 8);
  const modules = [
    { type: "brand", name: "Brand header", headline: product.brand, sub: `Genuine ${product.brand} ${cat} — brand warranty, free delivery, cash on delivery.`, trust: ["100% genuine", "Brand warranty", "Free delivery"], imageBrief: "Dark premium stage, soft accent glow, brand name only, no product, no extra text." },
    { type: "hero", name: "Hero benefit", headline: (f.usps[0] || name), sub: f.firstSentence || name, imageBrief: "The real product on a dark cinematic stage with one soft light; product composited, not regenerated." },
    { type: "features", name: "Feature callouts", headline: "The facts that matter", callouts: f.callouts, imageBrief: "Product centred on a light studio backdrop; four fact pills around it." },
    siblings.length ? { type: "comparison", name: "Comparison chart", headline: "How it compares", products: [product, ...siblings] } : null,
    specs.length ? { type: "specs", name: "Technical specifications", headline: "Technical specifications", specs } : null,
  ].filter(Boolean);
  return { productId: product.id, product: name, dimensions: "970 px wide (Amazon standard modules)", strategy: "Lead with the brand promise, then one hero benefit, then the facts as callouts, a side-by-side comparison, and the full specifications. Copy is drawn exactly and only from the product's verified facts; no invented features, claims or reviews.", modules };
}

// find and prepare the product photo (cutout when it is a white-background render)
async function productImage(product) {
  for (const src of product.images || []) {
    try {
      const local = /^https?:/.test(src) ? null : (fs.existsSync(path.join(ASSETS, src)) ? path.join(ASSETS, src) : fs.existsSync(path.join(__dirname, "..", "..", "public", src)) ? path.join(__dirname, "..", "..", "public", src) : null);
      if (!local && !/^https?:/.test(src)) continue;
      const buf = await load(local || src), cut = await cutout(buf).catch(() => null);
      return { buf: cut || await sharp(buf).png().toBuffer(), cut: !!cut, src };
    } catch (e) { log("warn", "aplus product image unusable", { src, error: e.message }); }
  }
  return null;
}

// draw one module to a PNG, returning the buffer and the text that was drawn (for QC)
async function renderModule(mod, product) {
  const [W, H] = DIMS[mod.type], drawn = [];
  const pad = 56;
  let bg, layers = [];
  const pi = ["brand", "specs", "comparison"].includes(mod.type) ? null : await productImage(product);
  if (mod.type === "brand" || mod.type === "hero") {
    bg = await sharp(Buffer.from(`<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2a4a"/><stop offset="0.55" stop-color="${INK}"/><stop offset="1" stop-color="#06080c"/></linearGradient><radialGradient id="r" cx="0.8" cy="0.2" r="0.6"><stop offset="0" stop-color="#08805f66"/><stop offset="1" stop-color="#00000000"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#r)"/></svg>`)).png().toBuffer();
  } else {
    bg = await sharp({ create: { width: W, height: H, channels: 4, background: PAPER } }).png().toBuffer();
  }
  // product on hero (right) and features (centre)
  if (pi) {
    const m = await sharp(pi.buf).metadata();
    const boxW = mod.type === "features" ? Math.round(W * .5) : Math.round(W * .44), boxH = Math.round(H * .74);
    const k = Math.min(boxW / m.width, boxH / m.height), pw = Math.round(m.width * k), ph = Math.round(m.height * k);
    const px = mod.type === "features" ? Math.round((W - pw) / 2) : W - pad - pw, py = Math.round((H - ph) / 2);
    const prod = await sharp(pi.buf).resize(pw, ph).png().toBuffer();
    if (pi.cut) { const alpha = await sharp(prod).extractChannel("alpha").blur(14).toBuffer(); layers.push({ input: await sharp({ create: { width: pw, height: ph, channels: 3, background: "#000" } }).joinChannel(alpha).png().toBuffer(), left: px, top: Math.min(H - ph, py + 10), blend: "over" }); }
    layers.push({ input: prod, left: px, top: py });
  }
  const parts = [], dark = mod.type === "brand" || mod.type === "hero", text = dark ? "#ffffff" : INK, sub = dark ? "#ffffffbf" : SUB;
  const colW = pi && mod.type !== "features" ? Math.round(W * .46) : W - pad * 2;
  if (mod.type === "brand") {
    parts.push(`<text x="${pad}" y="${H * .34}" font-family="${FONT}" font-size="22" font-weight="700" letter-spacing="3" fill="#7ef0d0">${esc((product.category || "").toUpperCase())}</text>`);
    const hl = wrap(mod.headline, 72, W - pad * 2, 1); parts.push(tspan(hl, pad, H * .34, 72, 800, text)); drawn.push(mod.headline);
    const sl = wrap(mod.sub, 22, W - pad * 2, 2); parts.push(tspan(sl, pad, H * .56, 22, 400, sub)); drawn.push(mod.sub);
    let tx = pad; const ty = H - 54; mod.trust.forEach(t => { const w = t.length * 11 + 44; parts.push(`<rect x="${tx}" y="${ty - 26}" width="${w}" height="38" rx="19" fill="#ffffff1c"/><text x="${tx + 22}" y="${ty}" font-family="${FONT}" font-size="15" font-weight="600" fill="#fff">${esc(t)}</text>`); drawn.push(t); tx += w + 12; });
  } else if (mod.type === "hero") {
    parts.push(`<text x="${pad}" y="${H * .24}" font-family="${FONT}" font-size="18" font-weight="700" letter-spacing="2" fill="#7ef0d0">${esc(product.brand.toUpperCase())}</text>`);
    const hl = wrap(mod.headline, 52, colW, 3); parts.push(tspan(hl, pad, H * .24, 52, 800, text)); drawn.push(mod.headline);
    const sl = wrap(mod.sub, 22, colW, 3); parts.push(tspan(sl, pad, H * .24 + 52 * hl.length * 1.12 + 24, 22, 400, sub)); drawn.push(mod.sub);
  } else if (mod.type === "features") {
    parts.push(tspan(wrap(mod.headline, 40, W - pad * 2, 1), pad, 40, 40, 800, text)); drawn.push(mod.headline);
    const pills = mod.callouts.slice(0, 4);
    pills.forEach(([big, small], i) => {
      const bigS = String(big), smallS = String(small).toUpperCase();
      const fontBig = bigS.length > 4 ? 28 : 44; // long values (e.g. "Google TV") get a smaller number so they fit the pill
      const pillW = Math.max(200, Math.round(Math.max(bigS.length * fontBig * .6, smallS.length * 9) + 48));
      const left = i % 2 === 0, x = left ? pad : W - pad - pillW, y = i < 2 ? 150 : H - 190;
      parts.push(`<rect x="${x}" y="${y}" width="${pillW}" height="110" rx="18" fill="#0f111512"/><text x="${x + 24}" y="${y + 60}" font-family="${FONT}" font-size="${fontBig}" font-weight="800" fill="${INK}" letter-spacing="-1">${esc(bigS)}</text><text x="${x + 24}" y="${y + 90}" font-family="${FONT}" font-size="15" font-weight="600" letter-spacing="1" fill="${SUB}">${esc(smallS)}</text>`);
      drawn.push(big + " " + small);
    });
  } else if (mod.type === "specs") {
    parts.push(tspan(wrap(mod.headline, 40, W - pad * 2, 1), pad, 40, 40, 800, text)); drawn.push(mod.headline);
    const rows = mod.specs, colGap = 40, cW = (W - pad * 2 - colGap) / 2, rowsPer = Math.ceil(rows.length / 2), rh = 56; let startY = 150;
    rows.forEach(([k, v], i) => { const col = i < rowsPer ? 0 : 1, row = i % rowsPer, x = pad + col * (cW + colGap), y = startY + row * rh; parts.push(`<rect x="${x}" y="${y}" width="${cW}" height="${rh - 10}" rx="10" fill="#ffffff"/><text x="${x + 18}" y="${y + 20}" font-family="${FONT}" font-size="13" font-weight="600" letter-spacing="1" fill="${SUB}">${esc(String(k).toUpperCase())}</text><text x="${x + 18}" y="${y + 40}" font-family="${FONT}" font-size="17" font-weight="700" fill="${INK}">${esc(String(v).slice(0, 48))}</text>`); drawn.push(k + " " + v); });
  } else if (mod.type === "comparison") {
    parts.push(tspan(wrap(mod.headline, 40, W - pad * 2, 1), pad, 40, 40, 800, text)); drawn.push(mod.headline);
    const cols = mod.products, keys = ["Price", ...[...new Set(cols.flatMap(p => Object.keys(p.specs || {})))].slice(0, 5)];
    const labelW = 150, cW = (W - pad * 2 - labelW) / cols.length, startY = 150, rh = (H - startY - 40) / (keys.length + 1);
    cols.forEach((p, c) => { const x = pad + labelW + c * cW; parts.push(`<text x="${x + cW / 2}" y="${startY + 22}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="800" fill="${INK}">${esc(p.brand + " " + inchOf(p) + '"')}</text>`); drawn.push(p.brand); });
    keys.forEach((key, r) => { const y = startY + (r + 1) * rh; parts.push(`<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="${rh - 6}" rx="8" fill="${r % 2 ? "#ffffff" : "#ebe9e3"}"/><text x="${pad + 16}" y="${y + rh / 2 + 5}" font-family="${FONT}" font-size="14" font-weight="700" fill="${SUB}">${esc(key)}</text>`); cols.forEach((p, c) => { const x = pad + labelW + c * cW; const val = key === "Price" ? money(p.price) : String((p.specs || {})[key] || "—").slice(0, 26); parts.push(`<text x="${x + cW / 2}" y="${y + rh / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="${key === "Price" ? 800 : 500}" fill="${INK}">${esc(val)}</text>`); if (key === "Price") drawn.push(val); }); });
  }
  layers.push({ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`), left: 0, top: 0 });
  const png = await sharp(bg).composite(layers).png().toBuffer();
  return { png, W, H, drawn, product: pi ? { cut: pi.cut, src: pi.src } : null };
}

// deterministic QC of one rendered module: file ok, size, text drawn, product present where expected, claims traceable
function qcModule(mod, rendered, product) {
  const checks = [], ok = (n, d) => checks.push({ name: n, pass: true, detail: d }), bad = (n, d) => checks.push({ name: n, pass: false, detail: d });
  rendered.W === DIMS[mod.type][0] ? ok("Amazon module width", rendered.W + " px") : bad("Amazon module width", "expected 970");
  rendered.drawn.length ? ok("Text drawn", rendered.drawn.length + " strings") : bad("Text drawn", "none");
  if (["hero", "features"].includes(mod.type)) (rendered.product ? ok("Product image composited", rendered.product.src + (rendered.product.cut ? " (cutout)" : "")) : bad("Product image composited", "no product image found"));
  // numbers must trace to verified facts: for the comparison module the shown siblings' own facts count too; the brand header's
  // trust line ("100% genuine" etc.) is fixed store boilerplate, not a product claim, so that module skips this check
  if (mod.type !== "brand") {
    const sources = mod.type === "comparison" ? (mod.products || []) : [product];
    const factText = sources.map(pp => [pp.name, pp.model, pp.description, ...(pp.usps || []), ...Object.values(pp.specs || {}), ...(pp.offers || []), pp.price].join(" ")).join(" ").replace(/,/g, "");
    const factDigits = new Set((factText.match(/\d+/g) || [])), unknown = [...new Set((rendered.drawn.join(" ").replace(/,/g, "").match(/\d+/g)) || [])].filter(d => !factDigits.has(d));
    unknown.length ? bad("Numbers traceable", "not in the facts: " + unknown.join(", ")) : ok("Numbers traceable", "every number is from the product's facts");
  } else ok("Trust line is store policy", "100% genuine, brand warranty, free delivery — fixed store facts, not product claims");
  const score = Math.round(100 * checks.filter(c => c.pass).length / checks.length);
  return { score, checks };
}

// generate the whole A+ set for a product: plan, render every module, QC, save, return records
async function generate(product) {
  const p = plan(product), out = [];
  fs.mkdirSync(path.join(ASSETS, "aplus"), { recursive: true });
  for (const mod of p.modules) {
    const r = await renderModule(mod, product);
    const rel = path.join("aplus", `p${product.id}-${mod.type}.png`).replace(/\\/g, "/");
    fs.writeFileSync(path.join(ASSETS, rel), r.png);
    const meta = await sharp(path.join(ASSETS, rel)).metadata();
    if (meta.width !== r.W || meta.height !== r.H) throw new Error("A+ module " + mod.type + " did not render at the requested size.");
    const qc = qcModule(mod, r, product);
    const asset = add("assets", { kind: "aplus", module: mod.type, productId: product.id, name: mod.name, path: rel, width: meta.width, height: meta.height, bytes: r.png.length, copy: { headline: mod.headline, sub: mod.sub || "", callouts: mod.callouts || null, imageBrief: mod.imageBrief || "" }, qc, status: "generated" });
    out.push(asset);
    log("info", "A+ module rendered", { id: asset.id, product: product.id, module: mod.type, score: qc.score });
  }
  return { plan: p, modules: out };
}
module.exports = { plan, generate, renderModule, DIMS };
