// Store admin, laid out the way Shopify's admin lays out a back office (researched 28 Oct): a side menu; a home with the figures and what
// needs attention; orders with filters, search and a detail panel whose main button is the next step; products as a list and a full
// editor (photos uploaded by drag and drop and kept by the server, specifications as rows, a save bar); banners and campaign pages
// picked from lists instead of typed codes; customer messages; the connections. The server checks admin rights on every request.
import { useEffect, useRef, useState } from "react";
import { pic, TV_OS, productUrl, off, emiPlans } from "./data.js";
import { PRESETS, TONES, FOCUS } from "./banner.jsx";
import { useStore } from "./store.jsx";
import { api, qs } from "./api.js";
import { Box, Icon } from "./components.jsx";

const STATUS = ["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"];
const NEXT = { Placed: ["Confirmed", "Confirm order"], Confirmed: ["Shipped", "Mark as shipped"], Shipped: ["Delivered", "Mark as delivered"] };
const RETURN = ["Requested", "Approved", "Picked up", "Refunded", "Declined"];
const openReturn = o => o.returnRequest && !["Refunded", "Declined"].includes(o.returnRequest.status);
const NEW_P = { id: "", brand: "Elista", cat: "Televisions", name: "", desc: "", price: "", mrp: "", stock: 10, emi: false, os: "", img: "", images: [], aplus: [], specs: [["", ""]], story: [], spin: "" };
const EMPTY_B = { id: "", slot: "home", order: 1, preset: "cinematic", kicker: "", title: "", text: "", cta: "", href: "", cta2: "", href2: "", img: "", imgMobile: "", focus: "center", align: "left", badge: "", tone: "photo", productId: "", brand: "", until: "", live: true };
const EMPTY_C = { id: "", slug: "", title: "", lead: "", theme: "light", productIds: [], features: "", faq: "", seoTitle: "", seoDesc: "", offers: true, sample: false, live: true };
const split = (s, n) => s.split("\n").map(l => l.split("|").map(x => x.trim())).filter(parts => parts.slice(0, n).every(Boolean)); // "a | b | c" lines
const when = iso => iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
const routeNow = () => { const [tab, arg = ""] = (location.hash.slice(1) || "home").split("/"); return { tab, arg }; };

// a photo from this computer: shrunk in the browser (longest side `max` px, white behind transparency) to a JPEG, then uploaded
async function uploadPhoto(file, max) {
  if (!/^image\//.test(file.type)) throw new Error(file.name + " is not a photo.");
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  let data = c.toDataURL("image/jpeg", 0.85); if (data.length > 1800000) data = c.toDataURL("image/jpeg", 0.7);
  return (await api("admin/upload", "POST", { data })).img;
}

const Badge = ({ s }) => <span className={"ad-badge s-" + String(s).toLowerCase().replace(/\s+/g, "-")}>{s}</span>;
const StockPill = ({ n }) => <span className={"ad-stock" + (n === 0 ? " out" : n <= 5 ? " low" : "")}>{n === 0 ? "Out of stock" : n <= 5 ? "Low · " + n + " left" : n + " in stock"}</span>;
const Empty = ({ title, text, children }) => <div className="ad-empty"><b>{title}</b><p>{text}</p>{children}</div>;
function Drop({ onFiles, label, hint = "Drop photos here or click to choose", multiple = true, cls = "" }) {
  const [over, setOver] = useState(false);
  return <label className={"ad-drop " + cls + (over ? " over" : "")} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); }}>
    <input type="file" accept="image/*" multiple={multiple} onChange={e => { if (e.target.files.length) onFiles([...e.target.files]); e.target.value = ""; }} />
    <span className="ad-dropic"><Icon k="expand" /></span><b>{label}</b><small>{hint}</small></label>;
}
// two clicks instead of a pop-up for anything that cannot be undone
function useSure() {
  const [sure, setSure] = useState(null);
  return [sure, key => { if (sure === key) return true; setSure(key); setTimeout(() => setSure(s => s === key ? null : s), 3500); return false; }];
}

export function Admin() {
  const { me, CFG, money, CATS, BRANDS, toast } = useStore();
  const [route, setRoute] = useState(routeNow);
  const [d, setD] = useState(null), [creative, setCreative] = useState(null), [menu, setMenu] = useState(false);
  const allowed = !!(me && me.admin);
  const load = async () => {
    const [o, p, m, b, c, biz] = await Promise.all([api("admin/orders"), api("products?all=1"), api("admin/outbox"), api("banners?all=1"), api("campaigns?all=1"), api("admin/business")]); // the admin also sees the hidden categories
    setD({ orders: o.orders, products: p.products, outbox: m.messages, banners: b.banners, campaigns: c.campaigns, business: biz.business, bizReady: biz.ready, states: biz.states });
  };
  useEffect(() => {
    document.title = "Store admin | Mytekkstore";
    const legacy = qs.get("edit"); if (legacy) location.hash = "products/" + legacy; // the "Edit in admin" link on a product page
    if (allowed) { load().catch(e => toast(e.message)); api("creative/status").then(setCreative).catch(() => setCreative({ connected: false, how: "" })); }
    const h = () => { setRoute(routeNow()); setMenu(false); scrollTo(0, 0); }; addEventListener("hashchange", h); return () => removeEventListener("hashchange", h);
  }, []);
  if (!allowed) return <Box title="Admins only" text="Sign in with the store admin account to manage products and orders." href="/account?next=/admin" cta="Sign in" />;
  if (!d) return <div className="ad-loading">Loading your store…</div>;
  const go = r => { location.hash = r; };
  const toConfirm = d.orders.filter(o => o.status === "Placed").length, toShip = d.orders.filter(o => o.status === "Confirmed").length;
  const low = d.products.filter(p => p.stock <= 5).length, returns = d.orders.filter(openReturn).length;
  const NAV = [["home", "Home", "home"], ["orders", "Orders", "box", toConfirm + toShip], ["products", "Products", "tv", low], ["banners", "Banners", "expand"], ["campaigns", "Campaign pages", "tag"], ["messages", "Messages", "mic"], ["settings", "Settings", "gear"]];
  const P = { d, money, go, reload: load, toast, CFG, CATS, BRANDS, creative, route };
  const t = route.tab;
  return <div className="ad">
    <aside className={"ad-nav" + (menu ? " open" : "")}>
      <div className="ad-brand"><b>Store admin</b><span>{me.name || "Admin"}</span></div>
      <button type="button" className="ad-menubtn" onClick={() => setMenu(m => !m)} aria-expanded={menu}>Menu: {(NAV.find(n => n[0] === t) || NAV[0])[1]}</button>
      <nav>{NAV.map(([k, label, ic, n]) => <a key={k} href={"#" + k} className={t === k ? "on" : ""} aria-current={t === k ? "page" : undefined}><Icon k={ic} /><span>{label}</span>{n > 0 && <i>{n}</i>}</a>)}</nav>
      <a className="ad-store" href="/" target="_blank" rel="noopener">View the store ↗</a>
    </aside>
    <main className="ad-main">
      {t === "orders" ? <Orders {...P} /> : t === "products" && route.arg ? <ProductEditor key={route.arg + ":" + ((d.products.find(p => String(p.id) === route.arg) || {}).updated || "")} id={route.arg} {...P} />
        : t === "products" ? <Products {...P} /> : t === "banners" ? <Banners {...P} /> : t === "campaigns" ? <Campaigns {...P} /> : t === "messages" ? <Messages {...P} /> : t === "settings" ? <Settings {...P} />
        : <Home {...P} counts={{ toConfirm, toShip, low, returns }} />}
    </main>
  </div>;
}

function Home({ d, money, CFG, counts, go }) { // d.bizReady: the store can issue GST invoices
  const live = d.orders.filter(o => !["Cancelled", "Expired", "Pending payment"].includes(o.status)), today = new Date().toDateString();
  const todays = live.filter(o => new Date(o.at).toDateString() === today);
  const hour = new Date().getHours(), hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todo = [
    counts.toConfirm && [counts.toConfirm + " order" + (counts.toConfirm === 1 ? "" : "s") + " to confirm", "Call or check, then confirm so the customer is told.", "orders/Placed"],
    counts.toShip && [counts.toShip + " order" + (counts.toShip === 1 ? "" : "s") + " to ship", "Hand them to the delivery partner, then mark them shipped.", "orders/Confirmed"],
    counts.returns && [counts.returns + " return request" + (counts.returns === 1 ? "" : "s"), "Approve or decline, and arrange the pickup.", "orders/returns"],
    counts.low && [counts.low + " product" + (counts.low === 1 ? "" : "s") + " low or out of stock", "Update the stock so customers can keep ordering.", "products"],
    !d.bizReady && ["Add your business details", "GST invoices and the legal pages need your registered name, address, GSTIN and signatory.", "settings"],
    CFG.pay !== "razorpay" && ["Online payments are not connected", "Customers can pay cash on delivery only. Connect Razorpay to take UPI and cards.", "settings"],
  ].filter(Boolean);
  return <section>
    <div className="ad-hd"><div><h1>{hello}</h1><p>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p></div></div>
    <div className="ad-kpis">
      <div><span>Sales</span><b>{money(live.reduce((s, o) => s + o.total, 0))}</b><small>{live.length} order{live.length === 1 ? "" : "s"}, cancelled ones left out</small></div>
      <div><span>Today</span><b>{money(todays.reduce((s, o) => s + o.total, 0))}</b><small>{todays.length} order{todays.length === 1 ? "" : "s"} today</small></div>
      <div><span>To process</span><b>{counts.toConfirm + counts.toShip}</b><small>{counts.toConfirm} to confirm · {counts.toShip} to ship</small></div>
      <div><span>Products</span><b>{d.products.length}</b><small>{counts.low} low or out of stock</small></div>
    </div>
    <div className="ad-two">
      <div className="ad-card"><h2>Needs your attention</h2>{todo.length ? <ul className="ad-todo">{todo.map(([a, b, r]) => <li key={a}><a href={"#" + r}><b>{a}</b><span>{b}</span><i>→</i></a></li>)}</ul> : <p className="ad-ok">All caught up. New orders will show here.</p>}</div>
      <div className="ad-card"><div className="ad-cardhd"><h2>Latest orders</h2><a href="#orders">All orders</a></div>
        {d.orders.length ? <ul className="ad-mini">{d.orders.slice(-6).reverse().map(o => <li key={o.id}><a href={"#orders/all/" + o.id}><span><b>{o.name}</b><small>{o.id} · {when(o.at)}</small></span><strong>{money(o.total)}</strong><Badge s={o.status} /></a></li>)}</ul> : <p className="ad-muted">No orders yet. They appear here the moment a customer places one.</p>}</div>
    </div>
  </section>;
}

function Orders({ d, money, reload, toast, route }) {
  const [f, setF] = useState(route.arg || "all"), [q, setQ] = useState(""), [open, setOpen] = useState(location.hash.split("/")[2] || null);
  const FILTERS = [["all", "All"], ["Placed", "To confirm"], ["Confirmed", "To ship"], ["Shipped", "Shipped"], ["Delivered", "Delivered"], ["returns", "Returns"], ["Cancelled", "Cancelled"]];
  const is = (o, k) => k === "all" || (k === "returns" ? openReturn(o) : o.status === k);
  const qq = q.trim().toLowerCase();
  const list = d.orders.filter(o => is(o, f) && (!qq || [o.id, o.name, o.phone, o.pin, ...o.items.map(i => i.brand + " " + i.name)].join(" ").toLowerCase().includes(qq))).reverse();
  const cur = open && d.orders.find(o => o.id === open);
  return <section>
    <div className="ad-hd"><div><h1>Orders</h1><p>{d.orders.length} in all · newest first</p></div></div>
    <div className="ad-tabs" role="tablist">{FILTERS.map(([k, label]) => <button type="button" role="tab" aria-selected={f === k} className={f === k ? "on" : ""} onClick={() => setF(k)} key={k}>{label}<i>{d.orders.filter(o => is(o, k)).length}</i></button>)}</div>
    <div className="ad-tools"><input type="search" className="ad-in" placeholder="Search by order number, customer, phone, pincode or TV" value={q} onChange={e => setQ(e.target.value)} aria-label="Search orders" /></div>
    {list.length ? <div className="ad-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>
      {list.map(o => <tr key={o.id} tabIndex="0" onClick={() => setOpen(o.id)} onKeyDown={e => e.key === "Enter" && setOpen(o.id)} data-order={o.id}>
        <td data-l="Order"><div><b>{o.id}</b><small>{when(o.at)}</small></div></td>
        <td data-l="Customer"><div>{o.name}<small>{o.phone} · {o.pin}</small></div></td>
        <td data-l="Items"><div>{o.items[0].brand} {o.items[0].name}{o.items.length > 1 && <small>+ {o.items.length - 1} more</small>}</div></td>
        <td data-l="Total"><div><b>{money(o.total)}</b></div></td>
        <td data-l="Payment"><div>{/cash/i.test(o.pay) ? "Cash on delivery" : /paid/i.test(o.pay) ? "Paid online" : o.pay}</div></td>
        <td data-l="Status"><div><Badge s={o.status} />{openReturn(o) && <Badge s="Return" />}</div></td></tr>)}
    </tbody></table></div> : <Empty title={d.orders.length ? "No orders match" : "No orders yet"} text={d.orders.length ? "Try another filter or search." : "Orders appear here the moment a customer places one."} />}
    {cur && <OrderPanel o={cur} d={d} money={money} reload={reload} toast={toast} onClose={() => setOpen(null)} />}
  </section>;
}

function OrderPanel({ o, d, money, reload, toast, onClose }) {
  const [busy, setBusy] = useState(false), [sure, ask] = useSure();
  const patch = async body => { setBusy(true); try { await api("admin/orders/" + o.id, "PATCH", { status: o.status, ...body }); toast("Order " + o.id + " updated. The customer is told."); await reload(); } catch (e) { toast(e.message); } setBusy(false); };
  useEffect(() => { const k = e => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);
  const next = NEXT[o.status];
  return <div className="ad-over" onClick={e => e.target === e.currentTarget && onClose()}>
    <aside className="ad-panel" role="dialog" aria-modal="true" aria-label={"Order " + o.id}>
      <div className="ad-phd"><div><h2>{o.id}</h2><p>{when(o.at)} <Badge s={o.status} /></p></div><button type="button" className="ad-x" onClick={onClose} aria-label="Close">×</button></div>
      <div className="ad-acts">
        {next && <button type="button" className="ad-btn" id="nextStep" disabled={busy} onClick={() => patch({ status: next[0] })}>{next[1]}</button>}
        {["Placed", "Confirmed"].includes(o.status) && <button type="button" className="ad-btn ghost danger" disabled={busy} onClick={() => ask("cancel") && patch({ status: "Cancelled" })}>{sure === "cancel" ? "Sure? Cancel this order" : "Cancel order"}</button>}
        <label className="ad-sel">Status<select value={o.status} disabled={busy} onChange={e => patch({ status: e.target.value })} aria-label={"Status of " + o.id}>{(STATUS.includes(o.status) ? STATUS : [o.status, ...STATUS]).map(s => <option key={s}>{s}</option>)}</select></label>
      </div>
      {o.returnRequest && <div className="ad-box warn"><b>Return {o.returnRequest.status.toLowerCase()}</b><p>“{o.returnRequest.reason}”</p><small>Asked {when(o.returnRequest.at)}</small>
        <label className="ad-sel">Return status<select value={o.returnRequest.status} disabled={busy} onChange={e => patch({ returnStatus: e.target.value })}>{RETURN.map(s => <option key={s} disabled={s === "Requested"}>{s}</option>)}</select></label></div>}
      {o.cancelReason && <div className="ad-box"><b>Cancelled by the customer</b><p>“{o.cancelReason}”</p></div>}
      {o.stockIssue && <div className="ad-box warn"><b>Paid beyond the stock</b><p>This order was paid when the last unit had gone. Restock or refund it.</p></div>}
      <h3>Customer</h3>
      <div className="ad-box"><b>{o.name}</b><p><a href={"tel:" + o.phone}>{o.phone}</a>{o.email && <> · {o.email}</>}</p><p>{o.address}, {o.pin}</p></div>
      <h3>Items</h3>
      <ul className="ad-items">{o.items.map(i => { const p = d.products.find(x => x.id === i.id); return <li key={i.id}><img src={pic(i.img || (p && p.img), 480)} alt="" /><span><b>{i.brand} {i.name}</b><small>{i.qty} × {money(i.price)}</small></span><strong>{money(i.price * i.qty)}</strong></li>; })}</ul>
      <div className="ad-sumr"><div><span>Subtotal</span><span>{money(o.subtotal || o.total)}</span></div>{o.discount > 0 && <div className="g"><span>Coupon {o.coupon}</span><span>−{money(o.discount)}</span></div>}<div><span>Delivery</span><span>Free</span></div><div className="tot"><span>Total</span><b>{money(o.total)}</b></div><div><span>Payment</span><span>{o.pay}</span></div>{o.deliveredAt && <div><span>Delivered</span><span>{when(o.deliveredAt)}</span></div>}</div>
      <h3>Invoice</h3>
      <div className="ad-box">{o.invoice ? <><b>GST tax invoice {o.invoice.no}</b><p>Issued {when(o.invoice.date)}</p><a href={"/o/" + o.id + "/" + o.key} target="_blank" rel="noopener">Open, print or save as PDF ↗</a></> : <><b>{o.status === "Cancelled" ? "No invoice (cancelled before dispatch)" : "Issued when you mark it shipped"}</b><p>GST law wants the tax invoice at dispatch; the number is the next in the financial year.</p></>}{!d.bizReady && <p className="ad-warn">Add your business details in Settings first: the invoice needs your GSTIN.</p>}</div>
      {o.key && <a className="ad-link" href={"/o/" + o.id + "/" + o.key} target="_blank" rel="noopener">The page the customer's messages link to ↗</a>}
    </aside>
  </div>;
}

function Products({ d, money, go }) {
  const [q, setQ] = useState(""), [cat, setCat] = useState(""), [st, setSt] = useState("");
  const cats = [...new Set(d.products.map(p => p.cat))];
  const list = d.products.filter(p => (!cat || p.cat === cat) && (!st || (st === "low" ? p.stock > 0 && p.stock <= 5 : p.stock === 0)) && (!q.trim() || (p.brand + " " + p.name + " " + p.id).toLowerCase().includes(q.trim().toLowerCase())));
  return <section>
    <div className="ad-hd"><div><h1>Products</h1><p>{d.products.length} in the catalogue</p></div><a className="ad-btn" href="#products/new" id="addProduct">+ Add product</a></div>
    <div className="ad-tools">
      <input type="search" className="ad-in" placeholder="Search products" value={q} onChange={e => setQ(e.target.value)} aria-label="Search products" />
      <select className="ad-in" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</select>
      <select className="ad-in" value={st} onChange={e => setSt(e.target.value)} aria-label="Stock"><option value="">Any stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
    </div>
    {list.length ? <div className="ad-table"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead><tbody>
      {list.map(p => <tr key={p.id} tabIndex="0" onClick={() => go("products/" + p.id)} onKeyDown={e => e.key === "Enter" && go("products/" + p.id)} data-edit={p.id}>
        <td data-l="Product"><div><span className="ad-prod"><img src={pic(p.img, 480)} alt="" loading="lazy" /><span><b>{p.brand} {p.name}</b>{p.emi && <em>No Cost EMI</em>}</span></span></div></td>
        <td data-l="Category"><div>{p.cat}</div></td>
        <td data-l="Price"><div><b>{money(p.price)}</b>{p.mrp > p.price && <small><s>{money(p.mrp)}</s> {off(p)}% off</small>}</div></td>
        <td data-l="Stock"><div><StockPill n={p.stock} /></div></td>
        <td className="ad-rowact"><span>Edit</span></td></tr>)}
    </tbody></table></div> : <Empty title="No products match" text="Try another search or filter." />}
  </section>;
}

function ProductEditor({ d, id, money, go, reload, toast, CATS, BRANDS }) {
  const src = id === "new" ? null : d.products.find(p => String(p.id) === id);
  const init = () => src ? { id: src.id, brand: src.brand, cat: src.cat, name: src.name, desc: src.desc || "", price: src.price, mrp: src.mrp, stock: src.stock, emi: !!src.emi, os: src.os || "", img: src.img || "", images: [...(src.images || [])], aplus: [...(src.aplus || [])], specs: (src.specs || []).length ? src.specs.map(x => [...x]) : [["", ""]], story: (src.story || []).map(b => ({ ...b })), spin: (src.spin || []).join("\n") } : { ...NEW_P, specs: [["", ""]] };
  const [pf, setPf] = useState(init), [base] = useState(() => JSON.stringify(init()));
  const [busy, setBusy] = useState(false), [up, setUp] = useState(""), [err, setErr] = useState(""), [sure, ask] = useSure();
  if (id !== "new" && !src) return <Empty title="Product not found" text="It may have been deleted."><a className="ad-btn ghost" href="#products">Back to products</a></Empty>;
  const dirty = JSON.stringify(pf) !== base;
  const set = (k, v) => setPf(x => ({ ...x, [k]: v }));
  const photos = [pf.img, ...pf.images].filter(Boolean);
  const many = async (files, max, done) => { setErr(""); const got = []; for (const [i, f] of files.entries()) { setUp(`Uploading ${i + 1} of ${files.length}…`); try { got.push(await uploadPhoto(f, max)); } catch (e) { setErr(e.message || "That photo could not be uploaded."); } } setUp(""); if (got.length) done(got); };
  const addPhotos = files => many(files, 1500, got => setPf(x => { const all = [x.img, ...x.images, ...got].filter(Boolean).slice(0, 9); return { ...x, img: all[0], images: all.slice(1) }; }));
  const photoOp = (i, op) => setPf(x => { const all = [x.img, ...x.images].filter(Boolean); const [m] = all.splice(i, 1); if (op === "main") all.unshift(m); return { ...x, img: all[0] || "", images: all.slice(1) }; });
  const setSpec = (i, j, v) => setPf(x => ({ ...x, specs: x.specs.map((r, k) => k === i ? (j ? [r[0], v] : [v, r[1]]) : r) }));
  const setStory = (i, k, v) => setPf(x => ({ ...x, story: x.story.map((b, n) => n === i ? { ...b, [k]: v } : b) }));
  const price = +pf.price || 0, mrp = +pf.mrp || 0, pct = mrp > price && price ? Math.round((1 - price / mrp) * 100) : 0;
  const save = async () => {
    setErr("");
    if (!pf.img) return setErr("Add at least one photo.");
    if (mrp < price) return setErr("The MRP cannot be lower than the selling price.");
    const body = { brand: pf.brand.trim(), cat: pf.cat.trim(), name: pf.name.trim(), price, mrp, stock: +pf.stock, img: pf.img, desc: pf.desc, emi: !!pf.emi, os: pf.os.trim(), images: pf.images, aplus: pf.aplus,
      spin: pf.spin.split("\n").map(s => s.trim()).filter(Boolean), story: pf.story.filter(b => b.title.trim() && b.text.trim()).map(b => ({ title: b.title.trim(), text: b.text.trim(), img: b.img || "" })),
      specs: pf.specs.map(([k, v]) => [k.trim(), v.trim()]).filter(([k, v]) => k && v) };
    setBusy(true);
    try { const r = await (pf.id ? api("admin/products/" + pf.id, "PUT", body) : api("admin/products", "POST", body)); toast(pf.id ? "Saved. The store shows the change now." : "Product added to the store."); await reload(); go("products/" + r.product.id); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const del = async () => { if (!ask("del")) return; try { await api("admin/products/" + pf.id, "DELETE"); toast("Product deleted"); await reload(); go("products"); } catch (e) { setErr(e.message); } };
  return <form className="ad-edit" id="pedit" onSubmit={e => { e.preventDefault(); save(); }}>
    <div className="ad-hd"><div><a className="ad-back" href="#products">← Products</a><h1>{src ? src.brand + " " + src.name : "Add a product"}</h1>{src && <a className="ad-link" href={productUrl(src)} target="_blank" rel="noopener">View on the store ↗</a>}</div></div>
    <div className="ad-ecols">
      <div className="ad-emain">
        <div className="ad-card"><h2>Name and description</h2>
          <label className="ad-f">Product name<input className="ad-in" name="name" required maxLength="160" placeholder="e.g. 140 cm (55 inch) 4K Ultra HD Smart TV" value={pf.name} onChange={e => set("name", e.target.value)} /><small>Shown after the brand: “{pf.brand || "Brand"} {pf.name || "…"}”</small></label>
          <label className="ad-f">Description<textarea className="ad-in" rows="5" maxLength="2000" placeholder="What makes it worth buying, in two or three sentences." value={pf.desc} onChange={e => set("desc", e.target.value)} /></label>
        </div>
        <div className="ad-card"><h2>Photos</h2><p className="ad-hint">The first photo is the main one, on cards and at the top of the product page. Square photos look best; each is resized to 1500 px. Up to 9.</p>
          <div className="ad-photos">{photos.map((s, i) => <figure key={s + i} className={i === 0 ? "main" : ""}><img src={pic(s, 480)} alt="" />{i === 0 ? <em>Main photo</em> : <button type="button" className="mk" onClick={() => photoOp(i, "main")}>Make main</button>}<button type="button" className="rm" aria-label="Remove photo" onClick={() => photoOp(i, "rm")}>×</button></figure>)}
            {photos.length < 9 && <Drop onFiles={addPhotos} label={photos.length ? "Add more" : "Add photos"} />}</div>
          {up && <p className="ad-up" role="status">{up}</p>}</div>
        <div className="ad-card"><h2>Specifications</h2><p className="ad-hint">The table on the product page and in comparisons. One row per detail.</p>
          <div className="ad-specs">{pf.specs.map(([k, v], i) => <div className="ad-spec" key={i}><input className="ad-in" placeholder="e.g. Screen size" aria-label={"Specification " + (i + 1) + " name"} value={k} onChange={e => setSpec(i, 0, e.target.value)} /><input className="ad-in" placeholder="e.g. 140 cm (55 inch)" aria-label={"Specification " + (i + 1) + " value"} value={v} onChange={e => setSpec(i, 1, e.target.value)} /><button type="button" className="ad-x sm" aria-label="Remove row" onClick={() => set("specs", pf.specs.length > 1 ? pf.specs.filter((_, n) => n !== i) : [["", ""]])}>×</button></div>)}</div>
          <button type="button" className="ad-btn ghost sm" onClick={() => set("specs", [...pf.specs, ["", ""]])}>+ Add a row</button></div>
        <div className="ad-card"><h2>Brand creatives</h2><p className="ad-hint">Full-width images shown one under another on the product page, the way Amazon and Croma show them. Use images 1000 px wide or more.</p>
          <div className="ad-creatives">{pf.aplus.map((s, i) => <figure key={s + i}><img src={pic(s)} alt="" /><span>{i + 1}</span>{i > 0 && <button type="button" className="mk" onClick={() => set("aplus", pf.aplus.map((x, n) => n === i - 1 ? pf.aplus[i] : n === i ? pf.aplus[i - 1] : x))}>Move up</button>}<button type="button" className="rm" aria-label="Remove creative" onClick={() => set("aplus", pf.aplus.filter((_, n) => n !== i))}>×</button></figure>)}
            {pf.aplus.length < 12 && <Drop cls="wide" onFiles={files => many(files, 1600, got => set("aplus", [...pf.aplus, ...got].slice(0, 12)))} label="Add creatives" />}</div></div>
        <div className="ad-card"><h2>Feature blocks <small>(optional)</small></h2><p className="ad-hint">Short picture-and-text blocks on the product page, such as “Cinema at home”.</p>
          {pf.story.map((b, i) => <div className="ad-story" key={i}>{b.img ? <figure><img src={pic(b.img, 480)} alt="" /><button type="button" className="rm" aria-label="Remove picture" onClick={() => setStory(i, "img", "")}>×</button></figure> : <Drop cls="sm" multiple={false} hint="Optional" onFiles={files => many(files.slice(0, 1), 1500, got => setStory(i, "img", got[0]))} label="Picture" />}
            <div><input className="ad-in" placeholder="Title" maxLength="80" value={b.title} onChange={e => setStory(i, "title", e.target.value)} aria-label="Block title" /><textarea className="ad-in" rows="2" maxLength="600" placeholder="One or two sentences" value={b.text} onChange={e => setStory(i, "text", e.target.value)} aria-label="Block text" /></div>
            <button type="button" className="ad-x sm" aria-label="Remove block" onClick={() => set("story", pf.story.filter((_, n) => n !== i))}>×</button></div>)}
          {pf.story.length < 8 && <button type="button" className="ad-btn ghost sm" onClick={() => set("story", [...pf.story, { title: "", text: "", img: "" }])}>+ Add a block</button>}</div>
      </div>
      <div className="ad-eside">
        <div className="ad-card"><h2>Price</h2>
          <div className="ad-row2"><label className="ad-f">Selling price<span className="ad-rs"><b>₹</b><input className="ad-in" name="price" type="number" required min="1" step="1" inputMode="numeric" value={pf.price} onChange={e => set("price", e.target.value)} /></span></label>
            <label className="ad-f">MRP<span className="ad-rs"><b>₹</b><input className="ad-in" name="mrp" type="number" required min="1" step="1" inputMode="numeric" value={pf.mrp} onChange={e => set("mrp", e.target.value)} /></span></label></div>
          <p className="ad-prev">{!price ? "Enter the price customers pay." : pct ? <><b>{pct}% off</b> · the customer saves {money(mrp - price)}</> : "Sold at MRP (no discount shown)"}</p>
          <label className="ad-tog"><input type="checkbox" checked={pf.emi} onChange={e => set("emi", e.target.checked)} /><span><b>No Cost EMI</b><small>{pf.emi && price ? "Shows “from " + money(emiPlans(price)[2][1]) + "/month over 9 months”" : "Shows the No Cost EMI tag and monthly price"}</small></span></label></div>
        <div className="ad-card"><h2>Stock</h2>
          <div className="ad-step"><button type="button" aria-label="One less" onClick={() => set("stock", Math.max(0, (+pf.stock || 0) - 1))}>−</button><input className="ad-in" name="stock" type="number" required min="0" step="1" inputMode="numeric" value={pf.stock} onChange={e => set("stock", e.target.value)} aria-label="Units in stock" /><button type="button" aria-label="One more" onClick={() => set("stock", (+pf.stock || 0) + 1)}>+</button></div>
          <p className="ad-prev"><StockPill n={+pf.stock || 0} /></p></div>
        <div className="ad-card"><h2>Organisation</h2>
          <label className="ad-f">Brand<input className="ad-in" name="brand" required maxLength="60" list="ad-brands" value={pf.brand} onChange={e => set("brand", e.target.value)} /></label>
          <label className="ad-f">Category<input className="ad-in" name="cat" required maxLength="60" list="ad-cats" value={pf.cat} onChange={e => set("cat", e.target.value)} /></label>
          <label className="ad-f">Operating system <small>(TVs)</small><input className="ad-in" maxLength="40" list="ad-os" placeholder="Google TV, WebOS, Android TV…" value={pf.os} onChange={e => set("os", e.target.value)} /></label>
          <datalist id="ad-brands">{[...new Set([...BRANDS, ...d.products.map(p => p.brand)])].map(b => <option value={b} key={b} />)}</datalist><datalist id="ad-cats">{[...new Set([...CATS, ...d.products.map(p => p.cat)])].map(c => <option value={c} key={c} />)}</datalist><datalist id="ad-os">{Object.keys(TV_OS).map(o => <option value={o} key={o} />)}</datalist></div>
        <details className="ad-card ad-adv"><summary>360° view <small>(advanced)</small></summary><p className="ad-hint">8 to 48 photo links taken in a circle around the product, one per line, in order. Turns on drag-to-rotate.</p><textarea className="ad-in" rows="4" value={pf.spin} onChange={e => set("spin", e.target.value)} aria-label="360 degree frames" /></details>
        {src && <div className="ad-card ad-dz"><h2>Delete this product</h2><p className="ad-hint">It leaves the store at once. Past orders keep their record.</p><button type="button" className="ad-btn ghost danger" onClick={del}>{sure === "del" ? "Sure? Delete it" : "Delete product"}</button></div>}
      </div>
    </div>
    <div className={"ad-save" + (dirty || err ? " on" : "")} role="region" aria-label="Save">
      <span>{err ? <b className="ad-err" role="alert">{err}</b> : dirty ? "Unsaved changes" : src ? "All changes saved" : "Fill in the product, then add it"}</span>
      <button type="button" className="ad-btn ghost" onClick={() => dirty ? setPf(init()) : go("products")}>{dirty ? "Discard" : "Close"}</button>
      <button type="submit" className="ad-btn" id="saveProduct" disabled={busy || !!up || !dirty}>{busy ? "Saving…" : pf.id ? "Save" : "Add product"}</button>
    </div>
  </form>;
}

// where a banner shows, picked from lists: the home slider, one product's page, one campaign page, one category's page
const slotKind = s => s === "home" ? ["home", ""] : (/^(product|campaign|category):(.*)$/.exec(s) || [0, "home", ""]).slice(1); // "product:" (no product chosen yet) stays a product slot, so its list appears
function Banners({ d, toast, reload, creative }) {
  const [bf, setBf] = useState(null), [busy, setBusy] = useState(false), [up, setUp] = useState(""), [sure, ask] = useSure();
  const set = (k, v) => setBf(x => ({ ...x, [k]: v }));
  const [kind, target] = bf ? slotKind(bf.slot) : ["home", ""];
  const setSlot = (k, t) => set("slot", k === "home" ? "home" : k + ":" + (t || ""));
  const cats = [...new Set(d.products.map(p => p.cat))];
  const img = async (k, files) => { setUp("Uploading…"); try { set(k, await uploadPhoto(files[0], 2400)); } catch (e) { toast(e.message); } setUp(""); };
  const save = async () => { setBusy(true); try { const body = { ...bf, order: +bf.order || 1, productId: +bf.productId || 0, live: !!bf.live }; delete body.id; await (bf.id ? api("admin/banners/" + bf.id, "PUT", body) : api("admin/banners", "POST", body)); toast(bf.id ? "Banner saved" : "Banner added"); await reload(); setBf(null); } catch (e) { toast(e.message); } setBusy(false); };
  const del = async b => { if (!ask("b" + b.id)) return; try { await api("admin/banners/" + b.id, "DELETE"); toast("Banner deleted"); await reload(); } catch (e) { toast(e.message); } };
  const concept = async () => { try { const r = await api("creative/concepts", "POST", { productId: +bf.productId, slot: bf.slot, objective: "banner" }); const c = (r.concepts || [])[0]; if (!c) return toast("The creative agent returned no concept."); setBf(x => ({ ...x, kicker: c.kicker || x.kicker, title: c.headline || x.title, text: c.supporting || x.text })); toast("Concept filled in. Review it, then save."); } catch (e) { toast(e.message); } };
  const where = s => { const [k, t] = slotKind(s); return k === "home" ? "Home page slider" : k === "product" ? "Product page: " + ((d.products.find(p => String(p.id) === t) || {}).name || "#" + t) : k === "campaign" ? "Campaign: /campaigns/" + t : "Category: " + t; };
  if (bf) return <section>
    <div className="ad-hd"><div><button type="button" className="ad-back" onClick={() => setBf(null)}>← Banners</button><h1>{bf.id ? "Edit banner" : "New banner"}</h1></div></div>
    <form className="ad-ecols" onSubmit={e => { e.preventDefault(); save(); }}>
      <div className="ad-emain">
        <div className="ad-card"><h2>Words</h2>
          <label className="ad-f">Small line above <small>(optional)</small><input className="ad-in" maxLength="60" value={bf.kicker} onChange={e => set("kicker", e.target.value)} /></label>
          <label className="ad-f">Headline<input className="ad-in" required maxLength="120" value={bf.title} onChange={e => set("title", e.target.value)} /><small>A full stop starts a new line.</small></label>
          <label className="ad-f">Text <small>(optional)</small><input className="ad-in" maxLength="300" value={bf.text} onChange={e => set("text", e.target.value)} /></label>
          <div className="ad-row2"><label className="ad-f">Button<input className="ad-in" maxLength="40" placeholder="Shop now" value={bf.cta} onChange={e => set("cta", e.target.value)} /></label><label className="ad-f">Button opens<input className="ad-in" maxLength="300" placeholder="/televisions" value={bf.href} onChange={e => set("href", e.target.value)} /></label></div>
          <div className="ad-row2"><label className="ad-f">Second button <small>(optional)</small><input className="ad-in" maxLength="40" value={bf.cta2} onChange={e => set("cta2", e.target.value)} /></label><label className="ad-f">Second button opens<input className="ad-in" maxLength="300" value={bf.href2} onChange={e => set("href2", e.target.value)} /></label></div>
          <label className="ad-f">Badge <small>(optional)</small><input className="ad-in" maxLength="40" placeholder="New, Limited time" value={bf.badge} onChange={e => set("badge", e.target.value)} /></label>
          <button type="button" className="ad-btn ghost sm" disabled={!(creative && creative.connected) || !bf.productId} title={creative && creative.connected ? "Fills the words from the agent's first concept" : (creative && creative.how) || "The creative agent is not connected"} onClick={concept}>Ask the creative agent</button></div>
        <div className="ad-card"><h2>Pictures</h2><div className="ad-row2">
          {[["img", "Desktop picture", "Wide, 2400 px or more"], ["imgMobile", "Phone picture", "Optional; tall or square"]].map(([k, label, hint]) => <div className="ad-f" key={k}><span>{label}</span>{bf[k] ? <figure className="ad-bimg"><img src={pic(bf[k])} alt="" /><button type="button" className="rm" aria-label={"Remove " + label} onClick={() => set(k, "")}>×</button></figure> : <Drop multiple={false} hint={hint} label={"Upload " + label.toLowerCase()} onFiles={files => img(k, files)} />}</div>)}</div>
          {up && <p className="ad-up" role="status">{up}</p>}</div>
      </div>
      <div className="ad-eside">
        <div className="ad-card"><h2>Where it shows</h2>
          <label className="ad-f">Page<select className="ad-in" value={kind} onChange={e => setSlot(e.target.value, "")}><option value="home">Home page slider</option><option value="product">A product page</option><option value="campaign">A campaign page</option><option value="category">A category page</option></select></label>
          {kind === "product" && <label className="ad-f">Product<select className="ad-in" required value={target} onChange={e => setSlot("product", e.target.value)}><option value="">Choose…</option>{d.products.map(p => <option value={p.id} key={p.id}>{p.brand} {p.name}</option>)}</select></label>}
          {kind === "campaign" && <label className="ad-f">Campaign<select className="ad-in" required value={target} onChange={e => setSlot("campaign", e.target.value)}><option value="">Choose…</option>{d.campaigns.map(c => <option value={c.slug} key={c.slug}>{c.title}</option>)}</select></label>}
          {kind === "category" && <label className="ad-f">Category<select className="ad-in" required value={target} onChange={e => setSlot("category", e.target.value)}><option value="">Choose…</option>{cats.map(c => <option key={c}>{c}</option>)}</select></label>}
          <label className="ad-f">Position in the slider<input className="ad-in" type="number" min="1" max="99" value={bf.order} onChange={e => set("order", e.target.value)} /></label>
          <label className="ad-tog"><input type="checkbox" checked={!!bf.live} onChange={e => set("live", e.target.checked)} /><span><b>Live on the site</b><small>Untick to keep it as a draft.</small></span></label></div>
        <div className="ad-card"><h2>Look</h2>
          <label className="ad-f">Movement<select className="ad-in" value={bf.preset} onChange={e => set("preset", e.target.value)}>{PRESETS.map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="ad-f">Colours<select className="ad-in" value={bf.tone} onChange={e => set("tone", e.target.value)}>{Object.keys(TONES).map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="ad-f">Picture focus on phones<select className="ad-in" value={bf.focus} onChange={e => set("focus", e.target.value)}>{Object.keys(FOCUS).map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="ad-f">Text alignment<select className="ad-in" value={bf.align} onChange={e => set("align", e.target.value)}><option>left</option><option>center</option></select></label>
          <label className="ad-f">Product floating on it <small>(optional)</small><select className="ad-in" value={bf.productId} onChange={e => set("productId", e.target.value)}><option value="">None</option>{d.products.map(p => <option value={p.id} key={p.id}>{p.brand} {p.name}</option>)}</select></label></div>
        <div className="ad-card ad-saveside"><button type="submit" className="ad-btn" disabled={busy || !!up}>{busy ? "Saving…" : bf.id ? "Save banner" : "Add banner"}</button><button type="button" className="ad-btn ghost" onClick={() => setBf(null)}>Cancel</button></div>
      </div>
    </form>
  </section>;
  return <section>
    <div className="ad-hd"><div><h1>Banners</h1><p>The big pictures on the home slider, product pages, campaign and category pages.</p></div><button type="button" className="ad-btn" onClick={() => setBf({ ...EMPTY_B })}>+ New banner</button></div>
    {creative && !creative.connected && <p className="ad-note">The creative agent that drafts banner words is not connected; banners work without it.</p>}
    <div className="ad-bgrid">{[...d.banners].sort((a, b) => a.slot.localeCompare(b.slot) || a.order - b.order).map(b => <div className="ad-bcard" key={b.id}>
      <div className="ad-bpic">{b.img ? <img src={pic(b.img)} alt="" loading="lazy" /> : <span>No picture</span>}{!b.live && <em>Draft</em>}</div>
      <div className="ad-bbody"><small>{where(b.slot)}{b.slot === "home" ? " · position " + b.order : ""}</small><b>{b.title}</b><div><button type="button" className="ad-btn ghost sm" onClick={() => setBf({ ...EMPTY_B, ...b, productId: b.productId || "" })}>Edit</button><button type="button" className="ad-btn ghost sm danger" onClick={() => del(b)}>{sure === "b" + b.id ? "Sure?" : "Delete"}</button></div></div></div>)}</div>
  </section>;
}

function Campaigns({ d, toast, reload, money }) {
  const [cf, setCf] = useState(null), [busy, setBusy] = useState(false), [pq, setPq] = useState(""), [sure, ask] = useSure();
  const set = (k, v) => setCf(x => ({ ...x, [k]: v }));
  const edit = c => setCf({ id: c.id, slug: c.slug, title: c.title, lead: c.lead || "", theme: c.theme, productIds: [...c.productIds], features: c.features.map(f => [f.title, f.text, f.img].filter(Boolean).join(" | ")).join("\n"), faq: c.faq.map(x => x.join(" | ")).join("\n"), seoTitle: (c.seo || {}).title || "", seoDesc: (c.seo || {}).desc || "", offers: !!c.offers, sample: !!c.sample, live: !!c.live });
  const save = async () => { setBusy(true); try { const body = { slug: cf.slug.trim(), title: cf.title, lead: cf.lead, theme: cf.theme, productIds: cf.productIds, features: split(cf.features, 2).map(([title, text, img]) => ({ title, text, img: img || "" })), faq: split(cf.faq, 2).map(([q, a]) => [q, a]), offers: !!cf.offers, seo: { title: cf.seoTitle, desc: cf.seoDesc }, sample: !!cf.sample, live: !!cf.live };
    await (cf.id ? api("admin/campaigns/" + cf.id, "PUT", body) : api("admin/campaigns", "POST", body)); toast(cf.id ? "Campaign saved" : "Campaign added"); await reload(); setCf(null); } catch (e) { toast(e.message); } setBusy(false); };
  const del = async c => { if (!ask("c" + c.id)) return; try { await api("admin/campaigns/" + c.id, "DELETE"); toast("Campaign deleted"); await reload(); } catch (e) { toast(e.message); } };
  if (cf) { const pick = id => set("productIds", cf.productIds.includes(id) ? cf.productIds.filter(x => x !== id) : [...cf.productIds, id]); const shown = d.products.filter(p => !pq.trim() || (p.brand + " " + p.name).toLowerCase().includes(pq.trim().toLowerCase()));
    return <section>
      <div className="ad-hd"><div><button type="button" className="ad-back" onClick={() => setCf(null)}>← Campaign pages</button><h1>{cf.id ? cf.title || "Edit campaign" : "New campaign page"}</h1>{cf.id && cf.live && <a className="ad-link" href={"/campaigns/" + cf.slug} target="_blank" rel="noopener">Open the page ↗</a>}</div></div>
      <form className="ad-ecols" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="ad-emain">
          <div className="ad-card"><h2>Page</h2>
            <label className="ad-f">Title<input className="ad-in" required maxLength="100" value={cf.title} onChange={e => set("title", e.target.value)} /></label>
            <label className="ad-f">Address<span className="ad-rs"><b>/campaigns/</b><input className="ad-in" required maxLength="60" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="festive-tv-days" value={cf.slug} onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></span><small>Small letters, digits and dashes.</small></label>
            <label className="ad-f">Lead <small>(one or two lines)</small><input className="ad-in" maxLength="300" value={cf.lead} onChange={e => set("lead", e.target.value)} /></label></div>
          <div className="ad-card"><h2>Products on the page <small>({cf.productIds.length} chosen)</small></h2><input type="search" className="ad-in" placeholder="Search products" value={pq} onChange={e => setPq(e.target.value)} aria-label="Search products" />
            <div className="ad-pick">{shown.map(p => <label key={p.id} className={cf.productIds.includes(p.id) ? "on" : ""}><input type="checkbox" checked={cf.productIds.includes(p.id)} onChange={() => pick(p.id)} /><img src={pic(p.img, 480)} alt="" loading="lazy" /><span><b>{p.brand} {p.name}</b><small>{money(p.price)}</small></span></label>)}</div></div>
          <div className="ad-card"><h2>Feature blocks and questions <small>(optional)</small></h2>
            <label className="ad-f">Feature blocks<textarea className="ad-in" rows="3" value={cf.features} onChange={e => set("features", e.target.value)} placeholder="Big screens | 65 to 85 inch, cinema at home | img/photo.jpg" /><small>One block per line: Title | Text | picture link (optional).</small></label>
            <label className="ad-f">Questions<textarea className="ad-in" rows="3" value={cf.faq} onChange={e => set("faq", e.target.value)} placeholder="Is installation free? | ..." /><small>One per line: Question | Answer.</small></label></div>
        </div>
        <div className="ad-eside">
          <div className="ad-card"><h2>Settings</h2>
            <label className="ad-f">Colour theme<select className="ad-in" value={cf.theme} onChange={e => set("theme", e.target.value)}><option>light</option><option>dark</option><option>green</option><option>indigo</option></select></label>
            <label className="ad-tog"><input type="checkbox" checked={cf.offers} onChange={e => set("offers", e.target.checked)} /><span><b>Show the bank offers</b></span></label>
            <label className="ad-tog"><input type="checkbox" checked={cf.live} onChange={e => set("live", e.target.checked)} /><span><b>Live on the site</b><small>Untick to keep it as a draft.</small></span></label></div>
          <div className="ad-card"><h2>Google result</h2>
            <label className="ad-f">Title<input className="ad-in" maxLength="70" value={cf.seoTitle} onChange={e => set("seoTitle", e.target.value)} /><small>{cf.seoTitle.length}/70</small></label>
            <label className="ad-f">Description<textarea className="ad-in" rows="3" maxLength="160" value={cf.seoDesc} onChange={e => set("seoDesc", e.target.value)} /><small>{cf.seoDesc.length}/160</small></label></div>
          <div className="ad-card ad-saveside"><button type="submit" className="ad-btn" disabled={busy}>{busy ? "Saving…" : cf.id ? "Save campaign" : "Add campaign"}</button><button type="button" className="ad-btn ghost" onClick={() => setCf(null)}>Cancel</button></div>
        </div>
      </form>
    </section>; }
  return <section>
    <div className="ad-hd"><div><h1>Campaign pages</h1><p>Pages of their own for a sale or a range, at /campaigns/address. Give one a banner from Banners.</p></div><button type="button" className="ad-btn" onClick={() => setCf({ ...EMPTY_C })}>+ New campaign</button></div>
    {d.campaigns.length ? <div className="ad-table"><table><thead><tr><th>Page</th><th>Products</th><th>Status</th><th></th></tr></thead><tbody>
      {d.campaigns.map(c => <tr key={c.id}><td data-l="Page"><div><b>{c.title}</b><small>/campaigns/{c.slug}{c.sample ? " · sample" : ""}</small></div></td><td data-l="Products"><div>{c.productIds.length}</div></td><td data-l="Status"><div>{c.live ? <Badge s="Live" /> : <Badge s="Draft" />}</div></td>
        <td className="ad-rowact">{c.live && <a href={"/campaigns/" + c.slug} target="_blank" rel="noopener">Open ↗</a>}<button type="button" className="ad-btn ghost sm" onClick={() => edit(c)}>Edit</button><button type="button" className="ad-btn ghost sm danger" onClick={() => del(c)}>{sure === "c" + c.id ? "Sure?" : "Delete"}</button></td></tr>)}
    </tbody></table></div> : <Empty title="No campaign pages yet" text="Create one for a sale, a festival or a range." />}
  </section>;
}

function Messages({ d, CFG }) {
  return <section>
    <div className="ad-hd"><div><h1>Messages</h1><p>{CFG.sms || CFG.mail ? "Every message sent to customers by " + (CFG.sms ? "SMS" : "email") + ", and the contact form." : "Every order message and contact-form note. Until an SMS or email service is connected they are recorded here, not sent."}</p></div></div>
    {d.outbox.length ? <div className="ad-table"><table><thead><tr><th>When</th><th>To</th><th>Message</th><th>Sent</th></tr></thead><tbody>
      {[...d.outbox].reverse().slice(0, 100).map((m, i) => <tr key={m.id || i}><td data-l="When" className="nowrap"><div>{when(m.at)}</div></td><td data-l="To"><div>{m.to}</div></td><td data-l="Message"><div>{m.text}</div></td><td data-l="Sent"><div>{m.sent || "recorded"}</div></td></tr>)}
    </tbody></table></div> : <Empty title="No messages yet" text="Order confirmations and status updates will be listed here." />}
  </section>;
}

// the registered details, the way the GST certificate states them; every field says where it appears
const gstinCheck = g => { if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false; const C = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"; let s = 0; for (let i = 0; i < 14; i++) { const p = C.indexOf(g[i]) * (i % 2 + 1); s += Math.floor(p / 36) + p % 36; } return C[(36 - s % 36) % 36] === g[14]; };
function Business({ d, toast, reload }) {
  const [b, setB] = useState(() => ({ legalName: "", tradeName: "Mytekkstore", address: "", city: "", state: "", pin: "", gstin: "", cin: "", email: "", phone: "", signatory: "", grievanceName: "", grievanceDesignation: "", grievanceEmail: "", grievancePhone: "", prefix: "MTS", hsn: "8528", alertsEmail: "", ...(d.business || {}) }));
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const set = k => e => setB(x => ({ ...x, [k]: k === "gstin" || k === "cin" || k === "prefix" ? e.target.value.toUpperCase() : e.target.value }));
  const g = b.gstin.trim(), gOk = !g || gstinCheck(g), fy = (() => { const t = new Date(), y = (t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1) % 100; return String(y).padStart(2, "0") + "-" + String((y + 1) % 100).padStart(2, "0"); })();
  const missing = [["legalName", "legal name"], ["address", "address"], ["state", "state"], ["pin", "pincode"], ["gstin", "GSTIN"], ["signatory", "authorised signatory"]].filter(([k]) => !String(b[k] || "").trim()).map(([, l]) => l);
  const save = async e => { e.preventDefault(); setErr(""); setBusy(true); try { await api("admin/business", "PUT", b); toast("Business details saved. Invoices and the legal pages use them now."); await reload(); } catch (ex) { setErr(ex.message); } setBusy(false); };
  const F = (k, label, hint, props = {}) => <label className={"ad-f" + (props.wide ? " ad-wide" : "")}>{label}{hint && <small>{hint}</small>}<input className="ad-in" value={b[k] || ""} onChange={set(k)} {...Object.fromEntries(Object.entries(props).filter(([n]) => n !== "wide"))} /></label>;
  return <form className="ad-card ad-biz" onSubmit={save}><div className="ad-cardhd"><h2>Business details</h2>{missing.length ? <span className="ad-off">Missing: {missing.join(", ")}</span> : <span className="ad-on">Ready for GST invoices</span>}</div>
    <p className="ad-hint">Exactly as on your GST registration certificate. They print on every tax invoice and fill the Terms, Privacy and Grievance sections.</p>
    <h3 className="ad-sub">Registered business</h3>
    <div className="ad-grid2">{F("legalName", "Legal name", "As on the GST certificate, e.g. ABC Retail Private Limited", { required: true, maxLength: 120 })}{F("tradeName", "Trade name", "The store name customers know", { maxLength: 80 })}
      {F("address", "Registered address", "Building, street, area", { required: true, maxLength: 300, wide: true })}{F("city", "City", "", { maxLength: 80 })}
      <label className="ad-f">State<small>Decides CGST + SGST or IGST on each invoice</small><select className="ad-in" required value={b.state} onChange={set("state")}><option value="">Choose…</option>{(d.states || []).map(x => <option key={x}>{x}</option>)}</select></label>
      {F("pin", "Pincode", "", { required: true, inputMode: "numeric", pattern: "\\d{6}", maxLength: 6 })}
      <label className="ad-f">GSTIN<small>15 characters; the first two are your state's code</small><input className={"ad-in" + (gOk ? "" : " bad")} required maxLength="15" value={b.gstin} onChange={set("gstin")} aria-invalid={!gOk} />{g && <small className={gOk ? "ok" : "no"}>{gOk ? "Valid GSTIN (PAN " + g.slice(2, 12) + ")" : "Not a valid GSTIN: check each character"}</small>}</label>
      {F("cin", "CIN (companies only)", "21 characters, from the certificate of incorporation", { maxLength: 21 })}</div>
    <h3 className="ad-sub">Customer care</h3>
    <div className="ad-grid2">{F("phone", "Phone", "On invoices and the contact page", { type: "tel", maxLength: 16 })}{F("email", "Email", "", { type: "email", maxLength: 120 })}</div>
    <h3 className="ad-sub">Grievance officer</h3><p className="ad-hint">Required on every Indian e-commerce site (Consumer Protection (E-Commerce) Rules, 2020). Shown in the Terms and Privacy pages.</p>
    <div className="ad-grid2">{F("grievanceName", "Name", "", { maxLength: 80 })}{F("grievanceDesignation", "Designation", "", { maxLength: 80 })}{F("grievanceEmail", "Email", "", { type: "email", maxLength: 120 })}{F("grievancePhone", "Phone", "", { type: "tel", maxLength: 16 })}</div>
    <h3 className="ad-sub">Invoices</h3>
    <div className="ad-grid2">{F("signatory", "Authorised signatory", "The person who signs for the business", { required: true, maxLength: 80 })}
      <label className="ad-f">Invoice prefix<small>Numbers run {(b.prefix || "MTS")}/{fy}/00001, 00002… and restart each April</small><input className="ad-in" maxLength="4" pattern="[A-Za-z0-9]{1,4}" value={b.prefix} onChange={set("prefix")} /></label>
      {F("hsn", "HSN code for televisions", "8528 (4 digits) under ₹5 crore turnover; 6 digits above", { inputMode: "numeric", maxLength: 8 })}
      {F("alertsEmail", "New-order alerts to", "Every new order is emailed here (not shown to customers)", { type: "email", maxLength: 120 })}</div>
    {err && <p className="ad-err-b" role="alert">{err}</p>}
    <div className="ad-bizsave"><button className="ad-btn" id="saveBusiness" disabled={busy || !gOk}>{busy ? "Saving…" : "Save business details"}</button></div>
  </form>;
}
function Settings({ CFG, toast, reload, d }) {
  const [sure, ask] = useSure();
  const LINKS = [["Database", CFG.db, "Keeps accounts, orders, stock and photos safe across the live site's servers.", "Vercel → Storage → Neon"],
    ["Online payments", CFG.pay === "razorpay", "UPI, cards, net banking and No Cost EMI through Razorpay. Until then: cash on delivery only.", "Razorpay keys in Vercel"],
    ["Order SMS", CFG.orderSms, "Order placed, shipped (with the invoice link) and delivered, by SMS. India needs a DLT-registered template (see the launch guide).", "MSG91 order template ID in Vercel"],
    ["SMS sign-in codes", CFG.sms, "Sends the 6-digit sign-in code by SMS (MSG91 for India).", "MSG91 keys in Vercel"],
    ["Email", CFG.mail, "Order emails and email sign-in codes (Brevo).", "Brevo key in Vercel"],
    ["Google sign-in", !!CFG.google, "“Continue with Google” on the sign-in page.", "Google client ID in Vercel"],
    ["Location to pincode", CFG.geo, "Fills the pincode from the customer's location.", "Google Maps key in Vercel"],
    ["Bot protection", !!CFG.recaptcha, "reCAPTCHA on sign-in code requests.", "reCAPTCHA keys in Vercel"],
    ["Shopping assistant", CFG.chat, "The AI help chat answers from the catalogue.", "Gemini key in Vercel"]];
  return <section>
    <div className="ad-hd"><div><h1>Settings</h1><p>Your business details, what is connected, and the before-launch tools.</p></div></div>
    <Business d={d} toast={toast} reload={reload} />
    <div className="ad-card"><h2>Connections</h2><ul className="ad-links">{LINKS.map(([name, on, what, how]) => <li key={name}><span><b>{name}</b><small>{what}</small></span>{on ? <span className="ad-on">Connected</span> : <span className="ad-off" title={how}>Not connected<small>{how}</small></span>}</li>)}</ul></div>
    <div className="ad-card ad-dz"><h2>Before launch</h2><p className="ad-hint">Clears every customer account, every order and the message log; the catalogue, banners, campaigns and this admin account stay, and stock held by open orders comes back. Use it once, before real customers arrive.</p>
      <button type="button" className="ad-btn ghost danger" id="resetCustomers" onClick={async () => { if (!ask("reset")) return; try { const r = await api("admin/reset-customers", "POST", {}); toast(r.users + " customer account" + (r.users === 1 ? "" : "s") + " and all orders cleared"); await reload(); } catch (e) { toast(e.message); } }}>{sure === "reset" ? "Sure? This cannot be undone" : "Clear all customer accounts and orders"}</button></div>
  </section>;
}
