// The legal pages (28 Oct 2026): Terms of use, Privacy policy, Shipping policy, Cancellation, returns and refund policy, Warranty.
// Laid out the way the large Indian stores lay theirs out (a contents list, numbered clauses, the date of the last change), written in
// plain words for this store. Every number comes from POLICY, the catalogue or how the site actually works (server.js); the business's
// legal details (registered name, address, GSTIN, grievance officer) come from LEGAL in data.js and appear only once they are filled in.
import { useEffect } from "react";
import { useStore } from "./store.jsx";
import { CONTACT, LEGAL, POLICY, WARRANTY_QA } from "./data.js";
import { Icon } from "./components.jsx";

const who = () => LEGAL.entity || "MyTekkStore";
const mail = () => (LEGAL.grievance && LEGAL.grievance.email) || CONTACT.email;
const contactLine = () => [CONTACT.email && "email " + CONTACT.email, CONTACT.phone && "phone " + CONTACT.phone].filter(Boolean).join(", ");

// [id, heading, ...blocks]; a block is a paragraph string or an array of list items
const DOCS = {
  terms: { title: "Terms of use", lead: "The agreement between you and MyTekkStore when you use this website or place an order.", sections: () => [
    ["about", "About these terms", `These terms apply to your use of this website and to every order you place on it. "We", "us" and "MyTekkStore" mean ${who()}${LEGAL.address ? ", " + LEGAL.address : ""}. "You" means the person using the website or placing the order.`, "By using the website or placing an order you accept these terms, the Privacy policy, the Shipping policy and the Cancellation, returns and refund policy, which form part of them. If you do not agree, please do not use the website."],
    ["eligibility", "Who can buy", "You must be at least 18 years old and able to enter into a binding contract under Indian law. Orders are accepted for delivery within India only; prices shown in other currencies are for reference and every order is charged in Indian rupees."],
    ["account", "Your account", ["You sign in with your mobile number and a one-time code, or with Google, or with an email and password.", "Keep your device and sign-in codes to yourself. Orders placed from your account are treated as placed by you.", "Give accurate details. An order needs a verified mobile number so the delivery partner can reach you.", "We may suspend an account used for fraud, abuse of offers or a breach of these terms."]],
    ["products", "Products and descriptions", "We sell new, sealed products with the manufacturer's warranty. Descriptions, specifications and images come from the manufacturer. Pictures are for illustration: screen images are simulated and colours may look different on your display. If a product you receive does not match its description, the Cancellation, returns and refund policy applies."],
    ["prices", "Prices", ["Prices are in Indian rupees and include GST. The MRP is the maximum retail price printed by the manufacturer; the price you pay is shown on the product page and at checkout.", "Prices and stock are checked again on our server when you place the order; a price shown in an old browser tab is not binding.", "If a product is listed at an obviously wrong price because of a technical or typing error, we may cancel the order and refund anything paid in full, even after it was confirmed."]],
    ["orders", "Orders and their acceptance", ["Placing an order is an offer to buy. The contract is formed when we confirm the order; the order page and your account show its status from Placed to Confirmed, Shipped and Delivered.", "We may decline or cancel an order that we cannot fulfil, that looks fraudulent, or that is for resale in quantities beyond normal household use. Anything paid is refunded in full.", "Up to 10 units of a model can be ordered at a time."]],
    ["payment", "Payment", ["You can pay cash on delivery, or online by UPI, credit or debit card or net banking through our payment partner. We never see or store your card or UPI details.", "No Cost EMI is offered by the participating banks on their cards. The bank decides eligibility and tenure; any processing fee the bank charges is shown by the bank.", "Bank offers are run by the banks and follow their own terms."]],
    ["coupons", "Coupons and offers", [`The welcome code MYTEKK500 gives ₹500 off a first order of ₹15,000 or more. It is issued to a new account, is valid for 30 days, can be used once and cannot be exchanged for cash.`, "One coupon per order. Coupons are checked on our server against your account; a coupon used on an order that is cancelled or returned is not paid out in cash.", "We may end or change an offer at any time without affecting orders already confirmed."]],
    ["delivery", "Delivery", "Delivery is free across India, usually in 3 to 5 days. Times are estimates, not guarantees. Ownership and risk in the product pass to you on delivery. The Shipping policy has the details."],
    ["cancellation", "Cancellation, returns and refunds", `You can cancel an order before it is shipped. A delivered product can be returned within ${POLICY.returnDays} days of delivery if it is damaged, faulty, incomplete or not what you ordered, on the conditions in the Cancellation, returns and refund policy. Refunds are made to the original payment method, usually within ${POLICY.refundDays} working days of the returned product being checked.`],
    ["warranty", "Warranty", "Every television carries the manufacturer's warranty, of 1 year or 1 + 1 years as shown on its product page, serviced by the manufacturer's service network. We are not a party to the manufacturer's warranty, but we help you reach the service network. The Warranty page has the details."],
    ["content", "Reviews and content you post", "Reviews and questions you post must be honest, your own and lawful. You let us show them on the website. We may remove content that is abusive, misleading, promotional or unrelated to the product."],
    ["ip", "Intellectual property", "The website, its design, text and software belong to us or to our licensors. Brand names, logos and product images belong to their owners and are used to describe their products. You may not copy, scrape or reuse any part of the website for commercial purposes without our written permission."],
    ["use", "Acceptable use", ["Do not use the website for anything unlawful or fraudulent.", "Do not try to break, overload or gain unauthorised access to the website, its servers or other accounts.", "Do not use automated tools to place orders, collect data or abuse offers."]],
    ["liability", "Limitation of liability", "To the extent the law allows, our total liability for an order is limited to the amount you paid for it. We are not liable for indirect or consequential loss. Nothing in these terms limits your rights under the Consumer Protection Act, 2019."],
    ["indemnity", "Indemnity", "You agree to compensate us for loss caused by your breach of these terms or by your misuse of the website."],
    ["force", "Events outside our control", "We are not responsible for delays or failures caused by events outside our reasonable control, such as natural disasters, strikes, transport disruption or government action. We will keep you informed and you may cancel an order that is affected for a full refund."],
    ["law", "Governing law and disputes", `These terms are governed by the laws of India. Disputes are subject to the jurisdiction of the courts ${LEGAL.city ? "at " + LEGAL.city : "of India"}, without affecting your right to approach a consumer commission.`],
    ["grievance", "Grievance redressal", `In line with the Consumer Protection (E-Commerce) Rules, 2020, ${LEGAL.grievance && LEGAL.grievance.name ? `our Grievance Officer is ${LEGAL.grievance.name}${mail() ? ", " + mail() : ""}${LEGAL.grievance.phone ? ", " + LEGAL.grievance.phone : ""}` : `you can raise a complaint through the contact page${mail() ? " or at " + mail() : ""}`}. We acknowledge a complaint within 48 hours and resolve it within one month of receiving it.`],
    ["changes", "Changes to these terms", "We may update these terms. The date at the top shows the latest change; orders already placed follow the terms in force when they were placed."],
  ] },

  privacy: { title: "Privacy policy", lead: "What personal data MyTekkStore collects, why, who it is shared with, and the choices you have.", sections: ({ clarity }) => [
    ["scope", "Scope", `This policy explains how ${who()} handles personal data collected through this website, in line with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000. By using the website you consent to the processing described here.`],
    ["collect", "What we collect", ["Account details: your name, mobile number, email address if you give one, and a password if you set one (stored only as a hash).", "Orders: delivery addresses, pincode, the products you buy, the payment method and the order history.", "Content: reviews and questions you post, and messages you send through the contact page.", "Technical data: the sign-in cookie, and the country your connection comes from, used to show prices in your currency.", "Kept only in your browser until you order: your cart, wishlist, chosen pincode and country."]],
    ["why", "Why we use it", ["To create your account and sign you in with one-time codes.", "To process, deliver and support your orders, including returns and warranty help.", "To send order updates and sign-in codes by SMS or email, and offers if you have not turned them off in your account.", "To prevent fraud and abuse of offers, and to meet legal and tax obligations."]],
    ["share", "Who we share it with", ["Delivery partners: your name, address and mobile number, to deliver your order.", "Our payment partner: what is needed to process an online payment. We never receive your card or UPI details.", "Messaging services: your mobile number or email, to send codes and updates.", "Hosting and database providers that run the website on our behalf.", "Authorities, when the law requires it.", "We never sell your personal data."]],
    ["cookies", "Cookies", "One cookie keeps you signed in. There are no advertising cookies." + (clarity ? " Microsoft Clarity records how pages are used (clicks, scrolling, time on page) to improve the website; anything you type is masked." : " There are no tracking cookies.")],
    ["keep", "How long we keep it", "We keep account data while your account is open, and order and invoice records for as long as tax law requires. Sign-in codes expire after five minutes and are stored only as a hash."],
    ["security", "Security", "The website is served over HTTPS. Passwords and codes are stored hashed, never in plain text. Access to customer data is limited to the people who need it to serve you."],
    ["rights", "Your rights", ["See the personal data we hold about you, and correct it from your account.", "Ask us to erase your account and data, unless the law requires us to keep a record.", "Withdraw consent to offers at any time from Notifications in your account.", "Nominate a person to exercise these rights on your behalf.", "Raise a grievance with us, and then with the Data Protection Board of India."]],
    ["children", "Children", "The website is not meant for children under 18, and we do not knowingly collect their data."],
    ["transfer", "Where data is stored", "Our hosting and service providers may process data on servers outside India, under contracts that protect it."],
    ["grievance", "Grievance Officer", LEGAL.grievance && LEGAL.grievance.name ? `${LEGAL.grievance.name}${mail() ? ", " + mail() : ""}${LEGAL.grievance.phone ? ", " + LEGAL.grievance.phone : ""}. We respond within the time the law sets.` : `Write to us through the contact page${mail() ? " or at " + mail() : ""}. We respond within the time the law sets.`],
    ["changes", "Changes to this policy", "We may update this policy. The date at the top shows the latest change."],
  ] },

  "shipping-policy": { title: "Shipping policy", lead: "Where we deliver, how long it takes, what it costs and what happens at your door.", sections: () => [
    ["areas", "Where we deliver", "Across India. Enter your pincode on any product page or at checkout to see the estimate for your area. We do not ship outside India yet."],
    ["time", "How long it takes", "Usually 3 to 5 days from the order being confirmed. Remote areas may take longer. The estimate shown at checkout is an estimate, not a guarantee."],
    ["cost", "What it costs", "Delivery is free on every order. There is no extra charge for cash on delivery."],
    ["track", "Tracking", "Your account and the order page show the status of each order from Placed to Confirmed, Shipped and Delivered, and we send updates by SMS or email."],
    ["door", "At your door", ["The delivery partner calls the verified mobile number on the order. Someone over 18 must receive the product.", "Check the outer box before you accept it. If it is visibly damaged, you may refuse the delivery and we arrange a replacement or a refund.", "For cash on delivery, pay the exact amount on the order page."]],
    ["failed", "If we cannot deliver", "If the delivery partner cannot reach you after repeated attempts, the order comes back to us and is cancelled; anything paid online is refunded in full."],
    ["damage", "Damage found on unboxing", `Tell us within ${POLICY.returnDays} days of delivery, with photos, and the Cancellation, returns and refund policy applies.`],
  ] },

  "refund-policy": { title: "Cancellation, returns and refund policy", lead: "How to cancel an order, return a product and get your money back.", sections: () => [
    ["cancel", "Cancelling an order", ["You can cancel an order at any time before it is shipped, through the contact page with your order number. Anything paid is refunded in full.", "After the order is shipped, it can be refused at the door or returned under this policy.", "We may cancel an order we cannot fulfil, with a full refund."]],
    ["window", "The return window", `You can ask for a return within ${POLICY.returnDays} days of delivery if the product is damaged, faulty, incomplete or not what you ordered.`],
    ["conditions", "Conditions", ["The product must be unused apart from a check that it works, with all accessories, the remote, manuals, the warranty card and the original packaging.", "Products damaged by mishandling, installation or use after delivery cannot be returned; the manufacturer's warranty still applies.", "We may inspect the product, at your address or after pickup, before approving the return."]],
    ["how", "How to return", ["Write to us through the contact page with your order number, the reason and photos.", "We arrange the pickup free of charge.", "Once the product is checked, we approve a replacement or a refund."]],
    ["replace", "Replacement", "A damaged or faulty product is replaced with the same model when it is in stock. If it is not, you get a full refund."],
    ["refund", "Refunds", [`Refunds are made within ${POLICY.refundDays} working days of the returned product being checked.`, "Online payments are refunded to the same card, UPI account or bank account. Your bank may take a few more days to show it.", "Cash on delivery orders are refunded to a bank account you give us.", "The refund is the amount you paid; a coupon discount is not paid out in cash."]],
    ["emi", "EMI orders", "For an order paid on No Cost EMI, the refund goes to your card and the bank closes the EMI plan on its own terms."],
    ["warranty", "After the return window", "Faults after the return window are covered by the manufacturer's warranty. See the Warranty page."],
  ] },

  warranty: { title: "Warranty", lead: "What the manufacturer's warranty covers, how long it runs on each model, and how to claim it.", sections: () => [
    ["cover", "What is covered", "Every television we sell is new and carries the manufacturer's warranty against manufacturing defects. The warranty is given by the manufacturer and serviced by its service network; we help you reach it."],
    ["length", "How long", "Each model carries either 1 year, or 1 + 1 years where the second year applies once the TV is registered with the manufacturer. The table below shows the warranty of every model we sell, as stated by the manufacturer."],
    ["register", "Registering for the second year", "For a 1 + 1 year model, register the TV with the manufacturer after delivery, with your invoice and the serial number on the back of the TV. Keep the invoice from your order page; it is your proof of purchase."],
    ["claim", "How to claim", ["Write to us through the contact page with your order number and a short description of the problem, with a photo or video if possible.", "We connect you with the manufacturer's service centre and follow up until it is resolved.", "The service centre decides whether a repair or a replacement part is needed."]],
    ["not", "What is not covered", ["Physical damage, a broken screen, liquid damage or damage from a power surge.", "Faults caused by installation, wall-mounting or repairs by someone other than the authorised service centre.", "Normal wear, and accessories beyond what the manufacturer covers."]],
  ] },
};
export const LEGAL_PAGES = Object.keys(DOCS);
const ORDER = [["terms", "Terms of use"], ["privacy", "Privacy policy"], ["shipping-policy", "Shipping policy"], ["refund-policy", "Cancellation & refunds"], ["warranty", "Warranty"]];

export function LegalPage({ p }) {
  const { P, CFG } = useStore();
  const doc = DOCS[p], sections = doc.sections({ clarity: CFG && CFG.clarity });
  useEffect(() => { document.title = doc.title + " | Mytekkstore"; }, [p]);
  const tvs = (P || []).filter(x => x.cat === "Televisions").map(x => [x, ((x.specs || []).find(([k]) => /warranty/i.test(k)) || [])[1] || ""]).sort((a, b) => a[0].price - b[0].price);
  return <div className="legal">
    <div className="crumbs"><a href="/">Home</a> › {doc.title}</div>
    <div className="lg-head"><span className="lg-eyebrow">{p === "warranty" ? "Help" : "Legal"}</span><h1>{doc.title}</h1><p>{doc.lead}</p><small>Last updated {LEGAL.updated}</small></div>
    <nav className="lg-tabs" aria-label="Policies">{ORDER.map(([k, t]) => <a href={"/" + k} className={k === p ? "on" : undefined} aria-current={k === p ? "page" : undefined} key={k}>{t}</a>)}</nav>
    <div className="lg-cols">
      <aside className="lg-toc"><b>On this page</b><ol>{sections.map(([id, h]) => <li key={id}><a href={"#" + id}>{h}</a></li>)}</ol></aside>
      <article className="lg-body">
        {sections.map(([id, h, ...blocks], i) => <section id={id} key={id}><h2><span>{i + 1}.</span>{h}</h2>{blocks.map((bl, j) => Array.isArray(bl) ? <ul key={j}>{bl.map(li => <li key={li}>{li}</li>)}</ul> : <p key={j}>{bl}</p>)}
          {p === "warranty" && id === "length" && <div className="lg-table"><table><thead><tr><th>Model</th><th>Warranty</th></tr></thead><tbody>{tvs.map(([x, w]) => <tr key={x.id}><td>{x.brand} {x.name}</td><td>{/1 \+ 1|1\+1/.test(w) ? "1 + 1 years (second year on registration)" : w || "As stated by the manufacturer"}</td></tr>)}</tbody></table></div>}
        </section>)}
        {p === "warranty" && <section id="faq"><h2>Common questions</h2>{WARRANTY_QA.map(([q, a]) => <details className="lg-q" key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>}
        {(LEGAL.entity || LEGAL.address || LEGAL.gstin) && <section className="lg-entity"><h2>Business details</h2><p>{[LEGAL.entity, LEGAL.address, LEGAL.gstin && "GSTIN " + LEGAL.gstin].filter(Boolean).join(" · ")}</p></section>}
        <div className="lg-help"><Icon k="search" /><div><b>Questions about this page?</b><span>Write to us through the <a href="/contact">contact page</a>{contactLine() ? ", or " + contactLine() : ""}.</span></div></div>
      </article>
    </div>
  </div>;
}
