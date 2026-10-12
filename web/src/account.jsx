// Sign-in page (one-time code by SMS or email, password, Google) and the signed-in account page.
import { useEffect, useRef, useState } from "react";
import { useStore } from "./store.jsx";
import { api, qs, load, save } from "./api.js";
import { Form, Icon, Row } from "./components.jsx";
import { off } from "./data.js";
import { reveal } from "./motion.js";

export function Account() {
  const { me, CFG, money } = useStore();
  useEffect(() => { document.title = "My account | Mytekkstore"; }, []);
  return me ? <SignedIn me={me} money={money} /> : <SignIn CFG={CFG} />;
}

function SignIn({ CFG }) {
  const next = /^[a-z]+\.html(\?id=\w+)?$/.test(qs.get("next") || "") ? qs.get("next") : "account.html";
  const done = () => location.href = next;
  const [showReg, setShowReg] = useState(false);
  const [stage, setStage] = useState("send"), [codeRow, setCodeRow] = useState(false), [nameRow, setNameRow] = useState(false);
  const [note, setNote] = useState(""), [btnText, setBtnText] = useState("Send code"), [left, setLeft] = useState(-1), [gErr, setGErr] = useState("");
  const otpRef = useRef();
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  const sendCode = async () => {
    const to = otpRef.current.to.value.trim(), { via, demoCode } = await api("otp/send", "POST", { to });
    save("signin", to);
    setNote(via === "demo" ? `No SMS or email provider is connected yet, so here is your code: ${demoCode}` : `We sent a code by ${via === "email" ? "email" : "SMS"} to ${to}.`);
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
  return <div className="auth">
    <aside className="aside"><div className="aimg" style={{ backgroundImage: "url(img/kv-tv.jpg)" }}></div><div className="atext"><p className="kicker">Welcome to Mytekkstore</p><h2>One account for everything</h2>
      <ul><li><Icon k="check" />Faster checkout with a saved address</li><li><Icon k="check" />Order tracking and order history</li><li><Icon k="check" />Reviews and wishlist</li></ul></div></aside>
    <div className="panel acard">
      <div><h1>{next === "checkout.html" ? "Sign in to continue to checkout" : "Sign in or create an account"}</h1>
        <p className="muted small">{next === "checkout.html" ? "An account keeps your orders, address and order tracking in one place. It takes a minute." : "A one-time code by SMS or email, your password, or your Google account."}</p></div>
      {CFG.google && <><div className="gbtn" id="gbtn"></div><div className="or"><span>or</span></div></>}
      <Tabs tabs={[["t-phone", "Mobile number or email"], ["t-email", "Password"]]}>
        {tab => <>
          <div className="tabpane" id="t-phone" hidden={tab !== "t-phone"}><Form className="form" id="otp" noValidate ref={otpRef} onSubmit={submit} after={busy => <div className="arow"><button className="btn" disabled={busy}>{btnText}</button>{stage === "verify" && <button type="button" className="link" id="resend" disabled={left > 0} onClick={resend}>{left > 0 ? `Send a new code in ${left}s` : "Send a new code"}</button>}</div>}>
            <label>Mobile number or email<input name="to" type="text" required autoComplete="username" placeholder="98765 43210 or you@example.com" maxLength="120" defaultValue={load("signin", "")} /></label>
            <label id="codeRow" hidden={!codeRow}>6-digit code from the message<input name="code" className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength="6" placeholder="••••••" /></label>
            <label id="nameRow" hidden={!nameRow}>Your name<input name="name" maxLength="80" autoComplete="name" /></label>
            <p className="muted small" id="otpnote" role="status">{note}</p>
            {gErr && <p className="err">{gErr}</p>}
          </Form></div>
          <div className="tabpane" id="t-email" hidden={tab !== "t-email"}>
            <Form className="form" id="login" hidden={showReg} onSubmit={async f => { await api("login", "POST", f); done(); }} after={busy => <div className="arow"><button className="btn" disabled={busy}>Sign in</button><button type="button" className="link" data-swap="register" onClick={() => setShowReg(true)}>New customer? Create an account</button></div>}>
              <label>Email<input name="email" type="email" required autoComplete="email" /></label>
              <label>Password<input name="password" type="password" required autoComplete="current-password" /></label></Form>
            <Form className="form" id="register" hidden={!showReg} onSubmit={async f => { await api("register", "POST", f); done(); }} after={busy => <div className="arow"><button className="btn" disabled={busy}>Create account</button><button type="button" className="link" data-swap="login" onClick={() => setShowReg(false)}>Already have an account? Sign in</button></div>}>
              <label>Full name<input name="name" required maxLength="80" autoComplete="name" /></label>
              <label>Email<input name="email" type="email" required autoComplete="email" /></label>
              <label>Password (at least 8 characters)<input name="password" type="password" required minLength="8" autoComplete="new-password" /></label></Form>
          </div>
        </>}
      </Tabs>
    </div></div>;
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
  const logout = async () => { await api("logout", "POST"); location.href = "index.html"; };
  return <><h1 className="ptitle">Hello, {me.name}</h1><p className="lead">Your orders, your details, and the products you saved.</p><div className="cols">
    <div className="panel"><h3>My orders</h3>{orders.length ? orders.map(o => <a className="orow" href={"order.html?id=" + o.id} key={o.id}>
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
      {me.admin && <a className="btn" href="admin.html">Open store admin</a>}
      <button className="btn ghost" id="logout" onClick={logout}>Sign out</button></aside></div>
    <Row title="My wishlist" href="category.html?wish=1" list={wish.map(byId).filter(Boolean)} />
    <Row title="Recently viewed" href="" list={recent.map(byId).filter(Boolean)} />
    <section><h2>Need a hand?</h2><div className="ways ways3">
      <a className="way" href="page.html?p=returns"><i className="kico"><Icon k="undo" /></i><b>Returns</b><span>How a return works, start to finish.</span></a>
      <a className="way" href="page.html?p=shipping"><i className="kico"><Icon k="truck" /></i><b>Delivery</b><span>Where we deliver and how long it takes.</span></a>
      <a className="way" href="page.html?p=contact"><i className="kico"><Icon k="user" /></i><b>Contact us</b><span>Write to us with your order number.</span></a></div></section>
    {!wish.length && <Row title="Deals of the Day" href="category.html?sort=off" list={[...P].sort((a, b) => off(b) - off(a)).slice(0, 5)} />}</>;
}
