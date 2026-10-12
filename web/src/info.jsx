// Info pages: About, Contact, Store locator, Shipping, Returns, Terms, Privacy. Each is a full page in the store's design language,
// not a paragraph of placeholder text. Facts about the store come from the catalogue or from how this site actually works (see
// server.js). The policy pages are drafts for the client to confirm before launch (README, "Before launch"); their numbers live in
// POLICY in data.js, and the contact details and store list in CONTACT and STORES there.
import { useEffect, useRef, useState } from "react";
import { useStore } from "./store.jsx";
import { api, qs } from "./api.js";
import { Row, Form, Icon, KvImg, Qa } from "./components.jsx";
import { KV_IMG, CAT_CLIPS, CAT_SIZE, BANK_OFFERS, FAQ, CONTACT, STORES, POLICY, SHOW_STORES, WARRANTY_QA, catUrl, brandUrl, listUrl, off, etaText } from "./data.js";
import { countUp } from "./motion.js";

const PAGES = {
  about: ["About Mytekkstore", "Mytekkstore", "Good electronics, made simple.", "Televisions, washing machines and air conditioners from Elista and Telefunken, delivered free with cash on delivery.", "Televisions"],
  contact: ["Contact us", "Help", "We are here to help.", "Orders, delivery, returns and service. Write to us and we reply by email.", "Washing Machines"],
  stores: ["Store locator", "Visit us", "Find a store.", "Store addresses are being added. Until then, every product ships free to your door.", "Air Conditioners"],
  shipping: ["Shipping and delivery", "Delivery", "Free delivery, every order.", "Across India, usually in 3 to 5 days, with cash on delivery if you prefer.", "Televisions"],
  returns: ["Returns and refunds", "Returns", "Easy returns, no drama.", `Tell us within ${POLICY.returnDays} days of delivery and we take it from there.`, "Washing Machines"],
  terms: ["Terms of use", "Terms", "The short version, in plain words.", "What you agree to when you order from Mytekkstore.", "Air Conditioners"],
  privacy: ["Privacy policy", "Privacy", "Your data, kept to a minimum.", "What we store, why we store it, and what we never do with it.", "Televisions"],
};

// the opener every info page starts with: the category photo with its room clip, an eyebrow, a headline and one line
function Hero({ eyebrow, title, sub, cat }) {
  return <div className="kv pagehero"><div className="kvimg"><KvImg src={`img/${KV_IMG[cat]}.jpg`} sizes="(max-width:1240px) 100vw, 1240px" eager /></div>
    {CAT_CLIPS[cat] && <video className="bvid" muted loop playsInline preload="none" data-src={`/img/${CAT_CLIPS[cat]}.mp4`} aria-hidden="true"></video>}
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
  const p = qs.get("p"), page = Object.hasOwn(PAGES, p) && (p !== "stores" || SHOW_STORES) ? PAGES[p] : null; // the store locator is hidden (client decision 2026-10-12)
  const numRef = useRef();
  useEffect(() => { document.title = (page ? page[0] : "Page not found") + " | Mytekkstore"; }, []);
  useEffect(() => { if (numRef.current) countUp(numRef.current); }, [P]);
  if (!page) return <><div className="crumbs"><a href="/">Home</a> › Page not found</div><div className="box"><h1>Page not found</h1><p>This page does not exist.</p><a className="btn" href="/">Back to home</a></div></>;
  const [title, eyebrow, head, sub, cat] = page;
  const deals = [...P].sort((a, b) => off(b) - off(a)).slice(0, 5);
  const maxOff = Math.max(0, ...P.map(off));
  const brandBlurb = { Elista: "An Indian consumer electronics brand making televisions, washing machines and air conditioners for Indian homes, each with the brand's own warranty.",
    Telefunken: "A German electronics name since 1903, sold in India under licence, with televisions and home appliances built to the brand's standard." };
  const crumbs = <div className="crumbs"><a href="/">Home</a> › {title}</div>;
  const hero = <Hero eyebrow={eyebrow} title={head} sub={sub} cat={cat} />;
  const cta = <section><a className="cban" href="/offers"><KvImg className="cph" src={`img/${KV_IMG[cat]}.jpg`} sizes="(max-width:1240px) 100vw, 1240px" /><div><span className="kicker">Festive offers</span><h2>Up to {maxOff}% off</h2><p>Bank offers and No Cost EMI on the models that carry it · free delivery · cash on delivery</p><u>See the deals →</u></div></a></section>;

  if (p === "about") return <>{crumbs}{hero}
    <div className="num" ref={numRef}>{[[P.length, "", "Products", "across " + CATS.length + " categories"], [BRANDS.length, "", "Brands", BRANDS.join(" and ")], [BANK_OFFERS.length, "", "Bank offers", "plus No Cost EMI"], [100, "%", "Genuine", "brand warranty on everything"]]
      .map(([n, suf, t, s]) => <div key={t}><b><i data-n={n}>0</i>{suf}</b><span>{t}</span><small>{s}</small></div>)}</div>
    <section><h2>What we sell</h2><p className="lead">Three categories, every size we stock, from two brands.</p><Cats /></section>
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

  if (p === "shipping") return <>{crumbs}{hero}
    <section><h2>How delivery works</h2><p className="lead">Order today and it usually arrives by {etaText()}.</p><Promises /></section>
    <section><h2>Check your pincode</h2><p className="lead">The delivery estimate for your area, before you order.</p><PinCheck /></section>
    <section><h2>The details</h2><Policy sections={[
      ["Where we deliver", "Across India. Enter your pincode on any product page, at checkout, or above, to check your area and see the estimate."],
      ["How long it takes", "Usually 3 to 5 days from the day you order. Large items such as televisions and washing machines travel with care, so the estimate is a range, not a promise to the hour."],
      ["What it costs", "Nothing. Delivery is free on every order, whatever the size."],
      ["Paying on delivery", "Choose cash on delivery at checkout and pay when the order reaches you."],
      ["Tracking", "Sign in and open your account. Every order shows its status from Placed to Confirmed, Shipped and Delivered."],
      ["If something is wrong", `Check the product when it arrives. If it is damaged or not what you ordered, tell us within ${POLICY.returnDays} days and we arrange a pickup.`],
    ]} /></section>
    <Faq list={FAQ.filter(([q]) => /deliver|pay|track|return/i.test(q))} />
    {cta}</>;

  if (p === "returns") return <>{crumbs}{hero}
    <section><h2>Three steps</h2><p className="lead">How a return works, start to finish.</p>
      <div className="why steps3">{[["Tell us", `Within ${POLICY.returnDays} days of delivery, from your account or through the contact page, with your order number.`], ["We pick it up", "Keep the product unused, with its accessories and original packaging. We arrange the pickup; you pay nothing for it."], ["You get your money back", `Once the product is checked, the refund goes back the way you paid, usually within ${POLICY.refundDays} working days. Cash on delivery orders are refunded to your bank account.`]]
        .map(([t, s], i) => <div key={t}><span className="pnum">{String(i + 1).padStart(2, "0")}</span><b>{t}</b><p>{s}</p></div>)}</div></section>
    <section><h2>The details</h2><Policy sections={[
      ["What can be returned", "Any product that is unused, undamaged and complete, in its original packaging, reported within the return window."],
      ["What cannot", "Products that have been installed, used or damaged after delivery, and products missing accessories or packaging."],
      ["Replacements", "If the product arrived damaged or faulty, we replace it with the same model when it is in stock, or refund you in full."],
      ["Warranty after the return window", "Every product carries the brand's warranty. After the return window, service and repairs go through the brand's service network, and we help you reach it."],
    ]} /></section>
    <Qa title="Warranty" lead="How to claim it, and what to expect." list={WARRANTY_QA} />
    <Faq list={FAQ.filter(([q]) => /genuine|track/i.test(q))} />
    {cta}</>;

  if (p === "terms") return <>{crumbs}{hero}
    <section><h2>Terms of use</h2><p className="lead">By placing an order on Mytekkstore you agree to these terms.</p><Policy sections={[
      ["Orders and prices", "Prices are shown in Indian rupees and include all taxes. Prices and stock are checked again when you place the order, never taken from the page alone. An order is confirmed when we accept it, and we may decline an order we cannot fulfil, with a full refund of anything paid."],
      ["Payment", "Pay by cash on delivery or by the online methods shown at checkout. No card details are stored by Mytekkstore."],
      ["Delivery", "Delivery is free. The estimate shown is usual, not guaranteed. See the Shipping and delivery page."],
      ["Cancellation", "You can cancel an order before it is shipped from your account or by contacting us. After shipping, the returns policy applies."],
      ["Returns and warranty", `Returns are accepted within ${POLICY.returnDays} days of delivery under the returns policy. Every product carries the manufacturer's warranty, serviced by the brand's network.`],
      ["Your account", "Keep your sign-in details to yourself. You are responsible for orders placed from your account."],
      ["Content", "Product names, photos and descriptions are provided for your information. Obvious errors in price or description may be corrected, and an affected order cancelled with a full refund."],
      ["Law", "These terms are governed by the laws of India."],
    ]} /></section>
    {cta}</>;

  if (p === "privacy") return <>{crumbs}{hero}
    <section><h2>Privacy policy</h2><p className="lead">The whole story of what this site keeps about you.</p><Policy sections={[
      ["What we collect", "Your name, email address or mobile number, delivery address and pincode, your orders, and the reviews you write. Your cart, wishlist, pincode and country choice are kept in your own browser, not on our servers, until you order."],
      ["Why we collect it", "To deliver your orders, to send order updates and sign-in codes by SMS or email, and to show you your order history."],
      ["Payments", "No card details are stored by Mytekkstore. Online payments are handled by the payment provider shown at checkout."],
      ["Cookies", "One cookie keeps you signed in. There are no advertising cookies." + (CFG.clarity ? " Microsoft Clarity records how pages are used (clicks, scrolling, time on page) to improve the site; anything you type is masked. See Microsoft's privacy statement for how Microsoft handles that data." : " There are no tracking cookies.")],
      ["Who sees it", "Delivery partners see your name, address and phone number to deliver the order. Our messaging providers see your number or email to send codes and updates. Your data is never sold."],
      ["Security", "Passwords are stored hashed, never in plain text. The site is served over https."],
      ["Your choices", "Sign out from your account at any time. To correct or delete your account data, write to us through the contact page."],
    ]} /></section>
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
