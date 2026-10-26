// Home page (client decisions of 2026-10-12): four banners (factory prices, one per brand, one promotion), the numbers that matter
// (discount, EMI, bank offers, genuine), Find your TV (by size and by operating system), Deals of the Day, the two brands with giant
// imagery and their reasons, the operating systems side by side, customer reviews, bank offers, why us, and Good to know with
// warranty and returns. Every figure and reason is read from the catalogue, so nothing here claims what the products do not carry.
import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { useStore } from "./store.jsx";
import { Card, Row, BankOffers, Ico, Icon, Qa, OsChart, BankStrip, BankBoxes } from "./components.jsx";
import { DRAW_ICONS, HOME_BANNERS, FESTIVE, FAQ, catSizes, brandUrl, listUrl, off, starRow, productUrl, pic, picSet, osList, osUrl, brandPoints, cutout, life, emiPlans } from "./data.js";
import { lines, TONES } from "./banner.jsx";
import { resOf } from "./category.jsx"; // resolution of a TV from its specifications, for the screen-type cards
import { qs, load, save } from "./api.js";

// hero parts rise in one after another on a spring, and the headline staggers word by word (Motion variants)
const RISE = { hide: { y: "115%", opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 280, damping: 28 } } };
const WORDS = { hide: {}, show: { transition: { staggerChildren: .06, delayChildren: .1 } } };
const GROUP = { hide: {}, show: { transition: { staggerChildren: .12 } } };

export function Home() {
  const { P, CATS, BRANDS, recent, byId, money, banners, me } = useStore();
  const [cur, setCur] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0])); // a slide's photos mount the first time it shows, so the first paint carries only the first slide
  useEffect(() => { setSeen(s => s.has(cur) ? s : new Set(s).add(cur)); }, [cur]);
  const heroRef = useRef();
  const maxOff = Math.max(0, ...P.map(off));
  const biggest = b => [...P].filter(p => p.brand === b).sort((a, c) => c.price - a.price)[0]; // the brand's flagship: its most expensive model
  // the banners: a brand banner shows the brand's flagship and its reasons; the promotion shows the biggest discount
  // the banners the admin keeps in the slot "home", in order; the built-in four are the fallback until any are saved
  const tvs = P.filter(p => p.cat === "Televisions");
  const minTv = tvs.length ? Math.min(...tvs.map(p => p.price)) : 0, minEmi = tvs.some(p => p.emi) ? Math.min(...tvs.filter(p => p.emi).map(p => emiPlans(p.price)[2][1])) : 0; // the deal box: every figure from the catalogue
  const home = banners.filter(b => b.slot === "home");
  const raw = home.length ? home.map(b => ({ kind: b.brand ? "brand" : b.preset === "promo" ? "promo" : "photo", preset: b.preset, eyebrow: b.kicker, h: lines(b.title), s: b.text, href: b.href, cta: b.cta, cta2: b.cta2, href2: b.href2, im: b.img, imMobile: b.imgMobile, brand: b.brand, tone: TONES[b.tone] || undefined, prod: b.productId ? byId(b.productId) : null })) : HOME_BANNERS;
  const slides = raw.filter(s => s.kind !== "promo" && (s.kind !== "brand" || biggest(s.brand))).map(s => s.kind === "brand" ? { ...s, pts: brandPoints(P, s.brand), prod: s.prod || biggest(s.brand), href: s.href || brandUrl(s.brand), cta: s.cta || "Shop " + s.brand, eyebrow: s.eyebrow || s.brand }
    : s.kind === "promo" ? { ...s, s: s.s || "Up to " + maxOff + "% off, bank offers, and No Cost EMI on the models that carry it." }
    : s.kind === "photo" ? { ...s, kind: "deal", im: "", imMobile: "", vid: "", eyebrow: "Straight from the factory · Live now", h: ["Up to " + maxOff + "% off on Smart TVs."], hi: [maxOff + "%", "off"],
      s: "Starting at " + money(minTv) + "." + (minEmi ? " No Cost EMI from " + money(minEmi) + "/month," : "") + " extra bank discounts and cash on delivery.", cta: "Shop all deals", href: listUrl({ cat: "Televisions", sort: "off" }), cta2: "Compare TVs", href2: "/compare", art: "/img/tv-ocean.webp", tone: "" } : s); // the lead slide is the design file's deal hero (owner note, 25 October): the biggest real discount, the lowest price and EMI, one television on a glow; no photograph, no clip
  const show = n => setCur((n + slides.length) % slides.length);
  const [auto, setAuto] = useState(true); // autoplay stops for good once the visitor takes control (arrow/dot)
  useEffect(() => { if (!auto) return; const t = setInterval(() => { if (!heroRef.current || !heroRef.current.matches(":hover")) setCur(c => (c + 1) % slides.length); }, 6000); return () => clearInterval(t); }, [slides.length, auto]);
  useEffect(() => { const t = setTimeout(() => setSeen(new Set(slides.map((_, i) => i))), 2500); return () => clearTimeout(t); }, [slides.length]); // the rest mount 2.5 s after load, before the first rotation, so no slide ever shows before its photo is there
  const deals = [...P].sort((a, b) => off(b) - off(a)).slice(0, 5);
  const quotes = P.flatMap(p => (p.reviews || []).map(r => ({ ...r, p }))).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6); // newest reviews across the catalogue
  const oss = osList(P);
  const onHero = e => {
    const nav = e.target.dataset.i || e.target.classList.contains("prev") || e.target.classList.contains("next");
    if (nav) setAuto(false); // the visitor is driving now; stop the autoplay
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
  const inchOf = p => +((/\((\d+)\s*inch\)/.exec(p.name) || [])[1] || 0);
  const minP = ps => ps.length ? Math.min(...ps.map(p => p.price)) : 0;
  const SHOTS = ["img/p1.jpg", "img/p3.jpg", "img/p0.jpg", "img/p2.jpg"], LIFE = [life("os1", "img/life-room.jpg"), life("os2", "img/hero0.jpg"), life("os3", "img/life-12.jpg"), life("os4", "img/life-13.jpg")]; // one photograph per operating system, none repeated
  const sizeCards = [[32, "Compact spaces"], [43, "Everyday viewing"], [55, "Living-room favourite"], [65, "Cinematic experience"], [75, "Go bigger"]].map(([inch, desc], i) => ({ inch, desc, img: life("size" + inch, SHOTS[i % SHOTS.length]), from: minP(tvs.filter(p => inchOf(p) === inch)) }));
  const osBenefit = { "Google TV": "Every app on one home screen, with Google Assistant and Chromecast.", "WebOS": "A quick card-style home screen with apps built in — no set-top box.", "Android TV": "Google Play apps and Chromecast, built in." };
  const osCards = oss.map((o, i) => ({ os: o, text: osBenefit[o] || "Smart apps built in.", img: LIFE[i % LIFE.length], from: minP(tvs.filter(p => p.os === o)) }));
  const resCards = [["4K Ultra HD", "Four times the detail of Full HD."], ["Full HD", "Crisp, clear everyday viewing."], ["HD Ready", "Great value for smaller rooms."]].map(([res, text], i) => { const ps = tvs.filter(p => resOf(p) === res).sort((a, b) => a.price - b.price); return { res, text, img: life(["res4k", "resfhd", "reshd"][i], ps[0] && (cutout(ps[0].img) || ps[0].img)), from: minP(ps) }; }).filter(c => c.from);
  // display technology from the specifications (LED today; QLED/OLED appear when the catalogue has them), kept apart from resolution
  const typeOf = p => spec(p, "display type").split(",")[0].trim();
  const TECH_NOTE = { LED: "LED backlight on every model we stock", "Mini-LED PRO": "Brighter. Deeper. Smoother. More immersive.", QLED: "Quantum-dot colour", OLED: "Self-lit pixels, perfect blacks" }; // the Mini-LED line is the brochure's own
  const techCards = [...new Set(tvs.map(typeOf).filter(Boolean))].sort().map(t => { const ps = tvs.filter(p => typeOf(p) === t).sort((a, b) => a.price - b.price); return { res: t, text: TECH_NOTE[t] || "Screen technology", img: life("tech" + t, ps[0] && (cutout(ps[0].img) || ps[0].img)), from: minP(ps), href: listUrl({ cat: "Televisions", type: t }) }; });
  const detailCards = [...techCards, ...resCards.map(c => ({ ...c, href: listUrl({ cat: "Televisions", res: c.res }) }))];
  // the two brand showcases (client brief, section 12): the brief's headlines, a bright room for Elista, a cinematic room for Telefunken
  const BRAND_SHOW = { Elista: { title: "Brilliant Entertainment. Beautifully Yours.", text: "Discover the Elista television collection.", cta: "Explore Elista TVs", img: life("brandElista", "img/brand-elista.webp") }, Telefunken: { title: "Bring Every Moment to Life.", text: "Explore immersive entertainment with Telefunken.", cta: "Explore Telefunken TVs", img: life("brandTelefunken", "img/brand-telefunken.webp") } }; // brand rooms from the client's tv-store-design export, converted to WebP
  const LAUNCHES = [
    { kicker: "Elista", title: "Elista 4K Smart TV Collection", text: "Brilliant 4K entertainment, beautifully yours.", href: brandUrl("Elista"), img: life("launch1", "img/hero0.jpg"), dark: true },
    { kicker: "Telefunken", title: "Cinematic Viewing, Reimagined", text: "Big-screen Google TV with Dolby Audio.", href: brandUrl("Telefunken"), img: life("launch2", "img/life-cinema.jpg"), dark: true },
    { kicker: "Apps built in", title: "Smart Entertainment", text: "Every app built in, no set-top box.", href: "/televisions#os", img: life("launch3", "img/p2.jpg") },
    { kicker: "Big screen", title: "The Big-Screen Experience", text: "Made for movie nights.", href: listUrl({ cat: "Televisions", size: "65 inch TVs" }), img: life("launch4", "img/p3.jpg") },
    { kicker: "New", title: "Next-Generation Smart TVs", text: "Discover the latest from Elista.", href: "/televisions", img: life("launch5", "img/p0.jpg") },
  ].map(l => ({ ...l, dark: l.dark || !cutout(l.img) })); // a room photo gets the darker shade; a render sits on its own dark stage
  const brandBig = (b, i) => { const prod = biggest(b), pts = brandPoints(P, b), n = P.filter(p => p.brand === b).length, tone = (HOME_BANNERS.find(s => s.brand === b) || {}).tone, show = BRAND_SHOW[b] || { title: b + ".", text: "Discover the " + b + " television collection.", cta: "Explore " + b + " TVs", img: "" };
        return prod ? <a className={"bbrand" + (i % 2 ? " flip" : "") + (show.img ? " photo" : "")} href={brandUrl(b)} key={b} style={tone && !show.img ? { background: tone } : undefined}>
          {show.img && <img className="bphoto" src={pic(show.img, 960)} srcSet={picSet(show.img)} sizes="(max-width:1240px) 100vw, 1240px" alt="" loading="lazy" />}
          {show.img && /show-(elista|telefunken)/.test(show.img) && <video className="bvid" muted loop playsInline preload="none" data-src={"/" + show.img.replace(".jpg", ".mp4")} aria-hidden="true"></video>}
          <div className="btext"><span className="kicker">{b} · {n} model{n === 1 ? "" : "s"}</span><b>{show.title}</b><p>{show.text}</p><ul>{pts.map(t => <li key={t}>{t}</li>)}</ul><u>{show.cta} →</u></div>
          {show.img ? null : cutout(prod.img) ? <img className="cut" src={cutout(prod.img)} alt={prod.brand + " " + prod.name} loading="lazy" /> : <img src={pic(prod.img)} srcSet={picSet(prod.img)} sizes="(max-width:860px) 100vw, 46vw" alt={prod.brand + " " + prod.name} width="800" height="800" loading="lazy" />}</a> : null; }; // one giant band per brand (the client wants big, colourful brand imagery, not small cards)
  return <>
    <div className={"hero" + (auto ? " auto" : "")} ref={heroRef} onClick={onHero} onPointerMove={onMove}>
      {slides.map((sl, i) => <m.div className={"slide k-" + sl.kind + (i === cur ? " on" : "")} data-preset={sl.preset || "cinematic"} key={i} initial={i === 0 ? false : "hide"} animate={i === cur ? "show" : "hide"} variants={GROUP} style={sl.tone ? { background: sl.tone } : undefined}>
        {(sl.brand || sl.kind === "promo") && <span className="ghostmark" aria-hidden="true">{sl.brand || "Offers"}</span>}
        {sl.im && seen.has(i) && <div className="bg"><picture>{sl.imMobile && <source media="(max-width:760px)" srcSet={picSet(sl.imMobile) || pic(sl.imMobile, 960)} sizes="100vw" />}<img {...picOf(sl.im)} sizes="100vw" alt="" width="1344" height="752" fetchPriority={i ? "low" : "high"} loading={i ? "lazy" : "eager"} decoding="async" /></picture>{sl.vid && <video className="vid" muted loop playsInline preload="none" data-src={sl.vid} aria-hidden="true"></video>}</div>}
        {sl.prod && !sl.im && seen.has(i) && <m.a className={"bigtv" + (cutout(sl.prod.img) ? " cut" : "")} variants={RISE} href={productUrl(sl.prod)}>{cutout(sl.prod.img)
          ? <><span className="tvglow" aria-hidden="true"></span><img className="tvmain" src={cutout(sl.prod.img)} alt={sl.prod.brand + " " + sl.prod.name} loading={i ? "lazy" : "eager"} /><img className="tvrefl" src={cutout(sl.prod.img)} alt="" aria-hidden="true" loading="lazy" /></>
          : <img src={pic(sl.prod.img)} srcSet={picSet(sl.prod.img)} sizes="(max-width:760px) 40vw, 30vw" alt={sl.prod.brand + " " + sl.prod.name} width="800" height="800" loading={i ? "lazy" : "eager"} />}</m.a>}
        {sl.art && <m.span className="bigtv cut art" variants={RISE} aria-hidden="true"><span className="tvglow"></span><img className="tvmain" src={sl.art} srcSet={sl.art.replace(".webp", "-480.webp") + " 480w, " + sl.art + " 865w"} sizes="(max-width:760px) 70vw, 40vw" alt="" width="865" height="572" fetchPriority={i ? "low" : "high"} loading={i ? "lazy" : "eager"} decoding="async" /></m.span>}
        <div className="hpanel">
          {sl.eyebrow && <m.span className="eyebrow" variants={RISE}>{sl.eyebrow}</m.span>}
          <m.h1 variants={WORDS}>{sl.h.map((l, j) => <span className="ln" key={j}>{l.split(" ").map((w, k) => <m.span className={"w" + (sl.hi && sl.hi.includes(w) ? " hi" : "")} variants={RISE} key={k}>{w}&nbsp;</m.span>)}</span>)}</m.h1>
          {sl.pts ? <m.ul className="pts" variants={RISE}>{sl.pts.map(t => <li key={t}>{t}</li>)}</m.ul> : <m.p variants={RISE}>{sl.s}</m.p>}
          {(sl.kind === "photo" || sl.kind === "deal") && minTv > 0 && <m.div className="hfacts" variants={RISE}><span>From {money(minTv)}</span><span>Up to {maxOff}% off</span>{minEmi > 0 && <span>No Cost EMI from {money(minEmi)}/month</span>}</m.div>}
          <m.div className="hcta" variants={RISE}><a className="btn" href={sl.href}>{sl.cta}</a><a className="btn ghost" href={sl.href2 || listUrl({ cat: "Televisions", sort: "off" })}>{sl.cta2 || "See deals"}</a></m.div>
        </div>
      </m.div>)}
      {slides.length > 1 && <><button className="arrow prev" aria-label="Previous slide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button><button className="arrow next" aria-label="Next slide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
      <div className="dots">{slides.map((_, i) => <button aria-label={"Slide " + (i + 1)} data-i={i} className={i === cur ? "on" : undefined} key={i}></button>)}</div></>}
    </div>
    <FestiveBanner tvs={tvs} maxOff={maxOff} minEmi={minEmi} money={money} />
    {!me && <Welcome maxOff={maxOff} minTv={minTv} minEmi={minEmi} money={money} />}
    <section className="trustrow" aria-label="Why shop with Mytekkstore"><div className="why">
      <div><Ico shapes={DRAW_ICONS.truck} /><b>Fast delivery</b><p>Doorstep delivery across the country.</p></div>
      <div><Ico shapes={DRAW_ICONS.shield} /><b>Genuine products</b><p>Brand warranty on everything we sell.</p></div>
      <div><Ico shapes={DRAW_ICONS.cash} /><b>Cash on delivery</b><p>Pay when your order arrives.</p></div>
      <div><Ico shapes={DRAW_ICONS.box} /><b>Order tracking</b><p>Follow every order from your account.</p></div>
    </div></section>
    <section><h2>Deals of the Day <a href="/products?sort=off">View all</a></h2><p className="lead">The biggest discounts right now. Free delivery on every order, cash on delivery.</p><div className="grid">{deals.map((p, i) => <Card p={p} i={i} key={p.id} />)}</div></section>
    <section className="disco"><h2>Shop by size</h2><p className="lead">Know the size you want? Start here. Every size we stock, with its starting price.</p>
      <div className="dgrid five">{sizeCards.map(s => <a className={"dcard" + (cutout(s.img) ? "" : " photo")} href={listUrl({ cat: "Televisions", size: s.inch + " inch TVs" })} key={s.inch}><span className="dimg"><img src={pic(s.img, 480)} srcSet={picSet(s.img)} sizes="240px" alt="" loading="lazy" width="800" height="800" /></span><span className="dbody"><b>{s.inch}"</b><small>{s.desc}</small><em>{s.from ? "from " + money(s.from) : "Coming soon"}</em></span><i className="darr" aria-hidden="true">→</i></a>)}</div></section>
    {BRANDS[0] && <section className="bigbrands solo">{brandBig(BRANDS[0], 0)}</section>}
    {osCards.length > 0 && <section className="disco"><h2>Shop by technology</h2><p className="lead">Google TV or WebOS, with the apps built in. Pick the platform that fits you.</p>
      <div className="dgrid land">{osCards.map(c => <a className="dcard os" href={osUrl(c.os)} key={c.os}><span className="dimg"><img src={pic(c.img, 960)} srcSet={picSet(c.img)} sizes="(max-width:760px) 92vw, 46vw" alt="" loading="lazy" /></span><span className="dbody"><b>{c.os}</b><small>{c.text}</small><em>{c.from ? "from " + money(c.from) : ""}</em></span><i className="darr" aria-hidden="true">→</i></a>)}</div></section>}
    <OsChart P={tvs} lead="Not sure which operating system to pick? Here is what each one gives you, side by side." />
    <BankStrip wrap full />
    {BRANDS[1] && <section className="bigbrands solo">{brandBig(BRANDS[1], 1)}</section>}
    {detailCards.length > 0 && <section className="disco"><h2>Shop by picture quality</h2><p className="lead">4K, Full HD or HD Ready, and the screen technology behind it.</p>
      <div className={"dgrid " + (detailCards.length > 3 ? "four" : "three")}>{detailCards.map(c => <a className={"dcard tall dark" + (/-cut\.webp$/.test(c.img) ? "" : " photo")} href={c.href} key={c.res}><span className="dimg"><img src={pic(c.img, 960)} srcSet={picSet(c.img)} sizes="(max-width:760px) 70vw, 30vw" alt="" loading="lazy" /></span><span className="lshade"></span><span className="dbody"><b>{c.res}</b><small>{c.text}</small><em>from {money(c.from)}</em></span></a>)}</div></section>}
    <section className="launches"><h2>Latest Launches</h2><p className="lead">Discover what's new in home entertainment.</p>
      <div className="launchgrid">{LAUNCHES.map((l, i) => <a className={"launch" + (i < 2 ? " big" : "") + (l.dark ? " dark" : "") + (cutout(l.img) ? " stage" : "")} href={l.href} key={l.title}>{cutout(l.img) ? <img src={cutout(l.img)} alt="" loading="lazy" /> : <img src={pic(l.img, 960)} srcSet={picSet(l.img)} sizes="(max-width:760px) 92vw, 46vw" alt="" loading="lazy" />}<span className="lshade"></span><span className="ltext"><span className="kicker">{l.kicker}</span><h3>{l.title}</h3><p>{l.text}</p><u>Explore now →</u></span></a>)}</div></section>


    {CATS.length > 1 && <nav className="catrail" aria-label="Shop by category">{CATS.map(c => { const n = P.filter(p => p.cat === c).length; return <a className="crail" href={listUrl({ cat: c })} key={c}><b>{c}</b><small>{n} model{n === 1 ? "" : "s"}</small></a>; })}</nav>}






    {quotes.length > 0 && <section><h2>What customers say</h2><p className="lead">The newest reviews from across the catalogue.</p><div className="quotes">{quotes.map((r, i) => <a className="quote" href={productUrl(r.p)} key={i}>
      <div className="stars"><span>{starRow(r.rating)}</span></div><p>“{r.text}”</p><b>{r.name}</b><small>{r.p.brand} {r.p.name}</small></a>)}</div></section>}
    <Qa id="faq" title="Frequently asked questions" lead="The questions buyers ask most, answered in short." list={FAQ.slice(0, 6)} more={["/buying-guide", "More about choosing a TV"]} />
    <Row title="Recently viewed" href="" list={recent.map(byId).filter(Boolean)} />
  </>;
}


// The festive discount banner under the hero (Reliance Digital and Amazon open their festival sales this way): festive colours,
// lights drawn in CSS and still, the biggest real discount in gold, the biggest-saving TV's own render. The lights and the TV
// shift a little as the visitor scrolls (--p from 0 to 1 across the viewport), never on their own, and not under reduced motion.
export function FestiveBanner({ tvs, maxOff, minEmi, money, href = "/offers", cta = "Shop festive offers →" }) { // also the opener of the offers page itself, where it points at the deals list
  const ref = useRef();
  const still = useReducedMotion();
  const top = [...tvs].sort((a, b) => off(b) - off(a))[0];
  useEffect(() => {
    if (still) return;
    const el = ref.current; if (!el) return;
    let raf = 0;
    const tick = () => { raf = 0; const r = el.getBoundingClientRect(), vh = innerHeight; el.style.setProperty("--p", Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))).toFixed(3)); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick(); addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll);
    return () => { removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [still]);
  if (!tvs.length || !top || maxOff <= 0) return null;
  return <section className="festive bleed" ref={ref} aria-label={FESTIVE.title}>
    <a className="festin" href={href}>
      <span className="fsparkle" aria-hidden="true"></span>
      <span className="flights" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
      <span className="ftext">
        <span className="flock"><i></i>{FESTIVE.title}<i></i></span>
        <span className="fcamp">Make your Diwali smarter &amp; brighter</span>
        <b><small>Up to</small><strong>{maxOff}% off</strong><span>on Smart TVs</span></b>
        <span className="fbenefits"><span>Free delivery across India</span><span>Cash on delivery</span>{minEmi && <span>No Cost EMI from {money(minEmi)}/month</span>}</span>
        <span className="btn">{cta}</span>
      </span>
      <span className="fstage" aria-hidden="true"><span className="fglow"></span><img className="froom" src="/img/fest-room.webp" alt="" loading="lazy" width="860" height="430" /></span>
      <span className="fbanks"><BankBoxes /><small>*T&amp;C apply · Savings are MRP against our price</small></span>
    </a>
  </section>;
}


// The welcome dialog (owner request, 26 Oct): the festive figures, real and from the catalogue, with the sign-up invitation under
// them. The browser's own <dialog> gives the focus trap, Esc and the backdrop; it opens once per visitor after a short pause, not
// for a signed-in visitor, not under automation unless the address carries ?welcome=1, and not again once closed.
function Welcome({ maxOff, minTv, minEmi, money }) {
  const ref = useRef();
  useEffect(() => {
    const forced = qs.get("welcome") === "1";
    if (maxOff <= 0 || (!forced && (load("welcome", 0) || navigator.webdriver))) return;
    const t = setTimeout(() => { const d = ref.current; if (d && !d.open) { try { d.showModal(); } catch { /* an older browser without <dialog>: nothing opens */ } } }, forced ? 300 : 5000);
    return () => clearTimeout(t);
  }, [maxOff]);
  const close = () => { save("welcome", Date.now()); if (ref.current && ref.current.open) ref.current.close(); };
  return <dialog className="welcome" ref={ref} aria-labelledby="welcome-title" onClose={close} onClick={e => { if (e.target === ref.current) close(); }}>
    <div className="wcard">
      <div className="wstage" aria-hidden="true"><img className="wimg" src="/img/tv-festival.webp" alt="" width="863" height="588" loading="lazy" /></div>
      <button type="button" className="wclose" onClick={close} aria-label="Close">×</button>
      <div className="wbody">
        <span className="wkick">Festive Offers · Live now</span>
        <h2 id="welcome-title">Up to <b>{maxOff}% off</b> on Smart TVs</h2>
        <p>From {money(minTv)}{minEmi ? ", No Cost EMI from " + money(minEmi) + "/month" : ""}, extra bank discounts and cash on delivery.</p>
        <div className="wsign">
          <b>Sign up in a minute</b>
          <span>Faster checkout, order tracking and the festive and bank offers first.</span>
          <div className="wbtns"><a className="btn" href="/account?next=/televisions%3Fsort%3Doff">Sign up</a><a className="btn ghost" href="/televisions?sort=off" onClick={close}>Shop deals</a></div>
        </div>
        <button type="button" className="wlater" onClick={close}>Maybe later</button>
      </div>
    </div>
  </dialog>;
}
