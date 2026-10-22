# Mytekkstore Online Store — App Flow

How a shopper and the store admin move through the site. Each page lists what it shows and where it leads.

## 1. Site map

```
Home
├── Category page            (Televisions, Washing Machines, Air Conditioners)
│   └── Product page
├── Brand page               (Elista, Telefunken)
│   └── Product page
├── Search results
│   └── Product page
├── Offers page              (festive offers, offers by category, top deals, bank offers, No Cost EMI)
│   └── Category page sorted by discount
├── Cart
│   └── Checkout
│       └── Order confirmation
├── Account
│   ├── Sign in / Sign up      (mobile number with a code, email and password, or Google)
│   ├── My orders → Order details
│   └── Saved addresses
└── Info pages               (About, Contact, Store locator, Terms, Privacy, Returns, Shipping)
```

## 2. Header and footer (on every page)

| Element | Goes to |
|---|---|
| Logo | Home |
| Category bar | Televisions, Washing Machines, Air Conditioners, Brands, Deals (opens the Offers page). Hovering a name (desktop) or tapping it once (phone) opens that category's menu: sizes or capacities, both brands, four popular models, deals, and the TV size guide. A click, or a second tap, opens the category page. There is no separate menu button or arrow |
| Search box | Suggestions appear as you type: matching products with photo and price, categories and brands, then "See all results". Before typing it shows the biggest deals. Arrow keys and Enter pick one; Enter on the text opens the search results |
| Country selector | Same page, prices change to that country's currency |
| Deliver to (desktop) | A pincode chip beside the search box. The pincode typed here is remembered for every product page and the checkout |
| Account icon | Sign in, or Account if already signed in |
| Cart icon with count | Cart |
| Phone bottom bar | Home, Shop, Deals, Cart (with count) and Account, fixed at the bottom of the screen on phones |
| Footer links | Category pages, brand pages, info pages |

## 3. Main shopping flow

```
Home
  → pick a category, a brand, a banner, or search
Product list (category / brand / search)
  → explore tiles (sizes or capacities, each brand, 4K Ultra HD, Google TV) and size tabs
  → filter by brand, category, price · sort by price or discount
  → click a product
Product page
  → Add to cart  (stays on page, cart count goes up)
  → Buy now      (adds to cart and goes straight to checkout)
Cart
  → change quantity, remove item, see total
  → Checkout
Checkout
  step 1: sign in or create an account: mobile number and one-time code, email and password, or Google (required; a signed-out shopper is sent to the sign-in page and back)
  step 2: delivery address and pincode
  step 3: payment: cash on delivery, or a demo online payment
  step 4: place order
Order confirmation
  → order number (MT…) shown with a short confetti burst, confirmation SMS sent through Twilio (recorded in the outbox until Twilio is connected), cart emptied
  → the order page is private to that customer; the admin can open any order
```

## 4. Page by page

| Page | Shows | Leads to |
|---|---|---|
| Home | Hero slider with a spotlight deal card, numbers band, category tiles, shop-by-size rows, "Built for your home" bento with a No Cost EMI tile, deals of the day, a block per category (lifestyle banner plus four products), brand cards, customer quotes, recently viewed, bank offers, festive offer banner, trust strip, Good to know answers | Category, brand, product, offers page |
| Offers | Festive hero with rising sparks, "up to X% off" worked out from the catalogue, one button per category, countdown when an end date is set; offers by category tiles; top deals; bank offers; No Cost EMI band | Category lists sorted by discount, product |
| Category / Brand / Search | "Explore … by Size / Capacity" tiles (only that category's own tiles; the three category tiles appear on the all-products and brand pages), size tabs, product count, filters, sort, product grid; then Top features and, on Televisions only, the interactive TV size guide | Product, a size-filtered list, or cleared filters |
| Category filters | Sidebar on desktop, a bottom sheet behind a "Filters (n)" pill on phones: brand (more than one), price band, discount, in stock, No Cost EMI, 4★ and above, each with the number of products it would show. Applied filters sit above the grid as chips with × and "Clear all". Filters apply at once, without a reload, and stay in the address so a filtered list can be shared | Product |
| Product | Photo gallery (thumbnails when the admin adds more photos), feature icon strip from the specifications, name, brand, rating, price, MRP, discount, "From ₹X/month with No Cost EMI" (price over 9 months, when the product has the flag), size swatches with prices, stock bar when 10 or fewer are left, free delivery pill, Offers box, a Complete your home box (tick products from the other categories and add all at once) with the top three bank offers, pincode delivery check, WhatsApp / Facebook / X share links and copy link, a compact buy bar that slides up when Add to cart scrolls away (desktop), description, specifications, delivery, reviews, a Compare table (this product beside up to three similar ones, same brand first: photos, price, rating, every specification, EMI, Add to cart; rows that differ are marked), related products | Cart, checkout, other sizes, brand page, category page, related product |
| Cart | Items, quantity controls, total, a "You may also like" row of other products | Checkout, product, home |
| Checkout | Address form (the pincode shows "Delivering to District, State" from India Post), payment choice, order summary | Order confirmation |
| Order confirmation | Order number, status steps, expected delivery date, items, delivery address, payment | Home |
| Account (signed out) | A welcome photo panel and a sign-in card: "Continue with Google" (when set up), then a "Mobile number or email" tab (a one-time code by SMS or email, enter it, add a name if new, resend after 30 seconds) and a Password tab (sign in, or switch to create an account) | Back to the page that asked for sign-in |
| Account (signed in) | Orders, saved address, profile with a "Mobile verified" mark, Edit profile (name, phone, address, pincode) | Order details |
| Info pages | Text content | Home |

## 5. Edge cases

| Situation | What the shopper sees |
|---|---|
| Search finds nothing | "No products found" with a link to all products |
| Product link is wrong or removed | "Product not found" with a link to home |
| Cart is empty | "Your cart is empty" with a link to continue shopping |
| Checkout opened with empty cart | Sent back to continue shopping |
| Product out of stock | "Out of stock" label, add to cart disabled |
| Checkout opened signed out | Sent to sign in or sign up, then back to checkout |
| Pincode check | Every 6-digit pincode is accepted and remembered for next time (the client has not given delivery areas yet). India Post's free pincode service adds the district and state ("Delivery available to 560001, Bengaluru, Karnataka"); if that service is down, the plain message shows. Anything else shows "Please enter a 6-digit pincode" |
| Payment fails | Stays on checkout with the cart intact and a retry option |
| Wrong or expired sign-in code | "Wrong code" or "That code has expired", with a Send a new code link after 30 seconds |
| More than 3 codes in 10 minutes, or 5 wrong tries | Asked to wait, or to request a new code |
| Code sign-in on a hosted store without a provider | "SMS codes are not set up yet" or "Email codes are not set up yet", with the password sign-in as the way in. On localhost, or with OTP_DEMO=1 for a client walkthrough, the code is shown on the page instead |
| Google sign-in not set up | The Google button is simply not shown |

## 6. Admin flow

```
Sign in with the admin account (data/ADMIN_LOGIN.txt) → admin.html
  → Products: add / edit / delete, set brand, category, price, MRP, stock, photo (upload or link), description, specifications, No Cost EMI flag
  → Orders: Placed → Confirmed → Shipped → Delivered · Cancelled (returns the stock)
  → Customer messages: outbox of order confirmations, status updates and sign-in codes, with a Sent column (sent through Twilio, or recorded only)
  Categories and brands come from the products themselves. Banners and a customer list are not built.
```

## 7. What works today

| Flow | Status |
|---|---|
| Home, category, brand, search, filters, sort | Working. Category pages open with explore-by-size tiles and size tabs |
| Search suggestions, faceted filters, Deliver-to chip, phone bottom bar, delivery dates, EMI plans, cart suggestions, profile edit | Working. Added in the gap-closing pass of 2026-10-05 after comparing the store with Croma, Samsung and Flipkart (docs/GAP_ANALYSIS.md) |
| Product page extras | Working. Size chips jump to the other sizes of the same brand, a pincode delivery check, a share button (phone share sheet or copy link), and rating bars in the reviews tab |
| Category menus in the header | Working. Hover a name on desktop, tap it once on a phone; a click or a second tap opens the category page. Keyboard: Tab opens, Escape closes |
| Top features and buying guide | Working. Every category page ends with a Top features band. The Televisions page also has the interactive TV size guide (viewing distance → recommended size). The other categories have no guide, as agreed with the client |
| Add to cart | Working. The photo flies to the cart icon, the count updates and the button becomes a − 1 + stepper (max 10 per order, capped at stock). On the product page the cart drawer slides in; elsewhere a toast with "View cart" appears |
| Cart drawer and cart page | Working, with stock limits |
| Buy now | Working. Goes straight to checkout |
| Checkout | Sign-in required. Cash on delivery, or a demo online payment (UPI, card, net banking) that takes no real money. The order is stored and stock is reduced |
| Order confirmation and tracking page | Working. Private: only the customer who placed the order (or the admin) can open it |
| Account: sign up, sign in, my orders, saved address | Working. Email and password, mobile number with a one-time code (the code is shown on the page on localhost until Twilio is connected), and Google (once GOOGLE_CLIENT_ID is set). See TRD section 11 |
| Offers page, bank offers, No Cost EMI tag | Working with sample bank offers and the tag on every sample product; the client supplies the real terms and picks the products |
| Ratings and reviews | Working. Signed-in customers can rate 1 to 5 stars and write a review; cards and product pages show the average |
| Wishlist and recently viewed | Working, saved in the browser |
| Admin: orders, order status, products, stock, EMI flag, photo upload, customer messages | Working at /admin.html. Messages are recorded, and sent by SMS once Twilio is connected |
| Country selector | Working with fixed sample exchange rates |
| Opened by double-click (no server) | Not supported since the React build; the pages need the server, so run start.bat |
| Real online payment | Demo. Needs the client's payment gateway account |
| Real SMS, email and Google sign-in | Built; switched on by the Twilio, Brevo and Google keys (TRD section 11). Email through Brevo is free |
| Public demo link | go-live.bat puts the running store on a free public https address through a Cloudflare quick tunnel (TRD section 13) |
| Storefront in React | Working. Same pages, same addresses, same tests; source in web/src, built into public/ (TRD section 12) |
