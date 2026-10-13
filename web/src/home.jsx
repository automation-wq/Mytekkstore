// Home page (client decisions of 2026-10-12): four banners (factory prices, one per brand, one promotion), the numbers that matter
// (discount, EMI, bank offers, genuine), Find your TV (by size and by operating system), Deals of the Day, the two brands with giant
// imagery and their reasons, the operating systems side by side, customer reviews, bank offers, why us, and Good to know with
// warranty and returns. Every figure and reason is read from the catalogue, so nothing here claims what the products do not carry.
import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { useStore } from "./store.jsx";
import { Card, Row, BankOffers, Ico, Qa } from "./components.jsx";
import { DRAW_ICONS, BANK_OFFERS, HOME_BANNERS, FAQ, catSizes, brandUrl, listUrl, off, starRow, productUrl, pic, picSet, osList, osUrl, brandPoints, cutout, life } from "./data.js";
import { lines, TONES } from "./banner.jsx";

// hero parts rise in one after another on a spring, and the headline staggers word by word (Motion variants)
const RISE = { hide: { y: "115%", opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 280, damping: 28 } } };
const WORDS = { hide: {}, show: { transition: { staggerChildren: .06, delayChildren: .1 } } };
const GROUP = { hide: {}, show: { transition: { staggerChildren: .12 } } };

export function Home() {
  const { P, CATS, BRANDS, recent, byId, money, banners } = useStore();
  const [cur, setCur] = useState(0);
  const heroRef = useRef();
  const maxOff = Math.max(0, ...P.map(off));
  const biggest = b => [...P].filter(p => p.brand === b).sort((a, c) => c.price - a.price)[0]; // the brand's flagship: its most expensive model
  // the banners: a brand banner shows the brand's flagship and its reasons; the promotion shows the biggest discount
  // the banners the admin keeps in the slot "home", in order; the built-in four are the fallback until any are saved
  const home = banners.filter(b => b.slot === "home");
  const raw = home.length ? home.map(b => ({ kind: b.brand ? "brand" : b.preset === "promo" ? "promo" : "photo", preset: b.preset, eyebrow: b.kicker, h: lines(b.title), s: b.text, href: b.href, cta: b.cta, cta2: b.cta2, href2: b.href2, im: b.img, imMobile: b.imgMobile, brand: b.brand, tone: TONES[b.tone] || undefined, prod: b.productId ? byId(b.productId) : null })) : HOME_BANNERS;
  const slides = raw.filter(s => s.kind !== "brand" || biggest(s.brand)).map(s => s.kind === "brand" ? { ...s, pts: brandPoints(P, s.brand), prod: s.prod || biggest(s.brand), href: s.href || brandUrl(s.brand), cta: s.cta || "Shop " + s.brand, eyebrow: s.eyebrow || s.brand }
    : s.kind === "promo" ? { ...s, s: s.s || "Up to " + maxOff + "% off, bank offers, and No Cost EMI on the models that carry it." } : s);
  const show = n => setCur((n + slides.length) % slides.length);
  useEffect(() => { const t = setInterval(() => { if (!heroRef.current || !heroRef.current.matches(":hover")) setCur(c => (c + 1) % slides.length); }, 6000); return () => clearInterval(t); }, [slides.length]);
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
  const picOf = src => ({ src: pic(src, 960), srcSet: picSet(src) });
  // premium discovery sections (MASTER PROMPT redesign): image-led cards for size, operating system and resolution, an editorial
  // Latest Launches grid, and a product-care banner. Prototype imagery reuses the store's renders and lifestyle shots; copy is
  // aspirational marketing only, no invented specs, prices or model names.
  const spec = (p, k) => ((p.specs || []).find(([n]) => n.toLowerCase().includes(k)) || [])[1] || "";
  const resOf = p => { const r = spec(p, "resolution"); return /4K/i.test(r) ? "4K Ultra HD" : /Full HD/i.test(r) ? "Full HD" : /HD/i.test(r) ? "HD Ready" : ""; };
  const inchOf = p => +((/\((\d+)\s*inch\)/.exec(p.name) || [])[1] || 0);
  const minP = ps => ps.length ? Math.min(...ps.map(p => p.price)) : 0;
  const SHOTS = ["img/p1.jpg", "img/p3.jpg", "img/p0.jpg", "img/p2.jpg"], LIFE = [life("os1", "img/life-room.jpg"), life("os2", "img/hero0.jpg")];
  const tvs = P.filter(p => p.cat === "Televisions");
  const sizeCards = [[32, "Compact spaces"], [43, "Everyday viewing"], [55, "Living-room favourite"], [65, "Cinematic experience"], [75, "Go bigger"]].map(([inch, desc], i) => ({ inch, desc, img: life("size" + inch, SHOTS[i % SHOTS.length]), from: minP(tvs.filter(p => inchOf(p) === inch)) }));
  const osBenefit = { "Google TV": "Every app on one home screen, with Google Assistant and Chromecast.", "WebOS": "A quick card-style home screen with apps built in — no set-top box.", "Android TV": "Google Play apps and Chromecast, built in." };
  const osCards = oss.map((o, i) => ({ os: o, text: osBenefit[o] || "Smart apps built in.", img: LIFE[i % LIFE.length], from: minP(tvs.filter(p => p.os === o)) }));
  const resCards = [["4K Ultra HD", "Four times the detail of Full HD."], ["Full HD", "Crisp, clear everyday viewing."], ["HD Ready", "Great value for smaller rooms."]].map(([res, text], i) => { const ps = tvs.filter(p => resOf(p) === res).sort((a, b) => a.price - b.price); return { res, text, img: life(["res4k", "resfhd", "reshd"][i], ps[0] && (cutout(ps[0].img) || ps[0].img)), from: minP(ps) }; }).filter(c => c.from);
  const LAUNCHES = [
    { kicker: "Elista", title: "Elista 4K Smart TV Collection", text: "Brilliant 4K entertainment, beautifully yours.", href: brandUrl("Elista"), img: life("launch1", "img/hero0.jpg"), dark: true },
    { kicker: "Telefunken", title: "Cinematic Viewing, Reimagined", text: "Big-screen Google TV with Dolby Audio.", href: brandUrl("Telefunken"), img: life("launch2", "img/life-cinema.jpg"), dark: true },
    { kicker: "Smart entertainment", title: "Smart Entertainment", text: "Every app built in, no set-top box.", href: "/televisions#os", img: life("launch3", "img/p2.jpg") },
    { kicker: "Big screen", title: "The Big-Screen Experience", text: "Made for movie nights.", href: listUrl({ cat: "Televisions", size: "65 inch TVs" }), img: life("launch4", "img/p3.jpg") },
    { kicker: "New", title: "Next-Generation Smart TVs", text: "Discover the latest from Elista and Telefunken.", href: "/televisions", img: life("launch5", "img/p0.jpg") },
  ].map(l => ({ ...l, dark: l.dark || !cutout(l.img) })); // a room photo gets the darker shade; a render sits on its own dark stage
  return <>
    <div className="hero" ref={heroRef} onClick={onHero} onPointerMove={onMove}>
      {slides.map((sl, i) => <m.div className={"slide k-" + sl.kind + (i === cur ? " on" : "")} data-preset={sl.preset || "cinematic"} key={i} initial="hide" animate={i === cur ? "show" : "hide"} variants={GROUP} style={sl.tone ? { background: sl.tone } : undefined}>
        {(sl.brand || sl.kind === "promo") && <span className="ghostmark" aria-hidden="true">{sl.brand || "Offers"}</span>}
        {sl.im && <div className="bg"><picture>{sl.imMobile && <source media="(max-width:760px)" srcSet={pic(sl.imMobile, 960)} />}<img {...picOf(sl.im)} sizes="100vw" alt="" width="1344" height="752" fetchPriority={i ? "low" : "high"} loading={i ? "lazy" : "eager"} decoding="async" /></picture></div>}
        {sl.prod && <m.a className={"bigtv" + (cutout(sl.prod.img) ? " cut" : "")} variants={RISE} href={productUrl(sl.prod)}>{cutout(sl.prod.img)
          ? <><span className="tvglow" aria-hidden="true"></span><img className="tvmain" src={cutout(sl.prod.img)} alt={sl.prod.brand + " " + sl.prod.name} loading={i ? "lazy" : "eager"} /><img className="tvrefl" src={cutout(sl.prod.img)} alt="" aria-hidden="true" loading="lazy" /></>
          : <img src={pic(sl.prod.img)} srcSet={picSet(sl.prod.img)} sizes="(max-width:760px) 40vw, 30vw" alt={sl.prod.brand + " " + sl.prod.name} width="800" height="800" loading={i ? "lazy" : "eager"} />}</m.a>}
        <m.span className="eyebrow" variants={RISE}>{sl.eyebrow}</m.span>
        <m.h1 variants={WORDS}>{sl.h.map((l, j) => <span className="ln" key={j}>{l.split(" ").map((w, k) => <m.span className="w" variants={RISE} key={k}>{w}&nbsp;</m.span>)}</span>)}</m.h1>
        {sl.pts ? <m.ul className="pts" variants={RISE}>{sl.pts.map(t => <li key={t}>{t}</li>)}</m.ul> : <m.p variants={RISE}>{sl.s}</m.p>}
        <m.div className="hcta" variants={RISE}><a className="btn" href={sl.href}>{sl.cta}</a><a className="btn ghost" href={sl.href2 || listUrl({ cat: "Televisions", sort: "off" })}>{sl.cta2 || "See deals"}</a></m.div>
      </m.div>)}
      <button className="arrow prev" aria-label="Previous slide">‹</button><button className="arrow next" aria-label="Next slide">›</button>
      <div className="dots">{slides.map((_, i) => <button aria-label={"Slide " + (i + 1)} data-i={i} className={i === cur ? "on" : undefined} key={i}></button>)}</div>
    </div>

    <BankOffers />

    <section className="launches"><h2>Latest Launches</h2><p className="lead">Discover what's new in home entertainment.</p>
      <div className="launchgrid">{LAUNCHES.map((l, i) => <a className={"launch" + (i < 2 ? " big" : "") + (l.dark ? " dark" : "") + (cutout(l.img) ? " stage" : "")} href={l.href} key={l.title}>{cutout(l.img) ? <img src={cutout(l.img)} alt="" loading="lazy" /> : <img src={pic(l.img, 960)} srcSet={picSet(l.img)} sizes="(max-width:760px) 92vw, 46vw" alt="" loading="lazy" />}<span className="lshade"></span><span className="ltext"><span className="kicker">{l.kicker}</span><h3>{l.title}</h3><p>{l.text}</p><u>Explore now →</u></span></a>)}</div></section>

    <section className="disco"><h2>Every room. The right screen.</h2><p className="lead">Find the perfect screen size for every space.</p>
      <div className="dgrid five">{sizeCards.map(s => <a className={"dcard" + (cutout(s.img) ? "" : " photo")} href={listUrl({ cat: "Televisions", size: s.inch + " inch TVs" })} key={s.inch}><span className="dimg"><img src={pic(s.img, 480)} srcSet={picSet(s.img)} sizes="240px" alt="" loading="lazy" width="800" height="800" /></span><span className="dbody"><b>{s.inch}"</b><small>{s.desc}</small><em>{s.from ? "from " + money(s.from) : "Coming soon"}</em></span><i className="darr" aria-hidden="true">→</i></a>)}</div></section>

    {osCards.length > 0 && <section className="disco"><h2>Entertainment, your way.</h2><p className="lead">Choose the smart TV experience that fits your lifestyle.</p>
      <div className="dgrid land">{osCards.map(c => <a className="dcard os" href={osUrl(c.os)} key={c.os}><span className="dimg"><img src={pic(c.img, 960)} srcSet={picSet(c.img)} sizes="(max-width:760px) 92vw, 46vw" alt="" loading="lazy" /></span><span className="dbody"><b>{c.os}</b><small>{c.text}</small><em>{c.from ? "from " + money(c.from) : ""}</em></span><i className="darr" aria-hidden="true">→</i></a>)}</div></section>}

    {resCards.length > 0 && <section className="disco"><h2>See every detail differently.</h2><p className="lead">Explore the resolutions built for exceptional viewing.</p>
      <div className="dgrid three">{resCards.map(c => <a className={"dcard tall dark" + (/-cut\.webp$/.test(c.img) ? "" : " photo")} href={listUrl({ cat: "Televisions", res: c.res })} key={c.res}><span className="dimg"><img src={pic(c.img, 960)} srcSet={picSet(c.img)} sizes="(max-width:760px) 70vw, 30vw" alt="" loading="lazy" /></span><span className="lshade"></span><span className="dbody"><b>{c.res}</b><small>{c.text}</small><em>from {money(c.from)}</em></span></a>)}</div></section>}

    <section className="bigbrands"><h2>Featured brands</h2><p className="lead">Flagship collections from {BRANDS.join(" and ")}, with the brand's own warranty.</p>
      {BRANDS.map((b, i) => { const prod = biggest(b), pts = brandPoints(P, b), n = P.filter(p => p.brand === b).length, tone = (HOME_BANNERS.find(s => s.brand === b) || {}).tone;
        return prod ? <a className={"bbrand" + (i % 2 ? " flip" : "")} href={brandUrl(b)} key={b} style={tone ? { background: tone } : undefined}>
          <div className="btext"><span className="kicker">{n} model{n === 1 ? "" : "s"}</span><b>{b}</b><ul>{pts.map(t => <li key={t}>{t}</li>)}</ul><u>Shop {b} →</u></div>
          {cutout(prod.img) ? <img className="cut" src={cutout(prod.img)} alt={prod.brand + " " + prod.name} loading="lazy" /> : <img src={pic(prod.img)} srcSet={picSet(prod.img)} sizes="(max-width:860px) 100vw, 46vw" alt={prod.brand + " " + prod.name} width="800" height="800" loading="lazy" />}</a> : null; })}</section>
    <section><h2>Deals of the Day <a href="/products?sort=off">View all</a></h2><p className="lead">The biggest discounts right now.</p><div className="grid">{deals.map((p, i) => <Card p={p} i={i} key={p.id} />)}</div></section>
    <section><h2>Why Mytekkstore?</h2><p className="lead">More confidence in every purchase.</p><div className="why">
      <div><Ico shapes={DRAW_ICONS.truck} /><b>Fast delivery</b><p>Doorstep delivery across the country.</p></div>
      <div><Ico shapes={DRAW_ICONS.shield} /><b>Genuine products</b><p>Brand warranty on everything we sell.</p></div>
      <div><Ico shapes={DRAW_ICONS.cash} /><b>Cash on delivery</b><p>Pay when your order arrives.</p></div>
      <div><Ico shapes={DRAW_ICONS.box} /><b>Order tracking</b><p>Follow every order from your account.</p></div>
    </div></section>
    <section className="care"><span className="ctext"><span className="kicker">Product care</span><h2>{"Your entertainment. Our priority."}</h2><p>Brand warranty, free delivery and support on every Mytekkstore order. Warranty, returns and replacement, explained in plain words.</p><a className="btn" href="/returns">Explore product care</a></span></section>
    {quotes.length > 0 && <section><h2>What customers say</h2><p className="lead">The newest reviews from across the catalogue.</p><div className="quotes">{quotes.map((r, i) => <a className="quote" href={productUrl(r.p)} key={i}>
      <div className="stars"><span>{starRow(r.rating)}</span></div><p>“{r.text}”</p><b>{r.name}</b><small>{r.p.brand} {r.p.name}</small></a>)}</div></section>}
    <Qa title="Frequently asked questions" lead="Short answers before you order, warranty and returns included." list={FAQ} />
    <Row title="Recently viewed" href="" list={recent.map(byId).filter(Boolean)} />
  </>;
}
