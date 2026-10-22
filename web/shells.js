// Writes the HTML shells (one per page). They are identical apart from the page name and title; the server fills in the
// SEO tags per address and the React app reads data-page to decide what to draw.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const PAGES = [
  ["index", "home", "Mytekkstore | Electronics Online"], ["category", "category", "Products | Mytekkstore"], ["product", "product", "Product | Mytekkstore"],
  ["offers", "offers", "Festive offers | Mytekkstore"], ["cart", "cart", "Cart | Mytekkstore"], ["checkout", "checkout", "Checkout | Mytekkstore"],
  ["order", "order", "Order | Mytekkstore"], ["account", "account", "My account | Mytekkstore"], ["page", "page", "Mytekkstore"],
  ["admin", "admin", "Store admin | Mytekkstore"], ["404", "notfound", "Page not found | Mytekkstore"],
  ["campaign", "campaign", "Campaign | Mytekkstore"], ["compare", "compare", "Compare | Mytekkstore"],
];
const shell = (page, title) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="icon" href="/favicon.svg">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#08805f">${page === "home" ? '\n<link rel="preload" as="image" href="/img/hero-a.webp" imagesrcset="/img/hero-a-480.webp 480w, /img/hero-a-960.webp 960w, /img/hero-a.webp 1376w" imagesizes="100vw" fetchpriority="high">' : ""}
</head>
<body data-page="${page}">
<div id="root"></div>
<script type="speculationrules">{"prerender":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":["/cart","/checkout","/account*","/order*","/admin*","/api/*","/products?*wish=*"]}}]},"eagerness":"moderate"}]}</script>
<script type="module" src="/src/main.jsx"></script>
</body>
</html>
`;
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const here = fileURLToPath(new URL(".", import.meta.url));
  for (const [file, page, title] of PAGES) writeFileSync(here + file + ".html", shell(page, title));
  console.log("shells written:", PAGES.length);
}
