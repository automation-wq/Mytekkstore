// Mytekkstore store server. No dependencies. Run: node server.js   (then open http://localhost:3000)
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto"), zlib = require("zlib");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1"; // set HOST=0.0.0.0 on a hosting server
const PUBLIC = path.join(__dirname, "public");
const DATA = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA, { recursive: true });
// when the pages were last built: the stamp web/tidy.js writes at build time (file dates are not reliable on Vercel). The sitemap's lastmod for pages.
const BUILT = (() => { try { return JSON.parse(fs.readFileSync(path.join(PUBLIC, "assets", "builds.json"), "utf8")).built || new Date().toISOString(); } catch { return new Date().toISOString(); } })();
// the visitor's address: behind a proxy (Vercel, nginx) set TRUST_PROXY=1 to use the forwarded one
const ipOf = req => (process.env.TRUST_PROXY && String(req.headers["x-forwarded-for"] || "").split(",").pop().trim()) || req.socket.remoteAddress;
// Client decision of 2026-10-12: the store sells televisions only for now. Products in these categories stay in the data (the admin
// still sees and edits them) but are not served, listed, linked or sold. Empty the list to bring them back.
const HIDDEN_CATS = ["Washing Machines", "Air Conditioners"];
const visible = p => !HIDDEN_CATS.includes(p.cat), live = () => db.products.filter(visible);
// The store locator page is hidden too (the business is B2C only). Remove "stores" here and set SHOW_STORES in web/src/data.js to bring it back.
const HIDDEN_PAGES = ["stores"];
// what is on sale, in words, for the home page title and description
const catWords = () => { const n = [...new Set(live().map(p => p.cat))].map(c => ({ Televisions: "Smart TVs", "Washing Machines": "washing machines", "Air Conditioners": "ACs" })[c] || c.toLowerCase()); return n.length > 1 ? n.slice(0, -1).join(", ") + " and " + n[n.length - 1] : n[0] || "electronics"; };

// ===== optional services: set these environment variables to switch them on (see docs/TRD.md section 11) =====
// SMS through Twilio: order confirmations and sign-in codes. Without them, messages are only recorded in the admin outbox.
const TW = { sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, from: process.env.TWILIO_FROM };
const smsReady = !!(TW.sid && TW.token && TW.from);
const CC = process.env.SMS_COUNTRY_CODE || "+91"; // country code added to mobile numbers typed without one
// OTP by SMS for Indian numbers through MSG91 (a DLT-registered OTP template; the owner's spec of 27 Oct); Twilio for other numbers or when MSG91 is not set
const MSG91 = { key: process.env.MSG91_AUTH_KEY || "", template: process.env.MSG91_TEMPLATE_ID || "" }, msg91Ready = !!(MSG91.key && MSG91.template);
const otpSmsReady = msg91Ready || smsReady;
const RECAPTCHA = { site: process.env.RECAPTCHA_SITE_KEY || "", secret: process.env.RECAPTCHA_SECRET || "" }; // reCAPTCHA v3 on the send-code route, once both keys exist
const MAPS_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || ""; // "Use my current location": the browser's position becomes a pincode through Google Geocoding
// Google sign-in: the OAuth client id from console.cloud.google.com. Without it the Google button is not shown.
const GOOGLE = process.env.GOOGLE_CLIENT_ID || "";
// Microsoft Clarity (free heatmaps and session recordings): set CLARITY_ID to the project id from clarity.microsoft.com and the
// tag loads on every page except the admin; the privacy page then says so. Typed text is masked by Clarity itself.
const CLARITY = /^[a-z0-9]{6,32}$/i.test(process.env.CLARITY_ID || "") ? process.env.CLARITY_ID : "";
// The help bot's assistant: with an Anthropic key the answers come from Claude, fed only the catalogue; without it the browser
// answers from the same catalogue by rules (web/src/chatbot.js). CHAT_MODEL picks the model.
const CHAT_KEY = process.env.ANTHROPIC_API_KEY || "", CHAT_MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5-20251001";
// The Creative Intelligence Agent (creative/): set CREATIVE_URL to its address and the admin's banner editor can ask it for concepts.
const CREATIVE_URL = (process.env.CREATIVE_URL || "").replace(/\/+$/, "");
// Email through Brevo (free tier at brevo.com): sign-in codes sent to an email address, and order messages when there is no SMS.
const BREVO = process.env.BREVO_API_KEY, MAIL_FROM = process.env.MAIL_FROM;
const mailReady = !!(BREVO && MAIL_FROM);
// OTP_DEMO=1 shows sign-in codes on the page even on a hosted store, for a walkthrough before a provider is connected. Never leave it on for real customers.
const OTP_DEMO = process.env.OTP_DEMO === "1";

// ===== storage =====
// ponytail: JSON files and a single process. Fine for a small store; move to SQLite/Postgres
// when orders grow or when more than one server process is needed.
const file = n => path.join(DATA, n + ".json");
function read(n, fallback) {
  if (!fs.existsSync(file(n))) return fallback;
  try { return JSON.parse(fs.readFileSync(file(n), "utf8")); } // a damaged file must stop the store, never be silently replaced
  catch { console.error(`${file(n)} is damaged. Copy the newest good copy from ${path.join(DATA, "backups")} over it, then start the store again.`); process.exit(2); }
}
function write(n) {
  const tmp = file(n) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db[n], null, 1));
  fs.renameSync(tmp, file(n));
  if (DB_URL) dirty.add(n); // and it lands in the database at the next flush, which every response waits for
}
// ===== durable storage: Postgres through Neon's HTTP SQL endpoint, no dependencies (see docs/INTEGRATIONS.md) =====
// DATABASE_URL set: users and orders are rows (one per record, so two serverless instances never overwrite each other's orders),
// sessions are rows, and the admin-edited collections (products, banners, campaigns, outbox) are one JSON document each. Every page
// and API request first pulls what other instances saved (sync); every response waits for its own writes (flush), because a
// serverless instance freezes the moment it answers. DATABASE_URL absent: the JSON files above, exactly as before.
// ponytail: sync re-reads every changed row on every request; fine for thousands of orders, move to per-request queries beyond that.
const DB_URL = process.env.DATABASE_URL || "";
const ROWS = new Set(["users", "orders", "otps", "outbox"]); // the collections kept one row per record: two copies writing different records never overwrite each other
const SQL_ENDPOINT = (() => { if (!DB_URL) return ""; const u = new URL(DB_URL); return (/^(127\.0\.0\.1|localhost)$/.test(u.hostname) ? "http" : "https") + "://" + u.host + "/sql"; })();
async function sql(query, params = []) {
  const r = await fetch(SQL_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "Neon-Connection-String": DB_URL, "Neon-Raw-Text-Output": "true", "Neon-Array-Mode": "false" }, body: JSON.stringify({ query, params }), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("database " + r.status + ": " + (await r.text()).slice(0, 200));
  return (await r.json()).rows || [];
}
const dirty = new Set(), pending = [], snap = {}, kvAt = {}; let docsAt = 0; // snap: per-record collections, id -> JSON as last seen in the database
async function initStore() {
  await sql("CREATE TABLE IF NOT EXISTS kv (k text PRIMARY KEY, v jsonb NOT NULL, at bigint NOT NULL)");
  await sql("CREATE TABLE IF NOT EXISTS docs (col text NOT NULL, id text NOT NULL, v jsonb NOT NULL, at bigint NOT NULL, PRIMARY KEY (col, id))");
  await sql("CREATE TABLE IF NOT EXISTS sessions (token text PRIMARY KEY, user_id text NOT NULL, exp bigint NOT NULL)");
  await sql("CREATE TABLE IF NOT EXISTS stock (id text PRIMARY KEY, n integer NOT NULL)"); // see moveStock
  await sql("CREATE TABLE IF NOT EXISTS files (id text PRIMARY KEY, type text NOT NULL, data text NOT NULL, at bigint NOT NULL)"); // uploaded photos (see admin/upload)
  for (const n of Object.keys(db)) {
    if (ROWS.has(n)) {
      const rows = await sql("SELECT v, at FROM docs WHERE col = $1 ORDER BY at, id", [n]);
      snap[n] = new Map();
      if (rows.length) { db[n] = []; for (const r of rows) { const o = JSON.parse(r.v); db[n].push(o); snap[n].set(String(o.id), JSON.stringify(o)); docsAt = Math.max(docsAt, +r.at); } }
      else dirty.add(n); // an empty database takes what the files hold (nothing on a fresh deployment)
    } else {
      const row = (await sql("SELECT v, at FROM kv WHERE k = $1", [n]))[0];
      if (row) { db[n] = JSON.parse(row.v); kvAt[n] = +row.at; } else dirty.add(n); // the seed goes in once
    }
  }
  if (db.products.length) await sql("INSERT INTO stock (id, n) VALUES " + db.products.map((_, i) => `($${2 * i + 1}, $${2 * i + 2})`).join(", ") + " ON CONFLICT (id) DO NOTHING", db.products.flatMap(p => [String(p.id), p.stock || 0])); // the first run takes the catalogue's counts
  overlayStock(await sql("SELECT id, n FROM stock"));
  await flush();
  console.log("store: database");
}
const overlayStock = rows => { for (const r of rows) { const p = db.products.find(p => String(p.id) === r.id); if (p) p.stock = +r.n; } };
async function sync() { // what other instances saved since this one last looked
  const [kvs, changed, stock] = await Promise.all([sql("SELECT k, at FROM kv"), sql("SELECT col, id, v, at FROM docs WHERE at > $1 ORDER BY at", [String(Math.max(0, docsAt - 5000))]), sql("SELECT id, n FROM stock")]); // 5 s of clock skew between instances is re-read harmlessly
  for (const r of kvs) if (kvAt[r.k] !== undefined && +r.at !== kvAt[r.k] && !dirty.has(r.k)) { const row = (await sql("SELECT v, at FROM kv WHERE k = $1", [r.k]))[0]; if (row) { db[r.k] = JSON.parse(row.v); kvAt[r.k] = +row.at; } }
  for (const r of changed) {
    const col = r.col; if (!ROWS.has(col) || !db[col]) continue;
    const o = JSON.parse(r.v), id = String(o.id), json = JSON.stringify(o);
    docsAt = Math.max(docsAt, +r.at);
    if (snap[col].get(id) === json) continue; // this instance's own write, or one already merged
    const i = db[col].findIndex(x => String(x.id) === id);
    if (i >= 0) db[col][i] = o; else db[col].push(o);
    snap[col].set(id, json);
  }
  overlayStock(stock); // after any catalogue reload above, whose own stock numbers may be old
}
async function flush() { // this instance's writes, before it answers; a write the database refuses stays dirty and goes again with the next flush
  if (!DB_URL) return;
  const jobs = pending.splice(0), names = [...dirty], done = []; // done: [collection, id, json or null], marked saved only once the database has them
  dirty.clear();
  for (const n of names) {
    const now = Date.now();
    if (ROWS.has(n)) {
      const seen = new Set(), vals = [], params = [];
      for (const o of db[n]) { const id = String(o.id), json = JSON.stringify(o); seen.add(id); if (snap[n].get(id) === json) continue; done.push([n, id, json]); params.push(n, id, json, String(now)); const k = params.length; vals.push(`($${k - 3}, $${k - 2}, $${k - 1}::jsonb, $${k})`); }
      if (vals.length) jobs.push(sql("INSERT INTO docs (col, id, v, at) VALUES " + vals.join(", ") + " ON CONFLICT (col, id) DO UPDATE SET v = EXCLUDED.v, at = EXCLUDED.at", params));
      for (const id of [...snap[n].keys()].filter(id => !seen.has(id))) { done.push([n, id, null]); jobs.push(sql("DELETE FROM docs WHERE col = $1 AND id = $2", [n, id])); }
    } else { kvAt[n] = now; jobs.push(sql("INSERT INTO kv (k, v, at) VALUES ($1, $2::jsonb, $3) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, at = EXCLUDED.at", [n, JSON.stringify(db[n]), String(now)])); }
  }
  try { await Promise.all(jobs); } catch (e) { names.forEach(n => dirty.add(n)); throw e; } // every write is an upsert or a delete, so sending it again is safe
  for (const [n, id, json] of done) json === null ? snap[n].delete(id) : snap[n].set(id, json);
}
const seedProducts = () => JSON.parse(fs.readFileSync(path.join(PUBLIC, "seed-data.js"), "utf8").replace(/^[^[]*/, "").replace(/;\s*$/, ""));
const db = {
  products: read("products", null) || seedProducts(),
  outbox: read("outbox", []).map((m, i) => m.id ? m : { id: "old" + String(i).padStart(4, "0"), ...m }), // messages saved before they had ids
  users: read("users", []),
  orders: read("orders", []),
  otps: read("otps", []), // sign-in codes: salted hashes only, 5 minutes each
};
if (!fs.existsSync(file("products"))) write("products");
// ponytail: one-off migration. Products saved before the No Cost EMI flag existed take the seed's value for the same id.
if (db.products.some(p => p.emi === undefined)) {
  const seed = seedProducts();
  db.products.forEach(p => { if (p.emi === undefined) p.emi = !!(seed.find(x => x.id === p.id) || {}).emi; });
  write("products");
}
// ponytail: one-off migration. Products saved before the operating system field existed take the seed's value for the same id.
if (db.products.some(p => p.os === undefined)) {
  const seed = seedProducts();
  db.products.forEach(p => { if (p.os === undefined) p.os = (seed.find(x => x.id === p.id) || {}).os || ""; });
  write("products");
}
// banners (the banner engine: home slides, product heroes, campaign heroes) and campaign pages; SAMPLE content until the admin saves
const SEED_CONTENT = require("./seed-content.js");
db.banners = read("banners", null) || SEED_CONTENT.banners;
db.campaigns = read("campaigns", null) || SEED_CONTENT.campaigns;
// pages and API calls wait for the database to load; a failure answers 503 rather than serving /tmp, and the next request tries again
let loading = null;
const ready = () => loading || (loading = initStore().catch(e => { loading = null; throw e; }));
if (DB_URL) ready().catch(e => console.error("database:", e.message));

// ===== passwords and sessions =====
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
function makeUser(name, email, password, admin = false, extra = {}) { // extra: phone + phoneVerified for a phone sign-up, google for a Google sign-in
  const salt = crypto.randomBytes(16).toString("hex");
  const u = { id: crypto.randomUUID(), name, email, salt, hash: password ? hashPw(password, salt) : "", admin, phone: "", address: "", pin: "", ...extra };
  db.users.push(u); write("users");
  return u;
}
function checkPw(u, password) {
  if (!u.hash) return false; // an account made with a phone number or Google has no password
  const a = Buffer.from(hashPw(password, u.salt), "hex"), b = Buffer.from(u.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// First run: create one admin with a random password and save the login in data/ADMIN_LOGIN.txt
if (!db.users.some(u => u.admin)) {
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url"); // ADMIN_PASSWORD: set it on a host like Vercel, where data/ADMIN_LOGIN.txt cannot be opened
  makeUser("Store Admin", "admin@mytekkstore.local", pw, true);
  fs.writeFileSync(path.join(DATA, "ADMIN_LOGIN.txt"), `Admin sign-in for the Mytekkstore store\nEmail: admin@mytekkstore.local\nPassword: ${pw}\n`);
}
// ponytail: sessions live in memory, so everyone is signed out when the server restarts. Persist them if that matters.
const sessions = new Map(); // token -> { userId, exp }
const WEEK = 7 * 24 * 3600 * 1000;
async function currentUser(req) {
  const m = /(?:^|;\s*)sid=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  let s = sessions.get(m[1]);
  if (!s && DB_URL) { // another instance signed this visitor in: the row is in the database
    const row = (await sql("SELECT user_id, exp FROM sessions WHERE token = $1", [m[1]]))[0];
    if (row) { s = { userId: row.user_id, exp: +row.exp }; sessions.set(m[1], s); }
  }
  if (!s || s.exp < Date.now()) return null;
  return db.users.find(u => u.id === s.userId) || null;
}
function startSession(req, res, user) {
  for (const [t, s] of sessions) if (s.exp < Date.now()) sessions.delete(t); // forget expired sessions and old lockouts
  for (const [k, f] of fails) if (f.until < Date.now()) fails.delete(k);
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { userId: user.id, exp: Date.now() + WEEK });
  user.lastLogin = new Date().toISOString(); write("users");
  if (DB_URL) pending.push(sql("INSERT INTO sessions (token, user_id, exp) VALUES ($1, $2, $3) ON CONFLICT (token) DO UPDATE SET exp = EXCLUDED.exp", [token, String(user.id), String(Date.now() + WEEK)]), sql("DELETE FROM sessions WHERE exp < $1", [String(Date.now())]));
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${WEEK / 1000}${secure}`);
}
const fails = new Map(); // "ip email" -> { n, until } : slows down password guessing
const publicUser = u => u && { hasPassword: !!u.hash, name: u.name, email: u.email, phone: u.phone, phoneVerified: !!u.phoneVerified, address: u.address, pin: u.pin, admin: u.admin, addresses: u.addresses || [], coupons: u.coupons || [], smsOffers: u.smsOffers !== false, emailOffers: u.emailOffers !== false, since: u.since || "" };
// the welcome coupon of the owner's sign-up design: ₹500 on the first order of ₹15,000 or more, 30 days, once
const welcomeCoupon = () => ({ code: "MYTEKK500", value: 500, minOrder: 15000, expires: new Date(Date.now() + 30 * 86400000).toISOString(), used: false, issued: new Date().toISOString() });
// a coupon the customer typed at checkout: its discount, or a plain reason it does not apply
const couponFor = (user, code, total) => {
  if (!code) return { discount: 0, code: "" };
  const c = (user.coupons || []).find(c => c.code === String(code).trim().toUpperCase());
  if (!c) bad("That coupon code is not in your account.");
  if (c.used) bad("This coupon has already been used.");
  if (new Date(c.expires) < new Date()) bad("This coupon has expired.");
  if (total < c.minOrder) bad(`This coupon needs an order of at least ₹${c.minOrder.toLocaleString("en-IN")}.`);
  return { discount: Math.min(c.value, total), code: c.code };
};
const useCoupon = (user, code) => { const c = user && (user.coupons || []).find(c => c.code === code); if (c && !c.used) { c.used = true; c.usedAt = new Date().toISOString(); write("users"); } };
// saved addresses: up to 8, one default; the default also fills the old address and pin fields the checkout and the header read
const addrFrom = b => ({ label: ["Home", "Work", "Other"].includes(b.label) ? b.label : "Home", name: str(b.name, "Name", 80), line1: str(b.line1, "Flat / house no., building", 160), line2: b.line2 ? str(b.line2, "Area, street", 160) : "", landmark: b.landmark ? str(b.landmark, "Landmark", 120) : "", city: str(b.city, "City", 80), state: str(b.state, "State", 80), pin: str(b.pin, "Pincode", 6, /^\d{6}$/), phone: e164(str(b.phone, "Phone", 15, /^[0-9+ ]{7,15}$/)) });
const addrText = a => [a.line1, a.line2, a.landmark, a.city + ", " + a.state].filter(Boolean).join(", ");
const setDefaultAddress = (user, id) => { (user.addresses || []).forEach(a => a.isDefault = a.id === id); const d = (user.addresses || []).find(a => a.isDefault); if (d) { user.address = addrText(d); user.pin = d.pin; if (!user.phone) user.phone = d.phone; } };
const addrOut = user => ({ addresses: user.addresses || [], user: publicUser(user) });

// ===== validation =====
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = msg => { throw new HttpError(400, msg); };
function str(v, label, max = 200, pattern) {
  if (typeof v !== "string" || !(v = v.trim()) || v.length > max) bad(`${label} is required (max ${max} characters).`);
  if (pattern && !pattern.test(v)) bad(`${label} is not valid.`);
  return v;
}
function int(v, label, min, max) {
  if (!Number.isInteger(v) || v < min || v > max) bad(`${label} must be a whole number from ${min} to ${max}.`);
  return v;
}
function productFrom(b) {
  const p = {
    brand: str(b.brand, "Brand", 60), cat: str(b.cat, "Category", 60), name: str(b.name, "Name", 160),
    price: int(b.price, "Price", 1, 1e8), mrp: int(b.mrp, "MRP", 1, 1e8), stock: int(b.stock, "Stock", 0, 1e6),
    img: str(b.img, "Image", 300, /^(img\/[\w.-]+(?:\/[\w.-]+)?|files\/[a-f0-9]{16}\.jpg|https:\/\/[^\s"'<>]+)$/),
    desc: typeof b.desc === "string" && b.desc.trim() ? str(b.desc, "Description", 2000) : "",
    emi: !!b.emi, // shows the "No Cost EMI" tag
    os: typeof b.os === "string" && b.os.trim() ? str(b.os, "Operating system", 40) : "", // Google TV, WebOS, Android TV: Shop by OS and the comparison chart
    // A+ content blocks on the product page: [{ title, text, img }], up to 8
    story: Array.isArray(b.story) ? b.story.slice(0, 8).map(x => ({ title: str(x && x.title, "A+ title", 80), text: str(x && x.text, "A+ text", 600), img: x && typeof x.img === "string" && x.img.trim() ? str(x.img, "A+ photo", 300, /^(img\/[\w.-]+(?:\/[\w.-]+)?|files\/[a-f0-9]{16}\.jpg|https:\/\/[^\s"'<>]+)$/) : "" })) : [],
    // extra photos for the product page gallery (thumbnails), up to 8 links
    images: Array.isArray(b.images) ? b.images.slice(0, 8).map(s => str(s, "Photo link", 300, /^(img\/[\w.-]+(?:\/[\w.-]+)?|files\/[a-f0-9]{16}\.jpg|https:\/\/[^\s"'<>]+)$/)) : [],
    aplus: Array.isArray(b.aplus) ? b.aplus.slice(0, 12).map(s => str(s, "A+ image link", 300, /^(img\/[\w.-]+(?:\/[\w.-]+)?|files\/[a-f0-9]{16}\.jpg|https:\/\/[^\s"'<>]+)$/)) : [], // full-width creatives, stacked down the product page
    // 360-degree spin: frames shot around the product (8 to 48), drag to rotate on the product page; empty = the normal photo
    spin: Array.isArray(b.spin) ? b.spin.slice(0, 48).map(s => str(s, "Spin frame", 300, /^(img\/[\w.-]+(?:\/[\w.-]+)?|files\/[a-f0-9]{16}\.jpg|https:\/\/[^\s"'<>]+)$/)) : [],
    specs: [],
  };
  if (p.mrp < p.price) bad("MRP cannot be lower than the price.");
  // specs: list of [name, value] pairs shown on the product page
  if (b.specs !== undefined) {
    if (!Array.isArray(b.specs) || b.specs.length > 40) bad("Specifications are not valid.");
    p.specs = b.specs.map(s => Array.isArray(s) && s.length === 2 ? [str(s[0], "Specification name", 60), str(s[1], "Specification value", 200)] : bad("Each specification needs a name and a value."));
  }
  return p;
}
const STATUSES = ["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"];
const RETURN_DAYS = 7; // the return window (POLICY.returnDays in web/src/data.js says the same)
// ===== customer messages =====
// Every message is recorded in the outbox (shown in the admin). With Twilio set up it is also sent by SMS, or by WhatsApp when
// TWILIO_FROM starts with "whatsapp:".
const e164 = p => { p = String(p).replace(/[^\d+]/g, ""); return p.startsWith("+") ? p : CC + p.replace(/^0+/, ""); };
async function sendSms(to, text) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW.sid}/Messages.json`, {
    method: "POST", headers: { Authorization: "Basic " + Buffer.from(TW.sid + ":" + TW.token).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: TW.from.startsWith("whatsapp:") ? "whatsapp:" + to : to, From: TW.from, Body: text }),
  });
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
async function sendOtpSms(to, code, text) { // the code is ours, so the hash check stays here whichever service carries the message
  if (msg91Ready && to.startsWith("+91")) {
    const r = await fetch(`https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(MSG91.template)}&mobile=${to.slice(1)}&otp=${code}`, { method: "POST", headers: { authkey: MSG91.key, "Content-Type": "application/json" }, body: JSON.stringify({ OTP: code }) });
    const j = r.ok ? await r.json().catch(() => ({})) : {};
    if (!r.ok || j.type === "error") throw new Error(`MSG91 ${r.status}: ${String(j.message || "").slice(0, 200)}`);
    return "msg91";
  }
  await sendSms(to, text); return "twilio";
}
async function welcome(u) { // the welcome message of the sign-up design: SMS when a sender exists, email when one exists, recorded in the outbox either way
  const text = `Welcome to Mytekkstore, ${u.name}. Your welcome code MYTEKK500 gives ₹500 off your first order of ₹15,000 or more, valid 30 days. Free delivery and cash on delivery on every TV.`;
  try {
    if (u.phone && smsReady) { await sendSms(u.phone, text); record(u.phone, text, "sent by sms"); } else if (u.phone) record(u.phone, text, "recorded only");
    if (u.email && mailReady) { await sendMail(u.email, "Welcome to Mytekkstore", text); record(u.email, text, "sent by email"); }
  } catch (e) { console.error("welcome:", e.message); }
}
async function sendMail(to, subject, text) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: { name: "Mytekkstore", email: MAIL_FROM }, to: [{ email: to }], subject, textContent: text }) });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
function record(to, text, sent) {
  const m = { id: Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), at: new Date().toISOString(), to, text, sent }; // one row each with a database
  db.outbox.push(m);
  if (db.outbox.length > 500) db.outbox.shift();
  write("outbox");
  return m;
}
// order confirmations and status updates: recorded at once, then sent in the background (SMS first, else email) so an order is never held up
function notify(o, text) {
  const via = smsReady && o.phone ? "sms" : mailReady && o.email ? "email" : "";
  const m = record(`${o.name} (${o.phone}${o.email ? ", " + o.email : ""})`, text, via ? "sending by " + via : "recorded only");
  if (!via) return;
  (via === "sms" ? sendSms(e164(o.phone), text) : sendMail(o.email, "Mytekkstore order " + o.id, text))
    .then(() => { m.sent = "sent by " + via; write("outbox"); }, e => { m.sent = "failed: " + e.message; write("outbox"); console.error(e); });
}

// ===== API =====
const routes = [];
const on = (method, pattern, fn, need) => routes.push({ method, re: new RegExp("^/api/" + pattern + "$"), fn, need });

const publicProduct = p => ({ ...p, reviews: (p.reviews || []).map(({ userId, ...r }) => r), questions: (p.questions || []).map(({ userId, answers, ...q }) => ({ ...q, answers: (answers || []).map(({ userId: u, ...a }) => a) })) });
on("GET", "products", ({ req, user }) => ({ products: (user && user.admin && /[?&]all=1\b/.test(req.url) ? db.products : live()).map(publicProduct) })); // the admin asks for all=1 to see hidden categories
// one review per customer per product; a new review replaces the old one
on("POST", "products/(\\d+)/reviews", ({ params, body, user }) => {
  const p = db.products.find(p => p.id === +params[0]);
  if (!p) throw new HttpError(404, "Product not found.");
  const r = { name: user.name, userId: user.id, rating: int(body.rating, "Rating", 1, 5), text: str(body.text, "Review", 500), at: new Date().toISOString() };
  p.reviews = (p.reviews || []).filter(x => x.userId !== user.id);
  p.reviews.push(r);
  write("products");
  return { product: publicProduct(p) };
}, "user");
// questions and answers: anyone signed in can ask a question or answer one; stored on the product, newest question first
on("POST", "products/(\\d+)/questions", ({ params, body, user }) => {
  const p = db.products.find(p => p.id === +params[0]);
  if (!p) throw new HttpError(404, "Product not found.");
  const q = { id: Math.max(0, ...(p.questions || []).map(x => x.id)) + 1, name: user.name, userId: user.id, text: str(body.text, "Question", 300), at: new Date().toISOString(), answers: [] };
  p.questions = [q, ...(p.questions || [])];
  write("products");
  return { product: publicProduct(p) };
}, "user");
on("POST", "products/(\\d+)/questions/(\\d+)/answers", ({ params, body, user }) => {
  const p = db.products.find(p => p.id === +params[0]);
  if (!p) throw new HttpError(404, "Product not found.");
  const q = (p.questions || []).find(x => x.id === +params[1]);
  if (!q) throw new HttpError(404, "Question not found.");
  q.answers.push({ name: user.name, userId: user.id, text: str(body.text, "Answer", 300), at: new Date().toISOString() });
  write("products");
  return { product: publicProduct(p) };
}, "user");
on("GET", "me", ({ user }) => ({ user: publicUser(user) }));
// profile: name, phone and address, kept for the next checkout. A changed number has to be verified again.
// a new password for the signed-in customer: the "forgot password" path is a one-time code sign-in followed by this
on("POST", "me/password", ({ body, user }) => {
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 200) bad("Password must be at least 8 characters.");
  user.salt = crypto.randomBytes(16).toString("hex"); user.hash = hashPw(body.password, user.salt); write("users");
  return { ok: true };
}, "user");
on("PATCH", "me", ({ body, user }) => {
  const patch = {};
  if (body.name !== undefined) patch.name = str(body.name, "Name", 80);
  if (body.phone !== undefined) { const np = body.phone ? e164(str(body.phone, "Phone", 15, /^[0-9+ ]{7,15}$/)) : ""; if (np !== user.phone) { patch.phone = np; patch.phoneVerified = false; } }
  if (body.address !== undefined) patch.address = body.address ? str(body.address, "Address", 400) : "";
  if (body.pin !== undefined) patch.pin = body.pin ? str(body.pin, "Pincode", 10, /^[0-9A-Za-z ]{4,10}$/) : "";
  if (body.email !== undefined && body.email !== user.email) { const em = body.email ? str(body.email, "Email", 120, /^[^\s@]+@[^\s@]+\.[^\s@]+$/).toLowerCase() : ""; if (em && db.users.some(x => x.email === em && x.id !== user.id)) throw new HttpError(409, "An account with this email already exists."); patch.email = em; if (em) patch.emailVerified = false; }
  if (body.smsOffers !== undefined) patch.smsOffers = !!body.smsOffers;
  if (body.emailOffers !== undefined) patch.emailOffers = !!body.emailOffers;
  Object.assign(user, patch); write("users");
  return { user: publicUser(user) };
}, "user");
on("GET", "me/addresses", ({ user }) => addrOut(user), "user");
on("POST", "me/addresses", ({ body, user }) => {
  user.addresses = user.addresses || [];
  if (user.addresses.length >= 8) bad("You can keep up to 8 addresses. Delete one to add another.");
  const a = { id: crypto.randomBytes(4).toString("hex"), ...addrFrom(body), isDefault: false };
  user.addresses.push(a);
  if (body.isDefault || user.addresses.length === 1) setDefaultAddress(user, a.id);
  write("users"); return addrOut(user);
}, "user");
on("POST", "me/addresses/([a-f0-9]{8})", ({ params, body, user }) => {
  const a = (user.addresses || []).find(x => x.id === params[0]); if (!a) throw new HttpError(404, "Address not found.");
  Object.assign(a, addrFrom(body));
  if (body.isDefault || a.isDefault) setDefaultAddress(user, a.id);
  write("users"); return addrOut(user);
}, "user");
on("POST", "me/addresses/([a-f0-9]{8})/default", ({ params, user }) => { if (!(user.addresses || []).some(x => x.id === params[0])) throw new HttpError(404, "Address not found."); setDefaultAddress(user, params[0]); write("users"); return addrOut(user); }, "user");
on("POST", "me/addresses/([a-f0-9]{8})/delete", ({ params, user }) => {
  const i = (user.addresses || []).findIndex(x => x.id === params[0]); if (i < 0) throw new HttpError(404, "Address not found.");
  const [gone] = user.addresses.splice(i, 1);
  if (gone.isDefault) { if (user.addresses[0]) setDefaultAddress(user, user.addresses[0].id); else { user.address = ""; user.pin = ""; } }
  write("users"); return addrOut(user);
}, "user");
// the customer's own reviews, across the catalogue (the public product strips who wrote what)
on("GET", "me/reviews", ({ user }) => ({ reviews: db.products.flatMap(p => (p.reviews || []).filter(r => r.userId === user.id).map(({ userId, ...r }) => ({ ...r, productId: p.id, product: p.name, brand: p.brand, img: p.img }))) }), "user");

on("POST", "register", ({ body, req, res }) => {
  const name = str(body.name, "Name", 80), email = str(body.email, "Email", 120, /^[^\s@]+@[^\s@]+\.[^\s@]+$/).toLowerCase();
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 200) bad("Password must be at least 8 characters.");
  if (db.users.some(u => u.email === email)) throw new HttpError(409, "An account with this email already exists.");
  const u = makeUser(name, email, body.password);
  startSession(req, res, u);
  return { user: publicUser(u) };
});
on("POST", "login", ({ body, req, res }) => {
  const email = String(body.email || "").trim().toLowerCase();
  // behind a reverse proxy every request arrives from the proxy's address, so set TRUST_PROXY=1 there to use the forwarded one
  const ip = (process.env.TRUST_PROXY && String(req.headers["x-forwarded-for"] || "").split(",").pop().trim()) || req.socket.remoteAddress;
  const key = ip + " " + email, f = fails.get(key); // per address and account, so one attacker cannot lock everyone out
  if (f && f.n >= 5 && f.until > Date.now()) throw new HttpError(429, "Too many attempts. Please try again in 15 minutes.");
  const u = email && db.users.find(u => u.email === email); // phone-only accounts have no email, so a blank email must not match them
  if (!u || typeof body.password !== "string" || !checkPw(u, body.password)) {
    fails.set(key, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60 * 1000 });
    throw new HttpError(401, "Wrong email or password.");
  }
  fails.delete(key);
  startSession(req, res, u);
  return { user: publicUser(u) };
});
on("POST", "logout", ({ req, res }) => {
  const m = /(?:^|;\s*)sid=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || "");
  if (m) { sessions.delete(m[1]); if (DB_URL) pending.push(sql("DELETE FROM sessions WHERE token = $1", [m[1]])); }
  res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  return {};
});

// ===== sign in with a one-time code, by mobile number (SMS through Twilio) or by email (Brevo) =====
// The server makes a 6-digit code, keeps only its hash for 5 minutes and sends it. Without a provider the code is returned to the
// page on localhost (or anywhere with OTP_DEMO=1) so the flow can be tried; otherwise the route says codes are not set up.
// one row per destination in db.otps { id: destination, hash, salt, exp, tries, sentAt, lock }: with a database every server copy sees
// the same code and the same wrong-code count, because the copy that checks a code is often not the copy that sent it
const otpOf = to => db.otps.find(o => o.id === to);
const isLocal = req => !req.headers["x-forwarded-for"] && /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || ""); // the developer's own machine only, never a request that came through a proxy
const phoneOf = v => { const p = str(v, "Mobile number", 20).replace(/[\s-]/g, ""); if (!/^\+?\d{10,15}$/.test(p)) bad("Please enter a valid mobile number or email address."); return e164(p); };
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
// the page sends { to }; older callers send { phone } or { email }
const destOf = body => { const v = body.to !== undefined ? body.to : body.email !== undefined ? body.email : body.phone; return isEmail(v) ? { kind: "email", to: str(v, "Email", 120).toLowerCase() } : { kind: "sms", to: phoneOf(v) }; };
const otpIp = new Map(); // address -> [sentAt]: ten codes per address per hour (the local machine is exempt so the suites can run)
const lockedUntil = to => { const o = otpOf(to); return o && o.lock > Date.now() ? o.lock : 0; }; // fifteen minutes after five wrong codes
const lockText = until => { const m = Math.max(1, Math.ceil((until - Date.now()) / 60000)); return `Too many wrong attempts. Please try again in ${m} minute${m === 1 ? "" : "s"}.`; };
async function checkRecaptcha(token, req) { // reCAPTCHA v3, only once the keys exist
  if (!RECAPTCHA.secret) return;
  if (!token) throw new HttpError(403, "The security check did not load. Please reload the page and try again.");
  const r = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ secret: RECAPTCHA.secret, response: String(token).slice(0, 3000), remoteip: ipOf(req) || "" }) });
  const j = r.ok ? await r.json().catch(() => ({})) : {};
  if (!j.success || (typeof j.score === "number" && j.score < 0.5)) throw new HttpError(403, "The security check failed. Please try again.");
}
on("POST", "otp/send", async ({ body, req }) => {
  const { kind, to } = destOf(body), now = Date.now(), ready = kind === "sms" ? otpSmsReady : mailReady;
  if (!ready && !isLocal(req) && !OTP_DEMO) throw new HttpError(503, (kind === "sms" ? "SMS codes are not set up yet." : "Email codes are not set up yet.") + (kind === "sms" && mailReady ? " Use your email address instead, or" : " Please") + " sign in with your password.");
  await checkRecaptcha(body.recaptchaToken, req);
  const until = lockedUntil(to); if (until) throw new HttpError(423, lockText(until));
  db.otps = db.otps.filter(o => o.sentAt[o.sentAt.length - 1] >= now - 15 * 60 * 1000 || (o.lock || 0) > now); // forget destinations with no code in the last 15 minutes and no lock
  const sentAt = ((otpOf(to) || {}).sentAt || []).filter(t => t > now - 15 * 60 * 1000);
  if (sentAt.length >= 3) throw new HttpError(429, "Too many codes requested. Please try again in 15 minutes.");
  if (!isLocal(req)) { const ip = ipOf(req), hits = (otpIp.get(ip) || []).filter(t => t > now - 3600000); if (hits.length >= 10) throw new HttpError(429, "Too many codes requested from this connection. Please try again in an hour."); otpIp.set(ip, [...hits, now]); if (otpIp.size > 5000) otpIp.clear(); }
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0"), salt = crypto.randomBytes(8).toString("hex");
  db.otps = [...db.otps.filter(o => o.id !== to), { id: to, hash: hashPw(code, salt), salt, exp: now + 5 * 60 * 1000, tries: 0, sentAt: [...sentAt, now] }]; write("otps"); // a new code replaces the old one
  const text = `${code} is your Mytekkstore sign-in code. It is valid for 5 minutes. Do not share it.`;
  const known = db.users.some(u => kind === "email" ? u.email === to : u.phone === to && u.phoneVerified); // the page only uses this for a hint
  if (ready) { const via = kind === "sms" ? await sendOtpSms(to, code, text) : (await sendMail(to, "Your Mytekkstore sign-in code", text), "email"); record(to, text, "sent by " + via); return { sent: true, via: kind, resendAfter: 30, newUser: !known }; }
  record(to, text, "recorded only");
  return { sent: true, via: "demo", demoCode: code, resendAfter: 30, newUser: !known }; // only on localhost or with OTP_DEMO=1 (see the 503 above)
});
on("POST", "otp/verify", async ({ body, req, res, user: signedIn }) => {
  const { kind, to } = destOf(body), code = String(body.code || "").trim(), o = otpOf(to);
  const until = lockedUntil(to); if (until) throw new HttpError(423, lockText(until));
  if (!o || o.exp < Date.now()) throw new HttpError(400, "That code has expired. Please request a new one.");
  const a = Buffer.from(hashPw(code, o.salt), "hex"), b = Buffer.from(o.hash, "hex");
  if (!/^\d{6}$/.test(code) || !crypto.timingSafeEqual(a, b)) {
    o.tries++; write("otps"); // the error reply still saves the count (the route's catch flushes)
    if (o.tries >= 5) { o.exp = 0; o.lock = Date.now() + 15 * 60 * 1000; throw new HttpError(423, "Too many wrong attempts. Please try again in 15 minutes."); }
    throw new HttpError(401, `Wrong code. Please check the message and try again (${5 - o.tries} ${5 - o.tries === 1 ? "try" : "tries"} left).`);
  }
  let u;
  if (kind === "email") u = db.users.find(u => u.email === to); // an email code signs into the account with that email, password or not
  else { const owners = db.users.filter(u => u.phone === to); u = owners.find(u => u.phoneVerified) || (owners.length === 1 ? owners[0] : null); } // the number's own account, or the one customer who used it on orders
  // a signed-in account without a verified number (Google, or an email sign-up) claims the number it just verified
  if (kind === "sms" && signedIn && !signedIn.phoneVerified) {
    if (u && u.id !== signedIn.id && u.phoneVerified) throw new HttpError(409, "This number is already on another account. Sign out and sign in with the number, or use a different number.");
    signedIn.phone = to; signedIn.phoneVerified = true; write("users"); o.exp = 0; write("otps");
    return { user: publicUser(signedIn), linked: true };
  }
  if (u && kind === "email" && !u.emailVerified) { u.emailVerified = true; write("users"); }
  if (u && kind === "sms" && !u.phoneVerified) { u.phoneVerified = true; write("users"); }
  let created = false;
  if (!u) {
    if (typeof body.name !== "string" || !body.name.trim()) return { newUser: true }; // the page asks for a name, then verifies again
    const email = kind === "email" ? to : isEmail(body.email) ? String(body.email).trim().toLowerCase() : "";
    if (email && kind !== "email" && db.users.some(x => x.email === email)) throw new HttpError(409, "An account with this email already exists. Sign in with that email, or leave the email empty.");
    const pin = /^\d{6}$/.test(String(body.pin || "")) ? String(body.pin) : "";
    u = makeUser(str(body.name, "Name", 80), email, "", false, { ...(kind === "email" ? { emailVerified: true } : { phone: to, phoneVerified: true }), pin, since: new Date().toISOString(), coupons: [welcomeCoupon()] }); // the sign-up design: ₹500 off the first order
    created = true;
  }
  o.exp = 0; write("otps"); // the code is used up; the send count for this number is kept for the rate limit
  startSession(req, res, u);
  if (created) await welcome(u);
  return { user: publicUser(u), created };
});
// ===== sign in with Google =====
// The page gets an ID token from Google's sign-in button and posts it here. Google confirms the token and tells us the account.
on("POST", "login/google", async ({ body, req, res }) => {
  if (!GOOGLE) throw new HttpError(503, "Google sign-in is not set up yet.");
  const credential = str(body.credential, "Google sign-in", 4000);
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
  const t = r.ok ? await r.json() : {};
  if (t.aud !== GOOGLE || !/^(https:\/\/)?accounts\.google\.com$/.test(t.iss || "") || t.email_verified !== "true" || !t.email || !t.sub || !(+t.exp * 1000 > Date.now())) throw new HttpError(401, "Google sign-in failed. Please try again.");
  const email = t.email.toLowerCase();
  let u = db.users.find(u => u.email === email);
  if (!u) u = makeUser(str(t.name || email.split("@")[0], "Name", 80), email, "", false, { google: t.sub });
  else if (!u.google) { u.google = t.sub; write("users"); } // an existing email account is linked to the Google account
  else if (u.google !== t.sub) throw new HttpError(409, "This email is already linked to a different Google account. Sign in with that account, or with your password.");
  startSession(req, res, u);
  return { user: publicUser(u) };
});
// what the pages need to know about the optional services
// ===== destinations and currencies =====
// Only India is enabled for ordering and shipping. The others are display currencies for visitors; they open for ordering only
// after the business, the gateway and the logistics approve them (docs/AUTH_AI_CHECKOUT.md). Every order is charged in INR.
const DESTINATIONS = {
  IN: { name: "India", display: "INR", charge: ["INR"], settle: "INR", methods: ["cod", "online"], ship: true, delivery: "3 to 5 days", tax: "GST included in the price" },
  AE: { name: "United Arab Emirates", display: "AED", charge: [], settle: "INR", methods: [], ship: false, delivery: "", tax: "Import duties would apply" },
  US: { name: "United States", display: "USD", charge: [], settle: "INR", methods: [], ship: false, delivery: "", tax: "Import duties would apply" },
  SA: { name: "Saudi Arabia", display: "SAR", charge: [], settle: "INR", methods: [], ship: false, delivery: "", tax: "Import duties would apply" },
};
function destinationOf(body) {
  const code = body.country == null ? "IN" : str(body.country, "Country", 2, /^[A-Z]{2}$/);
  const d = DESTINATIONS[code];
  if (!d || !d.ship) throw new HttpError(422, "We deliver within India only for now. Other countries open once shipping, duties and warranty cover are confirmed.");
  return d;
}
// display rates from the European-sourced Frankfurter feed (free, no key, daily), the old constants as the fallback; refreshed every 6 hours
const FX_STATIC = { AED: 0.044, USD: 0.012, SAR: 0.0395 };
let fx = { rates: FX_STATIC, date: "", source: "static", at: 0 };
async function refreshFx() {
  if (Date.now() - fx.at < 6 * 3600000) return;
  fx.at = Date.now();
  try {
    const r = await fetch("https://api.frankfurter.dev/v2/rates?base=INR&quotes=AED,USD,SAR", { signal: AbortSignal.timeout(2500) }); // short: the config call waits for it
    if (!r.ok) return;
    const rows = await r.json(), rates = { ...FX_STATIC };
    for (const x of rows) if (x.quote && x.rate > 0) rates[x.quote] = x.rate;
    fx = { rates, date: (rows[0] && rows[0].date) || "", source: "frankfurter", at: Date.now() };
  } catch { /* the last rates stay */ }
}
const fxNow = async () => { await refreshFx(); return { rates: fx.rates, date: fx.date, source: fx.source, note: "Display only. Every order is charged in INR." }; };

// ===== payments: a provider behind one interface; "demo" until gateway keys are set =====
const RZP = { id: process.env.RAZORPAY_KEY_ID || "", secret: process.env.RAZORPAY_KEY_SECRET || "", webhook: process.env.RAZORPAY_WEBHOOK_SECRET || "" };
const PAY_PROVIDER = RZP.id && RZP.secret ? "razorpay" : "demo";
const hmac = (secret, msg) => crypto.createHmac("sha256", secret).update(msg).digest("hex");
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
// Razorpay: checkout signature = HMAC-SHA256(order_id + "|" + payment_id, key secret); webhook signature = HMAC-SHA256(raw body, webhook secret)
const verifyCheckoutSignature = (orderId, paymentId, signature, secret) => !!signature && !!secret && safeEq(hmac(secret, orderId + "|" + paymentId), String(signature));
const verifyWebhookSignature = (rawBody, signature, secret) => !!signature && !!secret && safeEq(hmac(secret, rawBody), String(signature));
async function razorpayCreateOrder(amount, receipt) { // amount in paise
  let r;
  try { r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { "content-type": "application/json", authorization: "Basic " + Buffer.from(RZP.id + ":" + RZP.secret).toString("base64") }, body: JSON.stringify({ amount, currency: "INR", receipt }), signal: AbortSignal.timeout(15000) }); }
  catch { throw new HttpError(502, "The payment service is not reachable right now. Please try again."); }
  if (!r.ok) { console.error("razorpay order", r.status); throw new HttpError(502, "The payment service could not start this payment. Please try again."); }
  return r.json();
}
// the cart, priced and stock-checked from the server's own product list, never from the browser
function buildLines(items) {
  if (!Array.isArray(items) || !items.length || items.length > 50) bad("Your cart is empty.");
  const lines = items.map(it => {
    const p = it && typeof it === "object" && db.products.find(p => p.id === it.id && visible(p)); // a hidden category cannot be ordered
    if (!p) bad("A product in your cart is no longer available.");
    const qty = int(it.qty, "Quantity", 1, 10);
    if (p.stock < qty) throw new HttpError(409, p.stock ? `Only ${p.stock} left of ${p.brand} ${p.name}.` : `${p.brand} ${p.name} is out of stock.`);
    return { p, qty };
  });
  if (new Set(lines.map(l => l.p.id)).size !== lines.length) bad("Duplicate items in cart.");
  return lines;
}
// With a database, stock lives in its own table and "take 2 if 2 are left" is one statement, so two server copies selling the same TV
// at the same moment can never both pass the last unit (the products document's stock is a copy, refreshed by every sync).
// delta < 0 takes, > 0 returns; strict refuses rather than going below zero. Returns false when refused.
async function moveStock(p, delta, strict = true) {
  if (!DB_URL) { if (strict && p.stock + delta < 0) return false; p.stock = Math.max(0, p.stock + delta); write("products"); return true; }
  const rows = await sql(strict ? "UPDATE stock SET n = n + $2 WHERE id = $1 AND n + $2 >= 0 RETURNING n" : "UPDATE stock SET n = GREATEST(n + $2, 0) WHERE id = $1 RETURNING n", [String(p.id), delta]);
  if (rows.length) { p.stock = +rows[0].n; return true; }
  const now = (await sql("SELECT n FROM stock WHERE id = $1", [String(p.id)]))[0]; if (now) p.stock = +now.n; // refused: the page's message shows what is really left
  return false;
}
const setStock = p => DB_URL ? sql("INSERT INTO stock (id, n) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET n = EXCLUDED.n", [String(p.id), p.stock]) : null; // the admin's own count
async function takeLines(lines, why = "") { // all or nothing: a refused line gives back the ones already taken
  const taken = [];
  for (const l of lines) {
    if (await moveStock(l.p, -l.qty)) { taken.push(l); continue; }
    for (const t of taken) await moveStock(t.p, t.qty, false);
    throw new HttpError(409, (l.p.stock ? `Only ${l.p.stock} left of ${l.p.brand} ${l.p.name}` : `${l.p.brand} ${l.p.name} is out of stock`) + (why || "."));
  }
}
const giveBack = async items => { for (const it of items) { const p = db.products.find(p => p.id === it.id); if (p) await moveStock(p, it.qty, false); } };
const stamp = status => ({ at: new Date().toISOString(), status });
async function confirmPaid(o, paymentId, via) { // idempotent: the checkout callback and the webhook can both arrive
  if (o.coupon && o.status !== "Placed") useCoupon(db.users.find(u => u.id === o.userId), o.coupon); // the welcome coupon is spent once the money is in
  if (o.status === "Placed") return;
  o.status = "Placed"; o.pay = "Paid online (Razorpay)"; o.payment.paymentId = paymentId; o.payment.history.push({ ...stamp("Paid"), via }); // before any wait, so a second arrival on this copy returns above
  // ponytail: the callback and the webhook landing on two different copies within the same moment could each take the stock; order-row locking if that is ever seen
  for (const it of o.items) { const p = db.products.find(p => p.id === it.id); if (p && !(await moveStock(p, -it.qty))) { o.stockIssue = true; await moveStock(p, -it.qty, false); } } // stock is taken on confirmation; paid beyond the last unit, the order is flagged
  write("orders");
  notify(o, `Your Mytekkstore order ${o.id} is placed. Total ₹${o.total}. ${o.pay}.`);
}
function failPayment(o, paymentId, reason) { o.payment.attempts.push({ ...stamp("Failed"), paymentId, reason: String(reason || "").slice(0, 200) }); o.payment.history.push(stamp("Payment failed")); write("orders"); }
function expirePending() { // a payment not completed within 30 minutes releases the order; nothing was deducted for it
  const cut = Date.now() - 30 * 60000; let n = 0;
  for (const o of db.orders) if (o.status === "Pending payment" && +new Date(o.at) < cut) { o.status = "Expired"; o.payment.history.push(stamp("Expired")); n++; }
  if (n) write("orders");
}
setInterval(() => { expirePending(); flush().catch(e => console.error("flush:", e.message)); }, 300000).unref();
const seenEvents = new Set(); // x-razorpay-event-id values already handled: Razorpay retries, and the same event can arrive twice
async function razorpayWebhook(req, res) {
  const done = async (code, obj) => { try { await flush(); } catch (x) { console.error("flush:", x.message); } res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
  if (!RZP.webhook) return done(503, { error: "Webhook secret not configured." });
  let raw = ""; for await (const c of req) { raw += c; if (raw.length > 200000) return done(413, { error: "Too large." }); }
  if (!verifyWebhookSignature(raw, req.headers["x-razorpay-signature"], RZP.webhook)) return done(400, { error: "Bad signature." }); // the raw body, never a re-serialised one
  const eventId = String(req.headers["x-razorpay-event-id"] || "");
  if (eventId && seenEvents.has(eventId)) return done(200, { ok: true, duplicate: true });
  let ev; try { ev = JSON.parse(raw); } catch { return done(400, { error: "Bad body." }); }
  const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
  const providerOrderId = (pay && pay.order_id) || (ev.payload && ev.payload.order && ev.payload.order.entity && ev.payload.order.entity.id);
  const o = providerOrderId && db.orders.find(o => o.payment && o.payment.providerOrderId === providerOrderId);
  if (o) {
    o.payment.events.push({ ...stamp(ev.event), id: eventId });
    if (ev.event === "payment.captured" || ev.event === "order.paid") await confirmPaid(o, pay ? pay.id : "", "webhook");
    else if (ev.event === "payment.failed") failPayment(o, pay ? pay.id : "", pay && pay.error_description);
    else write("orders");
  }
  if (eventId) { seenEvents.add(eventId); if (seenEvents.size > 5000) seenEvents.clear(); }
  return done(200, { ok: true });
}
// start a gateway payment: a pending order (no stock taken yet) and the gateway's order id for the checkout
on("POST", "pay/order", async ({ body, user }) => {
  if (!user.phoneVerified) throw new HttpError(403, "Please verify your mobile number before placing an order.");
  if (PAY_PROVIDER === "demo") return { provider: "demo" }; // the client keeps the demo flow until keys exist
  const dest = destinationOf(body);
  if (!dest.methods.includes("online")) bad("Online payment is not available for this destination.");
  const name = str(body.name, "Name", 80), phone = str(body.phone, "Phone", 15, /^[0-9+ ]{7,15}$/), address = str(body.address, "Address", 400), pin = str(body.pin, "Pincode", 10, /^[0-9A-Za-z ]{4,10}$/);
  const lines = buildLines(body.items), subtotal = lines.reduce((t, l) => t + l.p.price * l.qty, 0), cp = couponFor(user, body.coupon, subtotal), total = subtotal - cp.discount;
  const id = "MT" + crypto.randomBytes(5).toString("hex").toUpperCase();
  const rz = await razorpayCreateOrder(total * 100, id);
  const order = { id, at: new Date().toISOString(), status: "Pending payment", name, phone, address, pin, email: user.email || "", country: "IN", pay: "Online (Razorpay)", userId: user.id,
    items: lines.map(({ p, qty }) => ({ id: p.id, brand: p.brand, name: p.name, img: p.img, price: p.price, qty })), subtotal, discount: cp.discount, coupon: cp.code, total,
    payment: { provider: "razorpay", providerOrderId: rz.id, paymentId: "", attempts: [], events: [], history: [stamp("Pending payment")] } };
  db.orders.push(order); write("orders");
  return { id, provider: "razorpay", keyId: RZP.id, providerOrderId: rz.id, amount: total * 100, currency: "INR", email: user.email || "" };
}, "user");
// the checkout's callback: verified against the order id we stored, never the one the browser sends
on("POST", "pay/verify", async ({ body, user }) => {
  expirePending();
  const o = db.orders.find(o => o.id === body.id && o.userId === user.id && o.payment);
  if (!o) throw new HttpError(404, "Order not found.");
  if (o.status === "Placed") return { id: o.id, status: o.status };
  if (o.status === "Expired") throw new HttpError(410, "This payment window has expired. Please place the order again.");
  if (body.razorpay_order_id !== o.payment.providerOrderId || !verifyCheckoutSignature(o.payment.providerOrderId, String(body.razorpay_payment_id || ""), body.razorpay_signature, RZP.secret)) throw new HttpError(400, "Payment could not be verified.");
  await confirmPaid(o, String(body.razorpay_payment_id), "checkout");
  return { id: o.id, status: o.status };
}, "user");

// ===== the assistant's model providers: Gemini's free tier first, the paid model next, and the catalogue rules in the page as the fallback =====
const GEMINI_KEY = process.env.GEMINI_API_KEY || "", GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const chatHits = new Map(); // address -> { n, since }: 30 assistant questions per 10 minutes per address, on top of the general write limit
async function askModel(system, history, message) {
  if (GEMINI_KEY) {
    let r = null;
    try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [...history.map(h => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })), { role: "user", parts: [{ text: message }] }], generationConfig: { maxOutputTokens: 400, temperature: 0.2 } }), signal: AbortSignal.timeout(20000) }); } catch { r = null; }
    if (r && r.ok) { const j = await r.json(); const parts = (((j.candidates || [])[0] || {}).content || {}).parts || []; const text = parts.map(p => p.text || "").join(""); if (text) return { text, provider: "gemini" }; }
    else console.error("chat gemini", r ? r.status : "unreachable"); // a quota reply (429) or an outage falls through, never a stack trace with the question in it
  }
  if (CHAT_KEY) {
    let r;
    try { r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": CHAT_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: CHAT_MODEL, max_tokens: 400, system, messages: [...history, { role: "user", content: message }] }), signal: AbortSignal.timeout(20000) }); }
    catch { throw new HttpError(502, "The assistant is not available right now."); }
    if (!r.ok) { console.error("chat anthropic", r.status); throw new HttpError(502, "The assistant is not available right now."); }
    return { text: ((await r.json()).content || []).map(c => c.text || "").join(""), provider: "anthropic" };
  }
  throw new HttpError(503, "The assistant is not available right now.");
}

on("GET", "config", async ({ req }) => ({ country: String(req.headers["x-vercel-ip-country"] || "").toUpperCase().slice(0, 2), /* the hosting's own geolocation header; empty on a local machine */ google: GOOGLE, sms: otpSmsReady, mail: mailReady, demoCodes: OTP_DEMO, recaptcha: RECAPTCHA.site, geo: !!MAPS_KEY, clarity: !!CLARITY, chat: !!(GEMINI_KEY || CHAT_KEY), db: !!DB_URL, pay: PAY_PROVIDER, payDemo: PAY_PROVIDER === "demo" && isLocal(req) /* the test payment window, on the developer's machine only */, payKey: RZP.id, fx: await fxNow(), destinations: Object.fromEntries(Object.entries(DESTINATIONS).map(([k, d]) => [k, { name: d.name, display: d.display, ship: d.ship, methods: d.methods }])) }));
// Contact form (page.html?p=contact): the message is recorded in the admin outbox ("Customer messages"), so the store sees it
// even before an email provider is connected. ponytail: no rate limit beyond the body size; add one if the form gets abused.
on("POST", "contact", ({ body }) => {
  const name = String(body.name || "").trim().slice(0, 80), email = String(body.email || "").trim().slice(0, 120), message = String(body.message || "").trim().slice(0, 2000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 5) bad("Please give your name, a valid email and a message.");
  record(`${name} (${email})`, "Contact form: " + message, "received");
  return { ok: true };
});

// ===== delivery check: India Post's free pincode service (no key), answers cached for a day =====
const pins = new Map(); // pin -> { at, data }
const PIN_STATES = { 11: "Delhi", 12: "Haryana", 13: "Haryana", 14: "Punjab", 15: "Punjab", 16: "Punjab", 17: "Himachal Pradesh", 18: "Jammu and Kashmir", 19: "Jammu and Kashmir", 20: "Uttar Pradesh", 21: "Uttar Pradesh", 22: "Uttar Pradesh", 23: "Uttar Pradesh", 24: "Uttarakhand", 25: "Uttar Pradesh", 26: "Uttarakhand", 27: "Uttar Pradesh", 28: "Uttar Pradesh", 30: "Rajasthan", 31: "Rajasthan", 32: "Rajasthan", 33: "Rajasthan", 34: "Rajasthan", 36: "Gujarat", 37: "Gujarat", 38: "Gujarat", 39: "Gujarat", 40: "Maharashtra", 41: "Maharashtra", 42: "Maharashtra", 43: "Maharashtra", 44: "Maharashtra", 45: "Madhya Pradesh", 46: "Madhya Pradesh", 47: "Madhya Pradesh", 48: "Madhya Pradesh", 49: "Chhattisgarh", 50: "Telangana", 51: "Andhra Pradesh", 52: "Andhra Pradesh", 53: "Andhra Pradesh", 56: "Karnataka", 57: "Karnataka", 58: "Karnataka", 59: "Karnataka", 60: "Tamil Nadu", 61: "Tamil Nadu", 62: "Tamil Nadu", 63: "Tamil Nadu", 64: "Tamil Nadu", 67: "Kerala", 68: "Kerala", 69: "Kerala", 70: "West Bengal", 71: "West Bengal", 72: "West Bengal", 73: "West Bengal", 74: "West Bengal", 75: "Odisha", 76: "Odisha", 77: "Odisha", 78: "Assam", 79: "North East", 80: "Bihar", 81: "Bihar", 82: "Jharkhand", 83: "Jharkhand", 84: "Bihar", 85: "Bihar" }; // the postal circles by the first two digits: the fallback when India Post does not answer
on("GET", "pincode/(\\d{6})", async ({ params }) => {
  const pin = params[0], hit = pins.get(pin);
  if (hit && hit.at > Date.now() - 86400000) return hit.data;
  let data;
  try {
    const r = await fetch("https://api.postalpincode.in/pincode/" + pin, { signal: AbortSignal.timeout(6000) });
    const j = r.ok ? await r.json() : null, po = j && j[0] && Array.isArray(j[0].PostOffice) && j[0].PostOffice[0];
    if (!po) throw new HttpError(404, "We could not find that pincode. Please check it.");
    data = { pin, area: po.Name, district: po.District, state: po.State, serviceable: true, deliveryDays: "3 to 5", codAllowed: true }; // the store delivers everywhere India Post reaches, cash on delivery included
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const state = PIN_STATES[pin.slice(0, 2)]; // India Post is down: the first two digits name the postal circle, which is enough to carry on
    if (!state) throw new HttpError(503, "The pincode service is not reachable right now.");
    return { pin, area: "", district: "", state, serviceable: true, deliveryDays: "3 to 5", codAllowed: true, source: "prefix" }; // not cached: the next look-up tries India Post again
  }
  pins.set(pin, { at: Date.now(), data });
  return data;
});
// the browser's position becomes a pincode (Google Geocoding, server key); twenty lookups per address per hour
const geoIp = new Map();
on("POST", "geo/reverse", async ({ body, req }) => {
  if (!MAPS_KEY) throw new HttpError(503, "Location detection is not set up yet. Please type your pincode.");
  const lat = +body.lat, lng = +body.lng; if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) bad("Location not valid.");
  const ip = ipOf(req), now = Date.now(), hits = (geoIp.get(ip) || []).filter(t => t > now - 3600000);
  if (hits.length >= 20) throw new HttpError(429, "Too many location requests. Please type your pincode."); geoIp.set(ip, [...hits, now]); if (geoIp.size > 5000) geoIp.clear();
  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=postal_code|locality&key=${MAPS_KEY}`, { signal: AbortSignal.timeout(6000) });
  const j = r.ok ? await r.json() : {}, first = (j.results || [])[0];
  if (!first) throw new HttpError(404, "We could not read a pincode from your location. Please type it.");
  const comp = (t, k = "long_name") => ((first.address_components || []).find(c => c.types.includes(t)) || {})[k] || "";
  return { country: comp("country", "short_name"), postalCode: comp("postal_code"), city: comp("locality") || comp("administrative_area_level_2"), formattedAddress: first.formatted_address || "" };
});
// the checkout asks before the order whether a coupon applies to the cart (the same rule the order route enforces)
on("POST", "coupons/validate", ({ body, user }) => { const lines = buildLines(body.items), subtotal = lines.reduce((t, l) => t + l.p.price * l.qty, 0), cp = couponFor(user, body.code, subtotal); return { ok: true, discount: cp.discount, code: cp.code }; }, "user");

on("POST", "orders", async ({ body, user, req }) => { // sign-in required, with a verified mobile number (delivery and cash on delivery need it; the owner's spec)
  if (!user.phoneVerified) throw new HttpError(403, "Please verify your mobile number before placing an order.");
  const name = str(body.name, "Name", 80), phone = str(body.phone, "Phone", 15, /^[0-9+ ]{7,15}$/);
  const address = str(body.address, "Address", 400), pin = str(body.pin, "Pincode", 10, /^[0-9A-Za-z ]{4,10}$/);
  const dest = destinationOf(body); // India only until a destination is approved
  if (!dest.methods.includes(body.pay === "online" ? "online" : "cod")) bad("That payment method is not available for this destination.");
  // without gateway keys "online" is the test window: a customer on the live site could otherwise get an order marked paid without paying
  if (body.pay === "online" && PAY_PROVIDER === "demo" && !isLocal(req)) bad("Online payment opens soon. Please choose cash on delivery.");
  const lines = buildLines(body.items); // prices and stock from the server's own product list, never from the browser
  const subtotal = lines.reduce((t, l) => t + l.p.price * l.qty, 0), cp = couponFor(user, body.coupon, subtotal);
  await takeLines(lines); // the last check that can refuse; nothing below throws
  useCoupon(user, cp.code);
  const order = {
    id: "MT" + crypto.randomBytes(5).toString("hex").toUpperCase(), at: new Date().toISOString(), status: "Placed",
    name, phone, address, pin, email: user.email || "", country: "IN", // the email is for order messages when there is no SMS provider
    // "online" is a demo payment: no gateway is called. Connect a real gateway here and verify its payment signature before saving.
    pay: body.pay === "online" ? "Paid online (demo payment)" : "Cash on delivery", userId: user ? user.id : null,
    items: lines.map(({ p, qty }) => ({ id: p.id, brand: p.brand, name: p.name, img: p.img, price: p.price, qty })),
    subtotal, discount: cp.discount, coupon: cp.code, total: subtotal - cp.discount,
  };
  db.orders.push(order); write("orders");
  notify(order, `Your Mytekkstore order ${order.id} is placed. Total ₹${order.total}. ${order.pay}.`);
  if (user) { // the address is remembered for next time; the order's contact number stays on the order and never replaces the account's verified number
    if (!user.phone) user.phone = e164(phone);
    Object.assign(user, { address, pin }); write("users");
  }
  return { id: order.id };
}, "user");
const publicOrder = ({ userId, ...o }) => o;
on("GET", "orders", ({ user }) => ({ orders: db.orders.filter(o => o.userId === user.id).map(publicOrder).reverse() }), "user");
// An order holds a name, phone and address, so only the customer who placed it (or the admin) can view it.
on("GET", "orders/(MT[0-9A-F]{10})", ({ params, user }) => {
  const o = db.orders.find(o => o.id === params[0]);
  if (!o || (o.userId !== user.id && !user.admin)) throw new HttpError(404, "Order not found.");
  return { order: publicOrder(o) };
}, "user");

on("GET", "admin/orders", () => ({ orders: [...db.orders].reverse() }), "admin");
on("PATCH", "admin/orders/(MT[0-9A-F]{10})", async ({ params, body }) => {
  const o = db.orders.find(o => o.id === params[0]);
  if (!o) throw new HttpError(404, "Order not found.");
  if (!STATUSES.includes(body.status)) bad("Unknown status.");
  if (o.returnRequest && body.returnStatus && ["Approved", "Picked up", "Refunded", "Declined"].includes(body.returnStatus) && o.returnRequest.status !== body.returnStatus) { o.returnRequest.status = body.returnStatus; o.returnRequest.updated = new Date().toISOString(); write("orders"); notify(o, `Your return for order ${o.id} is now: ${body.returnStatus}.`); } // the return moves on its own, without an order status change
  if (o.status === body.status) return { order: o };
  // cancelling returns the items to stock; reopening a cancelled order takes them again, and must not oversell
  const delta = (o.status === "Cancelled" ? 1 : 0) - (body.status === "Cancelled" ? 1 : 0);
  if (delta === 1) await takeLines(o.items.map(it => ({ p: db.products.find(p => p.id === it.id), qty: it.qty })).filter(l => l.p), ", so this order cannot be reopened.");
  if (delta === -1) await giveBack(o.items);
  o.status = body.status;
  if (o.status === "Delivered" && !o.deliveredAt) o.deliveredAt = new Date().toISOString(); // the return window and the warranty start here
  write("orders");
  notify(o, `Your Mytekkstore order ${o.id} is now: ${o.status}.`);
  return { order: o };
}, "admin");
// the customer cancels an order that has not shipped: the stock comes back, a welcome coupon used on it is returned to the wallet
on("POST", "orders/(MT[0-9A-F]{10})/cancel", async ({ params, body, user }) => {
  const o = db.orders.find(o => o.id === params[0] && o.userId === user.id);
  if (!o) throw new HttpError(404, "Order not found.");
  if (!["Placed", "Confirmed"].includes(o.status)) throw new HttpError(409, o.status === "Cancelled" ? "This order is already cancelled." : "This order has already shipped. You can refuse it at the door or ask for a return after delivery.");
  const reason = body.reason ? str(body.reason, "Reason", 200) : ""; // checked before the stock moves
  o.status = "Cancelled"; o.cancelledAt = new Date().toISOString(); o.cancelReason = reason; // before the wait, so a double tap cannot return the stock twice
  await giveBack(o.items);
  if (o.coupon) { const c = (user.coupons || []).find(c => c.code === o.coupon); if (c) { c.used = false; delete c.usedAt; write("users"); } }
  write("orders");
  notify(o, `Your Mytekkstore order ${o.id} is cancelled.${/online/i.test(o.pay) && !/cash/i.test(o.pay) ? " The refund goes back to your payment method within " + 7 + " working days." : ""}`);
  return { order: publicOrder(o) };
}, "user");
// the customer asks for a return within the window after delivery; the admin sees it on the order and arranges the pickup
on("POST", "orders/(MT[0-9A-F]{10})/return", ({ params, body, user }) => {
  const o = db.orders.find(o => o.id === params[0] && o.userId === user.id);
  if (!o) throw new HttpError(404, "Order not found.");
  if (o.status !== "Delivered") throw new HttpError(409, "A return can be requested once the order is delivered.");
  if (o.returnRequest) throw new HttpError(409, "A return is already requested for this order.");
  const since = Date.now() - new Date(o.deliveredAt || o.at).getTime();
  if (since > RETURN_DAYS * 86400000) throw new HttpError(409, `The ${RETURN_DAYS}-day return window has closed. The manufacturer's warranty still covers faults.`);
  const reason = str(body.reason, "Reason", 300);
  o.returnRequest = { at: new Date().toISOString(), reason, status: "Requested" };
  write("orders");
  record(o.phone || o.email, `Return requested for order ${o.id}: ${reason}`, "received");
  notify(o, `We have your return request for order ${o.id}. We will call you to arrange the pickup.`);
  return { order: publicOrder(o) };
}, "user");
on("GET", "admin/outbox", () => ({ messages: [...db.outbox].reverse() }), "admin");
// Product photo upload. The admin page resizes the photo to a small JPEG before sending it.
on("POST", "admin/upload", async ({ body }) => {
  const buf = Buffer.from(typeof body.data === "string" ? body.data.replace(/^data:image\/jpeg;base64,/, "") : "", "base64");
  if (buf.length < 100 || buf.length > 1400000 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) bad("Please choose a photo.");
  if (DB_URL) { // on a host like Vercel the app's own folder is read-only, so the photo lives in the database and /files/<id>.jpg serves it (cached by the CDN for good)
    const id = crypto.randomBytes(8).toString("hex");
    await sql("INSERT INTO files (id, type, data, at) VALUES ($1, $2, $3, $4)", [id, "image/jpeg", buf.toString("base64"), String(Date.now())]);
    return { img: "files/" + id + ".jpg" };
  }
  const name = "u-" + crypto.randomBytes(6).toString("hex") + ".jpg";
  fs.writeFileSync(path.join(PUBLIC, "img", name), buf);
  return { img: "img/" + name };
}, "admin");
on("POST", "admin/products", async ({ body }) => {
  // an id is never reused, even after a delete: old orders still point at it
  const p = { id: Math.max(0, ...db.products.map(p => p.id), ...db.orders.flatMap(o => o.items.map(i => i.id))) + 1, ...productFrom(body), reviews: [], updated: new Date().toISOString() };
  db.products.push(p); write("products"); await setStock(p);
  return { product: p };
}, "admin");
on("PUT", "admin/products/(\\d+)", async ({ params, body }) => {
  const p = db.products.find(p => p.id === +params[0]);
  if (!p) throw new HttpError(404, "Product not found.");
  Object.assign(p, productFrom(body), { updated: new Date().toISOString() }); write("products"); await setStock(p);
  return { product: p };
}, "admin");
on("POST", "admin/reset-customers", async ({ user }) => { // before launch: the test accounts and orders go, the catalogue, banners and the admin stay
  for (const o of db.orders) if (o.status !== "Cancelled" && o.status !== "Expired" && o.status !== "Pending payment") await giveBack(o.items); // a pending payment never took stock
  const gone = db.users.filter(u => !u.admin).map(u => u.id);
  db.users = db.users.filter(u => u.admin); db.orders = []; db.outbox = [];
  for (const [t, s] of sessions) if (gone.includes(s.userId)) sessions.delete(t);
  if (DB_URL) for (const id of gone) pending.push(sql("DELETE FROM sessions WHERE user_id = $1", [id])); // the users and orders rows go with the next flush (it deletes what the snapshot no longer holds)
  for (const p of db.products) p.reviews = (p.reviews || []).filter(r => !gone.includes(r.userId));
  write("users"); write("orders"); write("outbox"); write("products");
  return { ok: true, users: gone.length };
}, "admin");
on("DELETE", "admin/products/(\\d+)", ({ params }) => {
  const i = db.products.findIndex(p => p.id === +params[0]);
  if (i < 0) throw new HttpError(404, "Product not found.");
  db.products.splice(i, 1); write("products");
  return {};
}, "admin");

// ===== banners and campaigns =====
// A banner: a slot (home, product:<id>, category:<name>, campaign:<slug>), a preset (how it animates), a tone (its colours), words,
// up to two buttons that link inside the site, a desktop image and a phone image with a focus point, and optionally a product.
const PRESETS = ["cinematic", "layered", "feature", "promo", "scroll"], TONES = ["photo", "paper", "green", "indigo", "dark", "ink"], FOCUS = ["center", "left", "right", "top", "bottom"], THEMES = ["light", "dark", "green", "indigo"];
const opt = (v, label, max = 200) => v == null || v === "" ? "" : str(v, label, max);
const oneOf = (v, list, label) => { if (!list.includes(v)) bad(`${label} must be one of ${list.join(", ")}.`); return v; };
const safeHref = (v, label) => { const h = opt(v, label, 300); if (h && !/^(\/|#)/.test(h)) bad(`${label} must be an address on this site, starting with / or #.`); return h; };
function bannerFrom(b) {
  const slot = str(b.slot, "Slot", 80, /^(home|product:\d+|category:[\w .&-]+|campaign:[a-z0-9-]+)$/);
  const productId = b.productId ? int(b.productId, "Product", 1, 1e9) : 0, slotProduct = /^product:(\d+)$/.exec(slot);
  if ((productId && !db.products.some(p => p.id === productId)) || (slotProduct && !db.products.some(p => p.id === +slotProduct[1]))) bad("That product does not exist.");
  return { slot, order: b.order ? int(b.order, "Order", 1, 99) : 1, preset: oneOf(b.preset || "cinematic", PRESETS, "Preset"), kicker: opt(b.kicker, "Kicker", 60), title: str(b.title, "Title", 120), text: opt(b.text, "Text", 300),
    cta: opt(b.cta, "Button", 40), href: safeHref(b.href, "Button link"), cta2: opt(b.cta2, "Second button", 40), href2: safeHref(b.href2, "Second button link"), img: opt(b.img, "Image", 300), imgMobile: opt(b.imgMobile, "Phone image", 300),
    focus: oneOf(b.focus || "center", FOCUS, "Focus"), align: oneOf(b.align || "left", ["left", "center"], "Alignment"), badge: opt(b.badge, "Badge", 40), tone: oneOf(b.tone || "photo", TONES, "Tone"), productId, brand: opt(b.brand, "Brand", 60), until: opt(b.until, "Until", 10), live: b.live !== false };
}
// A campaign page: address, words, theme, the picks, feature blocks, whether to show the bank offers, questions, search tags.
function campaignFrom(b, id) {
  const slug = str(b.slug, "Address", 60, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  if (db.campaigns.some(c => c.slug === slug && c.id !== id)) bad("Another campaign already uses that address.");
  const productIds = (Array.isArray(b.productIds) ? b.productIds : []).slice(0, 12).map(x => int(x, "Product", 1, 1e9));
  productIds.forEach(x => { if (!db.products.some(p => p.id === x)) bad("Product " + x + " does not exist."); });
  const features = (Array.isArray(b.features) ? b.features : []).slice(0, 8).map(f => ({ title: str(f && f.title, "Feature title", 80), text: str(f && f.text, "Feature text", 300), img: opt(f && f.img, "Feature image", 300) }));
  const faq = (Array.isArray(b.faq) ? b.faq : []).slice(0, 10).map(x => [str(x && x[0], "Question", 160), str(x && x[1], "Answer", 600)]);
  const seo = b.seo && typeof b.seo === "object" ? b.seo : {};
  return { slug, title: str(b.title, "Title", 100), lead: opt(b.lead, "Lead", 300), theme: oneOf(b.theme || "light", THEMES, "Theme"), productIds, features, offers: !!b.offers, faq, seo: { title: opt(seo.title, "Search title", 70), desc: opt(seo.desc, "Search description", 160) }, sample: !!b.sample, live: b.live !== false };
}
const nextId = list => Math.max(0, ...list.map(x => x.id)) + 1;
const liveOrAll = (list, req, user) => user && user.admin && /[?&]all=1\b/.test(req.url) ? list : list.filter(x => x.live);
on("GET", "banners", ({ req, user }) => ({ banners: [...liveOrAll(db.banners, req, user)].sort((a, b) => a.order - b.order || a.id - b.id) }));
on("GET", "campaigns", ({ req, user }) => ({ campaigns: liveOrAll(db.campaigns, req, user) }));
on("POST", "admin/banners", ({ body }) => { const b = { id: nextId(db.banners), ...bannerFrom(body) }; db.banners.push(b); write("banners"); return { banner: b }; }, "admin");
on("PUT", "admin/banners/(\\d+)", ({ params, body }) => { const b = db.banners.find(x => x.id === +params[0]); if (!b) throw new HttpError(404, "Banner not found."); Object.assign(b, bannerFrom(body)); write("banners"); return { banner: b }; }, "admin");
on("DELETE", "admin/banners/(\\d+)", ({ params }) => { const i = db.banners.findIndex(x => x.id === +params[0]); if (i < 0) throw new HttpError(404, "Banner not found."); db.banners.splice(i, 1); write("banners"); return {}; }, "admin");
on("POST", "admin/campaigns", ({ body }) => { const c = { id: nextId(db.campaigns), ...campaignFrom(body, 0), updated: new Date().toISOString() }; db.campaigns.push(c); write("campaigns"); return { campaign: c }; }, "admin");
on("PUT", "admin/campaigns/(\\d+)", ({ params, body }) => { const c = db.campaigns.find(x => x.id === +params[0]); if (!c) throw new HttpError(404, "Campaign not found."); Object.assign(c, campaignFrom(body, c.id), { updated: new Date().toISOString() }); write("campaigns"); return { campaign: c }; }, "admin");
on("DELETE", "admin/campaigns/(\\d+)", ({ params }) => { const i = db.campaigns.findIndex(x => x.id === +params[0]); if (i < 0) throw new HttpError(404, "Campaign not found."); db.campaigns.splice(i, 1); write("campaigns"); return {}; }, "admin");

// ===== the Creative Intelligence Agent: a separate app (creative/) reached through CREATIVE_URL; this is the interface, honest about whether it is connected =====
const creativeFetch = async (p, init) => { const r = await fetch(CREATIVE_URL + p, { ...init, signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new HttpError(502, "The creative agent answered " + r.status + "."); return r.json(); };
on("GET", "creative/status", async () => {
  if (!CREATIVE_URL) return { connected: false, how: "Start the Creative Intelligence Agent (creative/ folder, npm start) and set CREATIVE_URL to its address, for example http://localhost:3200." };
  try { const h = await creativeFetch("/api/health"); return { connected: true, url: CREATIVE_URL, ...h }; } catch (e) { return { connected: false, url: CREATIVE_URL, how: "The agent at CREATIVE_URL did not answer: " + e.message }; }
}, "admin");
on("POST", "creative/concepts", async ({ body }) => {
  if (!CREATIVE_URL) throw new HttpError(503, "The creative agent is not connected. Set CREATIVE_URL.");
  const p = db.products.find(x => x.id === +body.productId); if (!p) bad("Choose a product.");
  return creativeFetch("/api/concepts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product: publicProduct(p), slot: opt(body.slot, "Slot", 80), objective: opt(body.objective, "Objective", 80) }) });
}, "admin");

// ===== the help bot's assistant: Claude, fed only the catalogue and the store's facts, answering as JSON with links inside the site =====
on("POST", "chat", async ({ body, req }) => {
  if (!GEMINI_KEY && !CHAT_KEY) throw new HttpError(503, "No chat provider is configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY on the server; the site answers from the catalogue meanwhile.");
  const ip = ipOf(req), now = Date.now(), h = chatHits.get(ip) || { n: 0, since: now };
  if (now - h.since > 600000) { h.n = 0; h.since = now; }
  if (++h.n > 30) throw new HttpError(429, "The assistant has had many questions from this address. Please try again in a few minutes.");
  chatHits.set(ip, h); if (chatHits.size > 5000) chatHits.clear();
  const message = str(body.message, "Message", 500);
  const page = body.page && typeof body.page === "object" ? body.page : {};
  const history = (Array.isArray(body.history) ? body.history : []).slice(-8).filter(x => x && (x.role === "user" || x.role === "assistant") && typeof x.text === "string" && x.text.trim()).map(x => ({ role: x.role, content: x.text.slice(0, 500) }));
  const cur = page.id && live().find(p => p.id === +page.id);
  const catalogue = live().map(p => ({ id: p.id, brand: p.brand, name: p.name, price: p.price, mrp: p.mrp, inStock: p.stock > 0, noCostEmi: !!p.emi, os: p.os || "", specs: Object.fromEntries(p.specs || []), url: productPath(p) }));
  const system = `You are the shopping assistant of Mytekkstore, an Indian online store selling ${catWords()}. Answer in plain English in at most 80 words. Use ONLY the facts below. If the facts do not cover the question, say so and point to the right page. Never invent prices, stock, offers, warranty terms or specifications. Prices are in rupees and include taxes.
FACTS: Delivery is free across India, usually 3 to 5 days, cash on delivery available. Payment: cash on delivery or online at checkout. Warranty: the brand's own warranty on every product; details at /returns. Offers and bank offers: /offers. No Cost EMI over 3, 6 or 9 months on products with noCostEmi true (per month = price / months). Pages: /televisions (all TVs), /compare?ids=1,2 (compare two to four products by id), /offers, /shipping, /returns, /contact, /account (orders).
CATALOGUE: ${JSON.stringify(catalogue)}
${cur ? "The customer is looking at product id " + cur.id + "." : "The customer is on the " + (page.page || "home") + " page."}
Reply as JSON only: {"reply": "...", "links": [{"label": "...", "href": "/..."}]} with at most 3 links whose href is one of the pages or product urls above.`;
  const { text, provider } = await askModel(system, history, message);
  let out; try { out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { out = { reply: text, links: [] }; }
  const ok = new Set(["/televisions", "/offers", "/shipping", "/returns", "/contact", "/account", "/products", ...catalogue.map(p => p.url)]);
  const links = (Array.isArray(out.links) ? out.links : []).filter(l => l && typeof l.href === "string" && (ok.has(l.href) || /^\/compare\?ids=[\d,]+$/.test(l.href))).slice(0, 3).map(l => ({ label: String(l.label || "Open").slice(0, 60), href: l.href }));
  return { reply: String(out.reply || "").slice(0, 800), links, provider };
});

// ===== HTTP plumbing =====
const hits = new Map(); // address -> { n, since }: the write limit above
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > limit) { reject(new HttpError(413, "Request too large.")); req.destroy(); } });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new HttpError(400, "Invalid request.")); } });
    req.on("error", reject);
  });
}
async function handleApi(req, res, pathname) {
  if (pathname === "/api/pay/webhook" && req.method === "POST") return razorpayWebhook(req, res); // signed raw body, no session, no origin
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
  try {
    let body = {};
    if (req.method !== "GET") {
      // one address gets at most 120 writes (orders, sign-ins, codes, reviews, messages) per 10 minutes; a shopper never needs more.
      // ponytail: counted in this process's memory; share the counter if more than one server runs
      const ip = ipOf(req), now = Date.now(), h = hits.get(ip) || { n: 0, since: now };
      if (now - h.since > 600000) { h.n = 0; h.since = now; }
      if (++h.n > 120 && !isLocal(req)) throw new HttpError(429, "Too many requests from this address. Please try again in a few minutes."); // the suites on the local machine make more
      hits.set(ip, h); if (hits.size > 5000) hits.clear();
      // Cross-site request protection: browsers cannot send JSON cross-site without permission, and the origin must be ours.
      if (!/^application\/json/.test(req.headers["content-type"] || "")) throw new HttpError(415, "Invalid request.");
      const origin = req.headers.origin;
      if (origin && (!URL.canParse(origin) || new URL(origin).host !== req.headers.host)) throw new HttpError(403, "Invalid request.");
      body = await readBody(req, pathname === "/api/admin/upload" ? 1900000 : 100000);
      if (!body || typeof body !== "object" || Array.isArray(body)) bad("Invalid request.");
    }
    for (const r of routes) {
      const m = r.method === req.method && r.re.exec(pathname);
      if (!m) continue;
      const user = await currentUser(req);
      if (r.need && !user) throw new HttpError(401, "Please sign in.");
      if (r.need === "admin" && !user.admin) throw new HttpError(403, "Admins only.");
      const out = await r.fn({ req, res, body, user, params: m.slice(1) });
      await flush(); // a serverless instance freezes after it answers, so the order must be in the database before the reply
      return send(200, out);
    }
    throw new HttpError(404, "Not found.");
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    try { await flush(); } catch (x) { console.error("flush:", x.message); }
    send(e instanceof HttpError ? e.code : 500, { error: e instanceof HttpError ? e.message : "Something went wrong. Please try again." });
  }
}
// ===== static files, SEO tags, sitemap =====
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4", ".woff2": "font/woff2" };
// ponytail: videos are sent whole (no Range requests). Fine for short clips; add Range support if long videos are ever added.
// Sent with every response. The content security policy allows only our own scripts, our own and https photos (admin photo links,
// data: for demo-mode uploads), inline style attributes, and the Inter font from Google Fonts. With Google sign-in switched on,
// Google's button script and sign-in frame are allowed as well.
const SECURITY = {
  "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": `default-src 'self'; script-src 'self' 'inline-speculation-rules'${GOOGLE ? " https://accounts.google.com" : ""}${CLARITY ? " https://www.clarity.ms" : ""}${RZP.id ? " https://checkout.razorpay.com" : ""}${RECAPTCHA.site ? " https://www.google.com https://www.gstatic.com" : ""}; connect-src 'self'${GOOGLE ? " https://accounts.google.com" : ""}${CLARITY ? " https://*.clarity.ms" : ""}${RZP.id ? " https://api.razorpay.com https://lumberjack.razorpay.com" : ""}; frame-src ${[GOOGLE && "https://accounts.google.com", RZP.id && "https://api.razorpay.com https://checkout.razorpay.com", RECAPTCHA.site && "https://www.google.com"].filter(Boolean).join(" ") || "'none'"}; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'${GOOGLE ? " https://accounts.google.com" : ""}; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
};
const escHtml = s => String(s).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
const siteUrl = req => (req.headers["x-forwarded-proto"] || "http") + "://" + (req.headers.host || "localhost:" + PORT);
const INFO_PAGES = ["about", "contact", "stores", "shipping", "returns", "terms", "privacy", "buying-guide", "shipping-policy", "refund-policy", "warranty"];
// title and description of each info page (the page itself is drawn by web/src/info.jsx)
const INFO_TITLES = {
  "shipping-policy": ["Shipping policy", "Where MyTekkStore delivers, how long it takes, what it costs and what happens at your door: free delivery across India, usually in 3 to 5 days, cash on delivery."],
  "refund-policy": ["Cancellation, returns and refund policy", "How to cancel a MyTekkStore order, return a product within the return window and get your money back."],
  warranty: ["Warranty", "The manufacturer's warranty on every TV MyTekkStore sells: 1 year or 1 + 1 years by model, how to register and how to claim."],
  about: ["About Mytekkstore", "Mytekkstore sells genuine Elista electronics at factory prices, delivered free with cash on delivery and the brand's warranty."],
  contact: ["Contact us", "Write to Mytekkstore about orders, delivery, returns and service. We reply by email."],
  stores: ["Store locator", "Find a Mytekkstore store, or check delivery to your pincode: free delivery across India, usually in 3 to 5 days."],
  shipping: ["Shipping and delivery", "Free delivery on every Mytekkstore order, usually in 3 to 5 days, with cash on delivery. Check your pincode before you order."],
  returns: ["Returns and refunds", "How returns work at Mytekkstore: tell us within the return window, we pick the product up, and the refund goes back the way you paid."],
  terms: ["Terms of use", "The terms that apply when you order from Mytekkstore: prices, payment, delivery, cancellation, returns and warranty."],
  privacy: ["Privacy policy", "What Mytekkstore stores about you, why, and what it never does: no card details, one sign-in cookie, no tracking cookies."],
  "buying-guide": ["How to choose a TV", "A plain-words TV buying guide: pick the right screen size for your room, understand HD vs 4K, choose Google TV or WebOS, and match a TV to your budget."],
};

// ===== clean addresses =====
// /televisions, /televisions/<brand-and-model>, /products?brand=Elista, /shipping, /offers, /cart ... The old addresses
// (category.html?cat=..., product.html?id=..., page.html?p=...) keep working and point at the clean one as canonical.
// The same slug rule lives in web/src/data.js, so the links the app builds are the ones this server resolves.
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const catPath = c => "/" + slug(c);
const productPath = p => catPath(p.cat) + "/" + slug(p.brand + " " + p.name);
const CLEAN = { "/products": "category.html", "/offers": "offers.html", "/cart": "cart.html", "/checkout": "checkout.html", "/account": "account.html", "/order": "order.html", "/admin": "admin.html" };
function resolveClean(pathname) { // -> { file, params } for a clean address, else null
  if (pathname === "/compare") return { file: "compare.html", params: {} }; // /compare?ids=2,11
  if (CLEAN[pathname]) return { file: CLEAN[pathname], params: {} };
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "campaigns" && parts.length === 2) { const c = db.campaigns.find(c => c.live && c.slug === parts[1]); return c ? { file: "campaign.html", params: { slug: c.slug } } : null; }
  if (parts.length === 1 && INFO_PAGES.includes(parts[0]) && !HIDDEN_PAGES.includes(parts[0])) return { file: "page.html", params: { p: parts[0] } };
  const cat = parts.length && [...new Set(live().map(p => p.cat))].find(c => slug(c) === parts[0]);
  if (cat && parts.length === 1) return { file: "category.html", params: { cat } };
  if (cat && parts.length === 2) { const p = db.products.find(p => p.cat === cat && slug(p.brand + " " + p.name) === parts[1]); if (p) return { file: "product.html", params: { id: String(p.id) } }; }
  return null;
}
// Search engines and WhatsApp or Facebook link previews do not run our JavaScript, so the server writes the title, description,
// sharing tags and schema.org data into each page before sending it. Product and category pages get their own.
function seoTags(req, url) {
  const base = siteUrl(req), q = url.searchParams, file = url.pathname, tag = (k, v) => `<meta property="${k}" content="${escHtml(v)}">`;
  let title = "Mytekkstore | Elista " + catWords() + " at factory prices", img = base + "/img/hero0.jpg", ld = null, robots = "";
  let desc = "Shop Elista " + catWords() + " at Mytekkstore, straight from the factory. Genuine products with brand warranty, free delivery, cash on delivery.";
  let canonical = file + url.search; // the clean address of this page; the old .html addresses point at it
  const p = file === "/product.html" && db.products.find(p => p.id === +q.get("id"));
  const cat = file === "/category.html" && q.get("cat"), brand = file === "/category.html" && !cat && q.get("brand"), info = file === "/page.html" && q.get("p");
  const priv = /^\/(account|cart|checkout|order|admin)\.html$/.exec(file);
  const camp = file === "/campaign.html" && db.campaigns.find(c => c.slug === q.get("slug"));
  if (p) {
    canonical = productPath(p);
    const here = base + canonical;
    title = p.brand + " " + p.name + " | Mytekkstore";
    // every product gets its own description, built from its own specifications (the catalogue text can read alike)
    const specs = (p.specs || []).slice(0, 3).map(([, v]) => v).join(", ");
    desc = (p.brand + " " + p.name + (specs ? ": " + specs : "") + ". ₹" + p.price.toLocaleString("en-IN") + ", free delivery, cash on delivery, brand warranty.").slice(0, 160);
    img = /^https:/.test(p.img) ? p.img : base + "/" + p.img;
    const reviews = p.reviews || [];
    ld = [
      { "@context": "https://schema.org", "@type": "Product", name: p.brand + " " + p.name, image: [img], description: desc, sku: String(p.id), category: p.cat, brand: { "@type": "Brand", name: p.brand },
        offers: { "@type": "Offer", url: here, priceCurrency: "INR", price: p.price, availability: "https://schema.org/" + (p.stock > 0 ? "InStock" : "OutOfStock"), itemCondition: "https://schema.org/NewCondition", seller: { "@type": "Organization", name: "Mytekkstore" } },
        aggregateRating: reviews.length ? { "@type": "AggregateRating", ratingValue: +(reviews.reduce((t, r) => t + r.rating, 0) / reviews.length).toFixed(1), reviewCount: reviews.length } : undefined },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [["Home", base + "/"], [p.cat, base + catPath(p.cat)], [p.name, here]].map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) },
    ];
  } else if (file === "/offers.html") {
    canonical = "/offers";
    title = "Festive offers | Mytekkstore";
    desc = "Festive offers at Mytekkstore: top deals on Elista TVs, washing machines and ACs, bank offers and No Cost EMI.";
  } else if (cat) {
    canonical = catPath(cat);
    title = cat + " | Mytekkstore";
    desc = "Elista " + cat.toLowerCase() + " at Mytekkstore: every model compared side by side, with a buying guide, free delivery and cash on delivery.";
    const first = db.products.find(p => p.cat === cat);
    if (first) img = base + "/" + first.img;
    ld = [
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [["Home", base + "/"], [cat, base + canonical]].map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) },
      { "@context": "https://schema.org", "@type": "ItemList", name: cat + " at Mytekkstore", itemListElement: db.products.filter(p => p.cat === cat).slice(0, 20).map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.brand + " " + p.name, url: base + productPath(p) })) },
    ];
  } else if (file === "/category.html") {
    canonical = brand ? "/products?brand=" + encodeURIComponent(brand) : "/products";
    title = (brand || "All products") + " | Mytekkstore";
    desc = (brand ? "All " + brand + " " : "All Elista ") + catWords() + " at Mytekkstore, with filters for " + (brand ? "" : "brand, ") + "size, operating system, price and discount.";
    if (q.has("wish") || q.get("q")) robots = "noindex"; // a personal wishlist and search results are not landing pages
  } else if (info && INFO_TITLES[info]) {
    canonical = "/" + info;
    title = INFO_TITLES[info][0] + " | Mytekkstore";
    desc = INFO_TITLES[info][1];
  } else if (file === "/" || file === "/index.html") {
    canonical = "/";
    // the store itself: lets Google show a search box under the result, and the organisation card
    ld = [
      { "@context": "https://schema.org", "@type": "WebSite", name: "Mytekkstore", url: base + "/", potentialAction: { "@type": "SearchAction", target: base + "/products?q={search_term_string}", "query-input": "required name=search_term_string" } },
      { "@context": "https://schema.org", "@type": "Organization", name: "Mytekkstore", url: base + "/", logo: base + "/favicon.svg" },
    ];
  } else if (camp) {
    canonical = "/campaigns/" + camp.slug;
    title = ((camp.seo && camp.seo.title) || camp.title) + " | Mytekkstore";
    desc = (camp.seo && camp.seo.desc) || camp.lead || camp.title;
    const first = db.products.find(p => camp.productIds.includes(p.id)); if (first) img = base + "/" + first.img;
    if (!camp.live) robots = "noindex";
  } else if (file === "/compare.html") {
    canonical = "/compare"; robots = "noindex"; // a personal selection, not a landing page
    title = "Compare | Mytekkstore"; desc = "Two to four Mytekkstore TVs side by side: price, rating, every specification, No Cost EMI.";
  } else if (priv) {
    const name = priv[1];
    canonical = "/" + name; robots = "noindex, nofollow"; // private pages stay out of search
    title = { account: "My account", cart: "Cart", checkout: "Checkout", order: "Order", admin: "Store admin" }[name] + " | Mytekkstore";
    desc = "Mytekkstore: " + { account: "sign in, your orders and your details", cart: "your cart", checkout: "delivery details and payment", order: "your order", admin: "store administration" }[name] + ".";
  }
  const here = base + canonical;
  const head = `<meta name="description" content="${escHtml(desc)}"><link rel="canonical" href="${escHtml(here)}">${robots ? `<meta name="robots" content="${robots}">` : ""}${tag("og:type", p ? "product" : "website")}${tag("og:site_name", "Mytekkstore")}${tag("og:title", title)}${tag("og:description", desc)}${tag("og:image", img)}${tag("og:url", here)}<meta name="twitter:card" content="summary_large_image">${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` : ""}${CLARITY && file !== "/admin.html" ? `<script src="https://www.clarity.ms/tag/${CLARITY}" async></script>` : ""}`;
  return { title, head, robots };
}
// The home page's header and first banner, written into the HTML shell so the first paint and the biggest paint (Lighthouse LCP)
// come from the HTML and the stylesheet instead of waiting for the 500 KB script to run (5 s on a phone, about 1.5 s with this).
// Same classes as the React markup (Header in web/src/components.jsx, the hero in web/src/home.jsx), which replaces it on mount
// without a shift. Keep the two in step. Only the plain photo banner is reproduced; a brand or promo banner first means no static hero.
// the header as the app draws it (Header in web/src/components.jsx): logo, search, pincode chip, country, account, wishlist, cart, the bar
function staticHeader() {
  const icon = d => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const li = (label, href) => `<li class="l0"><a class="l0link" href="${href}">${escHtml(label)}</a></li>`;
  const emis = live().filter(p => p.cat === "Televisions" && p.emi).map(p => Math.ceil(p.price / 9)), emiFrom = emis.length ? Math.min(...emis) : 0;
  return `<a class="skip" href="#main">Skip to content</a><header id="hdr"><div class="abar" aria-label="Store offers">Free delivery · Cash on delivery${emiFrom ? " · No Cost EMI from " + String.fromCharCode(8377) + emiFrom.toLocaleString("en-IN") + "/month" : ""} · Genuine Elista TVs with brand warranty</div><div class="wrap"><a class="logo" href="/"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--accent)"/><path d="M18 5 9 18h6l-2 9 10-14h-6z" fill="#ffffff"/></svg><span>mytekk<b>store</b></span></a><form role="search" action="/products" class="sbox"><input type="search" name="q" placeholder="Search &quot;55 inch 4K TV under 50000&quot;" aria-label="Search products" autocomplete="off"></form><details class="deliver"><summary>${icon('<path d="M12 21s-6-5.3-6-11a6 6 0 0112 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.5"/>')}<span><small>Deliver to</small><b>Enter pincode</b></span></summary></details><label class="cty"><select id="country" aria-label="Country and currency"><option>India · INR</option></select></label><a class="hlink" href="/account" aria-label="Sign in">${icon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>')} <span>Sign in</span></a><a class="hlink" href="/products?wish=1" aria-label="Wishlist">${icon('<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>')}</a><a class="hlink" href="/cart" aria-label="Cart">${icon('<path d="M3 4h2l2.4 11h11l2-7H7"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>')}</a></div><nav class="gnav" aria-label="Shop"><ul class="gbar">${[...new Set(live().map(p => p.cat))].map(c => li(c, catPath(c))).join("")}${HIDDEN_CATS.map(c => `<li class="soon"><span>${escHtml(c)}</span></li>`).join("")}${li("Brands", "/products")}${li("Best Deals", "/offers")}${li("Support", "/contact")}${li("Track order", "/account")}</ul></nav></header>`;
}
function staticHome() {
  const b = db.banners.filter(x => x.live && x.slot === "home").sort((a, c) => a.order - c.order || a.id - c.id)[0];
  const webp = /^img\/(?!u-)[\w-]+\.jpg$/.test((b && b.img) || ""); // the seeded photos have WebP copies (web/images.js); uploads do not
  const v = w => "/" + b.img.replace(/\.jpg$/, (w ? "-" + w : "") + ".webp");
  const mobile = b && /^img\/(?!u-)[\w-]+\.jpg$/.test(b.imgMobile || "") ? `<source media="(max-width:760px)" srcset="/${b.imgMobile.replace(/\.jpg$/, "-480.webp")} 480w, /${b.imgMobile.replace(/\.jpg$/, "-960.webp")} 960w" sizes="100vw">` : ""; // the portrait crop for phones
  const img = !b || !b.img ? "" : mobile + (webp ? `<img src="${v(960)}" srcset="${v(480)} 480w, ${v(960)} 960w, ${v()} 1376w" sizes="100vw" alt="" width="1344" height="752" fetchpriority="high" decoding="async">` : `<img src="/${escHtml(b.img)}" alt="" width="1344" height="752" fetchpriority="high">`);
  const words = (t, hi = []) => String(t || "").split(/(?<=[.!?])\s+/).filter(Boolean).map(l => `<span class="ln">${l.split(" ").map(w => `<span class="w${hi.includes(w) ? " hi" : ""}">${escHtml(w)}&nbsp;</span>`).join("")}</span>`).join("");
  const header = staticHeader();
  const tvs = live().filter(p => p.cat === "Televisions"), rs = n => String.fromCharCode(8377) + n.toLocaleString("en-IN");
  const maxOff = Math.max(0, ...live().map(p => Math.round((1 - p.price / p.mrp) * 100))), minTv = tvs.length ? Math.min(...tvs.map(p => p.price)) : 0;
  const emis = tvs.filter(p => p.emi).map(p => Math.ceil(p.price / 9)), minEmi = emis.length ? Math.min(...emis) : 0;
  const hi = w => `<span class="w hi">${escHtml(w)}&nbsp;</span>`; // the figure in gold
  const smartMin = tvs.filter(p => p.os).length ? Math.min(...tvs.filter(p => p.os).map(p => p.price)) : 0; // the first hero slide, the same words and picture as web/src/home.jsx
  const chips = [smartMin ? "Smart TVs from " + rs(smartMin) : "", "24 to 85 inch", minEmi ? "No Cost EMI from " + rs(minEmi) + "/month" : ""].filter(Boolean);
  const hero = `<div class="hp"><section class="d-hero" aria-roledescription="carousel" aria-label="Offers"><a class="d-slide on" href="/televisions"><span class="d-sphoto" aria-hidden="true"><img src="/img/elista/webOS-Smart-TV-65in_2-960.webp" srcset="/img/elista/webOS-Smart-TV-65in_2-480.webp 480w, /img/elista/webOS-Smart-TV-65in_2-960.webp 960w, /img/elista/webOS-Smart-TV-65in_2.webp 1500w" sizes="(max-width:760px) 100vw, 70vw" alt="" width="1500" height="1500" fetchpriority="high" decoding="async"></span><span class="d-stext"><span class="d-seyebrow">MyTekkStore · Elista</span><strong class="d-sh">Bring the big-screen experience home.</strong><span class="d-sp">Factory-direct prices on every size, 24 to 85 inch. Free delivery, cash on delivery and No Cost EMI.</span><span class="d-schips">${chips.map((c, i) => `<span${i === 0 ? ' class="gold"' : ""}>${escHtml(c)}</span>`).join("")}</span><span class="d-scta"><span class="d-btn">Shop TVs</span><span class="d-btn gold">Best Deals</span></span></span></a><div class="d-dots" role="tablist"><button type="button" role="tab" aria-selected="true" aria-label="Slide 1" class="on"></button><button type="button" role="tab" aria-selected="false" aria-label="Slide 2"></button><button type="button" role="tab" aria-selected="false" aria-label="Slide 3"></button><button type="button" role="tab" aria-selected="false" aria-label="Slide 4"></button></div></section></div>`;
  // the discount banner under the hero, painted with it so the page's largest first-screen text does not wait for the script
  // (same markup and figures as the deal box in web/src/home.jsx: biggest discount, lowest price, lowest 9-month No Cost EMI)
  const topDeal = tvs.length ? [...tvs].sort((a, b) => (b.mrp - b.price) / b.mrp - (a.mrp - a.price) / a.mrp)[0] : null;
  const cut = p => /^img\/(?!u-)[\w-]+\.jpg$/.test(p.img || "") ? "/" + p.img.replace(/\.jpg$/, "-cut.webp") : "/" + p.img; // the render's transparent cut-out (web/src/data.js cutout)
  const festive = !hero || !topDeal || maxOff <= 0 ? "" : `<section class="festive bleed" aria-label="Festive Offers"><a class="festin" href="/offers"><span class="fsparkle" aria-hidden="true"></span><span class="flights" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="ftext"><span class="flock"><i></i>Festive Offers<i></i></span><span class="fcamp">Make your Diwali smarter &amp; brighter</span><b><small>Up to</small><strong>${maxOff}% off</strong><span>on Smart TVs</span></b><span class="fbenefits"><span>Free delivery across India</span><span>Cash on delivery</span>${minEmi ? "<span>No Cost EMI from " + rs(minEmi) + "/month</span>" : ""}</span><span class="btn">Shop festive offers \u2192</span></span><span class="fstage" aria-hidden="true"><span class="fglow"></span><img class="froom" src="/img/elista/webOS-Smart-TV-65in_2-960.webp" alt="" loading="lazy" width="860" height="430"></span><span class="fbanks"><span class="bankboxes"><i style="--bc:#004c8f"><u></u><b>HDFC</b>10% instant discount</i><i style="--bc:#b02a30"><u></u><b>ICICI</b>5% cashback</i><i style="--bc:#22409a"><u></u><b>SBI</b>No Cost EMI</i><i style="--bc:#97144d"><u></u><b>Axis</b>₹1,000 off</i></span><small>*T&amp;C apply \u00b7 Savings are MRP against our price</small></span></a></section>`;
  const deal = !hero || !tvs.length ? "" : `<section class="bankad bleed" aria-label="Bank offers"><div class="bahead"><span class="bskick">Bank offers</span><h2>Save up to ₹2,000 extra with your bank card</h2><p>Instant discounts, cashback and No Cost EMI on leading bank cards, on top of the festive prices. <a class="alink" href="/offers">All offers \u2192</a></p></div><div class="bacards"><a class="bacard" href="/offers" style="--bc:#004c8f"><span class="bachip" aria-hidden="true"></span><span class="babank">HDFC Bank</span><b>10% instant discount</b><span class="banote">On HDFC Bank credit cards for orders above ₹10,000. Up to ₹2,000.</span><small>*T&amp;C apply</small></a><a class="bacard" href="/offers" style="--bc:#b02a30"><span class="bachip" aria-hidden="true"></span><span class="babank">ICICI Bank</span><b>5% cashback</b><span class="banote">On ICICI Bank credit and debit cards. Up to ₹1,500.</span><small>*T&amp;C apply</small></a><a class="bacard" href="/offers" style="--bc:#22409a"><span class="bachip" aria-hidden="true"></span><span class="babank">SBI Card</span><b>No Cost EMI</b><span class="banote">3, 6 and 9 month EMI with no extra interest on SBI credit cards.</span><small>*T&amp;C apply</small></a><a class="bacard" href="/offers" style="--bc:#97144d"><span class="bachip" aria-hidden="true"></span><span class="babank">Axis Bank</span><b>₹1,000 off</b><span class="banote">On Axis Bank cards for orders above ₹25,000.</span><small>*T&amp;C apply</small></a></div></section>`;
  return header + '<main id="main" class="wrap">' + hero + "</main>"; // the first paint is the hero alone; the festive banner and the bank advertisement sit further down the page now
}
// The product page's first screen (breadcrumbs, main photo, brand, name, rating, price) written into the HTML the same way as the
// home page: the photo is the page's largest element, so it paints before the script runs. Same classes as the top of Product in
// web/src/product.jsx; the app replaces it on mount. Skipped when the admin gave the product a banner above the fold.
function staticProduct(p) {
  const webp = /^img\/(?!u-)[\w-]+\.jpg$/.test(p.img || ""), elista = /^img\/elista\/[\w-]+_\d\.webp$/.test(p.img || "");
  const v = w => "/" + (elista ? p.img.replace(/\.webp$/, (w && w < 1500 ? "-" + w : "") + ".webp") : p.img.replace(/\.jpg$/, (w ? "-" + w : "") + ".webp")), alt = escHtml(p.brand + " " + p.name);
  const img = elista ? `<img src="${v(960)}" srcset="${v(480)} 480w, ${v(960)} 960w, ${v()} 1500w" sizes="(max-width:860px) 100vw, 50vw" alt="${alt}" width="1500" height="1500" fetchpriority="high" decoding="async">` : webp ? `<img src="${v()}" srcset="${v(480)} 480w, ${v(960)} 960w, ${v()} 800w" sizes="(max-width:860px) 100vw, 50vw" alt="${alt}" width="800" height="800" fetchpriority="high" decoding="async">` : `<img src="/${escHtml(p.img)}" alt="${alt}" width="800" height="800" fetchpriority="high">`;
  const off = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0, rs = n => "₹" + n.toLocaleString("en-IN");
  const n = (p.reviews || []).length, avg = n ? p.reviews.reduce((t, r) => t + r.rating, 0) / n : 0;
  const rating = n ? `<span class="stars" title="${avg.toFixed(1)} out of 5"><span>${"★".repeat(Math.round(avg))}${"☆".repeat(5 - Math.round(avg))}</span> <small>${avg.toFixed(1)} (${n})</small></span>` : `<span class="muted" style="font-size:13px">No reviews yet</span>`;
  return staticHeader() + `<main id="main" class="wrap"><div class="crumbs"><a href="/">Home</a> › <a href="${catPath(p.cat)}">${escHtml(p.cat)}</a> › ${escHtml(p.name)}</div><div class="pdp" id="overview"><div class="gallery"><div class="img zoom">${img}${off ? `<span class="badge">${off}% off</span>` : ""}</div></div><div class="pinfo"><a class="pbrand" href="/products?brand=${encodeURIComponent(p.brand)}">${escHtml(p.brand)}</a>${p.os ? `<a class="ostag" href="/televisions?os=${encodeURIComponent(p.os)}">${escHtml(p.os)}</a>` : ""}<h1>${alt}</h1><p class="rating">${rating} <a class="alink" href="#t-rev" style="font-size:13px">See reviews</a></p><div class="price"><b>${rs(p.price)}</b>${off ? `<s>${rs(p.mrp)}</s><span class="badge">${off}% off</span>` : ""}</div><p class="muted" style="font-size:13px">Inclusive of all taxes${off ? " · You save " + rs(p.mrp - p.price) : ""}</p></div></div></main>`;
}
function serveStatic(req, res, url, clean) {
  const pathname = clean ? "/" + clean.file : url.pathname; // clean: a clean address resolved to its page (resolveClean)
  let p;
  try { p = path.normalize(path.join(PUBLIC, decodeURIComponent(pathname) + (pathname.endsWith("/") ? "index.html" : ""))); } catch { p = ""; }
  const ext = path.extname(p);
  const notFound = () => {
    if (ext && ext !== ".html") { res.writeHead(404); return res.end("Not found"); }
    fs.readFile(path.join(PUBLIC, "404.html"), (e, b) => { res.writeHead(404, { "Content-Type": TYPES[".html"] }); res.end(e ? "Not found" : b); });
  };
  if (p.includes("\0") || !p.startsWith(PUBLIC + path.sep) || !TYPES[ext]) return notFound(); // a NUL byte would crash fs
  fs.stat(p, (err, st) => {
    if (err || !st.isFile()) return notFound();
    const mtime = st.mtime.toUTCString();
    // scripts, styles and photos are revalidated with If-Modified-Since and answered 304 when unchanged; pages are personalised per address, so they are always sent
    if (ext !== ".html" && req.headers["if-modified-since"] === mtime) { res.writeHead(304); return res.end(); }
    fs.readFile(p, (err, buf) => {
      if (err) return notFound();
      // every file is revalidated (304 when unchanged), so a replaced photo shows at once; the built bundles carry a content hash in
      // their name (and three builds are kept, web/tidy.js), so they are cached for a year and a click to the next page never re-asks for them.
      // (On Vercel the bundles are served by the CDN from public/, not through this function: routed through the function, Vercel's
      // builder transpiles them to CommonJS and the browser gets "exports is not defined". Seen live on 22 Oct 2026, route removed.)
      const headers = { "Content-Type": TYPES[ext], "Last-Modified": mtime, "Cache-Control": pathname.startsWith("/assets/") || pathname.startsWith("/fonts/") ? "public, max-age=31536000, s-maxage=31536000, immutable" : "no-cache" }; // the fonts are versioned by name too
      if (ext === ".html") {
        // A page is generated per request (SEO tags, the bundle names of this build), so the shell file's date is no validator for it: a
        // browser or Vercel's edge answering If-Modified-Since with 304 would keep serving a page that names the bundles of an older
        // build (seen live on 22 Oct 2026). The build stamp is the validator instead: a new build is a new page, the same build is a 304.
        delete headers["Last-Modified"]; headers.ETag = 'W/"' + BUILT.replace(/[^0-9A-Za-z]/g, "") + '"';
        if (req.headers["if-none-match"] === headers.ETag) { res.writeHead(304, { ETag: headers.ETag, "Cache-Control": "no-cache" }); return res.end(); }
        if (clean) { url = new URL(url); url.pathname = "/" + clean.file; for (const [k, v] of Object.entries(clean.params)) url.searchParams.set(k, v); }
        const { title, head, robots } = seoTags(req, url);
        // public pages may be kept at the CDN edge for a minute and served stale while a fresh copy is fetched, so a traffic spike
        // barely reaches the server (the app still fetches live prices and stock); private pages are never cached
        headers["Cache-Control"] = robots ? "no-store" : "public, max-age=0, s-maxage=60, stale-while-revalidate=600";
        // a clean address also tells the app which category, product or info page this is (web/src/api.js reads it from <body>)
        const data = clean ? Object.entries(clean.params).map(([k, v]) => ` data-${k}="${escHtml(v)}"`).join("") : "";
        let html = buf.toString().replace(/<title>[^<]*<\/title>/, "<title>" + escHtml(title) + "</title>").replace("</head>", head + "\n</head>").replace("<body", "<body" + data).replace("<html", '<html data-built="' + BUILT + '"'); // the build stamp the page can compare with the server's (main.jsx)
        if (!clean && (pathname === "/" || pathname === "/index.html")) html = html.replace('<div id="root"></div>', '<div id="static">' + staticHome() + '</div><div id="root"></div>'); // the home page paints before the script runs; App.jsx removes #static once the real page is drawn
        if (clean && clean.file === "product.html") { const sp = db.products.find(x => String(x.id) === clean.params.id); if (sp && visible(sp) && !db.banners.some(b => b.live && b.slot === "product:" + sp.id)) html = html.replace('<div id="root"></div>', '<div id="static">' + staticProduct(sp) + '</div><div id="root"></div>'); } // and so does a product page
        buf = Buffer.from(html);
      }
      // text goes out gzipped; photos are already compressed. ponytail: gzipSync per request is fine for a small store; pre-compress if traffic grows
      if (/^(text\/|application\/)/.test(TYPES[ext]) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) { buf = zlib.gzipSync(buf); headers["Content-Encoding"] = "gzip"; headers.Vary = "Accept-Encoding"; }
      res.writeHead(200, headers);
      res.end(buf);
    });
  });
}
const server = http.createServer(async (req, res) => {
  let url;
  // a malformed address (for example "//") must get a 404, not crash the server
  try { url = new URL(req.url, "http://x"); } catch { res.writeHead(404); return res.end("Not found"); }
  for (const [k, v] of Object.entries(SECURITY)) res.setHeader(k, v);
  if (req.headers["x-forwarded-proto"] === "https") res.setHeader("Strict-Transport-Security", "max-age=31536000");
  const pathname = url.pathname;
  if (DB_URL && (pathname.startsWith("/api/") || pathname.endsWith(".html") || !/\.[a-z0-9]+$/i.test(pathname))) { // pages and API calls, not photos or scripts
    try { await ready(); await sync(); } catch (e) { console.error("database:", e.message); res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }); return res.end("The store's database is unavailable. Please try again in a minute."); }
  }
  if (pathname.startsWith("/api/")) return handleApi(req, res, pathname);
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); } // HEAD works like GET for health checks (Node sends no body)
  if (pathname === "/robots.txt") { res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("User-agent: *\nAllow: /\nAllow: /api/products\nAllow: /api/config\nAllow: /api/me\nDisallow: /api/\nDisallow: /admin\nDisallow: /account\nDisallow: /cart\nDisallow: /checkout\nDisallow: /order\nSitemap: " + siteUrl(req) + "/sitemap.xml\n"); } // Google's renderer may fetch the product data; private pages and the rest of the API stay out
  if (pathname === "/sitemap.xml") {
    // clean addresses only, each with the day its content last changed (products: their last edit; lists: their newest product; pages: the build)
    const base = siteUrl(req), cats = [...new Set(live().map(p => p.cat))], brands = [...new Set(live().map(p => p.brand))];
    const newest = list => list.map(p => p.updated || "").sort().pop() || BUILT;
    const urls = [["/", BUILT], ["/products", newest(live())], ["/offers", newest(live())], ...cats.map(c => [catPath(c), newest(live().filter(p => p.cat === c))]),
      ...brands.map(b => ["/products?brand=" + encodeURIComponent(b), newest(live().filter(p => p.brand === b))]), ...live().map(p => [productPath(p), p.updated || BUILT]), ...INFO_PAGES.filter(p => !HIDDEN_PAGES.includes(p)).map(p => ["/" + p, BUILT]), ...db.campaigns.filter(c => c.live).map(c => ["/campaigns/" + c.slug, c.updated || BUILT])];
    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
    return res.end('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(([u, d]) => "<url><loc>" + escHtml(base + u) + "</loc><lastmod>" + d.slice(0, 10) + "</lastmod></url>").join("\n") + "\n</urlset>\n");
  }
  const fileId = /^\/files\/([a-f0-9]{16})\.jpg$/.exec(pathname); // a photo uploaded in the admin (see admin/upload)
  if (fileId && DB_URL) {
    try { await ready(); const row = (await sql("SELECT type, data FROM files WHERE id = $1", [fileId[1]]))[0]; if (row) { res.writeHead(200, { "Content-Type": row.type, "Cache-Control": "public, max-age=31536000, immutable" }); return res.end(Buffer.from(row.data, "base64")); } } catch (e) { console.error("files:", e.message); }
  }
  serveStatic(req, res, url, resolveClean(pathname));
});

// ===== safety net (only when run directly, so the tests still fail loudly) =====
// data/backups/<date>/ gets a copy of every data file once a day and is kept for 14 days. To restore, copy one back over data/<name>.json.
function backup() {
  try {
    const dir = path.join(DATA, "backups"), today = new Date().toISOString().slice(0, 10), keep = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    fs.mkdirSync(path.join(dir, today), { recursive: true });
    for (const n of Object.keys(db)) if (fs.existsSync(file(n))) fs.copyFileSync(file(n), path.join(dir, today, n + ".json"));
    for (const d of fs.readdirSync(dir)) if (d < keep) fs.rmSync(path.join(dir, d), { recursive: true, force: true });
  } catch (e) { console.error("Backup failed:", e.message); }
}
if (require.main === module) {
  // an unexpected error is logged and the store keeps serving; start.bat restarts it if it ever does stop
  process.on("uncaughtException", e => console.error("Unexpected error, the store keeps running:", e));
  process.on("unhandledRejection", e => console.error("Unexpected error, the store keeps running:", e));
  backup(); setInterval(backup, 864e5).unref();
  server.on("error", e => { console.error(e.code === "EADDRINUSE" ? `Port ${PORT} is already in use, so the store is probably running already. Close this window.` : e); process.exit(e.code === "EADDRINUSE" ? 0 : 1); });
  server.listen(PORT, HOST, () => console.log(`Mytekkstore store running at http://localhost:${PORT}  (admin login is in data/ADMIN_LOGIN.txt)`));
}
module.exports = server;
module.exports.pay = { hmac, verifyCheckoutSignature, verifyWebhookSignature }; // pure functions, covered by test.js
