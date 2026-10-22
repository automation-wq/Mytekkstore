// Home page (client decisions of 2026-10-12): four banners (factory prices, one per brand, one promotion), the numbers that matter
// (discount, EMI, bank offers, genuine), Find your TV (by size and by operating system), Deals of the Day, the two brands with giant
// imagery and their reasons, the operating systems side by side, customer reviews, bank offers, why us, and Good to know with
// warranty and returns. Every figure and reason is read from the catalogue, so nothing here claims what the products do not carry.
import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { track } from "./api.js";
import { useStore } from "./store.jsx";
import { Card, Row, BankOffers, Ico, Icon, Qa } from "./components.jsx";
import { DRAW_ICONS, HOME_BANNERS, FAQ, catSizes, brandUrl, listUrl, off, starRow, productUrl, pic, picSet, osList, osUrl, brandPoints, cutout, life } from "./data.js";
import { lines, TONES } from "./banner.jsx";
import { BANDS, SIZE_NOTE, resOf } from "./category.jsx";

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
  const slides = raw.filter(s => s.kind !== "promo" && (s.kind !== "brand" || biggest(s.brand))).map(s => s.kind === "brand" ? { ...s, pts: brandPoints(P, s.brand), prod: s.prod || biggest(s.brand), href: s.href || brandUrl(s.brand), cta: s.cta || "Shop " + s.brand, eyebrow: s.eyebrow || s.brand }
    : s.kind === "promo" ? { ...s, s: s.s || "Up to " + maxOff + "% off, bank offers, and No Cost EMI on the models that carry it." }
    : s.kind === "photo" ? { ...s, eyebrow: "", ...(s.im === "img/hero-a.jpg" ? { vid: "/img/hero-a.mp4" } : {}) } : s); // lead photo slide: cinematic loop, no eyebrow label (the logo already names the store)
  const show = n => setCur((n + slides.length) % slides.length);
  const [auto, setAuto] = useState(true); // autoplay stops for good once the visitor takes control (arrow/dot)
  useEffect(() => { if (!auto) return; const t = setInterval(() => { if (!heroRef.current || !heroRef.current.matches(":hover")) setCur(c => (c + 1) % slides.length); }, 6000); return () => clearInterval(t); }, [slides.length, auto]);
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
  const tvs = P.filter(p => p.cat === "Televisions");
  const { sizeOf, all: sizeList } = catSizes(P, "Televisions");
  // premium discovery sections (MASTER PROMPT redesign): image-led cards for size, operating system and resolution, an editorial
  // Latest Launches grid, and a product-care banner. Prototype imagery reuses the store's renders and lifestyle shots; copy is
  // aspirational marketing only, no invented specs, prices or model names.
  const spec = (p, k) => ((p.specs || []).find(([n]) => n.toLowerCase().includes(k)) || [])[1] || "";
  const inchOf = p => +((/\((\d+)\s*inch\)/.exec(p.name) || [])[1] || 0);
  const minP = ps => ps.length ? Math.min(...ps.map(p => p.price)) : 0;
  const SHOTS = ["img/p1.jpg", "img/p3.jpg", "img/p0.jpg", "img/p2.jpg"], LIFE = [life("os1", "img/life-room.jpg"), life("os2", "img/hero0.jpg")];
  const sizeCards = [[32, "Compact spaces"], [43, "Everyday viewing"], [55, "Living-room favourite"], [65, "Cinematic experience"], [75, "Go bigger"]].map(([inch, desc], i) => ({ inch, desc, img: life("size" + inch, SHOTS[i % SHOTS.length]), from: minP(tvs.filter(p => inchOf(p) === inch)) }));
  const osBenefit = { "Google TV": "Every app on one home screen, with Google Assistant and Chromecast.", "WebOS": "A quick card-style home screen with apps built in — no set-top box.", "Android TV": "Google Play apps and Chromecast, built in." };
  const osCards = oss.map((o, i) => ({ os: o, text: osBenefit[o] || "Smart apps built in.", img: LIFE[i % LIFE.length], from: minP(tvs.filter(p => p.os === o)) }));
  const resCards = [["4K Ultra HD", "Four times the detail of Full HD."], ["Full HD", "Crisp, clear everyday viewing."], ["HD Ready", "Great value for smaller rooms."]].map(([res, text], i) => { const ps = tvs.filter(p => resOf(p) === res).sort((a, b) => a.price - b.price); return { res, text, img: life(["res4k", "resfhd", "reshd"][i], ps[0] && (cutout(ps[0].img) || ps[0].img)), from: minP(ps) }; }).filter(c => c.from);
  // display technology from the specifications (LED today; QLED/OLED appear when the catalogue has them), kept apart from resolution
  const typeOf = p => spec(p, "display type").split(",")[0].trim();
  const TECH_NOTE = { LED: "LED backlight on every model we stock", QLED: "Quantum-dot colour", OLED: "Self-lit pixels, perfect blacks" };
  const techCards = [...new Set(tvs.map(typeOf).filter(Boolean))].sort().map(t => { const ps = tvs.filter(p => typeOf(p) === t).sort((a, b) => a.price - b.price); return { res: t, text: TECH_NOTE[t] || "Screen technology", img: life("tech" + t, ps[0] && (cutout(ps[0].img) || ps[0].img)), from: minP(ps), href: listUrl({ cat: "Televisions", type: t }) }; });
  const detailCards = [...techCards, ...resCards.map(c => ({ ...c, href: listUrl({ cat: "Televisions", res: c.res }) }))];
  // the two brand showcases (client brief, section 12): the brief's headlines, a bright room for Elista, a cinematic room for Telefunken
  const BRAND_SHOW = { Elista: { title: "Brilliant Entertainment. Beautifully Yours.", text: "Discover the Elista television collection.", cta: "Explore Elista TVs", img: life("brandElista", "img/life-room.jpg") }, Telefunken: { title: "Bring Every Moment to Life.", text: "Explore immersive entertainment with Telefunken.", cta: "Explore Telefunken TVs", img: life("brandTelefunken", "img/life-cinema.jpg") } };
  const LAUNCHES = [
    { kicker: "Elista", title: "Elista 4K Smart TV Collection", text: "Brilliant 4K entertainment, beautifully yours.", href: brandUrl("Elista"), img: life("launch1", "img/hero0.jpg"), dark: true },
    { kicker: "Telefunken", title: "Cinematic Viewing, Reimagined", text: "Big-screen Google TV with Dolby Audio.", href: brandUrl("Telefunken"), img: life("launch2", "img/life-cinema.jpg"), dark: true },
    { kicker: "Apps built in", title: "Smart Entertainment", text: "Every app built in, no set-top box.", href: "/televisions#os", img: life("launch3", "img/p2.jpg") },
    { kicker: "Big screen", title: "The Big-Screen Experience", text: "Made for movie nights.", href: listUrl({ cat: "Televisions", size: "65 inch TVs" }), img: life("launch4", "img/p3.jpg") },
    { kicker: "New", title: "Next-Generation Smart TVs", text: "Discover the latest from Elista and Telefunken.", href: "/televisions", img: life("launch5", "img/p0.jpg") },
  ].map(l => ({ ...l, dark: l.dark || !cutout(l.img) })); // a room photo gets the darker shade; a render sits on its own dark stage
  return <>
    <div className={"hero" + (auto ? " auto" : "")} ref={heroRef} onClick={onHero} onPointerMove={onMove}>
      {slides.map((sl, i) => <m.div className={"slide k-" + sl.kind + (i === cur ? " on" : "")} data-preset={sl.preset || "cinematic"} key={i} initial={i === 0 ? false : "hide"} animate={i === cur ? "show" : "hide"} variants={GROUP} style={sl.tone ? { background: sl.tone } : undefined}>
        {(sl.brand || sl.kind === "promo") && <span className="ghostmark" aria-hidden="true">{sl.brand || "Offers"}</span>}
        {sl.im && <div className="bg"><picture>{sl.imMobile && <source media="(max-width:760px)" srcSet={pic(sl.imMobile, 960)} />}<img {...picOf(sl.im)} sizes="100vw" alt="" width="1344" height="752" fetchPriority={i ? "low" : "high"} loading={i ? "lazy" : "eager"} decoding="async" /></picture>{sl.vid && <video className="vid" muted loop playsInline preload="none" data-src={sl.vid} aria-hidden="true"></video>}</div>}
        {sl.prod && <m.a className={"bigtv" + (cutout(sl.prod.img) ? " cut" : "")} variants={RISE} href={productUrl(sl.prod)}>{cutout(sl.prod.img)
          ? <><span className="tvglow" aria-hidden="true"></span><img className="tvmain" src={cutout(sl.prod.img)} alt={sl.prod.brand + " " + sl.prod.name} loading={i ? "lazy" : "eager"} /><img className="tvrefl" src={cutout(sl.prod.img)} alt="" aria-hidden="true" loading="lazy" /></>
          : <img src={pic(sl.prod.img)} srcSet={picSet(sl.prod.img)} sizes="(max-width:760px) 40vw, 30vw" alt={sl.prod.brand + " " + sl.prod.name} width="800" height="800" loading={i ? "lazy" : "eager"} />}</m.a>}
        <div className="hpanel">
          {sl.eyebrow && <m.span className="eyebrow" variants={RISE}>{sl.eyebrow}</m.span>}
          <m.h1 variants={WORDS}>{sl.h.map((l, j) => <span className="ln" key={j}>{l.split(" ").map((w, k) => <m.span className="w" variants={RISE} key={k}>{w}&nbsp;</m.span>)}</span>)}</m.h1>
          {sl.pts ? <m.ul className="pts" variants={RISE}>{sl.pts.map(t => <li key={t}>{t}</li>)}</m.ul> : <m.p variants={RISE}>{sl.s}</m.p>}
          <m.div className="hcta" variants={RISE}><a className="btn" href={sl.href}>{sl.cta}</a><a className="btn ghost" href={sl.href2 || listUrl({ cat: "Televisions", sort: "off" })}>{sl.cta2 || "See deals"}</a></m.div>
        </div>
      </m.div>)}
      {slides.length > 1 && <><button className="arrow prev" aria-label="Previous slide">‹</button><button className="arrow next" aria-label="Next slide">›</button>
      <div className="dots">{slides.map((_, i) => <button aria-label={"Slide " + (i + 1)} data-i={i} className={i === cur ? "on" : undefined} key={i}></button>)}</div></>}
    </div>


    {CATS.length > 1 && <nav className="catrail" aria-label="Shop by category">{CATS.map(c => { const n = P.filter(p => p.cat === c).length; return <a className="crail" href={listUrl({ cat: c })} key={c}><b>{c}</b><small>{n} model{n === 1 ? "" : "s"}</small></a>; })}</nav>}

    <section className="launches"><h2>Latest Launches</h2><p className="lead">Discover what's new in home entertainment.</p>
      <div className="launchgrid">{LAUNCHES.map((l, i) => <a className={"launch" + (i < 2 ? " big" : "") + (l.dark ? " dark" : "") + (cutout(l.img) ? " stage" : "")} href={l.href} key={l.title}>{cutout(l.img) ? <img src={cutout(l.img)} alt="" loading="lazy" /> : <img src={pic(l.img, 960)} srcSet={picSet(l.img)} sizes="(max-width:760px) 92vw, 46vw" alt="" loading="lazy" />}<span className="lshade"></span><span className="ltext"><span className="kicker">{l.kicker}</span><h3>{l.title}</h3><p>{l.text}</p><u>Explore now →</u></span></a>)}</div></section>

    <section><h2>Deals of the Day <a href="/products?sort=off">View all</a></h2><p className="lead">The biggest discounts right now.</p><div className="grid">{deals.map((p, i) => <Card p={p} i={i} key={p.id} />)}</div></section>

    <section className="disco"><h2>Every room. The right screen.</h2><p className="lead">Find the perfect screen size for every space.</p>
      <div className="dgrid five">{sizeCards.map(s => <a className={"dcard" + (cutout(s.img) ? "" : " photo")} href={listUrl({ cat: "Televisions", size: s.inch + " inch TVs" })} key={s.inch}><span className="dimg"><img src={pic(s.img, 480)} srcSet={picSet(s.img)} sizes="240px" alt="" loading="lazy" width="800" height="800" /></span><span className="dbody"><b>{s.inch}"</b><small>{s.desc}</small><em>{s.from ? "from " + money(s.from) : "Coming soon"}</em></span><i className="darr" aria-hidden="true">→</i></a>)}</div></section>
    {tvs.length > 0 && <section className="disco budget"><h2>Shop by budget</h2><p className="lead">Straight to the TVs in your range.</p>
      <div className="bgrid">{[[0, 10000, "Under " + money(10000), "Smart TVs for a first home"], [10000, 25000, money(10000) + " – " + money(25000), "The value sweet spot"], [25000, 50000, money(25000) + " – " + money(50000), "Big-screen 4K favourites"], [50000, 0, "Above " + money(50000), "The premium large screens"]].map(([mn, mx, label, note], i) => { const ps = tvs.filter(p => (!mn || p.price >= mn) && (!mx || p.price <= mx)); const c = ps.length, from = c ? Math.min(...ps.map(p => p.price)) : 0; return <a className="bcard" href={listUrl({ cat: "Televisions", min: mn || "", max: mx || "" })} key={label}><span className="bk" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><span className="bbd"><b>{label}</b><small>{note}</small><em>{c} model{c === 1 ? "" : "s"}{from ? " · from " + money(from) : ""}</em></span><i className="darr" aria-hidden="true">→</i></a>; })}</div></section>}

    {osCards.length > 0 && <section className="disco"><h2>Entertainment, your way.</h2><p className="lead">Choose the smart TV experience that fits your lifestyle.</p>
      <div className="dgrid land">{osCards.map(c => <a className="dcard os" href={osUrl(c.os)} key={c.os}><span className="dimg"><img src={pic(c.img, 960)} srcSet={picSet(c.img)} sizes="(max-width:760px) 92vw, 46vw" alt="" loading="lazy" /></span><span className="dbody"><b>{c.os}</b><small>{c.text}</small><em>{c.from ? "from " + money(c.from) : ""}</em></span><i className="darr" aria-hidden="true">→</i></a>)}</div></section>}

    {detailCards.length > 0 && <section className="disco"><h2>See every detail differently.</h2><p className="lead">Explore display technologies built for exceptional viewing.</p>
      <div className={"dgrid " + (detailCards.length > 3 ? "four" : "three")}>{detailCards.map(c => <a className={"dcard tall dark" + (/-cut\.webp$/.test(c.img) ? "" : " photo")} href={c.href} key={c.res}><span className="dimg"><img src={pic(c.img, 960)} srcSet={picSet(c.img)} sizes="(max-width:760px) 70vw, 30vw" alt="" loading="lazy" /></span><span className="lshade"></span><span className="dbody"><b>{c.res}</b><small>{c.text}</small><em>from {money(c.from)}</em></span></a>)}</div></section>}

    {tvs.length > 0 && <section className="disco" id="find"><h2>Help me choose</h2><p className="lead">Four quick questions, answered in any order, and the TVs that fit.</p>
      <Finder tvs={tvs} sizes={sizeList} sizeOf={sizeOf} /></section>}

    <section className="bigbrands"><h2>Featured brands</h2><p className="lead">Flagship collections from {BRANDS.join(" and ")}, with the brand's own warranty.</p>
      {BRANDS.map((b, i) => { const prod = biggest(b), pts = brandPoints(P, b), n = P.filter(p => p.brand === b).length, tone = (HOME_BANNERS.find(s => s.brand === b) || {}).tone, show = BRAND_SHOW[b] || { title: b + ".", text: "Discover the " + b + " television collection.", cta: "Explore " + b + " TVs", img: "" };
        return prod ? <a className={"bbrand" + (i % 2 ? " flip" : "") + (show.img ? " photo" : "")} href={brandUrl(b)} key={b} style={tone && !show.img ? { background: tone } : undefined}>
          {show.img && <img className="bphoto" src={pic(show.img, 960)} srcSet={picSet(show.img)} sizes="(max-width:1240px) 100vw, 1240px" alt="" loading="lazy" />}
          {show.img && /show-(elista|telefunken)/.test(show.img) && <video className="bvid" muted loop playsInline preload="none" data-src={"/" + show.img.replace(".jpg", ".mp4")} aria-hidden="true"></video>}
          <div className="btext"><span className="kicker">{b} · {n} model{n === 1 ? "" : "s"}</span><b>{show.title}</b><p>{show.text}</p><ul>{pts.map(t => <li key={t}>{t}</li>)}</ul><u>{show.cta} →</u></div>
          {show.img ? null : cutout(prod.img) ? <img className="cut" src={cutout(prod.img)} alt={prod.brand + " " + prod.name} loading="lazy" /> : <img src={pic(prod.img)} srcSet={picSet(prod.img)} sizes="(max-width:860px) 100vw, 46vw" alt={prod.brand + " " + prod.name} width="800" height="800" loading="lazy" />}</a> : null; })}</section>
    <BankOffers />
    <section><h2>Why Mytekkstore?</h2><p className="lead">More confidence in every purchase.</p><div className="why">
      <div><Ico shapes={DRAW_ICONS.truck} /><b>Fast delivery</b><p>Doorstep delivery across the country.</p></div>
      <div><Ico shapes={DRAW_ICONS.shield} /><b>Genuine products</b><p>Brand warranty on everything we sell.</p></div>
      <div><Ico shapes={DRAW_ICONS.cash} /><b>Cash on delivery</b><p>Pay when your order arrives.</p></div>
      <div><Ico shapes={DRAW_ICONS.box} /><b>Order tracking</b><p>Follow every order from your account.</p></div>
    </div></section>
    <section className="care"><span className="ctext"><span className="kicker">Product care</span><h2>{"Your entertainment. Our priority."}</h2><p>Explore product support, warranty and care information. Brand warranty, free delivery and easy returns on every Mytekkstore order.</p><a className="btn" href="/returns">Explore product care</a></span></section>
    {quotes.length > 0 && <section><h2>What customers say</h2><p className="lead">The newest reviews from across the catalogue.</p><div className="quotes">{quotes.map((r, i) => <a className="quote" href={productUrl(r.p)} key={i}>
      <div className="stars"><span>{starRow(r.rating)}</span></div><p>“{r.text}”</p><b>{r.name}</b><small>{r.p.brand} {r.p.name}</small></a>)}</div></section>}
    <Qa title="Frequently asked questions" lead="The questions buyers ask most, answered in short." list={FAQ.slice(0, 6)} more={["/buying-guide", "More about choosing a TV"]} />
    <Row title="Recently viewed" href="" list={recent.map(byId).filter(Boolean)} />
  </>;
}

// Guided finder (brief, section 10): four questions as chips, answered in any order, with a live count from the catalogue. The
// answers map to the same filters the Televisions page uses (budget band, size, resolution, operating system), so the result page
// explains itself with its chips. Nothing is invented: "films and sport" means 4K, the room sizes are the screen sizes we stock.
const USES = [["Films and sport", { res: "4K Ultra HD" }], ["Everyday TV and streaming", {}], ["The lowest price that is still smart", { res: "HD Ready" }]];
function Finder({ tvs, sizes, sizeOf }) {
  const [a, setA] = useState({ band: "", size: "", use: "", os: "" });
  const pick = (k, v) => setA(x => ({ ...x, [k]: x[k] === v ? "" : v }));
  const band = BANDS.find(([, , l]) => l === a.band), use = (USES.find(([u]) => u === a.use) || [])[1] || {};
  const patch = { ...(band ? { min: band[0] || "", max: band[1] || "" } : {}), ...(a.size ? { size: a.size } : {}), ...(a.os ? { os: a.os } : {}), ...use };
  const match = tvs.filter(p => (!patch.min || p.price >= patch.min) && (!patch.max || p.price <= patch.max) && (!patch.size || (sizeOf(p) || {}).label === patch.size) && (!patch.os || p.os === patch.os) && (!patch.res || resOf(p) === patch.res));
  const answered = Object.values(a).filter(Boolean).length;
  const q = (k, title, options) => <div className="fq" key={k}><b>{title}</b><div className="fchips">{options.map(([v, note]) => <button type="button" className={"qchip" + (a[k] === v ? " on" : "")} aria-pressed={a[k] === v} onClick={() => pick(k, v)} key={v}>{v}{note && <small>{note}</small>}</button>)}</div></div>;
  return <div className="finder">
    <p className="muted">Pick what you know. Skip the rest.</p>
    {q("band", "Your budget", BANDS.map(([, , l]) => [l, ""]))}
    {q("size", "The room", [...sizes].sort((x, y) => x.n - y.n).map(s => [s.label, SIZE_NOTE[s.n] || ""]))}
    {q("use", "What you watch most", USES.map(([u]) => [u, ""]))}
    {osList(tvs).length > 1 && q("os", "Smart system", osList(tvs).map(o => [o, ""]))}
    <div className="fgo">{match.length ? <a className="btn" href={listUrl({ cat: "Televisions", ...patch })} onClick={() => track("finder", { ...a, matches: match.length })}>Show {match.length} TV{match.length === 1 ? "" : "s"} →</a> : <span className="muted">No TV matches all of those yet. Change one answer.</span>}{answered > 0 && <button type="button" className="link" onClick={() => setA({ band: "", size: "", use: "", os: "" })}>Start again</button>}</div>
  </div>;
}
