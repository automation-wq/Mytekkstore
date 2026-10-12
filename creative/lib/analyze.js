// Creative intelligence: every collected reference is read for its visual hierarchy, design system, messaging, format and the
// objective it seems to pursue. Facts come from the observation (positions, sizes, colours, fonts, words); everything else is
// labelled as a pattern, a possible strength or weakness, a lesson, or a hypothesis. No performance claim is made from looks.
const { lum } = require("./image.js");
const llm = require("./llm.js");

const EMO = /\b(feel|love|joy|dream|family|home|magic|beautiful|immers|cinema|experience|celebrat|moment|together|stadium|bring)/i;
const FUN = /\b(\d+\s?(hz|w|inch|cm|k|gb|ltr|kg)|resolution|processor|ports?|hdmi|warranty|energy|star|dolby|hdr|refresh|upscal|capacity|inverter|ai)\b/i;
function analyze(ref) {
  const f = ref.facts, L = f.layout || {}, pw = L.pageWidth || 1366;
  const area = b => b ? b.w * b.h : 0;
  const pos = b => b ? (b.y < 400 ? "top" : b.y < 1200 ? "middle" : "lower") + (b.x + b.w / 2 < pw / 3 ? " left" : b.x + b.w / 2 > pw * 2 / 3 ? " right" : " centre") : "not found on the first screens";
  const prominence = L.image ? Math.min(1, area(L.image) / (pw * 900)) : 0;
  const firstNoticed = area(L.image) > area(L.headline) * 3 ? "the main image" : L.headline ? "the headline" : "the copy";
  const dominant = (f.palette || [])[0], supporting = (f.palette || []).slice(1, 4);
  const text = [f.headline, ...(f.copy || [])].join(" ");
  const angle = FUN.test(text) && !EMO.test(text) ? "functional" : EMO.test(text) && !FUN.test(text) ? "emotional" : "mixed";
  const format = ref.pageType === "product" ? (prominence > .35 ? "hero banner on a product page" : "product detail page with image set") : ref.pageType === "listing" ? "product listing cards" : ref.pageType === "offers" ? "promotional banner" : ref.pageType === "compare" ? "comparison graphic" : ref.pageType === "campaign" ? "campaign landing banner" : "brand-store hero banner";
  const hf = (f.typography || {}).headline || {}, bf = (f.typography || {}).body || {};
  const words = f.headline ? f.headline.split(/\s+/).filter(Boolean).length : 0;
  const facts = {
    firstNoticed, productProminence: +prominence.toFixed(2), positions: { headline: pos(L.headline), price: f.price ? "in the page copy" : "not shown", cta: pos(L.cta), image: pos(L.image) },
    dominantColour: dominant ? dominant.hex : "", dominantShare: dominant ? dominant.share : 0, supportingColours: supporting.map(c => c.hex), backgroundTreatment: dominant ? (lum(dominant.hex) < .2 ? "dark" : lum(dominant.hex) > .8 ? "light" : "mid-tone") : "unknown",
    typography: { headline: hf, body: bf, headlineToBody: hf.size && bf.size ? +(hf.size / bf.size).toFixed(1) : null, weight: hf.weight || "", caps: hf.transform === "uppercase" },
    headline: f.headline || "", headlineWords: words, cta: f.cta || "", buttons: f.buttons || [], offers: f.offers || [], priceShown: !!f.price, price: f.price || "", messagingAngle: angle, format, imageDims: f.imageDims || null, iconsAndCallouts: (f.benefits || []).length,
  };
  const patterns = [];
  if (words && words <= 6) patterns.push(`Short headline (${words} words) that names one idea; detail is left to the copy.`);
  if (prominence > .3) patterns.push(`The product fills a large share of the first screen (about ${Math.round(prominence * 100)}% of a screen).`);
  if (facts.typography.headlineToBody >= 2.5) patterns.push(`Strong type contrast: the headline is ${facts.typography.headlineToBody}× the body size${facts.typography.caps ? ", in capitals" : ""}.`);
  if (facts.offers.length) patterns.push("Offer language on the first screens: " + facts.offers.slice(0, 3).join(", ") + ".");
  if (facts.cta) patterns.push(`Primary action "${facts.cta}" placed ${pos(L.cta)}.`);
  if (facts.backgroundTreatment === "dark") patterns.push("Dark dominant background; product and text lifted by contrast."); else if (facts.backgroundTreatment === "light") patterns.push("Light, white-space-led composition.");
  if ((f.benefits || []).length >= 3) patterns.push(`Benefits listed as ${f.benefits.length} short headings (feature education).`);
  const strengths = [], weaknesses = [];
  if (words && words <= 8) strengths.push("The message can be read at a glance.");
  if (prominence > .25) strengths.push("The product, not decoration, is the focal point.");
  if (facts.cta) strengths.push("A clear next step on the first screen.");
  if (facts.typography.headlineToBody >= 2) strengths.push("Hierarchy is carried by type size, so it survives on small screens.");
  if (!facts.priceShown) weaknesses.push("No price on the first screens (hypothesis: shoppers compare price early).");
  if (words > 10) weaknesses.push("A long headline is harder to scan on phones.");
  if ((f.palette || []).length > 5 && f.palette.slice(0, 3).every(c => c.share < .25)) weaknesses.push("Several colours share the space; no single dominant tone.");
  if (!facts.cta) weaknesses.push("No primary action on the first screens.");
  const lessons = [
    "Lead with one benefit in the headline; keep the specifications for callouts.",
    prominence > .25 ? "Give the product at least a third of the composition." : "Make the product larger than any decoration.",
    facts.cta ? "One primary action, phrased as a verb." : "Add a primary action where the eye lands after the headline.",
    facts.backgroundTreatment === "dark" ? "A dark stage with one accent colour makes a screen product look lit." : "Plenty of white space around the product reads as premium.",
  ];
  const concept = { approach: angle === "functional" ? "feature-led infographic" : angle === "emotional" ? "lifestyle-led" : "minimalist product-led", why: "Borrows the general principles (hierarchy, type contrast, product share, one action) and none of the reference's wording, artwork, logo or layout." };
  const hypotheses = [`Objective (hypothesis): ${facts.offers.length ? "price and offer visibility" : ref.pageType === "product" ? "feature education leading to a purchase" : ref.pageType === "listing" ? "fast comparison and click-through" : "product awareness"}. No performance data was available; this is inferred from the design, not measured.`];
  return { facts, patterns, strengths, weaknesses, lessons, concept, hypotheses };
}
// optional second opinion from the language model, kept apart under "llm" and labelled as interpretation
async function enrich(ref, base) {
  if (!llm.available()) return null;
  try {
    const out = await llm.json("You are a creative director. You get OBSERVED FACTS about one web creative. Reply as JSON {patterns:[],strengths:[],weaknesses:[],lessons:[]} with short sentences. Never claim performance; label guesses as hypotheses.", JSON.stringify({ brand: ref.brand, pageType: ref.pageType, facts: base.facts, headline: ref.facts.headline, copy: ref.facts.copy }));
    return out ? { ...out, model: llm.MODEL, label: "interpretation by a language model, not an observed fact" } : null;
  } catch (e) { return { error: e.message }; }
}
module.exports = { analyze, enrich };
