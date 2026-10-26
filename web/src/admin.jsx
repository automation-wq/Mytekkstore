// Store admin: orders, products (with photo upload and the No Cost EMI flag), customer messages. The server checks admin rights on every request.
import { pic, TV_OS } from "./data.js";
import { PRESETS, TONES, FOCUS } from "./banner.jsx";
import { useEffect, useState } from "react";
import { useStore } from "./store.jsx";
import { api, qs } from "./api.js";
import { Form, Box } from "./components.jsx";
import { reveal } from "./motion.js";

const ALL = ["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"];
const EMPTY = { id: "", brand: "", cat: "", name: "", price: "", mrp: "", stock: 10, img: "", desc: "", specs: "", emi: false, images: "", os: "", story: "", spin: "", aplus: "" };
const EMPTY_B = { id: "", slot: "home", order: 1, preset: "cinematic", kicker: "", title: "", text: "", cta: "", href: "", cta2: "", href2: "", img: "", imgMobile: "", focus: "center", align: "left", badge: "", tone: "photo", productId: "", brand: "", until: "", live: true };
const EMPTY_C = { id: "", slug: "", title: "", lead: "", theme: "light", productIds: "", features: "", faq: "", seoTitle: "", seoDesc: "", offers: true, sample: false, live: true };
const split = (s, n) => s.split("\n").map(l => l.split("|").map(x => x.trim())).filter(parts => parts.slice(0, n).every(Boolean)); // "a | b | c" lines

export function Admin() {
  const { me, CFG, money, CATS, BRANDS, toast } = useStore();
  const [orders, setOrders] = useState([]), [products, setProducts] = useState([]), [outbox, setOutbox] = useState([]);
  const [f, setF] = useState(EMPTY), [sure, setSure] = useState(null), [ready, setReady] = useState(false);
  const [banners, setBanners] = useState([]), [campaigns, setCampaigns] = useState([]), [bf, setBf] = useState(EMPTY_B), [cf, setCf] = useState(EMPTY_C), [creative, setCreative] = useState(null);
  const allowed = !!(me && me.admin);
  const draw = async () => {
    setOrders((await api("admin/orders")).orders); setProducts((await api("products?all=1")).products); // the admin also sees the hidden categories
    setOutbox((await api("admin/outbox")).messages);
    setBanners((await api("banners?all=1")).banners); setCampaigns((await api("campaigns?all=1")).campaigns);
    api("creative/status").then(setCreative).catch(() => setCreative({ connected: false, how: "" }));
    setF(EMPTY); setReady(true);
  };
  useEffect(() => { document.title = "Store admin | Mytekkstore"; if (allowed) draw(); }, []);
  useEffect(() => { if (ready) reveal(); }, [ready]);
  useEffect(() => { if (!ready) return; const id = qs.get("edit"), p = id && products.find(x => String(x.id) === id); if (p) { edit(p); setTimeout(() => { const f = document.querySelector("form"); if (f) f.scrollIntoView({ block: "start" }); }, 50); } }, [ready]); // /admin?edit=<id>: straight to that product (the Edit in admin link on its page)
  if (!allowed) return <Box title="Admins only" text="Sign in with the store admin account to manage products and orders." href="/account?next=/admin" cta="Sign in" />;
  if (!ready) return null;
  const live = orders.filter(o => o.status !== "Cancelled");
  const set = k => e => setF(x => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const saveProduct = async () => {
    const body = { brand: f.brand, cat: f.cat, name: f.name, price: +f.price, mrp: +f.mrp, stock: +f.stock, img: f.img, desc: f.desc, emi: !!f.emi, images: f.images.split("\n").map(s => s.trim()).filter(Boolean), aplus: f.aplus.split("\n").map(s => s.trim()).filter(Boolean), spin: f.spin.split("\n").map(s => s.trim()).filter(Boolean), os: f.os.trim(),
      story: f.story.split("\n").map(l => l.split("|").map(x => x.trim())).filter(([t, x]) => t && x).map(([title, text, img]) => ({ title, text, img: img || "" })),
      specs: f.specs.split("\n").map(l => l.split(/:(.*)/s).slice(0, 2).map(x => x.trim())).filter(([k, v]) => k && v) };
    await (f.id ? api("admin/products/" + f.id, "PUT", body) : api("admin/products", "POST", body));
    toast(f.id ? "Product updated" : "Product added");
    await draw();
  };
  const edit = p => { setF({ id: p.id, brand: p.brand, cat: p.cat, name: p.name, price: p.price, mrp: p.mrp, stock: p.stock, img: p.img, desc: p.desc || "", specs: (p.specs || []).map(([k, v]) => k + ": " + v).join("\n"), emi: !!p.emi, images: (p.images || []).join("\n"), aplus: (p.aplus || []).join("\n"), spin: (p.spin || []).join("\n"), os: p.os || "", story: (p.story || []).map(b => [b.title, b.text, b.img].filter(Boolean).join(" | ")).join("\n") }); document.getElementById("pform").scrollIntoView({ behavior: "smooth", block: "center" }); };
  const del = async p => { // two clicks to delete instead of a pop-up
    if (sure !== p.id) { setSure(p.id); setTimeout(() => setSure(s => s === p.id ? null : s), 3000); return; }
    try { await api("admin/products/" + p.id, "DELETE"); toast("Product deleted"); } catch (ex) { toast(ex.message); }
    draw();
  };
  // banners and campaigns: the same shape as the product form (edit fills the form, delete takes two clicks)
  const setB = k => e => setBf(x => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setC = k => e => setCf(x => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const saveBanner = async () => {
    const body = { ...bf, order: +bf.order || 1, productId: +bf.productId || 0, live: !!bf.live }; delete body.id;
    await (bf.id ? api("admin/banners/" + bf.id, "PUT", body) : api("admin/banners", "POST", body));
    toast(bf.id ? "Banner updated" : "Banner added"); await draw();
  };
  const editB = b => { setBf({ ...EMPTY_B, ...b, productId: b.productId || "" }); document.getElementById("bform").scrollIntoView({ behavior: "smooth", block: "center" }); };
  const saveCampaign = async () => {
    const body = { slug: cf.slug.trim(), title: cf.title, lead: cf.lead, theme: cf.theme, productIds: cf.productIds.split(",").map(s => +s.trim()).filter(Boolean), features: split(cf.features, 2).map(([title, text, img]) => ({ title, text, img: img || "" })), faq: split(cf.faq, 2).map(([q, a]) => [q, a]), offers: !!cf.offers, seo: { title: cf.seoTitle, desc: cf.seoDesc }, sample: !!cf.sample, live: !!cf.live };
    await (cf.id ? api("admin/campaigns/" + cf.id, "PUT", body) : api("admin/campaigns", "POST", body));
    toast(cf.id ? "Campaign updated" : "Campaign added"); await draw();
  };
  const editC = c => { setCf({ id: c.id, slug: c.slug, title: c.title, lead: c.lead || "", theme: c.theme, productIds: c.productIds.join(", "), features: c.features.map(f => [f.title, f.text, f.img].filter(Boolean).join(" | ")).join("\n"), faq: c.faq.map(x => x.join(" | ")).join("\n"), seoTitle: (c.seo || {}).title || "", seoDesc: (c.seo || {}).desc || "", offers: !!c.offers, sample: !!c.sample, live: !!c.live }); document.getElementById("cform").scrollIntoView({ behavior: "smooth", block: "center" }); };
  const delX = async (kind, x) => { const key = kind + x.id; if (sure !== key) { setSure(key); setTimeout(() => setSure(s => s === key ? null : s), 3000); return; } try { await api("admin/" + (kind === "b" ? "banners" : "campaigns") + "/" + x.id, "DELETE"); toast(kind === "b" ? "Banner deleted" : "Campaign deleted"); } catch (ex) { toast(ex.message); } draw(); };
  // the Creative Intelligence Agent fills the banner's words from its first concept; the admin reviews, then saves
  const concept = async () => { try { const r = await api("creative/concepts", "POST", { productId: +bf.productId, slot: bf.slot, objective: "banner" }); const c = (r.concepts || [])[0]; if (!c) return toast("The creative agent returned no concept."); setBf(x => ({ ...x, kicker: c.kicker || x.kicker, title: c.headline || x.title, text: c.supporting || x.text })); toast("Concept filled in. Review it, then save."); } catch (ex) { toast(ex.message); } };
  const status = async (id, s) => { try { await api("admin/orders/" + id, "PATCH", { status: s }); toast("Order updated"); } catch (ex) { toast(ex.message); } draw(); };
  const photo = async e => { // shrink the photo in the browser to a small square-ish JPEG, then upload it
    const file = e.target.files[0]; if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 800 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      const { img } = await api("admin/upload", "POST", { data: c.toDataURL("image/jpeg", 0.82) });
      setF(x => ({ ...x, img })); toast("Photo added. Save the product to keep it.");
    } catch (ex) { toast(ex.message || "Could not read that photo."); }
  };
  return <>
    <h1 style={{ margin: "24px 0 16px" }}>Store admin</h1>
    <div className="stats">
      <div><b>{orders.length}</b>Orders</div><div><b>{money(live.reduce((t, o) => t + o.total, 0))}</b>Sales</div>
      <div><b>{products.length}</b>Products</div><div><b>{products.filter(p => p.stock <= 5).length}</b>Low or out of stock</div>
    </div>
    <section><h2>Orders</h2>{orders.length ? <div className="scroll"><table className="tbl"><tbody>
      <tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr>
      {orders.map(o => <tr key={o.id}><td><a className="alink" href={"/order?id=" + o.id}>{o.id}</a></td><td>{new Date(o.at).toLocaleString()}</td>
        <td>{o.name}<br /><span className="muted">{o.phone}<br />{o.address}, {o.pin}</span></td>
        <td>{o.items.map((i, k) => <span key={k}>{k ? <br /> : null}{i.qty} × {i.brand} {i.name}</span>)}</td><td>{money(o.total)}</td>
        <td><select data-order={o.id} aria-label={"Status of " + o.id} value={o.status} onChange={e => status(o.id, e.target.value)}>{ALL.map(s => <option value={s} key={s}>{s}</option>)}</select></td></tr>)}
    </tbody></table></div> : <p className="muted">No orders yet.</p>}</section>
    <section><h2>Products</h2>
      <Form className="pform panel" id="pform" onSubmit={saveProduct} after={busy => <div className="span2"><button className="btn" disabled={busy}>{f.id ? "Save changes" : "Add product"}</button> <button type="button" className="btn ghost" id="reset" hidden={!f.id} onClick={() => setF(EMPTY)}>Cancel edit</button></div>}>
        <input type="hidden" name="id" value={f.id} readOnly />
        <label>Brand<input name="brand" required maxLength="60" list="brands" value={f.brand} onChange={set("brand")} /></label>
        <label>Category<input name="cat" required maxLength="60" list="cats" value={f.cat} onChange={set("cat")} /></label>
        <label className="span2">Name<input name="name" required maxLength="160" value={f.name} onChange={set("name")} /></label>
        <label>Operating system (TVs: Google TV, WebOS, Android TV)<input name="os" maxLength="40" list="oss" placeholder="Google TV" value={f.os} onChange={set("os")} /></label>
        <label>Price (₹)<input name="price" type="number" required min="1" step="1" value={f.price} onChange={set("price")} /></label>
        <label>MRP (₹)<input name="mrp" type="number" required min="1" step="1" value={f.mrp} onChange={set("mrp")} /></label>
        <label>Stock<input name="stock" type="number" required min="0" step="1" value={f.stock} onChange={set("stock")} /></label>
        <label>Image (img/file.jpg or https link)<input name="img" required maxLength="300" placeholder="img/p0.jpg" value={f.img} onChange={set("img")} /></label>
        <label className="span2">Or upload a photo from this computer<input type="file" id="photo" accept="image/*" onChange={photo} /></label>
        <label className="span2">More photos for the gallery (one link per line)<textarea name="images" rows="2" placeholder={"img/p1.jpg\nhttps://..."} value={f.images} onChange={set("images")}></textarea></label>
        <label className="span2">360° spin frames (8 to 48 links, one per line, in order around the product — turns on the drag-to-rotate viewer)<textarea name="spin" rows="2" placeholder={"img/p1-360/01.jpg\nimg/p1-360/02.jpg\n…"} value={f.spin} onChange={set("spin")}></textarea></label>
        <label className="span2">Description<textarea name="desc" rows="4" maxLength="2000" value={f.desc} onChange={set("desc")}></textarea></label>
        <label className="span2">Specifications (one per line, as Name: Value)<textarea name="specs" rows="4" placeholder={"Screen size: 55 inch\nResolution: 4K Ultra HD"} value={f.specs} onChange={set("specs")}></textarea></label>
        <label className="span2">A+ content for the product page (one block per line: Title | Text | img/photo.jpg)<textarea name="story" rows="3" placeholder={"Cinema at home | A 55 inch 4K picture with Dolby Audio. | img/p1.jpg"} value={f.story} onChange={set("story")}></textarea></label>
        <label className="span2">A+ creatives (full-width images stacked down the page, the way Croma and Amazon show them: one link per line, 1000 px wide or more, uploaded with the photo button above or linked from the brand)<textarea name="aplus" rows="3" placeholder={"img/u-aplus-1.jpg\nhttps://brand.example/creative-2.png"} value={f.aplus} onChange={set("aplus")}></textarea></label>
        <label className="radio span2"><input type="checkbox" name="emi" value="1" checked={f.emi} onChange={set("emi")} /> No Cost EMI available on this product (shows the tag on the site)</label>
        <datalist id="brands">{BRANDS.map(b => <option value={b} key={b} />)}</datalist><datalist id="cats">{CATS.map(c => <option value={c} key={c} />)}</datalist><datalist id="oss">{Object.keys(TV_OS).map(o => <option value={o} key={o} />)}</datalist>
      </Form>
      <div className="scroll"><table className="tbl"><tbody>
        <tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>MRP</th><th>Stock</th><th></th></tr>
        {products.map(p => <tr key={p.id}><td><img className="thumb" src={pic(p.img, 480)} alt="" /></td><td>{p.brand} {p.name}{p.emi && <> <span className="stock">EMI</span></>}</td><td>{p.cat}</td><td>{money(p.price)}</td><td>{money(p.mrp)}</td>
          <td>{p.stock <= 5 ? <span className={"stock " + (p.stock ? "low" : "out")}>{p.stock}</span> : p.stock}</td>
          <td style={{ whiteSpace: "nowrap" }}><button className="link" data-edit={p.id} onClick={() => edit(p)}>Edit</button> · <button className="link" data-del={p.id} onClick={() => del(p)}>{sure === p.id ? "Sure?" : "Delete"}</button></td></tr>)}
      </tbody></table></div>
    </section>
    <section id="banners"><h2>Banners {creative && (creative.connected ? <span className="stock">creative agent connected</span> : <span className="stock low" title={creative.how || ""}>creative agent not connected</span>)}</h2>
      <p className="muted">Every big banner on the site: the home slides (slot home, in order), a product's own hero (product:ID), a campaign's hero (campaign:address). The preset is how it moves, the tone its colours; buttons link inside the site; a phone image and a focus point make the phone composition its own.</p>
      <Form className="pform panel" id="bform" onSubmit={saveBanner} after={busy => <div className="span2"><button className="btn" disabled={busy}>{bf.id ? "Save banner" : "Add banner"}</button> <button type="button" className="btn ghost" hidden={!bf.id} onClick={() => setBf(EMPTY_B)}>Cancel edit</button> <button type="button" className="btn ghost" disabled={!(creative && creative.connected) || !bf.productId} title={creative && creative.connected ? "Fills kicker, headline and text from the agent's first concept" : (creative && creative.how) || "Not connected"} onClick={concept}>Ask the creative agent</button></div>}>
        <label>Slot<input required list="slots" placeholder="home, product:2, campaign:festive-tv-days" value={bf.slot} onChange={setB("slot")} /></label>
        <label>Preset<select value={bf.preset} onChange={setB("preset")}>{PRESETS.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Tone<select value={bf.tone} onChange={setB("tone")}>{Object.keys(TONES).map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Order<input type="number" min="1" max="99" value={bf.order} onChange={setB("order")} /></label>
        <label>Kicker (small line above)<input maxLength="60" value={bf.kicker} onChange={setB("kicker")} /></label>
        <label className="span2">Headline (a full stop starts a new line)<input required maxLength="120" value={bf.title} onChange={setB("title")} /></label>
        <label>Badge<input maxLength="40" placeholder="New, Limited time" value={bf.badge} onChange={setB("badge")} /></label>
        <label className="span2">Text<input maxLength="300" value={bf.text} onChange={setB("text")} /></label>
        <label>Product (floats on the banner)<select value={bf.productId} onChange={setB("productId")}><option value="">none</option>{products.map(p => <option value={p.id} key={p.id}>{p.brand} {p.name}</option>)}</select></label>
        <label>Brand (a home brand slide)<input maxLength="60" list="brands" value={bf.brand} onChange={setB("brand")} /></label>
        <label>Button<input maxLength="40" value={bf.cta} onChange={setB("cta")} /></label>
        <label>Button link (/televisions or #overview)<input maxLength="300" value={bf.href} onChange={setB("href")} /></label>
        <label>Second button<input maxLength="40" value={bf.cta2} onChange={setB("cta2")} /></label>
        <label>Second button link<input maxLength="300" value={bf.href2} onChange={setB("href2")} /></label>
        <label>Desktop image (img/file.jpg)<input maxLength="300" value={bf.img} onChange={setB("img")} /></label>
        <label>Phone image<input maxLength="300" value={bf.imgMobile} onChange={setB("imgMobile")} /></label>
        <label>Image focus<select value={bf.focus} onChange={setB("focus")}>{Object.keys(FOCUS).map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Text alignment<select value={bf.align} onChange={setB("align")}><option>left</option><option>center</option></select></label>
        <label className="radio span2"><input type="checkbox" checked={bf.live} onChange={setB("live")} /> Live on the site</label>
        <datalist id="slots"><option value="home" />{products.map(p => <option value={"product:" + p.id} key={p.id}>{p.brand + " " + p.name}</option>)}{campaigns.map(c => <option value={"campaign:" + c.slug} key={c.slug} />)}</datalist>
      </Form>
      <div className="scroll"><table className="tbl"><tbody><tr><th>Slot</th><th>Headline</th><th>Preset</th><th>Tone</th><th>Live</th><th></th></tr>
        {banners.map(b => <tr key={b.id}><td>{b.slot}</td><td>{b.title}</td><td>{b.preset}</td><td>{b.tone}</td><td>{b.live ? "yes" : <span className="stock low">no</span>}</td><td style={{ whiteSpace: "nowrap" }}><button className="link" onClick={() => editB(b)}>Edit</button> · <button className="link" onClick={() => delX("b", b)}>{sure === "b" + b.id ? "Sure?" : "Delete"}</button></td></tr>)}
      </tbody></table></div>
    </section>
    <section id="campaigns"><h2>Campaign pages</h2>
      <p className="muted">A campaign is a page of its own at /campaigns/address: its words, a theme, the picks, feature blocks, the bank offers, questions and search tags. Give it a banner in the slot campaign:address for a hero of its own.</p>
      <Form className="pform panel" id="cform" onSubmit={saveCampaign} after={busy => <div className="span2"><button className="btn" disabled={busy}>{cf.id ? "Save campaign" : "Add campaign"}</button> <button type="button" className="btn ghost" hidden={!cf.id} onClick={() => setCf(EMPTY_C)}>Cancel edit</button> {cf.id && cf.live ? <a className="btn ghost" href={"/campaigns/" + cf.slug} target="_blank" rel="noopener">Open page</a> : null}</div>}>
        <label>Address (letters, digits, dashes)<input required maxLength="60" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="festive-tv-days" value={cf.slug} onChange={setC("slug")} /></label>
        <label className="span2">Title<input required maxLength="100" value={cf.title} onChange={setC("title")} /></label>
        <label>Theme<select value={cf.theme} onChange={setC("theme")}><option>light</option><option>dark</option><option>green</option><option>indigo</option></select></label>
        <label className="span2">Lead (one or two lines)<input maxLength="300" value={cf.lead} onChange={setC("lead")} /></label>
        <label className="span2">Products (ids, comma separated)<input placeholder="2, 11, 12" value={cf.productIds} onChange={setC("productIds")} /></label>
        <label className="span2">Feature blocks (one per line: Title | Text | img/photo.jpg)<textarea rows="3" value={cf.features} onChange={setC("features")}></textarea></label>
        <label className="span2">Questions (one per line: Question | Answer)<textarea rows="2" value={cf.faq} onChange={setC("faq")}></textarea></label>
        <label>Search title<input maxLength="70" value={cf.seoTitle} onChange={setC("seoTitle")} /></label>
        <label className="span2">Search description<input maxLength="160" value={cf.seoDesc} onChange={setC("seoDesc")} /></label>
        <label className="radio"><input type="checkbox" checked={cf.offers} onChange={setC("offers")} /> Show the bank offers</label>
        <label className="radio"><input type="checkbox" checked={cf.live} onChange={setC("live")} /> Live on the site</label>
      </Form>
      <div className="scroll"><table className="tbl"><tbody><tr><th>Address</th><th>Title</th><th>Theme</th><th>Products</th><th>Live</th><th></th></tr>
        {campaigns.map(c => <tr key={c.id}><td>{c.live ? <a className="alink" href={"/campaigns/" + c.slug} target="_blank" rel="noopener">{"/campaigns/" + c.slug}</a> : "/campaigns/" + c.slug}{c.sample && <> <span className="stock">sample</span></>}</td><td>{c.title}</td><td>{c.theme}</td><td>{c.productIds.length}</td><td>{c.live ? "yes" : <span className="stock low">no</span>}</td><td style={{ whiteSpace: "nowrap" }}><button className="link" onClick={() => editC(c)}>Edit</button> · <button className="link" onClick={() => delX("c", c)}>{sure === "c" + c.id ? "Sure?" : "Delete"}</button></td></tr>)}
      </tbody></table></div>
    </section>
    <section><h2>Customer messages {CFG.sms || CFG.mail ? <span className="stock">sent by {CFG.sms ? "SMS" : "email"}</span> : <span className="stock low">recorded only until an SMS or email provider is connected</span>}</h2>{outbox.length ? <div className="scroll"><table className="tbl"><tbody>
      <tr><th>Time</th><th>To</th><th>Message</th><th>Sent</th></tr>
      {outbox.slice(0, 30).map((m, i) => <tr key={i}><td style={{ whiteSpace: "nowrap" }}>{new Date(m.at).toLocaleString()}</td><td>{m.to}</td><td>{m.text}</td><td>{m.sent || "recorded"}</td></tr>)}
    </tbody></table></div> : <p className="muted">Order confirmations and status updates will be listed here.</p>}</section>
  </>;
}
