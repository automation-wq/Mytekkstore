// After a build: keeps the bundles of the last three builds and removes older ones (Vite leaves public/ as it is otherwise).
// Three builds are kept on purpose: a page that is open while a new build deploys still finds its scripts, styles and the
// lazily loaded Motion feature chunk. Files are content-hashed, so keeping them costs nothing but space.
import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pub = fileURLToPath(new URL("../public/", import.meta.url)), dir = pub + "assets/", ledger = dir + "builds.json";
const html = readdirSync(pub).filter(f => f.endsWith(".html")).map(f => readFileSync(pub + f, "utf8")).join("\n");
const linked = readdirSync(dir).filter(f => f !== "builds.json" && html.includes("assets/" + f));
const scripts = linked.map(f => readFileSync(dir + f, "utf8")).join("\n");
const current = readdirSync(dir).filter(f => f !== "builds.json" && (html.includes("assets/" + f) || scripts.includes(f))).sort();
const builds = [current, ...(existsSync(ledger) ? JSON.parse(readFileSync(ledger, "utf8")) : []).filter(b => b.join() !== current.join())].slice(0, 3);
const keep = new Set(builds.flat());
let removed = 0;
for (const f of readdirSync(dir)) if (f !== "builds.json" && !keep.has(f)) { unlinkSync(dir + f); removed++; }
writeFileSync(ledger, JSON.stringify(builds));
console.log("old bundles removed:", removed, "| builds kept:", builds.length);
