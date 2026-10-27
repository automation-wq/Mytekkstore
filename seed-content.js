// SAMPLE content for the banner engine and the campaign pages, used until the admin saves their own (data/banners.json and
// data/campaigns.json). The two home banners follow the client's brief of 13 October (their own lifestyle photo, then the offers banner); the two product banners and the
// campaign show what the system can do, with facts taken from the products they point at. Every line here is replaceable in /admin.
module.exports = {
  banners: [
    { id: 1, slot: "home", order: 1, preset: "cinematic", kicker: "Mytekkstore", title: "Unbelievable prices, straight from the factory.", text: "Elista Smart TVs, delivered free, cash on delivery.", cta: "Explore TVs", href: "/televisions", cta2: "See deals", href2: "/televisions?sort=off", img: "img/hero-a.jpg", imgMobile: "img/hero-a-m.jpg", focus: "center", align: "left", badge: "", tone: "photo", productId: 0, brand: "", until: "", live: true },
    { id: 2, slot: "home", order: 2, preset: "cinematic", kicker: "Elista", title: "Brilliant entertainment. Beautifully yours.", text: "Discover the Elista television collection.", cta: "Shop Elista", href: "/products?brand=Elista", cta2: "", href2: "", img: "img/life-room.jpg", imgMobile: "", focus: "center", align: "left", badge: "", tone: "", productId: 0, brand: "Elista", until: "", live: true },
    { id: 4, slot: "home", order: 4, preset: "promo", kicker: "Limited time", title: "Festive offers.", text: "", cta: "See the offers", href: "/offers", cta2: "", href2: "", img: "img/hero-b.jpg", imgMobile: "", focus: "center", align: "left", badge: "", tone: "photo", productId: 0, brand: "", until: "", live: true },
    { id: 6, slot: "product:11", order: 1, preset: "feature", kicker: "Elista · WebOS", title: "The 50 inch that fits the budget.", text: "4K Ultra HD, WebOS, 24 W sound and three HDMI ports.", cta: "Buy now", href: "#overview", cta2: "", href2: "", img: "", imgMobile: "", focus: "center", align: "left", badge: "", tone: "green", productId: 11, brand: "", until: "", live: true },
    { id: 7, slot: "campaign:festive-tv-days", order: 1, preset: "promo", kicker: "Festive TV Days", title: "Four 4K TVs. No Cost EMI on all.", text: "Picked for the festive week: 43 to 65 inch, Google TV or WebOS, with the bank offers on top.", cta: "See the picks", href: "#products", cta2: "All offers", href2: "/offers", img: "", imgMobile: "", focus: "center", align: "left", badge: "Sample campaign", tone: "dark", productId: 13, brand: "", until: "", live: true },
  ],
  campaigns: [
    { id: 1, slug: "festive-tv-days", title: "Festive TV Days", lead: "Four 4K televisions picked for the festive week, from 43 to 65 inch, every one with No Cost EMI.", theme: "dark", productIds: [3, 11, 26, 17],
      features: [
        { title: "4K Ultra HD on every pick", text: "3840 x 2160 on all four, so films, sport and games stay sharp from 43 inch to 65 inch.", img: "img/hero0.jpg" },
        { title: "Google TV or WebOS", text: "Three run Google TV with a voice remote; the Elista 50 inch runs WebOS. Apps are built in on all four, with no set-top box.", img: "img/kv-tv.jpg" },
        { title: "No Cost EMI on all four", text: "Split the price over 3, 6 or 9 months with no extra interest on the bank cards listed on the offers page.", img: "img/p3.jpg" },
      ],
      offers: true,
      faq: [["Are the prices on this page final?", "Yes. Every price is inclusive of all taxes. Bank offers are listed on the offers page with their own terms."], ["Can I pay cash on delivery?", "Yes. Cash on delivery is available on every order, with free delivery usually in 3 to 5 days."]],
      seo: { title: "Festive TV Days: four 4K TVs with No Cost EMI", desc: "Festive picks at Mytekkstore: Elista 4K TVs from 43 to 65 inch, No Cost EMI, bank offers, free delivery and cash on delivery." },
      sample: true, live: true, updated: "2026-10-12T00:00:00.000Z" },
  ],
};
