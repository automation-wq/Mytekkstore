// Category, brand, search and wishlist lists: lifestyle headline, explore tiles, size tabs, faceted filters (brand, price,
// operating system, discount, stock, EMI, rating) that apply at once and stay in the address, applied-filter chips, sort, the compare
// table, Top features, the operating systems side by side, deals, reviews, bank offers and the questions, warranty included.
import { useEffect, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { useStore } from "./store.jsx";
import { qs, track } from "./api.js";
import { Card, Box, Icon, Photo, Stars, Buy, BankOffers, KvImg, OsChart, Qa, Row, TrustLine, BankStrip } from "./components.jsx";
import { TOP_FEATURES, KV_IMG, CAT_SIZE, CAT_KNOW, CAT_FAQ, BRAND_BLURB, catSizes, catUrl, listUrl, off, avg, starRow, productUrl, pic, osList, life, brandImg, brandPoints, CONTACT } from "./data.js";

export const BANDS = [[0, 10000, "Under ₹10,000"], [10000, 25000, "₹10,000 to ₹25,000"], [25000, 50000, "₹25,000 to ₹50,000"], [50000, 0, "Above ₹50,000"]]; // [min, max, label]
const OFFS = [10, 20, 30];
// resolution read from the specifications (Samsung and LG both filter by it)
const RES = ["4K Ultra HD", "Full HD", "HD Ready"];
const typeOf = p => (((p.specs || []).find(([k]) => k.toLowerCase() === "display type") || [])[1] || "").split(",")[0].trim(); // screen technology (LED, QLED, OLED), kept apart from the resolution
export const resOf = p => { const r = ((p.specs || []).find(([k]) => k.toLowerCase() === "resolution") || [])[1] || ""; return /4K/i.test(r) ? RES[0] : /Full HD/i.test(r) ? RES[1] : /HD/i.test(r) ? RES[2] : ""; };
// the filters live in the address, so a filtered list can be shared and the menu links keep working; they apply without a reload
const readFilters = () => ({ brand: (qs.get("brand") || "").split(",").filter(Boolean), size: qs.get("size") || "", os: qs.get("os") || "", res: qs.get("res") || "", type: qs.get("type") || "", min: +qs.get("min") || 0, max: +qs.get("max") || 0,
  off: +qs.get("off") || 0, instock: qs.has("instock"), emi: qs.has("emi"), rating: +qs.get("rating") || 0, sort: qs.get("sort") || "" });
const INK = { type: "spring", stiffness: 420, damping: 34 };
export const SIZE_NOTE = { 32: "Compact spaces", 40: "Bedrooms", 43: "Everyday viewing", 50: "Family rooms", 55: "Living-room favourite", 65: "Cinematic experience", 75: "Go bigger" };
const OS_NOTE = { "Google TV": "Google Play, Assistant, Chromecast", "WebOS": "Quick card-style home screen", "Android TV": "Google Play apps" };
const RES_NOTE = { "4K Ultra HD": "Four times the detail of Full HD", "Full HD": "Crisp everyday viewing", "HD Ready": "Great value for smaller rooms" };
// The three ways in under the category banner (client brief, section 17): Size, OS, Screen type / Resolution. Every option is a picture
// card with its starting price, built from the catalogue, and a tap applies the matching filter without a reload (the address keeps it).
export function Discover({ list, sizes, sizeOf, f, set, url, money }) {
  const [tab, setTab] = useState(f.os ? "os" : f.res || f.type ? "res" : "size");
  const card = (ps, key, label, note, on, patch) => { const c = [...ps].sort((a, b) => a.price - b.price)[0]; return c && { key, label, note, img: c.img, from: c.price, on, patch }; };
  const tabs = [
    ["size", "Shop by Size", [...sizes].sort((a, b) => a.n - b.n).map(s => card(list.filter(p => (sizeOf(p) || {}).label === s.label), s.label, s.label.replace(/ TVs$/, "").replace(/ inch$/, '"'), SIZE_NOTE[s.n] || "", f.size === s.label, { size: f.size === s.label ? "" : s.label }))],
    ["budget", "Shop by Budget", BANDS.map(([a, b, l]) => { const on = f.min === a && f.max === b, ps = list.filter(p => (!a || p.price >= a) && (!b || p.price <= b)); return card(ps, "band:" + l, l, ps.length + " model" + (ps.length === 1 ? "" : "s"), on, on ? { min: 0, max: 0 } : { min: a, max: b }); })],
    ["os", "Shop by OS", osList(list).map(o => card(list.filter(p => p.os === o), o, o, OS_NOTE[o] || "Smart apps built in", f.os === o, { os: f.os === o ? "" : o }))],
    ["res", "Screen type / Resolution", [...[...new Set(list.map(typeOf).filter(Boolean))].sort().map(t => card(list.filter(p => typeOf(p) === t), "type:" + t, t, "Screen technology", f.type === t, { type: f.type === t ? "" : t })),
      ...RES.map(r => card(list.filter(p => resOf(p) === r), r, r, RES_NOTE[r], f.res === r, { res: f.res === r ? "" : r }))]],
  ].map(([k, t, cards]) => [k, t, cards.filter(Boolean)]).filter(([, , cards]) => cards.length);
  const cur = tabs.find(([k]) => k === tab) || tabs[0];
  if (!cur) return null;
  return <section className="disco cdisco" aria-label="Find your TV">
    <div className="dtabs" role="tablist">{tabs.map(([k, t]) => <button type="button" role="tab" aria-selected={cur[0] === k} className={cur[0] === k ? "on" : undefined} onClick={() => setTab(k)} key={k}>{t}{cur[0] === k && <m.i className="ink" layoutId="dtab-ink" transition={INK} />}</button>)}</div>
    <div className="dgrid auto" role="tabpanel">{cur[2].map(c => <a className={"dcard" + (c.on ? " on" : "")} href={url(c.patch)} aria-current={c.on ? "true" : undefined} onClick={e => { e.preventDefault(); set(c.patch); }} key={c.key}><span className="dimg"><img src={pic(c.img, 480)} alt="" loading="lazy" width="800" height="800" /></span><span className="dbody"><b>{c.label}</b><small>{c.note}</small><em>{c.on ? "Showing now" : "from " + money(c.from)}</em></span><i className="darr" aria-hidden="true">{c.on ? "×" : "→"}</i></a>)}</div>
  </section>;
}
const Group = ({ title, children }) => <fieldset className="fg"><legend>{title}</legend>{children}</fieldset>;
const Opt = ({ on, onChange, label, n }) => <label className={"fopt" + (on ? " on" : "")}><input type="checkbox" checked={on} onChange={onChange} /><span>{label}</span><small>{n}</small></label>;

export function Category() {
  const { P, CATS, BRANDS, catImg, wish, money } = useStore();
  const cat = qs.get("cat") || "", q = (qs.get("q") || "").trim(), wishOnly = qs.has("wish");
  const [f, setF] = useState(readFilters);
  const [open, setOpen] = useState(false); // the filter drawer on phones
  const [cmp, setCmp] = useState([]); // products ticked for the compare table, up to four (Samsung, LG and Croma all offer this)
  const toggleCmp = id => { if (!cmp.includes(id)) track("compare_add", { id }); setCmp(c => c.includes(id) ? c.filter(x => x !== id) : c.length < 4 ? [...c, id] : c); };
  const set = patch => { track("filter", patch); setF(x => ({ ...x, ...patch })); };
  const clear = () => setF(x => ({ brand: [], size: "", os: "", res: "", type: "", min: 0, max: 0, off: 0, instock: false, emi: false, rating: 0, sort: x.sort }));
  const { S, sizeOf, all: sizeList } = catSizes(P, cat);
  const catAll = P.filter(p => !cat || p.cat === cat);
  // the brand's sizes for a card's size pills: one model per size, this product for its own size, smallest first
  const sizesOf = p => { if (!sizeOf(p)) return null; const m = new Map(); catAll.filter(x => x.brand === p.brand).forEach(x => { const s = sizeOf(x); if (s && (!m.has(s.n) || x.id === p.id)) m.set(s.n, x); }); return [...m.values()].sort((a, b) => sizeOf(a).n - sizeOf(b).n).map(x => [String(sizeOf(x).n), productUrl(x), x.id === p.id]); };
  const base = catAll.filter(p => (!wishOnly || wish.includes(p.id)) && (p.brand + " " + p.cat + " " + p.name).toLowerCase().includes(q.toLowerCase()));
  // skip names one group, so a choice can show how many products it would give
  // the size in the address: the label ("55 inch TVs"), a plain inch number ("55", from the home page's size cards) or "65+" (65 inch and above)
  const sizeMatch = (p, v) => { const s = sizeOf(p); if (!s) return false; const m = /^(\d+)(\+?)$/.exec(String(v).trim()); return m ? (m[2] ? s.n >= +m[1] : s.n === +m[1]) : s.label === v; };
  const sizeTitle = v => { const m = /^(\d+)(\+?)$/.exec(String(v).trim()); return m ? m[1] + "-inch" + (m[2] ? " and above" : "") : String(v).replace(/ TVs$/, "").replace(/ inch$/, "-inch"); };
  const pass = (p, skip) => (skip === "brand" || !f.brand.length || f.brand.includes(p.brand)) && (!f.size || sizeMatch(p, f.size)) && (skip === "os" || !f.os || p.os === f.os) && (skip === "res" || !f.res || resOf(p) === f.res) && (skip === "type" || !f.type || typeOf(p) === f.type)
    && (skip === "price" || ((!f.min || p.price >= f.min) && (!f.max || p.price <= f.max))) && (skip === "off" || !f.off || off(p) >= f.off)
    && (skip === "instock" || !f.instock || p.stock > 0) && (skip === "emi" || !f.emi || p.emi) && (skip === "rating" || !f.rating || avg(p) >= f.rating);
  const list = base.filter(p => pass(p));
  const count = (skip, test) => base.filter(p => pass(p, skip) && test(p)).length;
  const sorts = { low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, off: (a, b) => off(b) - off(a), rating: (a, b) => avg(b) - avg(a) };
  if (Object.hasOwn(sorts, f.sort)) list.sort(sorts[f.sort]);
  const title = wishOnly ? "My wishlist" : q ? 'Results for "' + q + '"' : [f.brand.length === 1 ? f.brand[0] : "", cat].filter(Boolean).join(" ") || "All products";
  // a single-facet view reads as a landing page: "TVs under ₹20,000", "43-inch TVs", "4K Ultra HD TVs"
  const short = cat ? (S ? S.short : cat) : "products";
  const coll = (wishOnly || q || f.brand.length) ? "" :
    (f.max && !f.min ? short + " under " + money(f.max)
      : f.min && f.max ? short + " from " + money(f.min) + " to " + money(f.max)
      : f.min && !f.max ? short + " above " + money(f.min)
      : f.size ? sizeTitle(f.size) + " " + short
      : f.os ? (/ TV$/.test(f.os) ? f.os + "s" : f.os + " " + short) // "Google TVs", "Android TVs", "WebOS TVs"
      : f.res ? f.res + " " + short
      : f.type ? f.type + " " + short : "");
  useEffect(() => { document.title = (coll || title) + " | Mytekkstore"; }, [coll]);
  const params = { cat, q, wish: wishOnly ? 1 : "", brand: f.brand.join(","), size: f.size, os: f.os, res: f.res, type: f.type, min: f.min || "", max: f.max || "", off: f.off || "", instock: f.instock ? 1 : "", emi: f.emi ? 1 : "", rating: f.rating || "", sort: f.sort };
  const url = o => listUrl({ ...params, ...o });
  useEffect(() => { history.replaceState(null, "", url({}) + location.hash); }, [f]);
  useEffect(() => {
    document.body.classList.toggle("filters-open", open);
    if (!open) return;
    const k = e => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open]);

  // tiles: the categories, only when no category is chosen (a category page has the three-tab discovery instead)
  const tiles = [];
  if (!cat && !f.brand.length) CATS.forEach(c => tiles.push([c, P.filter(p => p.cat === c).length + " products", catUrl(c), catImg(c), false])); // category tiles only when no category is chosen
  const band = BANDS.find(([a, b]) => a === f.min && b === f.max);
  const chips = [...f.brand.map(b => [b, () => set({ brand: f.brand.filter(x => x !== b) })]), ...(f.size ? [[sizeTitle(f.size).replace(/-inch/, " inch"), () => set({ size: "" })]] : []), ...(f.os ? [[f.os, () => set({ os: "" })]] : []), ...(f.res ? [[f.res, () => set({ res: "" })]] : []), ...(f.type ? [[f.type, () => set({ type: "" })]] : []),
    ...((f.min || f.max) ? [[band ? band[2] : !f.min ? "Under " + money(f.max) : !f.max ? "Above " + money(f.min) : money(f.min) + " to " + money(f.max), () => set({ min: 0, max: 0 })]] : []), ...(f.off ? [[f.off + "% off or more", () => set({ off: 0 })]] : []),
    ...(f.instock ? [["In stock", () => set({ instock: false })]] : []), ...(f.emi ? [["No Cost EMI", () => set({ emi: false })]] : []), ...(f.rating ? [[f.rating + "★ and above", () => set({ rating: 0 })]] : [])];
  const n = list.length, nText = n + " product" + (n === 1 ? "" : "s");
  return <>
    <div className="crumbs"><a href="/">Home</a> › {coll && cat ? <><a href={catUrl(cat)}>{cat}</a> › {coll}</> : title}</div>
    {wishOnly ? <h1>My wishlist</h1> : S && KV_IMG[cat] ? <div className="kv"><div className="kvimg"><KvImg src={cat === "Televisions" ? life("category", "img/kv-tv.jpg") : `img/${KV_IMG[cat]}.jpg`} sizes="(max-width:1240px) 100vw, 1240px" eager /></div><div><span className="eyebrow">{cat}</span><h1 className="explore">{coll || "A World of Entertainment Awaits."}</h1><p>{coll ? n + " model" + (n === 1 ? "" : "s") + " · free delivery and cash on delivery on every TV." : "Discover televisions designed for every room and every moment."}</p></div></div>
      : !cat && f.brand.length === 1 && !q ? <BrandStrip brand={f.brand[0]} P={P} />
      : <h1 className="explore">{S ? "Explore " + S.short : title}</h1>}
    {!wishOnly && S && cat && catAll.length > 0 && <Discover list={catAll} sizes={sizeList} sizeOf={sizeOf} f={f} set={set} url={url} money={money} />}
    {!wishOnly && tiles.length > 0 && <div className="finder"><div className="tiles">{tiles.map(([name, note, href, img, on]) => <a className={"tile" + (on ? " on" : "")} href={href} aria-current={on ? "page" : undefined} key={href}><span><b>{name}</b><small>{note}</small></span><img src={pic(img, 480)} alt="" loading="lazy" width="800" height="800" /></a>)}</div></div>}
    <div className="ptool"><h2 className="ptotal">{coll || nText}{coll ? <small className="pcount"> · {nText}</small> : q ? ' · "' + q + '"' : ""}</h2>
      {!wishOnly && <button type="button" className="btn ghost fbtn" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="filters"><Icon k="sliders" /> Filters{chips.length ? " (" + chips.length + ")" : ""}</button>}
      <label className="sortby">Sort by <select value={f.sort} onChange={e => set({ sort: e.target.value })}><option value="">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="off">Biggest discount</option><option value="rating">Customer rating</option></select></label></div>
    {!wishOnly && n > 0 && <TrustLine />}
    {chips.length > 0 && <div className="chips" aria-label="Applied filters"><AnimatePresence>{chips.map(([t, rm]) => <m.button type="button" className="fchip" onClick={rm} aria-label={"Remove " + t} key={t} layout initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .8 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>{t} <span aria-hidden="true">×</span></m.button>)}</AnimatePresence><button type="button" className="link" onClick={clear}>Clear all</button></div>}
    <div className="plp">
      <div className="foverlay" onClick={() => setOpen(false)}></div>
      {!wishOnly && <aside className="filters" id="filters" aria-label="Filters">
        <div className="fhead"><b>Filters</b><button type="button" className="x" onClick={() => setOpen(false)} aria-label="Close filters">×</button></div>
        {!cat && <Group title="Category">{CATS.map(c => <a className="fopt" href={listUrl({ cat: c, q })} key={c}><span>{c}</span><small>{P.filter(p => p.cat === c).length}</small></a>)}</Group>}
        <Group title="Brand">{BRANDS.filter(b => catAll.some(p => p.brand === b)).map(b => <Opt label={b} n={count("brand", p => p.brand === b)} on={f.brand.includes(b)} onChange={e => set({ brand: e.target.checked ? [...f.brand, b] : f.brand.filter(x => x !== b) })} key={b} />)}</Group>
        {osList(catAll).length > 0 && <Group title="Operating system">{osList(catAll).map(o => <Opt label={o} n={count("os", p => p.os === o)} on={f.os === o} onChange={e => set({ os: e.target.checked ? o : "" })} key={o} />)}</Group>}
        {RES.some(r => catAll.some(p => resOf(p) === r)) && <Group title="Resolution">{RES.filter(r => catAll.some(p => resOf(p) === r)).map(r => <Opt label={r} n={count("res", p => resOf(p) === r)} on={f.res === r} onChange={e => set({ res: e.target.checked ? r : "" })} key={r} />)}</Group>}
        <Group title="Price">{BANDS.map(([a, b, l]) => <Opt label={l} n={count("price", p => (!a || p.price >= a) && (!b || p.price <= b))} on={f.min === a && f.max === b} onChange={e => set(e.target.checked ? { min: a, max: b } : { min: 0, max: 0 })} key={l} />)}</Group>
        <Group title="Discount">{OFFS.map(o => <Opt label={o + "% off or more"} n={count("off", p => off(p) >= o)} on={f.off === o} onChange={e => set({ off: e.target.checked ? o : 0 })} key={o} />)}</Group>
        <Group title="More">
          <Opt label="In stock only" n={count("instock", p => p.stock > 0)} on={f.instock} onChange={e => set({ instock: e.target.checked })} />
          <Opt label="No Cost EMI" n={count("emi", p => p.emi)} on={f.emi} onChange={e => set({ emi: e.target.checked })} />
          <Opt label="4★ and above" n={count("rating", p => avg(p) >= 4)} on={f.rating === 4} onChange={e => set({ rating: e.target.checked ? 4 : 0 })} />
        </Group>
        <div className="ffoot"><button type="button" className="btn" onClick={() => setOpen(false)}>Show {nText}</button>{chips.length > 0 && <button type="button" className="link" onClick={clear}>Clear all</button>}</div>
      </aside>}
      {n ? <div className="grid">{list.map((p, i) => <Card p={p} i={i} key={p.id} sizes={sizesOf(p)} compare={[cmp.includes(p.id), toggleCmp]} />)}</div> : wishOnly ? <Box title="Your wishlist is empty" text="Tap the heart on any product to save it here." href="/products" cta="Browse products" />
        : <div className="box"><h1>No products found</h1><p>Try a different size, search or filter.</p>{chips.length ? <button type="button" className="btn" onClick={clear}>Clear filters</button> : <a className="btn" href="/products">See all products</a>}</div>}
    </div>
    {cmp.length > 0 && <div className="cmpbar" role="region" aria-label="Compare"><span>{cmp.length} of 4</span>{cmp.map(id => { const x = P.find(p => p.id === id); return x && <img src={pic(x.img, 480)} alt={x.name} key={id} />; })}<a className="btn" href="#compare" aria-disabled={cmp.length < 2 ? "true" : undefined}>Compare{cmp.length > 1 ? " " + cmp.length : ""}</a>{cmp.length > 1 && <a className="link page" href={"/compare?ids=" + cmp.join(",")}>Open page</a>}<button type="button" className="link" onClick={() => setCmp([])}>Clear</button></div>}
    {!wishOnly && <CategoryExtras cat={cat} list={catAll} sizes={sizeList} sizeUrl={s => url({ size: s })} picks={cmp.map(id => P.find(p => p.id === id)).filter(Boolean)} />}
  </>;
}

// The rest of a category page, so it reads like a brand page and not a bare list: every model side by side, the Top features band,
// "Know before you buy" explainers, the operating systems side by side, a deals banner, the newest reviews, bank offers and the category's questions.
// Everything with numbers or model facts is computed from the catalogue (list = every product in the category, unfiltered).
function CategoryExtras({ cat, list, sizes, sizeUrl, picks = [] }) {
  const { money } = useStore();
  const has = (o, k) => Object.hasOwn(o, k); // cat comes from the address
  const feats = has(TOP_FEATURES, cat) ? TOP_FEATURES[cat] : null, know = has(CAT_KNOW, cat) ? CAT_KNOW[cat] : null, faq = has(CAT_FAQ, cat) ? CAT_FAQ[cat] : null;
  const S = has(CAT_SIZE, cat) ? CAT_SIZE[cat] : null, short = S ? S.short : cat || "our products", rich = !!cat && list.length > 0;
  const quotes = list.flatMap(p => (p.reviews || []).map(r => ({ ...r, p }))).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 4);
  const low = rich ? Math.min(...list.map(p => p.price)) : 0, maxOff = rich ? Math.max(0, ...list.map(off)) : 0;
  return <>
    {rich && list.length > 1 && <CompareAll list={picks.length > 1 ? picks : list} cat={cat} short={short} picked={picks.length > 1} />}
    {feats && <section className="topf" id="features"><p className="kicker">Top features</p><h2>{"What makes these " + cat.toLowerCase() + " stand out"}</h2>
      <div className="tfgrid">{feats.map(([icon, title, text]) => <div className="tf" key={title}><i><Icon k={icon} /></i><b>{title}</b><span>{text}</span></div>)}</div></section>}
    {know && <section id="know"><h2>Know before you buy</h2><p className="lead">{short} explained in plain words, so you can choose with confidence.</p>
      <div className="why">{know.map(([icon, title, text]) => <div key={title}><i className="kico"><Icon k={icon} /></i><b>{title}</b><p>{text}</p></div>)}</div></section>}
    {rich && <OsChart P={list} />}
    {rich && maxOff > 0 && <section><a className="cban" href={listUrl({ cat, sort: "off" })}><KvImg className="cph" src={`img/${KV_IMG[cat] || "kv-tv"}.jpg`} sizes="(max-width:1240px) 100vw, 1240px" /><div><span className="kicker">Deals on {short}</span><h2>Up to {maxOff}% off</h2>
      <p>{list.length} model{list.length === 1 ? "" : "s"} from {money(low)}{list.every(p => p.emi) ? " · No Cost EMI on every model" : ""} · free delivery · cash on delivery</p><u>See the deals →</u></div></a></section>}
    {quotes.length > 0 && <section><h2>What customers say</h2><p className="lead">The newest reviews on {short.toLowerCase()}.</p><div className="quotes">{quotes.map((r, i) => <a className="quote" href={productUrl(r.p)} key={i}>
      <div className="stars"><span>{starRow(r.rating)}</span></div><p>“{r.text}”</p><b>{r.name}</b><small>{r.p.brand} {r.p.name}</small></a>)}</div></section>}
    {rich && <FindYour cat={cat} list={list} short={short} />}
    {faq && <Qa title="Good to know" lead={"Short answers about " + short.toLowerCase() + ", warranty and returns included."} list={faq} />}
    {rich && <Help />}
  </>;
}
// every model in the category side by side (up to four): price, rating, each specification, No Cost EMI, add to cart
export function CompareAll({ list, cat, short, picked }) {
  const { money } = useStore();
  const cols = list.slice(0, 4), cheapest = Math.min(...cols.map(x => x.price));
  const keys = [...new Set(cols.flatMap(x => (x.specs || []).map(([k]) => k)))];
  const specOf = (x, k) => ((x.specs || []).find(([n]) => n === k) || [])[1] || "—";
  const line = (label, f, cls) => <tr className={cls || undefined} key={label}><th>{label}</th>{cols.map(x => <td key={x.id}>{f(x)}</td>)}</tr>;
  return <section className="cmp" id="compare"><h2>{picked ? "Compare your picks" : "Compare the models"}</h2>
    <p className="lead">{picked ? "The " + cols.length + " models you ticked" : cols.length === list.length ? "Every " + cat.toLowerCase().replace(/s$/, "") + " we stock" : "Four of our " + short.toLowerCase()}, side by side. Rows marked with a dot are where they differ.</p>
    <div className="scroll"><table className="ctable">
      <thead><tr><th></th>{cols.map(x => <th key={x.id}><a href={productUrl(x)}><span className="cimg"><Photo p={x} sizes="120px" /></span><small>{x.brand}</small><b>{x.name}</b></a></th>)}</tr></thead>
      <tbody>
        {line("Price", x => <><b className="cprice">{money(x.price)}</b>{x.mrp > x.price && <><s>{money(x.mrp)}</s><span className="badge">{off(x)}% OFF</span></>}{x.price === cheapest && <><br /><span className="stock">Lowest price</span></>}</>)}
        {line("Rating", x => x.reviews && x.reviews.length ? <Stars p={x} /> : <span className="muted">No reviews yet</span>)}
        {cols.some(x => x.os) && line("Operating system", x => x.os || "—", new Set(cols.map(x => x.os || "")).size > 1 ? "diff" : "")}
        {keys.map(k => line(k, x => specOf(x, k), new Set(cols.map(x => specOf(x, k))).size > 1 ? "diff" : ""))}
        {line("No Cost EMI", x => x.emi ? <><Icon k="check" /> Available</> : "—")}
        {line("", x => <Buy p={x} />)}
      </tbody></table></div></section>;
}
// Samsung, LG and Croma end a category page with link clusters: by size, by budget, by operating system, by resolution, each with
// how many models it holds and the price they start at. Every link is a filtered view of this page.
function FindYour({ cat, list, short }) {
  const { money } = useStore();
  const { sizeOf, all } = catSizes(list, cat);
  const col = (title, rows) => rows.some(r => r[2].length) && <div key={title}><h3>{title}</h3><ul>{rows.filter(r => r[2].length).map(([label, href, ps]) => <li key={label}><a href={href}>{label}<small>{ps.length} model{ps.length === 1 ? "" : "s"} · from {money(Math.min(...ps.map(p => p.price)))}</small></a></li>)}</ul></div>;
  return <section className="findtv" id="find"><h2>{"Find your " + short}</h2><p className="lead">Straight to the models that fit.</p><div className="fcols">
    {col("By size", all.map(s => [s.label, listUrl({ cat, size: s.label }), list.filter(p => (sizeOf(p) || {}).label === s.label)]))}
    {col("By budget", BANDS.map(([a, b, l]) => [l, listUrl({ cat, min: a || "", max: b || "" }), list.filter(p => (!a || p.price >= a) && (!b || p.price <= b))]))}
    {col("By operating system", osList(list).map(o => [o, listUrl({ cat, os: o }), list.filter(p => p.os === o)]))}
    {col("By resolution", RES.map(r => [r, listUrl({ cat, res: r }), list.filter(p => resOf(p) === r)]))}
  </div></section>;
}
// LG ends every page with ways to reach a person. Appears once the client fills in CONTACT (data.js); the phone number needs its
// country code (for example +91 98765 43210).
function Help() {
  if (!CONTACT.phone && !CONTACT.email) return null;
  return <section className="help"><div><h2>Not sure which one?</h2><p>Talk to us before you order{CONTACT.hours ? ", " + CONTACT.hours : ""}.</p></div><div className="btns">{CONTACT.phone && <a className="btn" href={"tel:" + CONTACT.phone}>Call {CONTACT.phone}</a>}{CONTACT.email && <a className="btn ghost" href={"mailto:" + CONTACT.email}>Email</a>}</div></section>;
}
// /compare?ids=2,11: the ticked models on a page of their own (the compare bar links here, and so does the help bot)
export function ComparePage() {
  const { P, byId } = useStore();
  const ids = (qs.get("ids") || "").split(",").map(Number).filter(Boolean).slice(0, 4), list = ids.map(byId).filter(Boolean);
  useEffect(() => { document.title = "Compare | Mytekkstore"; }, []);
  if (list.length < 2) return <Box title="Pick two to four TVs to compare" text="Tick Compare on the cards of the Televisions page, then open the comparison here." href="/televisions" cta="Browse TVs" />;
  const cat = list[0].cat;
  return <>
    <div className="crumbs"><a href="/">Home</a> › <a href={catUrl(cat)}>{cat}</a> › Compare</div>
    <h1>Compare</h1>
    <CompareAll list={list} cat={cat} short={cat.toLowerCase()} picked />
    <Row title="More to look at" href={catUrl(cat)} list={P.filter(p => p.cat === cat && !ids.includes(p.id)).slice(0, 6)} />
  </>;
}

// a brand list opens like a category page: the brand's room photo, its name, what it stands for (data.js BRAND_BLURB) and the
// reasons read from its own models (brandPoints); the logo file goes here once the brand supplies it
function BrandStrip({ brand, P }) {
  const n = P.filter(p => p.brand === brand).length, pts = brandPoints(P, brand);
  return <div className="kv"><div className="kvimg"><KvImg src={brandImg(brand)} sizes="(max-width:1240px) 100vw, 1240px" eager /></div>
    <div><span className="eyebrow">{brand} · {n} model{n === 1 ? "" : "s"}</span><h1 className="explore">{brand}</h1><p>{BRAND_BLURB[brand] || "Every " + brand + " model we stock, with the brand's own warranty."}{pts.length ? " " + pts.join(" · ") + "." : ""}</p></div></div>;
}
