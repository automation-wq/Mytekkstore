// Banner engine: one component, five presets, every banner configured by the admin (slot, preset, tone, focus, a desktop and a
// phone image, product, words, buttons). The presets are the five ways the big brands open a page:
//   cinematic  the background fades and settles, the product reveals through a mask, the words arrive in sequence, the button last
//   layered    background, product and words are separate layers that enter at different speeds and drift apart as you scroll
//   feature    the product stays the focal point and its big facts (callouts) arrive one by one around it
//   promo      badge, offer headline, product, button, in that order, with a steady hierarchy
//   scroll     a sticky scene: the product grows and the background slides with the scroll, the words reveal in order
// Under "reduce motion" everything is simply there. Only one preset runs per banner: no stacking of effects.
import { useRef } from "react";
import { m, useScroll, useTransform, useReducedMotion } from "motion/react";
import { pic, picSet, productUrl, cutout, callouts } from "./data.js";

export const PRESETS = ["cinematic", "layered", "feature", "promo", "scroll"];
export const TONES = { photo: "", paper: "var(--card)", green: "linear-gradient(120deg,#052e25,#08805f 55%,#0b3d2e)", indigo: "linear-gradient(120deg,#0f0c3a,#4338ca 55%,#1e1b4b)", dark: "radial-gradient(120% 90% at 80% 20%,#1b2a4a 0%,#0d1117 55%,#06080c 100%)", ink: "#0f1115" };
export const FOCUS = { center: "50% 50%", left: "20% 50%", right: "80% 50%", top: "50% 20%", bottom: "50% 80%" };
const EASE = [.2, .8, .2, 1];
export const RISE = { hide: { y: "115%", opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 280, damping: 28 } } };
export const WORDS = { hide: {}, show: { transition: { staggerChildren: .06, delayChildren: .1 } } };
const fade = d => ({ hide: { opacity: 0 }, show: { opacity: 1, transition: { duration: d, ease: EASE } } });
const V = {
  cinematic: { group: { hide: {}, show: { transition: { staggerChildren: .16, delayChildren: .2 } } }, bg: { hide: { opacity: 0, scale: 1.08 }, show: { opacity: 1, scale: 1, transition: { duration: 1.3, ease: EASE } } }, product: { hide: { clipPath: "inset(0 100% 0 0)", opacity: 0 }, show: { clipPath: "inset(0 0% 0 0)", opacity: 1, transition: { duration: 1, ease: EASE } } }, item: RISE, label: RISE },
  layered: { group: { hide: {}, show: { transition: { staggerChildren: .1 } } }, bg: fade(.9), product: { hide: { y: 70, opacity: 0, scale: .96 }, show: { y: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 110, damping: 22 } } }, item: { hide: { x: -26, opacity: 0 }, show: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 240, damping: 28 } } }, label: RISE },
  feature: { group: { hide: {}, show: { transition: { staggerChildren: .2, delayChildren: .1 } } }, bg: fade(.8), product: { hide: { opacity: 0, scale: .92 }, show: { opacity: 1, scale: 1, transition: { duration: .9, ease: EASE } } }, item: RISE, label: { hide: { opacity: 0, x: 14 }, show: { opacity: 1, x: 0, transition: { duration: .5, ease: EASE } } } },
  promo: { group: { hide: {}, show: { transition: { staggerChildren: .1, delayChildren: .1 } } }, bg: { hide: { opacity: 0, scale: 1.04 }, show: { opacity: 1, scale: 1, transition: { duration: 1, ease: EASE } } }, product: { hide: { y: 40, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 200, damping: 26 } } }, item: { hide: { y: 24, opacity: 0 }, show: { y: 0, opacity: 1, transition: { duration: .55, ease: EASE } } }, label: RISE },
};
V.scroll = V.layered;
// one line per sentence, like the home hero ("Unbelievable prices. Straight from the factory.")
export const lines = title => String(title || "").split(/(?<=[.!?])\s+/).filter(Boolean);
export const Words = ({ title }) => lines(title).map((l, j) => <span className="ln" key={j}>{l.split(" ").map((w, k) => <m.span className="bw" variants={RISE} key={k}>{w}&nbsp;</m.span>)}</span>);

export function Banner({ b, product, eager, heading = "h2", className = "", children }) {
  const still = useReducedMotion(), ref = useRef(), H = heading;
  const preset = PRESETS.includes(b.preset) ? b.preset : "cinematic", v = V[preset];
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = preset === "layered" || preset === "scroll";
  const bgY = useTransform(scrollYProgress, [0, 1], drift ? ["-8%", "8%"] : ["0%", "0%"]);
  const prodY = useTransform(scrollYProgress, [0, 1], preset === "scroll" ? [70, -70] : drift ? [18, -18] : [0, 0]);
  const prodScale = useTransform(scrollYProgress, [0, .5, 1], preset === "scroll" ? [.84, 1.05, .98] : [1, 1, 1]);
  const cut = product && cutout(product.img);
  const room = product && (product.images || []).find(i => /^img\/elista\/[\w-]+_2\.webp$/.test(i)); // the owner's living-room card as the banner's picture, not the white front card on a dark stage
  const labels = preset === "feature" && product ? callouts(product) : [];
  const alt = product ? product.brand + " " + product.name : "";
  return <m.section ref={ref} className={`banner p-${preset} t-${b.tone || "photo"} a-${b.align || "left"}${product ? " has-prod" : ""}${className ? " " + className : ""}`} style={TONES[b.tone] ? { background: TONES[b.tone] } : undefined} data-preset={preset}
    initial={still ? "show" : "hide"} whileInView="show" viewport={{ once: true, amount: .2 }} variants={v.group}>
    <div className="binner">
      {b.img && <m.div className="bg" variants={v.bg} style={{ y: bgY }}><picture>{b.imgMobile && <source media="(max-width:760px)" srcSet={pic(b.imgMobile, 960)} />}<img src={pic(b.img, 960)} srcSet={picSet(b.img)} sizes="100vw" alt="" style={{ objectPosition: FOCUS[b.focus] || FOCUS.center }} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} decoding="async" /></picture></m.div>}
      {product && <m.a className={"bprod" + (cut ? " cut" : "") + (room ? " room" : "")} href={productUrl(product)} variants={v.product} style={{ y: prodY, scale: prodScale }}>
        {cut ? <img src={cut} alt={alt} loading={eager ? "eager" : "lazy"} /> : <img src={pic(room || product.img, 960)} srcSet={picSet(room || product.img)} sizes="(max-width:760px) 70vw, 40vw" alt={alt} width="800" height="800" loading={eager ? "eager" : "lazy"} />}
        {labels.length > 0 && <span className="blabels">{labels.map(([big, small], i) => <m.span className={"blabel l" + i} variants={v.label} key={big + small}><b>{big}</b><small>{small}</small></m.span>)}</span>}</m.a>}
      <div className="btext">
        {b.badge && <m.span className="bbadge" variants={v.item}>{b.badge}</m.span>}
        {b.kicker && <m.span className="eyebrow" variants={v.item}>{b.kicker}</m.span>}
        <m.div variants={WORDS}><H><Words title={b.title} /></H></m.div>
        {b.text && <m.p variants={v.item}>{b.text}</m.p>}
        {children}
        {(b.cta || b.cta2) && <m.div className="hcta" variants={v.item}>{b.cta && <a className="btn" href={b.href || "#"}>{b.cta}</a>}{b.cta2 && <a className="btn ghost" href={b.href2 || "#"}>{b.cta2}</a>}</m.div>}
      </div>
    </div>
  </m.section>;
}
