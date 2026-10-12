// Exports: the reference inventory as CSV, products as CSV or JSON, the approved assets as a ZIP (stored entries, CRC32, no
// dependency), and the creative strategy report as Markdown or a simple HTML page. Every row carries the ids that tie a
// product, a reference, a concept, an asset and its quality report together.
const fs = require("fs"), path = require("path");
const { db, ASSETS } = require("./store.js");

const cell = v => { const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (head, rows) => [head.join(","), ...rows.map(r => r.map(cell).join(","))].join("\r\n");
function referencesCsv() {
  return csv(["id", "brand", "pageType", "sourceUrl", "imageUrl", "imagePath", "collectedAt", "category", "productName", "model", "headline", "copy", "price", "offers", "benefits", "palette", "headlineFont", "cta", "imageWidth", "imageHeight", "ratio", "analysisId", "objectiveHypothesis", "broken"],
    db.references.map(r => { const a = db.analyses.filter(x => x.referenceId === r.id).pop(); const f = r.facts; return [r.id, r.brand, r.pageType, r.sourceUrl, f.imageUrl, r.imagePath, r.collectedAt, f.category, f.productName, f.model, f.headline, f.copy, f.price, f.offers, f.benefits, (f.palette || []).map(c => c.hex), f.typography && f.typography.headline ? `${f.typography.headline.family} ${f.typography.headline.size}px ${f.typography.headline.weight}` : "", f.cta, f.imageDims ? f.imageDims.w : "", f.imageDims ? f.imageDims.h : "", f.imageDims ? f.imageDims.ratio : "", a ? a.id : "", a ? a.hypotheses[0] : "", r.broken]; }));
}
const productsCsv = () => csv(["id", "brand", "name", "model", "category", "price", "usps", "specs", "warranty", "images", "url", "source", "verifiedAt", "conflicts"], db.products.map(p => [p.id, p.brand, p.name, p.model, p.category, p.price, p.usps, p.specs, p.warranty, p.images, p.url, p.source, p.verifiedAt, p.conflicts]));
const productsJson = () => JSON.stringify(db.products, null, 1);

// ZIP, stored method: local headers + central directory; CRC32 table built once
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) { // [{ name, data: Buffer }]
  const parts = [], central = []; let offset = 0;
  const dos = (() => { const d = new Date(); return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; })();
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"), data = f.data, crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8); local.writeUInt16LE(dos.time, 10); local.writeUInt16LE(dos.date, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10); c.writeUInt16LE(dos.time, 12); c.writeUInt16LE(dos.date, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt16LE(0, 30); c.writeUInt16LE(0, 32); c.writeUInt16LE(0, 34); c.writeUInt16LE(0, 36); c.writeUInt32LE(0, 38); c.writeUInt32LE(offset, 42);
    central.push(c, name); offset += local.length + name.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cd, end]);
}
function approvedZip() {
  const files = db.assets.filter(a => a.status === "approved").map(a => { const abs = path.join(ASSETS, a.path); return fs.existsSync(abs) ? { name: `asset-${a.id}-concept-${a.conceptId}-product-${a.productId}-v${a.version}.png`, data: fs.readFileSync(abs) } : null; }).filter(Boolean);
  files.push({ name: "manifest.json", data: Buffer.from(JSON.stringify(db.assets.filter(a => a.status === "approved").map(a => ({ assetId: a.id, conceptId: a.conceptId, productId: a.productId, referenceId: a.referenceId, version: a.version, width: a.width, height: a.height, provider: a.provider, qcId: (db.qc.filter(q => q.assetId === a.id).pop() || {}).id || null })), null, 1)) });
  return zip(files);
}
function reportMd() {
  const L = [`# Creative strategy report`, ``, `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} by the Creative Intelligence Agent. Observed facts are separated from interpretation; performance statements are hypotheses unless data was supplied.`, ``,
    `## Library`, `- References: ${db.references.length} from ${db.websites.length} website(s); analysed: ${db.analyses.length}`, `- Products: ${db.products.length}; concepts: ${db.concepts.length}; assets: ${db.assets.length} (approved ${db.assets.filter(a => a.status === "approved").length})`, ``];
  for (const p of db.products) {
    L.push(`## ${p.brand} ${p.name}${p.model ? " (" + p.model + ")" : ""}`, `Source: ${p.source}${p.url ? " — " + p.url : ""}${p.verifiedAt ? " (verified " + p.verifiedAt.slice(0, 10) + ")" : ""}`, p.conflicts && p.conflicts.length ? `Conflicts to review: ${p.conflicts.map(c => c.field + " " + c.values.join(" vs ")).join("; ")}` : "", ``);
    for (const c of db.concepts.filter(c => c.productId === p.id)) {
      L.push(`### ${c.priority ? c.priority + ". " : ""}${c.name}`, `- Objective: ${c.objective} · Placement: ${c.placement} · ${c.ratio} (${c.width}×${c.height})`, `- Headline: **${c.headline}**`, `- Supporting: ${c.supporting}`, `- USP: ${c.usp}`, `- Visual: ${c.visual}`, `- Background: ${c.background}`, `- Typography: ${c.typography}`, `- Palette: ${(c.palette || []).join(", ")}`, `- Callouts: ${(c.callouts || []).map(x => x.join(" ")).join(", ") || "none"}`, `- CTA: ${c.cta || "none"}`, `- Prompt: ${c.prompt}`, `- Negative: ${c.negative}`, `- References: ${(c.references || []).map(id => { const r = db.references.find(x => x.id === id); return r ? `#${id} ${r.brand} ${r.sourceUrl}` : "#" + id; }).join("; ") || "none"}`, `- Difference: ${c.difference}`, `- Why this order: ${c.reason || ""}`);
      for (const a of db.assets.filter(a => a.conceptId === c.id)) { const q = db.qc.filter(q => q.assetId === a.id).pop(); L.push(`- Asset #${a.id} v${a.version} (${a.provider}, ${a.width}×${a.height}): ${a.status}${q ? `, QC ${q.score}/100${q.issues.length ? ": " + q.issues.join(" | ") : ""}` : ", not checked"} — ${a.path}`); }
      L.push(``);
    }
  }
  L.push(`## References`, ``, ...db.references.map(r => { const a = db.analyses.filter(x => x.referenceId === r.id).pop(); return `- #${r.id} ${r.brand} · ${r.pageType} · ${r.sourceUrl}${a ? ` — ${a.facts.format}; ${a.patterns[0] || ""}` : ""}`; }));
  return L.join("\n");
}
const reportHtml = () => `<!doctype html><meta charset="utf-8"><title>Creative strategy report</title><style>body{font:15px/1.5 Segoe UI,Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#0f1115}h1,h2,h3{letter-spacing:-.5px}li{margin:3px 0}code{background:#f1f3f5;padding:1px 4px}</style><body>${reportMd().split("\n").map(l => /^### /.test(l) ? `<h3>${esc(l.slice(4))}</h3>` : /^## /.test(l) ? `<h2>${esc(l.slice(3))}</h2>` : /^# /.test(l) ? `<h1>${esc(l.slice(2))}</h1>` : /^- /.test(l) ? `<li>${esc(l.slice(2)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</li>` : l ? `<p>${esc(l)}</p>` : "").join("\n")}</body>`;
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
module.exports = { referencesCsv, productsCsv, productsJson, approvedZip, reportMd, reportHtml, zip, crc32 };
