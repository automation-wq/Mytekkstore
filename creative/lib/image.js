// Image helpers on sharp (the copy installed for the store's build in ../web is reused, so nothing new is installed): colour
// palette of a screenshot, contrast ratio, a white-background cutout for product photos, loading a local file or a public URL.
const fs = require("fs"), path = require("path");
let sharp;
try { sharp = require("sharp"); } catch { sharp = require(require.resolve("sharp", { paths: [path.join(__dirname, "..", "..", "web")] })); }

const hex = (r, g, b) => "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
// the most frequent colours of an image (quantised to 24 levels per channel), with their share of the pixels
async function palette(buf, n = 6) {
  const { data } = await sharp(buf).resize(80, 80, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += 3) { const k = [data[i], data[i + 1], data[i + 2]].map(v => Math.round(v / 24) * 24).join(","); counts.set(k, (counts.get(k) || 0) + 1); }
  const total = data.length / 3;
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => { const [r, g, b] = k.split(",").map(Number); return { hex: hex(r, g, b), share: +(c / total).toFixed(3) }; });
}
const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };

// a product photo on a white studio background becomes a floating cutout (flood fill from the edges, soft edge), trimmed
async function cutout(buf) {
  const meta = await sharp(buf).metadata();
  if (meta.hasAlpha) { const st = await sharp(buf).stats(); if (st.channels.length === 4 && st.channels[3].min < 10) return sharp(buf).trim({ threshold: 8 }).png().toBuffer(); } // already a cutout
  const { data: px, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info, seen = new Uint8Array(width * height), stack = [];
  const light = i => px[i * channels] > 190 && px[i * channels + 1] > 190 && px[i * channels + 2] > 190;
  const push = (x, y) => { const i = y * width + x; if (!seen[i] && light(i)) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) { const i = stack.pop(), x = i % width, y = (i - x) / width; if (x > 0) push(x - 1, y); if (x < width - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < height - 1) push(x, y + 1); }
  let cleared = 0;
  for (let i = 0; i < width * height; i++) if (seen[i]) { const l = (px[i * channels] + px[i * channels + 1] + px[i * channels + 2]) / 3; px[i * channels + 3] = Math.max(0, Math.min(255, Math.round((230 - l) * 8))); cleared++; }
  if (cleared < width * height * 0.05) return null; // not a white-background photo: keep it as it is
  return sharp(px, { raw: { width, height, channels } }).trim({ threshold: 8 }).png().toBuffer();
}
async function load(src) {
  if (/^https?:/.test(src)) { const r = await fetch(src, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "MytekkstoreCreativeAgent/1.0" } }); if (!r.ok) throw new Error("Image " + src + " answered " + r.status); return Buffer.from(await r.arrayBuffer()); }
  return fs.readFileSync(src);
}
module.exports = { sharp, palette, contrast, lum, cutout, load, hex };
