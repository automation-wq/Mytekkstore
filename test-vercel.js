// Self-check for the Vercel entry (api/index.js). Run: node test-vercel.js   (uses a temporary data folder, never the real one)
// Calls the entry the two ways Vercel can: with the request stream untouched, and with the body already read into req.body by Vercel's helpers.
const http = require("http"), os = require("os"), path = require("path"), fs = require("fs"), assert = require("assert");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mtk-vercel-test-"));
process.env.ADMIN_PASSWORD = "demo-pass-123";
const handler = require("./api/index.js");
const srv = http.createServer((req, res) => {
  if (!req.headers["x-consume"]) return handler(req, res);
  const chunks = []; // what Vercel's helpers do: read the whole body, then hand the request over with req.body set
  req.on("data", c => chunks.push(c)).once("end", () => { req.removeAllListeners("data"); req.body = JSON.parse(Buffer.concat(chunks).toString()); handler(req, res); });
});
srv.listen(0, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:" + srv.address().port;
  const j = async (p, o) => { const r = await fetch(base + p, o); return [r.status, await r.json().catch(() => null)]; };
  let [s, b] = await j("/api/products"); assert.equal(s, 200); assert.equal(b.products.length, 9, "televisions only: the other categories are hidden");
  for (const consume of ["", "1"]) {
    const post = body => j("/api/login", { method: "POST", headers: { "content-type": "application/json", ...(consume && { "x-consume": "1" }) }, body: JSON.stringify(body) });
    [s] = await post({ email: "admin@mytekkstore.local", password: "wrong" }); assert.equal(s, 401, "wrong password, consume=" + consume);
    [s] = await post({ email: "admin@mytekkstore.local", password: "demo-pass-123" }); assert.equal(s, 200, "ADMIN_PASSWORD sign-in, consume=" + consume);
  }
  assert.equal((await fetch(base + "/nope.html")).status, 404);
  console.log("VERCEL ENTRY OK"); srv.close(); process.exit(0);
});
setTimeout(() => { console.error("FAIL: a request hung"); process.exit(1); }, 8000).unref();
