const fs = require("fs");
const path = require("path");

const DEFAULT_API_VERSION = "2025-01";
const QUOTE_TAGS = new Set(["request-pricing", "built-to-order-review", "quote-required"]);
const METAFIELDS = [
  "fitment",
  "material",
  "lead_time",
  "build_notes",
  "specifications",
  "request_pricing",
  "requires_fitment_review",
  "made_to_order",
  "installation_required",
  "shipping_notes",
  "vehicle_application",
];

function configured(env = process.env) {
  return Boolean(env.SHOPIFY_DOMAIN && env.SHOPIFY_STOREFRONT_TOKEN);
}

function domainFromEnv(env = process.env) {
  return String(env.SHOPIFY_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function apiVersion(env = process.env) {
  return env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION;
}

async function storefrontQuery(query, variables = {}, env = process.env) {
  const domain = domainFromEnv(env);
  const token = env.SHOPIFY_STOREFRONT_TOKEN;
  if (!domain || !token) throw new Error("Shopify is not configured.");

  const response = await fetch(`https://${domain}/api/${apiVersion(env)}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Shopify Storefront API returned ${response.status}.`);
  if (payload?.errors?.length) throw new Error(payload.errors.map((error) => error.message).join(", "));
  return payload?.data || {};
}

function metafieldMap(node) {
  const map = {};
  (node.metafields || []).forEach((field) => {
    if (!field) return;
    map[field.key] = field.value;
  });
  return map;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "1";
}

function parseSpecs(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return String(value).split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function money(value) {
  if (!value) return null;
  return { amount: Number(value.amount), currencyCode: value.currencyCode || "USD" };
}

function normalizeProduct(node) {
  const fields = metafieldMap(node);
  const variants = (node.variants?.edges || []).map(({ node: variant }) => ({
    id: variant.id,
    title: variant.title,
    availableForSale: Boolean(variant.availableForSale),
    quantityAvailable: variant.quantityAvailable,
    price: money(variant.price),
    compareAtPrice: money(variant.compareAtPrice),
    selectedOptions: variant.selectedOptions || [],
  }));
  const firstVariant = variants[0] || null;
  const availableVariant = variants.find((variant) => variant.availableForSale) || firstVariant;
  const tags = node.tags || [];
  const requestPricing =
    parseBoolean(fields.request_pricing) ||
    !node.availableForSale ||
    !availableVariant?.price?.amount ||
    tags.some((tag) => QUOTE_TAGS.has(String(tag).toLowerCase()));
  const imageEdges = node.images?.edges || [];
  const images = imageEdges.map(({ node: image }) => ({
    url: image.url,
    altText: image.altText || node.title,
    width: image.width,
    height: image.height,
  }));
  const primaryPrice = availableVariant?.price || money(node.priceRange?.minVariantPrice);
  const compareAtPrice = availableVariant?.compareAtPrice || null;

  return {
    id: node.id,
    shopifyId: node.id,
    handle: node.handle,
    slug: node.handle,
    name: node.title,
    title: node.title,
    vendor: node.vendor || "After Dark Kreations",
    category: node.productType || "ADK Parts",
    productType: node.productType || "",
    tags,
    shortDescription: (node.description || "").replace(/\s+/g, " ").slice(0, 170),
    description: node.description || "",
    descriptionHtml: node.descriptionHtml || "",
    images: images.map((image) => image.url),
    imageData: images,
    image: images[0]?.url || node.featuredImage?.url || "",
    alt: images[0]?.altText || node.featuredImage?.altText || node.title,
    price: requestPricing ? null : primaryPrice?.amount ?? null,
    compareAtPrice: compareAtPrice?.amount ?? null,
    currency: primaryPrice?.currencyCode || "USD",
    availableForSale: Boolean(node.availableForSale),
    requestPricing,
    status: requestPricing ? "Request Pricing" : node.availableForSale ? "In Stock" : "Unavailable",
    inventory: availableVariant?.quantityAvailable ?? null,
    variantId: availableVariant?.id || null,
    variants,
    fitment: fields.fitment || fields.vehicle_application || "",
    material: fields.material || "",
    leadTime: fields.lead_time || "",
    buildNotes: fields.build_notes || "",
    specifications: parseSpecs(fields.specifications),
    requiresFitmentReview: parseBoolean(fields.requires_fitment_review),
    madeToOrder: parseBoolean(fields.made_to_order),
    installationRequired: parseBoolean(fields.installation_required),
    shippingNotes: fields.shipping_notes || "",
    vehicleApplication: fields.vehicle_application || "",
    seo: {
      title: node.seo?.title || node.title,
      description: node.seo?.description || (node.description || "").replace(/\s+/g, " ").slice(0, 155),
    },
    featured: tags.map((tag) => String(tag).toLowerCase()).includes("featured"),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    source: "shopify",
  };
}

const productFragment = `
  fragment ProductFields on Product {
    id
    handle
    title
    vendor
    productType
    description
    descriptionHtml
    availableForSale
    tags
    createdAt
    updatedAt
    seo { title description }
    featuredImage { url altText width height }
    images(first: 10) { edges { node { url altText width height } } }
    priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
    metafields(identifiers: [
      { namespace: "custom", key: "fitment" },
      { namespace: "custom", key: "material" },
      { namespace: "custom", key: "lead_time" },
      { namespace: "custom", key: "build_notes" },
      { namespace: "custom", key: "specifications" },
      { namespace: "custom", key: "request_pricing" },
      { namespace: "custom", key: "requires_fitment_review" },
      { namespace: "custom", key: "made_to_order" },
      { namespace: "custom", key: "installation_required" },
      { namespace: "custom", key: "shipping_notes" },
      { namespace: "custom", key: "vehicle_application" }
    ]) { key value type }
    variants(first: 50) {
      edges { node {
        id
        title
        availableForSale
        quantityAvailable
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        selectedOptions { name value }
      } }
    }
  }
`;

async function listProducts({ first = 50, query = "", sort = "Featured" } = {}, env = process.env) {
  const sortMap = {
    Featured: "RELEVANCE",
    Newest: "CREATED_AT",
    "Price: Low to High": "PRICE",
    "Price: High to Low": "PRICE",
    Availability: "TITLE",
  };
  const data = await storefrontQuery(`
    ${productFragment}
    query Products($first: Int!, $query: String, $sortKey: ProductSortKeys!, $reverse: Boolean!) {
      products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse) {
        edges { node { ...ProductFields } }
      }
    }
  `, {
    first,
    query: query || null,
    sortKey: sortMap[sort] || "RELEVANCE",
    reverse: sort === "Newest" || sort === "Price: High to Low",
  }, env);
  return (data.products?.edges || []).map(({ node }) => normalizeProduct(node));
}

async function getProductByHandle(handle, env = process.env) {
  const data = await storefrontQuery(`
    ${productFragment}
    query ProductByHandle($handle: String!) {
      product(handle: $handle) { ...ProductFields }
    }
  `, { handle }, env);
  return data.product ? normalizeProduct(data.product) : null;
}

function normalizeCart(cart) {
  if (!cart) return null;
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity || 0,
    subtotal: money(cart.cost?.subtotalAmount),
    total: money(cart.cost?.totalAmount),
    lines: (cart.lines?.edges || []).map(({ node }) => ({
      id: node.id,
      quantity: node.quantity,
      title: node.merchandise?.product?.title || "ADK product",
      handle: node.merchandise?.product?.handle || "",
      variantTitle: node.merchandise?.title || "",
      variantId: node.merchandise?.id || "",
      price: money(node.merchandise?.price),
      image: node.merchandise?.product?.featuredImage?.url || "",
      alt: node.merchandise?.product?.featuredImage?.altText || node.merchandise?.product?.title || "",
    })),
    source: "shopify",
  };
}

const cartFields = `
  id
  checkoutUrl
  totalQuantity
  cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
  lines(first: 50) {
    edges { node {
      id
      quantity
      merchandise {
        ... on ProductVariant {
          id
          title
          price { amount currencyCode }
          product { title handle featuredImage { url altText } }
        }
      }
    } }
  }
`;

async function getCart(cartId, env = process.env) {
  if (!cartId) return null;
  const data = await storefrontQuery(`
    query Cart($id: ID!) { cart(id: $id) { ${cartFields} } }
  `, { id: cartId }, env);
  return normalizeCart(data.cart);
}

async function createCart(lines, env = process.env) {
  const data = await storefrontQuery(`
    mutation CartCreate($lines: [CartLineInput!]) {
      cartCreate(input: { lines: $lines }) {
        cart { ${cartFields} }
        userErrors { field message }
      }
    }
  `, { lines }, env);
  const errors = data.cartCreate?.userErrors || [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join(", "));
  return normalizeCart(data.cartCreate?.cart);
}

async function addCartLines(cartId, lines, env = process.env) {
  const data = await storefrontQuery(`
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ${cartFields} }
        userErrors { field message }
      }
    }
  `, { cartId, lines }, env);
  const errors = data.cartLinesAdd?.userErrors || [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join(", "));
  return normalizeCart(data.cartLinesAdd?.cart);
}

async function updateCartLines(cartId, lines, env = process.env) {
  const data = await storefrontQuery(`
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ${cartFields} }
        userErrors { field message }
      }
    }
  `, { cartId, lines }, env);
  const errors = data.cartLinesUpdate?.userErrors || [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join(", "));
  return normalizeCart(data.cartLinesUpdate?.cart);
}

async function removeCartLines(cartId, lineIds, env = process.env) {
  const data = await storefrontQuery(`
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ${cartFields} }
        userErrors { field message }
      }
    }
  `, { cartId, lineIds }, env);
  const errors = data.cartLinesRemove?.userErrors || [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join(", "));
  return normalizeCart(data.cartLinesRemove?.cart);
}

function localProducts(root) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(root, "data", "products.json"), "utf8"));
    return Array.isArray(data) ? data : data.products || [];
  } catch {
    return [];
  }
}

module.exports = {
  DEFAULT_API_VERSION,
  METAFIELDS,
  apiVersion,
  configured,
  domainFromEnv,
  listProducts,
  getProductByHandle,
  getCart,
  createCart,
  addCartLines,
  updateCartLines,
  removeCartLines,
  localProducts,
};
