// Mytekkstore storefront (React). Products, accounts and orders come from the server (see ../../server.js).
import "./style.css";
import { createRoot } from "react-dom/client";
import { LazyMotion, MotionConfig } from "motion/react";
import { StoreProvider } from "./store.jsx";
import App from "./App.jsx";

// the build that is running, readable in the page (data-build on <html>) when support asks "which version do you see?"; changing it also
// gives the bundle a new name, which matters after a bad build was cached (22 Oct 2026: a mis-served bundle sat in browsers under the old name)
document.documentElement.dataset.build = "2026-10-22c";
// a tab left open across a deploy refreshes itself when it is looked at again (25 Oct 2026: a page from hours earlier was taken for the live
// site three times); the page's build stamp against the server's validator, on reading pages only, never on a form
const built = document.documentElement.dataset.built, tag = built && 'W/"' + built.replace(/[^0-9A-Za-z]/g, "") + '"';
const recheck = async () => {
  if (!tag || document.visibilityState !== "visible" || /checkout|account|admin/.test(document.body.dataset.page || "")) return;
  try { const r = await fetch(location.href, { method: "HEAD", cache: "no-store" }); if (r.ok && r.headers.get("etag") && r.headers.get("etag") !== tag) location.reload(); } catch { /* offline: nothing to do */ }
};
document.addEventListener("visibilitychange", recheck);
window.addEventListener("pageshow", e => { if (e.persisted) recheck(); });
// `ready` resolves once the page is drawn; the browser tests wait for it
window.ready = new Promise(r => { window.__resolveReady = r; });
// Motion's animation features arrive in their own small file right after the page script, so the first script stays smaller
const features = () => import("./motion-features.js").then(x => x.default);
createRoot(document.getElementById("root")).render(<LazyMotion features={features} strict><MotionConfig reducedMotion="user"><StoreProvider><App /></StoreProvider></MotionConfig></LazyMotion>);
