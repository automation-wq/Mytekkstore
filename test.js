// Self-check for the store server. Run: node test.js   (uses a temporary data folder, never the real one)
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path"), http = require("http");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "elista-test-"));
const server = require("./server.js");

server.listen(0, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:" + server.address().port;
  const call = async (p, method = "GET", body, cookie, headers) => {
    const r = await fetch(base + p, { method, headers: headers || { ...(method !== "GET" && { "Content-Type": "application/json" }), ...(cookie && { cookie }) }, body: method !== "GET" ? JSON.stringify(body || {}) : undefined });
    return { status: r.status, cookie: (r.headers.get("set-cookie") || "").split(";")[0], data: await r.json().catch(() => null) };
  };
  const addr = { name: "Test User", phone: "9999999999", address: "1 Test Street", pin: "110001" };
  try {
    let r = await call("/api/products");
    assert.equal(r.data.products.length, 9, "televisions only: the other categories are hidden (client decision 2026-10-12)");
    assert.ok(r.data.products.every(p => p.cat === "Televisions" && p.os), "every TV carries its operating system");
    assert.equal(r.data.products[0].emi, true); // sample products carry the No Cost EMI tag

    // orders need a signed-in customer
    assert.equal((await call("/api/orders", "POST", { ...addr, items: [{ id: 2, qty: 2 }] })).status, 401);
    const buyer = (await call("/api/register", "POST", { name: "Buyer One", email: "buyer@example.com", password: "longenough1" })).cookie;
    // order: total comes from server prices, stock goes down, a demo message is recorded
    r = await call("/api/orders", "POST", { ...addr, pay: "online", items: [{ id: 2, qty: 2, price: 1 }, { id: 3, qty: 1 }] }, buyer);
    assert.equal(r.status, 200);
    const orderId = r.data.id;
    r = await call("/api/orders/" + orderId, "GET", null, buyer);
    assert.equal(r.data.order.total, 32990 * 2 + 28990);
    assert.equal(r.data.order.userId, undefined);
    assert.equal(r.data.order.pay, "Paid online (demo payment)");
    r = await call("/api/products");
    assert.equal(r.data.products.find(p => p.id === 2).stock, 23);

    // bad orders are refused
    assert.equal((await call("/api/orders", "POST", { ...addr, items: [{ id: 9, qty: 1 }] }, buyer)).status, 400); // a product in a hidden category cannot be ordered
    assert.equal((await call("/api/orders", "POST", { ...addr, items: [] }, buyer)).status, 400);
    assert.equal((await call("/api/orders", "POST", { ...addr, items: [null] }, buyer)).status, 400);
    assert.equal((await call("/api/orders", "POST", { ...addr, phone: "abc", items: [{ id: 1, qty: 1 }] }, buyer)).status, 400);
    assert.equal((await call("/api/orders", "POST", { ...addr, items: [{ id: 1, qty: -1 }] }, buyer)).status, 400);
    assert.equal((await call("/api/orders/MT0000000000", "GET", null, buyer)).status, 404);
    assert.equal((await call("/api/orders/" + orderId)).status, 401); // orders are private to the customer who placed them

    // accounts
    r = await call("/api/register", "POST", { name: "Asha", email: "Asha@Example.com", password: "longenough1" });
    assert.equal(r.status, 200);
    const user = r.cookie;
    assert.match(user, /^sid=/);
    assert.equal((await call("/api/orders/" + orderId, "GET", null, user)).status, 404); // another customer cannot see it
    assert.equal((await call("/api/register", "POST", { name: "A", email: "asha@example.com", password: "longenough1" })).status, 409);
    assert.equal((await call("/api/register", "POST", { name: "A", email: "b@example.com", password: "short" })).status, 400);
    assert.equal((await call("/api/login", "POST", { email: "asha@example.com", password: "wrong-password" })).status, 401);
    assert.equal((await call("/api/login", "POST", { email: "asha@example.com", password: "longenough1" })).status, 200);
    assert.equal((await call("/api/me", "GET", null, user)).data.user.email, "asha@example.com");
    assert.equal((await call("/api/me")).data.user, null);
    assert.equal((await call("/api/orders")).status, 401);
    await call("/api/orders", "POST", { ...addr, items: [{ id: 1, qty: 1 }] }, user);
    r = await call("/api/orders", "GET", null, user);
    assert.equal(r.data.orders.length, 1);
    assert.equal((await call("/api/me", "GET", null, user)).data.user.pin, "110001"); // address saved to profile
    // profile edit: name, phone and address can be changed; a blank name is refused; sign-in required
    r = await call("/api/me", "PATCH", { name: "Asha Rao", phone: "9999999999", address: "2 New Street", pin: "400001" }, user);
    assert.equal(r.status, 200); assert.equal(r.data.user.name, "Asha Rao"); assert.equal(r.data.user.pin, "400001"); assert.equal(r.data.user.phone, "+919999999999");
    assert.equal((await call("/api/me", "PATCH", { name: "" }, user)).status, 400);
    assert.equal((await call("/api/me", "PATCH", { name: "X" })).status, 401);
    assert.equal((await call("/api/me", "PATCH", { name: "Asha", phone: "9999999999", address: "1 Test Street", pin: "110001" }, user)).status, 200); // back as it was

    // admin
    assert.equal((await call("/api/admin/orders", "GET", null, user)).status, 403);
    assert.equal((await call("/api/admin/orders")).status, 401);
    const pw = /Password: (\S+)/.exec(fs.readFileSync(path.join(process.env.DATA_DIR, "ADMIN_LOGIN.txt"), "utf8"))[1];
    const admin = (await call("/api/login", "POST", { email: "admin@mytekkstore.local", password: pw })).cookie;
    assert.equal((await call("/api/admin/orders", "GET", null, admin)).data.orders.length, 2);
    assert.ok((await call("/api/admin/outbox", "GET", null, admin)).data.messages.some(m => m.text.includes(orderId) && m.sent === "recorded only"));
    assert.equal((await call("/api/products?all=1", "GET", null, admin)).data.products.length, 14, "the admin still sees the hidden categories");

    // sign in with a mobile number: the code is hashed, expires, works once and (with no SMS provider, on localhost only) comes back for testing
    const wrongFor = c => String((+c + 1) % 1e6).padStart(6, "0");
    assert.equal((await call("/api/otp/send", "POST", { phone: "12" })).status, 400);
    r = await call("/api/otp/send", "POST", { phone: "98765 43210" });
    assert.equal(r.status, 200); assert.match(r.data.demoCode, /^\d{6}$/);
    const code = r.data.demoCode;
    assert.equal((await call("/api/otp/verify", "POST", { phone: "9876543210", code: wrongFor(code) })).status, 401);
    r = await call("/api/otp/verify", "POST", { phone: "9876543210", code });
    assert.deepEqual(r.data, { newUser: true }); // a new number needs a name before an account is made
    r = await call("/api/otp/verify", "POST", { phone: "+91 98765 43210", code, name: "Priya" });
    assert.equal(r.status, 200); assert.equal(r.data.user.name, "Priya"); assert.equal(r.data.user.phoneVerified, true);
    const priya = r.cookie;
    assert.equal((await call("/api/me", "GET", null, priya)).data.user.phone, "+919876543210");
    assert.equal((await call("/api/otp/verify", "POST", { phone: "9876543210", code })).status, 400); // a code works once
    assert.equal((await call("/api/login", "POST", { email: "", password: "x" })).status, 401); // a phone-only account has no email to sign in with
    // an order with the same number keeps the account; the next code then signs straight into it
    await call("/api/orders", "POST", { ...addr, phone: "98765 43210", items: [{ id: 1, qty: 1 }] }, priya);
    assert.equal((await call("/api/me", "GET", null, priya)).data.user.phoneVerified, true);
    r = await call("/api/otp/send", "POST", { phone: "9876543210" });
    r = await call("/api/otp/verify", "POST", { phone: "9876543210", code: r.data.demoCode });
    assert.equal(r.data.user.name, "Priya");
    assert.equal((await call("/api/otp/send", "POST", { phone: "9876543210" })).status, 200);
    assert.equal((await call("/api/otp/send", "POST", { phone: "9876543210" })).status, 429); // three codes per ten minutes
    r = await call("/api/otp/send", "POST", { phone: "9876500000" });
    for (let i = 0; i < 5; i++) await call("/api/otp/verify", "POST", { phone: "9876500000", code: wrongFor(r.data.demoCode) });
    assert.equal((await call("/api/otp/verify", "POST", { phone: "9876500000", code: r.data.demoCode })).status, 429); // five wrong tries burn the code
    assert.ok((await call("/api/admin/outbox", "GET", null, admin)).data.messages.some(m => /sign-in code/.test(m.text) && m.sent === "recorded only"));
    // contact form: a valid message lands in the admin outbox; a bad one is refused
    assert.equal((await call("/api/contact", "POST", { name: "Asha", email: "asha@example.com", message: "Do you deliver to Pune?" })).status, 200);
    assert.equal((await call("/api/contact", "POST", { name: "", email: "nope", message: "x" })).status, 400);
    assert.ok((await call("/api/admin/outbox", "GET", null, admin)).data.messages.some(m => m.text.includes("Do you deliver to Pune?") && m.sent === "received"));
    // Google sign-in and SMS stay off until their keys are set
    assert.equal((await call("/api/login/google", "POST", { credential: "x" })).status, 503);
    assert.deepEqual((await call("/api/config")).data, { google: "", sms: false, mail: false, demoCodes: false, clarity: false, chat: false });
    // a code by email signs into the account with that email; a new email gets its own account
    r = await call("/api/otp/send", "POST", { to: "Asha@Example.com" });
    assert.equal(r.status, 200); assert.equal(r.data.via, "demo");
    r = await call("/api/otp/verify", "POST", { to: "asha@example.com", code: r.data.demoCode });
    assert.equal(r.data.user.name, "Asha");
    r = await call("/api/otp/send", "POST", { to: "new.person@example.com" });
    assert.deepEqual((await call("/api/otp/verify", "POST", { to: "new.person@example.com", code: r.data.demoCode })).data, { newUser: true });
    assert.equal((await call("/api/otp/verify", "POST", { to: "new.person@example.com", code: r.data.demoCode, name: "Neel" })).data.user.email, "new.person@example.com");
    assert.equal((await call("/api/otp/send", "POST", { to: "not-a-destination" })).status, 400);
    // delivery check through India Post (the test passes offline too)
    assert.equal((await call("/api/pincode/12")).status, 404);
    r = await call("/api/pincode/110001");
    assert.ok([200, 503].includes(r.status), "pincode route answers");
    if (r.status === 200) { assert.equal(r.data.state, "Delhi"); assert.equal((await call("/api/pincode/110001")).data.district, r.data.district); }
    // reviews: sign-in needed, one per customer, user ids never exposed
    assert.equal((await call("/api/products/1/reviews", "POST", { rating: 5, text: "Great" })).status, 401);
    assert.equal((await call("/api/products/1/reviews", "POST", { rating: 9, text: "Great" }, user)).status, 400);
    assert.equal((await call("/api/products/1/reviews", "POST", { rating: 4, text: "Good" }, user)).status, 200);
    r = await call("/api/products/1/reviews", "POST", { rating: 5, text: "Great after a week" }, user);
    const mine = r.data.product.reviews.filter(x => x.name === "Asha");
    assert.equal(mine.length, 1); assert.equal(mine[0].rating, 5); assert.equal(mine[0].userId, undefined);
    assert.ok(!JSON.stringify((await call("/api/products")).data).includes("userId"));
    // photo upload: must be a small JPEG
    assert.equal((await call("/api/admin/upload", "POST", { data: "data:image/jpeg;base64," + Buffer.from("not a jpeg at all, just text").toString("base64") }, admin)).status, 400);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
    r = await call("/api/admin/upload", "POST", { data: "data:image/jpeg;base64," + jpeg.toString("base64") }, admin);
    assert.match(r.data.img, /^img\/u-[0-9a-f]{12}\.jpg$/);
    fs.unlinkSync(path.join(__dirname, "public", r.data.img));
    assert.equal((await call("/api/admin/orders/" + orderId, "PATCH", { status: "Nope" }, admin)).status, 400);
    assert.equal((await call("/api/admin/orders/" + orderId, "PATCH", { status: "Cancelled" }, admin)).status, 200);
    r = await call("/api/products");
    assert.equal(r.data.products.find(p => p.id === 2).stock, 25); // cancel returned the stock
    // reopening a cancelled order takes the stock again, and is refused once someone else has bought it
    const p4 = (await call("/api/products")).data.products.find(p => p.id === 4);
    assert.equal((await call("/api/admin/products/4", "PUT", { ...p4, stock: 3 }, admin)).status, 200); // only 3 left of this TV
    const small = (await call("/api/orders", "POST", { ...addr, items: [{ id: 4, qty: 3 }] }, buyer)).data.id; // all 3 in stock
    assert.equal((await call("/api/admin/orders/" + small, "PATCH", { status: "Cancelled" }, admin)).status, 200);
    assert.equal((await call("/api/orders", "POST", { ...addr, items: [{ id: 4, qty: 3 }] }, user)).status, 200);
    assert.equal((await call("/api/admin/orders/" + small, "PATCH", { status: "Placed" }, admin)).status, 409);
    assert.equal((await call("/api/admin/orders/" + small, "PATCH", { status: "Cancelled" }, admin)).status, 200); // same status again is harmless
    assert.equal((await call("/api/admin/orders/" + orderId, "GET", null, admin)).status, 404); // no such admin route, orders come as a list
    const np = { brand: "Mytekkstore", cat: "Audio", name: "Test <b>Speaker", price: 100, mrp: 200, stock: 5, img: "img/p0.jpg" };
    r = await call("/api/admin/products", "POST", np, admin);
    const nid = r.data.product.id; assert.equal(nid, 15); // one more than the biggest id in the catalogue
    assert.equal(r.data.product.emi, false);
    assert.equal((await call("/api/admin/products/" + nid, "PUT", { ...np, emi: true }, admin)).data.product.emi, true); // No Cost EMI flag from the admin
    assert.deepEqual((await call("/api/admin/products/" + nid, "PUT", { ...np, images: ["img/p1.jpg", "https://example.com/a.jpg"] }, admin)).data.product.images, ["img/p1.jpg", "https://example.com/a.jpg"]); // gallery photos
    assert.deepEqual((await call("/api/admin/products/" + nid, "PUT", { ...np, spin: ["img/p0.jpg", "img/p1.jpg", "img/p2.jpg", "img/p3.jpg"] }, admin)).data.product.spin, ["img/p0.jpg", "img/p1.jpg", "img/p2.jpg", "img/p3.jpg"]); // 360-degree spin frames round-trip
    assert.equal((await call("/api/admin/products/" + nid, "PUT", { ...np, spin: ["javascript:alert(1)"] }, admin)).status, 400, "a spin frame must be an image path or https link");
    assert.equal((await call("/api/admin/products/" + nid, "PUT", { ...np, images: ["javascript:alert(1)"] }, admin)).status, 400);
    assert.equal((await fetch(base + "/img/v-tv.mp4")).headers.get("content-type"), "video/mp4"); // hero clips are served
    r = await call("/api/admin/products/" + nid, "PUT", { ...np, desc: "Nice", specs: [["Power", "20 W"]] }, admin);
    assert.deepEqual(r.data.product.specs, [["Power", "20 W"]]);
    assert.equal((await call("/api/admin/products/" + nid, "PUT", { ...np, desc: "  " }, admin)).data.product.desc, ""); // description is optional
    assert.equal((await call("/api/admin/products/" + nid, "PUT", { ...np, specs: [["only-name"]] }, admin)).status, 400);
    assert.equal((await call("/api/admin/products", "POST", { ...np, img: "javascript:alert(1)" }, admin)).status, 400);
    assert.equal((await call("/api/admin/products", "POST", { ...np, mrp: 50 }, admin)).status, 400);
    assert.equal((await call("/api/admin/products/" + nid, "PUT", { ...np, price: 150 }, admin)).data.product.price, 150);
    assert.equal((await call("/api/admin/products/" + nid, "DELETE", null, admin)).status, 200);
    assert.equal((await call("/api/admin/products/9", "DELETE", null, admin)).status, 200);
    assert.equal((await call("/api/admin/products", "POST", np, admin)).data.product.id, 15); // the biggest remaining id is 14; an ordered product's id is never reused
    assert.equal((await call("/api/admin/products", "POST", np, user)).status, 403);

    // sign out ends the session
    await call("/api/logout", "POST", null, user);
    assert.equal((await call("/api/me", "GET", null, user)).data.user, null);

    // request safety
    assert.equal((await call("/api/orders", "POST", addr, buyer, { "Content-Type": "text/plain", cookie: buyer })).status, 415);
    assert.equal((await call("/api/logout", "POST", null, null, { "Content-Type": "application/json", Origin: "https://evil.example" })).status, 403);
    assert.equal((await call("/api/logout", "POST", null, null, { "Content-Type": "application/json", Origin: "null" })).status, 403);
    for (const p of ["/../server.js", "/%2e%2e/server.js", "/..%5cserver.js", "/%2e%2e%2fdata%2fusers.json", "/%00.html"]) assert.equal((await fetch(base + p)).status, 404, p);
    assert.equal((await fetch(base + "/")).status, 200);
    assert.equal((await fetch(base + "//")).status, 404); // malformed address must not crash the server
    assert.equal((await fetch(base + "/", { method: "HEAD" })).status, 200); // health checks
    assert.equal((await fetch(base + "/")).status, 200);
    assert.equal((await fetch(base + "/img/p0.jpg")).headers.get("content-type"), "image/jpeg");

    // web standards: SEO tags and structured data on pages, sitemap and robots, gzip, 304 caching, security headers, styled 404
    const raw = (p, headers) => new Promise(ok => http.get(base + p, { headers }, r => { r.resume(); r.on("end", () => ok(r)); }));
    let html = await (await fetch(base + "/product.html?id=2")).text();
    assert.ok(html.includes("<title>Telefunken 140 cm (55 inch) 4K Ultra HD Google TV | Mytekkstore</title>") && html.includes('"@type":"Product"') && html.includes('property="og:image"'), "product page carries its SEO tags");
    assert.ok((await (await fetch(base + "/category.html?cat=Televisions")).text()).includes("<title>Televisions | Mytekkstore</title>"));
    html = await (await fetch(base + "/")).text();
    assert.ok(html.includes('name="description"') && html.includes('"@type":"WebSite"') && html.includes('"SearchAction"'), "home page carries the site and search structured data");
    assert.ok((await (await fetch(base + "/category.html?cat=Televisions")).text()).includes('"@type":"ItemList"'), "category pages list their products as structured data");
    const map = await (await fetch(base + "/sitemap.xml")).text();
    assert.ok(map.includes("/televisions/elista-80-cm-32-inch-hd-ready-smart-led-tv") && map.includes("<lastmod>") && !map.includes("product.html"), "the sitemap lists clean addresses with lastmod");
    assert.ok(!map.includes("washing-machines") && !map.includes("/stores"), "hidden categories and the store locator are not in the sitemap");
    assert.equal((await fetch(base + "/washing-machines")).status, 404, "a hidden category has no page"); assert.equal((await fetch(base + "/stores")).status, 404, "the store locator is hidden");
    // clean addresses: the server serves the page, its own tags, and tells the app what to draw
    html = await (await fetch(base + "/televisions/telefunken-140-cm-55-inch-4k-ultra-hd-google-tv")).text();
    assert.ok(html.includes("<title>Telefunken 140 cm (55 inch) 4K Ultra HD Google TV | Mytekkstore</title>") && html.includes('data-id="2"') && html.includes('"@type":"Product"') && html.includes('rel="canonical" href="' + base + '/televisions/telefunken-140-cm-55-inch-4k-ultra-hd-google-tv"'), "a clean product address");
    assert.ok((await (await fetch(base + "/televisions")).text()).includes('data-cat="Televisions"'), "a clean category address");
    assert.ok((await (await fetch(base + "/shipping")).text()).includes("<title>Shipping and delivery | Mytekkstore</title>"), "a clean info address with its own title");
    assert.ok((await (await fetch(base + "/product.html?id=2")).text()).includes('rel="canonical" href="' + base + '/televisions/telefunken-140-cm-55-inch-4k-ultra-hd-google-tv"'), "the old address points at the clean one");
    assert.ok((await (await fetch(base + "/account")).text()).includes('name="robots" content="noindex'), "private pages are not indexed");
    assert.ok((await (await fetch(base + "/robots.txt")).text()).includes("Allow: /api/products"), "search engines may fetch the product data");
    assert.ok((await (await fetch(base + "/category.html")).text()).includes("<title>All products | Mytekkstore</title>"), "the full list has its own title");
    assert.ok((await (await fetch(base + "/robots.txt")).text()).includes("Sitemap:"));
    assert.ok(/s-maxage=60/.test((await raw("/televisions")).headers["cache-control"]), "public pages may be cached at the edge"); assert.equal((await raw("/cart")).headers["cache-control"], "no-store", "private pages are never cached");
    assert.equal((await call("/api/config")).data.clarity, false, "Clarity is off until CLARITY_ID is set");
    assert.equal((await raw("/seed-data.js", { "Accept-Encoding": "gzip" })).headers["content-encoding"], "gzip");
    assert.equal((await raw("/img/p0.jpg", { "Accept-Encoding": "gzip" })).headers["content-encoding"], undefined); // photos are not re-compressed
    const lm = (await raw("/seed-data.js")).headers["last-modified"];
    assert.equal((await raw("/seed-data.js", { "If-Modified-Since": lm })).statusCode, 304);
    assert.ok((await raw("/")).headers["content-security-policy"].includes("script-src 'self'"));
    assert.equal((await fetch(base + "/api/products")).headers.get("x-frame-options"), "DENY");
    const nf = await fetch(base + "/nowhere.html");
    assert.equal(nf.status, 404); assert.ok((await nf.text()).includes('data-page="notfound"'), "unknown pages get the styled 404 page");
    assert.equal((await fetch(base + "/manifest.webmanifest")).headers.get("content-type"), "application/manifest+json");

    // banners and campaigns: public lists carry only live records, the admin edits them, campaign pages are clean addresses
    r = await call("/api/banners"); assert.ok(r.data.banners.length >= 7 && r.data.banners.every(b => b.live) && r.data.banners.filter(b => b.slot === "home").length === 4, "the seeded banners: four home slides, product and campaign banners");
    r = await call("/api/campaigns"); assert.equal(r.data.campaigns[0].slug, "festive-tv-days");
    assert.equal((await call("/api/admin/banners", "POST", { slot: "home", title: "x" })).status, 401, "banners are the admin's");
    assert.equal((await call("/api/admin/banners", "POST", { slot: "product:999", title: "Nope", preset: "cinematic" }, admin)).status, 400, "a banner needs a real product");
    assert.equal((await call("/api/admin/banners", "POST", { slot: "home", title: "Nope", href: "https://elsewhere.example" }, admin)).status, 400, "buttons link only inside the site");
    r = await call("/api/admin/banners", "POST", { slot: "product:3", preset: "feature", title: "Elista 43 inch.", text: "4K.", cta: "Buy", href: "#overview", tone: "green", productId: 3, live: false }, admin);
    assert.equal(r.status, 200, JSON.stringify(r.data)); const bid = r.data.banner.id;
    assert.ok(!(await call("/api/banners")).data.banners.some(b => b.id === bid), "a banner that is not live stays off the site");
    assert.ok((await call("/api/banners?all=1", "GET", null, admin)).data.banners.some(b => b.id === bid), "the admin sees it");
    assert.equal((await call("/api/admin/banners/" + bid, "PUT", { slot: "product:3", preset: "promo", title: "Elista 43 inch.", productId: 3, live: true }, admin)).data.banner.preset, "promo");
    assert.equal((await call("/api/admin/banners/" + bid, "DELETE", null, admin)).status, 200);
    r = await call("/api/admin/campaigns", "POST", { slug: "diwali-week", title: "Diwali Week", lead: "Two picks.", theme: "green", productIds: [2, 3], features: [{ title: "4K", text: "Both are 4K." }], offers: true, faq: [["Q?", "A."]], seo: { title: "Diwali Week", desc: "Two picks." } }, admin);
    assert.equal(r.status, 200, JSON.stringify(r.data)); const cid = r.data.campaign.id;
    assert.equal((await call("/api/admin/campaigns", "POST", { slug: "diwali-week", title: "Again", productIds: [] }, admin)).status, 400, "campaign addresses are unique");
    html = await (await fetch(base + "/campaigns/diwali-week")).text();
    assert.ok(html.includes("<title>Diwali Week | Mytekkstore</title>") && html.includes('data-slug="diwali-week"') && html.includes('rel="canonical" href="' + base + '/campaigns/diwali-week"'), "a campaign page with its own title");
    assert.ok((await (await fetch(base + "/sitemap.xml")).text()).includes("/campaigns/diwali-week"), "live campaigns are in the sitemap");
    assert.equal((await call("/api/admin/campaigns/" + cid, "PUT", { slug: "diwali-week", title: "Diwali Week", productIds: [2], live: false }, admin)).status, 200);
    assert.equal((await fetch(base + "/campaigns/diwali-week")).status, 404, "a campaign that is not live has no page");
    assert.equal((await call("/api/admin/campaigns/" + cid, "DELETE", null, admin)).status, 200);
    assert.ok((await (await fetch(base + "/compare?ids=2,3")).text()).includes('data-page="compare"'), "the compare page");
    assert.equal((await call("/api/chat", "POST", { message: "Is it 4K?", page: { page: "product", id: 2 } })).status, 503, "no chat provider until ANTHROPIC_API_KEY is set; the browser answers from the catalogue");
    assert.equal((await call("/api/creative/status", "GET", null, admin)).data.connected, false, "the creative agent is a documented interface until CREATIVE_URL is set");

    // data survives on disk and passwords are not stored in plain text
    const users = fs.readFileSync(path.join(process.env.DATA_DIR, "users.json"), "utf8");
    assert.ok(!users.includes("longenough1") && !users.includes(pw));
    console.log("ALL TESTS PASSED");
  } catch (e) { console.error("TEST FAILED:", e.message, e.stack.split("\n")[2]); process.exitCode = 1; }
  server.close(); server.closeAllConnections();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
