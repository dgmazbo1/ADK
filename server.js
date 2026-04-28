const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

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
    ...headers,
  });
  response.end(JSON.stringify(data));
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

    /* ----- Public storefront config (Shopify Storefront token IS public-by-design) ----- */
    if (pathname === "/api/public/config" && method === "GET") {
      sendJson(response, 200, {
        ok: true,
        shopify: {
          configured: Boolean(shopifyDomain && shopifyStorefrontToken),
          domain: shopifyDomain || null,
          storefrontToken: shopifyStorefrontToken || null,
        },
      });
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
