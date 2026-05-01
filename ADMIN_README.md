# ADK Admin + Shopify Hybrid — Setup Notes

This update introduces a Shopify-hybrid storefront, a working admin panel, and a customer-submission inbox. The marketing site stays as-is; products move to Shopify, and Rudy manages submissions / gallery / settings through `/admin`.

## What changed

**New / replaced:**
- `server.js` — extended with content management, submissions, public form intake, and Shopify config endpoints. Auth and publish flow unchanged.
- `data/products.json` — extracted from the inlined catalog in `store/index.html` (fallback when Shopify is not connected).
- `data/gallery.json`, `data/shop-notes.json`, `data/settings.json` — content managed by the admin panel. Saving commits the file to the GitHub repo via the Contents API; "Publish" then triggers a Railway redeploy.
- `lib/shopify-storefront.js` — server-side Shopify Storefront API client. Handles product queries, metafields, carts, checkout URLs, and local fallback.
- `lib/shopify.js` — browser bridge that talks only to ADK public API routes. It does not expose Admin API keys or the Storefront token.
- `admin/assets/admin.css` and `admin/assets/admin.js` — shared admin shell (topbar, sidebar, cards, forms, status pills, toast, fetch helpers).
- `admin/index.html` — dashboard with stats and recent activity feed.
- `admin/build-requests/index.html` — two-column inbox with status updates.
- `admin/quote-requests/index.html` — two-column inbox with status updates.
- `admin/gallery/index.html` — grid editor for shop work photos.
- `admin/shop-notes/index.html` — internal notebook (not shown on public site).
- `admin/settings/index.html` — shop info, social links, integration status display.
- `store/index.html` — added a Shopify bootstrap that swaps `window.ADK_PRODUCTS` for live data when configured.
- `cart/index.html` — checkout button redirects to Shopify hosted checkout when configured.
- `script.js` — build-form / contact-form submit handlers now POST to the new public API endpoints (no more "staged" placeholder).

**Commerce admin:**
- `admin/products/`, `admin/categories/`, `admin/orders/` — read-only ADK views that point product, inventory, checkout, and order edits back to Shopify.

## Required Railway environment variables

These are already in place; no change needed:
- `ADK_ADMIN_USER`, `ADK_ADMIN_PASSWORD`, `ADK_ADMIN_SESSION_SECRET` — admin login
- `ADK_GITHUB_TOKEN` — used for publish workflow + content commits

**New optional vars (everything still works without them, with graceful fallbacks):**

| Variable | Purpose |
| --- | --- |
| `SHOPIFY_DOMAIN` | e.g. `afterdarkkreations.myshopify.com`. Storefront target. |
| `SHOPIFY_STOREFRONT_TOKEN` | Storefront API access token used by the ADK server proxy. Do not expose Admin API tokens. |
| `SHOPIFY_API_VERSION` | Storefront API version, for example `2025-01`. |
| `SUPABASE_URL` | Submission persistence backend (build/quote requests). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key for Supabase REST. |
| `GHL_BUILD_REQUEST_WEBHOOK` | Optional GHL webhook URL — every build request is also POST-ed here. |
| `GHL_QUOTE_REQUEST_WEBHOOK` | Optional GHL webhook URL — every quote request is also POST-ed here. |

Without `SUPABASE_*`, submissions are kept in process memory only — they survive within a single deploy, but disappear on redeploy. Fine for quick testing; required for production.

## Tomorrow: Shopify setup steps

1. Sign up at `shopify.com`. Pick the Basic plan ($39/mo).
2. In the Shopify admin: **Settings → Apps and sales channels → Develop apps → Create an app** → name it "ADK Storefront."
3. Open the app → **Configuration** → **Storefront API access** → **Configure** → enable scopes:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_product_inventory`
   - `unauthenticated_read_product_tags`
   - `unauthenticated_read_collection_listings`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_read_checkouts`
4. **Install app**, then **API credentials** → copy the **Storefront API access token**.
5. In Railway: add `SHOPIFY_DOMAIN` (without `https://`), `SHOPIFY_STOREFRONT_TOKEN`, and `SHOPIFY_API_VERSION`.
6. In Shopify: add a few real products (with variants, inventory, prices). Tag any you want featured with `featured`.
7. Hit Publish in the ADK admin (or just push a commit) to redeploy. Refresh `/store` — products should come from Shopify.

## Supabase schema (when you're ready)

Two tables. UUID primary key, `created_at` set at insert, `status` defaults to `new`.

```sql
create table if not exists adk_build_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  status text default 'new',
  type text default 'build-request',
  contact_name text,
  contact_email text,
  contact_phone text,
  vehicle text,
  scope text,
  budget text,
  timeline text,
  attachments jsonb default '[]'::jsonb,
  source text
);

create table if not exists adk_quote_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  status text default 'new',
  type text default 'quote-request',
  contact_name text,
  contact_email text,
  contact_phone text,
  product_id text,
  product_name text,
  product_handle text,
  product_url text,
  selected_variant text,
  vehicle text,
  timeline text,
  budget text,
  attachments jsonb default '[]'::jsonb,
  message text,
  source text
);

-- The service role key bypasses RLS, which is what the server uses.
-- Do NOT expose the service role key to the browser.
```

## How the admin saves changes

1. Rudy edits in `/admin/gallery`, `/admin/shop-notes`, or `/admin/settings` and clicks **Save changes**.
2. The server commits the updated JSON to GitHub via the Contents API. Local file is also updated for instant consistency on this Railway instance.
3. Rudy hits **Publish** in the topbar. The existing `adk-publish.yml` workflow runs and Railway redeploys.

The "Publish" button is essentially: "make my edits live for everyone." Saves persist immediately to git; publishing triggers the deploy that ships them.

## Submission status workflow

Each build/quote request moves through: `new → reviewing → quoted → won` (or `lost`, or `archived`).

The dashboard sidebar shows the count of `new` items per inbox so Rudy can see at a glance what needs attention.

## Notes for the Phase 2 work

- Cart drawer UI: not yet built. The current `/cart` page supports Shopify cart fetches, quantity updates, remove actions, and checkout redirect when Shopify is configured.
- File uploads for build requests (photos): the form currently doesn't upload — it captures intent only. Adding S3/Cloudinary intake is a Phase 2 task once the inbox is in regular use.
- Shopify product detail pages (`/store/[handle]/`): server-render Shopify product metadata and JSON-LD when Shopify is configured, with local JSON fallback when it is not.
