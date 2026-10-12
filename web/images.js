// Makes WebP copies of every photo in public/img (uploads excluded): name.webp (up to 1600 px wide), name-960.webp and name-480.webp.
// Run: npm run images   (uses the sharp dev dependency). The app picks them up through pic() and picSet() in src/data.js; the
// original .jpg files stay for sharing previews, old links and the admin page.
import sharp from "sharp";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../public/img/", import.meta.url));
let before = 0, after = 0, n = 0;
for (const f of readdirSync(dir).filter(f => /\.jpe?g$/i.test(f) && !f.startsWith("u-"))) {
  const base = dir + f.replace(/\.jpe?g$/i, ""), { width } = await sharp(dir + f).metadata();
  before += statSync(dir + f).size;
  for (const [suffix, w] of [["", Math.min(width, 1600)], ["-960", 960], ["-480", 480]]) {
    const out = base + suffix + ".webp";
    await sharp(dir + f).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toFile(out);
    if (!suffix) after += statSync(out).size;
  }
  n++;
}
console.log(`${n} photos converted. Full size: ${Math.round(before / 1024)} KB of JPEG became ${Math.round(after / 1024)} KB of WebP, plus 960 and 480 px copies for phones.`);
