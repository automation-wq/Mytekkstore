// Home page (client decisions of 2026-10-12): four banners (factory prices, one per brand, one promotion), the numbers that matter
// (discount, EMI, bank offers, genuine), Find your TV (by size and by operating system), Deals of the Day, the two brands with giant
// imagery and their reasons, the operating systems side by side, customer reviews, bank offers, why us, and Good to know with
// warranty and returns. Every figure and reason is read from the catalogue, so nothing here claims what the products do not carry.
import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { useStore } from "./store.jsx";
import { countUp } from "./motion.js";
import { Card, Row, BankOffers, Ico, Qa } from "./components.jsx";
import { DRAW_ICONS, BANK_OFFERS, HOME_BANNERS, FAQ, catSizes, brandUrl, listUrl, off, starRow, productUrl, pic, picSet, osList, osUrl, brandPoints, cutout } from "./data.js";
import { lines, TONES } from "./banner.jsx";

// hero parts rise in one after another on a spring, and the headline staggers word by word (Motion variants)
const RISE = { hide: { y: "115%", opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 280, damping: 28 } } };
const WORDS = { hide: {}, show: { transition: { staggerChildren: .06, delayChildren: .1 } } };
const GROUP = { hide: {}, show: { transition: { staggerChildren: .12 } } };

export function Home() {
  const { P, CATS, BRANDS, recent, byId, money, banners } = useStore();
  const [cur, setCur] = useState(0);
  const heroRef = useRef(), numRef = useRef();
  const maxOff = Math.max(0, ...P.map(off));
  const biggest = b => [...P].filter(p => p.brand === b).sort((a, c) => c.price - a.price)[0]; // the brand's flagship: its most expensive model
  // the banners: a brand banner shows the brand's flagship and its reasons; the promotion shows the biggest discount
  // the banners the admin keeps in the slot "home", in order; the built-in four are the fallback until any are saved
  const home = banners.filter(b => b.slot === "home");
  const raw = home.length ? home.map(b => ({ kind: b.brand ? "brand" : b.preset === "promo" ? "promo" : "photo", preset: b.preset, eyebrow: b.kicker, h: lines(b.title), s: b.text, href: b.href, cta: b.cta, cta2: b.cta2, href2: b.href2, im: b.img, imMobile: b.imgMobile, brand: b.brand, tone: TONES[b.tone] || undefined, prod: b.productId ? byId(b.productId) : null })) : HOME_BANNERS;
  const slides = raw.filter(s => s.kind !== "brand" || biggest(s.brand)).map(s => s.kind === "brand" ? { ...s, pts: brandPoints(P, s.brand), prod: s.prod || biggest(s.brand), href: s.href || brandUrl(s.brand), cta: s.cta || "Shop " + s.brand, eyebrow: s.eyebrow || s.brand }
    : s.kind === "promo" ? { ...s, s: s.s || "Up to " + maxOff + "% off, bank offers, and No Cost EMI on the models that carry it." } : s);
  const show = n => setCur((n + slides.length) % slides.length);
  useEffect(() => { const t = setInterval(() => { if (!heroRef.current || !heroRef.current.matches(":hover")) setCur(c => (c + 1) % slides.length); }, 5000); return () => clearInterval(t); }, [slides.length]);
  useEffect(() => countUp(numRef.current), []); // numbers roll up from 0 the first time they scroll into view
  const deals = [...P].sort((a, b) => off(b) - off(a)).slice(0, 5);
  const quotes = P.flatMap(p => (p.reviews || []).map(r => ({ ...r, p }))).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6); // newest reviews across the catalogue
  const oss = osList(P);
  const onHero = e => {
    if (e.target.dataset.i) show(+e.target.dataset.i);
    else if (e.target.classList.contains("prev")) show(cur - 1);
    else if (e.target.classList.contains("next")) show(cur + 1);
  };
  // the banner photo drifts a little toward the pointer
  const onMove = e => { const h = heroRef.current, r = h.getBoundingClientRect(); h.style.setProperty("--px", ((e.clientX - r.left) / r.width - .5).toFixed(3)); h.style.setProperty("--py", ((e.clientY - r.top) / r.height - .5).toFixed(3)); };
  const nums = [
    [maxOff, "%", "Up to", "off on festive deals"],
    [9, "", "Months No Cost EMI", "no extra interest on bank cards"],
    [BANK_OFFERS.length, "", "Bank offers", BANK_OFFERS.map(b => b[0].split(" ")[0]).join(", ")],
    [100, "%", "Genuine", "brand warranty on everything"],
  ];
  const picOf = src => ({ src: pic(src, 960), srcSet: picSet(src) });
  return <>
    <div className="hero" ref={heroRef} onClick={onHero} onPointerMove={onMove}>
      {slides.map((sl, i) => <m.div className={"slide k-" + sl.kind + (i === cur ? " on" : "")} data-preset={sl.preset || "cinematic"} key={i} initial="hide" animate={i === cur ? "show" : "hide"} variants={GROUP} style={sl.tone ? { background: sl.tone } : undefined}>
        {(sl.brand || sl.kind === "promo") && <span className="ghostmark" aria-hidden="true">{sl.brand || "Offers"}</span>}
        {sl.im && <div className="bg"><picture>{sl.imMobile && <source media="(max-width:760px)" srcSet={pic(sl.imMobile, 960)} />}<img {...picOf(sl.im)} sizes="100vw" alt="" width="1344" height="752" fetchPriority={i ? "low" : "high"} loading={i ? "lazy" : "eager"} decoding="async" /></picture></div>}
        {sl.prod && <m.a className={"bigtv" + (cutout(sl.prod.img) ? " cut" : "")} variants={RISE} href={productUrl(sl.prod)}>{cutout(sl.prod.img) ? <img src={cutout(sl.prod.img)} alt={sl.prod.brand + " " + sl.prod.name} loading={i ? "lazy" : "eager"} /> : <img src={pic(sl.prod.img)} srcSet={picSet(sl.prod.img)} sizes="(max-width:760px) 40vw, 30vw" alt={sl.prod.brand + " " + sl.prod.name} width="800" height="800" loading={i ? "lazy" : "eager"} />}</m.a>}
        <m.span className="eyebrow" variants={RISE}>{sl.eyebrow}</m.span>
        <m.h1 variants={WORDS}>{sl.h.map((l, j) => <span className="ln" key={j}>{l.split(" ").map((w, k) => <m.span className="w" variants={RISE} key={k}>{w}&nbsp;</m.span>)}</span>)}</m.h1>
        {sl.pts ? <m.ul className="pts" variants={RISE}>{sl.pts.map(t => <li key={t}>{t}</li>)}</m.ul> : <m.p variants={RISE}>{sl.s}</m.p>}
        <m.div className="hcta" variants={RISE}><a className="btn" href={sl.href}>{sl.cta}</a><a className="btn ghost" href={sl.href2 || listUrl({ cat: "Televisions", sort: "off" })}>{sl.cta2 || "See deals"}</a></m.div>
      </m.div>)}
      <button className="arrow prev" aria-label="Previous slide">‹</button><button className="arrow next" aria-label="Next slide">›</button>
      <div className="dots">{slides.map((_, i) => <button aria-label={"Slide " + (i + 1)} data-i={i} className={i === cur ? "on" : undefined} key={i}></button>)}</div>
    </div>
    <div className="num" ref={numRef}>{nums.map(([n, suf, t, s]) => <div key={t}><b><i data-n={n}>0</i>{suf}</b><span>{t}</span><small>{s}</small></div>)}</div>

    <section className="find"><h2>Find your TV</h2><p className="lead">Pick the size you want, or the operating system you know, and go straight to the models.</p>
      {CATS.map(c => { const { S, all, sizeOf } = catSizes(P, c); if (!S || !all.length) return null;
        const from = s => Math.min(...P.filter(p => p.cat === c && (sizeOf(p) || {}).n === s.n).map(p => p.price));
        return <div className="frow" key={c}><b>By {S.by.toLowerCase()}</b>{[...all].sort((a, b) => a.n - b.n).map(s => <a className="chip sw" href={listUrl({ cat: c, size: s.label })} key={s.label}><b>{s.label.replace(/ TVs$/, "")}</b><small>from {money(from(s))}</small></a>)}</div>; })}
      {oss.length > 0 && <div className="frow"><b>By operating system</b>{oss.map(o => { const ps = P.filter(p => p.os === o); return <a className="chip sw os" href={osUrl(o)} key={o}><b>{o}</b><small>{ps.length} model{ps.length === 1 ? "" : "s"} · from {money(Math.min(...ps.map(p => p.price)))}</small></a>; })}{oss.length > 1 && <a className="alink" href="/televisions#os">Compare the operating systems →</a>}</div>}
    </section>
    <section><h2>Deals of the Day <a href="/products?sort=off">View all</a></h2><p className="lead">The biggest discounts right now.</p><div className="grid">{deals.map((p, i) => <Card p={p} i={i} key={p.id} />)}</div></section>

    <section className="bigbrands"><h2>Two brands, one promise</h2><p className="lead">Genuine {BRANDS.join(" and ")} TVs with the brand's own warranty, at factory prices.</p>
      {BRANDS.map((b, i) => { const prod = biggest(b), pts = brandPoints(P, b), n = P.filter(p => p.brand === b).length, tone = (HOME_BANNERS.find(s => s.brand === b) || {}).tone;
        return prod ? <a className={"bbrand" + (i % 2 ? " flip" : "")} href={brandUrl(b)} key={b} style={tone ? { background: tone } : undefined}>
          <div className="btext"><span className="kicker">{n} model{n === 1 ? "" : "s"}</span><b>{b}</b><ul>{pts.map(t => <li key={t}>{t}</li>)}</ul><u>Shop {b} →</u></div>
          {cutout(prod.img) ? <img className="cut" src={cutout(prod.img)} alt={prod.brand + " " + prod.name} loading="lazy" /> : <img src={pic(prod.img)} srcSet={picSet(prod.img)} sizes="(max-width:860px) 100vw, 46vw" alt={prod.brand + " " + prod.name} width="800" height="800" loading="lazy" />}</a> : null; })}</section>
    {quotes.length > 0 && <section><h2>What customers say</h2><p className="lead">The newest reviews from across the catalogue.</p><div className="quotes">{quotes.map((r, i) => <a className="quote" href={productUrl(r.p)} key={i}>
      <div className="stars"><span>{starRow(r.rating)}</span></div><p>“{r.text}”</p><b>{r.name}</b><small>{r.p.brand} {r.p.name}</small></a>)}</div></section>}
    <BankOffers />
    <section><h2>Why Mytekkstore?</h2><p className="lead">What comes with every order.</p><div className="why">
      <div><Ico shapes={DRAW_ICONS.truck} /><b>Fast delivery</b><p>Doorstep delivery across the country.</p></div>
      <div><Ico shapes={DRAW_ICONS.shield} /><b>Genuine products</b><p>Brand warranty on everything we sell.</p></div>
      <div><Ico shapes={DRAW_ICONS.cash} /><b>Cash on delivery</b><p>Pay when your order arrives.</p></div>
      <div><Ico shapes={DRAW_ICONS.box} /><b>Order tracking</b><p>Follow every order from your account.</p></div>
    </div></section>
    <Qa title="Good to know" lead="Short answers before you order, warranty and returns included." list={FAQ} />
    <Row title="Recently viewed" href="" list={recent.map(byId).filter(Boolean)} />
  </>;
}
