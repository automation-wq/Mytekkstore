// Mytekkstore storefront (React). Products, accounts and orders come from the server (see ../../server.js).
import "./style.css";
import { createRoot } from "react-dom/client";
import { LazyMotion, MotionConfig } from "motion/react";
import { StoreProvider } from "./store.jsx";
import App from "./App.jsx";

// the font stylesheet is linked as print so it never blocks the first paint; it switches on here, with display=swap on the font
for (const l of document.querySelectorAll("link[data-font]")) l.media = "all";
// `ready` resolves once the page is drawn; the browser tests wait for it
window.ready = new Promise(r => { window.__resolveReady = r; });
// Motion's animation features arrive in their own small file right after the page script, so the first script stays smaller
const features = () => import("./motion-features.js").then(x => x.default);
createRoot(document.getElementById("root")).render(<LazyMotion features={features} strict><MotionConfig reducedMotion="user"><StoreProvider><App /></StoreProvider></MotionConfig></LazyMotion>);
