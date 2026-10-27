// The sign-up and sign-in page and the account section (27 Oct 2026): the owner's "Sign up & Login prototype" and the eight
// "Account & Sign-up Pages" designs, built on the store's own routes. Mobile number first, a one-time code, the name and email
// before it, the pincode after it, the welcome coupon at the end; the account as a dashboard with a left menu: orders with their
// timeline, profile, addresses (pincode → address → confirm), wishlist, saved cards, EMI and bank offers, TVs and warranty,
// coupons, reviews, notifications, help. Everything shown comes from the account and the catalogue; the parts that wait for a
// service (saved cards, WhatsApp messages, the map pin) say so instead of pretending.
import { useEffect, useRef, useState } from "react";
import { useStore } from "./store.jsx";
import { api, qs, load, save } from "./api.js";
import { Form, Icon, Card } from "./components.jsx";
import { off, pic, picSet, productUrl, emiPlans, BANK_OFFERS, STEPS, etaText, CONTACT, listUrl } from "./data.js";

const inchOf = p => +((/\((\d+) inch\)/.exec((p && p.name) || "") || [])[1] || 0);
const fmtPhone = p => { const d = String(p || "").replace(/\D/g, ""); return d.length >= 10 ? "+91 " + d.slice(-10, -5) + " " + d.slice(-5) : p || ""; };
const Tick = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>;
const TickGold = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8cf8c" strokeWidth="2.2" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>;

export function Account() {
  const { me, CFG, money } = useStore();
  useEffect(() => { document.title = (me ? "My account" : "Sign up or sign in") + " | Mytekkstore"; document.body.classList.toggle("su-page", !me); return () => document.body.classList.remove("su-page"); }, [me]);
  return me ? <Dashboard me={me} money={money} CFG={CFG} /> : <SignUp CFG={CFG} money={money} />;
}

// ===== the sign-up / sign-in page (the prototype) =====
function SignUp({ CFG, money }) {
  const { P } = useStore();
  const tvs = (P || []).filter(p => p.cat === "Televisions"), emis = tvs.filter(p => p.emi).map(p => emiPlans(p.price)[2][1]), minEmi = emis.length ? Math.min(...emis) : 0;
  const reviews = tvs.flatMap(p => p.reviews || []), rating = reviews.length >= 3 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "";
  const next = /^\/(?!\/)[\w\/-]*(\?[\w=&%-]*)?$/.test(qs.get("next") || "") ? qs.get("next") : "/account";
  const [mode, setMode] = useState(qs.get("mode") === "login" || qs.get("next") ? "login" : "signup");
  const [step, setStep] = useState(1); // 1 the form, 3 the pincode, 4 done
  const [name, setName] = useState(load("su-name", "")), [email, setEmail] = useState(""), [phone, setPhone] = useState(load("signin", "").replace(/^\+91/, "").replace(/\D/g, "").slice(-10));
  const [sent, setSent] = useState(false), [digits, setDigits] = useState(["", "", "", "", "", ""]), [verified, setVerified] = useState(false), [hint, setHint] = useState(""), [left, setLeft] = useState(0);
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [shake, setShake] = useState(""), [whatsapp, setWhatsapp] = useState(true), [needName, setNeedName] = useState(false);
  const [pin, setPin] = useState(""), [pinInfo, setPinInfo] = useState(null), [usePw, setUsePw] = useState(false), [created, setCreated] = useState(false);
  const boxes = useRef([]), phoneRef = useRef();
  const signup = mode === "signup";
  const real = !!CFG.sms, isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname), demo = !real && (CFG.demoCodes || isLocal);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  useEffect(() => { if (!CFG.google) return; const g = document.createElement("script"); g.src = "https://accounts.google.com/gsi/client"; g.async = true;
    g.onload = () => { window.google.accounts.id.initialize({ client_id: CFG.google, callback: async r => { try { await api("login/google", "POST", { credential: r.credential }); location.href = next; } catch (e) { setErr(e.message); } } }); window.google.accounts.id.renderButton(document.getElementById("gbtn"), { theme: "outline", size: "large", shape: "rectangular", text: "continue_with", width: 392 }); };
    document.head.append(g); }, []);
  const wobble = k => { setShake(k); setTimeout(() => setShake(""), 450); };
  const to = "+91" + phone;
  const sendOtp = async () => {
    setErr("");
    if (!/^\d{10}$/.test(phone)) { wobble("phone"); phoneRef.current && phoneRef.current.focus(); return; }
    if (signup && !name.trim()) { wobble("name"); return; }
    setBusy(true);
    try { const r = await api("otp/send", "POST", { to }); save("signin", to); save("su-name", name); setSent(true); setDigits(["", "", "", "", "", ""]); setLeft(30);
      setHint(r.via === "demo" ? `Demo mode until the SMS service is connected: your code is ${r.demoCode}.` : `Enter the 6-digit OTP sent to +91 ${phone.slice(0, 5)} ${phone.slice(5)}.`);
      setTimeout(() => boxes.current[0] && boxes.current[0].focus(), 0);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const verify = async code => {
    setBusy(true); setErr("");
    try {
      const r = await api("otp/verify", "POST", { to, code, name: name.trim(), email: email.trim(), whatsapp });
      if (r.newUser) { setNeedName(true); setMode("signup"); setHint("New number. Add your name to create your account."); return; } // a sign-in with a number we have never seen: the sign-up fields open
      setVerified(true); setCreated(!!r.created);
      if (!r.created) { location.href = next; return; } // a known customer is signed in; the welcome code is only for a first account
    } catch (e) { setErr(e.message); setDigits(["", "", "", "", "", ""]); wobble("otp"); setTimeout(() => boxes.current[0] && boxes.current[0].focus(), 0); } finally { setBusy(false); }
  };
  const onDigit = (i, v) => { const d = v.replace(/\D/g, "").slice(-1); const n = [...digits]; n[i] = d; setDigits(n); if (d && boxes.current[i + 1]) boxes.current[i + 1].focus(); if (n.every(Boolean)) verify(n.join("")); };
  const onPaste = e => { const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (!t) return; e.preventDefault(); const n = t.split("").concat(Array(6).fill("")).slice(0, 6); setDigits(n); boxes.current[Math.min(t.length, 5)].focus(); if (t.length === 6) verify(t); };
  const submit = async e => { e.preventDefault(); if (!sent) return sendOtp(); if (!verified) { if (digits.every(Boolean)) return verify(digits.join("")); return boxes.current[0] && boxes.current[0].focus(); } setStep(3); };
  const checkPin = async v => { setPin(v); setPinInfo(null); if (!/^\d{6}$/.test(v)) return; try { const d = await api("pincode/" + v); setPinInfo({ ok: true, text: `${d.area || d.district}, ${d.district} · We deliver here · Cash on delivery available` }); } catch (x) { setPinInfo({ ok: false, text: x.message }); } };
  const finish = async e => { e.preventDefault(); if (!/^\d{6}$/.test(pin)) return; setBusy(true); try { await api("me", "PATCH", { pin }); setStep(4); } catch (x) { setErr(x.message); } finally { setBusy(false); } };
  const switchMode = m => { setMode(m); setNeedName(false); setSent(false); setVerified(false); setDigits(["", "", "", "", "", ""]); setErr(""); setHint(""); setUsePw(false); };
  return <div className="su">
    <div className="su-bg" aria-hidden="true"><img src="/img/home/signup-bg-960.webp" srcSet="/img/home/signup-bg-960.webp 960w, /img/home/signup-bg.webp 1400w" sizes="100vw" alt="" width="1400" height="747" fetchPriority="high" decoding="async" /></div>
    <div className="su-shade" aria-hidden="true"></div>
    <main className="su-wrap">
      <section className="su-left">
        <a className="su-logo" href="/">mytekk<b>store</b></a>
        <span className="su-eyebrow">{signup ? "Create your account" : "Sign in"}</span>
        <h1>{signup ? "Bigger screens, smaller prices, one account." : "Good to see you again."}</h1>
        <ul className="su-ben">
          <li><TickGold />₹500 off your first TV with code MYTEKK500</li>
          <li><TickGold />Free delivery and cash on delivery on every TV</li>
          {minEmi > 0 && <li><TickGold />No Cost EMI from {money(minEmi)}/month on HDFC, ICICI, SBI, Axis and Kotak</li>}
          <li><TickGold />Track orders, invoices and warranty in one place</li>
          <li><TickGold />Sign in with the same number on any device</li>
        </ul>
        <div className="su-stat"><b>★★★★★</b> {rating ? `Rated ${rating}/5 by ${reviews.length} customers · ` : ""}Genuine Elista TVs with brand warranty</div>
        <p className="su-foot">Secure sign-up · OTP never shared · We don't sell your data</p>
      </section>
      <section className="su-right">
        <div className="su-card" id="card">
          <div className="su-steps" aria-hidden="true"><span className="on"></span><span className={sent || step > 1 ? "on" : ""}></span><span className={step >= 3 ? "on" : ""}></span></div>
          {step === 1 && <form className="su-step" id="su" noValidate onSubmit={submit}>
            <h2>{signup ? (needName ? "New number, new account" : "Sign up in 30 seconds") : "Welcome back"}</h2>
            <p className="su-sub">{signup ? <>Already have an account? <button type="button" className="su-link" onClick={() => switchMode("login")}>Sign in</button></> : <>New here? <button type="button" className="su-link" onClick={() => switchMode("signup")}>Create an account and get ₹500 off</button></>}</p>
            {CFG.google && <><div className="su-gbtn" id="gbtn"></div><div className="su-or">or with mobile number</div></>}
            {signup && <div className="su-row">
              <label className={shake === "name" ? "su-shake" : ""} style={{ flex: 1 }}>Full name<input type="text" name="name" value={name} onChange={e => setName(e.target.value)} placeholder="As on your ID" maxLength="80" autoComplete="name" /></label>
              <label style={{ flex: 1 }}>Email (optional)<input type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="For invoices" maxLength="120" autoComplete="email" /></label>
            </div>}
            <label>Mobile number<div className={"su-row" + (shake === "phone" ? " su-shake" : "")}>
              <input className="su-cc" type="text" value="+91" readOnly aria-label="Country code" />
              <input type="tel" name="phone" ref={phoneRef} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number" inputMode="numeric" maxLength="10" readOnly={sent} autoComplete="tel-national" style={{ flex: 1, minWidth: 120 }} />
              {!sent && <button type="button" className="su-btn su-otpbtn" id="sendOtp" disabled={busy} onClick={sendOtp}>Send OTP</button>}
            </div></label>
            {sent && !verified && <div className="su-otpwrap">
              <p className="su-sub">Enter the 6-digit OTP sent to <b>+91 {phone.slice(0, 5)} {phone.slice(5)}</b> · <button type="button" className="su-link" onClick={() => { setSent(false); setDigits(["", "", "", "", "", ""]); setHint(""); }}>change</button></p>
              <div className={"su-otp" + (shake === "otp" ? " su-shake" : "")} id="otp" onPaste={onPaste}>{digits.map((d, i) => <input type="text" inputMode="numeric" maxLength="1" aria-label={"Digit " + (i + 1)} value={d} className={d ? "filled" : ""} ref={el => boxes.current[i] = el} onChange={e => onDigit(i, e.target.value)} onKeyDown={e => { if (e.key === "Backspace" && !digits[i] && boxes.current[i - 1]) boxes.current[i - 1].focus(); }} key={i} />)}</div>
              <p className="su-tiny" id="otphint" role="status">{hint}</p>
              <p className="su-tiny" id="resend">{left > 0 ? `Resend in 00:${String(left).padStart(2, "0")}` : <>Didn't get it? <button type="button" className="su-link" onClick={sendOtp}>Resend OTP</button></>}</p>
            </div>}
            {verified && <div className="su-ok show" id="verified"><Tick />Mobile number verified</div>}
            {signup && <label className="su-chk"><input type="checkbox" checked={whatsapp} onChange={e => setWhatsapp(e.target.checked)} /> Send my ₹500 welcome code, deals and price-drop alerts on WhatsApp (messages start once the WhatsApp service is connected)</label>}
            {err && <p className="su-err" role="alert">{err}</p>}
            <button type="submit" className="su-btn" id="send" disabled={busy || (sent && !verified && !digits.every(Boolean))}>{signup ? (sent ? "Create account" : "Send OTP and create account") : (sent ? "Sign in" : "Send OTP")}</button>
            <p className="su-tiny">By continuing you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy policy</a>. No password needed; we text a one-time code.</p>
            <p className="su-tiny"><button type="button" className="su-link" onClick={() => setUsePw(v => !v)}>{usePw ? "Hide the password sign-in" : "Have a password? Sign in with email and password"}</button></p>
            {usePw && <PasswordSignIn next={next} />}
            <div className="su-trust"><span>🔒 OTP verified</span><span>· No password needed</span><span>· Sign in with the same number on any device</span></div>
          </form>}
          {step === 3 && <form className="su-step" id="su-pin" noValidate onSubmit={finish}>
            <h2>Where should we deliver?</h2>
            <p className="su-sub">Your pincode sets delivery time and cash-on-delivery availability.</p>
            <label>Pincode<div className="su-row"><input type="text" name="pin" value={pin} onChange={e => checkPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digits" inputMode="numeric" maxLength="6" autoFocus /></div></label>
            {pinInfo && <div className={"su-ok show" + (pinInfo.ok ? "" : " bad")} id="pinok"><Tick /><span>{pinInfo.text}</span></div>}
            {err && <p className="su-err" role="alert">{err}</p>}
            <button type="submit" className="su-btn" disabled={busy || !/^\d{6}$/.test(pin)}>Finish and go to my account</button>
            <button type="button" className="su-link" onClick={() => setStep(4)}>Skip for now</button>
            <p className="su-tiny">You can add a full address at checkout or in Account › Addresses.</p>
          </form>}
          {step === 4 && <div className="su-success show" id="done">
            <div className="su-ring"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#08805f" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg></div>
            <h2>Account created</h2>
            {created && <><p className="su-sub">Your welcome code is in your wallet: ₹500 off your first order of ₹15,000 or more, valid 30 days.</p><div className="su-coupon">MYTEKK500</div></>}
            <a className="su-btn" id="goAccount" href={next}>Go to my account</a>
          </div>}
        </div>
      </section>
    </main>
  </div>;
}
// the password route, for the customers (and the admin) who have one
function PasswordSignIn({ next }) {
  return <Form className="su-pw" id="login" onSubmit={async f => { await api("login", "POST", f); location.href = next; }} after={busy => <button className="su-btn ghost" disabled={busy}>Sign in with password</button>}>
    <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
    <label>Password<input name="password" type="password" required autoComplete="current-password" placeholder="Your password" /></label>
  </Form>;
}

// ===== the account dashboard =====
const NAV = [["orders", "My orders", "box"], ["profile", "Profile", "user"], ["addresses", "Addresses", "pin"], ["wishlist", "Wishlist", "heart"], ["cards", "Saved cards & UPI", "cart"], ["emi", "EMI & bank offers", "tag"], ["tvs", "My TVs & warranty", "shield"], ["coupons", "Coupons & rewards", "tag"], ["reviews", "My reviews", "star"], ["notifications", "Notifications", "bolt"], ["help", "Help & support", "search"]];
const statusPill = o => o.status === "Delivered" ? ["green", "Delivered" + (o.deliveredAt ? " on " + new Date(o.deliveredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "")] : o.status === "Cancelled" ? ["red", "Cancelled"] : o.status === "Shipped" ? ["amber", "Shipped · arriving by " + etaText(o.at).split(" to ")[1]] : o.status === "Confirmed" ? ["amber", "Confirmed · packing"] : ["amber", "Placed · delivery by " + etaText(o.at).split(" to ")[1]];
const warrantyOf = (p, at) => { const w = ((p && p.specs) || []).find(([k]) => /warranty/i.test(k)); const two = w && /1 \+ 1|1\+1/.test(w[1]); const end = new Date(at); end.setFullYear(end.getFullYear() + 1); return { label: two ? "1+1 year" : "1 year", end, two }; };

function Dashboard({ me, money, CFG }) {
  const { P, wish, byId } = useStore();
  const s = qs.get("s") || "home";
  const [orders, setOrders] = useState(null);
  useEffect(() => { api("orders").then(r => setOrders(r.orders)).catch(() => setOrders([])); }, []);
  const logout = async () => { await api("logout", "POST", {}); location.href = "/"; };
  const first = (me.name || "there").split(" ")[0], initial = (me.name || "?").trim()[0].toUpperCase();
  const dflt = (me.addresses || []).find(a => a.isDefault) || null, coupon = (me.coupons || []).find(c => !c.used && new Date(c.expires) > new Date());
  const tvs = P.filter(p => p.cat === "Televisions");
  const props = { me, money, orders: orders || [], loading: orders === null, tvs, byId, wish, dflt, coupon, CFG };
  const title = { home: ["Hello, " + first, "Your orders, addresses, warranty and offers in one place."], orders: ["My orders", "Track, cancel, return and download invoices."], profile: ["Profile", "Your name, number and email."], addresses: ["Addresses", "Your default address is used for \"Deliver to\" and checkout."], wishlist: ["Wishlist", "TVs you saved. Prices update here when they change."], cards: ["Saved cards & UPI", "Pay faster next time."], emi: ["EMI & bank offers", "Your EMI plans and the bank offers you can use today."], tvs: ["My TVs & warranty", "Every TV you bought here, with its warranty dates."], coupons: ["Coupons & rewards", "Codes in your wallet."], reviews: ["My reviews", "What you told other customers."], notifications: ["Notifications", "What we message you about, and where."], help: ["Help & support", "Delivery, returns, warranty and the store's contact."] }[s] || ["My account", ""];
  return <div className="acc">
    <aside className="acc-side">
      <div className="acc-who"><span className="acc-avatar">{initial}</span><div><b>{me.name}</b><span>{me.phone ? fmtPhone(me.phone) : me.email}{me.phoneVerified && " · verified"}</span></div></div>
      <nav className="acc-nav">{NAV.map(([k, label, ic]) => <a href={"/account?s=" + k} className={s === k ? "on" : undefined} aria-current={s === k ? "page" : undefined} key={k}><Icon k={ic} />{label}</a>)}
        {me.admin && <a href="/admin"><Icon k="sliders" />Store admin</a>}
        <button type="button" id="logout" onClick={logout}><Icon k="undo" />Sign out</button></nav>
    </aside>
    <section className="acc-main">
      <div className="acc-head"><div><h1 className="acc-h">{title[0]}</h1><p className="acc-sub">{title[1]}</p></div>
        {s === "home" && coupon && <a className="acc-pill" href="/account?s=coupons"><Icon k="tag" />{money(coupon.value)} coupon in your wallet</a>}
        {s === "addresses" && <a className="acc-btn" href="/account?s=addresses&add=1">+ Add new address</a>}</div>
      {s === "home" && <Overview {...props} />}{s === "orders" && <Orders {...props} />}{s === "profile" && <Profile {...props} />}{s === "addresses" && <Addresses {...props} />}{s === "wishlist" && <Wishlist {...props} />}
      {s === "cards" && <Cards {...props} />}{s === "emi" && <Emi {...props} />}{s === "tvs" && <Tvs {...props} />}{s === "coupons" && <Coupons {...props} />}{s === "reviews" && <Reviews {...props} />}{s === "notifications" && <Notifications {...props} />}{s === "help" && <Help {...props} />}
    </section>
  </div>;
}

function OrderPhoto({ o }) { const it = o.items[0]; return <a className="acc-photo" href={"/order?id=" + o.id}>{it && it.img ? <img src={pic(it.img, 480)} srcSet={picSet(it.img)} sizes="150px" alt="" loading="lazy" /> : <span>[TV photo]</span>}</a>; }
const orderTitle = o => { const it = o.items[0]; return it ? `${it.brand} ${inchOf(it) ? inchOf(it) + "\" " : ""}${it.name.replace(/^\d+ cm \(\d+ inch\) /, "")}${o.items.length > 1 ? " + " + (o.items.length - 1) + " more" : ""}` : o.id; };

function Overview({ me, money, orders, loading, tvs, byId, wish, dflt, coupon }) {
  const latest = orders[0];
  const lastInch = latest ? Math.max(...latest.items.map(inchOf)) : 0;
  const pick = n => { const l = tvs.filter(p => inchOf(p) === n); return l.length ? Math.min(...l.map(p => p.price)) : 0; };
  const tiles = [["orders", "My orders", "Track, cancel or return. Download GST invoices.", "View orders →", "box"], ["addresses", "Addresses", "Home, work and more. Set a default for faster checkout.", "Manage addresses →", "pin"], ["wishlist", "Wishlist", wish.length ? `${wish.length} TV${wish.length > 1 ? "s" : ""} saved. Come back when the price moves.` : "Save the TVs you are choosing between.", "View wishlist →", "heart"], ["cards", "Saved cards & UPI", "Pay faster next time. Cards stored by Razorpay, never by us.", "Manage payments →", "cart"],
    ["emi", "EMI & bank offers", "Your EMI plans and the bank offers you can use today.", "See offers →", "tag"], ["tvs", "My TVs & warranty", "Purchase dates, warranty end and the Elista service line.", "See my TVs →", "shield"], ["coupons", "Coupons & rewards", coupon ? `${coupon.code} is waiting in your wallet.` : "Your codes appear here.", "View coupons →", "tag"], ["help", "Help & support", "Delivery, returns, warranty and the store's contact.", "Get help →", "search"]];
  return <>
    {latest && <div className="acc-card acc-latest"><OrderPhoto o={latest} /><div className="acc-latest-text"><span className={"acc-status " + statusPill(latest)[0]}>{statusPill(latest)[1]}</span><b>{orderTitle(latest)}</b><span className="acc-muted">Order #{latest.id} · {latest.status === "Cancelled" ? "Cancelled" : "Paid " + money(latest.total)} · {latest.pay}</span></div><div className="acc-actions"><a className="acc-btn" href={"/order?id=" + latest.id}>Track order</a><a className="acc-btn ghost" href={"/order?id=" + latest.id + "#invoice"}>Invoice</a></div></div>}
    {!latest && !loading && <div className="acc-card acc-empty"><b>No orders yet.</b><span className="acc-muted">Your first order lands here with its delivery timeline.</span><a className="acc-btn" href="/televisions">Shop TVs</a></div>}
    <div className="acc-grid4">{tiles.map(([k, t, d, l, ic]) => <a className="acc-card acc-tile" href={"/account?s=" + k} key={k}><span className="acc-ico"><Icon k={ic} /></span><b>{t}</b><span className="acc-muted">{d}</span><span className="acc-link">{l}</span></a>)}</div>
    <div className="acc-grid2">
      <div className="acc-card"><b>Default address</b>{dflt ? <p className="acc-addr">{dflt.name} · {dflt.label}<br />{dflt.line1}{dflt.line2 ? ", " + dflt.line2 : ""}{dflt.landmark ? ", " + dflt.landmark : ""}<br />{dflt.city}, {dflt.state} {dflt.pin}<br />{fmtPhone(dflt.phone)}</p> : <p className="acc-muted">No address saved yet. Add one for a faster checkout.</p>}<div className="acc-actions start">{dflt && <a className="acc-btn ghost" href={"/account?s=addresses&edit=" + dflt.id}>Edit</a>}<a className="acc-btn ghost" href="/account?s=addresses&add=1">Add new address</a></div></div>
      <div className="acc-card"><b>Recommended for you</b><p className="acc-muted">{lastInch >= 50 ? `Based on your ${lastInch}" order: a 32" for the bedroom${pick(32) ? " from " + money(pick(32)) : ""}${pick(65) && lastInch < 65 ? " and a 65\" upgrade on No Cost EMI" : ""}.` : lastInch ? `Based on your ${lastInch}" order: the 55" is the size most living rooms are built for${pick(55) ? ", from " + money(pick(55)) : ""}.` : `The 55" is the size most living rooms are built for${pick(55) ? ", from " + money(pick(55)) : ""}; the 32" suits a bedroom${pick(32) ? " from " + money(pick(32)) : ""}.`}</p><div className="acc-actions start"><a className="acc-btn ghost" href={listUrl({ cat: "Televisions", size: lastInch >= 50 ? 32 : 55 })}>See picks</a></div></div>
    </div>
  </>;
}

function Timeline({ o }) {
  if (o.status === "Cancelled") return null;
  const step = STEPS.indexOf(o.status);
  return <ol className="acc-track">{STEPS.map((st, i) => <li className={i <= step ? "done" : ""} key={st}><i></i><span>{st}</span></li>)}</ol>;
}
function Orders({ orders, loading, money, byId }) {
  const [f, setF] = useState("all"), [q, setQ] = useState("");
  const list = orders.filter(o => f === "all" || (f === "progress" && !["Delivered", "Cancelled"].includes(o.status)) || (f === "delivered" && o.status === "Delivered") || (f === "cancelled" && o.status === "Cancelled")).filter(o => !q || (o.id + " " + o.items.map(i => i.name).join(" ")).toLowerCase().includes(q.toLowerCase()));
  const delivered = orders.filter(o => o.status === "Delivered");
  return <>
    <div className="acc-filters"><div className="acc-chips">{[["all", "All"], ["progress", "In progress"], ["delivered", "Delivered"], ["cancelled", "Cancelled / returned"]].map(([k, l]) => <button type="button" className={f === k ? "on" : ""} onClick={() => setF(k)} key={k}>{l}</button>)}</div><input className="acc-in" type="search" placeholder="Search by order no. or product" value={q} onChange={e => setQ(e.target.value)} aria-label="Search orders" /></div>
    {loading ? <p className="acc-muted">Loading your orders…</p> : !list.length ? <div className="acc-card acc-empty"><b>{orders.length ? "No orders match." : "No orders yet."}</b><a className="acc-btn" href="/televisions">Shop TVs</a></div> : list.map(o => <div className="acc-card acc-order" key={o.id}>
      <div className="acc-order-head"><span>Order <b>#{o.id}</b> · placed {new Date(o.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span><span className={"acc-status " + statusPill(o)[0]}>{statusPill(o)[1]}</span></div>
      <div className="acc-order-body"><OrderPhoto o={o} /><div className="acc-order-text"><b>{orderTitle(o)}</b><span className="acc-muted">{o.status === "Cancelled" ? "Cancelled" : "Paid " + money(o.total)}{o.discount ? ` (${o.coupon} −${money(o.discount)})` : ""} · {o.pay} · Free delivery</span></div>
        <div className="acc-actions">{!["Delivered", "Cancelled"].includes(o.status) && <a className="acc-btn" href={"/order?id=" + o.id}>Track</a>}<a className="acc-btn ghost" href={"/order?id=" + o.id + "#invoice"}>Invoice</a>{o.status === "Delivered" && <>{o.items[0] && byId(o.items[0].id) && <a className="acc-btn ghost" href={productUrl(byId(o.items[0].id)) + "#t-rev"}>Rate &amp; review</a>}<a className="acc-btn ghost" href="/returns">Need help?</a></>}</div></div>
      <Timeline o={o} />
    </div>)}
    {delivered.map(o => o.items.map(it => { const p = byId(it.id); const w = warrantyOf(p, o.deliveredAt || o.at); return <div className="acc-card acc-warr" key={o.id + it.id}><div><b>Warranty for your {inchOf(it) ? inchOf(it) + "\" " : ""}{p && p.os ? p.os : "TV"}</b><span className="acc-muted">Valid till {w.end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ({w.label}){w.two ? " · Register with Elista to activate the 2nd year." : ""}</span></div><a className="acc-btn" href="/account?s=tvs">Register warranty</a></div>; }))}
  </>;
}

function Profile({ me }) {
  return <div className="acc-grid2">
    <Form className="acc-card acc-form" onSubmit={async f => { await api("me", "PATCH", f); location.reload(); }} after={busy => <button className="acc-btn" disabled={busy}>Save changes</button>}>
      <b>Your details</b>
      <label className="acc-f">Full name<input className="acc-in" name="name" required maxLength="80" autoComplete="name" defaultValue={me.name || ""} /></label>
      <label className="acc-f">Mobile number<input className="acc-in" name="phone" type="tel" pattern="[0-9+ ]{7,15}" autoComplete="tel" defaultValue={me.phone || ""} /><span className="acc-muted small">{me.phoneVerified ? "Verified. A new number is verified at your next sign-in." : "Verified at your next OTP sign-in."}</span></label>
      <label className="acc-f">Email<input className="acc-in" name="email" type="email" autoComplete="email" defaultValue={me.email || ""} placeholder="For invoices and order updates" /></label>
    </Form>
    <Form className="acc-card acc-form" onSubmit={async f => { await api("me/password", "POST", f); location.reload(); }} after={busy => <button className="acc-btn ghost" disabled={busy}>{me.hasPassword ? "Change password" : "Set a password"}</button>}>
      <b>{me.hasPassword ? "Password" : "Add a password (optional)"}</b><span className="acc-muted">{me.hasPassword ? "You can sign in with your email and this password as well as with an OTP." : "Sign in with an OTP any time; a password is an extra way in for your email."}</span>
      <label className="acc-f">{me.hasPassword ? "New password" : "Password"}<input className="acc-in" name="password" type="password" required minLength="8" autoComplete="new-password" placeholder="At least 8 characters" /></label>
      <span className="acc-muted small">Member since {me.since ? new Date(me.since).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "the start"}.</span>
    </Form>
  </div>;
}

// addresses: cards with a default, and the three-step add/edit flow (pincode → address → confirm)
function Addresses({ me, dflt }) {
  const list = me.addresses || [];
  const [editing, setEditing] = useState(qs.get("add") ? "new" : qs.get("edit") || "");
  const [check, setCheck] = useState(null);
  useEffect(() => { if (!dflt) return; api("pincode/" + dflt.pin).then(d => setCheck(`${d.pin} · ${d.area || d.district}, ${d.state} · Free delivery in 3 to 5 days · Cash on delivery available`)).catch(() => setCheck(`${dflt.pin} · Free delivery in 3 to 5 days · Cash on delivery available`)); }, [dflt && dflt.pin]);
  const act = async (path, body) => { await api(path, "POST", body || {}); location.href = "/account?s=addresses"; };
  if (editing) return <AddressFlow me={me} address={editing === "new" ? null : list.find(a => a.id === editing)} onDone={() => location.href = "/account?s=addresses"} onCancel={() => setEditing("")} />;
  return <>
    <div className="acc-grid2">
      {list.map(a => <div className={"acc-card acc-addrcard" + (a.isDefault ? " dflt" : "")} key={a.id}>
        <div className="acc-addr-head"><span className="acc-tag">{a.label}</span>{a.isDefault ? <span className="acc-default">✓ Default</span> : <button type="button" className="acc-linkbtn" onClick={() => act("me/addresses/" + a.id + "/default")}>Set as default</button>}</div>
        <b>{a.name}</b><p className="acc-addr">{a.line1}{a.line2 ? ", " + a.line2 : ""}{a.landmark ? ", " + a.landmark : ""}<br />{a.city}, {a.state} {a.pin} · {fmtPhone(a.phone)}</p>
        <div className="acc-actions start"><button type="button" className="acc-btn ghost" onClick={() => setEditing(a.id)}>Edit</button><button type="button" className="acc-btn ghost" onClick={() => act("me/addresses/" + a.id + "/delete")}>Delete</button></div>
      </div>)}
      <button type="button" className="acc-card acc-addnew" onClick={() => setEditing("new")}><span className="acc-plus">+</span><b>Add a new address</b><span className="acc-muted">Pincode → address → confirm</span></button>
    </div>
    {dflt && <div className="acc-card acc-check"><Icon k="pin" /><div><b>Delivery check</b><span className="acc-muted">{check || dflt.pin}</span></div><a className="acc-btn ghost" href={"/account?s=addresses&edit=" + dflt.id}>Change pincode</a></div>}
  </>;
}
function AddressFlow({ me, address, onDone, onCancel }) {
  const [step, setStep] = useState(address ? 2 : 1), [pin, setPin] = useState(address ? address.pin : me.pin || ""), [look, setLook] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const [a, setA] = useState(address || { label: "Home", name: me.name || "", line1: "", line2: "", landmark: "", city: "", state: "", phone: me.phone || "", isDefault: !(me.addresses || []).length });
  const set = (k, v) => setA(x => ({ ...x, [k]: v }));
  const check = async () => { setErr(""); if (!/^\d{6}$/.test(pin)) return setErr("Please enter a 6-digit pincode."); setBusy(true); try { const d = await api("pincode/" + pin); setLook(d); setA(x => ({ ...x, city: d.district || x.city, state: d.state || x.state, line2: x.line2 || (d.area ? d.area : "") })); } catch (x) { setErr(x.message); setLook(null); } finally { setBusy(false); } };
  const save = async e => { e.preventDefault(); setErr(""); setBusy(true); try { await api(address ? "me/addresses/" + address.id : "me/addresses", "POST", { ...a, pin }); setStep(3); } catch (x) { setErr(x.message); } finally { setBusy(false); } };
  return <div className="acc-flow">
    {step === 1 && <div className="acc-card acc-step"><span className="acc-pill2">Step 1 · Where should we deliver?</span><h2 className="acc-h2">Enter your pincode</h2>
      <div className="acc-row"><input className="acc-in" type="text" inputMode="numeric" maxLength="6" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digits" aria-label="Pincode" /><button type="button" className="acc-btn" onClick={check} disabled={busy}>Check</button></div>
      {look && <div className="acc-ok"><b>{look.area || look.district}, {look.district} {look.pin}</b> · We deliver here. Free delivery, cash on delivery available. Delivery in 3 to 5 days.</div>}
      {err && <p className="acc-err" role="alert">{err}</p>}
      <p className="acc-muted">The pincode is checked with India Post and fills the city and state. "Use my current location" arrives with the maps key.</p>
      <div className="acc-actions start"><button type="button" className="acc-btn" disabled={!look} onClick={() => setStep(2)}>Continue</button><button type="button" className="acc-btn ghost" onClick={onCancel}>Cancel</button></div></div>}
    {step === 2 && <form className="acc-card acc-step" onSubmit={save}><span className="acc-pill2">Step 2 · Add the address</span><h2 className="acc-h2">Delivery address</h2>
      <div className="acc-grid2 tight">
        <label className="acc-f">Flat / house no., building<input className="acc-in" value={a.line1} onChange={e => set("line1", e.target.value)} required maxLength="160" autoComplete="address-line1" /></label>
        <label className="acc-f">Area, street<input className="acc-in" value={a.line2} onChange={e => set("line2", e.target.value)} maxLength="160" autoComplete="address-line2" /></label>
        <label className="acc-f">Landmark (optional)<input className="acc-in" value={a.landmark} onChange={e => set("landmark", e.target.value)} maxLength="120" /></label>
        <label className="acc-f">Name for delivery<input className="acc-in" value={a.name} onChange={e => set("name", e.target.value)} required maxLength="80" autoComplete="name" /></label>
        <label className="acc-f">City<input className="acc-in" value={a.city} onChange={e => set("city", e.target.value)} required maxLength="80" autoComplete="address-level2" /></label>
        <label className="acc-f">State<input className="acc-in" value={a.state} onChange={e => set("state", e.target.value)} required maxLength="80" autoComplete="address-level1" /></label>
        <label className="acc-f">Pincode<input className="acc-in" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" maxLength="6" autoComplete="postal-code" /></label>
        <label className="acc-f">Phone for delivery<input className="acc-in" value={a.phone} onChange={e => set("phone", e.target.value)} required type="tel" pattern="[0-9+ ]{7,15}" autoComplete="tel" /></label>
      </div>
      <div className="acc-chips">{["Home", "Work", "Other"].map(l => <button type="button" className={a.label === l ? "on" : ""} onClick={() => set("label", l)} key={l}>{l}</button>)}</div>
      <label className="acc-chk"><input type="checkbox" checked={!!a.isDefault} onChange={e => set("isDefault", e.target.checked)} /> Make this my default address</label>
      {err && <p className="acc-err" role="alert">{err}</p>}
      <div className="acc-actions start"><button className="acc-btn" disabled={busy}>Save address</button><button type="button" className="acc-btn ghost" onClick={onCancel}>Cancel</button></div></form>}
    {step === 3 && <div className="acc-card acc-step"><span className="acc-pill2">Step 3 · Saved</span><h2 className="acc-h2">Address saved</h2>
      <div className="acc-map" aria-hidden="true"><Icon k="pin" /><span>The map pin, for the exact door, arrives with the maps key.</span></div>
      <div className="acc-card inner"><b>{a.name} · {a.label}</b><p className="acc-addr">{a.line1}{a.line2 ? ", " + a.line2 : ""}{a.landmark ? ", " + a.landmark : ""}<br />{a.city}, {a.state} {pin} · {fmtPhone(a.phone)}</p></div>
      <div className="acc-actions start"><button type="button" className="acc-btn" onClick={onDone}>Done</button><button type="button" className="acc-btn ghost" onClick={() => setStep(2)}>Edit address</button></div></div>}
  </div>;
}

function Wishlist({ wish, byId }) { const list = wish.map(byId).filter(Boolean); return list.length ? <div className="grid acc-wish">{list.map((p, i) => <Card p={p} i={i} key={p.id} />)}</div> : <div className="acc-card acc-empty"><b>Nothing saved yet.</b><span className="acc-muted">Tap the heart on any TV to keep it here.</span><a className="acc-btn" href="/televisions">Browse TVs</a></div>; }
function Cards({ CFG }) { return <div className="acc-card"><b>Saved cards &amp; UPI</b><p className="acc-muted">{CFG.pay === "razorpay" ? "Cards and UPI handles you save at checkout are stored by Razorpay, never by us, and appear here." : "Saved cards and UPI arrive with the store's Razorpay account. Until then every online option at checkout opens in test mode and cash on delivery is live."}</p><p className="acc-muted">We never store card numbers.</p></div>; }
function Emi({ money, orders, CFG }) {
  const emiOrders = orders.filter(o => /EMI/i.test(o.pay || ""));
  return <>
    <div className="acc-card"><b>Your EMI plans</b><p className="acc-muted">{emiOrders.length ? emiOrders.map(o => `#${o.id}: ${o.pay}`).join(" · ") : CFG.pay === "razorpay" ? "No EMI plan running. Choose No Cost EMI at checkout on a participating card." : "EMI plans show here once the store's Razorpay account is connected. No Cost EMI is listed on every smart TV today; the plan is set up at checkout."}</p></div>
    <div className="acc-grid2">{BANK_OFFERS.map(([bank, big, terms, , chip]) => <div className="acc-card" key={bank}><span className="acc-tag">{bank}</span><b className="acc-big">{big}</b><span className="acc-muted">{terms}</span><span className="acc-muted small">{chip}</span></div>)}</div>
  </>;
}
function Tvs({ orders, byId, loading }) {
  const items = orders.filter(o => o.status === "Delivered").flatMap(o => o.items.map(it => ({ o, it, p: byId(it.id) })));
  return items.length ? <div className="acc-grid2">{items.map(({ o, it, p }) => { const w = warrantyOf(p, o.deliveredAt || o.at); return <div className="acc-card" key={o.id + it.id}><b>{it.brand} {it.name}</b><span className="acc-muted">Bought {new Date(o.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · order #{o.id}</span><span className="acc-muted">Warranty {w.label}, valid till {w.end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{w.two ? ". Register with Elista within the first year to activate the second." : "."}</span><div className="acc-actions start"><a className="acc-btn ghost" href="/returns">Warranty and service</a>{p && <a className="acc-btn ghost" href={productUrl(p)}>View TV</a>}</div></div>; })}</div>
    : <div className="acc-card acc-empty"><b>{loading ? "Loading…" : "No delivered TVs yet."}</b><span className="acc-muted">Each TV appears here on delivery with its warranty dates and the Elista service line.</span></div>;
}
function Coupons({ me, money }) {
  const list = me.coupons || [];
  return list.length ? <div className="acc-grid2">{list.map(c => { const expired = new Date(c.expires) < new Date(); return <div className={"acc-card acc-coupon" + (c.used || expired ? " off" : "")} key={c.code}><span className="acc-code">{c.code}</span><b>{money(c.value)} off your first order</b><span className="acc-muted">On orders of {money(c.minOrder)} or more · {c.used ? "Used" + (c.usedAt ? " on " + new Date(c.usedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "") : expired ? "Expired" : "Valid till " + new Date(c.expires).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>{!c.used && !expired && <span className="acc-link">Apply it at checkout →</span>}</div>; })}</div>
    : <div className="acc-card acc-empty"><b>No coupons in your wallet.</b><span className="acc-muted">Codes we give you appear here with their expiry.</span></div>;
}
function Reviews({ byId }) {
  const [list, setList] = useState(null);
  useEffect(() => { api("me/reviews").then(r => setList(r.reviews)).catch(() => setList([])); }, []);
  if (list === null) return <p className="acc-muted">Loading…</p>;
  return list.length ? <div className="acc-grid2">{list.map((r, i) => <div className="acc-card" key={i}><span className="acc-stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span><b>{r.brand} {r.product}</b><p className="acc-muted">{r.text}</p><a className="acc-link" href={byId(r.productId) ? productUrl(byId(r.productId)) + "#t-rev" : "#"}>See on the product page →</a></div>)}</div>
    : <div className="acc-card acc-empty"><b>No reviews yet.</b><span className="acc-muted">Rate a delivered TV from My orders.</span></div>;
}
function Notifications({ me }) {
  const [v, setV] = useState({ whatsapp: !!me.whatsapp, emailOffers: me.emailOffers !== false }), [saved, setSaved] = useState("");
  const toggle = async k => { const n = { ...v, [k]: !v[k] }; setV(n); try { await api("me", "PATCH", { [k]: n[k] }); setSaved("Saved."); setTimeout(() => setSaved(""), 1500); } catch (e) { setSaved(e.message); } };
  return <div className="acc-card acc-form"><b>Where we message you</b>
    <label className="acc-chk"><input type="checkbox" checked={v.whatsapp} onChange={() => toggle("whatsapp")} /> Deals, price-drop alerts and order updates on WhatsApp ({fmtPhone(me.phone) || "add a mobile number"}). Messages start once the WhatsApp service is connected.</label>
    <label className="acc-chk"><input type="checkbox" checked={v.emailOffers} onChange={() => toggle("emailOffers")} /> Offers and buying guides by email{me.email ? " (" + me.email + ")" : " (add an email in Profile)"}.</label>
    <span className="acc-muted small">Order confirmations always go out by the channel the store has connected. {saved}</span></div>;
}
function Help({ CONTACT: _c }) {
  return <div className="acc-grid2">
    {[["Delivery & tracking", "Where we deliver, how long it takes and how to track.", "/shipping"], ["Returns & replacement", "The return window, pickup and refunds.", "/returns"], ["Warranty registration", "Elista's 1 and 1+1 year warranty and how to register.", "/returns"], ["No Cost EMI FAQ", "Which cards, which tenures and how the interest works.", "/offers"], ["Contact support", CONTACT.phone ? "WhatsApp " + CONTACT.phone + " or write to us." : "Write to us with your order number.", "/contact"], ["Questions people ask", "Price, delivery, cash on delivery, EMI, warranty.", "/#faq"]].map(([t, d, h]) => <a className="acc-card acc-tile" href={h} key={t}><b>{t}</b><span className="acc-muted">{d}</span><span className="acc-link">Open →</span></a>)}
  </div>;
}
