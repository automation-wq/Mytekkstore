// Shared state: catalogue, signed-in customer, optional services, cart, wishlist, recently viewed, country, toast and cart drawer.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, load, save, track, bootCache } from "./api.js";
import { COUNTRIES } from "./data.js";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [P, setP] = useState([]);
  const [me, setMe] = useState(null);
  const [CFG, setCFG] = useState({ google: "", sms: false, mail: false, demoCodes: false, clarity: false, chat: false });
  const [banners, setBanners] = useState([]); // the live banners (home slides, product and campaign heroes), kept by the admin
  const [cart, setCart] = useState({});
  const [wish, setWishState] = useState(() => load("wish", []));
  const [recent, setRecentState] = useState(() => load("recent", []));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [quick, setQuick] = useState(null); // the product shown in the Quick View modal, or null
  const [toastState, setToastState] = useState({ msg: "", withCart: false, n: 0 });
  const [bump, setBump] = useState(0);
  const toastTimer = useRef();

  const [country, setCountry] = useState(() => { const c = load("country", "India"); return Object.hasOwn(COUNTRIES, c) ? c : "India"; });
  // a first visit takes the display currency from the visitor's country (the hosting's own header, no lookup service); a choice in the header always wins
  useEffect(() => { if (!CFG || load("country", null) !== null) return; const guess = { AE: "UAE", SA: "Saudi Arabia", US: "USA" }[CFG.country]; if (guess) { save("country", guess); setCountry(guess); } }, [CFG]);
  const money = n => { const [s, l, r0] = COUNTRIES[country]; const code = { UAE: "AED", "Saudi Arabia": "SAR", USA: "USD" }[country]; const r = (code && CFG && CFG.fx && CFG.fx.rates && CFG.fx.rates[code]) || r0; return s + Math.round(n * r).toLocaleString(l); }; // live display rates from the server when it has them; every order is charged in INR

  useEffect(() => {
    const apply = ({ products, user, cfg, banners }) => {
      const byId = id => products.find(p => p.id === +id);
      // keep only cart items that still exist and are in stock
      setCart(Object.fromEntries(Object.entries(load("cart", {})).filter(([id, q]) => byId(id) && byId(id).stock > 0 && q > 0).map(([id, q]) => [id, Math.min(q, byId(id).stock, 10)])));
      setWishState(w => w.filter(id => byId(id)));
      setP(products); setMe(user); setCFG(cfg); setBanners(banners);
      setLoaded(true);
    };
    // the answers kept from the last page (api.js bootCache) draw the page at once; the server's fresh ones replace them a moment later
    const kept = bootCache.read();
    if (kept) apply(kept);
    (async () => {
      // the four startup calls go out together (one round trip, not four); cfg says which optional services (Google sign-in, SMS, email) are on
      const [{ products }, { user }, cfg, bn] = await Promise.all([api("products"), api("me"), api("config"), api("banners").catch(() => ({ banners: [] }))]);
      const fresh = { products, user, cfg, banners: bn.banners || [] };
      bootCache.write(fresh);
      apply(fresh);
    })().catch(e => { if (!kept) setError(e.message || "Please try again."); });
  }, []);

  const CATS = useMemo(() => [...new Set(P.map(p => p.cat))], [P]);
  const BRANDS = useMemo(() => [...new Set(P.map(p => p.brand))], [P]);
  const byId = id => P.find(p => p.id === +id);
  const catImg = c => (P.find(p => p.cat === c) || {}).img || "";
  const qtyOf = id => cart[id] || 0;
  const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = () => Object.entries(cart).reduce((t, [id, q]) => t + byId(id).price * q, 0);

  const toast = (msg, withCart = false) => {
    setToastState(t => ({ msg, withCart, n: t.n + 1 }));
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(t => ({ ...t, msg: "" })), 2600);
  };
  // the cart lives in the browser until checkout; quantities are capped at stock and at 10 per order
  const setQty = (id, q) => {
    const p = byId(id);
    if (!p) return;
    const max = Math.min(p.stock, 10);
    if (q > max) { toast(p.stock < 10 ? `Only ${p.stock} in stock` : "Maximum 10 per order"); q = max; }
    if (q <= 0 && cart[p.id]) track("remove_from_cart", { id: p.id });
    setCart(c => { const n = { ...c }; if (q > 0) n[p.id] = q; else delete n[p.id]; save("cart", n); return n; });
    setBump(b => b + 1);
  };
  const clearCart = () => { setCart({}); save("cart", {}); };
  const toggleWish = id => {
    const had = wish.includes(id), next = had ? wish.filter(x => x !== id) : [...wish, id];
    setWishState(next); save("wish", next);
    toast(had ? "Removed from wishlist" : "Saved to wishlist");
  };
  const addRecent = id => { const next = [id, ...recent.filter(x => x !== id)].slice(0, 10); setRecentState(next); save("recent", next); return next; };
  const updateProduct = product => setP(ps => ps.map(x => x.id === product.id ? { ...x, ...product } : x));

  const value = { P, CATS, BRANDS, me, CFG, banners, cart, wish, recent, loaded, error, country, money, byId, catImg, qtyOf, cartCount, cartTotal, setQty, clearCart,
    toggleWish, addRecent, updateProduct, toast, toastState, bump, cartOpen, openCart: () => setCartOpen(true), closeCart: () => setCartOpen(false),
    quick, openQuick: id => setQuick(+id), closeQuick: () => setQuick(null) };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
