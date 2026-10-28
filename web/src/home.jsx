// Home page (27 Oct 2026): the owner's own design file, "MyTekkStore Homepage Design – Homepage · desktop", section by section, with the
// pictures from the owner's banner pack (public/img/home) and every figure from the catalogue. The design's bracketed placeholders
// ([PRICE], [XX]% OFF, [n], [City], [X] days) are filled from the catalogue or left out when the store has nothing honest to show.
import { useEffect, useRef, useState } from "react";
import { useStore } from "./store.jsx";
import { BANK_OFFERS, off, emiPlans, etaText, productUrl, listUrl, catSizes, pic, picSet, avg, brandLogo } from "./data.js";

const HOME = "img/home/";
const src = (name, w) => "/" + HOME + name + (w ? "-" + w : "") + ".webp";
// the five hero banners the owner made (1920 x 600, with a 1080 x 1080 version for phones); the exchange banner waits for an exchange programme
// the four hero slides: live words over four different living-room cards of the owner's set (the owner's banner pack repeated one photo and named a festival; 27 Oct). Every figure comes from the catalogue.
export const heroSlides = ({ smart, big, mini, qled, minEmi, money }) => [
  { key: "home", card: "webOS-Smart-TV-65in", eyebrow: "MyTekkStore · Elista", h: "Bring the big-screen experience home.", p: "Factory-direct prices on every size, 24 to 85 inch. Free delivery, cash on delivery and No Cost EMI.", chips: [smart ? "Smart TVs from " + money(smart) : "", "24 to 85 inch", minEmi ? "No Cost EMI from " + money(minEmi) + "/month" : ""], cta: "Shop TVs", href: "/televisions", cta2: "Best Deals", href2: "/offers" },
  { key: "big", card: "Google-TV-Xplore-85in", eyebrow: "Cinema at home", h: "Go big. 65 to 85 inch.", p: "Cinema-size screens for your living room, 165 to 215 cm, with Google TV or webOS Hub built in.", chips: [big ? "Big screens from " + money(big) : "", "Free delivery", "Cash on delivery"], cta: "Shop 65\" and above", href: "/televisions?size=65" },
  { key: "mini", card: "Mini-LED-PRO-65in", eyebrow: "New · Mini-LED PRO", h: "Brighter. Deeper. Smoother.", p: "Mini-LED backlight with QLED colour, over 500 nits, Dolby Vision, HDR10, HLG and Dolby Atmos. Google TV 5.0 built in.", chips: [mini ? "Mini-LED PRO from " + money(mini) : "", "55\" and 65\"", "1+1 year warranty*"], cta: "Explore Mini-LED PRO", href: "/televisions?type=Mini-LED+PRO" },
  { key: "qled", card: "Cloud-TV-QLED-43in", eyebrow: "QLED Smart TVs", h: "Colour that pops. Prices that don't.", p: "QLED picture quality from 32 inch upwards, with all your apps built in.", chips: [qled ? "QLED from " + money(qled) : "", "32\" and 43\"", "Android TV"], cta: "Shop QLED TVs", href: "/televisions?type=QLED" },
];
const HeroSlide = ({ s, on, eager }) => <a className={"d-slide" + (on ? " on" : "")} href={s.href} aria-hidden={!on} tabIndex={on ? 0 : -1}>
  <span className="d-sphoto" aria-hidden="true"><img src={pic("img/elista/" + s.card + "_2.webp", 960)} srcSet={picSet("img/elista/" + s.card + "_2.webp")} sizes="(max-width:760px) 100vw, 70vw" alt="" width="1500" height="1500" fetchPriority={eager ? "high" : undefined} loading={eager ? "eager" : "lazy"} decoding="async" /></span>
  <span className="d-stext"><span className="d-seyebrow">{s.eyebrow}</span><strong className="d-sh">{s.h}</strong><span className="d-sp">{s.p}</span>
    <span className="d-schips">{s.chips.filter(Boolean).map((c, i) => <span className={i === 0 ? "gold" : undefined} key={c}>{c}</span>)}</span>
    <span className="d-scta"><span className="d-btn">{s.cta} {I.arrow}</span>{s.cta2 && <span className="d-btn gold">{s.cta2}</span>}</span></span>
</a>;

// the design's icons, drawn once
const I = {
  cart: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.4 12h11L21 7H6" /><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></svg>,
  bolt: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>,
  heart: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2"><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z" /></svg>,
  arrow: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  truck: <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.6"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" /></svg>,
  cod: <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.6"><path d="M12 3v18M5 8l7-5 7 5M4 21h16" /></svg>,
  emi: <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.6"><path d="M4 4h16v12H4zM9 20h6" /><path d="M8 10l2 2 4-4" /></svg>,
  shield: <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.6"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
  lock: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>,
};

// catalogue readers: the inch and cm from the name, the resolution and panel type, the short title the design uses on its cards
const inchOf = p => +((/\((\d+) inch\)/.exec(p.name || "") || [])[1] || 0);
const cmOf = p => +((/(\d+) cm/.exec(p.name || "") || [])[1] || 0);
const resOf = p => /4K/i.test(p.name) ? "4K Ultra HD" : /Full HD/i.test(p.name) ? "Full HD" : "HD Ready";
const typeOf = p => /Mini-LED/i.test(p.name) ? "Mini-LED PRO" : /QLED/i.test(p.name) ? "QLED" : "LED";
const title = p => `${p.brand} ${inchOf(p)}" (${cmOf(p)} cm) ${p.name.replace(/^\d+ cm \(\d+ inch\) /, "")}${p.os ? " · " + p.os : ""}`;
const warranty = p => { const w = ((p.specs || []).find(([k]) => /warranty/i.test(k)) || [])[1] || ""; return /1 \+ 1|1\+1/.test(w) ? "1+1 yr warranty*" : w ? "1 yr warranty*" : "Brand warranty*"; };
const emi9 = p => emiPlans(p.price)[2][1];

// one product card, the design's layout: badges, wishlist, the owner's front card cropped to the set, stars, title, three points, price, EMI line, two buttons, compare
function DCard({ p, tag, tagTone, money, compare }) {
  const d = off(p), n = (p.reviews || []).length;
  return <div className="d-card d-prod">
    <div className="d-badges">{d > 0 && <span className="d-badge">{d}% off</span>}{tag && <span className={"d-badge " + (tagTone || "dark")}>{tag}</span>}</div>
    <button type="button" className="d-wish" data-wish={p.id} aria-label="Add to wishlist">{I.heart}</button>
    <a className="d-ph" href={productUrl(p)} aria-label={title(p)}><img src={pic(p.img, 480)} srcSet={picSet(p.img)} sizes="(max-width:760px) 46vw, 300px" alt="" loading="lazy" width="1500" height="1500" /></a>
    {n > 0 ? <span className="d-stars">★★★★★ <span>{avg(p).toFixed(1)} ({n})</span></span> : <span className="d-stars muted">New in store</span>}
    <a className="d-title" href={productUrl(p)}>{title(p)}</a>
    <ul className="d-pts">{(p.features || []).slice(0, 3).map(f => <li key={f}>{f}</li>)}</ul>
    <div className="d-pricerow"><span className="d-price">{money(p.price)}</span>{p.mrp > p.price && <span className="d-mrp">{money(p.mrp)}</span>}</div>
    {p.price >= 15000 && <span className="d-save">{p.mrp > p.price ? "Save " + money(p.mrp - p.price) + " · " : ""}10% off with HDFC Bank</span>}
    <span className="d-emi">No Cost EMI {money(emi9(p))}/mo · Delivery {etaText()}</span>
    <span className="d-emi small">Free delivery · Cash on delivery · {warranty(p)}</span>
    <div className="d-btns"><button type="button" className="d-btn" data-add={p.id}>{I.cart}Add to cart</button><button type="button" className="d-btn black" data-buy={p.id}>{I.bolt}Buy now</button></div>
    {compare && <label className="d-cmp"><input type="checkbox" checked={compare[0].includes(p.id)} onChange={() => compare[1](p.id)} /> Add to compare</label>}
  </div>;
}

const Head = ({ h, sub, link, href, children }) => <div className="d-hd"><div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}><div><h2 className="d-h">{h}</h2>{sub && <p className="d-sub">{sub}</p>}</div>{children}</div>{link && <a className="d-link" href={href}>{link}</a>}</div>;

export function Home() {
  const { P, money } = useStore();
  const tvs = P.filter(p => p.cat === "Televisions");
  const minTv = tvs.length ? Math.min(...tvs.map(p => p.price)) : 0;
  const emis = tvs.filter(p => p.emi).map(emi9), minEmi = emis.length ? Math.min(...emis) : 0;
  const maxOff = Math.max(0, ...tvs.map(off));
  const by = id => tvs.find(p => p.id === id);
  const picks = ids => ids.map(by).filter(Boolean);
  const from = list => list.length ? money(Math.min(...list.map(p => p.price))) : "";
  const { all: sizes } = catSizes(P, "Televisions");
  const bySize = n => tvs.filter(p => inchOf(p) === n);
  const [cur, setCur] = useState(0), [hold, setHold] = useState(false), [cmp, setCmp] = useState([]), touch = useRef(0);
  const toggleCmp = id => setCmp(c => c.includes(id) ? c.filter(x => x !== id) : c.length >= 4 ? c : [...c, id]);
  const compare = [cmp, toggleCmp];
  // the deals timer: the row refreshes at midnight, India time
  const [left, setLeft] = useState(0);
  useEffect(() => { const tick = () => { const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })); setLeft(24 * 60 - ist.getHours() * 60 - ist.getMinutes()); }; tick(); const t = setInterval(tick, 30000); return () => clearInterval(t); }, []);
  useEffect(() => { document.title = "Mytekkstore | Elista Smart TVs at factory-direct prices"; }, []);
  const swipeStart = e => { touch.current = e.touches[0].clientX; };
  const swipeEnd = e => { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) setCur(c => (c + (dx < 0 ? 1 : 3)) % 4); };

  // the design's picks, by catalogue id (26 the 55 inch webOS, 30 the 65 inch Xplore, 20 the 43 inch Coolita, 18 the 65 inch Mini-LED PRO ...)
  const deals = [[26, "Bestseller", "dark"], [30, "Big screen", "gold"], [20, "Value pick", "green"], [18, "Premium", "dark"]].map(([id, tag, tone]) => ({ p: by(id), tag, tone })).filter(x => x.p);
  const best = picks([3, 27, 11, 14]);
  const under = [...tvs].sort((a, b) => a.price - b.price).slice(0, 8);
  const big = [...tvs.filter(p => inchOf(p) >= 65).sort((a, b) => inchOf(a) - inchOf(b) || a.price - b.price), ...picks([19])].slice(0, 8);
  const living = picks([29, 26, 28, 20]);
  const cmpPicks = picks([26, 29, 19]);
  const mini = by(19) || by(18);
  const miniAll = tvs.filter(p => typeOf(p) === "Mini-LED PRO");
  const reviews = tvs.flatMap(p => (p.reviews || []).map(r => ({ ...r, p }))).slice(-3).reverse();
  const allReviews = tvs.flatMap(p => p.reviews || []);
  const types = [
    ["Google TV", "Google-TV-Xplore-55in", tvs.filter(p => p.os === "Google TV" && typeOf(p) !== "Mini-LED PRO"), listUrl({ cat: "Televisions", os: "Google TV" }), "32\"–85\""],
    ["webOS Hub", "webOS-Smart-TV-55in", tvs.filter(p => p.os === "WebOS"), listUrl({ cat: "Televisions", os: "WebOS" }), "Magic Remote"],
    ["Mini-LED PRO", "Mini-LED-PRO-65in", miniAll, listUrl({ cat: "Televisions", type: "Mini-LED PRO" }), "Dolby Vision"],
    ["QLED", "Cloud-TV-QLED-43in", tvs.filter(p => typeOf(p) === "QLED"), listUrl({ cat: "Televisions", type: "QLED" }), ""],
    ["Budget Smart", "Coolita-OS-FHD-Smart-TV-43in", tvs.filter(p => /Android|Coolita/.test(p.os || "")), "#under-30000", "Android · Coolita"],
    ["Non-Smart HD", "Non-Smart-HD-TV-32in", tvs.filter(p => !p.os), listUrl({ cat: "Televisions", max: 16990 }), ""],
  ];
  const OUTLINE = { 24: "54%", 32: "60%", 43: "66%", 50: "72%", 55: "78%", 65: "84%", 75: "92%", 85: "96%" }; // the design's size cards: an outline that grows with the screen
  const DIST = { 24: "1–1.5 m away", 32: "1.2–2 m away", 43: "1.6–2.5 m away", 50: "2–2.8 m away", 55: "2–3 m away", 65: "2.5–3.5 m away", 75: "3–4 m away", 85: "3.2–4.5 m away" }; // common guidance for 4K and HD screens
  const rooms = { 24: "Kitchen", 32: "Bedroom", 43: "Small room", 50: "Living room", 55: "Living room, 2 BHK", 65: "Large room", 75: "Home theatre", 85: "Home theatre" };
  const bankTone = i => i < 2 ? "green" : "gold";

  const minOf = l => l.length ? Math.min(...l.map(p => p.price)) : 0;
  const slides = heroSlides({ smart: minOf(tvs.filter(p => p.os)), big: minOf(tvs.filter(p => inchOf(p) >= 65)), mini: minOf(miniAll), qled: minOf(tvs.filter(p => typeOf(p) === "QLED")), minEmi, money });
  // the hero moves on every 4 s (owner); a dot or swipe restarts the 4 s, a mouse over it or focus inside holds it, a hidden tab or reduced motion never moves it
  useEffect(() => { if (hold || matchMedia("(prefers-reduced-motion: reduce)").matches) return; const t = setInterval(() => { if (!document.hidden) setCur(c => (c + 1) % slides.length); }, 4000); return () => clearInterval(t); }, [cur, hold, slides.length]);
  return <div className="hp">
    {/* the hero: the owner's banners, one at a time, dots below, a swipe on a phone */}
    <section className="d-hero" aria-roledescription="carousel" aria-label="Offers" onTouchStart={swipeStart} onTouchEnd={swipeEnd} onPointerEnter={e => e.pointerType === "mouse" && setHold(true)} onPointerLeave={() => setHold(false)} onFocus={e => e.target.matches(":focus-visible") && setHold(true)} onBlur={() => setHold(false)}>
      {slides.map((s, i) => <HeroSlide s={s} on={i === cur} eager={i === 0} key={s.key} />)}
      <div className="d-dots" role="tablist">{slides.map((s, i) => <button type="button" role="tab" aria-selected={i === cur} aria-label={"Slide " + (i + 1) + ": " + s.h} className={i === cur ? "on" : undefined} onClick={() => setCur(i)} key={s.key}></button>)}</div>
    </section>

    <section className="d-wrap" id="deals" style={{ paddingTop: 48 }}>
      <Head h="Deals of the Day" link="All deals" href={listUrl({ cat: "Televisions", sort: "off" })}><span className="d-count">Refreshes in <b>{String(Math.floor(left / 60)).padStart(2, "0")}</b>h <b>{String(left % 60).padStart(2, "0")}</b>m</span></Head>
      <div className="d-g4 d-roomy">{deals.map(({ p, tag, tone }) => <DCard p={p} tag={tag} tagTone={tone} money={money} compare={compare} key={p.id} />)}</div>
    </section>

    <section className="d-wrap d-sec">
      <Head h="With every order" sub="What you get when you buy direct from MyTekkStore." />
      <div className="d-perks">{[
        [I.truck, "Free delivery", "On every TV, across India, usually in 3 to 5 days.", "/shipping-policy", "Delivery details"],
        [I.cod, "Cash on delivery", "Pay at your door, or online by UPI, card or net banking.", "/shipping-policy#door", "How it works"],
        [I.emi, "No Cost EMI", (minEmi ? "From " + money(minEmi) + "/month" : "Monthly instalments") + " on HDFC, ICICI, SBI, Axis and Kotak cards.", "/refund-policy#emi", "EMI terms"],
        [I.shield, "Genuine, brand warranty", "New, sealed Elista TVs with 1 year or 1 + 1 year warranty.", "/warranty", "Warranty by model"],
      ].map(([ic, t, d, h, l]) => <a className="d-perk2" href={h} key={t}><span className="d-pico">{ic}</span><span className="d-ptxt"><strong>{t}</strong><span>{d}</span><u>{l} →</u></span></a>)}</div>
    </section>

    <section className="d-wrap d-sec"><FestiveBanner tvs={tvs} maxOff={maxOff} minEmi={minEmi} money={money} /></section>

    <section className="d-wrap d-sec" id="bank-offers">
      <Head h="Bank & payment offers" sub="Instant discounts and No Cost EMI from partner banks on card payments." link="All offers & T&C" href="/offers" />
      <div className="d-banks">{BANK_OFFERS.map(([bank, big, terms, color, chip, badge, foot]) => { const emi = /EMI/.test(bank); return <div className={"d-bank2" + (emi ? " is-emi" : "")} style={{ "--bc": color }} key={bank}>
        <div className="d-bstrip"><span className="d-bname">{bank}</span><span className="d-btag">{badge}</span></div>
        <div className="d-bbody"><div className="d-bbig">{emi && minEmi ? money(minEmi) + "/mo" : big}</div><p>{terms}</p>
          <div className="d-bfoot"><span>{chip}</span><b>{foot}</b></div></div>
      </div>; })}</div>
      <div className="d-how"><span><strong>How to avail:</strong> pay online with an eligible card at checkout and the bank applies its offer. One bank offer per order; bank offers can be combined with No Cost EMI.</span><span>Offers are run by the banks and follow their terms.</span></div>
    </section>

    <section className="d-wrap d-sec">
      <Head h="Bestsellers this week" sub="What customers are buying most." link="View all" href="/televisions" />
      <div className="d-g4">{best.map((p, i) => <DCard p={p} tag={i === 0 ? "No.1 seller" : undefined} money={money} compare={compare} key={p.id} />)}</div>
    </section>

    <section className="d-wrap d-sec">
      <div className="d-g3">
        <a className="d-promo" href="#big-screens"><img src={pic("img/elista/webOS-Smart-TV-85in_2.webp", 960)} srcSet={picSet("img/elista/webOS-Smart-TV-85in_2.webp")} sizes="(max-width:900px) 50vw, 30vw" alt="" loading="lazy" width="1500" height="1500" /><span className="d-ov"></span><div className="d-t">{maxOff > 0 && <span className="d-badge">Up to {maxOff}% off</span>}<h3 className="d-h">65" &amp; above</h3><span>Cinema-size screens from {from(tvs.filter(p => inchOf(p) >= 65))}</span></div></a>
        <a className="d-promo" href={listUrl({ cat: "Televisions", type: "Mini-LED PRO" })}><img src={pic("img/elista/Mini-LED-PRO-65in_2.webp", 960)} srcSet={picSet("img/elista/Mini-LED-PRO-65in_2.webp")} sizes="(max-width:900px) 50vw, 30vw" alt="" loading="lazy" width="1500" height="1500" /><span className="d-ov"></span><div className="d-t"><span className="d-badge dark">New</span><h3 className="d-h">Mini-LED PRO</h3><span>Dolby Vision · Atmos · from {from(miniAll)}</span></div></a>
        <a className="d-promo" href="#under-30000"><img src={pic("img/elista/Coolita-OS-HD-Smart-TV-32in_2.webp", 960)} srcSet={picSet("img/elista/Coolita-OS-HD-Smart-TV-32in_2.webp")} sizes="(max-width:900px) 50vw, 30vw" alt="" loading="lazy" width="1500" height="1500" /><span className="d-ov"></span><div className="d-t"><span className="d-badge green">Budget</span><h3 className="d-h">Under ₹30,000</h3><span>Smart TVs for bedroom and kitchen</span></div></a>
      </div>
    </section>

    <section className="d-wrap d-sec" id="under-30000">
      <Head h="Under ₹30,000" sub="Smart TVs for bedrooms, kitchens and first homes." link="View all" href={listUrl({ cat: "Televisions", max: 30000 })} />
      <div className="d-g4">{under.map(p => <DCard p={p} money={money} compare={compare} key={p.id} />)}</div>
    </section>

    <section className="d-wrap d-sec" id="sizes">
      <Head h="Shop by size" sub={"Sit 1.5× the screen width away for the best picture. Example: a 55\" TV suits a sofa about 2 metres from the wall."} link="Size guide" href="/buying-guide" />
      <div className="d-lineup">{sizes.filter(sz => sz.n >= 32).sort((x, y) => x.n - y.n).map((sz, i) => { const list = bySize(sz.n), want = [/QLED/, /Google/, /Coolita|Android/, /WebOS/, /Mini-LED/, /Google/, /WebOS/][i % 7], shot = ((list.find(p => (p.images || [])[0] && want.test(p.name + " " + (p.os || ""))) || list.find(p => (p.images || [])[0])) || {}).images, cm = cmOf(list[0] || {}); return <a className="d-sz" href={listUrl({ cat: "Televisions", size: sz.n })} key={sz.n}>
        <span className="d-szstage" aria-hidden="true"><span className="d-szscreen" style={{ width: Math.round(42 + (sz.n - 32) / (85 - 32) * 56) + "%" }}>{shot && <img src={pic(shot[0], 480)} alt="" loading="lazy" width="480" height="480" />}</span><span className="d-szstand"></span></span>
        <span className="d-szinfo"><strong>{sz.n}"</strong><small>{cm ? cm + " cm · " : ""}{DIST[sz.n] || ""}</small><span className="d-szroom">{rooms[sz.n] || "Living room"}</span><span className="d-szfrom">from <b>{from(list)}</b></span></span>
      </a>; })}</div>
    </section>

    <section className="d-wrap d-sec" id="big-screens">
      <Head h={"Big screens: 65\" to 85\""} sub="Cinema at home. Free delivery and cash on delivery on every TV." link="View all" href={listUrl({ cat: "Televisions", size: "65+" })} />
      <div className="d-g4">{big.map(p => <DCard p={p} tag={p.id === 18 ? "Flagship" : undefined} money={money} compare={compare} key={p.id} />)}</div>
    </section>

    {mini && <section className="d-wrap d-sec">
      <div className="d-feature">
        <div className="d-fimg"><img src={src("Hero3_Mini_LED_PRO", 1280)} srcSet={`${src("Hero3_Mini_LED_PRO", 1280)} 1280w, ${src("Hero3_Mini_LED_PRO")} 1920w`} sizes="100vw" alt="Elista Mini-LED PRO in a living room" loading="lazy" width="1920" height="600" /></div>
        <div className="d-ftext">
          <span className="d-kick">Flagship · Mini-LED PRO</span>
          <h3 className="d-h" style={{ fontSize: 36, lineHeight: 1.08 }}>Brighter. Deeper. Smoother. Our most premium picture.</h3>
          <p className="d-sub">Mini-LED backlight with QLED colour, over 500 nits, Dolby Vision, HDR10, HLG and Dolby Atmos sound. Google TV 5.0 built in.</p>
          <div className="d-stats"><div><div className="d-h">&gt;500</div><span className="d-emi">nits brightness</span></div><div><div className="d-h">Dolby</div><span className="d-emi">Vision · Atmos</span></div><div><div className="d-h">{miniAll.map(inchOf).sort((a, b) => a - b).map(n => n + "\"").join(" · ")}</div><span className="d-emi">{miniAll.length === 1 ? "one size" : "two sizes"}</span></div><div><div className="d-h">1+1 yr</div><span className="d-emi">warranty*</span></div></div>
          <div className="d-pricerow" style={{ marginTop: 8 }}><span className="d-price" style={{ fontSize: 30 }}>{money(mini.price)}</span>{mini.mrp > mini.price && <span className="d-mrp">{money(mini.mrp)}</span>}<span className="d-save">No Cost EMI {money(emi9(mini))}/mo</span></div>
          <div className="d-btns start"><a className="d-btn" href={listUrl({ cat: "Televisions", type: "Mini-LED PRO" })}>Shop Mini-LED PRO</a><a className="d-btn ghost" href={productUrl(mini) + "#t-specs"}>View full specs</a></div>
        </div>
      </div>
    </section>}

    {cmpPicks.length === 3 && <section className="d-wrap d-sec">
      <Head h="Compare top picks" sub="The three TVs most customers choose between." link="Compare all" href={"/compare?ids=" + cmpPicks.map(p => p.id).join(",")} />
      <div className="d-tbl"><table><thead><tr><th style={{ width: "22%" }}>Model</th>{cmpPicks.map(p => <th key={p.id}><a href={productUrl(p)}>{title(p)}</a></th>)}</tr></thead><tbody>
        <tr><td className="muted">Price</td>{cmpPicks.map(p => <td key={p.id}><span className="d-price" style={{ fontSize: 20 }}>{money(p.price)}</span>{p.mrp > p.price && <span className="d-mrp"> {money(p.mrp)}</span>}</td>)}</tr>
        {[["Picture", /resolution|display|picture/i], ["Sound", /sound|speaker|audio/i], ["Smart", /smart|operating|platform/i], ["Memory", /ram|memory|storage/i], ["Warranty", /warranty/i]].map(([row, re]) => <tr key={row}><td className="muted">{row}</td>{cmpPicks.map(p => { const vals = (p.specs || []).filter(([k]) => re.test(k)).map(([, v]) => v); return <td key={p.id}>{[...new Set(vals)].slice(0, 2).join(", ") || "Not stated"}</td>; })}</tr>)}
        <tr><td></td>{cmpPicks.map(p => <td key={p.id}><button type="button" className="d-btn" style={{ height: 46, padding: "0 20px", fontSize: 14 }} data-add={p.id}>{I.cart}Add to cart</button></td>)}</tr>
      </tbody></table></div>
    </section>}

    <section className="d-wrap d-sec">
      <Head h={"Living-room favourites: 50\" and 55\""} sub="The sizes most Indian living rooms are built for." link="View all" href={listUrl({ cat: "Televisions", size: 55 })} />
      <div className="d-g4">{living.map(p => <DCard p={p} money={money} compare={compare} key={p.id} />)}</div>
    </section>

    <section className="d-wrap d-sec">
      <Head h="Shop by type" link="All TVs" href="/televisions" />
      <div className="d-g6">{types.filter(([, , list]) => list.length).map(([name, tile, list, href, note]) => <a className="d-card d-type" href={href} key={name}>
        <div className="d-tv"><img src={pic("img/elista/" + tile + "_2.webp", 480)} srcSet={picSet("img/elista/" + tile + "_2.webp")} sizes="(max-width:900px) 46vw, 260px" alt="" loading="lazy" width="1500" height="1500" /></div>
        <strong>{name}</strong><span className="d-emi">{note ? note + " · " : ""}from {from(list)}</span>{Math.max(...list.map(off)) > 0 && <span className="d-save">Up to {Math.max(...list.map(off))}% off</span>}
      </a>)}</div>
    </section>

    {/* the owner's trust strip (Strip_Trust.jpg) where the design keeps its figures band */}
    <section className="d-strip"><img src={src("Strip_Trust", 960)} srcSet={`${src("Strip_Trust", 960)} 960w, ${src("Strip_Trust")} 1920w`} sizes="100vw" alt="Premium TVs · Multiple Brands · Factory-Direct Prices · No-Cost EMI Options" loading="lazy" width="1920" height="250" /></section>

    <section className="d-wrap d-sec">
      <Head h="Brands we stock" link="All brands" href="/products" />
      <div className="d-brands">{[...new Set(tvs.map(p => p.brand))].map(b => <a className="d-brand" href={"/products?brand=" + encodeURIComponent(b)} key={b}>{brandLogo(b) ? <img src={brandLogo(b)} alt={b} width="297" height="109" /> : b.toUpperCase()}</a>)}</div>
    </section>

    {allReviews.length >= 3 && <section className="d-wrap d-sec">
      <div className="d-hd"><h2 className="d-h">Customers say</h2><span className="d-stars big">★★★★★ <span>{(allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1)} from {allReviews.length} reviews</span></span></div>
      <div className="d-g3">{reviews.map((r, i) => <div className="d-card d-review" key={i}><span className="d-stars">{"★".repeat(r.rating)}</span><p>{r.text}</p><span className="d-emi">{r.name} · Bought {inchOf(r.p)}" {r.p.os || "TV"} · Verified purchase</span></div>)}</div>
    </section>}

    <section className="d-wrap d-sec" id="faq">
      <Head h="Questions people ask before buying" link="Help centre" href="/contact" />
      <div className="d-faq">
        {[["Is the price lower than Amazon or Croma?", "Our prices are factory-direct for Elista, with no seller margin added."], ["How is MyTekkStore different from Croma, Amazon or Flipkart?", "Price: factory-direct, no seller margin added. Delivery: free on every TV, not varying by seller. Cash on delivery: on every TV. No Cost EMI: on every smart TV, not selected items only. Product: genuine, with the brand's warranty. Support: direct from the store, not a call centre. What the big stores have that we do not yet is a shop you can walk into and thousands of reviews, which this store earns one delivered TV at a time."], ["How fast is delivery?", "Free delivery across India, usually within 3 to 5 days. You get tracking by email and from your account."],
          ["Can I pay cash on delivery?", "Yes. Cash on delivery is available on every TV. You can also pay online by UPI, card or net banking."], ["Which cards get No Cost EMI?", "HDFC, ICICI, SBI, Axis and Kotak credit cards, for 3 to 12 months. The interest is borne by us."],
          ["What about warranty and service?", "Every TV carries Elista's 1 or 1+1 year warranty. Register it with the brand after delivery; Elista's service network handles repairs."], ["Is the TV genuine?", "Yes. Every TV is a new, sealed Elista unit with the brand warranty card, sourced directly from the manufacturer."]].map(([q, a]) => <div key={q}><strong>{q}</strong><span className="d-sub">{a}</span></div>)}
      </div>
    </section>

    <section className="d-wrap d-sec">
      <Head h="Buying guides" link="All guides" href="/buying-guide" />
      <div className="d-g3">
        <a className="d-card d-guide" href="/buying-guide"><img src={pic("img/elista/webOS-Smart-TV-55in_2.webp", 480)} alt="" loading="lazy" /><div><strong>Which TV size is right for your room?</strong><span className="d-emi">A 2-minute guide with distances for every size.</span></div></a>
        <a className="d-card d-guide" href="/buying-guide"><img src={pic("img/elista/Cloud-TV-QLED-43in_2.webp", 480)} alt="" loading="lazy" /><div><strong>QLED vs Mini-LED vs 4K LED</strong><span className="d-emi">What the names mean and which is worth paying for.</span></div></a>
        <a className="d-card d-guide" href="/buying-guide"><img src={pic("img/elista/Google-TV-Xplore-55in_2.webp", 480)} alt="" loading="lazy" /><div><strong>Google TV or webOS Hub?</strong><span className="d-emi">Apps, remotes and voice, compared side by side.</span></div></a>
      </div>
    </section>

    <section className="d-pay"><div className="d-wrap">
      <div className="d-payhead"><h2 className="d-h" style={{ fontSize: 24 }}>Pay the way you like</h2><span className="d-secure">{I.lock}Secure checkout · GST invoice on every order</span></div>
      <div className="d-g6">{[["UPI", "GPay, PhonePe, Paytm, any UPI app"], ["Cards", "Visa, Mastercard, RuPay, Amex"], ["No-cost EMI", "3 to 12 months on HDFC, ICICI, SBI, Axis, Kotak", true], ["Net banking", "All major Indian banks"], ["Cash on delivery", "Available on all TVs · pay at your door"], ["Free delivery", "On every TV, anywhere we deliver", true]].map(([t, d, gold]) => <div className="d-paybox" key={t}><strong className={gold ? "gold" : undefined}>{t}</strong><span className="d-emi">{d}</span></div>)}</div>
    </div></section>

    {cmp.length >= 2 && <a className="d-cmpbar" href={"/compare?ids=" + cmp.join(",")}>Compare {cmp.length} TVs →</a>}
  </div>;
}

// The festive banner, the design's way: a dark card, the kicker in gold, the figures from the catalogue, the owner's festive-lights
// living-room card as the picture. Also the opener of the offers page.
export function FestiveBanner({ tvs, maxOff, minEmi, money, href = "/offers", cta = "Shop festive deals" }) {
  if (!tvs || !tvs.length) return null;
  const lead = `Festive prices on QLED, 4K and Google TVs. Bank offers${minEmi ? ", No Cost EMI from " + money(minEmi) + "/month" : ""}, free delivery and cash on delivery on every TV.`;
  return <a className="d-fest" href={href} aria-label="Festive deals">
    <div className="d-festtext"><span className="d-kick gold">Festive deals</span><h2 className="d-h">Celebrate on a bigger screen.</h2><p>{lead}</p><div className="d-btns start"><span className="d-btn gold">{cta}</span><span className="d-btn ghost white">View all offers</span></div></div>
    <div className="d-festimg"><img src="/img/elista/webOS-Smart-TV-65in_2-960.webp" srcSet="/img/elista/webOS-Smart-TV-65in_2-960.webp 960w, /img/elista/webOS-Smart-TV-65in_2.webp 1500w" sizes="(max-width:760px) 100vw, 55vw" alt="" loading="lazy" width="1500" height="1500" /><span className="d-festmark">mytekkstore</span></div>
  </a>;
}
