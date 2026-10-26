// Sign-in page (one-time code by SMS or email, password, Google) and the signed-in account page.
import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { useStore } from "./store.jsx";
import { api, qs, load, save } from "./api.js";
import { Form, Icon, Row } from "./components.jsx";
import { off, pic, picSet } from "./data.js";
// the sign-in page's entrance: parts rise one after another, the headline word by word (same springs as the home hero); once, never looping
const RISE = { hide: { y: "115%", opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 280, damping: 28 } } };
const UP = { hide: { y: 24, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 220, damping: 26 } } };
const WORDS = { hide: {}, show: { transition: { staggerChildren: .06, delayChildren: .15 } } };
const GROUP = { hide: {}, show: { transition: { staggerChildren: .12 } } };
const FLOAT = { hide: { y: 48, opacity: 0, rotate: -2 }, show: { y: 0, opacity: 1, rotate: 0, transition: { type: "spring", stiffness: 120, damping: 20, delay: .2 } } };
import { reveal } from "./motion.js";

export function Account() {
  const { me, CFG, money } = useStore();
  useEffect(() => { document.title = "My account | Mytekkstore"; }, []);
  return me ? <SignedIn me={me} money={money} /> : <SignIn CFG={CFG} />;
}

function SignIn({ CFG }) {
  const next = /^\/(?!\/)[\w\/-]*(\?[\w=&%-]*)?$/.test(qs.get("next") || "") ? qs.get("next") : "/account"; // only an address on this site
  const done = () => location.href = next;
  const [showReg, setShowReg] = useState(false);
  const [stage, setStage] = useState("send"), [codeRow, setCodeRow] = useState(false), [nameRow, setNameRow] = useState(false);
  const [note, setNote] = useState(""), [btnText, setBtnText] = useState("Send code"), [left, setLeft] = useState(-1), [gErr, setGErr] = useState("");
  const otpRef = useRef();
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  const sendCode = async () => {
    const to = otpRef.current.to.value.trim(), { via, demoCode } = await api("otp/send", "POST", { to });
    save("signin", to);
    setNote(via === "demo" ? `Demo mode — codes are shown here until an SMS or email service is connected. Your code: ${demoCode}` : `We sent a code by ${via === "email" ? "email" : "SMS"} to ${to}.`);
    setCodeRow(true); otpRef.current.code.value = ""; setTimeout(() => otpRef.current.code.focus(), 0);
    setBtnText("Verify and sign in"); setStage("verify"); setLeft(30);
  };
  const submit = async f => {
    if (stage === "send") return sendCode();
    const r = await api("otp/verify", "POST", { to: f.to, code: f.code, name: f.name });
    if (!r.newUser) return done();
    setNameRow(true); setTimeout(() => otpRef.current.name.focus(), 0);
    setNote("New number. Add your name to create your account.");
    setBtnText("Create account");
  };
  const resend = async () => { setGErr(""); try { await sendCode(); } catch (e) { setGErr(e.message); } };
  useEffect(() => {
    if (!CFG.google) return; // Google's button script is loaded only when a client id is set (the content security policy allows it then)
    const g = document.createElement("script");
    g.src = "https://accounts.google.com/gsi/client"; g.async = true;
    g.onload = () => {
      window.google.accounts.id.initialize({ client_id: CFG.google, callback: async r => { try { await api("login/google", "POST", { credential: r.credential }); done(); } catch (e) { setGErr(e.message); } } });
      window.google.accounts.id.renderButton(document.getElementById("gbtn"), { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 320 });
    };
    document.head.append(g);
  }, []);
  // which routes to offer: one-time codes only when they can arrive (an SMS or email service) or in demo mode (OTP_DEMO, or localhost);
  // with no real service the password route comes first and the demo route is named as such, so a customer never meets a code that
  // only appears on the page without knowing why (owner note, 26 Oct)
  const real = !!(CFG.sms || CFG.mail), isLocal = /^(localhost|127.0.0.1|[::1])$/.test(location.hostname), demoOnly = !real && (CFG.demoCodes || isLocal);
  const tabs = [...(real ? [["t-phone", "Mobile number or email"]] : []), ["t-email", "Password"], ...(demoOnly ? [["t-phone", "One-time code (demo)"]] : [])];
  return <div className="auth">
    <m.aside className="aside cine" initial="hide" animate="show" variants={GROUP}>
      <picture className="aimg2" aria-hidden="true"><img src={pic("img/life-cinema.jpg", 960)} srcSet={picSet("img/life-cinema.jpg")} sizes="(max-width:860px) 100vw, 50vw" alt="" decoding="async" /></picture>
      <div className="atext"><m.p className="kicker" variants={UP}>Welcome to Mytekkstore</m.p>
        <m.h2 variants={WORDS}>{"One account. Every TV deal.".split(" ").map((w, k) => <span className="ln" key={k}><m.span className="w" variants={RISE}>{w}&nbsp;</m.span></span>)}</m.h2>
        <m.ul variants={GROUP}>{["Faster checkout with a saved address", "Order tracking and history", "Reviews and wishlist", "Festive and bank offers first"].map(t => <m.li variants={UP} key={t}><Icon k="check" />{t}</m.li>)}</m.ul></div></m.aside>
    <m.div className="panel acard" initial="hide" animate="show" variants={GROUP}>
      <m.div variants={UP} className="ahead"><h1 className={next === "/checkout" ? "" : "srh"}>{next === "/checkout" ? "Sign in to continue to checkout" : "Sign in or create an account"}</h1>
        {next === "/checkout" && <p className="muted small">An account keeps your orders, address and order tracking in one place. It takes a minute.</p>}</m.div>
      {CFG.google && <m.div variants={UP}><div className="gbtn" id="gbtn"></div><div className="or"><span>or</span></div></m.div>}
      <m.div variants={UP}><Tabs tabs={tabs}>
        {tab => <>
          <div className="tabpane" id="t-phone" hidden={tab !== "t-phone"}><Form className="form" id="otp" noValidate ref={otpRef} onSubmit={submit} after={busy => <div className="arow"><button className="btn" disabled={busy}>{btnText}</button>{stage === "verify" && <button type="button" className="link" id="resend" disabled={left > 0} onClick={resend}>{left > 0 ? `Send a new code in ${left}s` : "Send a new code"}</button>}</div>}>
            <label>Mobile number or email<input name="to" type="text" required autoComplete="username" placeholder="98765 43210 or you@example.com" maxLength="120" defaultValue={load("signin", "")} /></label>
            <label id="codeRow" hidden={!codeRow}>6-digit code from the message<input name="code" className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength="6" placeholder="••••••" /></label>
            <label id="nameRow" hidden={!nameRow}>Your name<input name="name" maxLength="80" autoComplete="name" /></label>
            <p className="muted small" id="otpnote" role="status">{note}</p>
            {gErr && <p className="err">{gErr}</p>}
          </Form></div>
          <div className="tabpane" id="t-email" hidden={tab !== "t-email"}>
            <Form className="form auth-form" id="login" hidden={showReg} onSubmit={async f => { await api("login", "POST", f); done(); }} after={busy => <><button className="btn full" disabled={busy}>Sign in</button><p className="swap">New to Mytekkstore? <button type="button" className="link" data-swap="register" onClick={() => setShowReg(true)}>Create an account</button></p></>}>
              <div className="fhead"><h2>Welcome back</h2><p>Your orders, addresses and wishlist are waiting.</p></div>
              <label className="fld"><I k="mail" /><span>Email</span><input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
              <PwField name="password" label="Password" autoComplete="current-password" /></Form>
            <Form className="form auth-form" id="register" hidden={!showReg} onSubmit={async f => { await api("register", "POST", f); done(); }} after={busy => <><button className="btn full" disabled={busy}>Create account</button>
              <p className="legal">By creating an account you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy policy</a>.</p>
              <ul className="regperks"><li><Icon k="truck" /> Track every order, from dispatch to delivery</li><li><Icon k="pin" /> A saved address for one-tap checkout</li><li><Icon k="star" /> Festive and bank offers before anyone else</li></ul>
              <p className="swap">Already have an account? <button type="button" className="link" data-swap="login" onClick={() => setShowReg(false)}>Sign in</button></p></>}>
              <div className="fhead"><h2>Create your account</h2><p>Takes a minute. Orders, addresses and offers in one place.</p></div>
              <label className="fld"><Icon k="user" /><span>Full name</span><input name="name" required maxLength="80" autoComplete="name" placeholder="Your name" /></label>
              <label className="fld"><I k="mail" /><span>Email</span><input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
              <PwField name="password" label="Password" autoComplete="new-password" minLength="8" meter /></Form>
          </div>
        </>}
      </Tabs></m.div>
      <m.p className="atrust" variants={UP}><Icon k="shield" /> Secure sign-in · No card details stored · 7-day returns</m.p>
    </m.div></div>;
}

// a tab bar; children is a function of the active tab id
export function Tabs({ tabs, children }) {
  const [tab, setTab] = useState(tabs[0][0]);
  return <><div className="tabbar">{tabs.map(([id, label]) => <button className={tab === id ? "on" : undefined} data-tab={id} type="button" onClick={() => setTab(id)} key={id}>{label}</button>)}</div>{children(tab)}</>;
}

function SignedIn({ me, money }) {
  const { P, wish, recent, byId } = useStore();
  const [orders, setOrders] = useState([]);
  useEffect(() => { api("orders").then(r => { setOrders(r.orders); reveal(); }); }, []);
  const logout = async () => { await api("logout", "POST"); location.href = "/"; };
  return <><h1 className="ptitle">Hello, {me.name}</h1><p className="lead">Your orders, your details, and the products you saved.</p><div className="cols">
    <div className="panel"><h3>My orders</h3>{orders.length ? orders.map(o => <a className="orow" href={"/order?id=" + o.id} key={o.id}>
      <div><b>{o.id}</b><br /><span className="muted">{new Date(o.at).toLocaleDateString()} · {o.items.reduce((n, i) => n + i.qty, 0)} item(s)</span></div>
      <div style={{ textAlign: "right" }}><b>{money(o.total)}</b><br /><span className={"stock" + (o.status === "Cancelled" ? " out" : "")}>{o.status}</span></div></a>) : <p className="muted">You have no orders yet.</p>}</div>
    <aside className="panel sum"><h3>Profile</h3><p>{me.name}<br /><span className="muted">{me.email || me.phone}</span>{me.phoneVerified && <> <span className="stock">Mobile verified</span></>}</p>
      {me.address && <><h3>Saved address</h3><p>{me.address}<br />{me.pin}<br />{me.phone}</p></>}
      <details className="pedit"><summary className="btn ghost">Edit profile</summary>
        <Form className="form" onSubmit={async f => { await api("me", "PATCH", f); location.reload(); }} after={busy => <button className="btn" disabled={busy}>Save changes</button>}>
          <label>Full name<input name="name" required maxLength="80" autoComplete="name" defaultValue={me.name || ""} /></label>
          <label>Phone<input name="phone" type="tel" pattern="[0-9+ ]{7,15}" autoComplete="tel" defaultValue={me.phone || ""} /></label>
          <label>Address<textarea name="address" rows="3" maxLength="400" autoComplete="street-address" defaultValue={me.address || ""}></textarea></label>
          <label>Pincode<input name="pin" pattern="[0-9A-Za-z ]{4,10}" autoComplete="postal-code" defaultValue={me.pin || ""} /></label>
        </Form></details>
      {me.admin && <a className="btn" href="/admin">Open store admin</a>}
      <button className="btn ghost" id="logout" onClick={logout}>Sign out</button></aside></div>
    <Row title="My wishlist" href="/products?wish=1" list={wish.map(byId).filter(Boolean)} />
    <Row title="Recently viewed" href="" list={recent.map(byId).filter(Boolean)} />
    <section><h2>Need a hand?</h2><div className="ways ways3">
      <a className="way" href="/returns"><i className="kico"><Icon k="undo" /></i><b>Returns</b><span>How a return works, start to finish.</span></a>
      <a className="way" href="/shipping"><i className="kico"><Icon k="truck" /></i><b>Delivery</b><span>Where we deliver and how long it takes.</span></a>
      <a className="way" href="/contact"><i className="kico"><Icon k="user" /></i><b>Contact us</b><span>Write to us with your order number.</span></a></div></section>
    {!wish.length && <Row title="Deals of the Day" href="/products?sort=off" list={[...P].sort((a, b) => off(b) - off(a)).slice(0, 5)} />}</>;
}


// the three small drawn icons the forms need that the store's icon set does not carry
const I = ({ k }) => <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
  {k === "mail" ? <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></> : k === "lock" ? <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>
    : k === "eye" ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.3 6.3C3.6 8.3 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.3-1" />}
</svg>;
// a password field with an eye to show it and, for a new password, a strength hint (the server asks for 8 characters; the rest is advice)
function PwField({ name, label, autoComplete, minLength, meter }) {
  const [show, setShow] = useState(false), [v, setV] = useState("");
  const n = v.length < 8 ? 1 : 1 + (v.length >= 12) + /\d/.test(v) + (/[A-Z]/.test(v) || /[^A-Za-z0-9]/.test(v));
  const word = v.length < 8 ? "Too short · at least 8 characters" : ["", "Weak", "Fair", "Good", "Strong"][n];
  return <div className="pw"><label className="fld"><I k="lock" /><span>{label}</span><input name={name} type={show ? "text" : "password"} required minLength={minLength} autoComplete={autoComplete} placeholder={minLength ? "At least 8 characters" : "Your password"} onChange={e => setV(e.target.value)} />
    <button type="button" className="eye" onClick={() => setShow(x => !x)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}><I k={show ? "eyeoff" : "eye"} /></button></label>
    {meter && v && <div className="pwm" aria-live="polite"><i className={"l" + n}></i><small>{word}</small></div>}</div>;
}
