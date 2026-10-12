// Home page: kinetic hero (Motion springs, word by word) with a spotlight product, numbers that count up, category tiles, a "built for your home" bento,
// deals, one block per category (banner plus four products, the Samsung home-page pattern), brands, customer quotes, bank
// offers, festive banner, why-us and a Good to know list. Marketing lines come from TOP_FEATURES so they only claim what the catalogue supports.
import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { useStore } from "./store.jsx";
import { countUp } from "./motion.js";
import { Card, Row, BankOffers, Ico, KvImg } from "./components.jsx";
import { DRAW_ICONS, CAT_SIZE, BANK_OFFERS, KV_IMG, CAT_CLIPS, TOP_FEATURES, GUIDES, FAQ, catSizes, catUrl, brandUrl, listUrl, off, starRow, productUrl, pic, picSet } from "./data.js";

// hero parts rise in one after another on a spring, and the headline staggers word by word (Motion variants)
const RISE = { hide: { y: "115%", opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 280, damping: 28 } } };
const WORDS = { hide: {}, show: { transition: { staggerChildren: .06, delayChildren: .1 } } };
const GROUP = { hide: {}, show: { transition: { staggerChildren: .12 } } };

// [headline lines, line, category, banner image]. Banners are generated for this store (see docs/APP_DESIGN.md section 7)
const SLIDES = [
  { h: ["Smart TVs.", "Smarter prices."], s: "Elista and Telefunken TVs, now in store.", c: "Televisions", im: "hero0" },
  { h: ["Laundry day,", "sorted."], s: "Front load, top load and semi automatic.", c: "Washing Machines", im: "hero1" },
  { h: ["Beat the heat."], s: "Inverter ACs with big savings.", c: "Air Conditioners", im: "hero2" },
];

export function Home() {
  const { P, CATS, BRANDS, catImg, recent, byId, money } = useStore();
  const [cur, setCur] = useState(0);
  const heroRef = useRef(), numRef = useRef();
  const show = n => setCur((n + SLIDES.length) % SLIDES.length);
  useEffect(() => { const t = setInterval(() => { if (!heroRef.current || !heroRef.current.matches(":hover")) setCur(c => (c + 1) % SLIDES.length); }, 5000); return () => clearInterval(t); }, []);
  useEffect(() => countUp(numRef.current), []); // numbers roll up from 0 the first time they scroll into view

  const inCat = c => P.filter(p => p.cat === c);
  const lowest = c => { const ps = inCat(c); return ps.length ? Math.min(...ps.map(p => p.price)) : 0; };
  const bestDeal = c => [...inCat(c)].sort((a, b) => off(b) - off(a))[0];
  const maxOff = c => Math.max(0, ...(c ? inCat(c) : P).map(off));
  const deals = [...P].sort((a, b) => off(b) - off(a)).slice(0, 5);
  const emiPs = P.filter(p => p.emi), emiFrom = emiPs.length ? Math.round(Math.min(...emiPs.map(p => p.price)) / 9) : 0;
  const feats = c => (TOP_FEATURES[c] || []).slice(0, 2);
  const sizeOf = c => Object.hasOwn(CAT_SIZE, c) ? CAT_SIZE[c] : null;
  const quotes = P.flatMap(p => (p.reviews || []).map(r => ({ ...r, p }))).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6); // newest reviews across the catalogue
  const focus = [...P].filter(p => p.specs && p.specs.length >= 4).sort((a, b) => off(b) - off(a))[0]; // the "in focus" story: the biggest deal with a full specification list

  const onHero = e => {
    if (e.target.dataset.i) show(+e.target.dataset.i);
    else if (e.target.classList.contains("prev")) show(cur - 1);
    else if (e.target.classList.contains("next")) show(cur + 1);
  };
  // the banner photo drifts a little toward the pointer
  const onMove = e => { const h = heroRef.current, r = h.getBoundingClientRect(); h.style.setProperty("--px", ((e.clientX - r.left) / r.width - .5).toFixed(3)); h.style.setProperty("--py", ((e.clientY - r.top) / r.height - .5).toFixed(3)); };

  const nums = [
    [maxOff(), "%", "Up to", "off on festive deals"],
    [9, "", "Months No Cost EMI", "no extra interest on bank cards"],
    [BANK_OFFERS.length, "", "Bank offers", BANK_OFFERS.map(b => b[0].split(" ")[0]).join(", ")],
    [100, "%", "Genuine", "brand warranty on everything"],
  ];
  return <>
    <div className="hero" ref={heroRef} onClick={onHero} onPointerMove={onMove}>
      {SLIDES.map((sl, i) => { const spot = bestDeal(sl.c); return <m.div className={"slide" + (i === cur ? " on" : "")} key={sl.c} initial="hide" animate={i === cur ? "show" : "hide"} variants={GROUP}>
        <div className="bg"><img src={pic(`img/${sl.im}.jpg`, 960)} srcSet={picSet(`img/${sl.im}.jpg`)} sizes="100vw" alt="" width="1344" height="752" fetchPriority={i ? "low" : "high"} loading={i ? "lazy" : "eager"} decoding="async" /></div><m.span className="eyebrow" variants={RISE}>{sl.c}</m.span>
        <m.h1 variants={WORDS}>{sl.h.map((l, j) => <span className="ln" key={j}>{l.split(" ").map((w, k) => <m.span className="w" variants={RISE} key={k}>{w}&nbsp;</m.span>)}</span>)}</m.h1>
        <m.p variants={RISE}>{sl.s}</m.p>
        <m.div className="hcta" variants={RISE}><a className="btn" href={catUrl(sl.c)}>Shop now</a><a className="btn ghost" href={listUrl({ cat: sl.c, sort: "off" })}>See deals</a></m.div>
        {spot && <m.a className="spot" variants={RISE} href={productUrl(spot)}><img src={pic(spot.img, 480)} alt="" width="800" height="800" loading={i ? "lazy" : "eager"} /><span><small>{spot.brand}</small><b>{spot.name}</b><i>{money(spot.price)}{off(spot) > 0 && <em>{off(spot)}% off</em>}</i></span></m.a>}
      </m.div>; })}
      <button className="arrow prev" aria-label="Previous slide">‹</button><button className="arrow next" aria-label="Next slide">›</button>
      <div className="dots">{SLIDES.map((_, i) => <button aria-label={"Slide " + (i + 1)} data-i={i} className={i === cur ? "on" : undefined} key={i}></button>)}</div>
    </div>
    <div className="num" ref={numRef}>{nums.map(([n, suf, t, s]) => <div key={t}><b><i data-n={n}>0</i>{suf}</b><span>{t}</span><small>{s}</small></div>)}</div>
    <section className="marqs" aria-hidden="true"><div className="marq"><div>{[0, 1].map(r => <span key={r}>{[...CATS, ...BRANDS].map(w => <i key={w}>{w}</i>)}</span>)}</div></div></section>

    <section><h2>Shop by Category</h2><p className="lead">Every category we carry. Pick one and see each model, size by size.</p><div className="kcats">{CATS.map(c => { const ps = inCat(c), low = lowest(c);
      return <a className="kcat" href={catUrl(c)} key={c}><KvImg className="kimg" src={`img/${KV_IMG[c] || "kv-tv"}.jpg`} sizes="(max-width:760px) 100vw, 33vw" /><div className="kshade"></div>
        <div className="ktext"><b>{c}</b><small>{ps.length} model{ps.length === 1 ? "" : "s"} · from {money(low)}</small><u>Shop now →</u></div></a>; })}</div></section>


    <section><h2>Built for your home</h2><p className="lead">The features that matter most in each category, in plain words.</p><div className="bento">
      {CATS.map((c, i) => { const f = feats(c), S = sizeOf(c); return <a className={"bt ph" + (i === 0 ? " big" : "")} href={catUrl(c)} key={c}>
        <KvImg src={`img/${KV_IMG[c] || "kv-tv"}.jpg`} sizes="(max-width:760px) 100vw, 50vw" /><span className="kicker">{c}</span>
        {i === 0 ? <><h3>{f.map(x => x[1]).join(" · ")}</h3>{f[0] && <p>{f[0][2]}. {f[1] ? f[1][2] + "." : ""}</p>}</> : <><h3>{f[0] ? f[0][1] : c}</h3>{f[1] && <p>{f[1][1]}</p>}</>}
        <u>Shop {S ? S.short : c} →</u></a>; })}
      {emiFrom > 0 && <a className="bt glass" href="/offers" style={{ gridColumn: "span 2" }}><span className="kicker">No Cost EMI</span><h3>From {money(emiFrom)}/month</h3><p>3, 6 or 9 instalments on participating bank credit cards, no extra interest.</p><u>See bank offers →</u></a>}
    </div></section>

    {focus && <section className="story"><div className="focusimg"><span className="kicker">{focus.brand}</span><img src={pic(focus.img)} srcSet={picSet(focus.img)} sizes="(max-width:860px) 100vw, 50vw" alt="" loading="lazy" width="800" height="800" /></div>
      <div className="steps"><h2>In focus</h2><p className="lead">{focus.brand} {focus.name}: its specifications, one at a time.</p>
        {(focus.specs || []).slice(0, 4).map(([k, v]) => <m.div className="step" key={k} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -20% 0px" }} transition={{ type: "spring", stiffness: 160, damping: 26 }}><small>{k}</small><h3>{v}</h3></m.div>)}
        <a className="btn" href={productUrl(focus)}>View this {focus.cat === "Televisions" ? "TV" : "model"} · {money(focus.price)}</a></div></section>}
    <section><h2>Deals of the Day <a href="/products?sort=off">View all</a></h2><p className="lead">The biggest discounts across the store right now.</p><div className="grid">{deals.map((p, i) => <Card p={p} i={i} key={p.id} />)}</div></section>

    {CATS.map(c => { const S = sizeOf(c), list = inCat(c); return list.length ? <section className="cblock" key={c}>
      <a className="cban" href={catUrl(c)}><KvImg className="cph" src={`img/${KV_IMG[c] || "kv-tv"}.jpg`} sizes="(max-width:1240px) 100vw, 1240px" />{CAT_CLIPS[c] && <video className="bvid" muted loop playsInline preload="none" data-src={`/img/${CAT_CLIPS[c]}.mp4`} aria-hidden="true"></video>}<div><span className="kicker">{c}</span><h2>{S ? S.note : c}</h2>
        <p>From {money(lowest(c))} · up to {maxOff(c)}% off · {list.length} model{list.length === 1 ? "" : "s"}</p><u>Explore {S ? S.short : c} →</u></div></a>
      <div className="grid cgrid">{list.slice(0, 4).map((p, i) => <Card p={p} i={i} key={p.id} />)}{list.length < 4 && <a className="morecard" href={catUrl(c)} style={{ backgroundImage: `url(/img/${KV_IMG[c] || "kv-tv"}-960.webp)` }}><span className="kicker">{c}</span><b>See all {S ? S.short : c}</b><small>All {list.length} models with filters and size tabs</small><u>View all →</u></a>}</div>
    </section> : null; })}

    <section><h2>Shop by Brand</h2><p className="lead">{BRANDS.join(" and ")}, side by side.</p><div className="brands">{BRANDS.map(b => { const ps = P.filter(p => p.brand === b); return <a className="brand" href={brandUrl(b)} key={b}><b>{b}</b><span>{ps.length} products</span><u>Explore →</u><span className="pstack">{ps.slice(0, 3).map(p => <img src={pic(p.img, 480)} alt="" loading="lazy" width="800" height="800" key={p.id} />)}</span></a>; })}</div></section>
    {quotes.length > 0 && <section><h2>What customers say</h2><p className="lead">The newest reviews from across the catalogue.</p><div className="quotes">{quotes.map((r, i) => <a className="quote" href={productUrl(r.p)} key={i}>
      <div className="stars"><span>{starRow(r.rating)}</span></div><p>“{r.text}”</p><b>{r.name}</b><small>{r.p.brand} {r.p.name}</small></a>)}</div></section>}
    <Row title="Recently viewed" href="" list={recent.map(byId).filter(Boolean)} />
    <BankOffers />
    <section><a className="wide" href="/offers" style={{ backgroundImage: "linear-gradient(120deg,#1a0b2e,#0b3d2e 40%,#15181e 70%,#1a0b2e)", backgroundSize: "260% 100%" }}><b>Festive offers are live</b><span>Up to {maxOff()}% off, bank offers and No Cost EMI</span><u>See all offers →</u><span className="pstack">{deals.slice(0, 3).map(p => <img src={pic(p.img, 480)} alt="" loading="lazy" width="800" height="800" key={p.id} />)}</span></a></section>
    <section><h2>Why Mytekkstore?</h2><p className="lead">What comes with every order.</p><div className="why">
      <div><Ico shapes={DRAW_ICONS.truck} /><b>Fast delivery</b><p>Doorstep delivery across the country.</p></div>
      <div><Ico shapes={DRAW_ICONS.shield} /><b>Genuine products</b><p>Brand warranty on everything we sell.</p></div>
      <div><Ico shapes={DRAW_ICONS.cash} /><b>Cash on delivery</b><p>Pay when your order arrives.</p></div>
      <div><Ico shapes={DRAW_ICONS.box} /><b>Order tracking</b><p>Follow every order from your account.</p></div>
    </div></section>
    <section className="faq"><h2>Good to know</h2><p className="lead">Short answers before you order.</p><div className="faqs">{FAQ.map(([q, a, link]) => <details key={q}><summary>{q}</summary><p>{a}{link && <> <a className="alink" href={link[0]}>{link[1]} →</a></>}</p></details>)}</div></section>
  </>;
}
