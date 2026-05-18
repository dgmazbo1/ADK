const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const shopify = require("./lib/shopify-storefront");

const root = __dirname;
const port = Number(process.env.PORT || 4173);

// Auth + publish
const adminUsername = process.env.ADK_ADMIN_USER;
const adminPassword = process.env.ADK_ADMIN_PASSWORD;
const adminSessionSecret = process.env.ADK_ADMIN_SESSION_SECRET;
const githubToken = process.env.ADK_GITHUB_TOKEN;
const githubOwner = process.env.ADK_GITHUB_OWNER || "dgmazbo1";
const githubRepo = process.env.ADK_GITHUB_REPO || "ADK";
const githubWorkflow = process.env.ADK_GITHUB_PUBLISH_WORKFLOW || "adk-publish.yml";
const githubBranch = process.env.ADK_GITHUB_BRANCH || "main";

// Storefront
const shopifyDomain = process.env.SHOPIFY_DOMAIN || "";
const shopifyStorefrontToken = process.env.SHOPIFY_STOREFRONT_TOKEN || "";
const shopifyApiVersion = process.env.SHOPIFY_API_VERSION || shopify.DEFAULT_API_VERSION;

// Submissions backend (optional)
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// GHL forwarding (optional)
const ghlBuildWebhook = process.env.GHL_BUILD_REQUEST_WEBHOOK || "";
const ghlQuoteWebhook = process.env.GHL_QUOTE_REQUEST_WEBHOOK || "";

const sessionCookieName = "adk_admin_session";
const sessionDurationMs = 1000 * 60 * 60 * 12;

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const CONTENT_TYPES = new Set(["gallery", "shop-notes", "settings", "products"]);
const SUBMISSION_TYPES = new Set(["build-requests", "quote-requests"]);

// In-memory fallback for submissions when Supabase is not configured.
const memorySubmissions = { "build-requests": [], "quote-requests": [] };

/* ---------- Auth helpers ---------- */

function safeCompare(left = "", right = "") {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, pair) => {
    const index = pair.indexOf("=");
    if (index === -1) return cookies;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", adminSessionSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifySessionCookie(cookieValue) {
  if (!adminSessionSecret || !cookieValue || !cookieValue.includes(".")) return false;
  const [body, signature] = cookieValue.split(".");
  const expected = crypto.createHmac("sha256", adminSessionSecret).update(body).digest("base64url");
  if (!safeCompare(signature, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.user === adminUsername && Number(payload.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

function isAdminAuthenticated(request) {
  const cookies = parseCookies(request.headers.cookie || "");
  return verifySessionCookie(cookies[sessionCookieName]);
}

function cookieOptions(request, maxAgeSeconds) {
  const isSecure = request.headers["x-forwarded-proto"] === "https" || request.headers.host?.includes("railway.app");
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
    isSecure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

function sendJson(response, statusCode, data, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...baseSecurityHeaders(),
    ...headers,
  });
  response.end(JSON.stringify(data));
}

function sendHtml(response, statusCode, html, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=120",
    ...headers,
  });
  response.end(html);
}

function baseSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), payment=()",
  };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function readJsonBody(request) {
  const raw = await readRequestBody(request);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function publicOrigin(request) {
  const proto = request.headers["x-forwarded-proto"] || "https";
  return `${proto}://${request.headers.host}`;
}

function localProductByHandle(handle) {
  const products = shopify.localProducts(root);
  const mapPath = path.join(root, "data", "product-handle-map.json");
  let mapped = handle;
  try {
    const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    const legacy = Object.entries(map).find(([, shopifyHandle]) => shopifyHandle === handle);
    mapped = legacy?.[0] || handle;
  } catch {}
  return products.find((product) => product.slug === handle || product.slug === mapped || product.id === mapped) || null;
}

function normalizeLocalProduct(product) {
  if (!product) return null;
  return {
    ...product,
    handle: product.slug,
    title: product.name,
    source: "local-fallback",
    availableForSale: !product.requestPricing && typeof product.price === "number" && Number(product.inventory || 0) > 0,
    currency: "USD",
    variants: product.requestPricing || typeof product.price !== "number" ? [] : [{
      id: `local-${product.id}`,
      title: "Default",
      availableForSale: Number(product.inventory || 0) > 0,
      quantityAvailable: product.inventory,
      price: { amount: product.price, currencyCode: "USD" },
      selectedOptions: [],
    }],
  };
}

function productJsonLd(product, request) {
  const url = `${publicOrigin(request)}/store/${product.handle || product.slug}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title || product.name,
    image: product.images || [],
    description: product.description || product.shortDescription || "",
    brand: { "@type": "Brand", name: "After Dark Kreations" },
    manufacturer: { "@type": "Organization", name: "After Dark Kreations" },
    url,
  };
  if (!product.requestPricing && typeof product.price === "number") {
    schema.offers = {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency || "USD",
      availability: product.availableForSale === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url,
    };
  }
  return JSON.stringify(schema);
}

function renderStoreProductPage(product, request) {
  const title = product?.seo?.title || `${product?.title || product?.name || "ADK Product"} | ADK Store`;
  const description = product?.seo?.description || product?.shortDescription || "ADK-built fabricated parts and truck components from Henderson, Nevada.";
  const image = product?.images?.[0] || "";
  const handle = product?.handle || product?.slug || "";
  const dataScript = product ? `<script>window.ADK_PRODUCTS = ${JSON.stringify([product]).replace(/</g, "\\u003c")};</script>` : "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(`${publicOrigin(request)}/store/${handle}`)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css?v=20260517-capabilities-material-images-1" />
    ${product ? `<script type="application/ld+json">${productJsonLd(product, request)}</script>` : ""}
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="top-system" aria-label="After Dark Kreations banners"><div class="patriot-scroll" aria-label="Proudly made in America banner"><div class="patriot-scroll__track"><span>Proudly Made in America</span><span>Proudly Made in America</span><span>Proudly Made in America</span><span>Proudly Made in America</span><span>Proudly Made in America</span><span>Proudly Made in America</span><span>Proudly Made in America</span><span>Proudly Made in America</span><span>Proudly Made in America</span><span>Proudly Made in America</span></div></div><div class="origin-line"><a href="tel:+17028109021">(702) 810-9021</a><a href="mailto:Rudy@AfterDarkKreations.com">Rudy@AfterDarkKreations.com</a><a href="https://www.google.com/maps/place/2053+Pabco+Rd,+Henderson,+NV+89011" target="_blank" rel="noopener noreferrer">2053 Pabco Rd, Henderson, NV 89011</a></div></div>
    <header class="site-header adk-navbar" data-site-header>
      <div class="adk-navbar__left">
        <button class="menu-toggle adk-mobile-trigger" type="button" aria-expanded="false" aria-controls="primary-navigation"><span></span><span></span><span class="visually-hidden">Toggle menu</span></button>
        <a class="brand adk-navbar__brand" href="/" aria-label="After Dark Kreations home"><img src="https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/adk-logo-badge_452696c8.png" alt="After Dark Kreations ADK logo" /><span>After Dark Kreations</span></a>
      </div>
      <nav class="site-nav adk-navbar__nav" id="primary-navigation" aria-label="Primary navigation">
        <a class="nav-link adk-desktop-home" href="/">Home</a>
        <div class="adk-mobile-menu__group"><p>Menu</p><a class="nav-link" href="/">Home</a><a class="nav-link" href="/build-request">Build Request</a><a class="nav-link" href="/contact">Contact</a></div>
        <div class="nav-dropdown-group adk-nav-cluster" data-nav-dropdown><button class="nav-trigger" type="button" aria-expanded="false" aria-controls="nav-capabilities-panel">Capabilities</button><div class="nav-dropdown adk-mega-menu adk-mega-menu--capabilities" id="nav-capabilities-panel"><div class="adk-mega-menu__column"><h3>Welding + Fabrication</h3><a href="/capabilities"><span>TIG Welding</span><small>Controlled welds for stainless, aluminum, titanium, magnesium, and specialty components.</small></a><a href="/capabilities"><span>Custom Fabrication</span><small>One-off metalwork, mounts, brackets, structural pieces, and repair solutions.</small></a></div><div class="adk-mega-menu__column"><h3>Engineering Support</h3><a href="/capabilities"><span>CAD + Prototyping</span><small>Measure, model, mock up, and refine before the first cut.</small></a><a href="/capabilities"><span>Laser Cutting</span><small>Repeatable parts, tabs, brackets, panels, and production-ready components.</small></a></div><div class="adk-mega-menu__column"><h3>Truck + Trailer</h3><a href="/capabilities"><span>Trailer Repair</span><small>Frames, hitches, cross members, reinforcement, and structural welding.</small></a><a href="/capabilities"><span>Air Ride + Hydraulics</span><small>Suspension support, routing, mounts, and fitment-focused fabrication.</small></a></div></div></div>
        <div class="nav-dropdown-group adk-nav-cluster" data-nav-dropdown><button class="nav-trigger" type="button" aria-expanded="false" aria-controls="nav-store-panel">Store</button><div class="nav-dropdown adk-mega-menu adk-mega-menu--store" id="nav-store-panel"><div class="adk-mega-menu__column"><h3>Air Ride Systems</h3><a href="/store"><span>ADK Store</span><small>Shop air ride systems, mounts, tanks, trailer components, and custom parts.</small></a><a href="/store/peterbilt-389-rear-air-ride-kit"><span>Peterbilt Air Ride</span><small>389 rear air ride, front air leaf, full systems, and Gen III kits.</small></a></div><div class="adk-mega-menu__column"><h3>Fabricated Parts</h3><a href="/store/custom-mounts-and-brackets"><span>Mounts + Brackets</span><small>Mounting hardware built around real install points and project constraints.</small></a><a href="/store/tank-and-cooling-products"><span>Tanks + Cooling</span><small>Fabricated tanks, reservoirs, and cooling support products.</small></a></div><div class="adk-mega-menu__column"><h3>Project Work</h3><a href="/store/overland-5-gallon-propane-tank-mount"><span>Overland Parts</span><small>Field-ready mounts and accessories for practical use.</small></a><a href="/store/one-off-fabricated-parts"><span>One-Off Fabrication</span><small>CAD-to-metal help when the part does not exist yet.</small></a></div></div></div>
        <div class="nav-dropdown-group adk-nav-cluster" data-nav-dropdown><button class="nav-trigger" type="button" aria-expanded="false" aria-controls="nav-resources-panel">Resources</button><div class="nav-dropdown adk-mega-menu adk-mega-menu--resources" id="nav-resources-panel"><div class="adk-mega-menu__column"><h3>Shop Work</h3><a href="/shop-work"><span>Gallery</span><small>Weld detail, CAD-to-metal projects, trailer repair, air ride, and finished parts.</small></a><a href="/blog"><span>Shop Notes</span><small>Technical articles rewritten for fabrication buyers, search, and AI discovery.</small></a></div><div class="adk-mega-menu__column"><h3>Company</h3><a href="/about"><span>About ADK</span><small>Henderson, Nevada fabrication shop built around real metalwork.</small></a><a href="/contact"><span>Contact</span><small>Call, map the shop, or submit project details to ADK.</small></a></div></div></div>
        <a class="nav-link" href="/build-request">Build Request</a>
        <a class="nav-link" href="/about">About</a>
      </nav>
      <div class="header-contact adk-navbar__actions"><a class="adk-navbar__phone" href="tel:+17028109021">(702) 810-9021</a><a class="cart-link" href="/cart" aria-label="Open cart"><span data-cart-count>0</span> Cart</a><a class="small-button" href="/build-request">Request a Build</a></div>
    </header>
    <main id="main">
      <section class="section product-detail" data-product-detail data-product-slug="${escapeHtml(handle)}" aria-labelledby="product-title">
        <div class="product-detail__media"><figure><img data-detail-image src="${escapeHtml(image)}" alt="${escapeHtml(product?.title || product?.name || "ADK product")}" loading="lazy" /></figure><div class="product-detail__thumbs" data-detail-thumbs></div></div>
        <div class="product-detail__copy">
          <p class="eyebrow" data-detail-category>${escapeHtml(product?.category || "ADK Store")}</p>
          <h1 id="product-title" data-detail-name>${escapeHtml(product?.title || product?.name || "Product Not Found")}</h1>
          <p data-detail-description>${escapeHtml(product?.description || "This ADK product could not be loaded. Return to the store or request pricing.")}</p>
          <div class="product-detail__price" data-detail-price>${product?.requestPricing ? "Request Pricing" : product?.price ? `$${Number(product.price).toLocaleString()}` : "Request Pricing"}</div>
          <div class="product-detail__chips"><span data-detail-status>${escapeHtml(product?.status || "Review Required")}</span><span data-detail-fitment>${escapeHtml(product?.fitment || "Application review")}</span><span data-detail-material>${escapeHtml(product?.material || "ADK fabricated")}</span></div>
          <div data-variant-wrap class="variant-selector"></div>
          <dl class="spec-fields detail-specs"><div><dt>Fitment</dt><dd data-detail-fitment-text>${escapeHtml(product?.fitment || "Application review")}</dd></div><div><dt>Material</dt><dd data-detail-material-text>${escapeHtml(product?.material || "ADK fabricated")}</dd></div><div><dt>Lead Time</dt><dd data-detail-lead>${escapeHtml(product?.leadTime || "Confirmed after review")}</dd></div><div><dt>Shipping / Pickup</dt><dd data-detail-shipping>${escapeHtml(product?.shippingNotes || "Secure checkout powered by Shopify. Pickup can be arranged by ADK.")}</dd></div></dl>
          <div class="product-detail__notes"><h2>Build Notes</h2><p data-detail-notes>${escapeHtml(product?.buildNotes || "")}</p><ul data-detail-specs></ul></div>
          <div class="product-detail__actions"><label class="quantity-control">Qty<input type="number" min="1" value="1" data-detail-qty /></label><button class="button line-button" type="button" data-detail-primary data-product-id="${escapeHtml(product?.id || "")}">${product?.requestPricing ? "Request Pricing" : "Add To Cart"}</button><button class="button line-button" type="button" data-buy-now>Buy Now</button></div>
        </div>
      </section>
      <section class="section related-products" aria-labelledby="related-title"><div class="section-heading reveal"><p class="eyebrow">Related Products</p><h2 id="related-title">More From The ADK Store</h2></div><div class="store-grid store-grid--compact" data-related-products></div></section>
    </main>
    <footer class="site-footer footer-seven" id="footer"><div class="footer-seven__container"><div class="footer-seven__top"><div class="footer-seven__brand"><div class="footer-seven__logo-row"><a href="/"><img src="https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/adk-logo-badge_452696c8.png" alt="After Dark Kreations ADK logo" /></a><h2>After Dark Kreations</h2></div><p>American-made welding, CAD-supported fabrication, truck parts, trailer repair, air ride, hydraulics, overland accessories, and one-off metalwork built in Henderson, Nevada.</p></div><div class="footer-seven__sections"><div><h3>Contact</h3><ul><li><a href="tel:+17028109021">(702) 810-9021</a></li><li><a href="mailto:Rudy@AfterDarkKreations.com">Rudy@AfterDarkKreations.com</a></li><li><a href="https://www.google.com/maps/place/2053+Pabco+Rd,+Henderson,+NV+89011">2053 Pabco Rd, Henderson, NV 89011</a></li></ul></div><div><h3>Store</h3><ul><li><a href="/store">ADK Store</a></li><li><a href="/cart">Cart</a></li><li><a href="/build-request">Request Quote</a></li></ul></div></div></div><div class="footer-seven__bottom"><p>© 2026 After Dark Kreations / ADK. Proudly Made in America.</p></div></div></footer>
    ${dataScript}
    <script src="/lib/shopify.js?v=20260517-capabilities-material-images-1" defer></script>
    <script src="/script.js?v=20260517-capabilities-material-images-1" defer></script>
  </body>
</html>`;
}

/* ---------- GitHub publish + content commit ---------- */

async function publishSite() {
  if (!githubToken) {
    throw new Error("ADK_GITHUB_TOKEN is not configured.");
  }

  const workflowDispatchUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/actions/workflows/${githubWorkflow}/dispatches`;
  const response = await fetch(workflowDispatchUrl, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${githubToken}`,
      "Content-Type": "application/json",
      "User-Agent": "adk-admin-publisher",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: githubBranch,
      inputs: {
        requested_by: adminUsername || "adk-admin",
        source: "adk-admin-panel",
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub workflow dispatch failed with ${response.status}: ${detail}`);
  }

  return [
    {
      name: "GitHub publish workflow",
      ok: true,
      output: `Workflow ${githubWorkflow} queued on ${githubOwner}/${githubRepo}. It will create a publish commit and deploy Railway from GitHub Actions.`,
    },
  ];
}

async function commitContentToGithub(filePath, jsonObject, message) {
  if (!githubToken) {
    throw new Error("ADK_GITHUB_TOKEN is not configured. Cannot persist content changes.");
  }

  const contentsUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${filePath}`;
  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${githubToken}`,
    "Content-Type": "application/json",
    "User-Agent": "adk-admin-publisher",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Get current SHA (required for updates)
  let sha = null;
  const getResponse = await fetch(`${contentsUrl}?ref=${githubBranch}`, { headers });
  if (getResponse.ok) {
    const existing = await getResponse.json();
    sha = existing.sha;
  } else if (getResponse.status !== 404) {
    const detail = await getResponse.text();
    throw new Error(`GitHub read failed (${getResponse.status}): ${detail}`);
  }

  const content = Buffer.from(JSON.stringify(jsonObject, null, 2) + "\n", "utf8").toString("base64");
  const putResponse = await fetch(contentsUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message,
      content,
      branch: githubBranch,
      sha: sha || undefined,
      committer: { name: "ADK Admin", email: "actions@github.com" },
    }),
  });

  if (!putResponse.ok) {
    const detail = await putResponse.text();
    throw new Error(`GitHub write failed (${putResponse.status}): ${detail}`);
  }

  // Mirror to local disk so subsequent reads on this Railway instance reflect the change immediately.
  try {
    fs.writeFileSync(path.join(root, filePath), JSON.stringify(jsonObject, null, 2) + "\n");
  } catch (error) {
    console.warn("Local mirror write failed (non-fatal):", error.message);
  }

  return await putResponse.json();
}

/* ---------- Content (managed JSON) ---------- */

function readContentFile(type) {
  const filePath = path.join(root, "data", `${type}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Failed to read ${type}.json:`, error.message);
    return null;
  }
}

async function writeContentFile(type, payload, requestedBy) {
  const enriched = { ...payload, updatedAt: new Date().toISOString() };
  const message = `Admin: update ${type} (${requestedBy || "adk-admin"})`;
  await commitContentToGithub(`data/${type}.json`, enriched, message);
  return enriched;
}

/* ---------- Supabase submissions ---------- */

function supabaseConfigured() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

function supabaseTable(type) {
  return type === "build-requests" ? "adk_build_requests" : "adk_quote_requests";
}

async function supabaseRequest(method, pathname, body, query = "") {
  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${pathname}${query}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseServiceKey,
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "Prefer": "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${method} ${pathname} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

async function listSubmissions(type) {
  if (supabaseConfigured()) {
    const rows = await supabaseRequest("GET", supabaseTable(type), null, "?select=*&order=created_at.desc&limit=200");
    return Array.isArray(rows) ? rows : [];
  }
  return [...(memorySubmissions[type] || [])].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

async function createSubmission(type, record) {
  const enriched = {
    id: record.id || crypto.randomUUID(),
    created_at: record.created_at || new Date().toISOString(),
    status: record.status || "new",
    ...record,
  };

  if (supabaseConfigured()) {
    const result = await supabaseRequest("POST", supabaseTable(type), enriched);
    return Array.isArray(result) ? result[0] : enriched;
  }

  memorySubmissions[type] = memorySubmissions[type] || [];
  memorySubmissions[type].push(enriched);
  return enriched;
}

async function patchSubmission(type, id, patch) {
  const safePatch = { ...patch };
  delete safePatch.id;
  delete safePatch.created_at;

  if (supabaseConfigured()) {
    const result = await supabaseRequest(
      "PATCH",
      supabaseTable(type),
      safePatch,
      `?id=eq.${encodeURIComponent(id)}`
    );
    return Array.isArray(result) ? result[0] : null;
  }

  const list = memorySubmissions[type] || [];
  const idx = list.findIndex((row) => row.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...safePatch };
  return list[idx];
}

async function forwardToGhl(webhookUrl, record) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  } catch (error) {
    console.warn("GHL forward failed (non-fatal):", error.message);
  }
}

/* ---------- Server ---------- */

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const method = request.method || "GET";

  try {
    /* ----- Auth-shape endpoints ----- */
    if (pathname === "/api/admin/session") {
      sendJson(response, 200, { authenticated: isAdminAuthenticated(request) });
      return;
    }

    if (pathname === "/api/admin/logout" && method === "POST") {
      sendJson(response, 200, { ok: true }, {
        "Set-Cookie": `${sessionCookieName}=; ${cookieOptions(request, 0)}`,
      });
      return;
    }

    if (pathname === "/api/admin/login" && method === "POST") {
      const body = await readRequestBody(request);
      if (!adminUsername || !adminPassword || !adminSessionSecret) {
        sendJson(response, 503, { ok: false, message: "Admin login is not configured." });
        return;
      }
      const contentType = request.headers["content-type"] || "";
      const credentials = contentType.includes("application/json")
        ? JSON.parse(body || "{}")
        : Object.fromEntries(new URLSearchParams(body));
      const user = String(credentials.username || credentials.email || "");
      const password = String(credentials.password || "");
      if (!safeCompare(user, adminUsername) || !safeCompare(password, adminPassword)) {
        sendJson(response, 401, { ok: false, message: "Invalid admin username or password." });
        return;
      }
      const token = signSession({ user: adminUsername, expiresAt: Date.now() + sessionDurationMs });
      sendJson(response, 200, { ok: true }, {
        "Set-Cookie": `${sessionCookieName}=${encodeURIComponent(token)}; ${cookieOptions(request, sessionDurationMs / 1000)}`,
      });
      return;
    }

    if (pathname === "/api/admin/publish" && method === "POST") {
      if (!isAdminAuthenticated(request)) { sendJson(response, 401, { ok: false, message: "Admin authentication required." }); return; }
      try {
        const steps = await publishSite();
        sendJson(response, 200, {
          ok: true,
          message: "Publish workflow queued.",
          workflowUrl: `https://github.com/${githubOwner}/${githubRepo}/actions/workflows/${githubWorkflow}`,
          steps,
        });
      } catch (error) {
        sendJson(response, 500, { ok: false, message: "Publish failed.", output: error.message });
      }
      return;
    }

    /* ----- Content management ----- */
    const contentMatch = pathname.match(/^\/api\/admin\/content\/([a-z0-9-]+)$/);
    if (contentMatch) {
      const type = contentMatch[1];
      if (!CONTENT_TYPES.has(type)) { sendJson(response, 404, { ok: false, message: "Unknown content type." }); return; }
      if (!isAdminAuthenticated(request)) { sendJson(response, 401, { ok: false, message: "Admin authentication required." }); return; }

      if (method === "GET") {
        const data = readContentFile(type);
        sendJson(response, 200, { ok: true, type, data });
        return;
      }
      if (method === "PUT") {
        const payload = await readJsonBody(request);
        try {
          const saved = await writeContentFile(type, payload, adminUsername);
          sendJson(response, 200, { ok: true, type, data: saved });
        } catch (error) {
          sendJson(response, 500, { ok: false, message: error.message });
        }
        return;
      }
    }

    /* ----- Submissions admin ----- */
    const subListMatch = pathname.match(/^\/api\/admin\/submissions\/([a-z-]+)$/);
    if (subListMatch) {
      const type = subListMatch[1];
      if (!SUBMISSION_TYPES.has(type)) { sendJson(response, 404, { ok: false, message: "Unknown submission type." }); return; }
      if (!isAdminAuthenticated(request)) { sendJson(response, 401, { ok: false, message: "Admin authentication required." }); return; }
      if (method === "GET") {
        try {
          const rows = await listSubmissions(type);
          sendJson(response, 200, { ok: true, type, rows, backend: supabaseConfigured() ? "supabase" : "memory" });
        } catch (error) {
          sendJson(response, 500, { ok: false, message: error.message });
        }
        return;
      }
    }

    const subItemMatch = pathname.match(/^\/api\/admin\/submissions\/([a-z-]+)\/([a-zA-Z0-9-]+)$/);
    if (subItemMatch) {
      const type = subItemMatch[1];
      const id = subItemMatch[2];
      if (!SUBMISSION_TYPES.has(type)) { sendJson(response, 404, { ok: false, message: "Unknown submission type." }); return; }
      if (!isAdminAuthenticated(request)) { sendJson(response, 401, { ok: false, message: "Admin authentication required." }); return; }
      if (method === "PATCH") {
        const patch = await readJsonBody(request);
        try {
          const updated = await patchSubmission(type, id, patch);
          if (!updated) { sendJson(response, 404, { ok: false, message: "Submission not found." }); return; }
          sendJson(response, 200, { ok: true, row: updated });
        } catch (error) {
          sendJson(response, 500, { ok: false, message: error.message });
        }
        return;
      }
    }

    /* ----- Public form intake ----- */
    if (pathname === "/api/public/build-request" && method === "POST") {
      const body = await readJsonBody(request);
      const record = {
        type: "build-request",
        status: "new",
        contact_name: String(body.contact_name || body.name || "").slice(0, 200),
        contact_email: String(body.contact_email || body.email || "").slice(0, 200),
        contact_phone: String(body.contact_phone || body.phone || "").slice(0, 60),
        vehicle: String(body.vehicle || "").slice(0, 200),
        scope: String(body.scope || body.project || "").slice(0, 4000),
        budget: String(body.budget || "").slice(0, 80),
        timeline: String(body.timeline || "").slice(0, 200),
        attachments: Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [],
        source: String(body.source || "site").slice(0, 80),
      };
      try {
        const saved = await createSubmission("build-requests", record);
        forwardToGhl(ghlBuildWebhook, saved);
        sendJson(response, 201, { ok: true, id: saved.id });
      } catch (error) {
        sendJson(response, 500, { ok: false, message: error.message });
      }
      return;
    }

    if (pathname === "/api/public/quote-request" && method === "POST") {
      const body = await readJsonBody(request);
      const record = {
        type: "quote-request",
        status: "new",
        contact_name: String(body.contact_name || body.name || "").slice(0, 200),
        contact_email: String(body.contact_email || body.email || "").slice(0, 200),
        contact_phone: String(body.contact_phone || body.phone || "").slice(0, 60),
        product_id: String(body.product_id || "").slice(0, 120),
        product_name: String(body.product_name || "").slice(0, 200),
        product_handle: String(body.product_handle || "").slice(0, 200),
        product_url: String(body.product_url || "").slice(0, 500),
        selected_variant: String(body.selected_variant || "").slice(0, 240),
        vehicle: String(body.vehicle || "").slice(0, 200),
        timeline: String(body.timeline || "").slice(0, 200),
        budget: String(body.budget || "").slice(0, 80),
        attachments: Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [],
        message: String(body.message || "").slice(0, 4000),
        source: String(body.source || "site").slice(0, 80),
      };
      try {
        const saved = await createSubmission("quote-requests", record);
        forwardToGhl(ghlQuoteWebhook, saved);
        sendJson(response, 201, { ok: true, id: saved.id });
      } catch (error) {
        sendJson(response, 500, { ok: false, message: error.message });
      }
      return;
    }

    /* ----- Shopify Storefront proxy (public commerce, no Admin API exposure) ----- */
    if (pathname === "/api/public/products" && method === "GET") {
      const usingShopify = shopify.configured();
      try {
        const products = usingShopify
          ? await shopify.listProducts({
              first: Math.min(Number(requestUrl.searchParams.get("first") || 50), 100),
              query: requestUrl.searchParams.get("q") || "",
              sort: requestUrl.searchParams.get("sort") || "Featured",
            })
          : shopify.localProducts(root).map(normalizeLocalProduct);
        sendJson(response, 200, {
          ok: true,
          mode: usingShopify ? "shopify" : "local-fallback",
          checkoutEnabled: usingShopify,
          products,
        });
      } catch (error) {
        const fallback = shopify.localProducts(root).map(normalizeLocalProduct);
        sendJson(response, 200, {
          ok: false,
          mode: "local-fallback",
          checkoutEnabled: false,
          message: "Shopify is unavailable. Showing quote-first fallback products.",
          products: fallback,
        });
      }
      return;
    }

    const productApiMatch = pathname.match(/^\/api\/public\/products\/([^/]+)$/);
    if (productApiMatch && method === "GET") {
      const handle = productApiMatch[1];
      const usingShopify = shopify.configured();
      try {
        const product = usingShopify
          ? await shopify.getProductByHandle(handle)
          : normalizeLocalProduct(localProductByHandle(handle));
        if (!product) { sendJson(response, 404, { ok: false, message: "Product not found." }); return; }
        sendJson(response, 200, { ok: true, mode: usingShopify ? "shopify" : "local-fallback", product });
      } catch (error) {
        const product = normalizeLocalProduct(localProductByHandle(handle));
        if (!product) { sendJson(response, 404, { ok: false, message: "Product not found." }); return; }
        sendJson(response, 200, { ok: false, mode: "local-fallback", message: "Shopify is unavailable. Showing local fallback.", product });
      }
      return;
    }

    if (pathname === "/api/public/cart" && method === "GET") {
      if (!shopify.configured()) { sendJson(response, 503, { ok: false, message: "Shopify checkout is not configured." }); return; }
      try {
        const cart = await shopify.getCart(requestUrl.searchParams.get("id"));
        sendJson(response, 200, { ok: true, cart });
      } catch (error) {
        sendJson(response, 410, { ok: false, message: "Cart expired or could not be loaded." });
      }
      return;
    }

    if (pathname === "/api/public/cart/add" && method === "POST") {
      if (!shopify.configured()) { sendJson(response, 503, { ok: false, message: "Shopify checkout is not configured. Submit a quote request instead." }); return; }
      const body = await readJsonBody(request);
      const merchandiseId = String(body.merchandiseId || body.variantId || "");
      const quantity = Math.max(1, Math.min(Number(body.quantity || 1), 99));
      if (!merchandiseId.startsWith("gid://shopify/ProductVariant/")) {
        sendJson(response, 400, { ok: false, message: "Select an available product variant before adding to cart." });
        return;
      }
      try {
        const line = { merchandiseId, quantity };
        const cart = body.cartId
          ? await shopify.addCartLines(String(body.cartId), [line])
          : await shopify.createCart([line]);
        sendJson(response, 200, { ok: true, cart });
      } catch (error) {
        sendJson(response, 400, { ok: false, message: error.message || "Add to cart failed." });
      }
      return;
    }

    if (pathname === "/api/public/cart/update" && method === "POST") {
      if (!shopify.configured()) { sendJson(response, 503, { ok: false, message: "Shopify checkout is not configured." }); return; }
      const body = await readJsonBody(request);
      const cartId = String(body.cartId || "");
      const lineId = String(body.lineId || "");
      const quantity = Math.max(0, Math.min(Number(body.quantity || 0), 99));
      if (!cartId || !lineId) { sendJson(response, 400, { ok: false, message: "Cart and line item are required." }); return; }
      try {
        const cart = quantity === 0
          ? await shopify.removeCartLines(cartId, [lineId])
          : await shopify.updateCartLines(cartId, [{ id: lineId, quantity }]);
        sendJson(response, 200, { ok: true, cart });
      } catch (error) {
        sendJson(response, 400, { ok: false, message: error.message || "Cart update failed." });
      }
      return;
    }

    if (pathname === "/api/public/cart/checkout" && method === "POST") {
      if (!shopify.configured()) { sendJson(response, 503, { ok: false, message: "Shopify checkout is not configured." }); return; }
      const body = await readJsonBody(request);
      try {
        const cart = await shopify.getCart(String(body.cartId || ""));
        if (!cart?.checkoutUrl) { sendJson(response, 404, { ok: false, message: "Checkout is unavailable for this cart." }); return; }
        sendJson(response, 200, { ok: true, checkoutUrl: cart.checkoutUrl });
      } catch {
        sendJson(response, 410, { ok: false, message: "Cart expired. Please rebuild the cart and try again." });
      }
      return;
    }

    /* ----- Public storefront config ----- */
    if (pathname === "/api/public/config" && method === "GET") {
      sendJson(response, 200, {
        ok: true,
        shopify: {
          configured: Boolean(shopifyDomain && shopifyStorefrontToken),
          domain: shopifyDomain || null,
          apiVersion: shopifyApiVersion,
          checkoutEnabled: Boolean(shopifyDomain && shopifyStorefrontToken),
        },
      });
      return;
    }

    if (pathname === "/api/admin/shopify/status" && method === "GET") {
      if (!isAdminAuthenticated(request)) { sendJson(response, 401, { ok: false, message: "Admin authentication required." }); return; }
      const status = {
        configured: Boolean(shopifyDomain && shopifyStorefrontToken),
        domain: shopifyDomain || null,
        apiVersion: shopifyApiVersion,
        checkoutEnabled: Boolean(shopifyDomain && shopifyStorefrontToken),
        fallbackLocalProducts: true,
        productCount: 0,
        lastFetchAt: null,
        mode: shopifyDomain && shopifyStorefrontToken ? "shopify" : "local-fallback",
        adminUrl: shopifyDomain ? `https://admin.shopify.com/store/${shopifyDomain.replace(".myshopify.com", "")}/products` : "https://admin.shopify.com",
      };
      try {
        const products = status.configured ? await shopify.listProducts({ first: 10 }) : shopify.localProducts(root);
        status.productCount = products.length;
        status.lastFetchAt = new Date().toISOString();
        status.storefrontApiStatus = status.configured ? "reachable" : "not-configured";
      } catch (error) {
        status.storefrontApiStatus = "error";
        status.error = error.message;
      }
      sendJson(response, 200, { ok: true, shopify: status });
      return;
    }

    /* ----- Admin route protection ----- */
    if (pathname.startsWith("/admin") && pathname !== "/admin/login" && pathname !== "/admin/login/") {
      if (!isAdminAuthenticated(request)) {
        response.writeHead(302, { Location: "/admin/login", "Cache-Control": "no-store" });
        response.end();
        return;
      }
    }

    if ((pathname === "/admin/login" || pathname === "/admin/login/") && isAdminAuthenticated(request)) {
      response.writeHead(302, { Location: "/admin", "Cache-Control": "no-store" });
      response.end();
      return;
    }

    const adminProductEditMatch = pathname.match(/^\/admin\/products\/([^/]+)\/?$/);
    if (adminProductEditMatch && method === "GET" && adminProductEditMatch[1] !== "new") {
      sendHtml(response, 200, `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Product ${escapeHtml(adminProductEditMatch[1])} | ADK Admin</title><meta name="robots" content="noindex,nofollow" /><link rel="stylesheet" href="/styles.css" /><link rel="stylesheet" href="/admin/assets/admin.css" /></head><body><div class="admin-shell"><header class="admin-topbar"><a class="admin-topbar__brand" href="/admin"><img src="https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/adk-logo-badge_452696c8.png" alt="ADK" /><span>ADK Admin</span></a><div class="admin-topbar__actions"><button class="admin-btn admin-btn--small admin-btn--ghost" type="button" data-admin-publish>Publish</button><button class="admin-btn admin-btn--small" type="button" data-admin-logout>Sign out</button></div></header><aside class="admin-sidebar" data-admin-sidebar><div class="admin-sidebar__group"><p class="admin-sidebar__label">Storefront</p><a class="admin-sidebar__link" href="/admin/products">Products</a><a class="admin-sidebar__link" href="https://admin.shopify.com" target="_blank" rel="noopener">Shopify Admin ↗</a></div></aside><main class="admin-main"><div class="admin-main__header"><div><p class="admin-eyebrow">Shopify Commerce</p><h1 class="admin-main__title">Edit Product In Shopify</h1><p class="admin-main__sub">ADK does not edit sellable product pricing, variants, inventory, or checkout data locally. Open Shopify to manage product ${escapeHtml(adminProductEditMatch[1])}.</p></div><a class="admin-btn admin-btn--ghost" href="https://admin.shopify.com" target="_blank" rel="noopener">Open Shopify ↗</a></div></main></div><script src="/admin/assets/admin.js"></script></body></html>`, baseSecurityHeaders());
      return;
    }

    const partsCategoryAliasMatch = pathname.match(/^\/parts\/category\/([^/]+)\/?$/);
    if (partsCategoryAliasMatch && method === "GET") {
      response.writeHead(301, { Location: `/store?category=${encodeURIComponent(partsCategoryAliasMatch[1])}`, ...baseSecurityHeaders() });
      response.end();
      return;
    }

    const partsAliasMatch = pathname.match(/^\/parts\/([^/]+)\/?$/);
    if (partsAliasMatch && method === "GET") {
      response.writeHead(301, { Location: `/store/${partsAliasMatch[1]}`, ...baseSecurityHeaders() });
      response.end();
      return;
    }

    /* ----- Dynamic Shopify product pages ----- */
    const dynamicStoreMatch = pathname.match(/^\/store\/([^/.]+)\/?$/);
    const storeCategoryMatch = pathname.match(/^\/store\/category\/([^/]+)\/?$/);
    if (storeCategoryMatch && method === "GET") {
      response.writeHead(301, { Location: `/store?category=${encodeURIComponent(storeCategoryMatch[1])}`, ...baseSecurityHeaders() });
      response.end();
      return;
    }

    if (dynamicStoreMatch && method === "GET") {
      const staticIndex = path.join(root, "store", dynamicStoreMatch[1], "index.html");
      if (!fs.existsSync(staticIndex) || shopify.configured()) {
        let product = null;
        try {
          product = shopify.configured()
            ? await shopify.getProductByHandle(dynamicStoreMatch[1])
            : normalizeLocalProduct(localProductByHandle(dynamicStoreMatch[1]));
        } catch {
          product = normalizeLocalProduct(localProductByHandle(dynamicStoreMatch[1]));
        }
        if (!product) { sendHtml(response, 404, renderStoreProductPage(null, request), baseSecurityHeaders()); return; }
        sendHtml(response, 200, renderStoreProductPage(product, request), baseSecurityHeaders());
        return;
      }
    }

    /* ----- Static files ----- */
    const cleanPathname = pathname === "/" ? "/index.html" : pathname;
    const rawFilePath = path.normalize(path.join(root, cleanPathname));
    if (!rawFilePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const candidates = path.extname(rawFilePath)
      ? [rawFilePath]
      : [path.join(rawFilePath, "index.html"), `${rawFilePath}.html`];
    const filePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!filePath) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) { response.writeHead(404); response.end("Not found"); return; }
      response.writeHead(200, {
        "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "public, max-age=300",
        ...baseSecurityHeaders(),
      });
      response.end(data);
    });
  } catch (error) {
    console.error("Server error:", error);
    sendJson(response, 500, { ok: false, message: "Internal server error." });
  }
});

server.listen(port, () => {
  console.log(`ADK website serving on port ${port}`);
  console.log(`Submissions backend: ${supabaseConfigured() ? "Supabase" : "in-memory (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for persistence)"}`);
  console.log(`Shopify storefront: ${shopifyDomain && shopifyStorefrontToken ? `configured (${shopifyDomain})` : "not configured (set SHOPIFY_DOMAIN + SHOPIFY_STOREFRONT_TOKEN)"}`);
});
