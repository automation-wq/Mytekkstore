// JSON-file store for the Creative Intelligence Agent: one file per collection under DATA_DIR (default creative/data), written
// atomically. Every record has an id; ids are never reused. ponytail: a database (SQLite, Postgres) replaces this when several
// people or machines write at once; the shape of the records stays the same.
const fs = require("fs"), path = require("path");

const DATA = process.env.CREATIVE_DATA_DIR || path.join(__dirname, "..", "data");
const ASSETS = path.join(DATA, "assets");
fs.mkdirSync(path.join(ASSETS, "refs"), { recursive: true });
fs.mkdirSync(path.join(ASSETS, "gen"), { recursive: true });
fs.mkdirSync(path.join(ASSETS, "uploads"), { recursive: true });
fs.mkdirSync(path.join(ASSETS, "exports"), { recursive: true });

const COLLECTIONS = ["websites", "pages", "references", "products", "analyses", "concepts", "assets", "qc", "jobs", "logs"];
const file = n => path.join(DATA, n + ".json");
const read = n => { try { return JSON.parse(fs.readFileSync(file(n), "utf8")); } catch { return []; } };
const db = Object.fromEntries(COLLECTIONS.map(n => [n, read(n)]));
db.settings = (() => { try { return JSON.parse(fs.readFileSync(file("settings"), "utf8")); } catch { return { imageProvider: "composite", refreshHours: 0, maxPagesPerSite: 12, userAgent: "MytekkstoreCreativeAgent/1.0 (+research; contact via the store)" }; } })();

function write(n) {
  const tmp = file(n) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db[n], null, 1));
  fs.renameSync(tmp, file(n));
}
const nextId = n => Math.max(0, ...db[n].map(x => x.id)) + 1;
function add(n, rec) { const r = { id: nextId(n), createdAt: new Date().toISOString(), ...rec }; db[n].push(r); write(n); return r; }
function update(n, id, patch) { const r = db[n].find(x => x.id === +id); if (!r) return null; Object.assign(r, patch, { updatedAt: new Date().toISOString() }); write(n); return r; }
function remove(n, id) { const i = db[n].findIndex(x => x.id === +id); if (i < 0) return false; db[n].splice(i, 1); write(n); return true; }
const get = (n, id) => db[n].find(x => x.id === +id) || null;
function log(level, msg, extra) { // structured log: on disk and on the console
  const e = { at: new Date().toISOString(), level, msg, ...(extra || {}) };
  db.logs.push(e); if (db.logs.length > 2000) db.logs.splice(0, db.logs.length - 2000); write("logs");
  (level === "error" ? console.error : console.log)(`[creative] ${level} ${msg}${extra ? " " + JSON.stringify(extra) : ""}`);
}
const saveSettings = patch => { Object.assign(db.settings, patch); fs.writeFileSync(file("settings"), JSON.stringify(db.settings, null, 1)); return db.settings; };

module.exports = { db, DATA, ASSETS, write, add, update, remove, get, log, saveSettings, COLLECTIONS };
