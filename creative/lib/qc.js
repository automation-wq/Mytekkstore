// Quality control of a generated creative against its concept and product: deterministic checks first (file integrity, size,
// ratio, the words that were drawn, product visibility, contrast, every claim traceable to the product's facts, brand colours
// when guidelines give any), then the checks only a person can make, listed as "manual" and left out of the score.
const fs = require("fs"), path = require("path");
const { ASSETS } = require("./store.js");
const { sharp, contrast } = require("./image.js");

const digits = s => (String(s || "").match(/\d+/g) || []);
async function check(asset, concept, product) {
  const checks = [], issue = (name, detail, fix) => checks.push({ name, pass: false, kind: "deterministic", detail, fix });
  const ok = (name, detail) => checks.push({ name, pass: true, kind: "deterministic", detail });
  const manual = (name, detail) => checks.push({ name, pass: null, kind: "manual", detail });
  const abs = path.join(ASSETS, asset.path);
  let meta = null;
  if (!fs.existsSync(abs)) issue("File exists", "The file is missing on disk.", "Regenerate the creative.");
  else { try { meta = await sharp(abs).metadata(); ok("File integrity", `${meta.format} ${meta.width}×${meta.height}, ${Math.round(fs.statSync(abs).size / 1024)} KB`); } catch (e) { issue("File integrity", "The file cannot be read as an image: " + e.message, "Regenerate the creative."); } }
  if (meta) {
    if (meta.width === asset.width && meta.height === asset.height) ok("Dimensions", `${meta.width}×${meta.height} as requested`); else issue("Dimensions", `File is ${meta.width}×${meta.height}, record says ${asset.width}×${asset.height}.`, "Regenerate at the requested size.");
    const [rw, rh] = String(concept.ratio).split(":").map(Number), want = rw / rh, got = meta.width / meta.height;
    if (Math.abs(want - got) / want < .01) ok("Aspect ratio", concept.ratio); else issue("Aspect ratio", `Got ${got.toFixed(3)}, concept wants ${concept.ratio}.`, "Export at the concept's ratio or change the concept.");
  }
  const L = asset.layout || {}, drawn = (L.text || []);
  const has = kind => drawn.find(t => t.kind === kind);
  if (drawn.length) {
    has("headline") && has("headline").text === concept.headline ? ok("Headline present", concept.headline) : issue("Headline present", "The headline drawn differs from the concept's.", "Regenerate.");
    if (concept.supporting) (has("supporting") ? ok("Supporting copy present", concept.supporting) : issue("Supporting copy present", "Supporting line missing.", "Regenerate."));
    if (concept.cta) (has("cta") ? ok("Call to action present", concept.cta) : issue("Call to action present", "Button missing.", "Regenerate."));
    const words = drawn.map(t => t.text).join(" "), dup = /\b(\w{3,})\s+\1\b/i.exec(words);
    dup ? issue("Duplicated words", `"${dup[1]} ${dup[1]}"`, "Fix the concept text.") : ok("No duplicated words", "");
    const overflow = drawn.filter(t => t.x + t.w > L.canvas.w || t.y + t.h > L.canvas.h);
    overflow.length ? issue("Text inside the canvas", overflow.map(t => t.kind).join(", ") + " runs past the edge", "Shorten the text or use a larger size.") : ok("Text inside the canvas", "");
    const head = has("headline");
    if (head && L.colours) { const c = contrast(head.colour || L.colours.text, L.colours.background); c >= 3 ? ok("Headline contrast", `${c}:1 against the stage colour (large text needs 3:1)`) : issue("Headline contrast", `${c}:1 against the stage colour.`, "Use a darker or lighter stage."); }
    const cta = has("cta"); if (cta && cta.background) { const c = contrast(cta.colour, cta.background); c >= 4.5 ? ok("Button contrast", `${c}:1`) : issue("Button contrast", `${c}:1`, "Change the button colours."); }
  } else manual("Text readability", "This provider did not report the text layer; check spelling, placement and readability by eye.");
  if (L.product) { const share = (L.product.w * L.product.h) / (L.canvas.w * L.canvas.h); share >= .12 ? ok("Product visible", `${Math.round(share * 100)}% of the canvas${L.product.cut ? ", cutout" : ""}`) : issue("Product visible", `Only ${Math.round(share * 100)}% of the canvas.`, "Enlarge the product."); ok("Product fidelity", "The real product photo was composited (" + L.product.src + "); nothing was regenerated."); }
  else if (L.text) issue("Product visible", "No product photo was found for this product.", "Add a product image, then regenerate."); else manual("Product fidelity", "Compare the product with the real photo: shape, ports, logo, colour.");
  // claims: every number in the words must come from the product's own facts
  const factText = [product.name, product.model, product.description, ...(product.usps || []), ...Object.values(product.specs || {}), ...(product.offers || []), product.price, product.warranty].join(" ");
  const factDigits = new Set(digits(factText)), unknown = [...new Set(digits(drawn.map(t => t.text).join(" ")))].filter(d => !factDigits.has(d) && !factDigits.has(d.replace(/^0+/, "")));
  unknown.length ? issue("Claims traceable", "Numbers not found in the product's facts: " + unknown.join(", "), "Remove or correct them in the concept.") : ok("Claims traceable", "Every number in the words appears in the product's facts.");
  const usps = (concept.callouts || []).map(c => c[0]), factLower = factText.toLowerCase(), missing = usps.filter(u => !factLower.includes(String(u).replace(/"/g, "").toLowerCase().replace(/\s*w$/, "")));
  usps.length && (missing.length ? issue("Required USPs", "Callouts not backed by the facts: " + missing.join(", "), "Edit the callouts.") : ok("Required USPs", usps.join(", ")));
  const guideHex = (String(product.guidelines || "").match(/#[0-9a-f]{6}\b/gi) || []).map(s => s.toLowerCase());
  if (guideHex.length) { const used = (concept.palette || []).map(s => s.toLowerCase()).filter(c => !/#ffffff|#0f1115|#000000/.test(c)), off = used.filter(c => !guideHex.includes(c)); off.length ? issue("Brand colours", "Colours outside the guidelines: " + off.join(", "), "Pick the palette from the guidelines.") : ok("Brand colours", "Palette within the supplied guidelines."); }
  else manual("Brand guidelines", "No brand guidelines supplied for this product; add them to the product to check colours automatically.");
  manual("Spelling", "Read the words once; the text layer draws exactly the concept text, so fix spelling in the concept.");
  manual("Artefacts", asset.provider === "composite" ? "A rendered backdrop has no AI artefacts; check only that the product photo is clean." : "Look for warped shapes, extra screens or odd textures in the AI backdrop.");
  const scored = checks.filter(c => c.kind === "deterministic"), score = scored.length ? Math.round(100 * scored.filter(c => c.pass).length / scored.length) : 0;
  return { score, checks, issues: checks.filter(c => c.pass === false).map(c => c.name + ": " + c.detail + " → " + c.fix), manual: checks.filter(c => c.pass === null).length };
}
module.exports = { check };
