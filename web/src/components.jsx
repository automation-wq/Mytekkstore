// Shared pieces: icons, product card, rows, forms, header with the category menus, footer, cart drawer, toast.
import { forwardRef, useEffect, useRef, useState } from "react";
import { m, AnimatePresence, useScroll, useSpring, useReducedMotion } from "motion/react";
import { animate, stagger } from "motion";
import { reduced } from "./motion.js";
import { useStore } from "./store.jsx";
import { api, qs, load, save } from "./api.js";
import { ICONS, DRAW_ICONS, COUNTRIES, BANK_OFFERS, TOP_FEATURES, CAT_SIZE, TV_OS, OS_ROWS, SHOW_STORES, COMING_SOON, catSizes, emiPlans, catUrl, brandUrl, listUrl, off, avg, starRow, eta, productUrl, pic, picSet, dims, osList, osUrl } from "./data.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ===== icons =====
export const Icon = ({ k, cls = "ic" }) => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[k] }} />;
// line icon that draws itself when its section scrolls into view (see .ico in style.css)
export const Ico = ({ shapes }) => <i className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: shapes }} /></i>;

// ===== product pieces =====
// the main photo on a product page loads first; every other photo waits until it scrolls near the screen
// product photo in its WebP sizes (pic, picSet in data.js), with width and height so the page never shifts while it loads
// a product photo in the right size; the alt is the product's name
export const Photo = ({ p, main, sizes = "(max-width:760px) 46vw, 240px" }) => { const [w, h] = dims(p.img); return main
  ? <img src={pic(p.img)} srcSet={picSet(p.img)} sizes="(max-width:860px) 100vw, 50vw" alt={p.brand + " " + p.name} width={w} height={h} fetchPriority="high" decoding="async" />
  : <img src={pic(p.img, 480)} srcSet={picSet(p.img)} sizes={sizes} alt={p.brand + " " + p.name} width={w} height={h} loading="lazy" decoding="async" />; };
// a big photo (hero, category banner, tile) in its WebP sizes; eager for the one at the top of the page
export const KvImg = ({ src, sizes, className, eager }) => { const [w, h] = dims(src); return <img className={className} src={pic(src, 960)} srcSet={picSet(src)} sizes={sizes} alt="" width={w} height={h} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} decoding="async" />; };
export const Stars = ({ p }) => p.reviews && p.reviews.length ? <span className="stars" title={avg(p).toFixed(1) + " out of 5"}><span>{starRow(Math.round(avg(p)))}</span> <small>{avg(p).toFixed(1)} ({p.reviews.length})</small></span> : null;
export function Stepper({ p }) {
  const { qtyOf } = useStore();
  return <div className="stepper"><button data-q={p.id} data-n={qtyOf(p.id) - 1} aria-label="Decrease quantity">−</button><span>{qtyOf(p.id)}</span><button data-q={p.id} data-n={qtyOf(p.id) + 1} aria-label="Increase quantity">+</button></div>;
}
// "Add to cart" turns into a − 1 + stepper once the product is in the cart
export function Buy({ p }) {
  const { qtyOf } = useStore();
  return <div className="buy" data-pid={p.id}>{p.stock <= 0 ? <button className="btn" disabled>Out of stock</button> : qtyOf(p.id) ? <Stepper p={p} /> : <button className="btn" data-add={p.id}>Add to cart</button>}</div>;
}
export function Heart({ p }) {
  const { wish } = useStore();
  const on = wish.includes(p.id);
  return <m.button className={"heart" + (on ? " on" : "")} data-wish={p.id} aria-label="Save to wishlist" aria-pressed={on} initial={false} whileTap={{ scale: .8 }} animate={on ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: .35 }}>♥</m.button>;
}
// product card: rises in when it scrolls into view (staggered by its place in the row through i), tilts toward the pointer on
// springs and carries a soft light that follows it (hover devices only, never under reduced motion)
const HOVER = matchMedia("(hover: hover)").matches, TILT = { stiffness: 260, damping: 22 };
// sizes: the brand's other sizes as [label, href, isThisOne] (category grid); compare: [ticked, toggle(id)] shows the Compare tick
export function Card({ p, i = 0, sizes, compare }) {
  const { money } = useStore();
  const still = useReducedMotion();
  const rx = useSpring(0, TILT), ry = useSpring(0, TILT);
  const onMove = e => {
    if (!HOVER || still || e.pointerType !== "mouse") return;
    const c = e.currentTarget, r = c.getBoundingClientRect();
    c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px");
    rx.set(((e.clientY - r.top) / r.height - .5) * -5); ry.set(((e.clientX - r.left) / r.width - .5) * 7);
  };
  const onLeave = () => { rx.set(0); ry.set(0); };
  return <m.div className="card" style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }} onPointerMove={onMove} onPointerLeave={onLeave}
    initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -40px" }} transition={{ type: "spring", stiffness: 220, damping: 26, delay: (i % 6) * .06 }}><Heart p={p} />
    <a href={productUrl(p)}><div className="img"><Photo p={p} />{off(p) > 0 && <span className="badge">{off(p)}% off</span>}<button type="button" className="qview" data-quick={p.id} aria-label={"Quick view " + p.brand + " " + p.name}>Quick view</button></div><small>{p.brand}{p.os ? " · " + p.os : ""}</small><h3>{p.name}</h3><Stars p={p} /></a>
    {sizes && sizes.length > 1 && <span className="csizes"><small>Sizes</small>{sizes.map(([l, href, on]) => on ? <b key={l}>{l}</b> : <a href={href} key={l}>{l}</a>)}</span>}
    <div className="price"><b>{money(p.price)}</b>{p.mrp > p.price && <><s>{money(p.mrp)}</s><em className="save">Save {money(p.mrp - p.price)}</em></>}</div>{p.emi && <span className="emi">No Cost EMI · {money(emiPlans(p.price)[2][1])}/month</span>}<span className="geta"><Icon k="truck" /> Free delivery · get it by {eta()[1]}</span><Buy p={p} />{compare && <label className="ccmp"><input type="checkbox" checked={compare[0]} onChange={() => compare[1](p.id)} /> Compare</label>}</m.div>;
}
export function Line({ p }) {
  const { money, qtyOf } = useStore();
  return <div className="line"><a className="img" href={productUrl(p)}><Photo p={p} /></a>
    <div><a href={productUrl(p)}>{p.brand} {p.name}</a>
      <div className="lrow"><Stepper p={p} /><b>{money(p.price * qtyOf(p.id))}</b></div>
      <button className="link" data-q={p.id} data-n="0">Remove</button></div></div>;
}
// a sideways-scrolling strip with arrow buttons (hidden when the row fits on the screen)
export const Strip = ({ children }) => <div className="strip"><button className="sarrow" data-scroll="-1" aria-label="Scroll left">‹</button><div className="row">{children}</div><button className="sarrow" data-scroll="1" aria-label="Scroll right">›</button></div>;
export const Row = ({ title, href, list }) => list.length ? <section><h2>{title} {href ? <a href={href}>View all</a> : null}</h2><Strip>{list.map((p, i) => <Card key={p.id} p={p} i={i} />)}</Strip></section> : null;
export const Box = ({ title, text, href, cta }) => <div className="box"><h1>{title}</h1><p>{text}</p><a className="btn" href={href}>{cta}</a></div>;
export function OrderItems({ o }) {
  const { money } = useStore();
  return o.items.map(it => <div className="line" key={it.id}><span className="img"><img src={pic(it.img, 480)} alt="" width="800" height="800" /></span>
    <div><span>{it.brand} {it.name}</span><div className="lrow"><span className="muted">Qty {it.qty}</span><b>{money(it.price * it.qty)}</b></div></div></div>);
}
// bank offers block, used on the home page and the offers page
export const BankOffers = () => <section className="offers" id="bank"><h2>Bank offers <a href="/offers">All offers</a></h2><div className="ogrid">{BANK_OFFERS.map(([bank, big, note, c]) =>
  <div className="offer" style={{ "--bc": c }} key={bank}><i className="blogo">{bank.split(" ")[0]}</i><b>{big}</b><span>{note}</span><small>{bank} · T&amp;C apply</small></div>)}</div></section>;

// forms: show the server's message under the form and stop double submits. onSubmit gets the fields; throw to show an error.
// after(busy) renders the buttons row so it can be disabled while the form is busy.
export const Form = forwardRef(function Form({ onSubmit, after, children, ...rest }, ref) {
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    const form = e.currentTarget;
    setErr(""); setBusy(true);
    try { await onSubmit(Object.fromEntries(new FormData(form)), form); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };
  return <form {...rest} ref={ref} onSubmit={submit}>{children}<p className="err" role="alert">{err}</p>{after ? after(busy) : <button className="btn" disabled={busy}>Submit</button>}</form>;
});

// ===== header: ticker, search, country, links and the category menus =====
function navItems(P, CATS, BRANDS, catImg) {
  const page = document.body.dataset.page;
  const byId = id => P.find(p => p.id === +id);
  const curCat = page === "category" ? qs.get("cat") : page === "product" ? (byId(qs.get("id")) || {}).cat : "";
  const top = list => [...list].sort((a, b) => off(b) - off(a)).slice(0, 4);
  const items = CATS.map(cat => {
    const inCat = P.filter(p => p.cat === cat), { S, sizeOf, all } = catSizes(P, cat), oss = osList(inCat), short = S ? S.short : cat;
    return {
      label: cat, href: catUrl(cat), cur: curCat === cat, head: "Shop " + cat, prodHead: "Popular " + cat, prods: top(inCat),
      tiles: [["All " + cat, catUrl(cat), catImg(cat)],
        ...all.map(s => [s.label, listUrl({ cat, size: s.label }), inCat.find(p => (sizeOf(p) || {}).label === s.label).img]),
        ...BRANDS.filter(b => inCat.some(p => p.brand === b)).map(b => [b + " " + short, listUrl({ cat, brand: b }), inCat.find(p => p.brand === b).img]),
        ...oss.map(os => [os, listUrl({ cat, os }), inCat.find(p => p.os === os).img])],
      links: [...(oss.length > 1 ? [["Compare operating systems", catUrl(cat) + "#os"]] : []), ...(TOP_FEATURES[cat] ? [["Top features", catUrl(cat) + "#features"]] : []),
        ["Deals on " + short, listUrl({ cat, sort: "off" })], ["Delivery", "/shipping"], ["Warranty and returns", "/returns"], ...(SHOW_STORES ? [["Store locator", "/stores"]] : [])],
      promo: oss.length > 1 ? [oss.join(" or ") + "?", "See what each one gives you, side by side.", catUrl(cat) + "#os"] : null,
    };
  });
  items.push({
    label: "Brands", href: "/products", cur: page === "category" && !curCat && !!qs.get("brand"), head: "Shop by brand", prodHead: "Top deals", prods: top(P),
    tiles: BRANDS.flatMap(b => [["All " + b, brandUrl(b), P.find(p => p.brand === b).img],
      ...CATS.filter(c => P.some(p => p.brand === b && p.cat === c)).map(c => [b + " " + (CAT_SIZE[c] ? CAT_SIZE[c].short : c), listUrl({ cat: c, brand: b }), P.find(p => p.brand === b && p.cat === c).img])]),
    links: [["All products", "/products"], ["Deals of the day", "/products?sort=off"], ["My wishlist", "/products?wish=1"], ["About Mytekkstore", "/about"], ["Contact us", "/contact"]],
  });
  items.push({ label: "Best Deals", href: "/offers", cur: page === "offers" }); // a plain link to the festive offers page, no panel
  return items;
}

// search box with live suggestions: matching products, categories and brands as you type; the biggest deals before typing
function Search() {
  const { P, CATS, BRANDS, money } = useStore();
  const [q, setQ] = useState(qs.get("q") || ""), [open, setOpen] = useState(false), [sel, setSel] = useState(-1);
  const t = q.trim().toLowerCase(), typing = t.length >= 2;
  const hits = typing ? P.filter(p => (p.brand + " " + p.cat + " " + p.name).toLowerCase().includes(t)).slice(0, 6) : [...P].sort((a, b) => off(b) - off(a)).slice(0, 4);
  const links = typing ? [...CATS.filter(c => c.toLowerCase().includes(t)).map(c => [c, catUrl(c)]), ...BRANDS.filter(b => b.toLowerCase().includes(t)).map(b => ["All " + b, brandUrl(b)])].slice(0, 4) : [];
  const items = [...links.map(([label, href]) => ({ label, href })), ...hits.map(p => ({ label: p.brand + " " + p.name, href: productUrl(p), p }))];
  const show = open && items.length > 0;
  const onKey = e => {
    if (!show) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(x => (x + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(x => (x - 1 + items.length) % items.length); }
    else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); location.href = items[sel].href; }
    else if (e.key === "Escape") setOpen(false);
  };
  return <form role="search" action="/products" className="sbox" onSubmit={e => { if (!q.trim()) e.preventDefault(); }}>
    <input type="search" name="q" value={q} placeholder="What are you looking for?" aria-label="Search products" autoComplete="off"
      role="combobox" aria-expanded={show} aria-controls="sugg" aria-autocomplete="list" aria-activedescendant={sel >= 0 ? "sg" + sel : undefined}
      onChange={e => { setQ(e.target.value); setSel(-1); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey} />
    {show && <div className="sugg" id="sugg" role="listbox" onMouseDown={e => e.preventDefault()}>
      <p className="shead">{typing ? "Suggestions" : "Popular right now"}</p>
      {items.map((it, i) => <a href={it.href} className={"sg" + (it.p ? " sp" : "") + (i === sel ? " on" : "")} id={"sg" + i} role="option" aria-selected={i === sel} key={it.href}>
        {it.p ? <><img src={pic(it.p.img, 480)} alt="" loading="lazy" width="800" height="800" /><span><small>{it.p.brand} · {it.p.cat}</small><b>{it.p.name}</b></span><i>{money(it.p.price)}</i></> : <><Icon k="search" /><b>{it.label}</b></>}</a>)}
      {typing && <a className="sg all" href={"/products?q=" + encodeURIComponent(q.trim())}><Icon k="search" /><b>See all results for "{q.trim()}"</b></a>}
    </div>}
  </form>;
}

// "Deliver to" chip: the pincode typed once here is remembered for the product pages and the checkout (a native details pop-over)
function Deliver() {
  const [pin, setPin] = useState(() => load("pin", "")), [place, setPlace] = useState(() => load("pinplace", "")), [msg, setMsg] = useState("");
  const ref = useRef();
  useEffect(() => { const h = e => { if (ref.current && ref.current.open && !ref.current.contains(e.target)) ref.current.open = false; }; document.addEventListener("click", h); return () => document.removeEventListener("click", h); }, []);
  const submit = async e => {
    e.preventDefault();
    const v = e.currentTarget.pin.value.trim();
    if (!/^\d{6}$/.test(v)) return setMsg("Please enter a 6-digit pincode.");
    setMsg("Checking…");
    let district = "";
    try { district = (await api("pincode/" + v)).district || ""; }
    catch (ex) { if (/find/.test(ex.message)) return setMsg(ex.message); } // service down: keep the pincode, the standard promise still applies
    save("pin", v); save("pinplace", district); setPin(v); setPlace(district); setMsg(""); ref.current.open = false;
  };
  return <details className="deliver" ref={ref}><summary><Icon k="pin" /><span><small>Deliver to</small><b>{pin ? (place ? place + " " + pin : pin) : "Enter pincode"}</b></span></summary>
    <form className="dpop" onSubmit={submit}><label>Pincode<input name="pin" inputMode="numeric" maxLength="6" defaultValue={pin} placeholder="6-digit pincode" /></label><button className="btn">Check</button>
      <p className="muted small" role="status">{msg || "Free delivery, usually in 3 to 5 days. Cash on delivery available."}</p></form></details>;
}

// a category panel fades down and its tiles, products and links arrive one after another (Motion; nothing moves under reduced motion)
function flyIn(panel) {
  if (!panel || reduced()) return;
  panel.style.opacity = 0; // never a full-opacity frame before the fade starts
  animate(panel, { opacity: [0, 1], y: [-8, 0] }, { duration: .25, ease: [.2, .8, .2, 1] });
  animate($$(".ntile, .nprod, .ndisc a, .npromo", panel), { opacity: [0, 1], y: [10, 0] }, { delay: stagger(.025), duration: .35, ease: [.2, .8, .2, 1] });
}
function flyOut(panel) { if (panel && !reduced()) animate(panel, { opacity: 0, y: -6 }, { duration: .15 }); }

export function Header() {
  const { P, CATS, BRANDS, catImg, me, money, country, wish, cartCount, bump, closeCart } = useStore();
  const items = navItems(P, CATS, BRANDS, catImg);
  // bar order (redesign brief): the categories on sale, then the categories coming (placeholders, no page), then Brands and Best Deals
  const ordered = [...items.slice(0, CATS.length).map((it, i) => ({ it, i })), ...COMING_SOON.map(soon => ({ soon })), ...items.slice(CATS.length).map((it, k) => ({ it, i: CATS.length + k }))];
  const page = document.body.dataset.page;
  const navRef = useRef();

  // category menus: the category name is the only control. A mouse opens the panel by hovering the name and a click goes to the
  // category page; a finger opens it with one tap and follows the link with a second; the keyboard opens it by focusing the name.
  useEffect(() => {
    let openLi = null, pinned = false, navTimer, lastPointer = "mouse";
    const setOpen = (li, pin = false) => {
      clearTimeout(navTimer);
      pinned = !!li && pin;
      if (li === openLi) return;
      if (openLi) { openLi.classList.remove("open"); $(".l0link", openLi).setAttribute("aria-expanded", "false"); flyOut($(".npanel", openLi)); }
      openLi = li;
      if (li) { li.classList.add("open"); $(".l0link", li).setAttribute("aria-expanded", "true"); flyIn($(".npanel", li)); }
      document.body.classList.toggle("nav-open", !!li);
      document.body.classList.toggle("nav-pinned", pinned);
    };
    const offs = [];
    const on = (el, ev, fn) => { el.addEventListener(ev, fn); offs.push(() => el.removeEventListener(ev, fn)); };
    $$(".l0", navRef.current).filter(li => $(".npanel", li)).forEach(li => {
      // short delays so the menu does not flash open when the pointer only passes over the bar
      on(li, "pointerenter", e => { if (e.pointerType === "mouse") { clearTimeout(navTimer); navTimer = setTimeout(() => { if (openLi !== li) setOpen(li); }, openLi ? 110 : 150); } });
      on(li, "pointerleave", e => { if (e.pointerType === "mouse") { clearTimeout(navTimer); if (!pinned) navTimer = setTimeout(() => setOpen(null), 250); } });
      on(li, "focusout", e => { if (openLi === li && e.relatedTarget && !li.contains(e.relatedTarget)) setOpen(null); });
      const link = $(".l0link", li);
      on(link, "pointerdown", e => lastPointer = e.pointerType);
      on(link, "keydown", () => lastPointer = "keyboard");
      on(link, "focus", () => { if (link.matches(":focus-visible")) setOpen(li); }); // reached by Tab: show the panel
      on(link, "click", e => {
        if (lastPointer !== "touch" && lastPointer !== "pen") return; // a mouse click or Enter goes to the category page
        if (openLi !== li) { e.preventDefault(); setOpen(li, true); } // first tap opens the menu; a second tap on the name follows the link
      });
    });
    // an open category menu closes on a click outside it, or once one of its links is followed
    on(document, "click", e => { if (openLi && (!openLi.contains(e.target) || e.target.closest(".npanel a"))) setOpen(null); });
    on(document, "keydown", e => {
      if (e.key !== "Escape") return;
      if (openLi) { if (openLi.contains(document.activeElement)) $(".l0link", openLi).focus(); setOpen(null); } // focus goes back to the category name
      closeCart();
    });
    // other sticky parts and the menu panels sit just below the header, whatever its height
    const syncHeader = () => document.documentElement.style.setProperty("--hh", $("#hdr").offsetHeight + "px");
    syncHeader(); on(window, "resize", syncHeader);
    if (document.fonts) document.fonts.ready.then(syncHeader);
    return () => offs.forEach(f => f());
  }, [P]);

  const n = cartCount();
  return <header id="hdr">
    <div className="ticker" aria-label="Store offers"><div>{[0, 1].flatMap(r => [["truck", "Free delivery on every order"], ["shield", "100% genuine products with brand warranty"], ["cash", "Cash on delivery available"], ["undo", "Easy returns"], ["box", "Track every order from your account"]].map(([i, t]) => <span key={r + i}><Icon k={i} /> {t}</span>))}</div></div>
    <div className="wrap">
      <a className="logo" href="/"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#08805f" /><path d="M18 5 9 18h6l-2 9 10-14h-6z" fill="#ffffff" /></svg><span>mytekk<b>store</b></span></a>
      <Search /><Deliver />
      <select id="country" aria-label="Country" defaultValue={country} onChange={e => { save("country", e.target.value); location.reload(); }}>{Object.keys(COUNTRIES).map(c => <option value={c} key={c}>{c}</option>)}</select>
      <a className="hlink" href="/account" aria-label={me ? "My account" : "Sign in"}><Icon k="user" /> <span>{me ? me.name.split(" ")[0] : "Sign in"}</span></a>
      <a className="hlink" href="/products?wish=1" aria-label="Wishlist"><Icon k="heart" /> <span id="wishN" className="count" hidden={!wish.length}>{wish.length}</span></a>
      <a className="hlink" href="/cart" data-drawer aria-label="Cart"><Icon k="cart" /> <span id="cartN" className={"count" + (bump ? " bump" : "")} key={bump} hidden={!n}>{n}</span></a>
    </div>
    <nav className="gnav" aria-label="Shop" ref={navRef}><ul className="gbar">{ordered.map(({ it, i, soon }) => soon ? <li className="soon" key={soon}><span>{soon}</span></li> : <li className={"l0" + (it.cur ? " cur" : "")} key={it.label}>
      <a className="l0link" href={it.href} aria-current={it.cur && page === "category" ? "page" : undefined} {...(it.tiles ? { "aria-haspopup": "true", "aria-expanded": "false", "aria-controls": "nav" + i } : {})}>{it.label}</a>{it.tiles &&
      <div className="npanel" id={"nav" + i}><div className="ngrid">
        <div><p className="nhead">{it.head}</p><div className="ntiles">{it.tiles.map(([t, h, img]) => <a className="ntile" href={h} key={h}><img src={pic(img, 480)} alt="" loading="lazy" width="800" height="800" /><span>{t}</span></a>)}</div></div>
        <div><p className="nhead">{it.prodHead}</p><div className="nprods">{it.prods.map(p => <a className="nprod" href={productUrl(p)} key={p.id}><img src={pic(p.img, 480)} alt="" loading="lazy" width="800" height="800" /><span><small>{p.brand}</small><b>{p.name}</b><i>{money(p.price)}</i></span></a>)}</div></div>
        <div className="ndisc"><p className="nhead">Discover</p>{it.links.map(([t, h]) => <a href={h} key={t}>{t}</a>)}{it.promo && <a className="npromo" href={it.promo[2]}><b>{it.promo[0]}</b><span>{it.promo[1]}</span><u>Open the guide →</u></a>}</div>
      </div></div>}</li>)}</ul></nav>
  </header>;
}

export function Footer() {
  const { CATS, BRANDS } = useStore();
  return <footer id="ftr"><div className="wrap">
    <div className="ftrust">{[["lock", "No card details stored"], ["cash", "Cash on delivery"], ["undo", "Easy returns"], ["shield", "Brand warranty on everything"], ["truck", "Free delivery on every order"]].map(([i, t]) => <span key={t}><Icon k={i} />{t}</span>)}</div>
    <div className="fcols">
      <div><b>Shop</b>{CATS.slice(0, 6).map(c => <a href={catUrl(c)} key={c}>{c}</a>)}</div>
      <div><b>Brands</b>{BRANDS.slice(0, 6).map(b => <a href={brandUrl(b)} key={b}>{b}</a>)}</div>
      <div><b>Help</b><a href="/contact">Contact</a><a href="/shipping">Shipping</a><a href="/returns">Warranty and returns</a>{SHOW_STORES && <a href="/stores">Store locator</a>}</div>
      <div><b>Mytekkstore</b><a href="/about">About</a><a href="/account">My account</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div>
    </div>
    <div className="copy">© 2026 Mytekkstore. All rights reserved.</div>
  </div></footer>;
}

// cart drawer, dim layers, toast, scroll progress and back-to-top
// phones: a fixed bar at the bottom with the five places shoppers go most (hidden on desktop, see .mnav)
function MobileNav() {
  const { cartCount } = useStore();
  const page = document.body.dataset.page, n = cartCount();
  const items = [["/", "home", "Home", page === "home"], ["/products", "apps", "Shop", page === "category" || page === "product"], ["/offers", "tag", "Deals", page === "offers"],
    ["/cart", "cart", "Cart", page === "cart" || page === "checkout"], ["/account", "user", "Account", page === "account" || page === "order"]];
  return <nav className="mnav" aria-label="Quick links">{items.map(([h, i, t, on]) => <a href={h} className={on ? "on" : undefined} aria-current={on ? "page" : undefined} key={h}><Icon k={i} />{t}{i === "cart" && n > 0 && <span className="count">{n}</span>}</a>)}</nav>;
}

// the drawer slides on a spring, the toast pops in and out, and the progress line follows a sprung scroll value (Motion)
import { ChatWidget } from "./chat.jsx";
const SPRING = { type: "spring", stiffness: 320, damping: 32 };
const DRAWER = { open: { x: 0, visibility: "visible" }, closed: { x: "100%", transitionEnd: { visibility: "hidden" } } };
export function Chrome() {
  const { cart, byId, money, cartCount, cartTotal, toastState, cartOpen } = useStore();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: .4 });
  const n = cartCount();
  return <>
    <div className="navshade"></div><div className="overlay" data-close></div>
    <m.aside className="drawer" aria-label="Cart" initial={false} animate={cartOpen ? "open" : "closed"} variants={DRAWER} transition={SPRING}><h2>Your cart (<span>{n}</span>) <button className="x" data-close aria-label="Close cart">×</button></h2><div className="dbody">{n ? <>
      <div className="lines"><AnimatePresence initial={false}>{Object.keys(cart).map(id => <m.div layout key={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} transition={SPRING}><Line p={byId(id)} /></m.div>)}</AnimatePresence></div>
      <div className="dfoot"><div className="tot"><span>Subtotal</span><b>{money(cartTotal())}</b></div><a className="btn" href="/checkout">Checkout</a><a className="btn ghost" href="/cart">View cart</a></div></>
      : <div className="empty"><div className="big"><Icon k="cart" /></div><p>Your cart is empty.</p><button className="btn" data-close>Continue shopping</button></div>}</div></m.aside>
    <AnimatePresence>{toastState.msg && <m.div className="toast on" role="status" key="toast" style={{ x: "-50%" }} initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }} transition={SPRING}><span>{toastState.msg}</span>{toastState.withCart && <button data-drawer>View cart</button>}</m.div>}</AnimatePresence>
    <QuickView />
    <MobileNav />
    <ChatWidget />
    <m.div className="progress" style={{ scaleX: progress }}></m.div><button className="totop" aria-label="Back to top" onClick={() => scrollTo({ top: 0, behavior: "smooth" })}>↑</button>
  </>;
}

// Quick View modal (client brief, section 19): the product's photo, price, key specifications and actions, without leaving the list
export function QuickView() {
  const { quick, closeQuick, byId, money } = useStore();
  const p = quick ? byId(quick) : null;
  useEffect(() => {
    if (!p) return;
    const k = e => { if (e.key === "Escape") closeQuick(); };
    addEventListener("keydown", k);
    document.body.classList.add("quick-open");
    return () => { removeEventListener("keydown", k); document.body.classList.remove("quick-open"); };
  }, [p]);
  return <AnimatePresence>{p && <m.div className="quickwrap" key="qv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => { if (e.target === e.currentTarget) closeQuick(); }}>
    <m.div className="quick" role="dialog" aria-modal="true" aria-label={p.brand + " " + p.name} initial={{ opacity: 0, scale: .96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} transition={SPRING}>
      <button type="button" className="x" aria-label="Close" onClick={closeQuick}>×</button>
      <div className="qimg"><Photo p={p} main />{off(p) > 0 && <span className="badge">{off(p)}% off</span>}</div>
      <div className="qinfo">
        <a className="qbrand" href={brandUrl(p.brand)}>{p.brand}{p.os ? " · " + p.os : ""}</a>
        <h2>{p.brand} {p.name}</h2>
        <Stars p={p} />
        <div className="price"><b>{money(p.price)}</b>{p.mrp > p.price && <><s>{money(p.mrp)}</s><span className="badge">{off(p)}% off</span></>}</div>
        {p.emi && <p className="muted small">No Cost EMI from {money(emiPlans(p.price)[2][1])}/month</p>}
        {(p.specs || []).length > 0 && <ul className="qspecs">{p.specs.slice(0, 5).map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}</ul>}
        <div className="qactions"><Buy p={p} />{p.stock > 0 && <button type="button" className="btn ghost" data-buy={p.id}>Buy now</button>}<Heart p={p} /></div>
        <a className="alink qmore" href={productUrl(p)}>View full details →</a>
      </div>
    </m.div></m.div>}</AnimatePresence>;
}
// the operating systems side by side: one column per system the catalogue carries, general facts per row, a shop link per column
export function OsChart({ P, id = "os", lead }) {
  const oss = osList(P).filter(o => TV_OS[o]);
  if (oss.length < 2) return null;
  return <section className="oschart" id={id}><h2>{oss.join(" or ") + "?"}</h2><p className="lead">{lead || "What each operating system gives you, side by side. Every model shows its system on its card."}</p>
    <div className="scroll"><table className="ctable os"><thead><tr><th></th>{oss.map(o => { const n = P.filter(p => p.os === o).length; return <th key={o}><b>{o}</b><small>{n} model{n === 1 ? "" : "s"}</small></th>; })}</tr></thead>
      <tbody>
        <tr><th>In short</th>{oss.map(o => <td key={o}>{TV_OS[o].blurb}</td>)}</tr>
        {OS_ROWS.map((r, i) => <tr key={r}><th>{r}</th>{oss.map(o => <td key={o}>{TV_OS[o].rows[i]}</td>)}</tr>)}
        <tr><th></th>{oss.map(o => <td key={o}><a className="btn" href={osUrl(o)}>Shop {o} TVs</a></td>)}</tr>
      </tbody></table></div></section>;
}
// a question-and-answer list (warranty, returns), in the same shape as Good to know
export const Qa = ({ title, lead, list, id }) => <section className="faq" id={id}><h2>{title}</h2>{lead && <p className="lead">{lead}</p>}<div className="faqs">{list.map(([q, a, link]) => <details key={q}><summary>{q}</summary><p>{a}{link && <> <a className="alink" href={link[0]}>{link[1]} →</a></>}</p></details>)}</div></section>;
