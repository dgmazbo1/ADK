const http = require("http");
const { execFile } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const adminUsername = process.env.ADK_ADMIN_USER;
const adminPassword = process.env.ADK_ADMIN_PASSWORD;
const adminSessionSecret = process.env.ADK_ADMIN_SESSION_SECRET;
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
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: root, timeout: 1000 * 60 * 5 }, (error, stdout, stderr) => {
      const result = {
        command: [command, ...args].join(" "),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };

      if (error) {
        reject(Object.assign(error, result));
        return;
      }

      resolve(result);
    });
  });
}

async function publishSite() {
  const steps = [];
  const status = await runCommand("git", ["status", "--porcelain"]);
  steps.push({ name: "Check Git status", ok: true, output: status.stdout || "Working tree clean." });

  if (status.stdout.trim()) {
    steps.push({ name: "Stage changes", ok: true, output: (await runCommand("git", ["add", "-A"])).stdout || "Changes staged." });
    const commit = await runCommand("git", ["commit", "-m", "Publish ADK admin changes"]);
    steps.push({ name: "Commit changes", ok: true, output: commit.stdout || "Commit created." });
    const push = await runCommand("git", ["push", "origin", "main"]);
    steps.push({ name: "Push to GitHub", ok: true, output: push.stdout || push.stderr || "Pushed to GitHub." });
  } else {
    steps.push({ name: "Push to GitHub", ok: true, output: "No local changes to commit. GitHub already matches this checkout." });
  }

  const deploy = await runCommand("railway", ["up", "--service", "ADK", "--detach"]);
  steps.push({ name: "Deploy to Railway", ok: true, output: deploy.stdout || deploy.stderr || "Railway deploy started." });
  return steps;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === "/api/admin/session") {
    sendJson(response, 200, { authenticated: isAdminAuthenticated(request) });
    return;
  }

  if (pathname === "/api/admin/logout" && request.method === "POST") {
    sendJson(response, 200, { ok: true }, {
      "Set-Cookie": `${sessionCookieName}=; ${cookieOptions(request, 0)}`,
    });
    return;
  }

  if (pathname === "/api/admin/publish" && request.method === "POST") {
    if (!isAdminAuthenticated(request)) {
      sendJson(response, 401, { ok: false, message: "Admin authentication required." });
      return;
    }

    publishSite()
      .then((steps) => sendJson(response, 200, { ok: true, message: "Publish started.", steps }))
      .catch((error) => {
        sendJson(response, 500, {
          ok: false,
          message: "Publish failed. This server needs Git, Railway CLI, and deploy credentials available.",
          command: error.command,
          output: error.stderr || error.stdout || error.message,
        });
      });
    return;
  }

  if (pathname === "/api/admin/login" && request.method === "POST") {
    readRequestBody(request)
      .then((body) => {
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
      })
      .catch(() => sendJson(response, 400, { ok: false, message: "Unable to process login request." }));
    return;
  }

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
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "public, max-age=300",
    });
    response.end(data);
  });
});

server.listen(port, () => {
  console.log(`ADK website serving on port ${port}`);
});
