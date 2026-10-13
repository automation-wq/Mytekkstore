// Builds 15 distinct cinematic TV scenes from the prompts in tools/tv-images/prompts.json, with code only (no API, no key, no
// credits): each scene is a 16:9 backdrop whose palette echoes its prompt (white studio, warm living room, cinematic dark, ...),
// with one of the product renders composited as a floating TV, a coloured glow behind it, a soft floor reflection and a vignette.
// Writes tools/tv-images/output/tv_lifestyle_images/tv_lifestyle_NN.png; then `npm run lifestyle` imports them into the site slots.
// These are stylised, not photoreal rooms — real photography still comes from the client. Run: node scenes.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const img = s => fileURLToPath(new URL("../public/img/" + s, import.meta.url));
const out = fileURLToPath(new URL("../tools/tv-images/output/tv_lifestyle_images/", import.meta.url));
mkdirSync(out, { recursive: true });

const W = 1536, H = 864;
// id: [prompt title], c1/c2: backdrop radial (centre→edge), glow: accent behind the TV, tv: render cutout, light: a bright scene
const SCENES = [
  [1,  "White studio",        "#eef1f5", "#cdd5de", "#dfe6ee", "p0",    true],
  [2,  "Warm living room",    "#5a3d27", "#180f08", "#e0a259", "p3",    false],
  [3,  "Cinematic dark",      "#2c1013", "#070405", "#ff5a2a", "p3-v1", false],
  [4,  "Scandinavian",        "#e7ebe4", "#c2cabf", "#a9c4a3", "p2",    true],
  [5,  "Modern penthouse",    "#3b4654", "#0f141b", "#7098c6", "p1",    false],
  [6,  "Dark architectural",  "#2b2f37", "#090b0e", "#c79a54", "p0-v2", false],
  [7,  "Rainy evening",       "#39321f", "#0e0d08", "#e4b668", "p2-v1", false],
  [8,  "Mediterranean",       "#e6e1d2", "#bcc4cb", "#45a7cf", "p1-v1", true],
  [9,  "Bezel close-up",      "#1b1533", "#060409", "#6a4bff", "p0-v1", false],
  [10, "Japandi",             "#e3d7c6", "#b3a488", "#cbb892", "p2",    true],
  [11, "Home cinema",         "#182230", "#05080c", "#3a6ff0", "p1",    false],
  [12, "Golden-hour desert",  "#9c7334", "#231808", "#f2bc4d", "p2-v1", false],
  [13, "Botanical",           "#284a1d", "#0b1908", "#73c44d", "p3",    false],
  [14, "Dramatic hero",       "#1b2030", "#05070c", "#4f7dff", "p0",    false],
  [15, "Winter mountain",     "#ccd6de", "#95a4b1", "#7ea2c3", "p3-v1", true],
];

const bg = (c1, c2, glow) => Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>` +
  `<radialGradient id="b" cx="50%" cy="34%" r="82%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>` +
  `<radialGradient id="g" cx="50%" cy="40%" r="42%"><stop offset="0" stop-color="${glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>` +
  `</defs><rect width="100%" height="100%" fill="url(#b)"/><rect width="100%" height="100%" fill="url(#g)"/></svg>`);

const vignette = light => Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>` +
  `<radialGradient id="v" cx="50%" cy="46%" r="72%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${light ? 0.12 : 0.5}"/></radialGradient>` +
  `</defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`);

for (const [id, title, c1, c2, glow, tv, light] of SCENES) {
  const tvBuf = await sharp(img(tv + "-cut.webp")).resize({ width: Math.round(W * 0.6), withoutEnlargement: false }).toBuffer({ resolveWithObject: true });
  const { width: tw, height: th } = tvBuf.info;
  const left = Math.round((W - tw) / 2), top = Math.round(H * 0.4 - th / 2);
  // soft floor reflection: the TV flipped, faded top-to-bottom
  const refl = await sharp(tvBuf.data).flip().composite([{ input: Buffer.from(
    `<svg width="${tw}" height="${th}"><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.2"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/></linearGradient><rect width="100%" height="100%" fill="url(#m)"/></svg>`),
    blend: "dest-in" }]).png().toBuffer();
  const layers = [
    { input: refl, left, top: top + th - 6 },
    { input: tvBuf.data, left, top },
    { input: vignette(light), left: 0, top: 0 },
  ];
  await sharp(bg(c1, c2, glow)).composite(layers).png().toFile(out + "tv_lifestyle_" + String(id).padStart(2, "0") + ".png");
  console.log("scene", String(id).padStart(2, "0"), title, tw + "x" + th);
}
console.log("15 scenes written to", out);
