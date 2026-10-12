// Product information: from an official product page (its Product structured data, specification table and warranty line),
// from a CSV or JSON file the user uploads, or typed by hand. Nothing is invented: a field that is not on the source stays
// empty, and when two sources disagree (structured data vs page text) the conflict is recorded for review.
const { visit } = require("./browser.js");

const bad = m => Object.assign(new Error(m), { code: 400 }); // a user error, answered as 400 by the server
const num = s => { const m = /[\d,]+(?:\.\d+)?/.exec(String(s || "")); return m ? +m[0].replace(/,/g, "") : null; };
async function fromUrl(url) {
  const obs = await visit(url, { screenshot: false });
  const ld = (obs.ld || []).flatMap(x => Array.isArray(x) ? x : x && Array.isArray(x["@graph"]) ? x["@graph"] : [x]).filter(x => x && typeof x === "object"), prod = ld.find(x => x["@type"] === "Product");
  if (!prod) throw bad("No Product structured data on that page. Add the product by hand or import a file instead.");
  const offer = Array.isArray(prod.offers) ? prod.offers[0] || {} : prod.offers || {};
  const ldPrice = num(offer.price), textPrice = num(obs.prices[0]);
  const conflicts = [];
  if (ldPrice && textPrice && Math.abs(ldPrice - textPrice) > 1) conflicts.push({ field: "price", values: [ldPrice, textPrice], note: "structured data and page text differ; review before use" });
  const warranty = (obs.copy.match(/[^.]*\bwarranty\b[^.]*\./i) || [""])[0].trim().slice(0, 300);
  const specs = obs.specs;
  const pick = (...keys) => { const k = Object.keys(specs).find(x => keys.some(y => x.toLowerCase().includes(y))); return k ? specs[k] : ""; };
  return clean({
    brand: prod.brand ? (prod.brand.name || prod.brand) : "", name: prod.name || obs.title, model: prod.sku || prod.mpn || prod.model || "", category: prod.category || "", subcategory: "",
    description: (prod.description || obs.description || "").slice(0, 2000), usps: obs.heads.filter(h => h.tag !== "h1" && h.text.length < 70).slice(0, 6).map(h => h.text), specs,
    dims: pick("dimension"), weight: pick("weight"), colours: [].concat(prod.color || []), materials: pick("material"), capacity: pick("capacity"), accessories: [], warranty,
    price: ldPrice || textPrice || null, offers: obs.offers, images: [].concat(prod.image || []).map(i => typeof i === "string" ? i : i && i.url).filter(Boolean).slice(0, 8),
    url, source: "official page: Product structured data" + (textPrice ? " and page text" : ""), verifiedAt: new Date().toISOString(), conflicts,
  });
}
// a CSV with a header row (brand,name,model,category,price,description,usps,specs,images,warranty,url; usps and images split on ";",
// specs as "key: value; key: value") or a JSON array of product objects
function fromRows(text) {
  const t = String(text || "").trim();
  if (t.startsWith("[")) return JSON.parse(t).map(clean);
  const rows = csv(t); if (rows.length < 2) throw bad("The file needs a header row and at least one product.");
  const head = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).filter(r => r.some(Boolean)).map(r => { const o = Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()]));
    return clean({ ...o, price: num(o.price), usps: (o.usps || "").split(";").map(s => s.trim()).filter(Boolean), images: (o.images || "").split(";").map(s => s.trim()).filter(Boolean),
      specs: Object.fromEntries((o.specs || "").split(";").map(s => s.split(/:(.*)/s).map(x => (x || "").trim())).filter(([k, v]) => k && v)), source: "uploaded file", verifiedAt: "" }); });
}
function csv(t) { const out = [], row = [], cur = []; let q = false; let cell = ""; let rows = [], r = [];
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { r.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; r.push(cell); rows.push(r); r = []; cell = ""; } else cell += c; }
  r.push(cell); rows.push(r); return rows; }
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
function clean(p) {
  const brand = str(p.brand, 60), name = str(p.name, 160);
  if (!brand || !name) throw bad("A product needs a brand and a name.");
  const specs = p.specs && typeof p.specs === "object" && !Array.isArray(p.specs) ? Object.fromEntries(Object.entries(p.specs).slice(0, 80).map(([k, v]) => [str(k, 60), str(v, 200)]).filter(([k, v]) => k && v)) : {};
  return { brand, name, model: str(p.model, 60), category: str(p.category, 60), subcategory: str(p.subcategory, 60), description: str(p.description, 2000), usps: [].concat(p.usps || []).map(s => str(s, 120)).filter(Boolean).slice(0, 8),
    specs, dims: str(p.dims, 120), weight: str(p.weight, 60), colours: [].concat(p.colours || p.colors || []).map(s => str(s, 40)).filter(Boolean), materials: str(p.materials, 120), capacity: str(p.capacity, 60), accessories: [].concat(p.accessories || []).map(s => str(s, 80)).filter(Boolean),
    warranty: str(p.warranty, 300), price: p.price == null || p.price === "" ? null : (Number.isFinite(+p.price) ? +p.price : null), offers: [].concat(p.offers || []).map(s => str(s, 120)).filter(Boolean), images: [].concat(p.images || []).map(s => str(s, 400)).filter(Boolean).slice(0, 12),
    url: str(p.url, 400), source: str(p.source, 120) || "typed by hand", verifiedAt: str(p.verifiedAt, 40), conflicts: Array.isArray(p.conflicts) ? p.conflicts.slice(0, 10) : [], uploads: Array.isArray(p.uploads) ? p.uploads : [], guidelines: str(p.guidelines, 4000) };
}
module.exports = { fromUrl, fromRows, clean };
