// Info pages: About, Contact, Store locator, Shipping, Returns, Terms, Privacy. Each is a full page in the store's design language,
// not a paragraph of placeholder text. Facts about the store come from the catalogue or from how this site actually works (see
// server.js). The policy pages are drafts for the client to confirm before launch (README, "Before launch"); their numbers live in
// POLICY in data.js, and the contact details and store list in CONTACT and STORES there.
import { useEffect, useRef, useState } from "react";
import { useStore } from "./store.jsx";
import { api, qs } from "./api.js";
import { Row, Form, Icon, KvImg, Qa } from "./components.jsx";
import { KV_IMG, CAT_SIZE, BANK_OFFERS, FAQ, CONTACT, STORES, POLICY, SHOW_STORES, WARRANTY_QA, BRAND_BLURB, TV_OS, catSizes, catUrl, brandUrl, listUrl, off, etaText } from "./data.js";
import { countUp } from "./motion.js";
import { LegalPage, LEGAL_PAGES } from "./legal.jsx";

const PAGES = {
  about: ["About Mytekkstore", "Mytekkstore", "Good electronics, made simple.", "Elista Smart TVs at factory prices, delivered free with cash on delivery and the brand's own warranty.", "Televisions"],
  contact: ["Contact us", "Help", "We are here to help.", "Orders, delivery, returns and service. Write to us and we reply by email.", "Televisions"],
  stores: ["Store locator", "Visit us", "Find a store.", "Store addresses are being added. Until then, every product ships free to your door.", "Televisions"],
  shipping: ["Shipping and delivery", "Delivery", "Free delivery, every order.", "Across India, usually in 3 to 5 days, with cash on delivery if you prefer.", "Televisions"],
  returns: ["Returns and refunds", "Returns", "Easy returns, no drama.", `Tell us within ${POLICY.returnDays} days of delivery and we take it from there.`, "Televisions"],
  terms: ["Terms of use", "Terms", "The short version, in plain words.", "What you agree to when you order from Mytekkstore.", "Televisions"],
  privacy: ["Privacy policy", "Privacy", "Your data, kept to a minimum.", "What we store, why we store it, and what we never do with it.", "Televisions"],
  "buying-guide": ["How to choose a TV", "Buying guide", "How to choose the right TV.", "Size, resolution, operating system and connections — in plain words, so you buy once and buy right.", "Televisions"],
};

// the opener every info page starts with: the category photo with its room clip, an eyebrow, a headline and one line
function Hero({ eyebrow, title, sub, cat }) {
  return <div className="kv pagehero"><div className="kvimg"><KvImg src={`img/${KV_IMG[cat]}.jpg`} sizes="(max-width:1240px) 100vw, 1240px" eager /></div>
    <div><span className="eyebrow">{eyebrow}</span><h1 className="explore">{title}</h1><p>{sub}</p></div></div>;
}
// the four promises the whole site makes (ticker, footer, FAQ): one source of truth for the info pages
const PROMISES = [["truck", "Free delivery", "On every order, usually in 3 to 5 days, anywhere we deliver."], ["cash", "Cash on delivery", "Pay when the order arrives. No card needed."],
  ["shield", "Genuine products", "Every product carries the brand's own warranty."], ["undo", "Easy returns", `Tell us within ${POLICY.returnDays} days of delivery.`]];
const Promises = () => <div className="why">{PROMISES.map(([i, t, s]) => <div key={t}><i className="kico"><Icon k={i} /></i><b>{t}</b><p>{s}</p></div>)}</div>;
const Faq = ({ list, lead }) => <section className="faq"><h2>Good to know</h2>{lead && <p className="lead">{lead}</p>}<div className="faqs">{list.map(([q, a, link]) => <details key={q}><summary>{q}</summary><p>{a}{link && <> <a className="alink" href={link[0]}>{link[1]} →</a></>}</p></details>)}</div></section>;
// a policy page body: numbered sections with a heading and short paragraphs
const Policy = ({ sections }) => <div className="policy">{sections.map(([h, ...ps], i) => <section key={h}><span className="pnum">{String(i + 1).padStart(2, "0")}</span><div><h3>{h}</h3>{ps.map((p, j) => <p key={j}>{p}</p>)}</div></section>)}</div>;
// "check your pincode": the same India Post lookup the product page uses
function PinCheck() {
  const [msg, setMsg] = useState("");
  const submit = async e => {
    e.preventDefault();
    const v = e.currentTarget.pin.value.trim();
    if (!/^\d{6}$/.test(v)) return setMsg("Please enter a 6-digit pincode.");
    setMsg("Checking…");
    try { const d = await api("pincode/" + v); setMsg(d.district ? `We deliver to ${d.district}, ${d.state}: free, usually by ${etaText()}, cash on delivery available.` : `We deliver to ${v}: free, usually by ${etaText()}.`); }
    catch (ex) { setMsg(/find/.test(ex.message) ? ex.message : `We deliver to ${v}: free, usually by ${etaText()}.`); }
  };
  return <form className="pin pincheck" noValidate onSubmit={submit}><label>Your pincode <input name="pin" inputMode="numeric" maxLength="6" placeholder="6-digit pincode" aria-label="Pincode" /></label><button className="btn">Check delivery</button><p className="muted" role="status">{msg}</p></form>;
}
// the category tiles from the home page, with live counts and from-prices
function Cats() {
  const { P, CATS, money } = useStore();
  return <div className="kcats">{CATS.map(c => { const ps = P.filter(p => p.cat === c), low = ps.length ? Math.min(...ps.map(p => p.price)) : 0;
    return <a className="kcat" href={catUrl(c)} key={c}><KvImg className="kimg" src={`img/${KV_IMG[c] || "kv-tv"}.jpg`} sizes="(max-width:760px) 100vw, 33vw" /><div className="kshade"></div>
      <div className="ktext"><b>{c}</b><small>{ps.length} model{ps.length === 1 ? "" : "s"} · from {money(low)}</small><u>Shop now →</u></div></a>; })}</div>;
}

export function InfoPage() {
  const { P, CATS, BRANDS, money, CFG } = useStore();
  const p = qs.get("p");
  if (LEGAL_PAGES.includes(p)) return <LegalPage p={p} />;
  const page = Object.hasOwn(PAGES, p) && (p !== "stores" || SHOW_STORES) ? PAGES[p] : null; // the store locator is hidden (client decision 2026-10-12)
  const numRef = useRef();
  useEffect(() => { document.title = (page ? page[0] : "Page not found") + " | Mytekkstore"; }, []);
  useEffect(() => { if (numRef.current) countUp(numRef.current); }, [P]);
  if (!page) return <><div className="crumbs"><a href="/">Home</a> › Page not found</div><div className="box"><h1>Page not found</h1><p>This page does not exist.</p><a className="btn" href="/">Back to home</a></div></>;
  const [title, eyebrow, head, sub, cat] = page;
  const deals = [...P].sort((a, b) => off(b) - off(a)).slice(0, 5);
  const maxOff = Math.max(0, ...P.map(off));
  const brandBlurb = BRAND_BLURB;
  const crumbs = <div className="crumbs"><a href="/">Home</a> › {title}</div>;
  const hero = <Hero eyebrow={eyebrow} title={head} sub={sub} cat={cat} />;
  const cta = <section><a className="cban" href="/offers"><KvImg className="cph" src={`img/${KV_IMG[cat]}.jpg`} sizes="(max-width:1240px) 100vw, 1240px" /><div><span className="kicker">Festive offers</span><h2>{maxOff > 0 ? "Up to " + maxOff + "% off" : "No Cost EMI on every smart TV"}</h2><p>Bank offers · free delivery · cash on delivery on every TV</p><u>See the offers →</u></div></a></section>;

  // Delivery and Returns as help pages in the pattern of Amazon's help centre (28 Oct): a plain heading with the next action, the key
  // facts, the real steps on this site, then the details. Every rule here is the one in the Shipping and the Refund policies.
  const Facts = ({ list }) => <div className="hc-facts">{list.map(([ic, t, s]) => <div key={t}><span className="hc-ic"><Icon k={ic} /></span><b>{t}</b><small>{s}</small></div>)}</div>;
  const Steps = ({ list }) => <ol className="hc-steps">{list.map(([t, s, link], i) => <li key={t}><span className="hc-n">{i + 1}</span><div><b>{t}</b><p>{s}</p>{link && <a className="alink" href={link[1]}>{link[0]} →</a>}</div></li>)}</ol>;
  const Ask = ({ list }) => <div className="hc-faq">{list.map(([q, x]) => <details key={q}><summary>{q}</summary><p>{x}</p></details>)}</div>;
  const Help = () => <div className="hc-help"><span className="hc-ic"><Icon k="user" /></span><div><b>Still need help?</b><p>Write to us with your order number and we reply by email.</p></div><a className="d-btn" href="/contact">Contact us</a></div>;
  const rd = POLICY.returnDays, fd = POLICY.refundDays;

  const one = CATS.length === 1 ? CATS[0] : "", sizes = one ? catSizes(P, one).all : [];
  const biz = (CFG && CFG.business) || {}, phone = CONTACT.phone || biz.phone || "", email = CONTACT.email || biz.email || "";
  const tvs = P.filter(x => x.cat === "Televisions"), low = tvs.length ? Math.min(...tvs.map(x => x.price)) : 0, emiLow = Math.min(...tvs.filter(x => x.emi).map(x => Math.ceil(x.price / 9)));
  if (p === "about") return <>{crumbs}<div className="hc">
    <div className="hc-head"><span className="hc-eye">Company</span><h1>About Mytekkstore</h1><p>An online store for Elista smart TVs: every model and every size, at the brand's prices, delivered free across India with cash on delivery, No Cost EMI and the brand's own warranty.</p>
      <div className="hc-cta"><a className="d-btn" href="/televisions">Shop all TVs</a><a className="hc-ghost" href="/contact">Contact us</a></div></div>
    <div className="hc-stats" ref={numRef}>{[[tvs.length, "", "TV models"], [sizes.length, "", "screen sizes, 24 to 85 inch"], [low, "₹", "starting price"], [100, "%", "genuine, sealed, brand warranty"]].map(([n, pre, t]) => <div key={t}><b>{pre === "₹" ? money(n) : <><i data-n={n}>0</i>{pre}</>}</b><span>{t}</span></div>)}</div>
    <section className="hc-sec"><h2>What we promise on every order</h2><Facts list={PROMISES.map(([ic, t, s]) => [ic, t, s])} /></section>
    <section className="hc-sec"><h2>The range</h2><p className="hc-lead">{BRANDS.join(" and ")} televisions, from compact HD sets to 85-inch Mini-LED and QLED, with Google TV, WebOS, Android TV and Coolita OS.</p>
      <div className="hc-links">{sizes.map(sz => <a href={catUrl("Televisions") + "?size=" + sz.n} key={sz.n}><b>{sz.n}"</b><small>{tvs.filter(x => new RegExp("\\(" + sz.n + " inch\\)").test(x.name)).length} models</small></a>)}<a href="/televisions?type=Mini-LED+PRO"><b>Mini-LED</b><small>PRO range</small></a><a href="/televisions?type=QLED"><b>QLED</b><small>Colour range</small></a></div></section>
    {BRANDS.map(b => <section className="hc-sec hc-after" key={b}><div><h2>{b}</h2><p>{BRAND_BLURB[b] || ""}</p></div><a className="hc-ghost" href={brandUrl(b)}>Shop {b}</a></section>)}
    <section className="hc-sec"><h2>Common questions</h2><Ask list={FAQ.slice(0, 6).map(([q, a]) => [q, a])} /></section>
    <Help /></div></>;

  if (p === "contact") return <>{crumbs}<div className="hc">
    <div className="hc-head"><span className="hc-eye">Help</span><h1>Contact us</h1><p>Orders, delivery, returns and service. Write to us with your order number and we reply by email{phone ? ", or call us" : ""}.</p></div>
    <div className="hc-contact">
      <div className="hc-card hc-form"><h3>Send us a message</h3><ContactForm /></div>
      <div className="hc-ways">
        {phone && <a className="hc-way" href={"tel:" + phone.replace(/\s/g, "")}><span className="hc-ic"><Icon k="user" /></span><span><b>Call us</b><small>{phone}{CONTACT.hours ? " · " + CONTACT.hours : ""}</small></span></a>}
        {email && <a className="hc-way" href={"mailto:" + email}><span className="hc-ic"><Icon k="tag" /></span><span><b>Email</b><small>{email}</small></span></a>}
        <a className="hc-way" href="/account?s=orders"><span className="hc-ic"><Icon k="box" /></span><span><b>Track an order</b><small>Every order, from Placed to Delivered</small></span></a>
        <a className="hc-way" href="/returns"><span className="hc-ic"><Icon k="undo" /></span><span><b>Return or cancel</b><small>{POLICY.returnDays}-day returns, free pickup</small></span></a>
        <a className="hc-way" href="/shipping"><span className="hc-ic"><Icon k="truck" /></span><span><b>Delivery</b><small>Free, usually in 3 to 5 days</small></span></a>
        <a className="hc-way" href="/warranty"><span className="hc-ic"><Icon k="shield" /></span><span><b>Warranty and service</b><small>1 year or 1 + 1 years by model</small></span></a>
      </div></div>
    {(biz.legalName || biz.grievanceName) && <section className="hc-sec hc-two">
      {biz.legalName && <div className="hc-card"><h3>Registered office</h3><p className="hc-p"><b>{biz.legalName}</b><br />{[biz.address, biz.city, biz.state, biz.pin].filter(Boolean).join(", ")}{biz.gstin && <><br />GSTIN {biz.gstin}</>}</p></div>}
      {biz.grievanceName && <div className="hc-card"><h3>Grievance officer</h3><p className="hc-p"><b>{biz.grievanceName}</b>{biz.grievanceDesignation && ", " + biz.grievanceDesignation}{biz.grievanceEmail && <><br />{biz.grievanceEmail}</>}{biz.grievancePhone && <><br />{biz.grievancePhone}</>}</p><small>Under the Consumer Protection (E-Commerce) Rules, 2020. We acknowledge a complaint within 48 hours and resolve it within one month.</small></div>}</section>}
    <section className="hc-sec"><h2>Common questions</h2><Ask list={FAQ.filter(([q]) => /deliver|pay|track|return|genuine|warranty|EMI/i.test(q)).slice(0, 6).map(([q, a]) => [q, a])} /></section></div></>;

  if (p === "stores") return <>{crumbs}{hero}
    {STORES.length > 0 && <section><h2>Our stores</h2><p className="lead">Walk in, see the products, and order at the store price.</p>
      <div className="why stores">{STORES.map(s => <div key={s.name}><i className="kico"><Icon k="pin" /></i><b>{s.name}</b><p>{s.address}</p>{s.hours && <p className="muted">{s.hours}</p>}{s.map && <a className="alink" href={s.map} target="_blank" rel="noopener">Open in Maps →</a>}</div>)}</div></section>}
    <section><h2>Delivered to your door</h2><p className="lead">Check your pincode: free delivery, usually in 3 to 5 days, cash on delivery available.</p><PinCheck /></section>
    <section><h2>Shop the range</h2><p className="lead">Every model, every size, with the same promises as in store.</p><Cats /></section>
    <section><h2>How we work</h2><Promises /></section>
    {cta}</>;

  if (p === "buying-guide") return <>{crumbs}<div className="hc">
    <div className="hc-head"><span className="hc-eye">Buying guide</span><h1>How to choose the right TV</h1><p>Size, picture, smart system, sound and budget, in plain words, so you buy once and buy right.</p>
      <div className="hc-cta"><a className="d-btn" href="/televisions">Shop all TVs</a><a className="hc-ghost" href="/compare?ids=26,29,19">Compare three TVs</a></div></div>
    <nav className="hc-toc" aria-label="On this page">{[["size", "1. Size"], ["picture", "2. Picture"], ["system", "3. Smart system"], ["sound", "4. Sound and ports"], ["budget", "5. Budget"]].map(([id, t]) => <a href={"#" + id} key={id}>{t}</a>)}</nav>
    <section className="hc-sec" id="size"><h2>1. Start with the size</h2><p className="hc-lead">Measure from your sofa to the wall where the TV goes. Sit about 1.5 times the screen width away.</p>
      <div className="hc-table" role="table" aria-label="Screen size by viewing distance"><div role="row" className="th"><b role="columnheader">Screen</b><span role="columnheader">Sit this far away</span><span role="columnheader">Suits</span></div>{[["32 inch (80 cm)", "1.2 to 2 m", "Bedroom, kitchen, compact rooms", 32], ["43 inch (109 cm)", "1.6 to 2.5 m", "Small living room", 43], ["50 inch (126 cm)", "2 to 2.8 m", "Living room", 50], ["55 inch (140 cm)", "2 to 3 m", "Living room, 2 BHK", 55], ["65 inch (165 cm)", "2.5 to 3.5 m", "Large room", 65], ["75 to 85 inch", "3 to 4.5 m", "Home theatre", 75]].map(([a, b, c, n]) => <a role="row" href={"/televisions?size=" + n} key={a}><b role="cell">{a}</b><span role="cell">{b}</span><span role="cell">{c}</span></a>)}</div>
      <p className="hc-note">When in doubt, go one size up: most buyers wish they had.</p></section>
    <section className="hc-sec" id="picture"><h2>2. The picture</h2><div className="hc-three">
      <div><b>HD Ready</b><small className="hc-tag">1366 × 768</small><p>The most affordable. Right for 24 and 32 inch screens and everyday TV channels.</p></div>
      <div><b>Full HD</b><small className="hc-tag">1920 × 1080</small><p>Sharper; a good match for 40 to 43 inch and most streaming.</p></div>
      <div><b>4K Ultra HD</b><small className="hc-tag">3840 × 2160</small><p>Four times the detail of Full HD. The one to pick at 50 inch and above, for films, sport and games.</p></div></div>
      <div className="hc-two"><div className="hc-card"><h3>QLED</h3><p className="hc-p">A layer of quantum dots gives brighter, more saturated colour than a standard LED panel at a similar price.</p><a className="alink" href="/televisions?type=QLED">QLED TVs →</a></div><div className="hc-card"><h3>Mini-LED PRO</h3><p className="hc-p">Thousands of tiny backlight LEDs, with QLED colour, over 500 nits, Dolby Vision and HDR10: deeper blacks and brighter highlights.</p><a className="alink" href="/televisions?type=Mini-LED+PRO">Mini-LED TVs →</a></div></div></section>
    <section className="hc-sec" id="system"><h2>3. The smart system</h2><p className="hc-lead">It decides which apps you get and how you find them. Every one has YouTube and the major Indian streaming apps.</p>
      <div className="hc-two">{[...Object.entries(TV_OS).map(([n, o]) => [n, o.blurb]), ["Coolita OS", "Elista's own smart system with certified apps and a simple home screen."]].map(([n, b]) => <div className="hc-card" key={n}><h3>{n}</h3><p className="hc-p">{b}</p><a className="alink" href={"/televisions?os=" + encodeURIComponent(n)}>{n} TVs →</a></div>)}</div></section>
    <section className="hc-sec" id="sound"><h2>4. Sound and ports</h2><div className="hc-three">
      <div><b>HDMI ports</b><p>For a set-top box, a console and a soundbar. Two cover most homes; three leave room to grow.</p></div>
      <div><b>USB ports</b><p>Play your own films and photos from a pen drive or a hard disk.</p></div>
      <div><b>Sound</b><p>Built-in speakers suit everyday viewing; Dolby Audio or Atmos, or a soundbar, give a fuller sound.</p></div></div></section>
    <section className="hc-sec" id="budget"><h2>5. Your budget</h2><p className="hc-lead">Every price band we stock, with the number of models in it.{emiLow < Infinity ? " No Cost EMI from " + money(emiLow) + "/month." : ""}</p>
      <div className="hc-links">{[[0, 25000, "Under " + money(25000)], [25000, 50000, money(25000) + " to " + money(50000)], [50000, 100000, money(50000) + " to " + money(100000)], [100000, 0, "Above " + money(100000)]].map(([mn, mx, label]) => { const c = tvs.filter(x => (!mn || x.price >= mn) && (!mx || x.price < mx)).length; return <a href={listUrl({ cat: "Televisions", min: mn || "", max: mx || "" })} key={label}><b>{label}</b><small>{c} model{c === 1 ? "" : "s"}</small></a>; })}</div></section>
    <section className="hc-sec"><h2>Common questions</h2><Ask list={FAQ.filter(([q]) => /size|LED|Google TV|choose|difference/i.test(q)).map(([q, a]) => [q, a])} /></section>
    <Help /></div></>;

  if (p === "shipping") return <>{crumbs}<div className="hc">
    <div className="hc-head"><span className="hc-eye">Help · Delivery</span><h1>Delivery and tracking</h1><p>Free delivery across India, usually in 3 to 5 days, with cash on delivery if you prefer. Order today and it usually arrives by {etaText()}.</p>
      <div className="hc-cta"><a className="d-btn" href="/account?s=orders">Track my order</a><a className="hc-ghost" href="/shipping-policy">Read the shipping policy</a></div></div>
    <Facts list={[["truck", "Free delivery", "On every TV, whatever the size"], ["box", "3 to 5 days", "From the order being confirmed"], ["cash", "Cash on delivery", "No extra charge"], ["check", "SMS and email updates", "At every step, with a link to the order"]]} />
    <section className="hc-sec"><h2>Check your pincode</h2><p className="hc-lead">The delivery estimate for your area, before you order.</p><PinCheck /></section>
    <section className="hc-sec"><h2>From order to your door</h2><Steps list={[
      ["Placed", "You get an SMS, and an email when you gave one, with a link to your order."],
      ["Confirmed", "We check the order and call you if anything needs confirming."],
      ["Shipped", "Your TV leaves with the delivery partner, and your GST tax invoice is issued. The same link now opens it."],
      ["Delivered", "The delivery partner calls the mobile number on the order. Check the outer box before you accept it."],
    ]} /></section>
    <section className="hc-sec hc-two">
      <div className="hc-card"><h3>At your door</h3><ul><li>Someone over 18 must receive the TV.</li><li>If the outer box is visibly damaged, you may refuse the delivery; we arrange a replacement or a refund.</li><li>For cash on delivery, pay the exact amount shown on the order page.</li></ul></div>
      <div className="hc-card"><h3>If something goes wrong</h3><ul><li>If the delivery partner cannot reach you after repeated attempts, the order is cancelled and anything paid online is refunded in full.</li><li>Damage found on unboxing: tell us within {rd} days of delivery, with photos. <a className="alink" href="/returns">How returns work</a></li><li>Remote areas may take longer than the estimate.</li></ul></div></section>
    <section className="hc-sec"><h2>Common questions</h2><Ask list={[
      ["Is delivery really free?", "Yes. Delivery is free on every order, and there is no extra charge for cash on delivery."],
      ["Do you deliver outside India?", "Not yet. We deliver across India."],
      ["How do I track my order?", "Open My orders in your account, or the link in your SMS or email. Each order shows Placed, Confirmed, Shipped and Delivered."],
      ["Where is my invoice?", "Your GST tax invoice is issued when the TV ships. Open the order from My orders or the link in your messages, and print it or save it as a PDF."],
    ]} /></section>
    <Help /></div></>;

  if (p === "returns") return <>{crumbs}<div className="hc">
    <div className="hc-head"><span className="hc-eye">Help · Returns</span><h1>Returns and refunds</h1><p>Damaged, faulty, incomplete or not what you ordered? Tell us within {rd} days of delivery. The pickup is free, and the refund goes back the way you paid.</p>
      <div className="hc-cta"><a className="d-btn" href="/account?s=orders">Start a return</a><a className="hc-ghost" href="/refund-policy">Read the full policy</a></div></div>
    <Facts list={[["undo", rd + "-day returns", "From the day of delivery"], ["truck", "Free pickup", "From your address"], ["cash", "Refund in " + fd + " working days", "After the TV is checked"], ["box", "Free cancellation", "Any time before it ships"]]} />
    <section className="hc-sec"><h2>How to return a TV</h2><Steps list={[
      ["Open My orders", "Sign in and go to My orders. Every order is listed with its status.", ["Go to My orders", "/account?s=orders"]],
      ["Request a return", "Open the delivered order, choose Request a return and pick the reason: damaged, faulty, incomplete or not what you ordered. Keep photos of any damage."],
      ["We arrange a free pickup", "We call you on the order's mobile number to fix the pickup. Pack the TV with its remote, manuals, warranty card and original box."],
      ["Replacement or refund", "Once the TV is checked we send the same model if it is in stock, or refund you in full."],
    ]} /></section>
    <section className="hc-sec"><h2>When your refund arrives</h2><p className="hc-lead">Within {fd} working days of the returned TV being checked. Your bank may take a few more days to show it.</p>
      <div className="hc-table" role="table" aria-label="Refunds by payment method">{[["UPI", "To the same UPI account"], ["Credit or debit card", "To the same card"], ["Net banking", "To the same bank account"], ["No Cost EMI", "To your card; the bank closes the EMI plan on its own terms"], ["Cash on delivery", "To a bank account you give us"]].map(([m, w]) => <div role="row" key={m}><b role="cell">{m}</b><span role="cell">{w}</span></div>)}</div>
      <p className="hc-note">The refund is the amount you paid; a coupon discount is not paid out in cash.</p></section>
    <section className="hc-sec hc-two">
      <div className="hc-card ok"><h3><Icon k="check" />Can be returned</h3><ul><li>Damaged on arrival</li><li>Faulty or not working</li><li>Incomplete: a missing remote, stand or cable</li><li>Not what you ordered: the wrong model or size</li></ul><small>Reported within {rd} days of delivery, unused apart from a check that it works, with all accessories, manuals, the warranty card and the original box.</small></div>
      <div className="hc-card no"><h3><Icon k="undo" />Cannot be returned</h3><ul><li>Damage from mishandling, installation or use after delivery</li><li>Missing accessories, manuals, warranty card or box</li><li>Requests after the {rd}-day window (the brand's warranty still covers faults)</li></ul><small>Changed your mind? Cancel free of charge any time before the TV ships.</small></div></section>
    <section className="hc-sec"><h2>Cancelling an order</h2><div className="hc-three">
      <div><b>Before it ships</b><p>Open the order in My orders and choose Cancel order. Anything paid is refunded in full.</p></div>
      <div><b>After it ships</b><p>Refuse it at the door, or request a return within {rd} days of delivery.</p></div>
      <div><b>If we cannot fulfil it</b><p>We cancel the order and refund anything paid in full.</p></div></div></section>
    <section className="hc-sec hc-after"><div><h2>After the {rd} days</h2><p>Faults are covered by the manufacturer's warranty, 1 year or 1 + 1 years depending on the model, serviced through the brand's network. We help you reach it.</p></div><a className="hc-ghost" href="/warranty">Warranty by model</a></section>
    <section className="hc-sec"><h2>Common questions</h2><Ask list={[
      ["Is the pickup free?", "Yes. We arrange it and you pay nothing for it."],
      ["Do I need the original box?", "Yes. The TV goes back with its remote, manuals, warranty card and original packaging."],
      ["Can I return a TV I no longer want?", `Returns are for a TV that is damaged, faulty, incomplete or not what you ordered, reported within ${rd} days of delivery. You can cancel any order free of charge before it ships.`],
      ["How is a cash on delivery order refunded?", `To a bank account you give us, within ${fd} working days of the TV being checked.`],
      ["The box looked damaged at delivery. What do I do?", "You may refuse the delivery, and we arrange a replacement or a refund. If you accepted it and find damage on unboxing, request a return with photos."],
    ]} /></section>
    <Help /></div></>;

  return null;
}

// the contact form: the message lands in the store's admin outbox (Customer messages), even before an email provider is connected
function ContactForm() {
  const [done, setDone] = useState(false);
  if (done) return <div className="box sent"><h3>Thank you.</h3><p>We have your message and will reply to your email.</p><a className="btn" href="/">Back to home</a></div>;
  return <Form className="form cform" onSubmit={async f => { await api("contact", "POST", f); setDone(true); }} after={busy => <button className="btn" disabled={busy}>Send message</button>}>
    <label>Your name<input name="name" required maxLength="80" autoComplete="name" /></label>
    <label>Email<input name="email" type="email" required maxLength="120" autoComplete="email" /></label>
    <label>Message<textarea name="message" rows="5" required maxLength="2000" placeholder="Your question, with your order number if you have one"></textarea></label>
  </Form>;
}
