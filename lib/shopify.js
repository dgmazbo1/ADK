/* ============================================================
   ADK Shopify Storefront wrapper
   - Uses Storefront API (public token, browser-safe)
   - Falls back to /data/products.json when not configured
   - Persists Shopify cart ID in localStorage
   ============================================================ */

const ADKShopify = (() => {
  const CART_KEY = "adk_shopify_cart_id";
  const CACHE_KEY = "adk_storefront_config_v1";

  let configPromise = null;
  let config = null;

  function loadConfig() {
    if (configPromise) return configPromise;
    configPromise = (async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          config = JSON.parse(cached);
          return config;
        }
      } catch {}

      try {
        const response = await fetch("/api/public/config", { credentials: "same-origin" });
        const data = await response.json();
        config = data?.shopify || { configured: false };
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(config)); } catch {}
        return config;
      } catch {
        config = { configured: false };
        return config;
      }
    })();
    return configPromise;
  }

  function isConfigured() {
    return config?.configured === true;
  }

  /* ---------- Storefront API calls ---------- */
  async function storefrontQuery(query, variables = {}) {
    if (!isConfigured()) throw new Error("Shopify not configured");
    const response = await fetch(`https://${config.domain}/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Shopify-Storefront-Access-Token": config.storefrontToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`Shopify API error: ${response.status}`);
    const data = await response.json();
    if (data.errors) throw new Error(data.errors.map((e) => e.message).join(", "));
    return data.data;
  }

  /* ---------- Products ---------- */
  async function getProducts() {
    await loadConfig();

    if (!isConfigured()) {
      // Fallback: load /data/products.json
      try {
        const response = await fetch("/data/products.json");
        const data = await response.json();
        return Array.isArray(data) ? data : (data.products || []);
      } catch {
        return [];
      }
    }

    const query = `
      query Products($first: Int!) {
        products(first: $first, sortKey: CREATED_AT, reverse: true) {
          edges { node {
            id
            handle
            title
            description
            descriptionHtml
            availableForSale
            tags
            productType
            featuredImage { url altText }
            images(first: 6) { edges { node { url altText } } }
            priceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            variants(first: 10) {
              edges { node {
                id
                title
                availableForSale
                price { amount currencyCode }
                quantityAvailable
              } }
            }
          } }
        }
      }
    `;
    const data = await storefrontQuery(query, { first: 50 });
    return (data.products?.edges || []).map(({ node }) => normalizeShopifyProduct(node));
  }

  function normalizeShopifyProduct(node) {
    const firstVariant = node.variants?.edges?.[0]?.node;
    const price = firstVariant?.price || node.priceRange?.minVariantPrice;
    return {
      id: node.handle,
      shopifyId: node.id,
      slug: node.handle,
      name: node.title,
      title: node.title,
      category: node.productType || (node.tags?.[0] || ""),
      shortDescription: (node.description || "").slice(0, 160),
      description: node.description,
      descriptionHtml: node.descriptionHtml,
      images: (node.images?.edges || []).map((e) => e.node.url),
      image: node.featuredImage?.url || node.images?.edges?.[0]?.node?.url || "",
      alt: node.featuredImage?.altText || node.title,
      price: price ? Number(price.amount) : null,
      currency: price?.currencyCode || "USD",
      requestPricing: !node.availableForSale,
      status: node.availableForSale ? "Available" : "Request Pricing",
      inventory: firstVariant?.quantityAvailable ?? null,
      variantId: firstVariant?.id || null,
      variants: (node.variants?.edges || []).map((e) => e.node),
      featured: (node.tags || []).includes("featured"),
    };
  }

  /* ---------- Cart ---------- */
  function getCartId() {
    try { return localStorage.getItem(CART_KEY); } catch { return null; }
  }
  function setCartId(id) {
    try { localStorage.setItem(CART_KEY, id); } catch {}
  }
  function clearCartId() {
    try { localStorage.removeItem(CART_KEY); } catch {}
  }

  async function getCart() {
    await loadConfig();
    if (!isConfigured()) return null;

    const id = getCartId();
    if (!id) return null;

    const query = `
      query Cart($id: ID!) {
        cart(id: $id) {
          id
          checkoutUrl
          totalQuantity
          cost {
            subtotalAmount { amount currencyCode }
            totalAmount { amount currencyCode }
          }
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
        }
      }
    `;
    try {
      const data = await storefrontQuery(query, { id });
      if (!data.cart) { clearCartId(); return null; }
      return data.cart;
    } catch {
      clearCartId();
      return null;
    }
  }

  async function addToCart(variantId, quantity = 1) {
    await loadConfig();
    if (!isConfigured()) {
      throw new Error("Storefront not yet connected to Shopify. Please use the contact form to request this product.");
    }

    let cartId = getCartId();
    if (!cartId) {
      const create = await storefrontQuery(`
        mutation CartCreate($lines: [CartLineInput!]) {
          cartCreate(input: { lines: $lines }) {
            cart { id checkoutUrl }
            userErrors { field message }
          }
        }
      `, { lines: [{ merchandiseId: variantId, quantity }] });
      const errs = create.cartCreate?.userErrors || [];
      if (errs.length) throw new Error(errs.map((e) => e.message).join(", "));
      cartId = create.cartCreate?.cart?.id;
      if (cartId) setCartId(cartId);
      return create.cartCreate.cart;
    }

    const add = await storefrontQuery(`
      mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart { id checkoutUrl totalQuantity }
          userErrors { field message }
        }
      }
    `, { cartId, lines: [{ merchandiseId: variantId, quantity }] });
    const errs = add.cartLinesAdd?.userErrors || [];
    if (errs.length) throw new Error(errs.map((e) => e.message).join(", "));
    return add.cartLinesAdd.cart;
  }

  async function updateLineQuantity(lineId, quantity) {
    await loadConfig();
    if (!isConfigured()) return null;
    const cartId = getCartId();
    if (!cartId) return null;

    if (quantity <= 0) {
      const remove = await storefrontQuery(`
        mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
          cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
            cart { id totalQuantity }
            userErrors { message }
          }
        }
      `, { cartId, lineIds: [lineId] });
      return remove.cartLinesRemove.cart;
    }

    const update = await storefrontQuery(`
      mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart { id totalQuantity }
          userErrors { message }
        }
      }
    `, { cartId, lines: [{ id: lineId, quantity }] });
    return update.cartLinesUpdate.cart;
  }

  async function getCheckoutUrl() {
    const cart = await getCart();
    return cart?.checkoutUrl || null;
  }

  /* ---------- Init ---------- */
  loadConfig();

  return {
    loadConfig,
    isConfigured: () => isConfigured(),
    getProducts,
    getCart,
    addToCart,
    updateLineQuantity,
    getCheckoutUrl,
    clearCartId,
  };
})();

window.ADKShopify = ADKShopify;
