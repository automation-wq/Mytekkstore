// Makes floating cutouts of the product renders: the white studio background becomes transparent, so a TV can sit on a gradient
// banner or a brand tile. Writes public/img/<name>-cut.webp for every render listed. Run: npm run cutouts
// The soft studio shadow under the TV goes too (it would show as a pale glow on a dark banner); the edge fades over a small range
// so there is no hard halo. Real cutouts from the client's photographer replace these.
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../public/img/", import.meta.url));
const names = process.argv.slice(2).length ? process.argv.slice(2) : ["p0", "p1", "p2", "p3"];
for (const n of names) {
  const { data, info } = await sharp(dir + n + ".jpg").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info, px = data;
  // flood fill from the edges: only the light background (and its soft shadow) that touches the border turns transparent, so light
  // parts inside the TV stay. The bezel and the stand are dark, so the fill never gets into the screen.
  const seen = new Uint8Array(width * height), stack = [];
  const light = i => px[i * channels] > 190 && px[i * channels + 1] > 190 && px[i * channels + 2] > 190;
  const push = (x, y) => { const i = y * width + x; if (!seen[i] && light(i)) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) { const i = stack.pop(), x = i % width, y = (i - x) / width; if (x > 0) push(x - 1, y); if (x < width - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < height - 1) push(x, y + 1); }
  for (let i = 0; i < width * height; i++) if (seen[i]) {
    const lum = (px[i * channels] + px[i * channels + 1] + px[i * channels + 2]) / 3;
    px[i * channels + 3] = Math.max(0, Math.min(255, Math.round((230 - lum) * 8))); // white and the pale shadow go fully clear, grey edges fade
  }
  const out = dir + n + "-cut.webp";
  await sharp(px, { raw: { width, height, channels } }).trim({ threshold: 8 }).webp({ quality: 88, alphaQuality: 90 }).toFile(out);
  const m = await sharp(out).metadata();
  console.log(n + "-cut.webp", m.width + "x" + m.height);
}
