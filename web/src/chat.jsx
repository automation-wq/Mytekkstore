// The help bot: a button bottom-right on every page (not the admin), a small panel with suggested questions for the page, and
// answers from the catalogue. With ANTHROPIC_API_KEY on the server the question goes to the server's assistant first; without it,
// or if that fails, the local rules answer (chatbot.js). The panel sits above the buy bar and the phone bar, never over them.
import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { useStore } from "./store.jsx";
import { api, qs, track } from "./api.js";
import { answerLocally, suggestions, intro } from "./chatbot.js";

export function ChatWidget() {
  const { P, CFG, byId, money } = useStore();
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState([]), [busy, setBusy] = useState(false);
  const inp = useRef(), list = useRef();
  const page = document.body.dataset.page, ctx = { page, id: qs.get("id"), cat: qs.get("cat"), slug: qs.get("slug") };
  const p = ctx.id ? byId(ctx.id) : null;
  useEffect(() => {
    if (!open) return;
    setTimeout(() => inp.current && inp.current.focus(), 60);
    const k = e => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open]);
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [msgs, busy]);
  if (page === "admin") return null;
  const ask = async q => {
    const history = msgs.slice(-8).map(x => ({ role: x.me ? "user" : "assistant", text: x.text }));
    setMsgs(ms => [...ms, { me: true, text: q }]); setBusy(true); track("chat_ask", { q });
    let a = null;
    if (CFG.chat) { try { const r = await api("chat", "POST", { message: q, page: ctx, history }); a = { text: r.reply, links: r.links || [] }; } catch { a = null; } }
    if (!a) a = answerLocally(q, ctx, P, money);
    setMsgs(ms => [...ms, { text: a.text, links: a.links || [] }]); setBusy(false);
  };
  const sugg = suggestions(ctx, p);
  return <>
    <button type="button" className="chatfab" aria-label="Help" aria-expanded={open} aria-controls="chat" onClick={() => setOpen(o => !o)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" /></svg><span>Help</span></button>
    <AnimatePresence>{open && <m.aside id="chat" className="chat" role="dialog" aria-label="Mytekkstore help" key="chat" initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: .98 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}>
      <header><div><b>Mytekkstore help</b><small>{CFG.chat ? "Assistant · answers from the catalogue" : "Answers from the catalogue"}</small></div><button type="button" className="x" onClick={() => setOpen(false)} aria-label="Close help">×</button></header>
      <div className="cmsgs" ref={list}>
        <div className="bot"><p>{intro(ctx, p)}</p></div>
        {msgs.map((x, i) => <div className={x.me ? "me" : "bot"} key={i}><p>{x.text}</p>{x.links && x.links.length > 0 && <span className="clinks">{x.links.map(l => <a href={l.href} key={l.href + l.label}>{l.label} →</a>)}</span>}</div>)}
        {busy && <div className="bot typing" aria-label="Typing"><span></span><span></span><span></span></div>}
      </div>
      <div className="csugg">{sugg.map(s => <button type="button" key={s} onClick={() => ask(s)} disabled={busy}>{s}</button>)}</div>
      <form onSubmit={e => { e.preventDefault(); const v = inp.current.value.trim(); if (v && !busy) { inp.current.value = ""; ask(v); } }}><input ref={inp} maxLength="300" placeholder="Ask about a TV, delivery, EMI…" aria-label="Your question" /><button className="btn" disabled={busy}>Send</button></form>
    </m.aside>}</AnimatePresence>
  </>;
}
