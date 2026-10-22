// Talks to the store server (see ../../server.js).
export const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
export const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
// address parameters: the query string first, then what the server put on <body> for a clean address
// (/televisions -> data-cat, /televisions/<product> -> data-id, /shipping -> data-p; see resolveClean in server.js)
const search = new URLSearchParams(location.search), given = document.body.dataset;
export const qs = { get: k => search.has(k) ? search.get(k) : (k in given ? given[k] : null), has: k => search.has(k) || k in given };
// analytics hook: events go to window.dataLayer, where Google Tag Manager or GA4 picks them up once the client's tag snippet is added
// a page the browser prerendered (speculation rules in the shell) runs this script before anyone sees it: whenShown waits for that
export const whenShown = fn => document.prerendering ? document.addEventListener("prerenderingchange", fn, { once: true }) : fn();
export const track = (event, data) => whenShown(() => (window.dataLayer = window.dataLayer || []).push({ event, ...data }));
// The four startup answers (products, me, config, banners), kept in this tab for 90 s: the next page draws from them at once and
// asks the server again behind (store.jsx). Any request that changes data clears them, so a sign-in or an order shows at once.
const BOOT = "boot";
export const bootCache = { read: () => { try { const c = JSON.parse(sessionStorage.getItem(BOOT)); return c && Date.now() - c.at < 90000 ? c : null; } catch { return null; } },
  write: data => { try { sessionStorage.setItem(BOOT, JSON.stringify({ ...data, at: Date.now() })); } catch {} }, clear: () => { try { sessionStorage.removeItem(BOOT); } catch {} } };

export async function api(path, method = "GET", body) {
  let r = null, data = null;
  try {
    r = await fetch("/api/" + path, method === "GET" ? {} : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    data = (r.headers.get("content-type") || "").includes("application/json") ? await r.json() : null;
  } catch {}
  if (!r || !data) throw new Error("Cannot reach the store. Please check your connection and try again.");
  if (!r.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  if (method !== "GET") bootCache.clear();
  return data;
}

// Demo payment window. No gateway is called and no card details are asked for. (Plain DOM: it lives outside the React tree.)
export function demoPay(method, amount) {
  return new Promise((resolve, reject) => {
    const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
    document.body.insertAdjacentHTML("beforeend", `<div class="modal"><div class="mbox" role="dialog" aria-modal="true" aria-label="Demo payment">
      <h3>Demo payment · ${esc(method)}</h3>
      <p class="muted">This is a demo payment window. No real money is taken and no card details are needed.</p>
      <div class="amt">${esc(amount)}</div>
      <button class="btn" data-pay="ok">Simulate successful payment</button>
      <button class="btn ghost" data-pay="fail">Simulate failed payment</button>
      <button class="link" data-pay="cancel">Cancel</button></div></div>`);
    const m = document.querySelector(".modal");
    m.querySelector("[data-pay=ok]").focus();
    m.onclick = e => {
      const act = e.target.dataset.pay;
      if (!act) return;
      if (act === "ok") {
        m.querySelector(".mbox").innerHTML = `<div class="spin"></div><p>Processing payment…</p>`;
        return setTimeout(() => { m.remove(); resolve(); }, 1300);
      }
      m.remove();
      reject(new Error(act === "fail" ? "Payment failed. No money was taken. Please try again or choose cash on delivery." : "Payment cancelled."));
    };
  });
}
