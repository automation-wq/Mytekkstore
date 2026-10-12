// The help bot's own brain: answers from the catalogue and the store's own pages, nothing else. It runs in the browser, so it
// works with no AI key at all; when ANTHROPIC_API_KEY is set on the server the widget asks the server's assistant first and
// comes back here if that fails. Nothing here invents a price, a stock figure, an offer or a specification.
import { FAQ, WARRANTY_QA, BANK_OFFERS, POLICY, TV_OS, CONTACT, emiPlans, productUrl, listUrl, brandUrl, osUrl, off, eta } from "./data.js";

const inchOf = p => +((/\((\d+) inch\)/.exec(p.name) || [])[1] || 0);
const spec = (p, k) => ((p.specs || []).find(([n]) => n.toLowerCase().includes(k)) || [])[1] || "";
const name = p => p.brand + " " + p.name;
const link = (label, href) => ({ label, href });
const plink = p => link(p.brand + " " + inchOf(p) + " inch", productUrl(p));
const words = s => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3);
const rupees = s => { const m = /(\d[\d,]*)\s*(k)?/i.exec(s); if (!m) return 0; const n = +m[1].replace(/,/g, ""); return m[2] ? n * 1000 : n; };
const res = p => { const r = spec(p, "resolution"); return /4K/i.test(r) ? "4K Ultra HD" : /Full HD/i.test(r) ? "Full HD" : /HD/i.test(r) ? "HD Ready" : r; };
// the question-and-answer list entry that shares the most words with the question
const bestQa = (list, t) => { const ws = words(t); let best = null, score = 1; for (const qa of list) { const s = words(qa[0] + " " + qa[1]).filter(w => ws.includes(w)).length; if (s > score) { best = qa; score = s; } } return best; };

export function suggestions(ctx, p) {
  if (p) return ["What is the resolution?", "Does it have No Cost EMI?", "When will it be delivered?", "How do returns work?"];
  if (ctx.page === "category" || ctx.cat) return ["Which TV is best under ₹30,000?", "Google TV or WebOS?", "Show me 55 inch TVs", "How does No Cost EMI work?"];
  return ["Which TV is best under ₹30,000?", "How long does delivery take?", "What are the bank offers?", "How do returns work?"];
}
export const intro = (ctx, p) => p ? `Ask me anything about the ${name(p)}: specs, price, EMI, delivery or returns.` : "Ask me about a TV, delivery, EMI, offers or returns. I answer from the catalogue and the store's own pages.";

export function answerLocally(q, ctx, P, money) {
  const t = " " + q.toLowerCase().trim() + " ", has = (...ws) => ws.some(w => t.includes(w));
  const say = (text, links = []) => ({ text, links });
  const cur = ctx.id ? P.find(x => x.id === +ctx.id) : null;
  const tvs = P.filter(p => p.cat === (cur ? cur.cat : P[0] && P[0].cat));
  const cat = tvs[0] ? tvs[0].cat : "";
  const cheap = ps => [...ps].sort((a, b) => a.price - b.price);
  const listText = ps => ps.map(x => `${name(x)} at ${money(x.price)}`).join("; ");
  const sizeAsked = +((/\b(\d{2})\s*(?:inch|"|”|in\b)/.exec(t) || [])[1] || 0);
  const mentioned = tvs.filter(x => t.includes(x.name.toLowerCase()) || (inchOf(x) === sizeAsked && t.includes(x.brand.toLowerCase())));
  const budget = has("under", "below", "within", "less than", "upto", "up to", "budget", "max") ? rupees(t) : 0;
  const osAsked = Object.keys(TV_OS).find(o => t.includes(o.toLowerCase())) || (has("android") ? "Android TV" : "");

  if (q.trim().length < 2 || (has(" hi ", " hello ", " hey ") && t.length < 14)) return say(intro(ctx, cur));
  if (has("thank")) return say("You are welcome. Anything else about the TVs, delivery or offers?");

  // comparing two models
  if (has("compare", " vs", "versus", "difference", "better")) {
    const ps = mentioned.length >= 2 ? mentioned.slice(0, 4) : cur ? [cur, ...tvs.filter(x => x.id !== cur.id && Math.abs(inchOf(x) - inchOf(cur)) <= 5)].slice(0, 2) : [];
    if (ps.length >= 2) return say(ps.map(x => `${name(x)}: ${money(x.price)}, ${res(x)}${x.os ? ", " + x.os : ""}`).join(". ") + ". The full table is one tap away.", [link("Compare side by side", "/compare?ids=" + ps.map(x => x.id).join(","))]);
    if (osAsked || has("operating")) return say(Object.keys(TV_OS).filter(o => tvs.some(p => p.os === o)).map(o => o + ": " + TV_OS[o].blurb).join(" "), [link("The operating systems side by side", "/televisions#os")]);
    return say("Tell me the two models, or tick Compare on any two cards on the Televisions page and the table appears there.", [link("Televisions", listUrl({ cat }))]);
  }

  // questions about the product on the page
  if (cur) {
    const c = cur, sz = spec(c, "screen size");
    if (has("resolution", "4k", "full hd", "hd ready", "pixel", "picture quality")) return say(`${name(c)}: ${spec(c, "resolution") || res(c)}.`, [link("All specifications", "#specs")]);
    if (has("size", "inch", " cm", "big", "large", "small", "fit")) return say(`${name(c)} is ${sz || c.name}. ${tvs.filter(x => x.brand === c.brand && x.id !== c.id).length ? "Other " + c.brand + " sizes are on the product page under Size." : ""}`.trim(), [link("See the sizes", "#overview")]);
    if (has("sound", "speaker", "audio", "dolby", "watt", "bass")) return say(`${name(c)}: sound output ${spec(c, "sound") || "is listed in the specifications"}.`, [link("All specifications", "#specs")]);
    if (has("port", "hdmi", "usb", "connect", "plug", "set-top", "set top", "console")) return say(`${name(c)}: ${spec(c, "port") || "the ports are listed in the specifications"}.`, [link("All specifications", "#specs")]);
    if (has("google", "webos", "android", " os ", "operating", "app", "netflix", "youtube", "prime", "hotstar", "smart")) return say(c.os && TV_OS[c.os] ? `${name(c)} runs ${c.os}. ${TV_OS[c.os].blurb}` : `${name(c)}: ${spec(c, "smart") || "see the specifications"}.`, c.os ? [link("All " + c.os + " TVs", osUrl(c.os)), link("Operating systems compared", "/televisions#os")] : []);
    if (has("emi", "month", "instal")) return say(c.emi ? `No Cost EMI on the ${name(c)}: ${emiPlans(c.price).map(([n, m]) => n + " months at " + money(m) + "/month").join(", ")}, with no extra interest on the bank cards on the offers page.` : `No Cost EMI is not marked on the ${name(c)}. The models that carry it show a No Cost EMI tag.`, [link("Offers and EMI", "/offers")]);
    if (has("price", "cost", "much", "rate", "mrp", "discount", "save", "cheap", "₹", "rs")) return say(`${name(c)} is ${money(c.price)}, inclusive of all taxes${c.mrp > c.price ? `, ${off(c)}% below the MRP of ${money(c.mrp)}` : ""}.${c.emi ? " No Cost EMI from " + money(emiPlans(c.price)[2][1]) + "/month." : ""}`, [link("Offers", "/offers")]);
    if (has("stock", "available", "availability")) return say(c.stock > 0 ? `${name(c)} is in stock${c.stock <= 5 ? ", only " + c.stock + " left" : ""}.` : `${name(c)} is out of stock right now.`, [link("Other " + c.brand + " TVs", brandUrl(c.brand))]);
    if (has("deliver", "ship", "when", "arrive", "reach", "days", "pincode", "pin code", "cash on", "cod")) return say(`Free delivery, usually by ${eta().join(" to ")}, with cash on delivery. Enter your pincode under the price to check your area.`, [link("Shipping and delivery", "/shipping")]);
    if (has("warranty", "return", "replace", "refund", "damage", "guarantee", "broken", "repair")) { const qa = bestQa(WARRANTY_QA, t) || WARRANTY_QA[0]; return say(qa[1], [link("Warranty and returns", "/returns")]); }
    if (has("refresh", " hz", "display", "panel", "bezel", "led", "qled", "oled")) return say(`${name(c)}: display ${spec(c, "display") || "LED"}${spec(c, "refresh") ? ", refresh rate " + spec(c, "refresh") : ""}.`, [link("All specifications", "#specs")]);
    if (has("spec", "detail", "feature", "about", "tell me", "what is")) return say(`${name(c)}: ${(c.specs || []).slice(0, 5).map(([k, v]) => k + " " + v).join(", ")}. ${money(c.price)}${c.emi ? ", No Cost EMI available" : ""}.`, [link("Full specifications", "#specs"), link("Compare with similar TVs", "#compare")]);
  }

  // finding a TV
  if (budget || has("cheapest", "lowest", "cheap", "affordable")) {
    const ps = cheap(budget ? tvs.filter(p => p.price <= budget) : tvs).filter(p => !sizeAsked || inchOf(p) === sizeAsked).slice(0, 3);
    if (!ps.length) return say(`Nothing ${budget ? "under " + money(budget) : "that size"} right now. The lowest price in the range is ${money(cheap(tvs)[0].price)}.`, [plink(cheap(tvs)[0])]);
    return say(`${budget ? "Under " + money(budget) : "Lowest prices"}: ${listText(ps)}.`, ps.map(plink).concat(budget ? [link("All TVs under " + money(budget), listUrl({ cat, max: budget }))] : []));
  }
  if (sizeAsked) {
    const ps = cheap(tvs.filter(p => inchOf(p) === sizeAsked)).slice(0, 4);
    return ps.length ? say(`${sizeAsked} inch: ${listText(ps)}.`, ps.map(plink).concat([link("All " + sizeAsked + " inch TVs", listUrl({ cat, size: sizeAsked + " inch TVs" }))]))
      : say(`No ${sizeAsked} inch model right now. Sizes on sale: ${[...new Set(tvs.map(inchOf).filter(Boolean))].sort((a, b) => a - b).join(", ")} inch.`, [link("All TVs", listUrl({ cat }))]);
  }
  if (osAsked) {
    const ps = tvs.filter(p => p.os === osAsked);
    return say((TV_OS[osAsked] ? osAsked + ": " + TV_OS[osAsked].blurb + " " : "") + (ps.length ? `${ps.length} model${ps.length === 1 ? "" : "s"} run it, from ${money(cheap(ps)[0].price)}.` : `No model runs ${osAsked} right now.`), ps.length ? [link("All " + osAsked + " TVs", osUrl(osAsked)), link("Operating systems compared", "/televisions#os")] : [link("Operating systems compared", "/televisions#os")]);
  }
  const brand = [...new Set(tvs.map(p => p.brand))].find(b => t.includes(b.toLowerCase()));
  if (brand) {
    const ps = cheap(tvs.filter(p => p.brand === brand)), sizes = [...new Set(ps.map(inchOf).filter(Boolean))].sort((a, b) => a - b);
    return say(`${brand}: ${ps.length} model${ps.length === 1 ? "" : "s"}, ${sizes[0]} to ${sizes[sizes.length - 1]} inch, from ${money(ps[0].price)}.`, [link("All " + brand + " TVs", brandUrl(brand))].concat(ps.slice(0, 2).map(plink)));
  }
  if (has("best", "recommend", "suggest", "which tv", "which one", "good tv", "living room", "bedroom")) {
    const by = n => cheap(tvs.filter(p => inchOf(p) >= n[0] && inchOf(p) <= n[1]))[0];
    const rooms = [[32, 40, "bedroom or small room"], [43, 50, "living room"], [55, 75, "big room or home theatre"]].map(([a, b, room]) => { const p = by([a, b]); return p && `${a} to ${b} inch for a ${room}, from ${money(p.price)}`; }).filter(Boolean);
    return say("It depends on the room: " + rooms.join("; ") + ". Tell me your budget or the size and I will name the models.", [link("Find your TV by size", listUrl({ cat }) + "#find")]);
  }
  if (has("deliver", "ship", "pincode", "pin code", "cash on", "cod", "how long", "arrive")) { const qa = bestQa(FAQ, t); return say(qa ? qa[1] : `Free delivery across India, usually in 3 to 5 days, with cash on delivery. Enter your pincode on any product page to check your area.`, [link("Shipping and delivery", "/shipping")]); }
  if (has("warranty", "return", "replace", "refund", "damage", "guarantee", "broken", "repair")) { const qa = bestQa(WARRANTY_QA, t) || WARRANTY_QA[0]; return say(qa[1] + (POLICY.returnDays ? "" : ""), [link("Warranty and returns", "/returns")]); }
  if (has("emi", "bank", "offer", "cashback", "discount", "festive", "deal", "sale")) return say(`No Cost EMI over 3, 6 or 9 months on the models that carry the tag, plus ${BANK_OFFERS.length} bank offers: ${BANK_OFFERS.map(b => b[0] + " " + String(b[1] || "").toLowerCase()).join("; ")}.`, [link("Offers and EMI", "/offers"), link("Biggest discounts", listUrl({ cat, sort: "off" }))]);
  if (has("contact", "call", "phone", "whatsapp", "email", "talk", "human", "agent", "person", "support")) return say(CONTACT.phone || CONTACT.email ? `You can reach us${CONTACT.phone ? " on " + CONTACT.phone : ""}${CONTACT.email ? (CONTACT.phone ? " or at " : " at ") + CONTACT.email : ""}${CONTACT.hours ? ", " + CONTACT.hours : ""}.` : "Write to us through the contact page and we reply by email.", [link("Contact us", "/contact")]);
  if (has("order", "track", "status", "account", "sign in", "login", "cancel")) return say("Your orders, their status and your details are under My account. Sign in with the email or phone number you ordered with.", [link("My account", "/account")]);
  const qa = bestQa(FAQ, t);
  if (qa) return say(qa[1], qa[2] ? [link(qa[2][1], qa[2][0])] : []);
  return say("I can help with the TVs (sizes, prices, operating systems, specifications), delivery, EMI and bank offers, warranty and returns. Try one of the questions below, or name a model.", [link("All TVs", listUrl({ cat })), link("Contact us", "/contact")]);
}
