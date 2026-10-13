// Self-check of the Creative Intelligence Agent, end to end, with nothing outside this machine: the shop (../server.js) is started
// on a local port as the permitted reference website, the agent researches it, extracts a product from it, analyses a reference,
// writes concepts, renders a creative with the composite provider, checks it, approves it and exports everything.
// Run: node test.js   (temporary data folders; needs Microsoft Edge for the headless browser, like the shop's browser tests)
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "creative-shop-"));
process.env.CREATIVE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "creative-agent-"));
const AGENT_PORT = 3299; process.env.CREATIVE_URL = "http://127.0.0.1:" + AGENT_PORT; // the shop's hook points at this agent
const shop = require("../server.js"), agent = require("./server.js");
const { parseRobots, allowed } = require("./lib/research.js");
const { crc32 } = require("./lib/export.js");

shop.listen(0, "127.0.0.1", () => agent.listen(AGENT_PORT, "127.0.0.1", async () => {
  const shopBase = "http://127.0.0.1:" + shop.address().port, base = "http://127.0.0.1:" + agent.address().port;
  const call = async (p, method = "GET", body) => { const r = await fetch(base + p, { method, headers: method === "GET" || method === "DELETE" ? {} : { "content-type": "application/json" }, body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body || {}) }); const ct = r.headers.get("content-type") || ""; return { status: r.status, data: ct.includes("json") ? await r.json() : ct.includes("text") ? await r.text() : Buffer.from(await r.arrayBuffer()), headers: r.headers }; };
  let step = "";
  try {
    step = "health and settings";
    let r = await call("/api/health"); assert.equal(r.data.ok, true); assert.equal(r.data.providers.ready.composite, true);
    r = await call("/api/settings", "PUT", { maxPagesPerSite: 3, imageProvider: "composite" }); assert.equal(r.data.settings.maxPagesPerSite, 3);

    step = "robots rules";
    assert.deepEqual(parseRobots("User-agent: *\nDisallow: /admin\nDisallow: /api/\n\nUser-agent: x\nDisallow: /").disallow, ["/admin", "/api/"]);
    assert.equal(await allowed(shopBase + "/televisions", "test"), true); assert.equal(await allowed(shopBase + "/admin", "test"), false, "the shop's robots.txt keeps /admin out");

    step = "research a permitted website end to end";
    r = await call("/api/websites", "POST", { brand: "Mytekkstore", url: shopBase + "/televisions" }); assert.equal(r.status, 200, JSON.stringify(r.data)); const site = r.data.website;
    assert.equal((await call("/api/websites", "POST", { brand: "x", url: "ftp://nope" })).status, 400);
    r = await call(`/api/websites/${site.id}/research`, "POST"); const job = await agent.wait(r.data.job.id);
    assert.ok(job.result.done.length >= 2, "the start page and at least one discovered page were collected: " + JSON.stringify(job.result));
    r = await call("/api/references"); const refs = r.data.references;
    assert.ok(refs.length >= 2 && refs.every(x => x.sourceUrl && x.collectedAt && x.status === "completed"), "every reference has a source and a status");
    const prodRef = refs.find(x => x.pageType === "product"); assert.ok(prodRef, "a product page was recognised from its structured data: " + refs.map(x => x.pageType + " " + x.sourceUrl).join(", "));
    r = await call("/api/references/" + prodRef.id); const full = r.data.reference;
    assert.ok(fs.existsSync(path.join(process.env.CREATIVE_DATA_DIR, "assets", full.imagePath)), "the screenshot is kept locally");
    assert.ok(full.facts.productName && full.facts.palette.length >= 3 && full.facts.typography.headline && full.facts.layout.headline, "facts: product name, palette, headline font and position: " + JSON.stringify({ name: full.facts.productName, palette: full.facts.palette.length, hf: !!full.facts.typography.headline, lh: !!full.facts.layout.headline }));
    assert.ok(/₹/.test(full.facts.price), "the displayed price was captured: " + full.facts.price);
    assert.equal(Object.keys(full.notes).length, 0, "no interpretation before the analysis");
    assert.ok((await call("/api/pages?websiteId=" + site.id)).data.pages.every(p => p.status === "completed" || p.status === "failed"));
    r = await call("/api/references?q=telefunken&type=product"); assert.ok(r.data.references.length >= 1, "search and filters");

    step = "analyse the reference";
    r = await call(`/api/references/${prodRef.id}/analyze`, "POST"); await agent.wait(r.data.job.id);
    r = await call("/api/analyses?referenceId=" + prodRef.id); const an = r.data.analyses[0];
    assert.ok(an.facts.firstNoticed && an.patterns.length && an.lessons.length && an.hypotheses[0].includes("hypothesis") && an.concept.approach, "facts, patterns, lessons, a labelled hypothesis and a recommended concept");
    assert.ok((await call("/api/references/" + prodRef.id)).data.reference.notes.label.includes("interpretation"), "interpretation is labelled on the reference");

    step = "product from a page, by hand, by file";
    r = await call("/api/products/extract", "POST", { url: shopBase + "/televisions/telefunken-140-cm-55-inch-4k-ultra-hd-google-tv" }); await agent.wait(r.data.job.id);
    let products = (await call("/api/products")).data.products; const extracted = products[0];
    assert.ok(/Telefunken/.test(extracted.brand) && /55 inch/.test(extracted.name) && extracted.price === 32990 && extracted.images.length && extracted.conflicts.length === 0 && extracted.source.includes("structured data"), "extracted from the page's structured data: " + JSON.stringify({ b: extracted.brand, n: extracted.name, p: extracted.price }));
    r = await call("/api/products", "POST", { brand: "Elista", name: "126 cm (50 inch) 4K Ultra HD Smart TV", model: "ELS-50", category: "Televisions", price: 31990, usps: ["4K Ultra HD", "WebOS built in"], specs: { "Screen size": "126 cm (50 inch)", "Resolution": "4K Ultra HD, 3840 x 2160", "Smart TV": "WebOS with streaming apps", "Sound output": "24 W", "Ports": "3 HDMI, 2 USB" }, offers: ["No Cost EMI"], images: ["img/p2.jpg"], warranty: "1 year brand warranty", guidelines: "Brand colours: #08805f and #0d1117" });
    assert.equal(r.status, 200, JSON.stringify(r.data)); const product = r.data.product;
    assert.equal((await call("/api/products", "POST", { name: "no brand" })).status, 400, "a product needs a brand");
    r = await call("/api/products/import", "POST", { text: 'brand,name,price,usps,specs\nTelefunken,"80 cm (32 inch) HD Ready TV",11490,HD Ready;Google TV,"Resolution: HD Ready; Smart TV: Google TV"' });
    assert.equal(r.data.products.length, 1); assert.equal(r.data.products[0].specs["Smart TV"], "Google TV", "CSV import keeps the specifications");
    r = await call(`/api/products/${product.id}/images`, "POST", { data: "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "..", "public", "img", "p2-cut.webp")).toString("base64"), name: "p2.webp" }); // an upload becomes the first image
    assert.equal(r.status, 200); assert.ok(r.data.product.images[0].startsWith("uploads/"));

    step = "concepts for the product";
    r = await call(`/api/products/${product.id}/concepts?wait=1`, "POST", { objective: "feature education" });
    const concepts = r.data.concepts; assert.ok(concepts.length >= 4, "several approaches: " + concepts.map(c => c.approach).join(", "));
    assert.equal(concepts[0].approach, "feature-led infographic", "the objective picks what to make first");
    for (const c of concepts) assert.ok(c.headline && c.prompt.includes("No text") && c.negative && c.difference && c.width && c.ratio && c.priority && c.reason && Array.isArray(c.references), "every concept is complete: " + c.name);
    assert.ok(concepts.some(c => c.approach === "offer-led" && c.headline.includes("₹31,990")), "the offer concept uses the real price");
    assert.ok(!concepts.some(c => /8K|OLED|120 Hz/i.test(c.headline + c.supporting)), "no invented specification");
    r = await call("/api/concepts/" + concepts[0].id, "PUT", { headline: "4K Ultra HD. WebOS. 24 W.", width: 1080, height: 1080 }); assert.equal(r.data.concept.ratio, "1:1", "editing the size recomputes the ratio");

    step = "generate a creative, check it, approve it";
    r = await call(`/api/concepts/${concepts[0].id}/generate?wait=1`, "POST", { instructions: "keep the product large" });
    assert.equal(r.status, 200, JSON.stringify(r.data)); const asset = r.data.asset, quality = r.data.qc;
    const abs = path.join(process.env.CREATIVE_DATA_DIR, "assets", asset.path);
    assert.ok(fs.existsSync(abs) && fs.statSync(abs).size > 10000 && asset.width === 1080 && asset.height === 1080 && asset.provider === "composite", "a real file at the requested size");
    assert.ok(asset.layout.product && asset.layout.product.cut && asset.layout.text.some(t => t.kind === "headline"), "the real product was composited as a cutout and the headline drawn");
    assert.ok(quality.score >= 80, "quality score " + quality.score + ": " + JSON.stringify(quality.issues));
    assert.ok(quality.checks.some(c => c.name === "Claims traceable" && c.pass) && quality.checks.some(c => c.name === "Brand colours") && quality.checks.some(c => c.kind === "manual"), "deterministic checks plus manual ones");
    assert.equal(asset.status, "awaiting approval");
    r = await call(`/api/concepts/${concepts[0].id}/generate?wait=1`, "POST", { instructions: "second version" }); assert.equal(r.data.asset.version, 2, "versions are kept, not overwritten");
    assert.ok(fs.existsSync(abs), "the first version still exists");
    r = await call(`/api/assets/${asset.id}/status`, "POST", { status: "approved", notes: "ok" }); assert.equal(r.data.asset.status, "approved");
    r = await call("/api/assets/" + asset.id); assert.equal(r.data.versions.length, 2); assert.ok(r.data.concept && r.data.product && r.data.qc, "everything is linked by id");

    step = "exports";
    r = await call("/api/export/references.csv"); assert.ok(r.data.split("\r\n").length >= 3 && r.data.includes("sourceUrl"), "reference inventory");
    r = await call("/api/export/approved.zip"); assert.equal(r.data.slice(0, 2).toString(), "PK"); assert.ok(r.data.includes("manifest.json") && r.data.includes("asset-" + asset.id), "the approved asset and a manifest in the zip");
    assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926, "CRC32 reference value");
    r = await call("/api/export/report.md"); assert.ok(r.data.includes("Elista 126 cm") && r.data.includes("hypothes") && r.data.includes("Difference:"), "the strategy report");
    r = await call("/api/export/products.json"); assert.equal((typeof r.data === "string" ? JSON.parse(r.data) : r.data).length, 3);

    step = "Amazon A+ Content studio";
    r = await call(`/api/products/${product.id}/aplus/plan`); assert.ok(r.data.plan.modules.length >= 4 && r.data.plan.modules.some(m => m.type === "specs") && r.data.plan.dimensions.includes("970"), "the A+ plan lists the standard modules");
    r = await call(`/api/products/${product.id}/aplus?wait=1`, "POST"); const mods = r.data.modules;
    assert.ok(mods.length >= 4 && mods.every(m => m.width === 970 && m.kind === "aplus"), "every A+ module renders at 970 px: " + mods.map(m => m.module + " " + m.width).join(", "));
    for (const m of mods) { const abs = path.join(process.env.CREATIVE_DATA_DIR, "assets", m.path); assert.ok(fs.existsSync(abs) && fs.statSync(abs).size > 3000, "a real file for " + m.module); assert.ok(m.qc && m.qc.score >= 100, m.module + " QC " + (m.qc && m.qc.score) + ": " + (m.qc ? m.qc.checks.filter(c => !c.pass).map(c => c.name) : "")); }
    assert.ok(mods.some(m => m.module === "comparison") && mods.some(m => m.module === "features" && m.copy.callouts.length), "comparison and feature-callout modules present with verified callouts");
    r = await call(`/api/products/${product.id}/aplus?wait=1`, "POST"); assert.equal((await call(`/api/aplus?productId=${product.id}`)).data.modules.length, mods.length, "re-running replaces the modules, does not duplicate");
    const zres = await fetch(base + `/api/export/aplus-${product.id}.zip`); const zbuf = Buffer.from(await zres.arrayBuffer());
    assert.ok(zbuf.slice(0, 2).toString() === "PK" && zbuf.includes("aplus-copy.md") && zbuf.includes("brand-970x300.png"), "the A+ export zip has the module PNGs and the copy document");

    step = "the shop's hook";
    r = await call("/api/concepts", "POST", { product: { brand: "Telefunken", name: "108 cm (43 inch) 4K Ultra HD Google TV", price: 26990, emi: true, img: "img/p1.jpg", os: "Google TV", specs: [["Screen size", "108 cm (43 inch)"], ["Resolution", "4K Ultra HD, 3840 x 2160"], ["Smart TV", "Google TV with voice remote"], ["Sound output", "24 W, Dolby Audio"]] }, slot: "product:12", objective: "banner" });
    assert.ok(r.data.concepts.length >= 3 && r.data.concepts[0].headline && r.data.concepts[0].kicker.startsWith("Telefunken"), "concepts for a product sent by the shop");

    step = "failures are visible and retryable; research can pause";
    r = await call("/api/websites", "POST", { brand: "Nowhere", url: "http://127.0.0.1:9/" });
    const dead = r.data.website; r = await call(`/api/websites/${dead.id}/research`, "POST");
    await agent.wait(r.data.job.id).then(() => assert.fail("should fail"), e => assert.ok(e.message, "a failed job carries its error: " + e.message));
    let j = (await call("/api/jobs?status=failed")).data.jobs[0]; assert.equal(j.kind, "research"); assert.equal(j.attempts, 1);
    r = await call(`/api/jobs/${j.id}/retry`, "POST"); await agent.wait(j.id).catch(() => {}); assert.equal((await call("/api/jobs/" + j.id)).data.job.attempts, 2, "retried once more");
    await call("/api/research/pause", "POST"); r = await call(`/api/websites/${site.id}/research`, "POST"); await new Promise(x => setTimeout(x, 400));
    assert.equal((await call("/api/jobs/" + r.data.job.id)).data.job.status, "pending", "research waits while paused"); await call("/api/research/resume", "POST"); await agent.wait(r.data.job.id);
    assert.ok((await call("/api/overview")).data.failedJobs >= 1 && (await call("/api/logs")).data.logs.length > 0, "failures and logs are visible");
    r = await call(`/api/references/${prodRef.id}/recheck`, "POST"); await agent.wait(r.data.job.id); assert.equal((await call("/api/references/" + prodRef.id)).data.reference.broken, false, "recheck: the source page still answers");

    step = "the shop is connected through CREATIVE_URL";
    const pw = /Password: (.+)/.exec(fs.readFileSync(path.join(process.env.DATA_DIR, "ADMIN_LOGIN.txt"), "utf8"))[1].trim();
    const login = await fetch(shopBase + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@mytekkstore.local", password: pw }) });
    const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
    const st = await (await fetch(shopBase + "/api/creative/status", { headers: { cookie } })).json();
    assert.equal(st.connected, true, "the shop sees the agent: " + JSON.stringify(st));
    const hook = await (await fetch(shopBase + "/api/creative/concepts", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ productId: 2, slot: "product:2", objective: "banner" }) })).json();
    assert.ok(hook.concepts && hook.concepts.length >= 3 && hook.concepts[0].headline, "the shop's admin gets concepts for its product: " + JSON.stringify(hook).slice(0, 200));

    console.log("ALL CREATIVE TESTS PASSED", "data:", process.env.CREATIVE_DATA_DIR);
  } catch (e) { console.error("CREATIVE TEST FAILED at \"" + step + "\":", e.message); process.exitCode = 1; }
  finally { await require("./lib/browser.js").close(); shop.close(); agent.close(); setTimeout(() => process.exit(process.exitCode || 0), 200); }
}));
