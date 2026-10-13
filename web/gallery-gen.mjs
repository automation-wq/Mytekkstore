// Builds the product gallery images from the real renders (run from web/ so sharp resolves):
//  1. distinct listing photos for models that shared a render: img/p<base>-v<k>.jpg (screen art re-coloured, TV untouched)
//  2. per render: img/g/<name>-studio.webp (cutout on a dark stage), -screen.webp (screen detail crop), -stand.webp (stand detail crop)
import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
const dir = "../public/img/", g = dir + "g/";
mkdirSync(g, { recursive: true });
const variants = { "p0-v1": ["p0", 60], "p0-v2": ["p0", 300], "p2-v1": ["p2", 150], "p1-v1": ["p1", 200], "p3-v1": ["p3", 100] };
for (const [name, [base, hue]] of Object.entries(variants)) {
  await sharp(dir + base + ".jpg").modulate({ hue, saturation: 1.05 }).jpeg({ quality: 90 }).toFile(dir + name + ".jpg");
  console.log("variant", name);
}
const names = ["p0", "p1", "p2", "p3", "p34", ...Object.keys(variants)];
const stage = (w, h, c) => Buffer.from(`<svg width="${w}" height="${h}"><defs><radialGradient id="r" cx="50%" cy="28%" r="75%"><stop offset="0" stop-color="${c[0]}"/><stop offset=".6" stop-color="${c[1]}"/><stop offset="1" stop-color="#0d1117"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#r)"/></svg>`);
const cols = [["#2a3550", "#121826"], ["#2a4a3f", "#10231d"], ["#3b2f6a", "#1a1836"], ["#4a2a3a", "#23101a"]];
export const gallery = {};
for (const [i, n] of names.entries()) {
  const src = dir + n + ".jpg", cut = dir + n + "-cut.webp", k = (await sharp(src).metadata()).width / 800; // crop boxes were drawn on the 800 px renders
  const box = (left, top) => ({ left: Math.round(left * k), top: Math.round(top * k), width: Math.round(400 * k), height: Math.round(300 * k) });
  // screen detail: the middle of the render, where the panel is; stand detail: the bottom middle (bottom bezel + stand)
  await sharp(src).extract(box(200, 190)).resize(1200, 900).webp({ quality: 82 }).toFile(g + n + "-screen.webp");
  await sharp(src).extract(box(200, 430)).resize(1200, 900).webp({ quality: 82 }).toFile(g + n + "-stand.webp");
  if (!existsSync(cut)) { console.log("no cutout yet for", n); continue; }
  const tv = await sharp(cut).resize({ width: 900, withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
  const shadow = await sharp(tv.data).ensureAlpha().linear([0, 0, 0, 1], [0, 0, 0, 0]).blur(28).toBuffer(); // black silhouette, blurred
  const left = Math.round((1200 - tv.info.width) / 2), top = Math.round((900 - tv.info.height) / 2) - 20;
  await sharp(stage(1200, 900, cols[i % cols.length])).composite([{ input: shadow, left: left + 10, top: top + 60, blend: "over" }, { input: tv.data, left, top }]).webp({ quality: 84 }).toFile(g + n + "-studio.webp");
  console.log("gallery", n);
}
