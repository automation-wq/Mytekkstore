// Mytekkstore storefront (React). Products, accounts and orders come from the server (see ../../server.js).
import "./style.css";
import { createRoot } from "react-dom/client";
import { LazyMotion, MotionConfig } from "motion/react";
import { StoreProvider } from "./store.jsx";
import App from "./App.jsx";

// the build that is running, readable in the page (data-build on <html>) when support asks "which version do you see?"; changing it also
// gives the bundle a new name, which matters after a bad build was cached (22 Oct 2026: a mis-served bundle sat in browsers under the old name)
document.documentElement.dataset.build = "2026-10-22c";
// `ready` resolves once the page is drawn; the browser tests wait for it
window.ready = new Promise(r => { window.__resolveReady = r; });
// Motion's animation features arrive in their own small file right after the page script, so the first script stays smaller
const features = () => import("./motion-features.js").then(x => x.default);
createRoot(document.getElementById("root")).render(<LazyMotion features={features} strict><MotionConfig reducedMotion="user"><StoreProvider><App /></StoreProvider></MotionConfig></LazyMotion>);
