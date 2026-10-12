// Image generation behind a provider interface. Every provider ends in the same place: the REAL product photo composited onto
// a background, with the words drawn by a programmatic text layer (so spelling, placement and product fidelity are exact).
//   composite   no key needed: a gradient or lifestyle backdrop rendered here
//   gemini      GEMINI_API_KEY: the backdrop scene comes from Google's image model (prompt = the concept's scene prompt)
//   higgsfield  HIGGSFIELD_API_KEY and HIGGSFIELD_API_URL: the backdrop from Higgsfield's HTTP API (documented adapter)
// Nothing is marked generated until the file exists on disk and reads back with the expected size.
const fs = require("fs"), path = require("path");
const { db, add, ASSETS, log } = require("./store.js");
const { sharp, cutout, load, lum } = require("./image.js");

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const FONT = "Segoe UI, Inter, Arial, Helvetica, sans-serif";
// word wrap by an average glyph width (0.56 em for a heavy sans): good enough for a layout record and a clean render
function wrap(text, size, maxW, maxLines = 4) { const lines = [], words = String(text).split(/\s+/).filter(Boolean); let cur = ""; const w = s => s.length * size * .56;
  for (const word of words) { const t = cur ? cur + " " + word : word; if (w(t) > maxW && cur) { lines.push(cur); cur = word; } else cur = t; }
  if (cur) lines.push(cur); return lines.slice(0, maxLines); }

// find the product photo: a local upload, a store photo ("img/p1.jpg" lives in ../public/img), or a public URL
async function productImage(product) {
  for (const src of product.images || []) {
    try {
      const local = /^https?:/.test(src) ? null : (fs.existsSync(path.join(ASSETS, src)) ? path.join(ASSETS, src) : fs.existsSync(path.join(__dirname, "..", "..", "public", src)) ? path.join(__dirname, "..", "..", "public", src) : null);
      if (!local && !/^https?:/.test(src)) continue;
      const buf = await load(local || src);
      const cut = await cutout(buf).catch(() => null);
      return { buf: cut || await sharp(buf).png().toBuffer(), cut: !!cut, src };
    } catch (e) { log("warn", "product image unusable", { src, error: e.message }); }
  }
  return null;
}
async function backdrop(concept, W, H, provider, product) {
  const [c0, c1] = concept.palette, stage = concept.stage || "dark";
  if (provider === "gemini") return geminiBackdrop(concept, W, H);
  if (provider === "higgsfield") return higgsfieldBackdrop(concept, W, H);
  // composite: a lifestyle photo for the lifestyle approach when the store has one, otherwise a two-stop gradient with a soft glow
  const room = concept.approach === "lifestyle-led" && [path.join(__dirname, "..", "..", "public", "img", "hero0.jpg"), path.join(__dirname, "..", "..", "public", "img", "kv-tv.jpg")].find(fs.existsSync);
  if (room) { const img = await sharp(room).resize(W, H, { fit: "cover", position: "centre" }).toBuffer(); return sharp(img).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0d1117" opacity="0.55"/></svg>`), blend: "over" }]).png().toBuffer(); }
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient><radialGradient id="r" cx="0.75" cy="0.35" r="0.5"><stop offset="0" stop-color="${concept.palette[3] || "#ffffff"}" stop-opacity="${stage === "dark" ? .28 : .35}"/><stop offset="1" stop-color="${c0}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#r)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function geminiBackdrop(concept, W, H) {
  const key = process.env.GEMINI_API_KEY; if (!key) throw new Error("Gemini is not configured: set GEMINI_API_KEY (Google AI Studio, free tier) or switch the provider to composite.");
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: concept.prompt + ` Aspect ratio ${concept.ratio}. ` + "Avoid: " + concept.negative }] }], generationConfig: { responseModalities: ["IMAGE"] } }), signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error("Gemini answered " + r.status + ": " + (await r.text()).slice(0, 200));
  const j = await r.json(), part = (((j.candidates || [])[0] || {}).content || {}).parts || [], img = part.find(p => p.inlineData && p.inlineData.data);
  if (!img) throw new Error("Gemini returned no image (" + JSON.stringify(j).slice(0, 200) + ").");
  return sharp(Buffer.from(img.inlineData.data, "base64")).resize(W, H, { fit: "cover" }).png().toBuffer();
}
async function higgsfieldBackdrop(concept, W, H) {
  const key = process.env.HIGGSFIELD_API_KEY, url = process.env.HIGGSFIELD_API_URL;
  if (!key || !url) throw new Error("Higgsfield is not configured: set HIGGSFIELD_API_KEY and HIGGSFIELD_API_URL (the text-to-image endpoint from your Higgsfield account) or switch the provider to composite.");
  // documented contract: POST {prompt, negative, width, height} with a bearer key -> {url} or {image: base64}
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + key }, body: JSON.stringify({ prompt: concept.prompt, negative: concept.negative, width: W, height: H }), signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error("Higgsfield answered " + r.status + ".");
  const j = await r.json(), buf = j.image ? Buffer.from(j.image, "base64") : j.url ? await load(j.url) : null;
  if (!buf) throw new Error("Higgsfield returned no image.");
  return sharp(buf).resize(W, H, { fit: "cover" }).png().toBuffer();
}

// the composition: backdrop, product (with a soft shadow), words and callouts; returns the PNG and the layout it drew
async function compose(concept, product, { width, height, provider, instructions } = {}) {
  const W = width || concept.width, H = height || concept.height, dark = (concept.stage || "dark") === "dark" && !/^light/.test(concept.stage || "");
  const textCol = lum(concept.palette[0]) < .5 ? "#ffffff" : "#0f1115", subCol = lum(concept.palette[0]) < .5 ? "#ffffffcc" : "#3c434d", accent = concept.palette[3] || "#08805f";
  const bg = await backdrop(concept, W, H, provider, product);
  const layers = [], layout = { canvas: { w: W, h: H }, colours: { text: textCol, background: concept.palette[0], accent }, text: [] };
  const pi = await productImage(product);
  const centred = /minimalist|specification|problem/.test(concept.approach), pad = Math.round(W * .06);
  // product box: right half (or centre), keeping its aspect
  let pbox = null;
  if (pi) {
    const m = await sharp(pi.buf).metadata(), boxW = centred ? Math.round(W * .62) : Math.round(W * .46), boxH = Math.round(H * (centred ? .5 : .62));
    const k = Math.min(boxW / m.width, boxH / m.height), pw = Math.round(m.width * k), ph = Math.round(m.height * k);
    const px = centred ? Math.round((W - pw) / 2) : W - pad - pw, py = centred ? Math.round(H * .08) : Math.round((H - ph) / 2);
    const prod = await sharp(pi.buf).resize(pw, ph).png().toBuffer();
    if (pi.cut) { // a soft shadow: the cutout's own silhouette, blurred, a little lower
      const alpha = await sharp(prod).extractChannel("alpha").blur(Math.max(10, W / 80)).toBuffer();
      const shadow = await sharp({ create: { width: pw, height: ph, channels: 3, background: "#000000" } }).joinChannel(alpha).png().toBuffer();
      layers.push({ input: shadow, left: px, top: Math.min(H - ph, py + Math.round(ph * .06)), blend: "over" });
    }
    layers.push({ input: prod, left: px, top: py });
    pbox = { x: px, y: py, w: pw, h: ph, cut: pi.cut, src: pi.src };
  }
  // words: kicker, headline, supporting, callouts, button
  const textW = centred ? W - pad * 2 : Math.round(W * .46), tx = pad, hs = Math.round(Math.min(W, H) * (centred ? .07 : .075)), bs = Math.round(hs * .34);
  const headLines = wrap(concept.headline, hs, textW, 3), supLines = wrap(concept.supporting, bs, textW, 2);
  const blockH = hs * 1.08 * headLines.length + (supLines.length ? bs * 1.5 * supLines.length + bs : 0) + (concept.cta ? bs * 3.2 : 0) + bs * 2.2;
  let y = centred ? (pbox ? pbox.y + pbox.h + Math.round(H * .06) : Math.round(H * .3)) : Math.round((H - blockH) / 2);
  const parts = [];
  const kick = product.brand + (concept.approach === "offer-led" ? "" : " · " + (product.model || product.category || "").slice(0, 24)).replace(/ · $/, "");
  parts.push(`<text x="${tx}" y="${y}" font-family="${FONT}" font-size="${bs}" font-weight="700" letter-spacing="2" fill="${subCol}">${esc(kick.toUpperCase())}</text>`); layout.text.push({ kind: "kicker", text: kick, x: tx, y: y - bs, w: textW, h: bs * 1.2 }); y += bs * 2.2;
  const hy = y;
  headLines.forEach((l, i) => { parts.push(`<text x="${tx}" y="${y + hs * (i + .85)}" font-family="${FONT}" font-size="${hs}" font-weight="800" letter-spacing="-1.5" fill="${textCol}">${esc(l)}</text>`); });
  y += hs * 1.08 * headLines.length; layout.text.push({ kind: "headline", text: concept.headline, lines: headLines, x: tx, y: hy, w: textW, h: y - hy, size: hs, colour: textCol });
  if (supLines.length) { const sy = y + bs; supLines.forEach((l, i) => parts.push(`<text x="${tx}" y="${sy + bs * (i + .9) * 1.4}" font-family="${FONT}" font-size="${bs}" font-weight="400" fill="${subCol}">${esc(l)}</text>`)); layout.text.push({ kind: "supporting", text: concept.supporting, x: tx, y: sy, w: textW, h: bs * 1.5 * supLines.length, size: bs, colour: subCol }); y = sy + bs * 1.5 * supLines.length; }
  if ((concept.callouts || []).length && !centred) { // fact pills, wrapping to a second row inside the text column so they never run under the product
    let cy = y + bs * 1.2, cx = tx;
    concept.callouts.slice(0, 4).forEach(([big, small]) => { const w = Math.max(big.length * .75, small.length * .62) * bs + bs * 1.6; if (cx + w > tx + textW && cx > tx) { cx = tx; cy += bs * 3.5; }
      parts.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${bs * 3}" rx="${bs * .7}" fill="${dark ? "#ffffff22" : "#0f111510"}"/><text x="${cx + bs * .8}" y="${cy + bs * 1.5}" font-family="${FONT}" font-size="${bs * 1.3}" font-weight="800" fill="${textCol}">${esc(big)}</text><text x="${cx + bs * .8}" y="${cy + bs * 2.5}" font-family="${FONT}" font-size="${bs * .7}" font-weight="600" letter-spacing="1" fill="${subCol}">${esc(small.toUpperCase())}</text>`);
      layout.text.push({ kind: "callout", text: big + " " + small, x: cx, y: cy, w, h: bs * 3 }); cx += w + bs * .6; });
    y = cy + bs * 3; }
  if (concept.cta) { const by = y + bs * 1.4, bw = concept.cta.length * bs * .62 + bs * 2.6, bh = bs * 2.6; parts.push(`<rect x="${tx}" y="${by}" width="${bw}" height="${bh}" rx="${bh / 2}" fill="${dark ? "#ffffff" : accent}"/><text x="${tx + bs * 1.3}" y="${by + bh * .66}" font-family="${FONT}" font-size="${bs}" font-weight="700" fill="${dark ? "#0f1115" : "#ffffff"}">${esc(concept.cta)}</text>`); layout.text.push({ kind: "cta", text: concept.cta, x: tx, y: by, w: bw, h: bh, colour: dark ? "#0f1115" : "#ffffff", background: dark ? "#ffffff" : accent }); }
  if (instructions) layout.instructions = String(instructions).slice(0, 300);
  layers.push({ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`), left: 0, top: 0 });
  const png = await sharp(bg).composite(layers).png().toBuffer();
  layout.product = pbox;
  return { png, layout };
}

// generate one version for a concept, save it, verify it, record it
async function generate(concept, product, opts = {}) {
  const provider = opts.provider || db.settings.imageProvider || "composite";
  const { png, layout } = await compose(concept, product, { ...opts, provider });
  const version = db.assets.filter(a => a.conceptId === concept.id).length + 1;
  const rel = path.join("gen", `c${concept.id}-v${version}.png`).replace(/\\/g, "/"), abs = path.join(ASSETS, rel);
  fs.writeFileSync(abs, png);
  const m = await sharp(abs).metadata(); // verified: the file is on disk and reads back
  if (m.width !== layout.canvas.w || m.height !== layout.canvas.h) throw new Error("The output file does not have the requested size.");
  const asset = add("assets", { conceptId: concept.id, productId: product.id, version, path: rel, width: m.width, height: m.height, format: m.format, bytes: png.length, provider, prompt: concept.prompt, negative: concept.negative, instructions: opts.instructions || "", layout, status: "generated", referenceId: (concept.references || [])[0] || null });
  log("info", "asset generated", { id: asset.id, concept: concept.id, provider, path: rel });
  return asset;
}
module.exports = { generate, compose, productImage };
