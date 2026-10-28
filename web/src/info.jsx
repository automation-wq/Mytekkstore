// Info pages: About, Contact, Store locator, Shipping, Returns, Terms, Privacy. Each is a full page in the store's design language,
// not a paragraph of placeholder text. Facts about the store come from the catalogue or from how this site actually works (see
// server.js). The policy pages are drafts for the client to confirm before launch (README, "Before launch"); their numbers live in
// POLICY in data.js, and the contact details and store list in CONTACT and STORES there.
import { useEffect, useRef, useState } from "react";
import { useStore } from "./store.jsx";
import { api, qs } from "./api.js";
import { Row, Form, Icon, KvImg, Qa } from "./components.jsx";
import { KV_IMG, CAT_SIZE, BANK_OFFERS, FAQ, CONTACT, STORES, POLICY, SHOW_STORES, WARRANTY_QA, BRAND_BLURB, catSizes, catUrl, brandUrl, listUrl, off, etaText } from "./data.js";
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

  const one = CATS.length === 1 ? CATS[0] : "", sizes = one ? catSizes(P, one).all : [];
  if (p === "about") return <>{crumbs}{hero}
    <div className="num" ref={numRef}>{[[P.length, "", "Models", one ? one.toLowerCase() + (sizes.length > 1 ? ", " + sizes.length + " sizes" : "") : "across " + CATS.length + " categories"], [BRANDS.length, "", "Brands", BRANDS.join(" and ")], [BANK_OFFERS.length, "", "Bank offers", "plus No Cost EMI"], [100, "%", "Genuine", "brand warranty on everything"]]
      .map(([n, suf, t, s]) => <div key={t}><b><i data-n={n}>0</i>{suf}</b><span>{t}</span><small>{s}</small></div>)}</div>
    <section><h2>What we sell</h2><p className="lead">{one ? "Every " + one.toLowerCase().replace(/s$/, "") + " we stock, in every size, from " + BRANDS.join(" and ") + "." : CATS.length + " categories, every size we stock, from " + BRANDS.join(" and ") + "."}</p><Cats /></section>
    <section><h2>The brands</h2><p className="lead">{BRANDS.join(" and ")}, side by side on every category page.</p>
      <div className="why brands2">{BRANDS.map(b => { const ps = P.filter(x => x.brand === b); return <div key={b}><b className="bigb">{b}</b><p>{brandBlurb[b] || `${ps.length} products in our range.`}</p><a className="alink" href={brandUrl(b)}>Shop {b} · {ps.length} product{ps.length === 1 ? "" : "s"} →</a></div>; })}</div></section>
    <section><h2>How we work</h2><p className="lead">The same four promises on every order.</p><Promises /></section>
    <Faq list={FAQ} lead="Short answers before you order." />
    {cta}</>;

  if (p === "contact") return <>{crumbs}{hero}
    <section><h2>Write to us</h2><p className="lead">Tell us what you need and we reply to the email you give.</p>
      <div className="contact">
        <ContactForm />
        <div className="ways">
          {CONTACT.phone && <a className="way" href={"tel:" + CONTACT.phone.replace(/\s/g, "")}><i className="kico"><Icon k="user" /></i><b>Call us</b><span>{CONTACT.phone}</span>{CONTACT.hours && <small>{CONTACT.hours}</small>}</a>}
          {CONTACT.email && <a className="way" href={"mailto:" + CONTACT.email}><i className="kico"><Icon k="tag" /></i><b>Email</b><span>{CONTACT.email}</span></a>}
          {CONTACT.address && <div className="way"><i className="kico"><Icon k="pin" /></i><b>Visit</b><span>{CONTACT.address}</span></div>}
          <a className="way" href="/account"><i className="kico"><Icon k="box" /></i><b>Track an order</b><span>Every order shows its status from Placed to Delivered in your account.</span></a>
          <a className="way" href="/returns"><i className="kico"><Icon k="undo" /></i><b>Return something</b><span>How returns and refunds work, step by step.</span></a>
          <a className="way" href="/shipping"><i className="kico"><Icon k="truck" /></i><b>Delivery questions</b><span>Where we deliver, how long it takes, and how to check your pincode.</span></a>
        </div></div></section>
    <Faq list={FAQ} lead="The questions we are asked most." />
    {cta}</>;

  if (p === "stores") return <>{crumbs}{hero}
    {STORES.length > 0 && <section><h2>Our stores</h2><p className="lead">Walk in, see the products, and order at the store price.</p>
      <div className="why stores">{STORES.map(s => <div key={s.name}><i className="kico"><Icon k="pin" /></i><b>{s.name}</b><p>{s.address}</p>{s.hours && <p className="muted">{s.hours}</p>}{s.map && <a className="alink" href={s.map} target="_blank" rel="noopener">Open in Maps →</a>}</div>)}</div></section>}
    <section><h2>Delivered to your door</h2><p className="lead">Check your pincode: free delivery, usually in 3 to 5 days, cash on delivery available.</p><PinCheck /></section>
    <section><h2>Shop the range</h2><p className="lead">Every model, every size, with the same promises as in store.</p><Cats /></section>
    <section><h2>How we work</h2><Promises /></section>
    {cta}</>;

  // Delivery and Returns as help pages in the pattern of Amazon's help centre (28 Oct): a plain heading with the next action, the key
  // facts, the real steps on this site, then the details. Every rule here is the one in the Shipping and the Refund policies.
  const Facts = ({ list }) => <div className="hc-facts">{list.map(([ic, t, s]) => <div key={t}><span className="hc-ic"><Icon k={ic} /></span><b>{t}</b><small>{s}</small></div>)}</div>;
  const Steps = ({ list }) => <ol className="hc-steps">{list.map(([t, s, link], i) => <li key={t}><span className="hc-n">{i + 1}</span><div><b>{t}</b><p>{s}</p>{link && <a className="alink" href={link[1]}>{link[0]} →</a>}</div></li>)}</ol>;
  const Ask = ({ list }) => <div className="hc-faq">{list.map(([q, x]) => <details key={q}><summary>{q}</summary><p>{x}</p></details>)}</div>;
  const Help = () => <div className="hc-help"><span className="hc-ic"><Icon k="user" /></span><div><b>Still need help?</b><p>Write to us with your order number and we reply by email.</p></div><a className="d-btn" href="/contact">Contact us</a></div>;
  const rd = POLICY.returnDays, fd = POLICY.refundDays;

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

  if (p === "buying-guide") return <>{crumbs}{hero}
    <section><h2>Start with the size</h2><p className="lead">The right screen size depends on how far you sit from it — here is a rough guide.</p>
      <div className="scroll"><table className="gtable"><thead><tr><th>Screen size</th><th>Best viewing distance</th><th>Good for</th></tr></thead><tbody>
        {[["32 inch", "1.2 – 1.8 m", "Bedrooms, kitchens, compact rooms"], ["43 inch", "1.8 – 2.2 m", "Everyday living-room viewing"], ["50 – 55 inch", "2.0 – 2.6 m", "The living-room favourite"], ["65 inch", "2.5 – 3.0 m", "A cinematic main TV"], ["75 inch and up", "3.0 m and more", "Large rooms and home cinema"]].map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}
      </tbody></table></div>
      <p className="muted">Sit too close to a big screen and you notice the pixels; sit too far from a small one and you miss the detail. When in doubt, go one size up.</p>
      <a className="alink" href="/televisions">Shop TVs by size →</a></section>
    <section><h2>Resolution: how sharp the picture is</h2><Policy sections={[
      ["HD Ready (1366 × 768)", "The most affordable. Good for smaller screens around 32 inch and for normal TV channels."],
      ["Full HD (1920 × 1080)", "Sharper, a good match for 40 to 43 inch and for most streaming."],
      ["4K Ultra HD (3840 × 2160)", "Four times the detail of Full HD. The standard for 50 inch and above, and the one to pick for films, sport and gaming."],
    ]} /></section>
    <section><h2>The operating system</h2><p className="lead">The smart system is how you find apps like YouTube and your streaming services.</p>
      <div className="why"><div><i className="kico"><Icon k="check" /></i><b>Google TV</b><p>Apps from Google Play, Google Assistant on the remote and Chromecast built in — one home screen that gathers your shows.</p></div>
        <div><i className="kico"><Icon k="check" /></i><b>WebOS</b><p>A quick card-style home screen with the streaming apps built in, and no set-top box needed.</p></div></div>
      <a className="alink" href="/televisions#os">Compare the operating systems side by side →</a></section>
    <section><h2>Connections to check</h2><Policy sections={[
      ["HDMI ports", "For a set-top box, a game console and a soundbar. Two covers most homes; three leaves room to grow."],
      ["USB ports", "For a pen drive or hard disk, to play your own films and photos."],
      ["Sound", "Built-in speakers are fine for everyday viewing; look for Dolby Audio, or add a soundbar, for a fuller sound."],
    ]} /></section>
    <section><h2>Match it to your budget</h2><p className="lead">Every range we stock, at a glance.</p>
      <div className="bgrid">{[[0, 10000, "Under " + money(10000)], [10000, 25000, money(10000) + " – " + money(25000)], [25000, 50000, money(25000) + " – " + money(50000)], [50000, 0, "Above " + money(50000)]].map(([mn, mx, label]) => { const c = P.filter(x => x.cat === "Televisions" && (!mn || x.price >= mn) && (!mx || x.price <= mx)).length; return <a className="bcard" href={listUrl({ cat: "Televisions", min: mn || "", max: mx || "" })} key={label}><span><b>{label}</b><small>{c} TV{c === 1 ? "" : "s"}</small></span><i aria-hidden="true">→</i></a>; })}</div></section>
    <Faq list={FAQ.filter(([q]) => /size|LED|Google TV|choose|difference/i.test(q))} lead="More questions before you buy." />
    {cta}</>;

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
