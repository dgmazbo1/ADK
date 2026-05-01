# ADK Shopify Setup

ADK uses Shopify as the commerce backend for products that are sold online. The ADK website remains the premium front-end experience, but Shopify owns pricing, inventory, variants, cart, checkout, taxes, payments, shipping, orders, refunds, and abandoned checkout recovery.

## 1. Create The Shopify Store

Create a new Shopify store or use an existing ADK store. Add the sellable ADK products directly inside Shopify. Do not treat `data/products.json` as the live source of truth after Shopify is connected.

## 2. Enable Storefront API

Create a Storefront API access token in Shopify and enable permissions for:

- Products
- Collections
- Cart
- Checkout

The ADK site uses the Storefront API only. Do not put Shopify Admin API tokens in browser code.

## 3. Add Product Metafields

Create product metafields with namespace `custom`:

- `fitment`
- `material`
- `lead_time`
- `build_notes`
- `specifications`
- `request_pricing`
- `requires_fitment_review`
- `made_to_order`
- `installation_required`
- `shipping_notes`
- `vehicle_application`

Use `request_pricing`, `requires_fitment_review`, `made_to_order`, and `installation_required` as boolean fields when possible.

## 4. Add Product Tags

Use these tags to control store behavior and filtering:

- `request-pricing`
- `quote-required`
- `built-to-order-review`
- `peterbilt`
- `air-ride`
- `overland`
- `trailer`
- `tanks`
- `brackets`
- `featured`

Products tagged `request-pricing`, `quote-required`, or `built-to-order-review` will show a quote request flow instead of Add to Cart.

## 5. Add Collections

Create collections for:

- Peterbilt Air Ride
- Mounts + Brackets
- Tanks + Cooling
- Trailer Components
- Overland Parts

## 6. Configure Railway Variables

Required:

- `ADK_ADMIN_USER`
- `ADK_ADMIN_PASSWORD`
- `ADK_ADMIN_SESSION_SECRET`
- `ADK_GITHUB_TOKEN`
- `ADK_GITHUB_OWNER`
- `ADK_GITHUB_REPO`
- `ADK_GITHUB_PUBLISH_WORKFLOW`
- `ADK_GITHUB_BRANCH`
- `SHOPIFY_DOMAIN`
- `SHOPIFY_STOREFRONT_TOKEN`
- `SHOPIFY_API_VERSION`

Optional:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GHL_BUILD_REQUEST_WEBHOOK`
- `GHL_QUOTE_REQUEST_WEBHOOK`

Use a current stable Storefront API version, for example `2025-01`.

## 7. Test Before Launch

Use Shopify test payment mode before going live. Confirm:

- Product listing loads from Shopify.
- Product detail pages load by handle.
- Variant selection works.
- Add to Cart works.
- Cart quantity updates work.
- Checkout redirects to Shopify checkout.
- Request Pricing products submit through the ADK quote request flow.
- No credit card fields appear on ADK pages.

## 8. Fallback Mode

If Shopify environment variables are missing or Shopify is unavailable, ADK falls back to `data/products.json`. Checkout is disabled in fallback mode and products should route customers toward quote or build requests.
