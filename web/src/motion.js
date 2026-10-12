// Page motion on the rendered DOM, built on Motion (motion.dev): reveals, numbers that count up, room clips, strips, scroll
// chrome and the fly-to-cart. Each helper is safe to call again after a page draws more content.
import { animate, inView, stagger } from "motion";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = [.2, .8, .2, 1];

// sections fade and rise as they scroll into view; the CSS keyed on .reveal.in staggers the cards, headings and icons inside them
export function reveal() {
  $$("main > section, main > .hero, main > .pdp, main > .plp, main > .box, main > .cols, main > .fest, main > .auth, main > .kv").forEach(el => {
    if (el.classList.contains("reveal")) return;
    el.classList.add("reveal");
    if (reduced()) return el.classList.add("in");
    // a section the address points at (#features, #guide, #compare) only fades, so the deep-link scroll lands exactly on it
    const dy = /^#[\w-]+$/.test(location.hash) && (el.id === location.hash.slice(1) || el.querySelector(location.hash)) ? 0 : 18;
    Object.assign(el.style, { opacity: 0, transform: `translateY(${dy}px)` }); // starts hidden and a little low, so nothing flashes or jumps before the animation
    inView(el, () => {
      el.classList.add("in");
      animate(el, { opacity: [0, 1], y: [dy, 0] }, { duration: .7, ease: EASE });
      riseWords($(":scope > h2", el));
      const tiles = $$(TILES, el).filter(t => !t.closest(".card")); // cards animate themselves (Card in components.jsx)
      if (tiles.length) animate(tiles, { opacity: [0, 1], y: [22, 0] }, { delay: stagger(.06, { startDelay: .12 }), duration: .65, ease: EASE });
    }, { margin: "0px 0px -40px" });
  });
}

// the tiles that arrive one after another when their section appears
const TILES = ".num > div, .kcat, .sizerow, .bt, .brands .brand, .quote, .offer, .why > div, .faqs details, .tile, .step, .marq";
// a section headline rises word by word (the words are wrapped once; the wrapper is one flex item, so a "View all" link stays on the right)
function riseWords(h) {
  if (!h || h.dataset.words) return;
  h.dataset.words = "1";
  [...h.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => {
    const wl = document.createElement("span"); wl.className = "wl";
    n.textContent.split(/(\s+)/).forEach(t => { if (!t) return; if (/^\s+$/.test(t)) wl.append(t); else { const w = document.createElement("span"); w.className = "w"; w.textContent = t; wl.append(w); } });
    n.replaceWith(wl);
  });
  animate($$(".w", h), { opacity: [0, 1], y: ["70%", "0%"] }, { delay: stagger(.06), duration: .6, ease: EASE });
}

// numbers roll up from 0 the first time they scroll into view
export function countUp(root) {
  $$("[data-n]", root).forEach(el => {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    if (reduced()) { el.textContent = el.dataset.n; return; }
    inView(el, () => { animate(0, +el.dataset.n, { duration: 1.4, ease: "circOut", onUpdate: v => { el.textContent = Math.round(v); } }); }, { amount: .6 });
  });
}

// looping background clips: loaded only when needed, never on data saver or reduced motion (the poster photo stays instead)
export const clipsOk = !reduced() && !(navigator.connection && navigator.connection.saveData) && matchMedia("(min-width: 900px)").matches; // phones keep the still photo: a clip would compete with the page's main image
export function playClip(v) {
  if (!clipsOk) return;
  if (!v.src) { v.src = v.dataset.src; v.onplaying = () => v.classList.add("playing"); }
  v.play().catch(() => {});
}
let clipIO;
export function lazyClips() {
  clipIO = clipIO || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { playClip(e.target); clipIO.unobserve(e.target); } }), { rootMargin: "200px" });
  $$("video.tvid:not([data-seen]), video.bvid:not([data-seen])").forEach(v => { v.dataset.seen = "1"; clipIO.observe(v); });
}

// rows that fit on the screen need no scroll arrows
export const fitStrips = () => $$(".strip").forEach(x => { const r = $(".row", x); if (r) x.classList.toggle("nos", r.scrollWidth <= r.clientWidth + 2); });

// window-level listeners, attached once: back-to-top and strip arrows (the card tilt lives in Card, the progress line in Chrome)
let chromeDone = false;
export function chrome() {
  if (chromeDone) return;
  chromeDone = true;
  addEventListener("scroll", () => document.body.classList.toggle("scrolled", document.documentElement.scrollTop > 300), { passive: true });
  addEventListener("resize", fitStrips);
  // main buttons lean a few pixels toward the pointer (desktop with a mouse only, never under reduced motion)
  if (matchMedia("(hover: hover) and (min-width: 1024px)").matches && !reduced()) {
    document.addEventListener("pointermove", e => {
      const b = e.target.closest && e.target.closest(".btn:not(.ghost)");
      if (!b || e.pointerType !== "mouse") return;
      const r = b.getBoundingClientRect();
      animate(b, { x: ((e.clientX - r.left) / r.width - .5) * 8, y: ((e.clientY - r.top) / r.height - .5) * 6 }, { duration: .18, ease: "easeOut" });
    }, { passive: true });
    document.addEventListener("pointerout", e => {
      const b = e.target.closest && e.target.closest(".btn:not(.ghost)");
      if (b && !b.contains(e.relatedTarget)) animate(b, { x: 0, y: 0 }, { type: "spring", stiffness: 300, damping: 18 });
    }, { passive: true });
  }
}

// the product photo flies to the cart icon when something is added: a copy shrinks toward the icon's centre, then goes away
export function fly(btn) {
  const img = btn.closest(".card, .pdp")?.querySelector(".img img"), target = $("[data-drawer]");
  if (!img || !target || reduced()) return;
  const from = img.getBoundingClientRect(), to = target.getBoundingClientRect(), ghost = img.cloneNode();
  Object.assign(ghost.style, { position: "fixed", left: from.left + "px", top: from.top + "px", width: from.width + "px", height: from.height + "px", zIndex: 50, borderRadius: "12px", pointerEvents: "none", objectFit: "contain", background: "#fff" });
  document.body.append(ghost);
  animate(ghost, { x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - (from.top + from.height / 2), scale: 24 / Math.max(from.width, 1), opacity: .25 },
    { duration: .7, ease: [.5, -.2, .3, 1] }).finished.then(() => ghost.remove());
}
