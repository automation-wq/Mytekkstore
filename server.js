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
// Google sign-in: the OAuth client id from console.cloud.google.com. Without it the Google button is not shown.
const GOOGLE = process.env.GOOGLE_CLIENT_ID || "";
// Microsoft Clarity (free heatmaps and session recordings): set CLARITY_ID to the project id from clarity.microsoft.com and the
// tag loads on every page except the admin; the privacy page then says so. Typed text is masked by Clarity itself.
const CLARITY = /^[a-z0-9]{6,32}$/i.test(process.env.CLARITY_ID || "") ? process.env.CLARITY_ID : "";
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
}
const seedProducts = () => JSON.parse(fs.readFileSync(path.join(PUBLIC, "seed-data.js"), "utf8").replace(/^[^[]*/, "").replace(/;\s*$/, ""));
const db = {
  products: read("products", null) || seedProducts(),
  outbox: read("outbox", []),
  users: read("users", []),
  orders: read("orders", []),
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
function currentUser(req) {
  const m = /(?:^|;\s*)sid=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || "");
  const s = m && sessions.get(m[1]);
  if (!s || s.exp < Date.now()) return null;
  return db.users.find(u => u.id === s.userId) || null;
}
function startSession(req, res, user) {
  for (const [t, s] of sessions) if (s.exp < Date.now()) sessions.delete(t); // forget expired sessions and old lockouts
  for (const [k, f] of fails) if (f.until < Date.now()) fails.delete(k);
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { userId: user.id, exp: Date.now() + WEEK });
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${WEEK / 1000}${secure}`);
}
const fails = new Map(); // "ip email" -> { n, until } : slows down password guessing
const publicUser = u => u && { name: u.name, email: u.email, phone: u.phone, phoneVerified: !!u.phoneVerified, address: u.address, pin: u.pin, admin: u.admin };

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
    img: str(b.img, "Image", 300, /^(img\/[\w.-]+|https:\/\/[^\s"'<>]+)$/),
    desc: typeof b.desc === "string" && b.desc.trim() ? str(b.desc, "Description", 2000) : "",
    emi: !!b.emi, // shows the "No Cost EMI" tag
    os: typeof b.os === "string" && b.os.trim() ? str(b.os, "Operating system", 40) : "", // Google TV, WebOS, Android TV: Shop by OS and the comparison chart
    // A+ content blocks on the product page: [{ title, text, img }], up to 8
    story: Array.isArray(b.story) ? b.story.slice(0, 8).map(x => ({ title: str(x && x.title, "A+ title", 80), text: str(x && x.text, "A+ text", 600), img: x && typeof x.img === "string" && x.img.trim() ? str(x.img, "A+ photo", 300, /^(img\/[\w.-]+|https:\/\/[^\s"'<>]+)$/) : "" })) : [],
    // extra photos for the product page gallery (thumbnails), up to 8 links
    images: Array.isArray(b.images) ? b.images.slice(0, 8).map(s => str(s, "Photo link", 300, /^(img\/[\w.-]+|https:\/\/[^\s"'<>]+)$/)) : [],
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
async function sendMail(to, subject, text) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": BREVO, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: { name: "Mytekkstore", email: MAIL_FROM }, to: [{ email: to }], subject, textContent: text }) });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
function record(to, text, sent) {
  const m = { at: new Date().toISOString(), to, text, sent };
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

const publicProduct = p => ({ ...p, reviews: (p.reviews || []).map(({ userId, ...r }) => r) });
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
on("GET", "me", ({ user }) => ({ user: publicUser(user) }));
// profile: name, phone and address, kept for the next checkout. A changed number has to be verified again.
on("PATCH", "me", ({ body, user }) => {
  const name = str(body.name, "Name", 80);
  const phone = body.phone ? str(body.phone, "Phone", 15, /^[0-9+ ]{7,15}$/) : "", address = body.address ? str(body.address, "Address", 400) : "";
  const pin = body.pin ? str(body.pin, "Pincode", 10, /^[0-9A-Za-z ]{4,10}$/) : "";
  const np = phone ? e164(phone) : user.phone;
  if (np !== user.phone) { user.phone = np; user.phoneVerified = false; }
  Object.assign(user, { name, address, pin }); write("users");
  return { user: publicUser(user) };
}, "user");

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
  if (m) sessions.delete(m[1]);
  res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  return {};
});

// ===== sign in with a one-time code, by mobile number (SMS through Twilio) or by email (Brevo) =====
// The server makes a 6-digit code, keeps only its hash for 5 minutes and sends it. Without a provider the code is returned to the
// page on localhost (or anywhere with OTP_DEMO=1) so the flow can be tried; otherwise the route says codes are not set up.
const otps = new Map(); // destination -> { hash, salt, exp, tries, sentAt }
const isLocal = req => /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || "");
const phoneOf = v => { const p = str(v, "Mobile number", 20).replace(/[\s-]/g, ""); if (!/^\+?\d{10,15}$/.test(p)) bad("Please enter a valid mobile number or email address."); return e164(p); };
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
// the page sends { to }; older callers send { phone } or { email }
const destOf = body => { const v = body.to !== undefined ? body.to : body.email !== undefined ? body.email : body.phone; return isEmail(v) ? { kind: "email", to: str(v, "Email", 120).toLowerCase() } : { kind: "sms", to: phoneOf(v) }; };
on("POST", "otp/send", async ({ body, req }) => {
  const { kind, to } = destOf(body), now = Date.now(), ready = kind === "sms" ? smsReady : mailReady;
  if (!ready && !isLocal(req) && !OTP_DEMO) throw new HttpError(503, (kind === "sms" ? "SMS codes are not set up yet." : "Email codes are not set up yet.") + (kind === "sms" && mailReady ? " Use your email address instead, or" : " Please") + " sign in with your password.");
  for (const [k, v] of otps) if (v.sentAt[v.sentAt.length - 1] < now - 10 * 60 * 1000) otps.delete(k); // forget destinations with no code in the last 10 minutes
  const sentAt = ((otps.get(to) || {}).sentAt || []).filter(t => t > now - 10 * 60 * 1000);
  if (sentAt.length >= 3) throw new HttpError(429, "Too many codes requested. Please try again in 10 minutes.");
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0"), salt = crypto.randomBytes(8).toString("hex");
  otps.set(to, { hash: hashPw(code, salt), salt, exp: now + 5 * 60 * 1000, tries: 0, sentAt: [...sentAt, now] });
  const text = `${code} is your Mytekkstore sign-in code. It is valid for 5 minutes. Do not share it.`;
  if (ready) { await (kind === "sms" ? sendSms(to, text) : sendMail(to, "Your Mytekkstore sign-in code", text)); record(to, text, "sent by " + kind); return { sent: true, via: kind }; }
  record(to, text, "recorded only");
  return { sent: true, via: "demo", demoCode: code }; // only on localhost or with OTP_DEMO=1 (see the 503 above)
});
on("POST", "otp/verify", ({ body, req, res }) => {
  const { kind, to } = destOf(body), code = String(body.code || "").trim(), o = otps.get(to);
  if (!o || o.exp < Date.now()) throw new HttpError(400, "That code has expired. Please request a new one.");
  if (o.tries >= 5) { o.exp = 0; throw new HttpError(429, "Too many wrong attempts. Please request a new code."); }
  const a = Buffer.from(hashPw(code, o.salt), "hex"), b = Buffer.from(o.hash, "hex");
  if (!/^\d{6}$/.test(code) || !crypto.timingSafeEqual(a, b)) { o.tries++; throw new HttpError(401, "Wrong code. Please check the message and try again."); }
  let u;
  if (kind === "email") {
    u = db.users.find(u => u.email === to); // an email code signs into the account with that email, password or not
    if (u && !u.emailVerified) { u.emailVerified = true; write("users"); }
  } else {
    // the number's own account: a verified one, or the one customer who used this number on orders (so nobody gets a duplicate account)
    const owners = db.users.filter(u => u.phone === to);
    u = owners.find(u => u.phoneVerified) || (owners.length === 1 ? owners[0] : null);
    if (u && !u.phoneVerified) { u.phoneVerified = true; write("users"); }
  }
  if (!u) {
    if (typeof body.name !== "string" || !body.name.trim()) return { newUser: true }; // the page asks for a name, then verifies again
    u = kind === "email" ? makeUser(str(body.name, "Name", 80), to, "", false, { emailVerified: true }) : makeUser(str(body.name, "Name", 80), "", "", false, { phone: to, phoneVerified: true });
  }
  o.exp = 0; // the code is used up; the send count for this number is kept for the rate limit
  startSession(req, res, u);
  return { user: publicUser(u) };
});
// ===== sign in with Google =====
// The page gets an ID token from Google's sign-in button and posts it here. Google confirms the token and tells us the account.
on("POST", "login/google", async ({ body, req, res }) => {
  if (!GOOGLE) throw new HttpError(503, "Google sign-in is not set up yet.");
  const credential = str(body.credential, "Google sign-in", 4000);
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
  const t = r.ok ? await r.json() : {};
  if (t.aud !== GOOGLE || !/^(https:\/\/)?accounts\.google\.com$/.test(t.iss || "") || t.email_verified !== "true" || !t.email) throw new HttpError(401, "Google sign-in failed. Please try again.");
  const email = t.email.toLowerCase();
  let u = db.users.find(u => u.email === email);
  if (!u) u = makeUser(str(t.name || email.split("@")[0], "Name", 80), email, "", false, { google: t.sub });
  else if (!u.google) { u.google = t.sub; write("users"); } // an existing email account is linked to the Google account
  startSession(req, res, u);
  return { user: publicUser(u) };
});
// what the pages need to know about the optional services
on("GET", "config", () => ({ google: GOOGLE, sms: smsReady, mail: mailReady, demoCodes: OTP_DEMO, clarity: !!CLARITY }));
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
on("GET", "pincode/(\\d{6})", async ({ params }) => {
  const pin = params[0], hit = pins.get(pin);
  if (hit && hit.at > Date.now() - 86400000) return hit.data;
  let data;
  try {
    const r = await fetch("https://api.postalpincode.in/pincode/" + pin, { signal: AbortSignal.timeout(6000) });
    const j = r.ok ? await r.json() : null, po = j && j[0] && Array.isArray(j[0].PostOffice) && j[0].PostOffice[0];
    if (!po) throw new HttpError(404, "We could not find that pincode. Please check it.");
    data = { pin, area: po.Name, district: po.District, state: po.State };
  } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(503, "The pincode service is not reachable right now."); }
  pins.set(pin, { at: Date.now(), data });
  return data;
});

on("POST", "orders", ({ body, user }) => { // sign-in required
  const name = str(body.name, "Name", 80), phone = str(body.phone, "Phone", 15, /^[0-9+ ]{7,15}$/);
  const address = str(body.address, "Address", 400), pin = str(body.pin, "Pincode", 10, /^[0-9A-Za-z ]{4,10}$/);
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) bad("Your cart is empty.");
  // Prices and stock always come from the server's own product list, never from the browser.
  const lines = body.items.map(it => {
    const p = it && typeof it === "object" && db.products.find(p => p.id === it.id && visible(p)); // a hidden category cannot be ordered
    if (!p) bad("A product in your cart is no longer available.");
    const qty = int(it.qty, "Quantity", 1, 10);
    if (p.stock < qty) throw new HttpError(409, p.stock ? `Only ${p.stock} left of ${p.brand} ${p.name}.` : `${p.brand} ${p.name} is out of stock.`);
    return { p, qty };
  });
  if (new Set(lines.map(l => l.p.id)).size !== lines.length) bad("Duplicate items in cart.");
  lines.forEach(l => l.p.stock -= l.qty);
  const order = {
    id: "MT" + crypto.randomBytes(5).toString("hex").toUpperCase(), at: new Date().toISOString(), status: "Placed",
    name, phone, address, pin, email: user.email || "", // the email is for order messages when there is no SMS provider
    // "online" is a demo payment: no gateway is called. Connect a real gateway here and verify its payment signature before saving.
    pay: body.pay === "online" ? "Paid online (demo payment)" : "Cash on delivery", userId: user ? user.id : null,
    items: lines.map(({ p, qty }) => ({ id: p.id, brand: p.brand, name: p.name, img: p.img, price: p.price, qty })),
    total: lines.reduce((t, l) => t + l.p.price * l.qty, 0),
  };
  db.orders.push(order); write("orders"); write("products");
  notify(order, `Your Mytekkstore order ${order.id} is placed. Total ₹${order.total}. ${order.pay}.`);
  if (user) { // remembered for next time; a different number than the verified one has to be verified again
    const np = e164(phone);
    if (np !== user.phone) { user.phone = np; user.phoneVerified = false; }
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
on("PATCH", "admin/orders/(MT[0-9A-F]{10})", ({ params, body }) => {
  const o = db.orders.find(o => o.id === params[0]);
  if (!o) throw new HttpError(404, "Order not found.");
  if (!STATUSES.includes(body.status)) bad("Unknown status.");
  if (o.status === body.status) return { order: o };
  // cancelling returns the items to stock; reopening a cancelled order takes them again, and must not oversell
  const delta = (o.status === "Cancelled" ? 1 : 0) - (body.status === "Cancelled" ? 1 : 0);
  const lines = o.items.map(it => ({ it, p: db.products.find(p => p.id === it.id) }));
  if (delta === 1) lines.forEach(({ it, p }) => { if (p && p.stock < it.qty) throw new HttpError(409, `Only ${p.stock} left of ${p.brand} ${p.name}, so this order cannot be reopened.`); });
  if (delta) lines.forEach(({ it, p }) => { if (p) p.stock -= delta * it.qty; });
  o.status = body.status;
  write("orders"); write("products");
  notify(o, `Your Mytekkstore order ${o.id} is now: ${o.status}.`);
  return { order: o };
}, "admin");
on("GET", "admin/outbox", () => ({ messages: [...db.outbox].reverse() }), "admin");
// Product photo upload. The admin page resizes the photo to a small JPEG before sending it.
on("POST", "admin/upload", ({ body }) => {
  const buf = Buffer.from(typeof body.data === "string" ? body.data.replace(/^data:image\/jpeg;base64,/, "") : "", "base64");
  if (buf.length < 100 || buf.length > 500000 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) bad("Please choose a photo.");
  const name = "u-" + crypto.randomBytes(6).toString("hex") + ".jpg";
  fs.writeFileSync(path.join(PUBLIC, "img", name), buf);
  return { img: "img/" + name };
}, "admin");
on("POST", "admin/products", ({ body }) => {
  // an id is never reused, even after a delete: old orders still point at it
  const p = { id: Math.max(0, ...db.products.map(p => p.id), ...db.orders.flatMap(o => o.items.map(i => i.id))) + 1, ...productFrom(body), reviews: [], updated: new Date().toISOString() };
  db.products.push(p); write("products");
  return { product: p };
}, "admin");
on("PUT", "admin/products/(\\d+)", ({ params, body }) => {
  const p = db.products.find(p => p.id === +params[0]);
  if (!p) throw new HttpError(404, "Product not found.");
  Object.assign(p, productFrom(body), { updated: new Date().toISOString() }); write("products");
  return { product: p };
}, "admin");
on("DELETE", "admin/products/(\\d+)", ({ params }) => {
  const i = db.products.findIndex(p => p.id === +params[0]);
  if (i < 0) throw new HttpError(404, "Product not found.");
  db.products.splice(i, 1); write("products");
  return {};
}, "admin");

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
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
  try {
    let body = {};
    if (req.method !== "GET") {
      // one address gets at most 120 writes (orders, sign-ins, codes, reviews, messages) per 10 minutes; a shopper never needs more.
      // ponytail: counted in this process's memory; share the counter if more than one server runs
      const ip = ipOf(req), now = Date.now(), h = hits.get(ip) || { n: 0, since: now };
      if (now - h.since > 600000) { h.n = 0; h.since = now; }
      if (++h.n > 120) throw new HttpError(429, "Too many requests from this address. Please try again in a few minutes.");
      hits.set(ip, h); if (hits.size > 5000) hits.clear();
      // Cross-site request protection: browsers cannot send JSON cross-site without permission, and the origin must be ours.
      if (!/^application\/json/.test(req.headers["content-type"] || "")) throw new HttpError(415, "Invalid request.");
      const origin = req.headers.origin;
      if (origin && (!URL.canParse(origin) || new URL(origin).host !== req.headers.host)) throw new HttpError(403, "Invalid request.");
      body = await readBody(req, pathname === "/api/admin/upload" ? 700000 : 100000);
      if (!body || typeof body !== "object" || Array.isArray(body)) bad("Invalid request.");
    }
    for (const r of routes) {
      const m = r.method === req.method && r.re.exec(pathname);
      if (!m) continue;
      const user = currentUser(req);
      if (r.need && !user) throw new HttpError(401, "Please sign in.");
      if (r.need === "admin" && !user.admin) throw new HttpError(403, "Admins only.");
      return send(200, await r.fn({ req, res, body, user, params: m.slice(1) }));
    }
    throw new HttpError(404, "Not found.");
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(e instanceof HttpError ? e.code : 500, { error: e instanceof HttpError ? e.message : "Something went wrong. Please try again." });
  }
}
// ===== static files, SEO tags, sitemap =====
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4" };
// ponytail: videos are sent whole (no Range requests). Fine for short clips; add Range support if long videos are ever added.
// Sent with every response. The content security policy allows only our own scripts, our own and https photos (admin photo links,
// data: for demo-mode uploads), inline style attributes, and the Inter font from Google Fonts. With Google sign-in switched on,
// Google's button script and sign-in frame are allowed as well.
const SECURITY = {
  "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": `default-src 'self'; script-src 'self'${GOOGLE ? " https://accounts.google.com" : ""}${CLARITY ? " https://www.clarity.ms" : ""}; connect-src 'self'${GOOGLE ? " https://accounts.google.com" : ""}${CLARITY ? " https://*.clarity.ms" : ""}; frame-src ${GOOGLE ? "https://accounts.google.com" : "'none'"}; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com${GOOGLE ? " https://accounts.google.com" : ""}; font-src https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
};
const escHtml = s => String(s).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
const siteUrl = req => (req.headers["x-forwarded-proto"] || "http") + "://" + (req.headers.host || "localhost:" + PORT);
const INFO_PAGES = ["about", "contact", "stores", "shipping", "returns", "terms", "privacy"];
// title and description of each info page (the page itself is drawn by web/src/info.jsx)
const INFO_TITLES = {
  about: ["About Mytekkstore", "Mytekkstore sells genuine Elista and Telefunken electronics at factory prices, delivered free with cash on delivery and the brand's warranty."],
  contact: ["Contact us", "Write to Mytekkstore about orders, delivery, returns and service. We reply by email."],
  stores: ["Store locator", "Find a Mytekkstore store, or check delivery to your pincode: free delivery across India, usually in 3 to 5 days."],
  shipping: ["Shipping and delivery", "Free delivery on every Mytekkstore order, usually in 3 to 5 days, with cash on delivery. Check your pincode before you order."],
  returns: ["Returns and refunds", "How returns work at Mytekkstore: tell us within the return window, we pick the product up, and the refund goes back the way you paid."],
  terms: ["Terms of use", "The terms that apply when you order from Mytekkstore: prices, payment, delivery, cancellation, returns and warranty."],
  privacy: ["Privacy policy", "What Mytekkstore stores about you, why, and what it never does: no card details, one sign-in cookie, no tracking cookies."],
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
  if (CLEAN[pathname]) return { file: CLEAN[pathname], params: {} };
  const parts = pathname.split("/").filter(Boolean);
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
  let title = "Mytekkstore | Elista and Telefunken " + catWords() + " at factory prices", img = base + "/img/hero0.jpg", ld = null, robots = "";
  let desc = "Shop Elista and Telefunken " + catWords() + " at Mytekkstore, straight from the factory. Genuine products with brand warranty, free delivery, cash on delivery.";
  let canonical = file + url.search; // the clean address of this page; the old .html addresses point at it
  const p = file === "/product.html" && db.products.find(p => p.id === +q.get("id"));
  const cat = file === "/category.html" && q.get("cat"), brand = file === "/category.html" && !cat && q.get("brand"), info = file === "/page.html" && q.get("p");
  const priv = /^\/(account|cart|checkout|order|admin)\.html$/.exec(file);
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
    desc = "Festive offers at Mytekkstore: top deals on Elista and Telefunken TVs, washing machines and ACs, bank offers and No Cost EMI.";
  } else if (cat) {
    canonical = catPath(cat);
    title = cat + " | Mytekkstore";
    desc = "Elista and Telefunken " + cat.toLowerCase() + " at Mytekkstore: every model compared side by side, with a buying guide, free delivery and cash on delivery.";
    const first = db.products.find(p => p.cat === cat);
    if (first) img = base + "/" + first.img;
    ld = [
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [["Home", base + "/"], [cat, base + canonical]].map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) },
      { "@context": "https://schema.org", "@type": "ItemList", name: cat + " at Mytekkstore", itemListElement: db.products.filter(p => p.cat === cat).slice(0, 20).map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.brand + " " + p.name, url: base + productPath(p) })) },
    ];
  } else if (file === "/category.html") {
    canonical = brand ? "/products?brand=" + encodeURIComponent(brand) : "/products";
    title = (brand || "All products") + " | Mytekkstore";
    desc = (brand ? "All " + brand + " " : "All Elista and Telefunken ") + catWords() + " at Mytekkstore, with filters for " + (brand ? "" : "brand, ") + "size, operating system, price and discount.";
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
      const headers = { "Content-Type": TYPES[ext], "Last-Modified": mtime, "Cache-Control": "no-cache" }; // every file is revalidated (304 when unchanged), so a replaced photo shows at once
      if (ext === ".html") {
        if (clean) { url = new URL(url); url.pathname = "/" + clean.file; for (const [k, v] of Object.entries(clean.params)) url.searchParams.set(k, v); }
        const { title, head, robots } = seoTags(req, url);
        // public pages may be kept at the CDN edge for a minute and served stale while a fresh copy is fetched, so a traffic spike
        // barely reaches the server (the app still fetches live prices and stock); private pages are never cached
        headers["Cache-Control"] = robots ? "no-store" : "public, max-age=0, s-maxage=60, stale-while-revalidate=600";
        // a clean address also tells the app which category, product or info page this is (web/src/api.js reads it from <body>)
        const data = clean ? Object.entries(clean.params).map(([k, v]) => ` data-${k}="${escHtml(v)}"`).join("") : "";
        buf = Buffer.from(buf.toString().replace(/<title>[^<]*<\/title>/, "<title>" + escHtml(title) + "</title>").replace("</head>", head + "\n</head>").replace("<body", "<body" + data));
      }
      // text goes out gzipped; photos are already compressed. ponytail: gzipSync per request is fine for a small store; pre-compress if traffic grows
      if (/^(text\/|application\/)/.test(TYPES[ext]) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) { buf = zlib.gzipSync(buf); headers["Content-Encoding"] = "gzip"; headers.Vary = "Accept-Encoding"; }
      res.writeHead(200, headers);
      res.end(buf);
    });
  });
}
const server = http.createServer((req, res) => {
  let url;
  // a malformed address (for example "//") must get a 404, not crash the server
  try { url = new URL(req.url, "http://x"); } catch { res.writeHead(404); return res.end("Not found"); }
  for (const [k, v] of Object.entries(SECURITY)) res.setHeader(k, v);
  if (req.headers["x-forwarded-proto"] === "https") res.setHeader("Strict-Transport-Security", "max-age=31536000");
  const pathname = url.pathname;
  if (pathname.startsWith("/api/")) return handleApi(req, res, pathname);
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); } // HEAD works like GET for health checks (Node sends no body)
  if (pathname === "/robots.txt") { res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("User-agent: *\nAllow: /\nAllow: /api/products\nAllow: /api/config\nAllow: /api/me\nDisallow: /api/\nDisallow: /admin\nDisallow: /account\nDisallow: /cart\nDisallow: /checkout\nDisallow: /order\nSitemap: " + siteUrl(req) + "/sitemap.xml\n"); } // Google's renderer may fetch the product data; private pages and the rest of the API stay out
  if (pathname === "/sitemap.xml") {
    // clean addresses only, each with the day its content last changed (products: their last edit; lists: their newest product; pages: the build)
    const base = siteUrl(req), cats = [...new Set(live().map(p => p.cat))], brands = [...new Set(live().map(p => p.brand))];
    const newest = list => list.map(p => p.updated || "").sort().pop() || BUILT;
    const urls = [["/", BUILT], ["/products", newest(live())], ["/offers", newest(live())], ...cats.map(c => [catPath(c), newest(live().filter(p => p.cat === c))]),
      ...brands.map(b => ["/products?brand=" + encodeURIComponent(b), newest(live().filter(p => p.brand === b))]), ...live().map(p => [productPath(p), p.updated || BUILT]), ...INFO_PAGES.filter(p => !HIDDEN_PAGES.includes(p)).map(p => ["/" + p, BUILT])];
    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
    return res.end('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(([u, d]) => "<url><loc>" + escHtml(base + u) + "</loc><lastmod>" + d.slice(0, 10) + "</lastmod></url>").join("\n") + "\n</urlset>\n");
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
