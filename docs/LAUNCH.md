# Going live: what the owner provides

Everything below is already built. Each item switches on by itself once its details are entered (Admin, Settings) or its key is added in Vercel (Project, Settings, Environment Variables) followed by a redeploy. Admin, Settings shows what is connected.

## 1. Business details (Admin, Settings, Business details)

These print on every GST tax invoice and fill the Terms, Privacy and Grievance sections. Copy them from the GST registration certificate.

| Field | Required | Where it appears | Notes |
|---|---|---|---|
| Legal name | yes | invoice "Sold by", legal pages | exactly as on the GST certificate (e.g. "ABC Retail Private Limited") |
| Trade name | no | invoice "Trading as" | the name customers know (Mytekkstore) |
| Registered address, city, state, pincode | yes | invoice, legal pages | the principal place of business on the certificate; the state decides CGST + SGST or IGST |
| GSTIN | yes | invoice | 15 characters; checked (format, check digit, and that its first two digits match the state) |
| CIN | companies only | invoice, legal pages | 21 characters, from the certificate of incorporation (Companies Act, s.12) |
| Customer care phone and email | recommended | invoice, contact | |
| Grievance officer: name, designation, email, phone | yes for an e-commerce site | Terms, Privacy | Consumer Protection (E-Commerce) Rules, 2020 |
| Authorised signatory | yes | invoice signature line | the person who signs for the business |
| Invoice prefix | default MTS | invoice number | numbers run MTS/26-27/00001, 00002... and restart each April |
| HSN code | default 8528 | invoice | 4 digits up to ₹5 crore annual turnover, 6 digits above |
| New-order alerts to | recommended | not shown | every new order is emailed here |

How the invoice works: the order confirmation goes out when the order is placed; the GST tax invoice is issued when the admin marks the order Shipped (rule 47: at or before the removal of goods), with the next number of the financial year (one atomic database step, so no gaps or repeats). Prices include GST at 18%; within the store's state the tax is CGST 9% + SGST 9%, to other states IGST 18%; the place of supply is the delivery state. Turnover above ₹5 crore also needs e-invoicing (IRN) on B2B invoices; not built, since sales are to consumers.

## 2. Services and keys (Vercel environment variables)

| Service | Variables | What it switches on | Lead time |
|---|---|---|---|
| Database (Neon) | `DATABASE_URL` | done | move it to Singapore for speed |
| Admin password | `ADMIN_PASSWORD` | done | keep it strong |
| SMS (MSG91) | `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` (sign-in code), `MSG91_ORDER_TEMPLATE_ID` (order updates) | real sign-in codes; order SMS | DLT registration: several days |
| Remove test codes | delete `OTP_DEMO` | stops showing the sign-in code on screen | the moment SMS works (until then anyone can sign in as any number) |
| Payments (Razorpay) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | UPI, cards, net banking, No Cost EMI | KYC: a few business days |
| Email (Brevo) | `BREVO_API_KEY`, `MAIL_FROM` | order emails with the invoice link, store alerts | sender domain verification: a day |
| Site address | `SITE_URL` (e.g. https://www.mytekkstore.com) | the links in messages | once the domain is set |
| Google Maps | `GOOGLE_MAPS_SERVER_KEY` | more accurate "Use my current location" (OpenStreetMap works until then) | optional |
| Google sign-in | `GOOGLE_CLIENT_ID` | "Continue with Google" | optional |
| reCAPTCHA v3 | `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET` | bot protection on sign-in codes | recommended before launch |

## 3. SMS templates to register on DLT (through MSG91)

India requires every business SMS to use a sender ID and a template registered on a DLT portal (Jio, Airtel, Vi or BSNL). Register a 6-letter sender ID (e.g. MYTEKK) and these two Service Implicit templates, then create the same templates in MSG91 and put their IDs in Vercel.

1. Sign-in code (`MSG91_TEMPLATE_ID`), the OTP template: `{#var#} is your Mytekkstore sign-in code. It is valid for 5 minutes. Do not share it.`
2. Order updates (`MSG91_ORDER_TEMPLATE_ID`): `Mytekkstore: your order {#var#} is {#var#}. Details and invoice: {#var#}`
   In MSG91 the three variables are named `order`, `status` and `link` (##order##, ##status##, ##link##). Status is one of placed, confirmed, shipped, delivered, cancelled, or "return approved" and similar.

## 4. Before the first real customer

1. Business details complete (Admin, Settings shows "Ready for GST invoices").
2. SMS working, then `OTP_DEMO` deleted.
3. Razorpay live; the bank offers on the site (HDFC, ICICI, Axis instant discounts, No Cost EMI) set up with Razorpay or the banks, or removed.
4. Database password reset (it was shared in a chat) and `DATABASE_URL` updated.
5. Admin, Settings, "Clear all customer accounts and orders" to remove the test data.
6. One real order end to end: place it, confirm, ship (check the invoice), deliver.
