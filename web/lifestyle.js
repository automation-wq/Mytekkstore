// Imports the 15 generated lifestyle photos (tools/tv-images, output/tv_lifestyle_images/tv_lifestyle_NN.png) into public/img as
// life-NN.jpg with the WebP sizes the site serves (name.webp, -960, -480), and points the slots in src/lifestyle.json at the
// pictures that exist. The site falls back to the client's three photos and the renders for any slot still empty.
// Run: npm run lifestyle   then   npm run build
import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = s => fileURLToPath(new URL(s, import.meta.url));
const src = here("../tools/tv-images/output/tv_lifestyle_images/"), dir = here("../public/img/"), json = here("./src/lifestyle.json");
// which generated picture serves which slot (the numbers are the prompt ids in tools/tv-images/prompts.json)
const SLOTS = { hero: 2, launch1: 14, launch2: 3, launch3: 6, launch4: 11, launch5: 5, size32: 7, size43: 4, size55: 8, size65: 15, size75: 13, os1: 10, os2: 12, res4k: 11, resfhd: 4, reshd: 15, room: 2, cinema: 3, studio: 1, closeup: 9, aplusHero: 14, aplusSmart: 10, aplusSound: 11, aplusDesign: 9, care: 6, category: 5 };
const pad = n => String(n).padStart(2, "0"), found = new Set();
for (let n = 1; n <= 15; n++) {
  const png = src + "tv_lifestyle_" + pad(n) + ".png";
  if (!existsSync(png)) continue;
  const base = dir + "life-" + pad(n);
  const img = sharp(png).resize({ width: 1600, withoutEnlargement: true });
  await img.clone().jpeg({ quality: 86 }).toFile(base + ".jpg");
  for (const [suffix, w] of [["", 1600], ["-960", 960], ["-480", 480]]) await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toFile(base + suffix + ".webp");
  found.add(n);
}
const map = JSON.parse(readFileSync(json, "utf8"));
for (const [slot, n] of Object.entries(SLOTS)) map[slot] = found.has(n) ? "img/life-" + pad(n) + ".jpg" : "";
writeFileSync(json, JSON.stringify(map, null, 2) + "\n");
console.log(found.size + " of 15 pictures imported; " + Object.values(map).filter(Boolean).length + " of " + Object.keys(SLOTS).length + " slots filled. Now run: npm run build");
