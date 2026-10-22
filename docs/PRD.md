# Mytekkstore Online Store — Product Requirements (PRD)

Status: draft for approval. Items marked **[CONFIRM]** need an answer from the client.

## 1. What we are building

An online electronics store called **Mytekkstore**. Mytekkstore is the website and the seller. It sells two brands, **Elista** and **Telefunken**, in three categories: **Televisions, Washing Machines and Air Conditioners**. It is not a marketplace: there are no other sellers, no seller sign-up and no seller dashboards. Mytekkstore owns the stock, the prices and the orders.

## 2. References (from the client sheet "Elista references")

| Site | What to take from it |
|---|---|
| Croma (recommended) | Overall layout: wide search, banner slider, category and brand rows, deal cards. The client chose a white theme instead of Croma's dark one |
| Pai International | Multi-brand retail store structure, offers and store information |
| Cellecor | Clean product presentation |
| Newegg | Country selector in the header |

The sheet also asks for two things by name: **Multi Categories** and **Multi Brands**.

## 3. Who uses it

- **Shopper:** finds a product, compares, adds to cart, pays, tracks the order.
- **Store admin (Mytekkstore staff):** adds products, sets prices and stock, runs banners and offers, handles orders.

## 4. Goals

1. A shopper can find any product in three clicks or one search.
2. A shopper can complete an order on a phone without help.
3. Mytekkstore staff can add or change a product without a developer.
4. The store looks like a real, trusted retail brand, in line with Croma.

## 5. Features

### Phase 1 — launch (must have)

| Area | Requirement |
|---|---|
| Home | Banner slider, category row, brand row, deals of the day, promo banners, product rows by category, trust strip |
| Categories | Category menus in the header (hover or tap the name), category page with explore-by-size tiles, size tabs and product grid, Top features band, TV size guide on Televisions |
| Brands | Brand row on home, brand page listing that brand's products |
| Search | Search box in the header, results page, "no results" state |
| Filters and sort | Filter by category, brand and price range. Sort by price and discount |
| Product page | Photo gallery with thumbnails, feature icon strip, name, brand, rating, price, MRP, discount, EMI per month, size swatches with prices, stock bar, delivery pill, add-on box with products from the other categories, share links, key specifications, pincode delivery check, share, specifications, reviews, stock status, compare table with similar models, related products |
| Cart | Add, change quantity, remove, see total. Cart is kept between visits |
| Checkout | Sign in, address and pincode, payment, order confirmation |
| Payments | Online payment (cards, UPI, net banking) and cash on delivery **[CONFIRM]** |
| Account | Sign up and sign in by email and password, by mobile number with a one-time code (SMS through Twilio), or with a Google account. Saved address, order history |
| Orders | Confirmation SMS when the order is placed and on every status change (Twilio; recorded in the admin outbox until Twilio is connected), order status page |
| Country selector | Shopper picks a country; prices show in that country's currency **[CONFIRM which countries]** |
| Info pages | About, Contact, Store locator, Terms, Privacy, Returns, Shipping |
| Offers | Festive offers page (Deals in the bar and the home banner open it): offers by category, top deals, bank offers and No Cost EMI. Bank offers on the home page and every product page. A No Cost EMI tag per product, set in the admin |
| Admin | Manage products, prices, stock, photos, orders and order status. Banners: later |
| Mobile | Every page works on a phone |

### Phase 2 — after launch (nice to have)

- A compare page across categories (the compare table on each product page, wishlist, ratings and reviews are already built)
- Coupons (bank offers and the No Cost EMI tag are built; the client supplies the real terms)
- Store pickup, exchange offers, extended warranty
- Blog. The TV size guide is built; guides for washing machines and air conditioners only if the client asks
- Service request and installation booking

### Not included

- Multiple sellers / marketplace features
- A mobile app (the website is mobile friendly instead)

## 6. Content needed from the client

1. Logo and brand colours
2. Product list: name, brand, category, price, MRP, stock, features, specifications, photos
3. List of brands and categories to show
4. Banner offers for the home page
5. Countries to sell in, and delivery areas
6. Company details: address, phone, email, GST number, policies
7. Payment gateway account (for example Razorpay) **[CONFIRM]**
8. Twilio account (Account SID, Auth Token and a sender number) for SMS, plus DLT registration in India **[CONFIRM]**
9. Google sign-in client ID from Google Cloud, and a Brevo key for email codes and order emails (both free) **[CONFIRM]**
10. The real bank offers and EMI terms, and which products carry No Cost EMI. The site shows sample offers until then

Until items 1 and 2 arrive, the site uses a sample catalogue and generated images.

## 7. How we know it works

- Every link in the header, menu and footer opens a working page.
- A test order can be placed from a phone and appears in the admin.
- Admin can add a product and see it on the site without a developer.
- Pages load in under 3 seconds on a normal mobile connection.
- `node test.js` and `node test-ui.js` both pass.

## 8. Open questions

1. Is Mytekkstore selling only in India at launch, or other countries too?
2. Which payment methods are required?
3. Does Mytekkstore deliver itself, or through a courier partner?
4. Who will manage products and orders day to day?
5. Is there an existing domain and hosting?
6. Which bank offers and EMI tenures apply, and until when do the festive offers run (for the countdown)?
