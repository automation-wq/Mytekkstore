// Offers, cart, checkout, order, info and not-found pages (the home page is in home.jsx).
import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { useStore } from "./store.jsx";
import { api, qs, demoPay, track } from "./api.js";
import { Card, Row, Strip, Box, Line, OrderItems, BankOffers, Form, Ico, Icon, Photo, locateMe } from "./components.jsx";
import { DRAW_ICONS, STEPS, FESTIVE, KV_IMG, POLICY, catUrl, brandUrl, listUrl, off, etaText, pic, emiPlans } from "./data.js";
import { reveal } from "./motion.js";
import { FestiveBanner } from "./home.jsx"; // the brochure festive banner opens the offers page too

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export { Home } from "./home.jsx";

// the festive offers page: Deals in the bar and the wide banner on the home page open it
export function Offers() {
  const { P, CATS, catImg, money } = useStore();
  const [left, setLeft] = useState(0);
  const tvs = P.filter(p => p.cat === "Televisions"), minEmi = tvs.some(p => p.emi) ? Math.min(...tvs.filter(p => p.emi).map(p => emiPlans(p.price)[2][1])) : 0; // the banner's figures, as on the home page
  useEffect(() => { document.title = FESTIVE.title + " | Mytekkstore"; if (!FESTIVE.ends) return; const t = setInterval(() => setLeft(Math.max(0, Math.floor((new Date(FESTIVE.ends) - Date.now()) / 1000))), 1000); return () => clearInterval(t); }, []);
  const deals = P.some(p => off(p) > 0) ? P.filter(p => off(p) > 0).sort((a, b) => off(b) - off(a)) : tvs.filter(p => p.emi).sort((a, b) => a.price - b.price); // without a discount in the catalogue (27 Oct): the No Cost EMI models, lowest price first
  const maxOff = c => Math.max(0, ...P.filter(p => !c || p.cat === c).map(off)); // real figures from the catalogue
  const cells = [left / 86400, left / 3600 % 24, left / 60 % 60, left % 60].map(v => String(Math.floor(v)).padStart(2, "0"));
  return <>
    <div className="crumbs"><a href="/">Home</a> › Offers</div>
    <h1 className="srh">{FESTIVE.title}</h1>
    <FestiveBanner tvs={tvs} maxOff={maxOff()} minEmi={minEmi} money={money} href={listUrl({ cat: "Televisions", sort: "off" })} cta="See every TV deal →" />
    {FESTIVE.ends && <div className="fest"><div className="cdown" aria-label="Time left">{["Days", "Hours", "Minutes", "Seconds"].map((l, i) => <div key={l}><b>{cells[i]}</b><span>{l}</span></div>)}</div></div>}
    {CATS.length > 1 && <section><h2>Offers by category</h2><p className="lead">The biggest discount in each category right now.</p><div className="ftiles">{CATS.map(c => <a className="ftile" href={listUrl({ cat: c, sort: "off" })} key={c}><span><b>Up to {maxOff(c)}% off</b>{c}</span><img src={pic(catImg(c), 480)} alt="" loading="lazy" width="800" height="800" /></a>)}</div></section>}
    <section><h2>{maxOff() > 0 ? "Top deals" : "No Cost EMI picks"} <a href="/products?sort=off">View all</a></h2><p className="lead">{maxOff() > 0 ? "Sorted by discount, biggest first." : "Pay monthly with no extra interest, lowest price first."}</p><div className="grid">{deals.slice(0, 8).map(p => <Card p={p} key={p.id} />)}</div></section>
    <BankOffers />
    <section><div className="emiband"><div><p className="kicker">No Cost EMI</p><h2>Pay in easy monthly instalments</h2><p>Products marked "No Cost EMI" can be paid for in 3, 6 or 9 monthly instalments on participating bank credit cards, with no extra interest.</p></div><a className="btn" href="/products">Shop now</a></div></section>
    <p className="muted small" style={{ marginTop: 24 }}>Offers depend on bank terms and stock. Discounts are against the MRP.</p>
  </>;
}

export function Cart() {
  const { P, cart, byId, money, cartCount, cartTotal } = useStore();
  useEffect(() => { document.title = "Cart | Mytekkstore"; }, []);
  if (!cartCount()) return <><Box title="Your cart is empty" text="Add something you like and it will show up here." href="/" cta="Continue shopping" />
    <Row title="Deals of the Day" href="/products?sort=off" list={[...P].sort((a, b) => off(b) - off(a)).slice(0, 5)} /></>;
  return <>
    <h1 className="ptitle">Your cart <span className="muted">({cartCount()})</span></h1>
    <div className="cols">
      <div className="lines panel"><AnimatePresence initial={false}>{Object.keys(cart).map(id => <m.div layout key={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ type: "spring", stiffness: 320, damping: 32 }}><Line p={byId(id)} /></m.div>)}</AnimatePresence></div>
      <aside className="panel sum"><h3>Order summary</h3>
        <div className="tot"><span>Items ({cartCount()})</span><span>{money(cartTotal())}</span></div>
        <div className="tot"><span>Delivery</span><span className="free">Free</span></div>
        <div className="tot grand"><span>Total</span><b>{money(cartTotal())}</b></div>
        <a className="btn" href="/checkout">Proceed to checkout</a><a className="btn ghost" href="/">Continue shopping</a><div className="perks"><span><Icon k="truck" /> Free delivery</span><span><Icon k="cash" /> Cash on delivery</span><span><Icon k="undo" /> Easy returns</span><span><Icon k="shield" /> Brand warranty</span></div></aside>
    </div>
    <Row title="You may also like" href="/products?sort=off" list={P.filter(p => !cart[p.id] && p.stock > 0).sort((a, b) => off(b) - off(a)).slice(0, 5)} />
  </>;
}

export function Checkout() {
  const { me, cart, byId, money, cartCount, cartTotal, clearCart } = useStore();
  const { CFG: payCfg } = useStore(); // pay: "razorpay" once the server has gateway keys; payDemo: the test window, on a local copy only
  useEffect(() => { if (payCfg && payCfg.pay === "razorpay" && !document.querySelector('script[src^="https://checkout.razorpay.com/"]')) { const sc = document.createElement("script"); sc.src = "https://checkout.razorpay.com/v1/checkout.js"; sc.async = true; document.head.appendChild(sc); } }, [payCfg && payCfg.pay]);
  const [where, setWhere] = useState({ city: "", state: "" }), [pinMsg, setPinMsg] = useState(""), [locating, setLocating] = useState(false), [osm, setOsm] = useState(false);
  const [err, setErr] = useState("");
  const placeRef = useRef(); // above the early returns (React error 300 once the cart empties after an order)
  const saved = (me && me.addresses) || [], dfltAddr = saved.find(a => a.isDefault) || saved[0];
  const [addrId, setAddrId] = useState(dfltAddr ? dfltAddr.id : "new"); // a saved address card, or "new" for the form
  const [label, setLabel] = useState("Home"), [pay, setPay] = useState("cod");
  const wallet = ((me && me.coupons) || []).find(c => !c.used && new Date(c.expires) > new Date());
  const [coupon, setCoupon] = useState(""), [couponMsg, setCouponMsg] = useState("");
  const [discount, setDiscount] = useState(0); // the server's answer, the same rule the order route enforces
  const applyCoupon = async code => { const v = (code || "").trim().toUpperCase(); setCoupon(v); setDiscount(0); if (!v) return setCouponMsg(""); try { const r = await api("coupons/validate", "POST", { code: v, items: Object.entries(cart).map(([id, qty]) => ({ id: +id, qty })) }); setDiscount(r.discount); setCouponMsg(""); } catch (e) { setCouponMsg(e.message); } };
  useEffect(() => { document.title = "Checkout | Mytekkstore"; }, []);
  useEffect(() => { if (cartCount()) track("begin_checkout", { value: cartTotal(), signedIn: !!me }); if (cartCount() && !me) location.replace("/account?next=/checkout"); else if (cartCount() && me && !me.phoneVerified) location.replace("/account?verify=1&next=%2Fcheckout"); }, []); // customers must sign in, with a verified mobile number, before checkout
  // the pincode fills city and state from India Post (both stay editable)
  const lookupPin = async v => { setPinMsg(""); if (!/^\d{6}$/.test(v)) return; try { const d = await api("pincode/" + v); if (d.district) { setWhere({ city: d.district, state: d.state }); setPinMsg("Delivers to " + d.district + ", " + d.state); } } catch {} };
  useEffect(() => { if (me && !saved.length) lookupPin(me.pin || ""); }, [me && me.id]); // above the early returns
  if (!cartCount()) return <Box title="Nothing to check out" text="Your cart is empty." href="/" cta="Continue shopping" />;
  if (!me) return null;
  const items = Object.keys(cart).map(byId).filter(Boolean), count = Object.values(cart).reduce((n, q) => n + q, 0), emiAny = items.some(p => p.emi);
  const live = !!(payCfg && payCfg.pay === "razorpay"), canOnline = live || !!(payCfg && payCfg.payDemo);
  const mrpTotal = items.reduce((t, p) => t + Math.max(p.mrp || 0, p.price) * cart[p.id], 0), mrpOff = mrpTotal - cartTotal(), total = cartTotal() - discount, saving = mrpOff + discount;
  const placeOrder = async f => {
    setErr("");
    try {
      const items = Object.entries(cart).map(([id, qty]) => ({ id: +id, qty }));
      const picked = addrId !== "new" ? saved.find(a => a.id === addrId) : null;
      if (picked) Object.assign(f, { name: picked.name, phone: picked.phone, address: [picked.line1, picked.line2, picked.landmark, picked.city + ", " + picked.state].filter(Boolean).join(", "), pin: picked.pin });
      else {
        f.phone = "+91" + String(f.phone10 || "").replace(/\D/g, "");
        f.address = [f.line1, f.line2, f.landmark && "Near " + f.landmark, f.city + ", " + f.state].map(s => (s || "").trim()).filter(Boolean).join(", ");
        if (f.saveAddr) try { await api("me/addresses", "POST", { label, name: f.name, phone: f.phone, line1: f.line1, line2: f.line2, landmark: f.landmark, city: f.city, state: f.state, pin: f.pin }); } catch {} // a full address book never stops the order
      }
      f.coupon = discount ? coupon : "";
      const online = pay !== "cod";
      let id;
      if (online && live && window.Razorpay) { // the gateway's own checkout; the server verifies the signature before the order counts
        const o = await api("pay/order", "POST", { name: f.name, phone: f.phone, address: f.address, pin: f.pin, items, coupon: f.coupon });
        await new Promise((res, rej) => { const rz = new window.Razorpay({ key: o.keyId, order_id: o.providerOrderId, amount: o.amount, currency: o.currency, name: "Mytekkstore", description: "Order " + o.id, prefill: { name: f.name, contact: f.phone, email: o.email || "" }, theme: { color: "#111111" },
          modal: { ondismiss: () => rej(new Error("The payment was not completed. Nothing was charged; you can try again.")) },
          handler: async r => { try { await api("pay/verify", "POST", { id: o.id, razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature }); res(); } catch (e) { rej(e); } } }); rz.open(); });
        id = o.id;
      } else {
        if (online) await demoPay(pay, money(total)); // the local test window only (the server refuses it on the live site)
        ({ id } = await api("orders", "POST", { name: f.name, phone: f.phone, address: f.address, pin: f.pin, pay: online ? "online" : "cod", items, coupon: f.coupon }));
      }
      track("purchase", { transaction_id: id, value: total, items });
      clearCart();
      location.href = "/order?id=" + id;
    } catch (e) {
      if (/sign in/i.test(e.message || "")) { location.href = "/account?next=%2Fcheckout&expired=1"; return; } // a sign-in the server no longer knows: back to sign in, with the reason
      setErr(e.message || "Something went wrong. Please try again.");
    }
  };
  const PAY = [["cod", "Cash on delivery", "Pay at your door when the TV arrives", "cash"], ["UPI", "UPI", "Google Pay, PhonePe, Paytm or any UPI app", "bolt"], ["Card", "Credit or debit card", emiAny ? "Visa, Mastercard, RuPay · No Cost EMI on HDFC, ICICI, SBI, Axis and Kotak" : "Visa, Mastercard, RuPay", "cart"], ["Net banking", "Net banking", "All major Indian banks", "shield"]];
  const placeBtn = cls => <button type="submit" form="ckform" className={"co-place ck-place " + cls} ref={cls === "main" ? placeRef : undefined} onClick={e => { const b = e.currentTarget; setTimeout(() => { b.disabled = true; }, 0); setTimeout(() => { b.disabled = false; }, 6000); }}>{cls === "bar" ? "Place order" : "Place order · " + money(total)}</button>;
  return <div className="co">
    <ol className="co-steps" aria-label="Checkout steps"><li className="done"><a href="/cart"><i><Icon k="check" /></i><span>Cart</span></a></li><li className="on" aria-current="step"><i>2</i><span>Delivery &amp; payment</span></li><li><i>3</i><span>Confirmation</span></li></ol>
    <div className="co-cols">
      <Form className="co-main" id="ckform" onSubmit={placeOrder} after={() => null}>
        <section className="co-card"><div className="co-hd"><span className="co-n">1</span><div><h2>Delivery address</h2><p>Signed in as {me.phone || me.email}</p></div></div>
          {saved.length > 0 && <div className="co-addrs ck-addrs" role="radiogroup" aria-label="Saved addresses">{saved.map(a => <label className={"co-addr" + (addrId === a.id ? " on" : "")} key={a.id}><input type="radio" name="addrId" value={a.id} checked={addrId === a.id} onChange={() => setAddrId(a.id)} /><span><b>{a.name} <em>{a.label}</em>{a.isDefault && <em className="dflt">Default</em>}</b>{[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}<br />{a.city}, {a.state} {a.pin}<br /><small>{a.phone}</small></span></label>)}
            <label className={"co-addr new" + (addrId === "new" ? " on" : "")}><input type="radio" name="addrId" value="new" checked={addrId === "new"} onChange={() => setAddrId("new")} /><span><b>+ Add a new address</b>Deliver somewhere else</span></label></div>}
          {(addrId === "new" || !saved.length) && <div className="co-grid">
            <div className="co-wide co-locrow"><button type="button" className="co-locate" disabled={locating} onClick={async () => { // the phone's position fills pincode, city, state and area; every field stays editable
              setLocating(true); setPinMsg("Finding your location…");
              try { const g = await locateMe(), f = document.getElementById("ckform"); setOsm(g.source === "osm"); if (g.postalCode) { f.pin.value = g.postalCode; } if (g.area && !f.line2.value) f.line2.value = g.area; setWhere({ city: g.city || "", state: g.state || "" }); setPinMsg(g.postalCode ? "Filled from your location. Add your flat or house number below." : "We found " + (g.city || "your area") + "; please type the pincode."); if (g.postalCode) lookupPin(g.postalCode).then(() => setPinMsg("Filled from your location. Add your flat or house number below.")); }
              catch (e) { setPinMsg(e.message); }
              setLocating(false); }}><Icon k="pin" />{locating ? "Finding you…" : "Use my current location"}</button>{osm && <small className="co-osm">Address data © OpenStreetMap contributors</small>}</div>
            <label className="co-f third">Pincode<input className="co-in" name="pin" required inputMode="numeric" pattern="\d{6}" maxLength="6" autoComplete="postal-code" defaultValue={saved.length ? "" : me.pin || ""} onChange={e => lookupPin(e.target.value.trim())} /><span className={"co-hint" + (pinMsg ? " ok" : "")} role="status">{pinMsg || "6 digits; city and state fill in"}</span></label>
            <label className="co-f third">City / district<input className="co-in" name="city" required maxLength="80" autoComplete="address-level2" key={"c" + where.city} defaultValue={where.city} /></label>
            <label className="co-f third">State<input className="co-in" name="state" required maxLength="80" autoComplete="address-level1" key={"s" + where.state} defaultValue={where.state} /></label>
            <label className="co-f co-wide">Flat, house no., building, company<input className="co-in" name="line1" required maxLength="160" autoComplete="address-line1" /></label>
            <label className="co-f co-wide">Area, street, sector, village<input className="co-in" name="line2" maxLength="160" autoComplete="address-line2" /></label>
            <label className="co-f co-wide"><span>Landmark <small>(optional)</small></span><input className="co-in" name="landmark" maxLength="120" placeholder="E.g. near Apollo Hospital" /></label>
            <label className="co-f">Full name<input className="co-in" name="name" required maxLength="80" autoComplete="name" defaultValue={me.name || ""} /></label>
            <label className="co-f">Mobile number<span className="co-tel"><b>+91</b><input className="co-in" name="phone10" type="tel" required inputMode="numeric" pattern="[6-9]\d{9}" maxLength="10" autoComplete="tel-national" defaultValue={(me.phone || "").replace(/^\+91/, "")} title="A 10-digit Indian mobile number" /></span></label>
            <div className="co-f co-wide"><span>Address type</span><div className="co-chips" role="radiogroup" aria-label="Address type">{["Home", "Work", "Other"].map(t => <button type="button" role="radio" aria-checked={label === t} className={label === t ? "on" : ""} onClick={() => setLabel(t)} key={t}><Icon k={t === "Home" ? "home" : t === "Work" ? "box" : "pin"} />{t}</button>)}</div></div>
            <label className="co-check co-wide"><input type="checkbox" name="saveAddr" defaultChecked /> Save this address to my account for next time</label>
          </div>}
        </section>
        <section className="co-card"><div className="co-hd"><span className="co-n">2</span><div><h2>Payment method</h2><p>{live ? "Secured by Razorpay. We never see your card or UPI details." : "Choose how you will pay."}</p></div></div>
          <div className="co-pay" role="radiogroup" aria-label="Payment method">{PAY.map(([v, t, sub, ic]) => { const soon = v !== "cod" && !canOnline; return <label className={"co-pm" + (pay === v ? " on" : "") + (soon ? " off" : "")} key={v}><input type="radio" name="pay" value={v} checked={pay === v} disabled={soon} onChange={() => setPay(v)} /><span className="co-pi"><Icon k={ic} /></span><span className="co-pt"><b>{t}</b><small>{sub}</small></span>{soon && <em>Coming soon</em>}{v === "cod" && <em className="ok">Available</em>}</label>; })}</div>
          {!canOnline && <p className="co-note">Card, UPI and net banking open soon. Cash on delivery is available on every order today.</p>}
          {canOnline && !live && <p className="co-note">Local test copy: the online options open a test window and no money moves.</p>}
        </section>
      </Form>
      <aside className="co-side">
        <div className="co-card co-sum"><div className="co-sumhd"><h2>Order summary</h2><a href="/cart">Edit cart</a></div>
          <ul className="co-items ck-lines">{items.map(p => { const q = cart[p.id]; return <li className="line" key={p.id}><span className="co-ph"><Photo p={p} sizes="72px" /></span><span className="co-it"><b>{p.brand} {p.name}</b><small>Qty {q}{p.mrp > p.price ? <> · <s>{money(p.mrp * q)}</s> <i>{off(p)}% off</i></> : null}</small></span><strong>{money(p.price * q)}</strong></li>; })}</ul>
          <p className="co-eta"><Icon k="truck" /><span>Free delivery by <b>{etaText()}</b></span></p>
          <div className="co-coupon ck-coupon-wrap"><b className="co-ct"><Icon k="tag" />Coupons</b>
            {discount > 0 ? <div className="co-applied"><span><b>{coupon}</b> applied</span><span>−{money(discount)}</span><button type="button" onClick={() => applyCoupon("")}>Remove</button></div>
              : <>{wallet && <button type="button" className="co-wallet" onClick={() => applyCoupon(wallet.code)}><span><b>{wallet.code}</b><small>{money(wallet.value)} off on orders above {money(wallet.minOrder)}</small></span><em>Apply</em></button>}
                <div className="co-cin ck-coupon"><input className="co-in" type="text" aria-label="Coupon code" placeholder="Enter coupon code" value={coupon} onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponMsg(""); }} maxLength="20" /><button type="button" className="acc-btn ghost" onClick={() => applyCoupon(coupon || (wallet ? wallet.code : ""))}>Apply</button></div></>}
            {couponMsg && <p className="co-cmsg" role="status">{couponMsg}</p>}</div>
          <div className="co-price ck-price"><h3>Price details</h3>
            <div><span>{mrpOff > 0 ? "Total MRP" : "Price"} ({count} item{count === 1 ? "" : "s"})</span><span>{money(mrpOff > 0 ? mrpTotal : cartTotal())}</span></div>
            {mrpOff > 0 && <div className="g"><span>Discount on MRP</span><span>−{money(mrpOff)}</span></div>}
            {discount > 0 && <div className="g"><span>Coupon {coupon}</span><span>−{money(discount)}</span></div>}
            <div><span>Delivery</span><span className="g">Free</span></div>
            <div className="tot grand"><span>Total amount</span><b>{money(total)}</b></div>
            {saving > 0 && <p className="co-save">You save {money(saving)} on this order</p>}
            {emiAny && <p className="co-emi">No Cost EMI from <b>{money(emiPlans(total)[2][1])}/month</b> over 9 months on participating cards.</p>}
          </div>
          {err && <p className="co-err" role="alert">{err}</p>}
          {placeBtn("main")}
          <p className="co-tax">Inclusive of all taxes · GST invoice with every order</p>
        </div>
        <div className="co-trust"><span><Icon k="lock" />Secure checkout</span><span><Icon k="medal" />100% genuine</span><span><Icon k="undo" />{POLICY.returnDays}-day returns</span></div>
        <p className="co-help">Questions? <a href="/shipping-policy">Delivery</a> · <a href="/refund-policy">Returns</a> · <a href="/contact">Contact us</a></p>
      </aside>
    </div>
    <div className="co-bar" aria-label="Order total"><span><b>{money(total)}</b><a href="#co-sum" onClick={e => { e.preventDefault(); document.querySelector(".co-sum").scrollIntoView({ behavior: "smooth", block: "start" }); }}>View price details</a></span>{err && <small className="co-barerr" role="alert">{err}</small>}{placeBtn("bar")}</div>
  </div>;
}

export function Order() {
  const { me, money, CFG, P } = useStore();
  const [o, setO] = useState(null), [bad, setBad] = useState(false);
  const id = qs.get("id") || "";
  useEffect(() => {
    if (!me) return location.replace("/account?next=" + encodeURIComponent("/order?id=" + id)); // an order is private to its customer
    (async () => { try { if (!/^MT[0-9A-F]{10}$/.test(id)) throw 0; const r = await api("orders/" + id); setO(r.order); document.title = `Order ${r.order.id} | Mytekkstore`; } catch { setBad(true); } })();
  }, []);
  useEffect(() => { if (o || bad) reveal(); }, [o, bad]);
  if (!me) return null;
  if (bad) return <Box title="Order not found" text="Please check the order number." href="/" cta="Back to home" />;
  if (!o) return null;
  const step = STEPS.indexOf(o.status);
  const confetti = step === 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches; // a short celebration on a freshly placed order
  return <>
    <div className="box okbox">{confetti && <div className="confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i style={{ "--x": (Math.random() * 100).toFixed(1) + "%", "--d": (Math.random() * 1.4).toFixed(2) + "s", "--h": Math.floor(Math.random() * 360) }} key={i}></i>)}</div>}
      <div className="tick">✓</div><h1>{step === 0 ? "Order placed" : "Order " + o.status.toLowerCase()}</h1>
      <p>Order number <b style={{ color: "var(--text)" }}>{o.id}</b> · {new Date(o.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
      {step === 0 && (CFG.sms || CFG.mail) && <p className="muted small">We have sent a confirmation message to {CFG.sms ? o.phone : o.email || o.phone}.</p>}
      {o.status === "Cancelled" ? <span className="stock out">Cancelled</span> : <ol className="track">{STEPS.map((s, i) => <li className={i <= step ? "done" : ""} key={s}>{s}</li>)}</ol>}
      {step >= 0 && step < 3 && <p className="muted small">Expected delivery by {etaText(o.at)}</p>}
    </div>
    <div className="cols">
      <div className="panel"><h3>Items</h3><div className="lines"><OrderItems o={o} /></div>{o.discount > 0 && <div className="tot"><span>Coupon {o.coupon}</span><span className="off">−{money(o.discount)}</span></div>}<div className="tot grand"><span>Total</span><b>{money(o.total)}</b></div></div>
      <aside className="panel sum"><h3>Delivery</h3><p>{o.name}<br />{o.address}<br />{o.pin}<br />{o.phone}</p><h3>Payment</h3><p>{o.pay}</p>
        <a className="btn" href="/">Continue shopping</a><div className="perks"><span><Icon k="truck" /> Free delivery</span><span><Icon k="cash" /> Cash on delivery</span><span><Icon k="undo" /> Easy returns</span><span><Icon k="shield" /> Brand warranty</span></div></aside>
    </div>
    {o.status !== "Cancelled" && <section><h2>What happens next</h2><p className="lead">Every step shows in your account, and we message you as it moves.</p>
      <div className="why steps3">{[["Confirmed", "We check the stock and confirm your order, usually within a day."], ["Shipped", "Your order leaves with the delivery partner. Large items travel with care."], ["Delivered", /cash/i.test(o.pay) ? "Pay the delivery partner when it arrives, then check the product. " + POLICY.returnDays + " days to tell us if anything is wrong." : "Check the product when it arrives. " + POLICY.returnDays + " days to tell us if anything is wrong."]]
        .map(([t, s], i) => <div className={i + 1 <= step ? "done" : undefined} key={t}><span className="pnum">{String(i + 1).padStart(2, "0")}</span><b>{t}</b><p>{s}</p></div>)}</div></section>}
    <OrderActions o={o} setO={setO} />
    <Invoice o={o} />
    <section><h2>Need a hand?</h2><div className="ways ways3">
      <a className="way" href="/account"><i className="kico"><Icon k="box" /></i><b>Track this order</b><span>Open your account at any time to see where it is.</span></a>
      <a className="way" href="/returns"><i className="kico"><Icon k="undo" /></i><b>Returns</b><span>How a return works, start to finish.</span></a>
      <a className="way" href="/contact"><i className="kico"><Icon k="user" /></i><b>Contact us</b><span>Write to us with your order number.</span></a></div></section>
    <Row title="You may also like" href="/products?sort=off" list={[...P].filter(p => p.stock > 0 && !o.items.some(i => i.id === p.id)).sort((a, b) => off(b) - off(a)).slice(0, 5)} />
  </>;
}

// cancel before shipping, ask for a return within the window after delivery
function OrderActions({ o, setO }) {
  const [open, setOpen] = useState(""), [reason, setReason] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const canCancel = ["Placed", "Confirmed"].includes(o.status), delivered = o.status === "Delivered";
  const left = delivered ? POLICY.returnDays - Math.floor((Date.now() - new Date(o.deliveredAt || o.at).getTime()) / 86400000) : 0;
  if (!canCancel && !(delivered && (o.returnRequest || left > 0))) return null;
  const go = async kind => { setBusy(true); setErr(""); try { const r = await api("orders/" + o.id + "/" + kind, "POST", { reason }); setO(r.order); setOpen(""); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return <section className="oact" id="manage"><h2>Manage this order</h2>
    {canCancel && (open !== "cancel" ? <div className="oact-row"><p>Not shipped yet: you can cancel it now.{/online/i.test(o.pay) && !/cash/i.test(o.pay) ? " Anything paid goes back to your payment method." : ""}{o.coupon ? " Your coupon " + o.coupon + " returns to your wallet." : ""}</p><button type="button" className="acc-btn ghost" id="cancelOrder" onClick={() => setOpen("cancel")}>Cancel order</button></div>
      : <div className="oact-form"><label className="acc-f">Why are you cancelling? (optional)<select className="acc-in" value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose a reason</option><option>Ordered by mistake</option><option>Found a better price</option><option>Delivery takes too long</option><option>Want a different size or model</option><option>Other</option></select></label>
        <div className="acc-actions start"><button type="button" className="acc-btn danger" id="confirmCancel" disabled={busy} onClick={() => go("cancel")}>Yes, cancel this order</button><button type="button" className="acc-btn ghost" onClick={() => setOpen("")}>Keep the order</button></div></div>)}
    {delivered && o.returnRequest && <div className="oact-row"><p><b>Return {o.returnRequest.status.toLowerCase()}</b> on {new Date(o.returnRequest.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}: {o.returnRequest.reason}. We call you to arrange the pickup.</p></div>}
    {delivered && !o.returnRequest && left > 0 && (open !== "return" ? <div className="oact-row"><p>Damaged, faulty or not what you ordered? You can ask for a return for {left} more day{left === 1 ? "" : "s"}.</p><button type="button" className="acc-btn ghost" id="returnOrder" onClick={() => setOpen("return")}>Request a return</button></div>
      : <div className="oact-form"><label className="acc-f">What is wrong?<select className="acc-in" value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose a reason</option><option>Arrived damaged</option><option>Does not switch on or is faulty</option><option>Missing parts or accessories</option><option>Not what I ordered</option></select></label>
        <div className="acc-actions start"><button type="button" className="acc-btn" id="confirmReturn" disabled={busy || !reason} onClick={() => go("return")}>Request the return</button><button type="button" className="acc-btn ghost" onClick={() => setOpen("")}>Not now</button></div></div>)}
    {err && <p className="acc-err" role="alert">{err}</p>}
  </section>;
}
// the invoice: every line, the GST included in the price, the buyer and the order; prints on its own
function Invoice({ o }) { // the GST tax invoice is a page of its own (the link in every order message): issued when the TV is dispatched
  const link = o.key ? "/o/" + o.id + "/" + o.key : "", date = d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return <section className="invoice inv-card" id="invoice"><span className="inv-ic"><Icon k="box" /></span>
    <div><h2>{o.invoice ? "GST tax invoice" : "Invoice"}</h2>
      <p>{o.invoice ? <>Invoice <b>{o.invoice.no}</b> · {date(o.invoice.date)}</> : o.status === "Cancelled" ? "No invoice: this order was cancelled before dispatch." : "Your GST tax invoice is issued when your TV is dispatched. The link comes to you by SMS and email."}</p></div>
    {link && o.status !== "Cancelled" && <a className="d-btn" href={link} target="_blank" rel="noopener">{o.invoice ? "View or download" : "Order receipt"}</a>}
  </section>;
}

export { InfoPage } from "./info.jsx";
export function NotFound() {
  const { P } = useStore();
  useEffect(() => { document.title = "Page not found | Mytekkstore"; }, []);
  return <><Box title="Page not found" text="The address may be wrong, or the page has moved." href="/" cta="Back to home" />
    <Row title="Deals of the Day" href="/products?sort=off" list={[...P].sort((a, b) => off(b) - off(a)).slice(0, 5)} /></>;
}
