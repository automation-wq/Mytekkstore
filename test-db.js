// Database-mode check. Run: node test-db.js
// Stands in for Neon's HTTP SQL endpoint with a small in-memory server that understands exactly the statements server.js sends,
// runs the whole API suite (test.js) against it, then proves the point of the database: an order placed through one server
// process is found, with the same sign-in cookie, by a second, fresh process. (The real Neon is exercised once DATABASE_URL exists.)
const http = require("http"), assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path");
const { spawn } = require("child_process");

const kv = new Map(), docs = new Map(), sessions = new Map(), stockT = new Map(), files = new Map(), counters = new Map(); // what a Postgres would hold (one request at a time, so each UPDATE is atomic as in Postgres)
const statements = [
  [/^CREATE TABLE/i, () => []],
  [/^INSERT INTO kv /i, p => { kv.set(p[0], { v: p[1], at: p[2] }); return []; }],
  [/^INSERT INTO docs /i, p => { for (let i = 0; i < p.length; i += 4) docs.set(p[i] + "\u0000" + p[i + 1], { col: p[i], id: p[i + 1], v: p[i + 2], at: p[i + 3] }); return []; }],
  [/^INSERT INTO sessions /i, p => { sessions.set(p[0], { user_id: p[1], exp: p[2] }); return []; }],
  [/^SELECT k, at FROM kv$/i, () => [...kv].map(([k, r]) => ({ k, at: r.at }))],
  [/^SELECT v, at FROM kv WHERE k = \$1$/i, p => kv.has(p[0]) ? [{ v: kv.get(p[0]).v, at: kv.get(p[0]).at }] : []],
  [/^SELECT v, at FROM docs WHERE col = \$1 ORDER BY at, id$/i, p => [...docs.values()].filter(r => r.col === p[0]).sort((a, b) => +a.at - +b.at || a.id.localeCompare(b.id)).map(r => ({ v: r.v, at: r.at }))],
  [/^SELECT col, id, v, at FROM docs WHERE at > \$1 ORDER BY at$/i, p => [...docs.values()].filter(r => +r.at > +p[0]).sort((a, b) => +a.at - +b.at)],
  [/^SELECT user_id, exp FROM sessions WHERE token = \$1$/i, p => sessions.has(p[0]) ? [sessions.get(p[0])] : []],
  [/^DELETE FROM sessions WHERE token = \$1$/i, p => { sessions.delete(p[0]); return []; }],
  [/^DELETE FROM sessions WHERE user_id = \$1$/i, p => { for (const [t, s] of sessions) if (String(s.user_id) === String(p[0])) sessions.delete(t); return []; }],
  [/^DELETE FROM sessions WHERE exp < \$1$/i, p => { for (const [t, s] of sessions) if (+s.exp < +p[0]) sessions.delete(t); return []; }],
  [/^DELETE FROM docs WHERE col = \$1 AND id = \$2$/i, p => { docs.delete(p[0] + "\u0000" + p[1]); return []; }],
  [/^INSERT INTO stock \(id, n\) VALUES .* ON CONFLICT \(id\) DO NOTHING$/i, p => { for (let i = 0; i < p.length; i += 2) if (!stockT.has(p[i])) stockT.set(p[i], +p[i + 1]); return []; }],
  [/^INSERT INTO stock \(id, n\) VALUES \(\$1, \$2\) ON CONFLICT \(id\) DO UPDATE SET n = EXCLUDED\.n$/i, p => { stockT.set(p[0], +p[1]); return []; }],
  [/^UPDATE stock SET n = n \+ \$2 WHERE id = \$1 AND n \+ \$2 >= 0 RETURNING n$/i, p => { const n = stockT.get(p[0]); if (n === undefined || n + +p[1] < 0) return []; stockT.set(p[0], n + +p[1]); return [{ n: String(n + +p[1]) }]; }],
  [/^UPDATE stock SET n = GREATEST\(n \+ \$2, 0\) WHERE id = \$1 RETURNING n$/i, p => { const n = stockT.get(p[0]); if (n === undefined) return []; stockT.set(p[0], Math.max(0, n + +p[1])); return [{ n: String(stockT.get(p[0])) }]; }],
  [/^INSERT INTO counters \(k, n\) VALUES \(\$1, 1\) ON CONFLICT \(k\) DO UPDATE SET n = counters\.n \+ 1 RETURNING n$/i, p => { counters.set(p[0], (counters.get(p[0]) || 0) + 1); return [{ n: String(counters.get(p[0])) }]; }],
  [/^SELECT id, n FROM stock$/i, () => [...stockT].map(([id, n]) => ({ id, n: String(n) }))],
  [/^INSERT INTO files \(id, type, data, at\) VALUES \(\$1, \$2, \$3, \$4\)$/i, p => { files.set(p[0], { type: p[1], data: p[2] }); return []; }],
  [/^SELECT type, data FROM files WHERE id = \$1$/i, p => files.has(p[0]) ? [files.get(p[0])] : []],
  [/^SELECT n FROM stock WHERE id = \$1$/i, p => stockT.has(p[0]) ? [{ n: String(stockT.get(p[0])) }] : []],
];
let queries = 0;
const neon = http.createServer((req, res) => {
  let body = ""; req.on("data", c => body += c); req.on("end", () => {
    const { query, params = [] } = JSON.parse(body); queries++;
    const used = new Set(query.match(/\$\d+/g) || []).size; // like Postgres: the values sent must match the $n placeholders in the text
    if (used !== params.length) { res.writeHead(400); return res.end(`bind message supplies ${params.length} parameters, but prepared statement requires ${used}`); }
    const hit = statements.find(([re]) => re.test(query.trim()));
    if (!hit || req.headers["neon-connection-string"] !== process.env.TEST_DB_URL) { res.writeHead(400); return res.end("unknown statement: " + query.slice(0, 80)); }
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ rows: hit[1](params) }));
  });
});

const run = (cmd, args, env, onLine) => new Promise(resolve => { const c = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }); let out = ""; c.stdout.on("data", d => { out += d; d.toString().split("\n").forEach(l => onLine && onLine(l, c)); }); c.stderr.on("data", d => out += d); c.on("exit", code => resolve({ code, out })); if (onLine) onLine.child = c; });
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mytekk-db-"));
const startStore = env => new Promise(resolve => { const c = spawn(process.execPath, ["-e", "const s = require('./server.js'); s.listen(0, '127.0.0.1', () => console.log('LISTEN ' + s.address().port));"], { env: { ...process.env, ...env, DATA_DIR: temp() }, stdio: ["ignore", "pipe", "inherit"] }); c.stdout.on("data", d => { const m = /LISTEN (\d+)/.exec(String(d)); if (m) resolve({ child: c, base: "http://127.0.0.1:" + m[1] }); }); });

neon.listen(0, "127.0.0.1", async () => {
  const url = "postgres://store:secret@127.0.0.1:" + neon.address().port + "/mytekkstore"; process.env.TEST_DB_URL = url;
  const kids = [];
  try {
    // 1. the whole API suite, with the database behind it
    const suite = await run(process.execPath, ["test.js"], { DATABASE_URL: url, TEST_DB_URL: url });
    assert.ok(/ALL TESTS PASSED/.test(suite.out), "the API suite in database mode:\n" + suite.out.split("\n").filter(l => /FAIL|Error|error/.test(l)).join("\n"));
    const afterSuite = queries;
    // 2. the hosted-store problem itself: two separate processes share one database
    const a = await startStore({ DATABASE_URL: url, TEST_DB_URL: url }); kids.push(a.child);
    const reg = await fetch(a.base + "/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Two Instances", email: "two@example.com", password: "password-12" }) });
    assert.equal(reg.status, 200, "register on instance A"); const cookie = (reg.headers.get("set-cookie") || "").split(";")[0];
    const post = (p, body) => fetch(a.base + p, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) }).then(r => r.json());
    const sent = await post("/api/otp/send", { to: "9999999999" }); // orders need a verified phone
    assert.equal((await post("/api/otp/verify", { to: "9999999999", code: sent.demoCode })).linked, true, "the phone verifies on instance A");
    const ord = await fetch(a.base + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ name: "Two Instances", phone: "9999999999", address: "1 Test Street", pin: "110001", pay: "cod", items: [{ id: 1, qty: 1 }] }) });
    assert.equal(ord.status, 200, "order on instance A"); const id = (await ord.json()).id;
    const b = await startStore({ DATABASE_URL: url, TEST_DB_URL: url }); kids.push(b.child); // a fresh process with an empty data folder: everything it knows comes from the database
    const me = await fetch(b.base + "/api/me", { headers: { cookie } }); assert.equal(me.status, 200, "the sign-in cookie works on instance B");
    const got = await fetch(b.base + "/api/orders/" + id, { headers: { cookie } }); assert.equal(got.status, 200, "the order placed on A is found on B: " + (await got.text()).slice(0, 80));
    const stock = p => fetch(p.base + "/api/products").then(r => r.json()).then(d => (d.products || d).find(x => x.id === 1).stock);
    assert.equal(await stock(b), await stock(a), "stock taken on A is seen on B");
    // 3. sign-in codes: the copy that checks a code is often not the copy that sent it
    const call = (s, p, body, ck) => fetch(s.base + p, { method: "POST", headers: { "Content-Type": "application/json", ...(ck && { cookie: ck }) }, body: JSON.stringify(body) });
    const code1 = (await (await call(a, "/api/otp/send", { to: "9811111111" })).json()).demoCode;
    const v1 = await call(b, "/api/otp/verify", { to: "9811111111", code: code1, name: "Code On B" });
    assert.equal(v1.status, 200, "a code sent by A is accepted by B: " + (await v1.clone().text()).slice(0, 80));
    const code2 = (await (await call(a, "/api/otp/send", { to: "9822222222" })).json()).demoCode, wrong = code2 === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) assert.equal((await call(i % 2 ? a : b, "/api/otp/verify", { to: "9822222222", code: wrong })).status, 401, "wrong code " + (i + 1));
    assert.equal((await call(a, "/api/otp/verify", { to: "9822222222", code: wrong })).status, 423, "the fifth wrong code locks the number, though the tries were split across A and B");
    assert.equal((await call(b, "/api/otp/verify", { to: "9822222222", code: code2 })).status, 423, "the lock holds on B, even with the right code");
    // 4. twenty customers at once, half on each copy: each signs up on one copy and orders on the other
    const stock2Before = await fetch(a.base + "/api/products").then(r => r.json()).then(d => (d.products || d).find(x => x.id === 3).stock);
    const burst = await Promise.all(Array.from({ length: 20 }, async (_, i) => {
      const to = "97000000" + String(i).padStart(2, "0"), [s1, s2] = i % 2 ? [a, b] : [b, a];
      const sent = await (await call(s1, "/api/otp/send", { to })).json();
      const v = await call(s2, "/api/otp/verify", { to, code: sent.demoCode, name: "Burst " + i }); const ck = (v.headers.get("set-cookie") || "").split(";")[0];
      const o = await call(s1, "/api/orders", { name: "Burst " + i, phone: to, address: i + " Test Street", pin: "110001", pay: "cod", items: [{ id: 3, qty: 1 }] }, ck);
      return { ck, status: [v.status, o.status], id: (await o.json()).id };
    }));
    assert.ok(burst.every(r => r.status[0] === 200 && r.status[1] === 200 && r.id), "all twenty sign-ups and orders succeed: " + JSON.stringify(burst.map(r => r.status)));
    for (const r of burst) { const [x, y] = await Promise.all([a, b].map(s => fetch(s.base + "/api/orders/" + r.id, { headers: { cookie: r.ck } }))); assert.ok(x.status === 200 && y.status === 200, "order " + r.id + " is found on both copies"); }
    const st2 = s => fetch(s.base + "/api/products").then(r => r.json()).then(d => (d.products || d).find(x => x.id === 3).stock);
    const [sa, sb] = [await st2(a), await st2(b)];
    assert.ok(sa === stock2Before - 20 && sb === stock2Before - 20, `twenty simultaneous orders take exactly twenty units: started ${stock2Before}, A shows ${sa}, B shows ${sb}`);
    // 5. the last units: more customers than stock, at the same moment, on both copies; exactly the stock's worth succeed
    const left = sa, rush = await Promise.all(burst.slice(0, left + 3).map((r, i) => call(i % 2 ? a : b, "/api/orders", { name: "Rush " + i, phone: "97000000" + String(i).padStart(2, "0"), address: "1 Test Street", pin: "110001", pay: "cod", items: [{ id: 3, qty: 1 }] }, r.ck).then(x => x.status)));
    assert.equal(rush.filter(s => s === 200).length, left, `with ${left} left and ${left + 3} buyers at once, exactly ${left} orders succeed: ${rush.join(",")}`);
    assert.ok(rush.filter(s => s !== 200).every(s => s === 409) && await st2(a) === 0 && await st2(b) === 0, "the rest are told it is out of stock, and the count stops at zero");
    console.log(`ALL DB TESTS PASSED (${afterSuite} statements in the suite, ${queries - afterSuite} across two instances)`);
  } catch (e) { console.error("DB TEST FAILED:", e.message); process.exitCode = 1; }
  kids.forEach(c => c.kill());
  neon.close(); neon.closeAllConnections();
});
