// Offers, cart, checkout, order, info and not-found pages (the home page is in home.jsx).
import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { useStore } from "./store.jsx";
import { api, qs, demoPay, track } from "./api.js";
import { Card, Row, Strip, Box, Line, OrderItems, BankOffers, Form, Ico, Icon } from "./components.jsx";
import { LEGAL, DRAW_ICONS, STEPS, FESTIVE, KV_IMG, POLICY, catUrl, brandUrl, listUrl, off, etaText, pic, emiPlans } from "./data.js";
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
  const { CFG: payCfg } = useStore(); // pay: "razorpay" once the server has gateway keys, "demo" otherwise
  useEffect(() => { if (payCfg && payCfg.pay === "razorpay" && !document.querySelector('script[src^="https://checkout.razorpay.com/"]')) { const sc = document.createElement("script"); sc.src = "https://checkout.razorpay.com/v1/checkout.js"; sc.async = true; document.head.appendChild(sc); } }, [payCfg && payCfg.pay]);
  const [place, setPlace] = useState("");
  const placeRef = useRef(); // above the early returns (React error 300 once the cart empties after an order)
  const saved = (me && me.addresses) || [], dfltAddr = saved.find(a => a.isDefault) || saved[0];
  const [addrId, setAddrId] = useState(dfltAddr ? dfltAddr.id : "new"); // a saved address card, or "new" for the form
  const wallet = ((me && me.coupons) || []).find(c => !c.used && new Date(c.expires) > new Date());
  const [coupon, setCoupon] = useState(""), [couponMsg, setCouponMsg] = useState("");
  const [discount, setDiscount] = useState(0); // the server's answer, the same rule the order route enforces
  const applyCoupon = async code => { const v = (code || "").trim().toUpperCase(); setCoupon(v); setDiscount(0); if (!v) return setCouponMsg(""); try { const r = await api("coupons/validate", "POST", { code: v, items: Object.entries(cart).map(([id, qty]) => ({ id: +id, qty })) }); setDiscount(r.discount); setCouponMsg(`${money(r.discount)} off applied.`); } catch (e) { setCouponMsg(e.message); } };
  useEffect(() => { document.title = "Checkout | Mytekkstore"; }, []);
  useEffect(() => { if (cartCount()) track("begin_checkout", { value: cartTotal(), signedIn: !!me }); if (cartCount() && !me) location.replace("/account?next=/checkout"); else if (cartCount() && me && !me.phoneVerified) location.replace("/account?verify=1&next=%2Fcheckout"); }, []); // customers must sign in, with a verified mobile number, before checkout
  // the delivery place under the pincode, from India Post (the field still accepts any pincode)
  const placeOf = async v => { setPlace(""); if (/^\d{6}$/.test(v)) try { const d = await api("pincode/" + v); if (d.district) setPlace("Delivering to " + d.district + ", " + d.state); } catch {} };
  useEffect(() => { if (me) placeOf(me.pin || ""); }, [me && me.id]); // above the early returns: after them it rendered fewer hooks once the cart emptied (React error 300 on every placed order)
  if (!cartCount()) return <Box title="Nothing to check out" text="Your cart is empty." href="/" cta="Continue shopping" />;
  if (!me) return null;
  const submit = async f => {
    try { await placeOrder(f); } catch (e) { if (/sign in/i.test(e.message || "")) { location.href = "/account?next=%2Fcheckout&expired=1"; return; } throw e; } // a sign-in the server no longer knows: back to sign in, with the reason, not a bare error
  };
  const placeOrder = async f => {
    const items = Object.entries(cart).map(([id, qty]) => ({ id: +id, qty }));
    const picked = f.addrId && f.addrId !== "new" ? saved.find(a => a.id === f.addrId) : null;
    if (picked) Object.assign(f, { name: picked.name, phone: picked.phone, address: [picked.line1, picked.line2, picked.landmark, picked.city + ", " + picked.state].filter(Boolean).join(", "), pin: picked.pin });
    f.coupon = discount ? coupon : "";
    const online = f.pay !== "cod";
    let id;
    if (online && payCfg && payCfg.pay === "razorpay" && window.Razorpay) { // the gateway's own checkout; the server verifies the signature before the order counts
      const o = await api("pay/order", "POST", { name: f.name, phone: f.phone, address: f.address, pin: f.pin, items, coupon: f.coupon });
      await new Promise((res, rej) => { const rz = new window.Razorpay({ key: o.keyId, order_id: o.providerOrderId, amount: o.amount, currency: o.currency, name: "Mytekkstore", description: "Order " + o.id, prefill: { name: f.name, contact: f.phone, email: o.email || "" }, theme: { color: "#3b45c9" },
        modal: { ondismiss: () => rej(new Error("The payment was not completed. Nothing was charged; you can try again.")) },
        handler: async r => { try { await api("pay/verify", "POST", { id: o.id, razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature }); res(); } catch (e) { rej(e); } } }); rz.open(); });
      id = o.id;
    } else {
      if (online) await demoPay(f.pay, money(cartTotal()));
      ({ id } = await api("orders", "POST", { name: f.name, phone: f.phone, address: f.address, pin: f.pin, pay: online ? "online" : "cod", items, coupon: f.coupon }));
    }
    track("purchase", { transaction_id: id, value: cartTotal(), items });
    clearCart();
    location.href = "/order?id=" + id;
  };
  const items = Object.keys(cart).map(byId).filter(Boolean), count = Object.values(cart).reduce((n, q) => n + q, 0), emiAny = items.some(p => p.emi), online = !!(payCfg && payCfg.pay === "razorpay");
  const PAY = [["cod", "Cash on delivery", "Pay at your door when the TV arrives", "cash", "Live today"], ["UPI", "UPI", "Google Pay, PhonePe, Paytm, any UPI app", "bolt"], ["Card", "Credit or debit card", emiAny ? "No Cost EMI on HDFC, ICICI, SBI, Axis and Kotak cards" : "Visa, Mastercard, RuPay", "cart"], ["Net banking", "Net banking", "All major Indian banks", "shield"]];
  return <div className="ck">
    <div className="ck-head"><h1 className="acc-h">Checkout</h1><ol className="ck-steps"><li className="on"><i>1</i>Delivery</li><li className="on"><i>2</i>Payment</li><li><i>3</i>Order placed</li></ol></div>
    <div className="ck-cols">
      <Form className="ck-form panel" id="ckform" onSubmit={submit} after={() => null}>
        <section className="ck-card"><h2 className="ck-h2"><i>1</i>Delivery address</h2>
          {saved.length > 0 && <div className="ck-addrs" role="radiogroup" aria-label="Saved addresses">{saved.map(a => <label className="ck-addr" key={a.id}><input type="radio" name="addrId" value={a.id} checked={addrId === a.id} onChange={() => setAddrId(a.id)} /><span><b>{a.name} · {a.label} {a.isDefault && <i>Default</i>}</b>{[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}<br />{a.city}, {a.state} {a.pin} · {a.phone}</span></label>)}<label className="ck-addr"><input type="radio" name="addrId" value="new" checked={addrId === "new"} onChange={() => setAddrId("new")} /><span><b>Deliver somewhere else</b>Type a new address below.</span></label></div>}
          {(addrId === "new" || !saved.length) && <div className="ck-grid">
            <label className="acc-f">Full name<input className="acc-in" name="name" required maxLength="80" autoComplete="name" defaultValue={me.name || ""} /></label>
            <label className="acc-f">Mobile number for delivery<input className="acc-in" name="phone" type="tel" required pattern="[0-9+ ]{7,15}" autoComplete="tel" defaultValue={me.phone || ""} /></label>
            <label className="acc-f span2">Address (flat, building, street, area)<textarea className="acc-in ta" name="address" rows="3" required maxLength="400" autoComplete="street-address" defaultValue={saved.length ? "" : me.address || ""}></textarea></label>
            <label className="acc-f">Pincode<input className="acc-in" name="pin" required pattern="[0-9A-Za-z ]{4,10}" autoComplete="postal-code" defaultValue={saved.length ? "" : me.pin || ""} onChange={e => placeOf(e.target.value.trim())} /><span id="pinplace" className="acc-muted small" role="status">{place || "Free delivery across India in 3 to 5 days."}</span></label>
          </div>}
          <p className="acc-muted small">Signed in as {me.email || me.phone}. Saved addresses are in <a className="alink" href="/account?s=addresses">your account</a>.</p>
        </section>
        <section className="ck-card"><h2 className="ck-h2"><i>2</i>Payment</h2>
          <div className="ck-pay" role="radiogroup" aria-label="Payment method">{PAY.map(([v, t, sub, ic, tag]) => <label className={"ck-tile" + (v !== "cod" && !online ? " test" : "")} key={v}><input type="radio" name="pay" value={v} defaultChecked={v === "cod"} /><span className="ck-ico"><Icon k={ic} /></span><span className="ck-tt"><b>{t}</b><small>{sub}</small></span>{tag ? <em className="ck-live">{tag}</em> : !online && <em className="ck-test">Test mode</em>}</label>)}</div>
          <p className="acc-muted small">{online ? "Online payments are processed securely by Razorpay; the store never sees your card or UPI details." : "Online payments go live the moment the store's Razorpay account is connected; until then the online options open a test window and no money moves. Cash on delivery is live today."}</p>
          <div className="ck-coupon-wrap"><b>Coupon</b><div className="ck-coupon"><input className="acc-in" type="text" name="couponText" aria-label="Coupon code" placeholder={wallet ? wallet.code + " is in your wallet" : "Coupon code"} value={coupon} onChange={e => { setCoupon(e.target.value.toUpperCase()); setDiscount(0); setCouponMsg(""); }} maxLength="20" /><button type="button" className="acc-btn ghost" onClick={() => applyCoupon(coupon || (wallet ? wallet.code : ""))}>Apply</button></div>
            {couponMsg && <p className="small" role="status" style={{ margin: 0, color: discount ? "#08805f" : "#8a1f1f", fontWeight: 600 }}>{couponMsg}</p>}</div>
        </section>
      </Form>
      <aside className="ck-sum">
        <div className="ck-card"><h2 className="ck-h2">Order summary</h2>
          <div className="lines ck-lines">{Object.keys(cart).map(id => <Line p={byId(id)} key={id} />)}</div>
          <div className="ck-price"><div><span>Price ({count} item{count === 1 ? "" : "s"})</span><span>{money(cartTotal())}</span></div>{discount > 0 && <div className="off"><span>Coupon {coupon}</span><span>−{money(discount)}</span></div>}<div><span>Delivery</span><span className="free">Free</span></div><div className="tot grand"><span>Total</span><b>{money(cartTotal() - discount)}</b></div>{discount > 0 && <p className="ck-save">You save {money(discount)} on this order.</p>}</div>
          {emiAny && <p className="acc-muted small">No Cost EMI from {money(emiPlans(cartTotal() - discount)[2][1])}/month over 9 months on participating cards.</p>}
          <button type="submit" form="ckform" className="d-btn ck-place" ref={placeRef} onClick={() => { const b = placeRef.current; setTimeout(() => { if (b) b.disabled = true; }, 0); setTimeout(() => { if (b) b.disabled = false; }, 6000); }}>Place order · {money(cartTotal() - discount)}</button>
          <p className="acc-muted small" style={{ textAlign: "center" }}>Usually delivered by {etaText()}. Inclusive of all taxes; GST invoice with the order.</p>
        </div>
        <div className="ck-trust"><span><Icon k="lock" />Secure checkout</span><span><Icon k="check" />100% genuine, brand warranty</span><span><Icon k="truck" />Free delivery, cash on delivery</span><span><Icon k="undo" />Easy returns</span></div>
        <p className="acc-muted small">Questions? <a className="alink" href="/shipping">Delivery</a> · <a className="alink" href="/returns">Returns</a> · <a className="alink" href="/contact">Contact us</a></p>
      </aside>
    </div>
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
function Invoice({ o }) {
  const { money } = useStore();
  const sub = o.subtotal || o.items.reduce((t, i) => t + i.price * i.qty, 0), total = o.total, taxable = Math.round(total / 1.18 * 100) / 100, gst = Math.round((total - taxable) * 100) / 100;
  const inr = n => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <section className="invoice" id="invoice"><div className="inv-head"><div><h2>{LEGAL.gstin ? "Tax invoice" : "Invoice"}</h2><p className="acc-muted small">{LEGAL.gstin ? "" : "The GST tax invoice with the seller's GSTIN travels with the TV. "}Keep this for the warranty.</p></div><button type="button" className="acc-btn ghost" onClick={() => window.print()}>Print or save as PDF</button></div>
    <div className="inv-grid"><div><b>Sold by</b><p>{LEGAL.entity || "MyTekkStore"}{LEGAL.address ? <><br />{LEGAL.address}</> : null}{LEGAL.gstin ? <><br />GSTIN {LEGAL.gstin}</> : null}</p></div>
      <div><b>Billed and shipped to</b><p>{o.name}<br />{o.address}, {o.pin}<br />{o.phone}</p></div>
      <div><b>Invoice for order</b><p>{o.id}<br />{new Date(o.at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}<br />{o.pay}</p></div></div>
    <div className="lg-table"><table><thead><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>
      {o.items.map(i => <tr key={i.id}><td>{i.brand} {i.name}</td><td>8528</td><td>{i.qty}</td><td>{money(i.price)}</td><td>{money(i.price * i.qty)}</td></tr>)}
      {o.discount > 0 && <tr><td colSpan="4">Coupon {o.coupon}</td><td>−{money(o.discount)}</td></tr>}
      <tr><td colSpan="4">Delivery</td><td>Free</td></tr>
      <tr><td colSpan="4">Taxable value</td><td>{inr(taxable)}</td></tr><tr><td colSpan="4">GST at 18% (included)</td><td>{inr(gst)}</td></tr>
      <tr className="inv-total"><td colSpan="4"><b>Total paid{/cash/i.test(o.pay) ? " on delivery" : ""}</b></td><td><b>{money(total)}</b></td></tr></tbody></table></div>
    {sub !== total && <p className="acc-muted small">Price before the coupon {money(sub)}.</p>}
  </section>;
}

export { InfoPage } from "./info.jsx";
export function NotFound() {
  const { P } = useStore();
  useEffect(() => { document.title = "Page not found | Mytekkstore"; }, []);
  return <><Box title="Page not found" text="The address may be wrong, or the page has moved." href="/" cta="Back to home" />
    <Row title="Deals of the Day" href="/products?sort=off" list={[...P].sort((a, b) => off(b) - off(a)).slice(0, 5)} /></>;
}
