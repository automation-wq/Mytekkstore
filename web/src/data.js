// Static content and lookups. Sample text where marked: replace with the client's own before launch.

// ponytail: hardcoded exchange rates, swap for real per-country prices from the backend
export const COUNTRIES = { India: ["₹", "en-IN", 1], UAE: ["AED ", "en-AE", 0.044], USA: ["$", "en-US", 0.012] };
// bullets under the description on every product page; the real details come from each product's own specifications
export const DEFAULT_FEATURES = ["Genuine product with brand warranty", "Quality checked before dispatch", "Cash on delivery available"];
// Info pages (web/src/info.jsx). Fill these in and they appear on the Contact and Store locator pages; empty = not shown.
export const CONTACT = { phone: "", email: "", hours: "", address: "" };
// [{ name, address, hours, map }] — the store list for the Store locator page
export const STORES = [];
// Policy figures used on the Shipping, Returns and Terms pages. DRAFT: the client confirms these before launch (README, "Before launch").
export const POLICY = { returnDays: 7, refundDays: 7 };

// ===== client decisions of 2026-10-12 (meeting notes) =====
// The store sells televisions only for now: washing machines and air conditioners are hidden by HIDDEN_CATS in server.js.
// The store locator is hidden (the business is B2C only); set SHOW_STORES to true and remove "stores" from HIDDEN_PAGES in server.js to bring it back.
export const SHOW_STORES = false;
// Shown in the category bar like any category, but with no link and no page: the client wants the two hidden categories seen, not sold. Empty to remove.
export const COMING_SOON = ["Washing Machines", "Air Conditioners"];
// Warranty and returns, asked the way customers ask; shown on every product page, the home page and the Returns page.
// DRAFT: the claim steps describe how the store handles a claim today (contact page, order number, the brand's service centre); the client confirms the wording.
export const WARRANTY_QA = [
  ["How do I claim the warranty?", "Every TV carries the brand's own warranty. Keep the invoice from your order page. To claim, write to us from the Contact page with your order number and a short description of the problem, and we connect you with the brand's authorised service centre, which repairs or replaces the TV under the warranty terms. We stay on the claim until it is closed.", ["/contact", "Contact us"]],
  ["What is the return and replacement policy?", `Tell us within ${POLICY.returnDays} days of delivery if the TV is damaged, faulty or not what you ordered. We arrange the pickup free of charge and replace it with the same model when it is in stock, or refund you in full, usually within ${POLICY.refundDays} working days. The TV must be unused and complete, with its accessories and packaging.`, ["/returns", "Returns and refunds"]],
  ["What if the TV arrives damaged or does not switch on?", `Check the TV when it arrives, before the delivery partner leaves if you can. Tell us within ${POLICY.returnDays} days, with a photo if there is visible damage, and we arrange a replacement or a refund.`, ["/contact", "Contact us"]],
  ["How long does a warranty repair take?", "The brand's service centre sets the repair time, which depends on the fault and the spare parts needed. We follow up with the service centre on your behalf and keep you informed until it is done.", null],
];
// Operating systems on the TVs we sell: Shop by OS and the comparison chart. General, public facts about each platform; which
// models run which system comes from each product's own `os` field (set in the admin page). The client confirms the wording before launch.
export const OS_ROWS = ["Apps", "Voice control", "Casting from a phone", "Home screen", "Account"];
export const TV_OS = {
  "Google TV": { blurb: "Google's TV platform: apps from Google Play, Google Assistant on the remote, Chromecast built in, and a home screen that recommends shows across your apps.", rows: ["Google Play Store", "Google Assistant on the remote", "Chromecast built in", "Recommendations across your apps", "Google account"] },
  "WebOS": { blurb: "LG's TV platform, used under licence: a quick card-style home screen, apps from the webOS store and screen sharing from a phone.", rows: ["webOS app store", "On supported remotes", "Screen share (Miracast)", "Card-style launcher", "Optional LG account"] },
  "Android TV": { blurb: "Google's earlier TV platform: apps from Google Play, Google Assistant and Chromecast built in, with an app-grid home screen.", rows: ["Google Play Store", "Google Assistant on the remote", "Chromecast built in", "App grid", "Google account"] },
};
// A+ content when the admin has not written any: up to four blocks built from the product's own specifications (nothing invented),
// with the product's photo and the store's lifestyle photos. The admin's own blocks (story) replace these as soon as they exist.
// the three or four big facts of a TV, for the showcase callouts: screen inch, resolution, sound, operating system
export function callouts(p) {
  const spec = k => ((p.specs || []).find(([n]) => n.toLowerCase() === k) || [])[1] || "";
  const inch = (/\((\d+) inch\)/.exec(p.name) || [])[1], res = spec("resolution"), sound = (/(\d+)\s*W/.exec(spec("sound output")) || [])[1];
  return [inch && [inch + "\"", "screen"], res && [/4K/i.test(res) ? "4K" : /Full HD/i.test(res) ? "FHD" : "HD", /4K/i.test(res) ? "Ultra HD" : "Ready"], sound && [sound + " W", /dolby/i.test(spec("sound output")) ? "Dolby Audio" : "sound"], p.os && [p.os, "built in"]].filter(Boolean).slice(0, 4);
}
export function autoStory(p) {
  const spec = k => ((p.specs || []).find(([n]) => n.toLowerCase() === k) || [])[1] || "";
  const size = spec("screen size"), res = spec("resolution"), smart = spec("smart tv"), sound = spec("sound output"), ports = spec("ports"), blocks = [];
  if (res) blocks.push({ kicker: "Picture", title: /4K/i.test(res) ? "4K Ultra HD picture" : /Full HD/i.test(res) ? "Full HD picture" : "HD Ready picture", text: res + (/4K/i.test(res) ? ": four times the detail of Full HD, so films, sport and games stay sharp" : ": a clear, bright picture") + (size ? " on the " + size + " screen." : ".") });
  if (smart) blocks.push({ kicker: "Smart", title: /google/i.test(smart) ? "Google TV built in" : /webos/i.test(smart) ? "WebOS built in" : /android/i.test(smart) ? "Android TV built in" : "Smart TV built in", text: smart + ". " + (/google/i.test(smart) ? "Apps from Google Play, Google Assistant on the remote and Chromecast built in, with no set-top box." : /webos/i.test(smart) ? "A quick card-style home screen with apps from the webOS store, with no set-top box." : "Streaming apps built in, with no set-top box.") });
  if (sound) blocks.push({ kicker: "Sound", title: /dolby/i.test(sound) ? "Dolby Audio sound" : "Built-in sound", text: sound + (/dolby/i.test(sound) ? ": clearer dialogue and fuller sound straight from the TV." : " from the built-in speakers, for everyday viewing.") });
  // Design (client brief, A+ section 5): only what the specifications verify (display type, size, ports); otherwise neutral words
  const disp = spec("display type");
  blocks.push({ kicker: "Design", title: /bezel-?less/i.test(disp) ? "Slim, bezel-less design" : "Slim design", text: (disp ? disp + " panel" : "A slim panel") + (size ? " at " + size : "") + ", flat on the wall or on its stand, so the picture takes the room" + (ports ? ", with " + ports + " at the back for a set-top box, a console and a pen drive." : ".") });
  const g = galleryOf(p), by = { Picture: g[0], Smart: g[1] || g[0], Sound: g[2] || g[0], Design: g[4] || g[0] };
  return blocks.map(b => ({ ...b, img: by[b.kicker] }));
}
export const osList = P => [...new Set(P.map(p => p.os).filter(Boolean))].sort();
export const osUrl = os => listUrl({ cat: "Televisions", os });
// two or three reasons to choose a brand, read from its own products: sizes, operating systems, 4K and sound, EMI
export function brandPoints(P, brand) {
  const ps = P.filter(p => p.brand === brand), pts = [];
  const sizes = [...new Set(ps.map(p => (/\((\d+) inch\)/.exec(p.name) || [])[1]).filter(Boolean))].map(Number).sort((a, b) => a - b);
  if (sizes.length > 1) pts.push(sizes.length + " sizes, " + sizes[0] + " to " + sizes[sizes.length - 1] + " inch"); else if (sizes.length) pts.push(sizes[0] + " inch");
  const os = osList(ps);
  if (os.length === 1 && ps.every(p => p.os)) pts.push(os[0] + " on every model"); else if (os.length) pts.push(os.join(" and ") + " models");
  const spec = re => ps.some(p => re.test(p.name) || (p.specs || []).some(([k, v]) => re.test(k + " " + v)));
  if (spec(/4K/)) pts.push("4K Ultra HD" + (spec(/Dolby/) ? " with Dolby Audio" : ""));
  if (ps.length && ps.every(p => p.emi)) pts.push("No Cost EMI on every model");
  return pts.slice(0, 3);
}
// Home banners (client decision): the factory-price message, one banner per brand, one promotion. SAMPLE words and pictures;
// the client supplies the final ones. kind "photo" uses a lifestyle photo, "brand" shows the brand's biggest TV with its reasons
// (brandPoints), "promo" opens the offers page with the biggest discount.
export const HOME_BANNERS = [
  { kind: "photo", eyebrow: "Mytekkstore", h: ["Unbelievable prices.", "Straight from the factory."], s: "Elista and Telefunken Smart TVs at factory prices, delivered free, cash on delivery.", href: "/televisions", cta: "Shop TVs", im: "img/kv-tv.jpg" },
  { kind: "brand", brand: "Elista", h: ["Elista."], tone: "linear-gradient(120deg,#052e25,#08805f 55%,#0b3d2e)" },
  { kind: "brand", brand: "Telefunken", h: ["Telefunken."], tone: "linear-gradient(120deg,#0f0c3a,#4338ca 55%,#1e1b4b)" },
  { kind: "promo", eyebrow: "Limited time", h: ["Festive offers."], href: "/offers", cta: "See the offers", im: "img/hero0.jpg" },
];
// "Good to know" on the home page. Every answer only repeats a promise the site already makes elsewhere: [question, answer, [link, label] or null]
export const FAQ = [
  // the client brief's seven television questions first (home page); policy answers use only what the site already states
  ["How do I choose the right TV screen size?", "Measure how far you sit from the screen. About 1.5 to 2 metres suits 32 to 43 inch, 2 to 2.5 metres suits 50 to 55 inch, and 65 inch and above is for 3 metres or more. Shop by Size on the Televisions page shows every size we stock with its starting price.", ["/televisions", "Shop by size"]],
  ["What is the difference between LED, QLED and OLED?", "All three are flat-panel types. LED uses a backlight behind an LCD panel and gives the best value; QLED adds a quantum-dot layer for brighter colour; OLED lights each pixel itself for perfect blacks at a higher price. Every TV we stock lists its display type in the specifications.", null],
  ["What is the difference between Google TV and Android TV?", "Both run Android and the Google Play apps. Google TV adds a newer home screen that gathers films and shows from your apps, with Google Assistant on the remote and Chromecast built in. Each product page names the system the model runs.", ["/televisions#os", "Compare the operating systems"]],
  ["How can I check delivery availability?", "Enter your pincode in the Deliver to box on any product page. Every order is delivered free, usually within 3 to 5 days, and cash on delivery is available.", null],
  ["How do warranty and installation work?", "Every TV carries the brand's own warranty. To claim it, write to us from the Contact page with your order number and we connect you with the brand's service centre. Wall mounting is arranged with the delivery partner where the brand offers it; ask us before you order.", ["/returns", "Warranty and returns"]],
  ["Can I compare different television models?", "Yes. Tick Compare on up to four products in any list to see them side by side, or open the comparison table on a product page.", ["/televisions#compare", "Compare the models"]],
  ["What payment offers are available?", "No Cost EMI over 3, 6 or 9 months on participating bank credit cards, plus the bank offers on the Offers page. Cash on delivery is available on every order.", ["/offers", "See the offers"]],
  ["Is delivery free?", "Yes. Every order is delivered free, usually within 3 to 5 days. Enter your pincode on any product page to check your area.", null],
  ["Can I pay when the order arrives?", "Yes. Cash on delivery is available on every order.", null],
  ["How does No Cost EMI work?", "On products marked No Cost EMI, the price is split over 3, 6 or 9 months on participating bank credit cards with no extra interest. The plans are listed on each product page.", ["/offers", "See the offers"]],
  ["Are the products genuine?", "Yes. Mytekkstore sells genuine Elista and Telefunken products, each with the brand's warranty.", null],
  ["Google TV or WebOS: which should I pick?", "Both stream the usual apps. Google TV adds Google Assistant on the remote and recommendations across your apps; WebOS keeps a quick card-style home screen. The Televisions page shows them side by side.", ["/televisions#os", "Compare the operating systems"]],
  WARRANTY_QA[0], WARRANTY_QA[1],
  ["How do I track my order?", "Sign in and open your account: every order shows its status from Placed to Delivered.", ["/account", "Go to my account"]],
  ["Can I return a product?", "Yes, returns are easy. The full policy is on the Returns and Refunds page.", ["/returns", "Read the returns policy"]],
];
export const STEPS = ["Placed", "Confirmed", "Shipped", "Delivered"];

// ===== icons: one line-icon set for the whole site (24 px grid, 1.8 px rounded stroke) =====
export const ICONS = {
  truck: '<path d="M3 7h11v8H3z"/><path d="M14 10h4l3 3v2h-7z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  box: '<path d="M12 3l9 4.5v9L12 21l-9-4.5v-9z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  cart: '<path d="M3 4h2l2.4 11h11l2-7H7"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  tv: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6"/>',
  sound: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M8 16l2 2M11 13l2 2M14 10l2 2"/>',
  plug: '<path d="M9 7V3M15 7V3M7 7h10v5a5 5 0 01-10 0zM12 17v4"/>',
  bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  spin: '<path d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5"/>',
  wind: '<path d="M3 8h11a3 3 0 10-3-3M3 12h15a3 3 0 110 6M3 16h8a2 2 0 11-2 2"/>',
  quiet: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  basket: '<path d="M3 10h18l-2 10H5z"/><path d="M8 10l3-6M16 10l-3-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  medal: '<circle cx="12" cy="14" r="5"/><path d="M9 3l3 6 3-6M8 3h8"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  room: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  snow: '<path d="M12 2v20M4 7l16 10M4 17L20 7M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3"/>',
  pin: '<path d="M12 21s-6-5.3-6-11a6 6 0 0112 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  sliders: '<path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
};
// self-drawing icons (pathLength lets the stroke draw in with CSS)
export const DRAW_ICONS = {
  truck: '<path pathLength="1" d="M3 7h11v8H3z"/><path pathLength="1" d="M14 10h4l3 3v2h-7z"/><circle pathLength="1" cx="7" cy="17" r="2"/><circle pathLength="1" cx="17" cy="17" r="2"/>',
  shield: '<path pathLength="1" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path pathLength="1" d="M9 12l2 2 4-4"/>',
  cash: '<rect pathLength="1" x="2" y="6" width="20" height="12" rx="2"/><circle pathLength="1" cx="12" cy="12" r="3"/><path pathLength="1" d="M6 12h.01M18 12h.01"/>',
  box: '<path pathLength="1" d="M12 3l9 4.5v9L12 21l-9-4.5v-9z"/><path pathLength="1" d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
};
// line icons for the feature strip under the product photo, picked by the specification's name
export const SPEC_ICONS = [
  [/screen|size|inch|\bcm\b/i, '<rect pathLength="1" x="2" y="4" width="20" height="13" rx="2"/><path pathLength="1" d="M8 21h8M12 17v4"/>'],
  [/resolution|4k|hd|pixel/i, '<rect pathLength="1" x="3" y="5" width="18" height="14" rx="2"/><path pathLength="1" d="M8 9v6M8 12l4-3M8 12l4 3M14 9h2a2 2 0 010 4h-2zM14 13l3 2"/>'],
  [/sound|audio|speaker|dolby/i, '<path pathLength="1" d="M4 10v4h4l5 4V6L8 10z"/><path pathLength="1" d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>'],
  [/port|hdmi|usb|connect/i, '<path pathLength="1" d="M9 7V3M15 7V3M7 7h10v5a5 5 0 01-10 0zM12 17v4"/>'],
  [/smart|google|android|app|os\b/i, '<rect pathLength="1" x="3" y="3" width="7" height="7" rx="1.5"/><rect pathLength="1" x="14" y="3" width="7" height="7" rx="1.5"/><rect pathLength="1" x="3" y="14" width="7" height="7" rx="1.5"/><rect pathLength="1" x="14" y="14" width="7" height="7" rx="1.5"/>'],
  [/refresh|hz|rate/i, '<path pathLength="1" d="M3 12h3l3-7 4 14 3-7h5"/>'],
  [/capacity|kg|load|drum/i, '<circle pathLength="1" cx="12" cy="12" r="9"/><circle pathLength="1" cx="12" cy="12" r="4"/><path pathLength="1" d="M12 8a4 4 0 014 4"/>'],
  [/spin|rpm/i, '<path pathLength="1" d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5"/>'],
  [/energy|star|power|watt/i, '<path pathLength="1" d="M13 2L4 14h6l-1 8 9-12h-6z"/>'],
  [/cool|ton|room|air/i, '<path pathLength="1" d="M12 2v20M4 7l16 10M4 17L20 7M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3"/>'],
  [/compressor|inverter|motor|program/i, '<circle pathLength="1" cx="12" cy="12" r="3"/><path pathLength="1" d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'],
  [/warranty|guarantee/i, '<path pathLength="1" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path pathLength="1" d="M9 12l2 2 4-4"/>'],
];
// the Specifications tab groups rows the way the big stores do; a row that matches none of these goes under General
export const SPEC_GROUPS = [["Display", /screen|size|inch|\bcm\b|resolution|4k|hd|pixel|refresh|hz|panel/i], ["Sound", /sound|audio|speaker|dolby/i], ["Smart features", /smart|google|android|app|os\b|voice|remote/i],
  ["Connectivity", /port|hdmi|usb|connect|wi-?fi|bluetooth/i], ["Performance", /capacity|kg|load|drum|spin|rpm|energy|star|power|watt|cool|ton|compressor|inverter|motor|program|wash/i], ["Warranty", /warranty|guarantee/i]];
export const specIcon = k => (SPEC_ICONS.find(([re]) => re.test(k)) || [0, '<circle pathLength="1" cx="12" cy="12" r="9"/><path pathLength="1" d="M8 12l3 3 5-6"/>'])[1];

// looping room clips (free Pexels videos in public/img) behind the Top features bands; lifestyle photos behind headlines and tiles
export const CAT_CLIPS = { "Televisions": "v-tv", "Washing Machines": "v-wash", "Air Conditioners": "v-ac" };
export const KV_IMG = { "Televisions": "kv-tv", "Washing Machines": "kv-wash", "Air Conditioners": "kv-ac" };

// Bank offers shown on the home page, the offers page and every product page. SAMPLE offers: replace with the real bank terms before launch.
// [bank, headline, terms, bank colour for the wordmark (real logos to come from the client)]
export const BANK_OFFERS = [
  ["HDFC Bank", "10% instant discount", "On HDFC Bank credit cards for orders above ₹10,000. Up to ₹2,000.", "#004c8f"],
  ["ICICI Bank", "5% cashback", "On ICICI Bank credit and debit cards. Up to ₹1,500.", "#b02a30"],
  ["SBI Card", "No Cost EMI", "3, 6 and 9 month EMI with no extra interest on SBI credit cards.", "#22409a"],
  ["Axis Bank", "₹1,000 off", "On Axis Bank cards for orders above ₹25,000.", "#97144d"],
];
// The festive offers page. Set ends to a date such as "2026-11-15T23:59:59+05:30" to show a live countdown; empty hides it.
export const FESTIVE = { title: "Festive Offers", sub: "Big savings on Elista and Telefunken Smart TVs", ends: "" };

// ===== category extras: "Top features" at the end of every category page. Sample marketing text: only claims the catalogue's =====
// specifications support. (The TV size guide was removed on 2026-10-12: the client's buyers already know the size they want.)
export const TOP_FEATURES = {
  "Televisions": [["tv", "4K Ultra HD", "Four times the detail of Full HD on the 43 and 55 inch models"], ["apps", "Smart TV apps", "Streaming apps built in on every model, no extra box needed"], ["mic", "Google TV with voice remote", "On the Telefunken 55 inch models"],
    ["sound", "Dolby Audio", "Clearer dialogue and fuller sound on the Telefunken models"], ["ruler", "Three sizes", "32, 43 and 55 inch, for every room"], ["plug", "HDMI and USB ports", "Connect a set-top box, console or pen drive"]],
  "Washing Machines": [["bolt", "5 Star energy rating", "Every model uses less electricity on each wash"], ["spin", "Up to 10 wash programs", "From delicates to heavy bedding"], ["wind", "Up to 1400 RPM spin", "Clothes come out closer to dry"],
    ["quiet", "Inverter direct drive", "Quieter, with less vibration, on the 8 kg front load"], ["shield", "Built to last", "Rust-proof body or stainless steel drum"], ["basket", "Three types", "Semi automatic, top load and front load"]],
  "Air Conditioners": [["gear", "Inverter compressor", "Adjusts its power to save electricity, on both models"], ["medal", "Copper condenser", "Better cooling and a longer life"], ["star", "Up to 5 Star rating", "The 1.5 Ton model carries the top rating"],
    ["room", "Sized for your room", "1 Ton up to 120 sq ft, 1.5 Ton up to 180 sq ft"], ["snow", "Split AC", "Quiet indoor unit, compressor outside"], ["quiet", "Smooth running", "Inverter compressors avoid the on-off cycling of older ACs"]],
};

// Each category has one "size" that shoppers pick by: screen size for TVs, capacity for the others. It is read from the product name.
export const CAT_SIZE = {
  "Televisions": { short: "TVs", by: "Size", note: "Find the perfect size for every space", re: /(\d+ cm) \((\d+) inch\)/, label: m => m[2] + " inch TVs", n: m => +m[2] },
  "Washing Machines": { short: "Washing Machines", by: "Capacity", note: "Pick the right capacity for your family", re: /([\d.]+) kg/, label: m => m[1] + " kg", n: m => +m[1] },
  "Air Conditioners": { short: "Air Conditioners", by: "Capacity", note: "Match the cooling to your room", re: /([\d.]+) Ton/, label: m => m[1] + " Ton", n: m => +m[1] },
};
// The sizes on sale in one category. sizeOf(product) gives { label, n }; all lists every size, biggest first.
export function catSizes(P, cat) {
  const S = Object.hasOwn(CAT_SIZE, cat) ? CAT_SIZE[cat] : null;
  const raw = p => { const m = S && S.re.exec(p.name); return m ? { label: S.label(m), n: S.n(m) } : null; };
  const canon = new Map(); // products of the same size share one label (a 139 cm and a 140 cm TV are both 55 inch)
  P.filter(p => p.cat === cat).forEach(p => { const s = raw(p); if (s && !canon.has(s.n)) canon.set(s.n, s.label); });
  return { S, sizeOf: p => { const s = raw(p); return s && { label: canon.get(s.n), n: s.n }; }, all: [...canon].map(([n, label]) => ({ n, label })).sort((a, b) => b.n - a.n) };
}
// Clean addresses, resolved by server.js (the same slug rule lives there): /televisions, /televisions/<brand-and-model>, /products?brand=Elista
export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const catUrl = c => "/" + slug(c);
export const productUrl = p => catUrl(p.cat) + "/" + slug(p.brand + " " + p.name);
export const brandUrl = b => "/products?brand=" + encodeURIComponent(b);
// product-list link from filters, for example listUrl({ cat: "Televisions", brand: "Elista" }); empty values are left out
export const listUrl = ({ cat, ...o }) => { const q = new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString(); return (cat ? catUrl(cat) : "/products") + (q ? "?" + q : ""); };
// Photos: `npm run images` (web/images.js) writes WebP copies of the seeded photos as name.webp, name-960.webp and name-480.webp.
// Uploaded photos (img/u-*.jpg) and outside links have no copies and are used as they are.
const hasWebp = src => /^img\/(?!u-)[\w-]+\.jpg$/.test(src || "");
// always an absolute address: a product page lives at /televisions/<model>, where a relative img/... would point one level too deep
export const pic = (src, w) => { const s = hasWebp(src) ? src.replace(/\.jpg$/, (w ? "-" + w : "") + ".webp") : src; return /^img\//.test(s || "") ? "/" + s : s; };
const DIMS = { "img/hero0.jpg": [1344, 752], "img/hero1.jpg": [1344, 752], "img/hero2.jpg": [1344, 752], "img/kv-tv.jpg": [1600, 2350], "img/kv-ac.jpg": [1600, 1074], "img/kv-wash.jpg": [1600, 1067] };
export const dims = src => DIMS[src] || [800, 800]; // the product photos are square
// floating cutout of a product render (white background made transparent by `npm run cutouts`); only the seeded renders have one
export const cutout = src => /^img\/p\d+(-v\d+)?\.jpg$/.test(src || "") ? "/" + src.replace(/\.jpg$/, "-cut.webp") : null;
// The central gallery map (client brief, section 21): six different pictures per TV. The admin's own photos win; otherwise the render,
// a living-room photo, the render on a dark stage, the screen close-up, the home-cinema photo and the stand close-up (web/gallery-gen.mjs).
// The two room photos show a TV of this kind, not this exact model; the model's facts stay in the specifications.
export const GALLERY_LABELS = ["Front view", "In the living room", "Studio view", "Screen detail", "Home cinema", "Stand detail"];
export const galleryOf = p => { if (p.images && p.images.length) return [p.img, ...p.images]; const m = p.cat === "Televisions" && /^img\/(p\d+(?:-v\d+)?)\.jpg$/.exec(p.img || ""); if (!m) return [p.img]; const n = m[1]; return [p.img, "img/hero0.jpg", `img/g/${n}-studio.webp`, `img/g/${n}-screen.webp`, "img/kv-tv.jpg", `img/g/${n}-stand.webp`]; };
export const picSet = src => hasWebp(src) ? `${pic(src, 480)} 480w, ${pic(src, 960)} 960w, ${pic(src)} ${dims(src)[0]}w` : undefined;
export const off = p => Math.round((1 - p.price / p.mrp) * 100);
export const avg = p => p.reviews && p.reviews.length ? p.reviews.reduce((t, r) => t + r.rating, 0) / p.reviews.length : 0;
export const starRow = n => "★".repeat(n) + "☆".repeat(5 - n);

// delivery estimate from the store's standard promise of 3 to 5 days, as "Thu, 9 Oct to Sat, 11 Oct"
const day = (from, n) => new Date(+new Date(from) + n * 864e5).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const eta = (from = Date.now()) => [day(from, 3), day(from, 5)];
export const etaText = from => eta(from).join(" to ");
// No Cost EMI: the price split over 3, 6 and 9 months with no interest, as [months, per month]
export const emiPlans = price => [3, 6, 9].map(n => [n, Math.ceil(price / n)]);

// Category pages: "Know before you buy" cards and the questions under them. General, factual copy only; what a particular model has
// comes from the compare table, which reads the catalogue. [icon from ICONS, title, text]
export const CAT_KNOW = {
  "Air Conditioners": [
    ["room", "Tonnage is cooling capacity", "A ton is how much heat the AC removes in an hour. 1 Ton suits a room up to about 120 sq ft, 1.5 Ton up to about 180 sq ft. Sunny rooms and top floors need the bigger size."],
    ["gear", "Inverter compressor", "Instead of switching on and off, the compressor speeds up and slows down to hold the temperature. That uses less electricity and keeps the room steadier."],
    ["star", "Star ratings", "ACs are rated from 1 to 5 Star for energy use. More stars means less electricity for the same cooling, so a 5 Star model costs less to run every summer."],
    ["medal", "Copper condenser", "Copper moves heat faster than aluminium, resists corrosion and is easier to repair, so the AC keeps cooling well for longer."],
  ],
  "Washing Machines": [
    ["basket", "Capacity in kg", "The weight of dry clothes per wash. 6 to 7 kg suits two or three people; 8 kg and above handles a family's bedding and towels in one load."],
    ["spin", "Front load, top load or semi automatic", "Front load machines are gentle on clothes and use the least water. Top load machines are easy to fill. Semi automatic machines cost the least: you move the clothes from the wash tub to the spin tub."],
    ["wind", "Spin speed", "Measured in RPM. A faster spin wrings more water out, so clothes dry sooner on the line."],
    ["bolt", "Star ratings", "A 5 Star rating means the machine uses the least electricity and water for each wash."],
  ],
  "Televisions": [
    ["ruler", "Screen size", "Measure the distance from your sofa to the screen and divide it in inches by 1.2 for a cinema-like fit: about 1.7 m for 55 inch, 1.3 m for 43 inch, 1 m for 32 inch."],
    ["tv", "HD Ready, Full HD or 4K", "4K Ultra HD has four times the pixels of Full HD, so the picture stays sharp on 43 inch and bigger screens. HD Ready suits a small bedroom TV."],
    ["apps", "Google TV or WebOS", "Both stream apps without a set-top box. Google TV adds Google Assistant on the remote and recommendations across your apps; WebOS has a quick card-style home screen. They are compared on this page."],
    ["plug", "Ports", "Count what you plug in: a set-top box, a console and a soundbar each need an HDMI port. More ports means fewer cable swaps."],
  ],
};
export const CAT_FAQ = {
  "Air Conditioners": [
    ["Which size do I need?", "1 Ton cools a room up to about 120 sq ft and 1.5 Ton up to about 180 sq ft. For a room that gets direct sun, choose the bigger size."],
    ["What does inverter mean?", "The compressor varies its speed instead of switching on and off, so the AC uses less electricity and the temperature stays steady."],
    ["Is a 5 Star AC worth it?", "It uses less electricity than a 3 Star AC for the same cooling, so it costs less to run. The longer you run the AC each day, the sooner the saving covers the higher price."],
    ["Why does the condenser material matter?", "Copper condensers cool faster, last longer and are easier to repair than aluminium ones."],
  ],
  "Washing Machines": [
    ["Front load or top load?", "Front load is gentler on clothes and uses less water. Top load is easier to fill and usually costs less."],
    ["What does semi automatic mean?", "The machine has two tubs. You wash in one, then move the clothes to the other to spin. It is the lowest-priced type."],
    ["What capacity is right for my family?", "6 to 7 kg for two or three people, 8 kg or more for a larger family or for washing bedding in one load."],
    ["Does a higher spin speed matter?", "A faster spin leaves clothes drier, so they take less time on the line."],
  ],
  "Televisions": [
    ["Google TV or WebOS: what is the difference?", "Google TV: apps from Google Play, Google Assistant on the remote, Chromecast built in, recommendations across apps. WebOS: a card-style home screen with apps from the webOS store and screen sharing from a phone. The chart on this page lists them side by side."],
    ["Is 4K worth it?", "On a 43 inch or bigger screen, yes: four times the detail of Full HD, and streaming apps carry 4K content. For a small bedroom TV, HD Ready is enough."],
    WARRANTY_QA[0], WARRANTY_QA[1],
    ["How many HDMI ports do I need?", "One for each device you plug in: set-top box, console, soundbar."],
  ],
};
