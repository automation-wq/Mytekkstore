// After a build: keeps the bundles of the last three builds and removes older ones (Vite leaves public/ as it is otherwise).
// Three builds are kept on purpose: a page that is open while a new build deploys still finds its scripts, styles and the
// lazily loaded Motion feature chunk. Files are content-hashed, so keeping them costs nothing but space.
import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pub = fileURLToPath(new URL("../public/", import.meta.url)), dir = pub + "assets/", ledger = dir + "builds.json";
// The page script runs one frame after the HTML and stylesheet have painted, not before: the shell's own content (the home page's
// header and first banner, written by server.js) reaches the screen first, so the first paint does not wait for 500 KB of script.
// Vite writes <script type="module" src="main-X.js">; it becomes a one-line boot file that imports the bundle after two animation frames. An inline script would need a CSP change; a file does not.
for (const f of readdirSync(pub).filter(f => f.endsWith(".html"))) {
  const page = readFileSync(pub + f, "utf8");
  const out = page.replace(/<script type="module" crossorigin src="\/assets\/(main-[\w-]+)\.js"><\/script>/, (m, main) => {
    writeFileSync(dir + main.replace(/^main-/, "boot-") + ".js", `requestAnimationFrame(() => requestAnimationFrame(() => import("./${main}.js")));\n`);
    return `<script type="module" crossorigin src="/assets/${main.replace(/^main-/, "boot-")}.js"></script>`; // no modulepreload: Lighthouse counts a preloaded module against the first paint, and the import starts two frames later anyway
  });
  if (out !== page) writeFileSync(pub + f, out);
}
const html = readdirSync(pub).filter(f => f.endsWith(".html")).map(f => readFileSync(pub + f, "utf8")).join("\n");
// the files of this build: what the pages link, then what those files import, and so on (boot -> main -> motion features, admin)
let linked = readdirSync(dir).filter(f => f !== "builds.json" && html.includes("assets/" + f));
for (let pass = 0; pass < 3; pass++) { const text = linked.map(f => readFileSync(dir + f, "utf8")).join("\n"); linked = readdirSync(dir).filter(f => f !== "builds.json" && (linked.includes(f) || text.includes(f))); }
const current = [...linked].sort();
const builds = [current, ...(existsSync(ledger) ? (JSON.parse(readFileSync(ledger, "utf8")).builds || []) : []).filter(b => b.join() !== current.join())].slice(0, 3);
const keep = new Set(builds.flat());
let removed = 0;
for (const f of readdirSync(dir)) if (f !== "builds.json" && !keep.has(f)) { unlinkSync(dir + f); removed++; }
writeFileSync(ledger, JSON.stringify({ built: new Date().toISOString(), builds })); // built: the sitemap's date for pages (server.js BUILT)
console.log("old bundles removed:", removed, "| builds kept:", builds.length);
