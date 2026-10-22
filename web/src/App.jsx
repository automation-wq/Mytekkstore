// The app: shared layout around the page that the HTML shell names in data-page. Clicks on the pieces that appear
// everywhere (add to cart, quantity, wishlist, strips, cart drawer) are handled once here.
import { Component, Suspense, lazy, useEffect, useLayoutEffect, useRef } from "react";
import { useStore } from "./store.jsx";
import { track } from "./api.js";
import { Header, Footer, Chrome, Box } from "./components.jsx";
import { Home, Offers, Cart, Checkout, Order, InfoPage, NotFound } from "./pages1.jsx";
import { Category, ComparePage } from "./category.jsx";
import { Campaign } from "./campaign.jsx";
import { Product } from "./product.jsx";
import { Account } from "./account.jsx";
const Admin = lazy(() => import("./admin.jsx").then(m => ({ default: m.Admin }))); // its own file, loaded only on /admin
import { chrome, reveal, lazyClips, fitStrips, fly } from "./motion.js";

// The web fonts (Inter, Manrope, Space Grotesk) are asked for only once the page is drawn, so neither the first paint nor the
// biggest paint waits for Google Fonts (a font link in the shell, even as media=print, cost 2 s of LCP in Lighthouse). Until they
// arrive the page uses the width-matched fallbacks in style.css, so the swap does not reflow the text (display=swap).
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Manrope:wght@600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap";
const PAGES = { home: Home, category: Category, product: Product, offers: Offers, cart: Cart, checkout: Checkout, order: Order, account: Account, page: InfoPage, admin: Admin, notfound: NotFound, campaign: Campaign, compare: ComparePage };
const $ = (s, el = document) => el.querySelector(s);

// a page that fails while drawing shows a message instead of a blank screen
class Safe extends Component {
  state = {};
  static getDerivedStateFromError(e) { return { e }; }
  componentDidCatch(e) { console.error(e); }
  render() { return this.state.e ? <Box title="Something went wrong" text="Please reload the page. If it happens again, go back to the home page." href="/" cta="Back to home" /> : this.props.children; }
}

export default function App() {
  const s = useStore();
  const latest = useRef(s); latest.current = s;
  const page = document.body.dataset.page;
  useEffect(() => { chrome(); }, []);
  useEffect(() => {
    const h = e => {
      const st = latest.current, t = e.target;
      let b;
      if ((b = t.closest("[data-add]"))) {
        fly(b);
        track("add_to_cart", { id: +b.dataset.add });
        st.setQty(b.dataset.add, st.qtyOf(b.dataset.add) + 1);
        if (page === "product") st.openCart(); else st.toast("Added to cart", true);
      }
      else if ((b = t.closest("[data-q]"))) st.setQty(b.dataset.q, +b.dataset.n);
      else if ((b = t.closest("[data-buy]"))) { if (!st.qtyOf(b.dataset.buy)) st.setQty(b.dataset.buy, 1); location.href = "/checkout"; }
      else if ((b = t.closest("[data-quick]"))) { e.preventDefault(); st.openQuick(b.dataset.quick); }
      else if ((b = t.closest("[data-wish]"))) st.toggleWish(+b.dataset.wish);
      else if ((b = t.closest("[data-scroll]"))) { const r = $(".row", b.parentNode); r.scrollBy({ left: +b.dataset.scroll * r.clientWidth * 0.8, behavior: "smooth" }); }
      else if ((b = t.closest("[data-drawer]"))) { e.preventDefault(); st.openCart(); }
      else if (t.closest("[data-close]")) st.closeCart();
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);
  useEffect(() => { document.body.classList.toggle("cart-open", s.cartOpen); if (s.cartOpen) setTimeout(() => $(".drawer .x")?.focus(), 0); }, [s.cartOpen]);
  // once the page is drawn: reveals, clips, strips, deep links, and the ready promise the tests wait for
  useEffect(() => {
    if (!s.loaded && !s.error) return;
    document.body.classList.add("loaded");
    if (!document.querySelector('link[href^="https://fonts.googleapis.com"]')) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: FONT_CSS }));
    reveal(); lazyClips(); fitStrips();
    const anchor = /^#[\w-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
    if (anchor) anchor.scrollIntoView();
    window.__resolveReady();
  }, [s.loaded, s.error]);
  useEffect(() => { if (s.loaded) { reveal(); lazyClips(); fitStrips(); } }); // pages that draw more after their data arrives
  // the home page arrives with its header and first banner already in the HTML (#static, written by server.js) so it paints before
  // this script runs; it goes the moment the real page is drawn, in the same frame, so nothing shows twice and nothing jumps
  useLayoutEffect(() => { if (s.loaded || s.error) document.getElementById("static")?.remove(); }, [s.loaded, s.error]);

  if (s.error) return <main id="main" className="wrap"><Box title="Something went wrong" text={s.error} href="/" cta="Back to home" /></main>;
  if (!s.loaded) return document.getElementById("static") ? null : <main id="main" className="wrap"><div className="skel" style={{ height: 300, marginTop: 20 }}></div><div className="grid" style={{ marginTop: 32 }}>{[0, 1, 2, 3, 4].map(i => <div className="skel" style={{ height: 320 }} key={i}></div>)}</div></main>;
  const Page = PAGES[page] || NotFound;
  return <>
    <a className="skip" href="#main">Skip to content</a>
    <Header />
    <main id="main" className="wrap"><Safe><Suspense fallback={null}><Page /></Suspense></Safe></main>
    <Footer />
    <Chrome />
  </>;
}
