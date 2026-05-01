/* ============================================================
   ADK Shopify browser bridge
   - Talks only to ADK public API routes.
   - Shopify Storefront token stays server-side.
   - Shopify owns cart, checkout, payments, tax, shipping, and orders.
   ============================================================ */

const ADKShopify = (() => {
  const CART_KEY = "adk.shopify.cart_id";
  let configPromise = null;
  let config = { configured: false, checkoutEnabled: false };

  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || "ADK store request failed.");
    }
    return data;
  }

  function loadConfig() {
    if (configPromise) return configPromise;
    configPromise = request("/api/public/config")
      .then((data) => {
        config = data.shopify || config;
        return config;
      })
      .catch(() => {
        config = { configured: false, checkoutEnabled: false };
        return config;
      });
    return configPromise;
  }

  function isConfigured() {
    return config?.configured === true;
  }

  function getCartId() {
    try { return localStorage.getItem(CART_KEY); } catch { return null; }
  }

  function setCartId(id) {
    if (!id) return;
    try { localStorage.setItem(CART_KEY, id); } catch {}
  }

  function clearCartId() {
    try { localStorage.removeItem(CART_KEY); } catch {}
  }

  async function getProducts(params = {}) {
    await loadConfig();
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.sort) search.set("sort", params.sort);
    const data = await request(`/api/public/products${search.toString() ? `?${search}` : ""}`);
    return data.products || [];
  }

  async function getProduct(handle) {
    const data = await request(`/api/public/products/${encodeURIComponent(handle)}`);
    return data.product;
  }

  async function getCart() {
    await loadConfig();
    if (!isConfigured()) return null;
    const cartId = getCartId();
    if (!cartId) return null;
    try {
      const data = await request(`/api/public/cart?id=${encodeURIComponent(cartId)}`);
      if (!data.cart) clearCartId();
      return data.cart;
    } catch {
      clearCartId();
      return null;
    }
  }

  async function addToCart(variantId, quantity = 1) {
    await loadConfig();
    if (!isConfigured()) {
      throw new Error("Shopify checkout is not connected yet. Please request pricing and ADK will follow up.");
    }
    const data = await request("/api/public/cart/add", {
      method: "POST",
      body: JSON.stringify({
        cartId: getCartId(),
        merchandiseId: variantId,
        quantity,
      }),
    });
    setCartId(data.cart?.id);
    return data.cart;
  }

  async function updateLineQuantity(lineId, quantity) {
    await loadConfig();
    const cartId = getCartId();
    if (!isConfigured() || !cartId) return null;
    const data = await request("/api/public/cart/update", {
      method: "POST",
      body: JSON.stringify({ cartId, lineId, quantity }),
    });
    setCartId(data.cart?.id);
    return data.cart;
  }

  async function getCheckoutUrl() {
    await loadConfig();
    const cartId = getCartId();
    if (!isConfigured() || !cartId) return null;
    const data = await request("/api/public/cart/checkout", {
      method: "POST",
      body: JSON.stringify({ cartId }),
    });
    return data.checkoutUrl || null;
  }

  function formatMoney(money) {
    if (!money) return "Request Pricing";
    const amount = typeof money === "number" ? money : Number(money.amount);
    const currency = typeof money === "number" ? "USD" : money.currencyCode || "USD";
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  }

  loadConfig();

  return {
    loadConfig,
    isConfigured,
    getProducts,
    getProduct,
    getCart,
    addToCart,
    updateLineQuantity,
    getCheckoutUrl,
    clearCartId,
    formatMoney,
  };
})();

window.ADKShopify = ADKShopify;
