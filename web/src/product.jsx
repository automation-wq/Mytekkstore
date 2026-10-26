// Product page: gallery, feature strip, price with EMI, swatches, stock bar, delivery pill, offers, add-on box, actions,
// pincode check, share, tabs with reviews, compare table, related rows, sticky sub-nav.
import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { useStore } from "./store.jsx";
import { api, qs, load, save, track, whenShown } from "./api.js";
import { Photo, Stars, Buy, Heart, Row, Box, Form, Ico, Icon, Qa, BankStrip } from "./components.jsx";
import { Banner } from "./banner.jsx";
import { DEFAULT_FEATURES, BANK_OFFERS, WARRANTY_QA, SPEC_GROUPS, osUrl, autoStory, aplusExtras, callouts, cutout, galleryOf, GALLERY_LABELS, life, specIcon, catSizes, catUrl, brandUrl, off, avg, starRow, etaText, emiPlans, productUrl, pic, picSet } from "./data.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const spec = (p, k) => ((p.specs || []).find(([n]) => n.toLowerCase() === k) || [])[1] || "";

// 360-degree viewer: the frames shot around the product, drag left or right (or arrow keys) to rotate. Switches on automatically
// when a product has 8 or more spin frames (set in the admin); until then the product shows its normal photo with zoom. All frames
// are preloaded so the spin is smooth, and only the current one is shown. Works with a mouse, touch and the keyboard.
function Spin({ frames, alt }) {
  const [i, setI] = useState(0), box = useRef(), drag = useRef(null);
  useEffect(() => { frames.forEach(src => { const im = new Image(); im.src = pic(src, 960); }); }, [frames]);
  const rotate = x => { const d = drag.current; if (!d || !box.current) return; const step = Math.max(6, (box.current.clientWidth || 320) / frames.length); const n = Math.round((x - d.x) / step); setI(((d.i - n) % frames.length + frames.length) % frames.length); };
  const down = e => { drag.current = { x: e.clientX, i }; try { box.current.setPointerCapture(e.pointerId); } catch {} };
  const move = e => { if (drag.current) { e.preventDefault(); rotate(e.clientX); } };
  const up = e => { drag.current = null; try { box.current.releasePointerCapture(e.pointerId); } catch {} };
  const key = e => { if (e.key === "ArrowRight") { e.preventDefault(); setI(x => (x + 1) % frames.length); } if (e.key === "ArrowLeft") { e.preventDefault(); setI(x => (x - 1 + frames.length) % frames.length); } };
  return <div className="spin360 img" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onKeyDown={key} tabIndex={0} role="img" aria-label={alt + " — 360° view, drag to rotate"} style={{ touchAction: "pan-y" }}>
    {frames.map((src, k) => <img key={src + k} src={pic(src, 960)} alt="" width="800" height="800" draggable="false" loading={k ? "lazy" : "eager"} style={{ opacity: k === i ? 1 : 0 }} />)}
    <span className="spinbadge">360°</span><span className="spinhint" aria-hidden="true">Drag to rotate</span>
  </div>;
}
const INK = { type: "spring", stiffness: 420, damping: 34 }; // the marker that slides between tabs (Motion layoutId)

export function Product() {
  const { P, byId, money, qtyOf, setQty, recent, addRecent, updateProduct, toast, openCart, me, banners } = useStore();
  const p = byId(qs.get("id"));
  const hero = p ? banners.find(b => b.slot === "product:" + p.id) : null; // the product's own animated banner, when the admin made one
  const [tab, setTab] = useState("t-desc");
  const [img, setImg] = useState(p ? p.img : "");
  const [spinView, setSpinView] = useState(() => !!(p && p.spin && p.spin.length >= 8)); // the 360° viewer shows first when a product has frames
  const [pinMsg, setPinMsg] = useState("");
  const [seen] = useState(() => recent.filter(id => !p || id !== p.id));
  const [checked, setChecked] = useState(null);
  const [subOn, setSubOn] = useState(false), [spySec, setSpySec] = useState("overview");
  const zoomRef = useRef(), pinRef = useRef(), fullRef = useRef(), touch = useRef(null);

  const pinCheck = async () => {
    const v = pinRef.current.pin.value.trim();
    if (!/^\d{6}$/.test(v)) { setPinMsg(v ? "Please enter a 6-digit pincode." : ""); return; }
    save("pin", v);
    setPinMsg("Checking…");
    let place = "";
    try { const d = await api("pincode/" + v); if (d.district) place = `, ${d.district}, ${d.state}`; }
    catch (e) { if (/find/.test(e.message)) { setPinMsg(e.message); return; } } // service down: the standard promise still shows
    setPinMsg({ pin: v + place });
  };
  useEffect(() => {
    if (!p) return;
    document.title = `${p.brand} ${p.name} | Mytekkstore`;
    whenShown(() => addRecent(p.id));
    track("view_item", { id: p.id, name: p.brand + " " + p.name, price: p.price });
    if (pinRef.current.pin.value) pinCheck();
    // the sub-nav appears once the main Add to cart button has scrolled out of view, and marks the section in view
    const io = new IntersectionObserver(([e]) => setSubOn(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe($(".pdp .actions"));
    const spy = () => { const y = $("#hdr").offsetHeight + 90; let cur = "overview"; ["overview", "tabs", "compare"].forEach(id => { const x = document.getElementById(id); if (x && x.getBoundingClientRect().top <= y) cur = id; }); setSpySec(cur); };
    addEventListener("scroll", spy, { passive: true });
    return () => { io.disconnect(); removeEventListener("scroll", spy); };
  }, []);
  if (!p) return <Box title="Product not found" text="This product does not exist." href="/" cta="Back to home" />;

  const stock = p.stock <= 0 ? <span className="stock out">Out of stock</span> : p.stock <= 5 ? <span className="stock low">Only {p.stock} left</span> : <span className="stock">In stock</span>;
  // the Specifications tab, grouped (Display, Sound, ...); warranty comes from the product's own specifications
  const groups = [["General", [["Brand", p.brand], ["Category", p.cat]]], ...SPEC_GROUPS.map(([g, re]) => [g, [], re])];
  (p.specs || []).forEach(([k, v]) => (groups.find(([, , re]) => re && re.test(k)) || groups[0])[1].push([k, v]));
  if (p.os) groups[0][1].unshift(["Operating system", p.os]);
  groups[0][1].push(["Sold by", "Mytekkstore"]);
  const feats = (p.specs || []).slice(0, 6); // feature strip under the photo, from the product's own specifications
  const images = galleryOf(p); // the admin's photos, or the six-picture gallery built from the render (data.js galleryOf)
  const BR_LABELS = [[/-room\./, "In the living room"], [/magic-remote-guide/, "Magic Remote guide"], [/magic-remote/, "Magic Remote"], [/-tv\./, "Product picture"]]; // the brochure pictures by name
  const labelOf = src => /^img\/br\//.test(src) ? (BR_LABELS.find(([re]) => re.test(src)) || [0, "From the brochure"])[1] : GALLERY_LABELS[images.indexOf(src)] || "Photo";
  const step = d => { const i = images.indexOf(img); setSpinView(false); setImg(images[(i + d + images.length) % images.length]); };
  const swipeStart = e => { touch.current = e.touches[0].clientX; };
  const swipeEnd = e => { const x = touch.current; touch.current = null; if (x === null) return; const dx = e.changedTouches[0].clientX - x; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); };
  const resName = (/4K/i.test(spec(p, "resolution")) ? "4K Ultra HD" : /Full HD/i.test(spec(p, "resolution")) ? "Full HD" : /HD/i.test(spec(p, "resolution")) ? "HD Ready" : "");
  const spin = p.spin && p.spin.length >= 8 ? p.spin : null; // 360° frames turn the viewer on; otherwise the normal photo + zoom
  const story = p.story && p.story.length ? p.story : autoStory(p); // A+ content: the admin's blocks, or blocks built from the specifications
  const x = aplusExtras(p); // the detail modules under the story: at a glance, apps, ports, the right size, peace of mind
  const inch = +((/\((\d+) inch\)/.exec(p.name) || [])[1] || 0); // A+ hero headline varies by screen size so it never reads templated
  const aheroTitle = inch >= 55 ? "The big screen, done right." : inch >= 43 ? "Made for the way you watch." : "Smart entertainment, made simple.";
  // the banner line is built from this TV's own specifications: picture, sound, system, then the store's three promises
  const aheroLead = [p.brand + (spec(p, "screen size") ? " " + spec(p, "screen size") : "") + ": " + (resName || "a clear") + " picture", spec(p, "sound output") ? spec(p, "sound output") + " sound" : "", p.os ? p.os + " with your apps built in" : ""].filter(Boolean).join(", ") + ". Free delivery, cash on delivery and the brand's own warranty.";
  const save$ = p.mrp > p.price;
  const share = encodeURIComponent(location.href), shareText = encodeURIComponent(p.brand + " " + p.name + " at Mytekkstore");
  // the other sizes of this kind of product (TVs by inch, washing machines by kg, ACs by ton): same brand first, else any brand
  const { S, sizeOf, all } = catSizes(P, p.cat), mine = sizeOf(p);
  const sizes = all.length > 1 ? [...all].sort((a, b) => a.n - b.n).map(s => {
    const same = P.filter(x => x.cat === p.cat && (sizeOf(x) || {}).label === s.label);
    return { s, t: same.find(x => x.brand === p.brand) || same[0], on: !!mine && mine.label === s.label };
  }) : [];
  // add-on box: one in-stock product from each other category, same brand first, biggest discount first
  const picks = P.filter(x => x.cat !== p.cat && x.stock > 0).sort((a, b) => (b.brand === p.brand) - (a.brand === p.brand) || off(b) - off(a))
    .filter((x, i, arr) => arr.findIndex(y => y.cat === x.cat) === i).slice(0, 2);
  const ticked = checked === null ? picks.map(x => x.id) : checked;
  const pickedList = picks.filter(x => ticked.includes(x.id));
  const addAll = () => { [p, ...pickedList].forEach(x => setQty(x.id, qtyOf(x.id) + 1)); track("add_to_cart", { id: p.id, with: pickedList.map(x => x.id) }); openCart(); };
  const onTab = e => { const b = e.target.closest("[data-tab]"); if (b) setTab(b.dataset.tab); };
  const shareLink = async () => { try { if (navigator.share) await navigator.share({ title: document.title, url: location.href }); else { await navigator.clipboard.writeText(location.href); toast("Link copied"); } } catch {} };
  const zoomMove = e => { const r = zoomRef.current.getBoundingClientRect(); $("img", zoomRef.current).style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%"; };
  const review = async f => { const { product } = await api(`products/${p.id}/reviews`, "POST", { rating: +f.rating, text: f.text }); updateProduct(product); setTab("t-rev"); toast("Thank you for your review"); };
  const askQ = async f => { const { product } = await api(`products/${p.id}/questions`, "POST", { text: f.text }); updateProduct(product); toast("Question posted"); };
  const answerQ = qid => async f => { const { product } = await api(`products/${p.id}/questions/${qid}/answers`, "POST", { text: f.text }); updateProduct(product); toast("Answer posted"); };

  return <div onClick={onTab}>
    <div className="crumbs"><a href="/">Home</a> › <a href={catUrl(p.cat)}>{p.cat}</a> › {p.name}</div>
    {hero && <Banner b={hero} product={p} eager className="phero" />}
    <nav className={"subnav" + (subOn ? " on" : "")} aria-label="Product sections"><div><b>{p.brand} {p.name}</b>
      <div className="stabs">{[["#overview", "Overview", "overview", "t-specs0"], ["#tabs", "Specs", "tabs", "t-specs"], ["#compare", "Compare", "compare"], ["#tabs", "Reviews", "tabs2", "t-rev"]].map(([h, t, key, dt], i) =>
        <a href={h} className={key === spySec ? "on" : undefined} data-tab={dt && dt !== "t-specs0" ? dt : undefined} key={i}>{t}{key === spySec && <m.i className="ink" layoutId="stab-ink" transition={INK} />}</a>)}</div>
      <span className="sprice">{money(p.price)}</span><Buy p={p} />{p.stock > 0 && <button className="btn ghost sbuy" data-buy={p.id}>Buy now</button>}<Heart p={p} /></div></nav>
    <div className="pdp" id="overview">
      <div className="gallery">{spin && spinView
          ? <Spin frames={spin} alt={p.brand + " " + p.name} />
          : <div className="img zoom" ref={zoomRef} onMouseMove={zoomMove} onTouchStart={swipeStart} onTouchEnd={swipeEnd}><AnimatePresence initial={false} mode="popLayout"><m.img key={img} src={pic(img)} srcSet={picSet(img)} sizes="(max-width:860px) 100vw, 50vw" alt={p.brand + " " + p.name + " — " + labelOf(img)} width="800" height="800" fetchPriority="high" initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: .3 }} /></AnimatePresence>{save$ && <span className="badge">{off(p)}% OFF</span>}<button type="button" className="fsbtn" aria-label="View full screen" onClick={() => fullRef.current.showModal()}><Icon k="expand" /></button></div>}
        {images.length > 1 && <div className="gdots" aria-hidden="true">{images.map(s => <i className={!spinView && s === img ? "on" : undefined} key={s}></i>)}</div>}
        <dialog className="full" ref={fullRef} onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }} aria-label={p.brand + " " + p.name + " photos"}><button type="button" className="x" onClick={() => fullRef.current.close()} aria-label="Close">×</button><img src={pic(img)} alt={labelOf(img)} /><div className="fnav"><button type="button" onClick={() => step(-1)} aria-label="Previous photo">‹</button><span>{labelOf(img)} · {images.indexOf(img) + 1} / {images.length}</span><button type="button" onClick={() => step(1)} aria-label="Next photo">›</button></div></dialog>
        {(spin || images.length > 1) && <div className="thumbs">{spin && <button className={"thumb spin" + (spinView ? " on" : "")} aria-label="360 degree view" onClick={() => setSpinView(true)}><img src={pic(spin[0], 480)} alt="" loading="lazy" width="800" height="800" /><span>360°</span></button>}{images.map((src, i) => <button className={"thumb" + (!spinView && src === img ? " on" : "")} data-img={src} aria-label={labelOf(src)} title={GALLERY_LABELS[i] || undefined} onClick={() => { setSpinView(false); setImg(src); }} key={src}><img src={pic(src, 480)} alt="" loading="lazy" width="800" height="800" /></button>)}</div>}
        <p className="muted hint">{spin && spinView ? "Drag the product to rotate it" : "Move the pointer over the photo to zoom in, tap to view full screen"}</p></div>
      <div className="pinfo">
        <a className="pbrand" href={brandUrl(p.brand)}>{p.brand}</a>{p.os && <a className="ostag" href={osUrl(p.os)}>{p.os}</a>}
        <h1>{p.brand} {p.name}</h1>
        <p className="rating"><Stars p={p} />{!(p.reviews || []).length && <span className="muted" style={{ fontSize: 13 }}>No reviews yet</span>} <a className="alink" href="#t-rev" data-tab="t-rev" style={{ fontSize: 13 }}>See reviews</a></p>
        <div className="price"><b>{money(p.price)}</b>{save$ && <><s>{money(p.mrp)}</s><span className="badge">{off(p)}% OFF</span></>}</div>
        <p className="muted" style={{ fontSize: 13 }}>Inclusive of all taxes{save$ ? ` · You save ${money(p.mrp - p.price)}` : ""}</p>
        {p.emi && <><p className="emiline">From <b>{money(Math.ceil(p.price / 9))}/month</b> with No Cost EMI over 9 months · <a className="alink" href="/offers">See offers</a></p>
          <details className="emiplans"><summary>View EMI plans</summary><table className="specs"><tbody>{emiPlans(p.price).map(([n, m]) => <tr key={n}><th>{n} months</th><td><b>{money(m)}</b>/month · {money(0)} interest · {money(p.price)} in total</td></tr>)}</tbody></table>
            <p className="muted">On participating bank credit cards, subject to the bank's terms. <a className="alink" href="/offers">See all offers</a></p></details></>}
        <div className="pofs"><b>Offers</b>{BANK_OFFERS.slice(0, 3).map(([bank, big, note, c]) => <div style={{ "--bc": c }} key={bank}><b>{big}</b><span>{note}</span></div>)}<a href="/offers">See all offers →</a></div>
        <p style={{ marginTop: 12 }}>{stock} <span className="muted" style={{ fontSize: 13 }}>· Sold by Mytekkstore</span></p>
        {p.stock > 0 && p.stock <= 10 && <div className="stockbar"><span>Hurry, only {p.stock} left in stock</span><i><b style={{ width: p.stock * 10 + "%" }}></b></i></div>}
        {sizes.length > 0 && <div className="sizes"><span>{S.by}</span>{sizes.map(({ s, t, on }) => <a className={"chip sw" + (on ? " on" : "")} href={productUrl(t)} aria-current={on ? "page" : undefined} key={s.label}><b>{s.label.replace(/ TVs$/, "")}</b><small>{money(t.price)}</small></a>)}</div>}
        {feats.length > 0 && <div className="fstrip"><b className="fhead">Key specifications</b>{feats.map(([k, v]) => <div className="ft" key={k}><Ico shapes={specIcon(k)} /><span><small>{k}</small><b>{v}</b></span></div>)}<a className="alink" href="#tabs" data-tab="t-specs">All specifications →</a></div>}
        <div className="pill"><i></i><b>Free delivery</b> · usually by {etaText()} · cash on delivery available</div>
        <form className="pin" id="pincheck" noValidate ref={pinRef} onSubmit={e => { e.preventDefault(); pinCheck(); }}><label>Deliver to <input name="pin" inputMode="numeric" maxLength="6" placeholder="Enter pincode" defaultValue={(me && me.pin) || load("pin", "")} aria-label="Pincode" /></label><button className="btn ghost">Check</button>
          <p id="pinmsg" className="muted" role="status">{typeof pinMsg === "string" ? pinMsg : <><b>Delivery available</b> to {pinMsg.pin} · usually by {etaText()} · cash on delivery available</>}</p></form>
        {picks.length > 0 && <div className="bundle"><b>Complete your home</b><p className="muted small">Pair it with these and add everything in one go.</p>
          <label className="brow main"><input type="checkbox" checked disabled readOnly /><img src={pic(p.img, 480)} alt="" width="800" height="800" /><span><small>This product</small>{p.name}</span><b>{money(p.price)}</b></label>
          {picks.map(x => <label className="brow" key={x.id}><input type="checkbox" name="pick" value={x.id} checked={ticked.includes(x.id)} onChange={e => setChecked(e.target.checked ? [...ticked, x.id] : ticked.filter(i => i !== x.id))} /><img src={pic(x.img, 480)} alt="" width="800" height="800" /><span><small>{x.brand} · {x.cat}</small><a href={productUrl(x)}>{x.name}</a></span><b>{money(x.price)}</b></label>)}
          <div className="btot"><span>Total for <i>{pickedList.length + 1}</i> items</span><b>{money(p.price + pickedList.reduce((t, x) => t + x.price, 0))}</b><button className="btn" id="addAll" type="button" onClick={addAll}>Add all to cart</button></div></div>}
        <div className="actions"><b className="aprice">{money(p.price)}</b><Buy p={p} />{p.stock > 0 && <button className="btn ghost" data-buy={p.id}>Buy now</button>}<Heart p={p} /></div>
        <div className="perks"><span><Icon k="truck" /> Free delivery</span><span><Icon k="shield" /> Brand warranty</span><span><Icon k="undo" /> Easy returns</span><span><Icon k="check" /> Genuine product</span></div>
        <details className="qbox"><summary><Icon k="shield" /> Warranty, returns and replacement</summary><div>{WARRANTY_QA.slice(0, 3).map(([q, a]) => <p key={q}><b>{q}</b><br />{a}</p>)}<a className="alink" href="#warranty">All warranty and return questions →</a></div></details>
        <div className="sharerow"><span>Share:</span><a href={`https://wa.me/?text=${shareText}%20${share}`} target="_blank" rel="noopener">WhatsApp</a><a href={`https://www.facebook.com/sharer/sharer.php?u=${share}`} target="_blank" rel="noopener">Facebook</a><a href={`https://twitter.com/intent/tweet?url=${share}&text=${shareText}`} target="_blank" rel="noopener">X</a><button className="link" id="share" type="button" onClick={shareLink}>Copy link</button></div>
      </div>
    </div>
    {story.length > 0 && <section className="aplus" id="aplus">
      {me && me.admin && <p className="adminlink"><a href={"/admin?edit=" + p.id}>Edit this product in the admin (photos, A+ creatives, specifications) →</a></p>}
      <div className="ahero"><img src={pic(life("aplusHero", "img/hero0.jpg"), 960)} srcSet={picSet(life("aplusHero", "img/hero0.jpg"))} sizes="(max-width:1240px) 100vw, 1240px" alt="" loading="lazy" /><div className="atext"><span className="kicker">{p.brand}{spec(p, "screen size") ? " · " + spec(p, "screen size") : ""}</span><h2>{aheroTitle}</h2><p>{aheroLead}</p>
        <div className="astats">{callouts(p).map(([big, small]) => <div key={big + small}><b>{big}</b><small>{small}</small></div>)}</div></div></div>
      {(p.aplus || []).length > 0 && <div className="acreatives">{p.aplus.map(src => <img src={pic(src)} alt="" loading="lazy" key={src} />)}</div>}
      <div className="showcase">{cutout(p.img) ? <img className="cut" src={cutout(p.img)} alt="" loading="lazy" /> : <img className="tilep" src={pic(p.img)} srcSet={picSet(p.img)} sizes="(max-width:860px) 80vw, 40vw" alt="" loading="lazy" width="800" height="800" />}
        <div><span className="kicker">{story[0].kicker}</span><h2>{story[0].title}.</h2><p>{story[0].text}</p>{p.features && p.features.length > 0 && <ul className="afeat" aria-label="Highlights from the brand's brochure">{p.features.map(f => <li key={f}>{f}</li>)}</ul>}</div></div>
      {story.slice(1).map((b, i) => <div className={"ablock" + (i % 2 ? " flip" : "") + (i === 1 ? " dark" : "")} key={i}>{b.img && (cutout(b.img) ? <img className="cut" src={cutout(b.img)} alt="" loading="lazy" /> : <img src={pic(b.img, 960)} srcSet={picSet(b.img)} sizes="(max-width:860px) 100vw, 50vw" alt="" loading="lazy" />)}<div>{b.kicker && <span className="kicker">{b.kicker}</span>}<h3>{b.title}</h3><p>{b.text}</p>{b.kicker === "Smart" && x.apps.length > 0 && <div className="aapps">{x.apps.map(a => <span key={a}>{a}</span>)}</div>}</div></div>)}
      {x.ports.length > 0 && <div className="ablock aports dark flip"><div className="portbay" aria-hidden="true">{x.ports.map(([k, n]) => <div key={k}><span className="pname">{k}</span>{Array.from({ length: n }, (_, i) => <i key={i} className={"port " + k.toLowerCase()}></i>)}</div>)}</div><div><span className="kicker">Connectivity</span><h3>Plug in everything.</h3><p>{x.portsText} at the back: a set-top box, a game console or a laptop on HDMI, and a pen drive or hard disk on USB for your own films and photos.</p></div></div>}
      {x.room && <div className="ablock aroom"><div className="roomfig" aria-hidden="true"><i className="tvline"><b>{x.room.inch + "\""}</b></i><span className="dist">{x.room.dist}</span><i className="sofa"></i></div><div><span className="kicker">The right size</span><h3>Made for {x.room.note}.</h3><p>Sit about {x.room.dist} from a {x.room.inch} inch screen: close enough to see the detail, far enough that the picture stays smooth. When in doubt, go one size up.</p></div></div>}
      <div className="ablock acare">{p.brand === "Elista" && <figure className="afactory"><img src="/img/br/factory.webp" alt="" loading="lazy" width="860" height="245" /><figcaption>Made at Elista's Smart TV plant, Kopparthy, Andhra Pradesh</figcaption></figure>}<div><span className="kicker">Peace of mind</span><h3>Covered, delivered, returnable.</h3><p>Every order comes with the store's promises and the brand's warranty.</p></div><ul>{x.care.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul></div>
    </section>}
    <section id="tabs">
      <div className="tabbar">{[["t-desc", "Description"], ["t-specs", "Specifications"], ["t-del", "Delivery and returns"], ["t-rev", "Reviews (" + (p.reviews || []).length + ")"]].map(([id, label]) => <button className={tab === id ? "on" : undefined} data-tab={id} key={id}>{label}{tab === id && <m.i className="ink" layoutId="tab-ink" transition={INK} />}</button>)}</div>
      <div className="tabpane" id="t-desc" hidden={tab !== "t-desc"}><p>{p.desc || p.brand + " " + p.name}</p><ul>{DEFAULT_FEATURES.map(f => <li key={f}>{f}</li>)}</ul></div>
      <div className="tabpane" id="t-specs" hidden={tab !== "t-specs"}><table className="specs">{groups.filter(([, rows]) => rows.length).map(([g, rows]) => <tbody key={g}><tr className="grp"><th colSpan="2">{g}</th></tr>{rows.map(([k, v], i) => <tr key={i}><th>{k}</th><td>{v}</td></tr>)}</tbody>)}</table></div>
      <div className="tabpane" id="t-rev" hidden={tab !== "t-rev"}>
        {(p.reviews || []).length ? <><div className="rsum"><b>{avg(p).toFixed(1)}</b><div><span className="stars"><span>{starRow(Math.round(avg(p)))}</span></span><br /><small className="muted">{p.reviews.length} review{p.reviews.length > 1 ? "s" : ""}</small></div>
          <div className="rbars">{[5, 4, 3, 2, 1].map(n => { const c = p.reviews.filter(r => r.rating === n).length; return <div key={n}><span>{n}★</span><i><b style={{ width: Math.round(c / p.reviews.length * 100) + "%" }}></b></i><small>{c}</small></div>; })}</div></div>
          {[...p.reviews].reverse().map((r, i) => <div className="rev" key={i}><div className="stars"><span>{starRow(r.rating)}</span></div><b>{r.name}</b> <small className="muted">· {new Date(r.at).toLocaleDateString()}</small><p>{r.text}</p></div>)}</>
          : <p>No reviews yet. Be the first to review this product.</p>}
        {me ? <Form className="form rform" id="rform" onSubmit={review} after={busy => <button className="btn" disabled={busy}>Submit review</button>}><h3>Write a review</h3>
          <label>Rating<select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map(n => <option value={n} key={n}>{starRow(n)} {n}</option>)}</select></label>
          <label>Your review<textarea name="text" rows="3" required maxLength="500" placeholder="What did you like or dislike?"></textarea></label></Form>
          : <p style={{ marginTop: 16 }}><a className="alink" href={"/account?next=" + encodeURIComponent(productUrl(p))}>Sign in</a> to write a review.</p>}
      </div>
      <div className="tabpane" id="t-del" hidden={tab !== "t-del"}><ul><li>Free delivery on this product, usually by {etaText()} when you order today.</li><li>Check delivery to your area with the pincode box above.</li><li>Pay by cash on delivery.</li><li>See <a className="alink" href="/shipping">Shipping</a> and <a className="alink" href="/returns">Returns</a> for the full policy.</li></ul></div>
    </section>
    <Compare p={p} />
    <Qa id="warranty" title="Warranty and returns" lead="How a claim works, and what happens if something is wrong with your TV." list={WARRANTY_QA} />
    <section className="qna" id="qna"><h2>Questions and answers</h2><p className="lead">Ask about this TV, or help another shopper with what you know.</p>
      {me ? <Form className="form qform" onSubmit={askQ} after={busy => <button className="btn" disabled={busy}>Ask question</button>}><label>Your question<input name="text" required maxLength="300" placeholder="e.g. Does it support Netflix in 4K?" /></label></Form>
        : <p style={{ marginTop: 12 }}><a className="alink" href={"/account?next=" + encodeURIComponent(productUrl(p))}>Sign in</a> to ask a question.</p>}
      {(p.questions || []).length > 0 ? <div className="qnalist">{p.questions.map(q => <div className="qitem" key={q.id}>
        <p className="qq"><b>Q</b><span>{q.text} <small className="muted">— {q.name}</small></span></p>
        {q.answers.map((a, i) => <p className="qa" key={i}><b>A</b><span>{a.text} <small className="muted">— {a.name}</small></span></p>)}
        {me && <Form className="form qansf" onSubmit={answerQ(q.id)} after={busy => <button className="link" disabled={busy}>Post answer</button>}><input name="text" required maxLength="300" placeholder="Answer this question" aria-label="Your answer" /></Form>}
      </div>)}</div> : <p className="muted" style={{ marginTop: 10 }}>No questions yet. Be the first to ask.</p>}
    </section>
    <Row title={"More in " + p.cat} href={catUrl(p.cat)} list={P.filter(x => x.cat === p.cat && x.id !== p.id)} />
    <Row title="Recently viewed" href="" list={seen.map(byId).filter(Boolean)} />
  </div>;
}

// side-by-side comparison of a product with up to three others of its kind: same brand first, then the closest prices.
// Rows come from the products' own specifications; a row whose values differ is marked, and the cheapest column gets a chip.
function Compare({ p }) {
  const { P, money } = useStore();
  const others = P.filter(x => x.cat === p.cat && x.id !== p.id)
    .sort((a, b) => (b.brand === p.brand) - (a.brand === p.brand) || Math.abs(a.price - p.price) - Math.abs(b.price - p.price)).slice(0, 3);
  if (!others.length) return null;
  const cols = [p, ...others], cheapest = Math.min(...cols.map(x => x.price));
  const keys = [...new Set(cols.flatMap(x => (x.specs || []).map(([k]) => k)))];
  const specOf = (x, k) => ((x.specs || []).find(([n]) => n === k) || [])[1] || "";
  // a missing value says what it means: a smart feature on a non-smart set is "Not a smart TV"; anything else the brand's sheet does not state is "Not listed"
  const SMART = /^(Smart TV|Voice|Wi-Fi|Apps|Memory|Bluetooth|Screen mirroring|Remote|Processor|Screen share)$/;
  const missing = (x, k) => SMART.test(k) && !x.os ? <span className="na">Not a smart TV</span> : <span className="na">Not listed</span>;
  const line = (label, f, cls) => <tr className={cls || undefined} key={label}><th>{label}</th>{cols.map((x, i) => <td className={i ? undefined : "me"} key={x.id}>{f(x)}</td>)}</tr>;
  return <section className="cmp" id="compare"><h2>Compare with similar {p.cat.toLowerCase()}</h2>
    <p className="muted small">Rows marked with a dot are where these models differ.</p>
    <div className="scroll"><table className="ctable">
      <thead><tr><th></th>{cols.map((x, i) => <th className={i ? undefined : "me"} key={x.id}><a href={productUrl(x)}><span className="cimg"><Photo p={x} sizes="120px" /></span><small>{x.brand}</small><b>{x.name}</b></a>{!i && <span className="stock">This product</span>}</th>)}</tr></thead>
      <tbody>
        {line("Price", x => <><b className="cprice">{money(x.price)}</b>{x.mrp > x.price && <><s>{money(x.mrp)}</s><span className="badge">{off(x)}% OFF</span></>}{x.price === cheapest && <><br /><span className="stock">Lowest price</span></>}</>)}
        {line("Rating", x => <Stars p={x} /> && (x.reviews && x.reviews.length ? <Stars p={x} /> : <span className="muted">No reviews yet</span>))}
        {cols.some(x => x.os) && line("Operating system", x => x.os || <span className="na">Non-smart</span>, new Set(cols.map(x => x.os || "")).size > 1 ? "diff" : "")}
        {keys.map(k => line(k, x => specOf(x, k) || missing(x, k), new Set(cols.map(x => specOf(x, k))).size > 1 ? "diff" : ""))}
        {line("No Cost EMI", x => x.emi ? <><Icon k="check" /> Available</> : <span className="na">Not on this model</span>)}
        {line("", x => <Buy p={x} />)}
      </tbody></table></div></section>;
}
