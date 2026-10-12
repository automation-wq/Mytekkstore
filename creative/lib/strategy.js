// Creative strategy: for one product, several ORIGINAL concepts across different approaches, each built only from the product's
// own facts (name, specifications, price, offers) and from the general lessons of the reference library (type contrast, product
// share, dark or light stage). Nothing of a reference's wording, artwork or layout is copied; each concept says what it took and
// how it differs. The image prompt describes a background scene only: the real product photo is composited onto it.
const { db } = require("./store.js");
const { lum } = require("./image.js");
const llm = require("./llm.js");

const APPROACHES = {
  "feature-led infographic": { ratio: "4:5", w: 1080, h: 1350, objective: "feature education", placement: "product page A+ block / listing image" },
  "minimalist product-led": { ratio: "1:1", w: 1080, h: 1080, objective: "product awareness", placement: "listing image / social post" },
  "offer-led": { ratio: "16:9", w: 1920, h: 1080, objective: "price visibility and conversion", placement: "home banner / offers page" },
  "lifestyle-led": { ratio: "16:9", w: 1920, h: 1080, objective: "desire and context", placement: "product page hero / campaign banner" },
  "specification-led": { ratio: "1:1", w: 1080, h: 1080, objective: "specification clarity", placement: "product detail image" },
  "comparison-led": { ratio: "4:5", w: 1080, h: 1350, objective: "choice within the range", placement: "category page / compare block" },
  "problem-solution": { ratio: "1:1", w: 1080, h: 1080, objective: "need recognition", placement: "social advertisement" },
};
const spec = (p, ...keys) => { const k = Object.keys(p.specs || {}).find(x => keys.some(y => x.toLowerCase().includes(y))); return k ? p.specs[k] : ""; };
const inchOf = p => +((/\((\d+)\s*inch\)/i.exec(p.name) || /(\d+)\s*inch/i.exec(spec(p, "screen", "size")) || [])[1] || 0);
const short = s => String(s || "").split(",")[0].trim();
const money = n => n == null ? "" : "₹" + Math.round(n).toLocaleString("en-IN");
// the product's facts in the shape the concepts use
function facts(p) {
  const size = inchOf(p), res = short(spec(p, "resolution")), os = short(spec(p, "smart", "operating", "os")), sound = short(spec(p, "sound", "audio", "speaker")), ports = short(spec(p, "port", "hdmi")), refresh = short(spec(p, "refresh")), display = short(spec(p, "display", "panel"));
  const derived = [res, os, sound, ports, refresh, display].filter(Boolean);
  const usps = (p.usps && p.usps.length ? p.usps : derived).slice(0, 4);
  const callouts = [size && [size + '"', "screen"], res && [/4k/i.test(res) ? "4K" : /full hd/i.test(res) ? "FHD" : /hd/i.test(res) ? "HD" : res.slice(0, 6), /4k/i.test(res) ? "Ultra HD" : "picture"], sound && [(/(\d+)\s*w/i.exec(sound) || [])[1] ? (/(\d+)\s*w/i.exec(sound) || [])[1] + " W" : sound.slice(0, 8), /dolby/i.test(sound) ? "Dolby Audio" : "sound"], os && [os.replace(/\s+(with|and|for)\b.*$/i, "").split(" ").slice(0, 2).join(" "), "built in"]].filter(Boolean).slice(0, 4);
  return { size, res, os, sound, ports, refresh, display, usps, callouts, price: p.price, offers: p.offers || [], firstSentence: (p.description || "").split(/(?<=\.)\s/)[0].slice(0, 140) };
}
// what the library teaches, as a whole: stage (dark or light), type ratio, headline length
function lessons(refs) {
  const an = refs.map(r => r.analysis).filter(Boolean);
  const dark = an.filter(a => a.facts.backgroundTreatment === "dark").length, light = an.filter(a => a.facts.backgroundTreatment === "light").length;
  const ratios = an.map(a => a.facts.typography.headlineToBody).filter(Boolean).sort((a, b) => a - b), ratio = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 2.5;
  const wordsArr = an.map(a => a.facts.headlineWords).filter(Boolean), words = wordsArr.length ? Math.round(wordsArr.reduce((a, b) => a + b, 0) / wordsArr.length) : 5;
  const share = an.map(a => a.facts.productProminence).filter(Boolean), prominence = share.length ? +(share.reduce((a, b) => a + b, 0) / share.length).toFixed(2) : .35;
  return { stage: dark >= light ? "dark" : "light", ratio, words, prominence, counted: an.length };
}
const PALETTES = { dark: ["#0d1117", "#1b2a4a", "#ffffff", "#7ef0d0"], light: ["#f5f4f0", "#ffffff", "#0f1115", "#08805f"] };

function concepts(product, refs, { objective = "", placement = "" } = {}) {
  const f = facts(product), L = lessons(refs), name = product.brand + " " + product.name;
  const sibling = db.products.find(x => x.id !== product.id && x.brand === product.brand && x.category === product.category && inchOf(x) && inchOf(x) !== f.size);
  const used = refs.slice(0, 3).map(r => r.id);
  const base = (approach, extra) => {
    const A = APPROACHES[approach], stage = extra.stage || L.stage, pal = PALETTES[stage];
    return { productId: product.id, name: approach + " · " + (f.size ? f.size + " inch" : product.name.slice(0, 30)), approach, objective: A.objective, audience: extra.audience || "Price-aware buyers upgrading their TV, on phones first", placement: placement || A.placement,
      message: extra.message, headline: extra.headline, supporting: extra.supporting, usp: extra.usp || f.usps[0] || "", visual: extra.visual, background: extra.background || (stage === "dark" ? "Dark stage, one accent light behind the product, nothing else" : "Light studio, soft floor shadow, generous white space"),
      positioning: extra.positioning || "Product on the right half, slight angle, taking about " + Math.round(Math.max(.35, L.prominence) * 100) + "% of the frame", typography: `Headline about ${L.ratio}× the body size, weight 800, sentence case, ${L.words}-word headline at most; body regular`,
      palette: pal, callouts: extra.callouts || [], cta: extra.cta, ratio: A.ratio, width: A.w, height: A.h, prompt: extra.prompt + " No text, no letters, no logos, no television or product in the scene (the real product is composited on top).", negative: "text, letters, logos, watermarks, extra screens, distorted or invented products, clutter, low contrast" + (extra.people ? "" : ", people"),
      references: used, difference: `Original composition in the ${approach} approach. From the references it takes only general lessons (${stage} stage, headline about ${L.ratio}× body, product share about ${Math.round(L.prominence * 100)}%); no wording, artwork, logo or layout is reused.`, stage, status: "proposed" };
  };
  const out = [];
  if (f.callouts.length >= 2) out.push(base("feature-led infographic", { message: "The facts that matter, at a glance", headline: f.usps.slice(0, 3).map(short).join(". ") + ".", supporting: f.firstSentence || name, callouts: f.callouts, visual: "Product centre, three or four fact pills around it with a thin line to the part they describe", cta: "See the specs", prompt: "Clean studio backdrop with a soft gradient and a faint floor reflection." }));
  out.push(base("minimalist product-led", { message: "One product, one line", headline: (f.size ? f.size + " inch." : product.name + ".") + (f.res ? " " + f.res + "." : ""), supporting: name, usp: f.res || f.usps[0], visual: "Product alone, large, centred, lots of empty space, one short line under it", positioning: "Product centred, about 60% of the frame", cta: "", prompt: "Minimal studio backdrop, single soft light from the top left, smooth gradient, faint shadow on the floor." }));
  if (f.price) out.push(base("offer-led", { message: "The price, then the product", headline: money(f.price) + "." + (f.offers.some(o => /emi/i.test(o)) ? " No Cost EMI." : ""), supporting: name + (f.offers.length ? " · " + f.offers.slice(0, 2).join(" · ") : ""), usp: money(f.price), visual: "Big price as the headline, product on the right, offer line under the price, one button", cta: "Buy now", prompt: "Festive but restrained backdrop: deep colour gradient with a soft bokeh of warm lights on one side." }));
  out.push(base("lifestyle-led", { message: "The product in a real room", headline: f.size >= 50 ? "The whole wall, every evening." : "Fits the room. Fills the evening.", supporting: name + (f.res ? " · " + f.res : ""), usp: f.res || f.usps[0], visual: "Real room, the TV placed on the wall or a console as the only bright object, family-free, dusk light", positioning: "Product centre-right on the wall, about 40% of the frame", cta: "Learn more", people: false, prompt: "Photoreal modern Indian living room at dusk, warm lamp light, a clean empty wall space centre-right where a television will be placed, soft shadows, no people.", stage: "dark" }));
  if (Object.keys(product.specs || {}).length >= 3) out.push(base("specification-led", { message: "Specifications as the design", headline: Object.values(product.specs).slice(0, 3).map(short).join(" · "), supporting: name, usp: f.usps[0], callouts: f.callouts, visual: "Product small at the top, a neat two-column specification list under it in the headline type", positioning: "Product top third, specifications below", cta: "", prompt: "Flat matte backdrop in one deep colour, no gradient, no objects.", stage: "light" }));
  if (sibling) out.push(base("comparison-led", { message: "Which size", headline: `${Math.min(f.size, inchOf(sibling))} or ${Math.max(f.size, inchOf(sibling))} inch?` + (f.res && f.res === short(spec(sibling, "resolution")) ? " Same " + f.res + "." : ""), supporting: name + " and " + sibling.brand + " " + sibling.name, usp: "Two sizes side by side", visual: "Both products side by side at true relative scale, the sizes as big numbers above each", positioning: "Two products, left and right, proportional", cta: "Compare", prompt: "Plain studio backdrop with a faint horizontal line as a floor." }));
  if (f.size) out.push(base("problem-solution", { message: "A room problem, a size answer", headline: f.size <= 43 ? `Small room? ${f.size} inch fits.` : `Big room? ${f.size} inch fills it.`, supporting: (f.res ? f.res + " picture" : name) + (f.os ? ", " + f.os + " built in" : "") + ".", usp: f.size + " inch", visual: "Room silhouette in the background, the product scaled to it, the headline as a question", positioning: "Product centre, scaled against a simple room outline", cta: "Buy now", prompt: "Simple line-drawn room outline on a soft gradient, no furniture detail, no objects." }));
  // which first, and why
  const prefer = /price|offer|conversion/i.test(objective) ? ["offer-led", "feature-led infographic", "minimalist product-led"] : /education|feature|spec/i.test(objective) ? ["feature-led infographic", "specification-led", "minimalist product-led"] : /awareness|lifestyle|brand/i.test(objective) ? ["lifestyle-led", "minimalist product-led", "feature-led infographic"] : ["feature-led infographic", "minimalist product-led", "offer-led"];
  out.sort((a, b) => (prefer.indexOf(a.approach) + 1 || 9) - (prefer.indexOf(b.approach) + 1 || 9));
  out.forEach((c, i) => { c.priority = i + 1; c.reason = i === 0 ? `First: ${c.approach} fits the objective "${objective || c.objective}" and needs only the product photo and its specifications.` : i === 1 ? "Second: a different approach for the same placement, so the two can be judged against each other." : "Later: worth making once the first two are approved."; });
  return out;
}
// optional: the language model may tighten the headline and supporting copy (facts stay; the result is labelled)
async function polish(concept, product) {
  if (!llm.available()) return concept;
  try {
    const out = await llm.json("You are a copywriter. Tighten the headline (max 7 words) and supporting line (max 18 words) for an e-commerce creative. Use ONLY the facts given; no new claims, no superlatives you cannot back. Reply as JSON {headline, supporting}.", JSON.stringify({ product: { name: product.brand + " " + product.name, specs: product.specs, price: product.price, offers: product.offers }, approach: concept.approach, headline: concept.headline, supporting: concept.supporting }));
    return out && out.headline ? { ...concept, headline: String(out.headline).slice(0, 80), supporting: String(out.supporting || concept.supporting).slice(0, 160), polishedBy: llm.MODEL } : concept;
  } catch { return concept; }
}
module.exports = { concepts, facts, lessons, polish, APPROACHES };
