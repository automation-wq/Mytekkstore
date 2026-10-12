// Store admin: orders, products (with photo upload and the No Cost EMI flag), customer messages. The server checks admin rights on every request.
import { pic, TV_OS } from "./data.js";
import { useEffect, useState } from "react";
import { useStore } from "./store.jsx";
import { api } from "./api.js";
import { Form, Box } from "./components.jsx";
import { reveal } from "./motion.js";

const ALL = ["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"];
const EMPTY = { id: "", brand: "", cat: "", name: "", price: "", mrp: "", stock: 10, img: "", desc: "", specs: "", emi: false, images: "", os: "", story: "" };

export function Admin() {
  const { me, CFG, money, CATS, BRANDS, toast } = useStore();
  const [orders, setOrders] = useState([]), [products, setProducts] = useState([]), [outbox, setOutbox] = useState([]);
  const [f, setF] = useState(EMPTY), [sure, setSure] = useState(null), [ready, setReady] = useState(false);
  const allowed = !!(me && me.admin);
  const draw = async () => {
    setOrders((await api("admin/orders")).orders); setProducts((await api("products?all=1")).products); // the admin also sees the hidden categories setOutbox((await api("admin/outbox")).messages);
    setF(EMPTY); setReady(true);
  };
  useEffect(() => { document.title = "Store admin | Mytekkstore"; if (allowed) draw(); }, []);
  useEffect(() => { if (ready) reveal(); }, [ready]);
  if (!allowed) return <Box title="Admins only" text="Sign in with the store admin account to manage products and orders." href="/account?next=/admin" cta="Sign in" />;
  if (!ready) return null;
  const live = orders.filter(o => o.status !== "Cancelled");
  const set = k => e => setF(x => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const saveProduct = async () => {
    const body = { brand: f.brand, cat: f.cat, name: f.name, price: +f.price, mrp: +f.mrp, stock: +f.stock, img: f.img, desc: f.desc, emi: !!f.emi, images: f.images.split("\n").map(s => s.trim()).filter(Boolean), os: f.os.trim(),
      story: f.story.split("\n").map(l => l.split("|").map(x => x.trim())).filter(([t, x]) => t && x).map(([title, text, img]) => ({ title, text, img: img || "" })),
      specs: f.specs.split("\n").map(l => l.split(/:(.*)/s).slice(0, 2).map(x => x.trim())).filter(([k, v]) => k && v) };
    await (f.id ? api("admin/products/" + f.id, "PUT", body) : api("admin/products", "POST", body));
    toast(f.id ? "Product updated" : "Product added");
    await draw();
  };
  const edit = p => { setF({ id: p.id, brand: p.brand, cat: p.cat, name: p.name, price: p.price, mrp: p.mrp, stock: p.stock, img: p.img, desc: p.desc || "", specs: (p.specs || []).map(([k, v]) => k + ": " + v).join("\n"), emi: !!p.emi, images: (p.images || []).join("\n"), os: p.os || "", story: (p.story || []).map(b => [b.title, b.text, b.img].filter(Boolean).join(" | ")).join("\n") }); document.getElementById("pform").scrollIntoView({ behavior: "smooth", block: "center" }); };
  const del = async p => { // two clicks to delete instead of a pop-up
    if (sure !== p.id) { setSure(p.id); setTimeout(() => setSure(s => s === p.id ? null : s), 3000); return; }
    try { await api("admin/products/" + p.id, "DELETE"); toast("Product deleted"); } catch (ex) { toast(ex.message); }
    draw();
  };
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
        <label className="span2">Description<textarea name="desc" rows="4" maxLength="2000" value={f.desc} onChange={set("desc")}></textarea></label>
        <label className="span2">Specifications (one per line, as Name: Value)<textarea name="specs" rows="4" placeholder={"Screen size: 55 inch\nResolution: 4K Ultra HD"} value={f.specs} onChange={set("specs")}></textarea></label>
        <label className="span2">A+ content for the product page (one block per line: Title | Text | img/photo.jpg)<textarea name="story" rows="3" placeholder={"Cinema at home | A 55 inch 4K picture with Dolby Audio. | img/p1.jpg"} value={f.story} onChange={set("story")}></textarea></label>
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
    <section><h2>Customer messages {CFG.sms || CFG.mail ? <span className="stock">sent by {CFG.sms ? "SMS" : "email"}</span> : <span className="stock low">recorded only until an SMS or email provider is connected</span>}</h2>{outbox.length ? <div className="scroll"><table className="tbl"><tbody>
      <tr><th>Time</th><th>To</th><th>Message</th><th>Sent</th></tr>
      {outbox.slice(0, 30).map((m, i) => <tr key={i}><td style={{ whiteSpace: "nowrap" }}>{new Date(m.at).toLocaleString()}</td><td>{m.to}</td><td>{m.text}</td><td>{m.sent || "recorded"}</td></tr>)}
    </tbody></table></div> : <p className="muted">Order confirmations and status updates will be listed here.</p>}</section>
  </>;
}
