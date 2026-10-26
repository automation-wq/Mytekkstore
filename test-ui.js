// Browser check for the storefront. Run: node test-ui.js
// It drives a real headless browser (Edge or Chrome) with real mouse moves, taps and key presses, against its own copy of
// the store on a free port with a temporary data folder, so real orders and accounts are never touched.
// Other scripts can reuse the pieces: const { startStore, launch, sleep } = require("./test-ui.js")
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path"), { spawn } = require("child_process");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BROWSER = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(p => fs.existsSync(p));

// Starts the store. One store per process, because server.js reads DATA_DIR when it is first loaded.
function startStore() {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mytekk-ui-"));
  const server = require("./server.js");
  return new Promise(res => server.listen(0, "127.0.0.1", () => res({
    base: "http://127.0.0.1:" + server.address().port,
    close() { server.close(); server.closeAllConnections(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); },
  })));
}

// Opens a headless browser window and returns helpers to drive it. Give each browser running at the same time its own port.
async function launch({ port = 9555, width = 1366, height = 800, mobile = false } = {}) {
  if (!BROWSER) throw new Error("No Edge or Chrome found");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "mytekk-browser-"));
  const proc = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=" + port,
    "--user-data-dir=" + profile, `--window-size=${width},${height}`, "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page"); } catch {}
  }
  if (!target) { proc.kill(); throw new Error("The browser did not start"); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("Could not connect to the browser")); });
  let seq = 0, onLoad = null, at = [0, 0];
  const waiting = new Map(), errors = []; // errors: uncaught exceptions, console.error calls and failed requests seen so far
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id) { const w = waiting.get(d.id); waiting.delete(d.id); return d.error ? w.rej(new Error(d.error.message)) : w.res(d.result); }
    if (d.method === "Page.loadEventFired" && onLoad) { onLoad(); onLoad = null; }
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map(a => a.value ?? a.description).join(" "));
    if (d.method === "Log.entryAdded" && d.params.entry.level === "error") errors.push(d.params.entry.text + " " + (d.params.entry.url || ""));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { waiting.set(++seq, { res, rej }); ws.send(JSON.stringify({ id: seq, method, params })); });
  for (const d of ["Page", "Runtime", "Log"]) await send(d + ".enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "try { localStorage.setItem(\"welcome\", \"1\"); } catch {}" }); // the welcome dialog is modal and stays closed under the suite; the probes open it with ?welcome=1
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const KEYS = { Tab: 9, Enter: 13, Escape: 27 };
  const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, ...extra });
  // runs JavaScript in the page and returns its value; promises are awaited
  const ev = async expression => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("In page: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  // waits for the page that an action loads, and for the store script to finish drawing it
  const afterLoad = async action => {
    let timer;
    const loaded = new Promise((res, rej) => { onLoad = res; timer = setTimeout(() => rej(new Error("Page did not load in 20 s")), 20000); });
    try {
      // an address that differs only after the # stays on the same page, so no load follows
      if (await action() === "same page") onLoad = null; else await loaded;
    } finally { clearTimeout(timer); }
    await ev("typeof ready === 'undefined' ? 0 : ready.then(() => new Promise(r => setTimeout(r, 80)))");
    for (let i = 0; i < 100 && await ev("!!document.getElementById('static')"); i++) await sleep(30); // some pages paint a static first screen; the app removes it once its own header and page are drawn
    for (let i = 0; i < 100 && !(await ev("!!document.querySelector('#hdr .l0link')")); i++) await sleep(30); // and the app's own header bar is drawn (it can trail the ready signal by a few hundred ms on a busy machine)
  };
  return {
    errors, ev, send, afterLoad,
    goto: url => afterLoad(async () => (await send("Page.navigate", { url })).loaderId ? "new page" : "same page"),
    // centre of the n-th element matching a selector, scrolled into view first
    // scrolls the element into view, lets the reveal motion settle (sections and cards rise a little as they appear), then measures
    async center(sel, n = 0) {
      const q = `document.querySelectorAll(${JSON.stringify(sel)})[${n}]`;
      // twice: sections below the first screen are laid out only as they come near (content-visibility), so the first scroll can land
      // on a placeholder; the second one lands on the rendered element
      for (const wait of [250, 120]) { await ev(`(() => { const el = ${q}; if (!el) throw new Error("No element " + ${JSON.stringify(sel)} + " #${n}"); el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" }); })()`); await sleep(wait); }
      return ev(`(() => { const r = ${q}.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })()`);
    },
    async move(x, y) { at = [x, y]; await mouse("mouseMoved", x, y); },
    // moves the pointer in small steps, like a hand would
    async glide(x, y, ms = 200) {
      const [x0, y0] = at, steps = Math.max(2, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) { await mouse("mouseMoved", Math.round(x0 + (x - x0) * i / steps), Math.round(y0 + (y - y0) * i / steps)); await sleep(ms / steps); }
      at = [x, y];
    },
    async click(x, y) { at = [x, y]; await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y, { button: "left", clickCount: 1 }); await mouse("mouseReleased", x, y, { button: "left", clickCount: 1 }); },
    async tap(x, y) { await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); },
    async key(key, { shift = false } = {}) {
      const k = { key, code: key, windowsVirtualKeyCode: KEYS[key], modifiers: shift ? 8 : 0 };
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...k, ...(key === "Enter" && { text: "\r" }) });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...k });
    },
    async shot(file) { fs.writeFileSync(file, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64")); },
    async close() { try { await send("Browser.close"); } catch {} proc.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} },
  };
}

async function run() {
  const store = await startStore(), b = await launch(), base = store.base;
  const open = (w = b) => w.ev(`[...document.querySelectorAll(".l0.open .l0link")].map(a => a.textContent).join()`);
  // font files may be unreachable offline; that is not a storefront fault
  // a 4xx answer from our own API is a handled reply (for example a wrong sign-in code), not a page fault
  const realErrors = w => w.errors.filter(e => !/fonts\.(googleapis|gstatic)/.test(e) && !/Failed to load resource: the server responded with a status of 4\d\d .*\/api\//.test(e));
  let step = "start";
  try {
    step = "bar contents";
    await b.goto(base + "/");
    assert.equal(await b.ev(`document.querySelector("#hdr").innerText.includes("Menu")`), false, "the old Menu button is gone");
    assert.deepEqual(await b.ev(`[...document.querySelectorAll(".l0link")].map(a => a.textContent)`), ["Televisions", "Brands", "Best Deals", "Support", "Track order"]);
    assert.equal(await open(), "", "no menu is open at the start");

    step = "hover opens after a short delay";
    // The page itself records when the pointer entered a category and when a menu opened,
    // so the timing checks do not depend on how quickly this script talks to the browser.
    await b.ev(`window.navLog = []; document.querySelectorAll(".l0").forEach(l => l.addEventListener("pointerenter", () => navLog.push(["enter", performance.now()])));
      new MutationObserver(ms => ms.forEach(m => (m.target.classList?.contains("open") || [...m.addedNodes].some(n => n.nodeType === 1 && (n.classList.contains("open") || n.querySelector(".open")))) && navLog.push(["open", performance.now()])))
        .observe(document.querySelector(".gbar"), { subtree: true, attributes: true, attributeFilter: ["class"], childList: true }); 0`); // the open class can arrive on a re-created node, not only as an attribute change
    const tv = await b.center(".l0link", 0), away = [700, 620]; // on the hero photo, below the open menu panel (bottom 563 px) and above the band, which is one big link now; inert on every slide
    await b.move(...away);
    await b.glide(...tv, 120);
    // wait for the panel and the dim layer to finish fading in (the machine may be busy)
    for (let i = 0; i < 25 && +(await b.ev(`getComputedStyle(document.querySelector(".navshade")).opacity`)) < 0.95; i++) await sleep(100);
    assert.equal(await open(), "Televisions");
    const log = await b.ev(`navLog`), opened = log.find(e => e[0] === "open"), entered = log.find(e => e[0] === "enter");
    assert.ok(opened && entered, "the page should log the pointer entering and the menu opening; log: " + JSON.stringify(log));
    const delay = opened[1] - entered[1];
    assert.ok(delay >= 120 && delay < 400, `the menu should open a moment after the pointer arrives, not instantly; it took ${Math.round(delay)} ms`);
    const panel = await b.ev(`(() => { const p = document.querySelector(".l0.open .npanel"), r = p.getBoundingClientRect(), s = getComputedStyle(p), h = document.querySelector("#hdr").getBoundingClientRect();
      return { vis: s.visibility, opacity: +s.opacity, left: r.left, width: r.width, top: r.top, bottom: r.bottom, hdrBottom: h.bottom, vw: document.documentElement.clientWidth, vh: innerHeight,
        expanded: document.querySelector(".l0.open .l0link").getAttribute("aria-expanded"), shade: getComputedStyle(document.querySelector(".navshade")).opacity,
        tiles: p.querySelectorAll(".ntile").length, prods: p.querySelectorAll(".nprod").length, links: [...p.querySelectorAll(".ndisc a")].map(a => a.textContent.trim().split("\\n")[0]) }; })()`);
    assert.equal(panel.vis, "visible"); assert.ok(panel.opacity > 0.95, "panel has faded in");
    assert.equal(panel.left, 0); assert.equal(panel.width, panel.vw, "panel spans the full width");
    assert.ok(Math.abs(panel.top - panel.hdrBottom) <= 2, "panel sits directly under the header");
    assert.ok(panel.bottom <= panel.vh, "panel fits in the window");
    assert.equal(panel.expanded, "true"); assert.ok(+panel.shade > 0.9, "page behind is dimmed");
    assert.equal(panel.tiles, 11, "all TVs, six sizes, two brands, two operating systems"); assert.equal(panel.prods, 4);
    assert.equal(panel.links[0], "Compare operating systems"); assert.ok(panel.links.includes("Top features") && !panel.links.includes("Store locator"), "no store locator link (hidden, client decision)");

    step = "moving into the panel keeps it open";
    await b.glide(...await b.center(".l0.open .ntile", 2), 250);
    await sleep(400);
    assert.equal(await open(), "Televisions");
    await b.glide(...await b.center(".l0.open .nprod", 3), 250);
    await sleep(400);
    assert.equal(await open(), "Televisions");

    step = "moving to another category switches";
    await b.glide(...await b.center(".l0link", 1), 250);
    await sleep(400);
    assert.equal(await open(), "Brands");

    step = "leaving closes";
    await b.glide(...away, 200);
    await sleep(500);
    assert.equal(await open(), "");
    assert.equal(await b.ev(`getComputedStyle(document.querySelector(".npanel")).visibility`), "hidden");

    step = "a quick pass over the bar opens nothing";
    // Timed inside the page, because the browser merges real mouse moves that arrive in the same instant.
    const flashed = await b.ev(`(async () => { navLog.length = 0; const li = document.querySelector(".l0"), wait = ms => new Promise(r => setTimeout(r, ms));
      li.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" })); await wait(60);
      li.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" })); await wait(450);
      return navLog.filter(e => e[0] === "open").length; })()`);
    assert.equal(flashed, 0, "no menu opened during a 60 ms pass over a category");
    assert.equal(await open(), "");

    step = "a click right after leaving a hover menu reaches the page";
    await b.glide(...await b.center(".l0link", 0), 120); await sleep(450);
    assert.equal(await open(), "Televisions");
    const cardLink = await b.center("main .card h3", 0); // the product name: the link's centre now sits on the Quick view button, which is its own control
    await b.glide(...cardLink, 120); // leave the menu and click a product at once, inside the menu's closing delay
    await b.afterLoad(async () => b.click(...cardLink));
    assert.equal(await b.ev(`document.body.dataset.page`), "product", "the dim layer must not swallow that click");
    await b.goto(base + "/");
    await b.move(...away);

    step = "the name is the only control: an outside click closes the menu, a click on the name opens the category page";
    assert.equal(await b.ev(`document.querySelectorAll(".l0btn").length`), 0, "there is no arrow button beside the names");
    await b.glide(...await b.center(".l0link", 1), 150); await sleep(450);
    assert.equal(await open(), "Brands");
    assert.equal(await b.ev(`document.querySelector(".l0.open .l0link").getAttribute("aria-expanded")`), "true");
    await b.click(...away); await sleep(120);
    assert.equal(await open(), "", "a click on the dimmed page closes the menu");
    await b.afterLoad(async () => b.click(...await b.center(".l0link", 1)));
    assert.ok((await b.ev(`location.pathname`)).includes("/products"), "a mouse click on a category name goes to its page");
    await b.goto(base + "/");

    step = "keyboard";
    await b.move(...away);
    await b.ev(`document.querySelector("[data-drawer]").focus()`); // the cart icon is the last control before the category bar
    await b.key("Tab"); await sleep(150);
    assert.equal(await b.ev(`document.activeElement.textContent`), "Televisions");
    assert.equal(await open(), "Televisions", "reaching a category name with Tab opens its menu");
    await b.key("Tab");
    assert.equal(await b.ev(`document.activeElement.className`), "ntile", "Tab moves from the name into the panel");
    await b.key("Escape"); await sleep(100);
    assert.equal(await open(), "");
    assert.equal(await b.ev(`document.activeElement === document.querySelectorAll(".l0link")[0]`), true, "Escape returns focus to the category name");
    await b.key("Tab", { shift: true }); await b.key("Tab"); await sleep(150);
    assert.equal(await open(), "Televisions", "coming back to the name with the keyboard opens it again");
    const count = await b.ev(`document.querySelectorAll(".l0.open .npanel a").length`);
    for (let i = 0; i <= count; i++) await b.key("Tab");
    await sleep(200);
    assert.equal(await b.ev(`document.activeElement.textContent`), "Brands", "Tab leaves the panel for the next category");
    assert.equal(await open(), "Brands", "which opens in turn while the first one closed");
    await b.key("Escape"); await sleep(100);

    step = "add to cart still works";
    await b.click(...await b.center("main [data-add]", 0));
    await sleep(250);
    assert.equal(await b.ev(`document.querySelector("#cartN").textContent`), "1");

    step = "every menu link leads to a real page";
    const hrefs = await b.ev(`[...new Set([...document.querySelectorAll(".gnav a")].map(a => a.href))]`);
    assert.ok(hrefs.length > 20, "expected many menu links, found " + hrefs.length);
    for (const h of hrefs) {
      const hash = new URL(h).hash;
      if (hash) await b.goto(base + "/cart.html"); // arrive from another page, so the section has to be found after a full load
      await b.goto(h);
      if (hash) { // the page scrolls smoothly to the section; a long page takes about 2 s on this machine, so wait for the scroll to settle rather than guess
        await sleep(900); let last = -1, still = 0;
        for (let i = 0; i < 30 && still < 3; i++) { const y = await b.ev(`Math.round(scrollY)`); still = y === last ? still + 1 : 0; last = y; await sleep(150); }
      }
      for (let i = 0; i < 40 && !(await b.ev(`!!document.querySelector("#hdr")`)); i++) await sleep(100); // pages without a server-painted header get theirs when the app mounts; wait for it instead of racing it
      const r = await b.ev(`(() => { const t = ${JSON.stringify(hash)} && document.querySelector(${JSON.stringify(hash || "x")}); return { page: document.body.dataset.page, cards: document.querySelectorAll("main .card").length,
        pdp: !!document.querySelector(".pdp"), h1: (document.querySelector("main h1") || {}).textContent, top: t ? t.getBoundingClientRect().top : null, hdr: document.querySelector("#hdr").getBoundingClientRect().bottom, vh: innerHeight }; })()`);
      if (r.page === "category" && !h.includes("wish=1")) assert.ok(r.cards > 0, "no products at " + h);
      if (r.page === "product") assert.ok(r.pdp, "no product at " + h);
      if (r.page === "page") assert.notEqual(r.h1, "Page not found", h);
      if (hash) assert.ok(r.top !== null && r.top >= r.hdr - 2 && r.top < r.vh * 0.6, `section ${hash} should be in view under the header at ${h}, its top is ${r.top}`);
    }

    step = "a compare link on the same page closes the menu and scrolls";
    await b.goto(base + "/televisions");
    assert.equal(await b.ev(`document.querySelector(".l0.cur .l0link").textContent`), "Televisions", "the current category is marked in the bar");
    await b.move(...away);
    await b.glide(...await b.center(".l0link", 0), 120); await sleep(450);
    await b.click(...await b.center(".l0.open .ndisc a", 0));
    await sleep(1100);
    assert.equal(await b.ev(`location.hash`), "#os");
    assert.equal(await open(), "");
    const g = await b.ev(`document.querySelector("#os").getBoundingClientRect().top`);
    assert.ok(g > 0 && g < 480, "the operating-system chart is in view, its top is " + g);

    step = "ticking two cards opens the compare bar and the compare table shows those two";
    await b.goto(base + "/televisions");
    // a card lifts and tilts under the pointer, so rest the pointer on it first and measure the tick box again before clicking
    // and bring the box to the middle of the screen, or the fixed compare bar at the bottom covers it
    const tick = async n => { await b.ev(`document.querySelectorAll(".card .ccmp input")[${n}].scrollIntoView({ block: "center", behavior: "instant" })`); await sleep(300); await b.move(...await b.center(".card .ccmp input", n)); await sleep(280); await b.click(...await b.center(".card .ccmp input", n)); await sleep(150); };
    await tick(0); await tick(1); await sleep(400);
    const picked = await b.ev(`({ bar: (document.querySelector(".cmpbar span") || {}).textContent, cols: document.querySelectorAll(".cmp .ctable thead th").length - 1, h2: document.querySelector(".cmp h2").textContent, sizes: document.querySelectorAll(".card .csizes b").length, emi: (document.querySelector(".card .emi") || {}).textContent, find: document.querySelectorAll(".findtv .fcols > div").length })`);
    assert.equal(picked.bar, "2 of 4"); assert.equal(picked.cols, 2, "the compare table shows the two picks"); assert.equal(picked.h2, "Compare your picks");
    assert.ok(picked.sizes > 0, "size pills on cards"); assert.ok(/\/mo\b/.test(picked.emi), "No Cost EMI per month on cards"); assert.equal(picked.find, 4, "find by size, budget, operating system and resolution");

    step = "campaign page, compare page, the product's own banner, the help bot";
    await b.goto(base + "/campaigns/festive-tv-days"); await sleep(600);
    const camp = await b.ev(`({ h1: document.querySelector("main h1").textContent, preset: document.querySelector(".banner").dataset.preset, cards: document.querySelectorAll("#products .card").length, cols: document.querySelectorAll(".cmp .ctable thead th").length - 1, theme: document.querySelector(".campaign").className })`);
    assert.ok(/Four\s4K\sTVs/.test(camp.h1), "the campaign hero headline: " + camp.h1); assert.equal(camp.preset, "promo"); assert.equal(camp.cards, 4, "the four picks"); assert.equal(camp.cols, 4, "the picks compared"); assert.ok(camp.theme.includes("theme-dark"));
    await b.goto(base + "/compare?ids=2,11");
    assert.equal(await b.ev(`document.querySelectorAll(".cmp .ctable thead th").length - 1`), 2, "the compare page shows the two models");
    await b.goto(base + "/televisions/telefunken-140-cm-55-inch-4k-ultra-hd-google-tv"); await sleep(400);
    assert.equal(await b.ev(`document.querySelector("main .banner.phero").dataset.preset`), "cinematic", "the product's own banner, before the buy box");
    assert.equal(await b.ev(`document.querySelectorAll("main h1").length`), 1, "one h1 on the product page");
    await b.click(...await b.center(".chatfab")); await sleep(500);
    assert.ok(await b.ev(`document.activeElement === document.querySelector(".chat input")`), "the help panel opens with the question box focused");
    await b.ev(`document.querySelector(".chat input").value = "What is the resolution?"; document.querySelector(".chat form").requestSubmit()`); await sleep(700);
    assert.ok(/3840/.test(await b.ev(`[...document.querySelectorAll(".cmsgs .bot p")].pop().textContent`)), "the bot answers from the product's specifications");
    await b.click(...await b.center(".csugg button", 1)); await sleep(700);
    assert.ok(/months/.test(await b.ev(`[...document.querySelectorAll(".cmsgs .bot p")].pop().textContent`)) && await b.ev(`document.querySelectorAll(".cmsgs .clinks a").length > 0`), "the EMI answer with a link");
    await b.key("Escape"); await sleep(900); // the panel animates out
    assert.ok(await b.ev(`document.querySelector(".chatfab").getAttribute("aria-expanded") === "false" && document.querySelectorAll(".chat").length === 0`), "Escape closes the help panel");

    step = "product page: size switcher, delivery check, share, rating bars";
    await b.goto(base + "/televisions/telefunken-140-cm-55-inch-4k-ultra-hd-google-tv");
    assert.deepEqual(await b.ev(`[...document.querySelectorAll(".sizes .chip b")].map(a => a.textContent)`), ["32 inch", "40 inch", "43 inch", "50 inch", "55 inch", "65 inch"]);
    assert.equal(await b.ev(`document.querySelector(".sizes .chip.on b").textContent`), "55 inch");
    await b.afterLoad(async () => b.click(...await b.center(".sizes .chip", 0)));
    assert.equal(await b.ev(`document.querySelector("main h1").textContent`), "Elista 80 cm (32 inch) HD Ready Smart LED TV", "the 32 inch chip opens the 32 inch model");
    await b.ev(`(() => { const f = document.querySelector("#pincheck"); f.pin.value = "560001"; f.requestSubmit(); })()`);
    for (let i = 0; i < 80 && (await b.ev(`document.querySelector("#pinmsg").textContent`)) === "Checking…"; i++) await sleep(100); // India Post lookup
    assert.match(await b.ev(`document.querySelector("#pinmsg").textContent`), /Delivery available to 560001/);
    await b.ev(`(() => { const f = document.querySelector("#pincheck"); f.pin.value = "12"; f.requestSubmit(); })()`);
    assert.match(await b.ev(`document.querySelector("#pinmsg").textContent`), /6-digit/);
    assert.ok(await b.ev(`!!document.querySelector("#share")`), "share button present");
    assert.equal(await b.ev(`document.querySelectorAll(".rbars div").length`), 5, "rating bars on a reviewed product");
    const cmp = await b.ev(`({ cols: document.querySelectorAll(".ctable thead th").length - 1, diff: document.querySelectorAll(".ctable tr.diff").length, me: document.querySelector(".ctable thead th.me .stock").textContent, buys: document.querySelectorAll(".ctable .buy").length })`);
    assert.equal(cmp.cols, 4, "this TV compared with three others"); assert.ok(cmp.diff > 0, "differing rows are marked");
    assert.equal(cmp.me, "This product"); assert.equal(cmp.buys, 4, "a buy control in every column (a button, or the stepper once it is in the cart)");
    const pdp = await b.ev(`({ feats: document.querySelectorAll(".fstrip .ft").length, emi: !!document.querySelector(".emiline"), share: document.querySelectorAll(".sharerow a").length, sw: document.querySelectorAll(".chip.sw small").length, pill: !!document.querySelector(".pill") })`);
    assert.ok(pdp.feats >= 4, "feature strip under the photo"); assert.ok(pdp.emi, "EMI per month line"); assert.equal(pdp.share, 3, "share links");
    assert.ok(pdp.sw >= 3, "size swatches show prices"); assert.ok(pdp.pill, "delivery pill");
    assert.equal(await b.ev(`document.querySelectorAll(".bundle").length`), 0, "no add-on box while the store sells one category (it pairs products across categories)");
    const before = +(await b.ev(`document.querySelector("#cartN").textContent`)) || 0;
    await b.click(...await b.center(".pdp .actions [data-add]")); await sleep(400);
    assert.equal(+(await b.ev(`document.querySelector("#cartN").textContent`)), before + 1, "Add to cart puts this product in the cart");
    assert.equal(await b.ev(`document.body.classList.contains("cart-open")`), true, "and opens the cart drawer");
    await b.key("Escape"); await sleep(300);
    assert.equal(await b.ev(`/\\p{Extended_Pictographic}/u.test(document.querySelector("#hdr").innerText + document.querySelector(".perks").innerText)`), false, "no emoji icons left in the header or perks");
    await b.ev("scrollTo(0, document.body.scrollHeight)"); await sleep(600);
    assert.equal(await b.ev(`document.querySelector(".subnav").classList.contains("on")`), true, "the sub-nav appears once Add to cart has scrolled away");
    assert.deepEqual(await b.ev(`[...document.querySelectorAll(".stabs a")].map(a => a.textContent)`), ["Overview", "Specs", "Compare", "Reviews"]);
    assert.equal(await b.ev(`document.querySelector(".stabs a.on").textContent`), "Compare", "the sub-nav marks the section in view");
    assert.equal(await b.ev(`getComputedStyle(document.querySelector(".pdp .actions .btn")).borderRadius`), "999px", "pill buttons");
    await b.goto(base + "/");
    const clips = await b.ev(`({ hero: document.querySelectorAll(".slide").length, oss: document.querySelectorAll(".disco .dcard.os").length, brands: document.querySelectorAll(".bbrand").length, arrows: [...document.querySelectorAll(".strip")].filter(x => !x.classList.contains("nos") && x.querySelector(".row").scrollWidth <= x.querySelector(".row").clientWidth + 2).length })`);
    assert.equal(clips.hero, 3, "three hero slides per the client MOM of 23 October: factory price, Elista, Telefunken (the promo banner is not in the rotation)"); assert.equal(clips.oss, 2, "shop by operating system on the home page"); assert.equal(clips.brands, 2, "a giant tile per brand");
    assert.equal(clips.arrows, 0, "a row that fits on the screen shows no scroll arrows");
    await b.goto(base + "/category.html?cat=Televisions");
    assert.deepEqual(await b.ev(`[...document.querySelectorAll(".cdisco .dtabs button")].map(b => b.textContent)`), ["Shop by Size", "Shop by Budget", "Shop by OS", "Screen type / Resolution"], "four-tab discovery under the category banner: size, budget, operating system, screen type");
    assert.equal(await b.ev(`document.querySelectorAll(".cdisco .dcard .dimg img").length`), 6, "every size option is a picture card with a from-price");
    assert.equal(await b.ev(`getComputedStyle(document.querySelector(".plp .grid")).gridTemplateColumns.split(" ").length`), 3, "three product cards per row on desktop");
    assert.equal(await b.ev(`new Set([...document.querySelectorAll(".plp .grid .card img")].map(i => i.currentSrc || i.src)).size`), 9, "every TV in the list has its own picture");
    await b.click(...await b.center(".cdisco .dtabs button", 2)); await sleep(300); // the third tab is Shop by OS (Budget sits second)
    assert.equal(await b.ev(`document.querySelectorAll(".cdisco .dcard").length`), 2, "the OS tab lists the two operating systems in the catalogue");
    await b.click(...await b.center(".cdisco .dcard", 0)); await sleep(500);
    assert.ok(await b.ev(`location.search.includes("os=Google") && document.querySelectorAll(".plp .grid .card").length === 5 && !!document.querySelector(".cdisco .dcard.on")`), "tapping an option filters the list, marks the card and keeps the address");
    await b.goto(base + "/category.html?cat=Televisions");
    assert.equal(await b.ev(`document.querySelectorAll(".fbar, .ftrack").length`), 0, "no scroll line or arrow buttons under the explore tiles (client decision)");
    assert.ok(await b.ev(`!!document.querySelector(".kv .kvimg") && document.querySelector(".kv h1").textContent === "A World of Entertainment Awaits."`), "the category headline sits on its lifestyle photo");
    assert.ok(await b.ev(`document.querySelectorAll(".tf svg").length === 6`), "the Top features band shows its six line icons (its room clip went with the no-idle-motion decision of 22 October)");

    step = "quick view opens from a card, shows the product and closes";
    await b.ev(`document.querySelector(".plp .grid .card .qview").click()`); await sleep(500);
    const qv = await b.ev(`(() => { const q = document.querySelector(".quick"); if (!q) return { open:false }; return { open:true, name:q.querySelector("h2").textContent, specs:q.querySelectorAll(".qspecs li").length, buy:!!q.querySelector(".qactions [data-add],.qactions [data-q]"), more:(q.querySelector(".qmore")||{}).getAttribute && q.querySelector(".qmore").getAttribute("href") }; })()`);
    assert.ok(qv.open && /inch/.test(qv.name) && qv.specs > 0 && qv.buy && /televisions\//.test(qv.more), "quick view shows the product, its specs, an add button and a details link");
    await b.key("Escape"); await sleep(900);
    assert.equal(await b.ev(`!document.querySelector(".quickwrap")`), true, "Escape closes quick view");

    step = "offers page, bank offers and the No Cost EMI tag";
    await b.goto(base + "/offers.html");
    assert.ok(await b.ev(`!!document.querySelector(".festive .froom")`), "the festive banner opens the offers page"); // the brochure room photo is its stage
    assert.equal(await b.ev(`document.querySelectorAll(".ftile").length`), 0, "the offers-by-category tiles appear only with more than one category on sale");
    assert.equal(await b.ev(`document.querySelectorAll(".offer").length`), 4, "bank offer cards");
    assert.ok(await b.ev(`document.querySelectorAll(".card .emi").length`) > 0, "No Cost EMI tags on deal cards");
    assert.equal(await b.ev(`document.querySelector(".l0.cur .l0link").textContent`), "Best Deals", "Deals is marked current in the bar");
    await b.goto(base + "/");
    assert.ok(await b.ev(`!document.querySelector("main .box") && document.querySelectorAll(".dcard").length >= 5 && document.querySelectorAll(".launch").length === 5`), "the home page draws its sections, not the error box (a missing import broke it on 22 Oct 2026)");
    assert.equal(await b.ev(`document.querySelectorAll(".bankad .bacard").length`), 4, "the four bank-offer cards on the home page");
    assert.equal(await b.ev(`document.querySelectorAll(".sizerow").length`), 0, "no shop-by-size rows on the home page (client decision 2026-10-09; sizes live on the category pages)");
    assert.ok(await b.ev(`document.querySelectorAll(".faqs details").length >= 5 && document.querySelectorAll(".quote").length > 0`), "Good to know questions and customer quotes on the home page");
    await b.goto(base + "/product.html?id=1");
    assert.ok(await b.ev(`!!document.querySelector(".pdp .emiline") && document.querySelectorAll(".pofs div").length === 3`), "EMI line and offers box on the product page");
    assert.ok(await b.ev(`document.querySelectorAll("#t-specs .grp").length >= 2`), "grouped specifications on the product page");
    assert.ok(await b.ev(`!!document.querySelector(".qna h2")`), "the Q&A section is on the product page");

    step = "buying guide page and recent searches";
    await b.goto(base + "/buying-guide");
    assert.ok(await b.ev(`document.title.startsWith("How to choose a TV") && document.querySelectorAll(".gtable tbody tr").length === 5 && !!document.querySelector(".bgrid .bcard")`), "the buying guide has its size table and budget cards");
    await b.goto(base + "/");
    await b.ev(`localStorage.setItem("recentq", JSON.stringify(["55 inch","telefunken"]))`);
    await b.goto(base + "/");
    await b.click(...await b.center(".sbox input", 0)); await sleep(500);
    assert.deepEqual(await b.ev(`[...document.querySelectorAll(".schip")].map(c => c.textContent)`), ["55 inch", "telefunken"], "recent searches show as chips in the search dropdown");

    step = "every link on the main pages opens a real page";
    const seen = new Set(), skip = /\/(checkout|order|admin)(\.html|\?|$)|#/; // pages that need a sign-in or an order, and in-page anchors
    for (const start of ["/", "/offers.html", "/televisions/telefunken-140-cm-55-inch-4k-ultra-hd-google-tv", "/account.html", "/shipping"]) {
      await b.goto(base + start);
      for (const h of await b.ev(`[...document.querySelectorAll("a[href]")].map(a => a.href)`)) if (h.startsWith(base) && !skip.test(h)) seen.add(h);
    }
    assert.ok(seen.size > 25, "expected many links, found " + seen.size);
    for (const h of seen) {
      await b.goto(h);
      const r = await b.ev(`({ page: document.body.dataset.page, h1: (document.querySelector("main h1") || {}).textContent || "" })`);
      assert.notEqual(r.page, "notfound", "dead link " + h);
      assert.ok(!/not found/i.test(r.h1), "dead link " + h + ": " + r.h1);
    }

    step = "sign in with a mobile number and a code";
    await b.goto(base + "/account.html");
    assert.deepEqual(await b.ev(`[...document.querySelectorAll(".acard .tabbar button")].map(x => x.textContent)`), ["Password", "One-time code (demo)"]); // no SMS or email service here: the password route first, the demo route named as such
    assert.equal(await b.ev(`document.querySelectorAll("#gbtn").length`), 0, "no Google button until a client id is set");
    const otpText = sel => b.ev(`document.querySelector(${JSON.stringify(sel)}).textContent`);
    await b.ev(`(() => { const f = document.querySelector("#otp"); f.to.value = "98765 43210"; f.requestSubmit(); })()`);
    for (let i = 0; i < 40 && !/\d{6}/.test(await otpText("#otpnote")); i++) await sleep(100);
    const code = /(\d{6})/.exec(await otpText("#otpnote"));
    assert.ok(code, "on localhost the code is shown on the page");
    assert.equal(await b.ev(`document.querySelector("#codeRow").hidden`), false, "the code field appears");
    await b.ev(`(() => { const f = document.querySelector("#otp"); f.code.value = ${JSON.stringify(String((+code[1] + 1) % 1e6).padStart(6, "0"))}; f.requestSubmit(); })()`);
    for (let i = 0; i < 40 && !(await otpText("#otp .err")); i++) await sleep(100);
    assert.match(await otpText("#otp .err"), /Wrong code/);
    await b.ev(`(() => { const f = document.querySelector("#otp"); f.code.value = ${JSON.stringify(code[1])}; f.requestSubmit(); })()`);
    for (let i = 0; i < 40 && (await b.ev(`document.querySelector("#nameRow").hidden`)); i++) await sleep(100);
    assert.equal(await b.ev(`document.querySelector("#nameRow").hidden`), false, "a new number is asked for a name");
    await b.afterLoad(async () => b.ev(`(() => { const f = document.querySelector("#otp"); f.name.value = "Priya"; f.requestSubmit(); })()`));
    assert.equal(await b.ev(`document.querySelector("main h1").textContent`), "Hello, Priya");
    assert.ok(await b.ev(`document.body.innerText.includes("Mobile verified")`), "the profile shows the number as verified");
    await b.afterLoad(async () => b.ev(`document.querySelector("#logout").click()`));
    assert.equal(await b.ev(`document.querySelector(".hlink span").textContent`), "Sign in", "signed out again");

    step = "other pages load without errors";
    for (const p of ["/product.html?id=1", "/cart.html", "/account.html", "/admin.html", "/page.html?p=about", "/offers.html"]) {
      await b.goto(base + p);
      assert.equal(await b.ev(`document.querySelectorAll(".l0").length`), 5, "the bar is missing on " + p); // Televisions, Brands, Best Deals, Support, Track order
    }
    // checkout sends a signed-out shopper (there is one item in the cart) on to the sign-in page, so wait for that second page
    await b.goto(base + "/checkout.html").catch(() => {});
    let where = "";
    for (let i = 0; i < 40 && !where.endsWith("/account"); i++) { await sleep(150); try { where = await b.ev("location.pathname"); } catch {} }
    assert.ok(where.endsWith("/account"), "checkout should send a signed-out shopper to sign in, but ended at " + where);
    await b.goto(base + "/order.html?id=MT0000000000").catch(() => {}); // an order page is private too
    where = "";
    for (let i = 0; i < 40 && !where.endsWith("/account"); i++) { await sleep(150); try { where = await b.ev("location.pathname"); } catch {} }
    assert.ok(where.endsWith("/account"), "an order page should send a signed-out visitor to sign in, but ended at " + where);
    assert.deepEqual(realErrors(b), [], "script errors on desktop: " + JSON.stringify(realErrors(b)));

    step = "phone: taps";
    const m = await launch({ port: 9556, width: 390, height: 780, mobile: true });
    try {
      await m.goto(base + "/");
      assert.ok(await m.ev(`document.documentElement.scrollWidth <= innerWidth`), "the page must not scroll sideways on a phone");
      await m.tap(...await m.center(".l0link", 0)); await sleep(400);
      assert.equal(await open(m), "Televisions", "one tap on a category name opens its menu");
      assert.equal(await m.ev("location.pathname"), "/", "and stays on the page");
      const mp = await m.ev(`(() => { const r = document.querySelector(".l0.open .npanel").getBoundingClientRect(); return { left: r.left, width: r.width, bottom: r.bottom, vw: document.documentElement.clientWidth, vh: innerHeight, wide: document.documentElement.scrollWidth }; })()`);
      assert.equal(mp.left, 0); assert.equal(mp.width, mp.vw); assert.ok(mp.bottom <= mp.vh + 1, "the panel fits the phone screen and scrolls inside");
      assert.ok(mp.wide <= mp.vw, "an open menu must not make the page scroll sideways");
      await m.tap(...await m.center(".l0link", 1)); await sleep(400);
      assert.equal(await open(m), "Brands", "a tap on another name switches to its menu");
      await m.afterLoad(async () => m.tap(...await m.center(".l0link", 1)));
      assert.ok((await m.ev(`location.pathname`)).includes("/products"), "a second tap on the open name goes to its page");
      assert.deepEqual(realErrors(m), [], "script errors on a phone: " + JSON.stringify(realErrors(m)));
    } finally { await m.close(); }

    console.log("ALL UI TESTS PASSED");
  } catch (e) { console.error(`UI TEST FAILED at "${step}":`, e.message); process.exitCode = 1; }
  await b.close();
  store.close();
}

module.exports = { startStore, launch, sleep };
if (require.main === module) {
  if (BROWSER) run(); else console.log("UI tests skipped: no Edge or Chrome found");
}
