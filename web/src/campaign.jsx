// Campaign landing pages at /campaigns/<slug>, built from the campaign records the admin keeps (no page is hand-made): the
// campaign's banner (or one made from the campaign itself), the picks, feature blocks, the picks compared side by side, the bank
// offers, questions, related models and a closing call. The theme changes the colours of this page only.
import { useEffect, useState } from "react";
import { useStore } from "./store.jsx";
import { api, qs } from "./api.js";
import { Card, Row, BankOffers, Qa, Box } from "./components.jsx";
import { CompareAll } from "./category.jsx";
import { Banner } from "./banner.jsx";
import { pic, picSet, listUrl, catUrl, cutout } from "./data.js";

export function Campaign() {
  const { P, byId, banners, money } = useStore();
  const slug = qs.get("slug") || "";
  const [c, setC] = useState(undefined); // undefined while loading, null when there is no such campaign
  useEffect(() => { api("campaigns").then(d => setC(d.campaigns.find(x => x.slug === slug) || null)).catch(() => setC(null)); }, [slug]);
  useEffect(() => { if (c) document.title = ((c.seo && c.seo.title) || c.title) + " | Mytekkstore"; }, [c]);
  if (c === undefined) return <div className="skel" style={{ height: 420, marginTop: 20 }}></div>;
  if (!c) return <Box title="Campaign not found" text="This campaign has ended or the address is wrong." href="/offers" cta="See the offers" />;
  const picks = c.productIds.map(byId).filter(Boolean);
  const own = banners.find(b => b.slot === "campaign:" + c.slug);
  const hero = own || { preset: "promo", kicker: c.title, title: c.title, text: c.lead, cta: "See the picks", href: "#products", tone: c.theme === "light" ? "paper" : c.theme, productId: picks[0] ? picks[0].id : 0, badge: c.sample ? "Sample campaign" : "" };
  const heroProd = hero.productId ? byId(hero.productId) : null;
  const cat = picks[0] ? picks[0].cat : "", low = picks.length ? Math.min(...picks.map(p => p.price)) : 0;
  const related = P.filter(p => p.cat === cat && !c.productIds.includes(p.id)).slice(0, 6);
  return <div className={"campaign theme-" + (c.theme || "light")}>
    <div className="crumbs"><a href="/">Home</a> › <a href="/offers">Offers</a> › {c.title}</div>
    <Banner b={hero} product={heroProd} eager heading="h1" className="chero" />
    {own && c.lead && <p className="lead clead">{c.lead}</p>}
    <section id="products"><h2>{"The picks"}</h2><p className="lead">{picks.length + " model" + (picks.length === 1 ? "" : "s") + (low ? ", from " + money(low) : "") + "."}</p><div className="grid">{picks.map((p, i) => <Card p={p} i={i} key={p.id} />)}</div></section>
    {c.features.length > 0 && <section className="aplus" id="why"><h2>{"Why these picks"}</h2>{c.features.map((f, i) => <div className={"ablock" + (i % 2 ? " flip" : "") + (i === 1 ? " dark" : "")} key={i}>{f.img && (cutout(f.img) ? <img className="cut" src={cutout(f.img)} alt="" loading="lazy" /> : <img src={pic(f.img, 960)} srcSet={picSet(f.img)} sizes="(max-width:860px) 100vw, 50vw" alt="" loading="lazy" />)}<div><h3>{f.title}</h3><p>{f.text}</p></div></div>)}</section>}
    {picks.length > 1 && <CompareAll list={picks} cat={cat} short={cat.toLowerCase()} picked />}
    {c.offers && <BankOffers />}
    {c.faq.length > 0 && <Qa title="Good to know" list={c.faq} />}
    <Row title="More to look at" href={catUrl(cat)} list={related} />
    <section className="help cend"><div><h2>{"Ready?"}</h2><p>Free delivery, cash on delivery and the brand's warranty on every model.</p></div><div className="btns"><a className="btn" href="#products">Back to the picks</a><a className="btn ghost" href={listUrl({ cat, sort: "off" })}>All deals</a></div></section>
  </div>;
}
