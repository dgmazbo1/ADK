const fs = require("fs");
const path = require("path");

const root = process.cwd();
const ignoredDirs = new Set([".git", "node_modules"]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirs.has(entry.name) ? [] : walk(fullPath);
    }
    return entry.isFile() && entry.name.endsWith(".html") ? [fullPath] : [];
  });
}

function routeExists(href) {
  const pathname = href.split("#")[0].split("?")[0];
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return true;
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const fullPath = path.normalize(path.join(root, normalized));
  if (!fullPath.startsWith(root)) return false;
  if (path.extname(fullPath)) return fs.existsSync(fullPath);
  return fs.existsSync(path.join(fullPath, "index.html")) || fs.existsSync(`${fullPath}.html`);
}

const htmlFiles = walk(root);
const pageReports = htmlFiles.map((file) => {
  const html = fs.readFileSync(file, "utf8");
  const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]));
  const anchorHrefs = [...html.matchAll(/<a\b(?=[^>]*href=["']([^"']+)["'])[^>]*>/g)].map(
    (match) => match[1],
  );
  const srcs = [...html.matchAll(/src=["']([^"']+)["']/g)].map((match) => match[1]);
  const stylesheets = [
    ...html.matchAll(/<link\b(?=[^>]*rel=["']stylesheet["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/g),
  ].map((match) => match[1]);
  const titleCount = (html.match(/<title>/g) || []).length;
  const descriptionCount = (html.match(/<meta\s+name=["']description["']/g) || []).length;

  const brokenAnchors = anchorHrefs
    .filter((href) => href.startsWith("#") && href.length > 1)
    .filter((href) => !ids.has(href.slice(1)));

  const brokenRoutes = anchorHrefs
    .filter((href) => href.startsWith("/") && !href.startsWith("//"))
    .filter((href) => !routeExists(href));

  const missingLocalAssets = [...srcs, ...stylesheets]
    .filter((src) => src.startsWith("/") && !src.startsWith("//"))
    .filter((src) => !routeExists(src));

  const navBlock = html.match(/<nav class=["']site-nav["'][\s\S]*?<\/nav>/)?.[0] || "";
  const navAnchors = [...navBlock.matchAll(/href=["']([^"']+)["']/g)].map((match) => match[1]);
  const navAnchorLinks = navAnchors.filter((href) => href.startsWith("#"));

  return {
    file,
    html,
    anchorHrefs,
    srcs,
    stylesheets,
    brokenAnchors,
    brokenRoutes,
    missingLocalAssets,
    navAnchorLinks,
    titleCount,
    descriptionCount,
  };
});

const clickableUrls = pageReports.flatMap((report) =>
  report.anchorHrefs.filter((href) => /^https?:\/\//.test(href)),
);
const assetUrls = pageReports.flatMap((report) => report.srcs.filter((src) => /^https?:\/\//.test(src)));
const stylesheetUrls = pageReports.flatMap((report) =>
  report.stylesheets.filter((href) => /^https?:\/\//.test(href)),
);
const urls = [...new Set([...clickableUrls, ...assetUrls, ...stylesheetUrls])];

async function checkUrl(url) {
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, { method: "GET", redirect: "follow" });
    }
    return { url, status: response.status, ok: response.ok };
  } catch (error) {
    return { url, status: "ERR", ok: false, error: error.message };
  }
}

(async () => {
  const results = await Promise.all(urls.map(checkUrl));
  const brokenUrls = results.filter((result) => !result.ok);
  const brokenAnchors = pageReports.flatMap((report) =>
    report.brokenAnchors.map((href) => `${path.relative(root, report.file)}: ${href}`),
  );
  const brokenRoutes = pageReports.flatMap((report) =>
    report.brokenRoutes.map((href) => `${path.relative(root, report.file)}: ${href}`),
  );
  const missingLocalAssets = pageReports.flatMap((report) =>
    report.missingLocalAssets.map((href) => `${path.relative(root, report.file)}: ${href}`),
  );
  const navAnchorLinks = pageReports.flatMap((report) =>
    report.navAnchorLinks.map((href) => `${path.relative(root, report.file)}: ${href}`),
  );
  const missingSeo = pageReports
    .filter((report) => report.titleCount !== 1 || report.descriptionCount !== 1)
    .map((report) => path.relative(root, report.file));

  console.log(`HTML pages: ${pageReports.length}`);
  console.log(`Local anchors: ${pageReports.reduce((sum, report) => sum + report.anchorHrefs.filter((href) => href.startsWith("#")).length, 0)}`);
  console.log(`External URLs checked: ${urls.length}`);

  if (brokenAnchors.length) {
    console.error("Broken local anchors:");
    for (const anchor of brokenAnchors) console.error(`- ${anchor}`);
  }
  if (brokenRoutes.length) {
    console.error("Broken local routes:");
    for (const route of brokenRoutes) console.error(`- ${route}`);
  }
  if (missingLocalAssets.length) {
    console.error("Missing local assets:");
    for (const asset of missingLocalAssets) console.error(`- ${asset}`);
  }
  if (navAnchorLinks.length) {
    console.error("Anchor links found in main navigation:");
    for (const navLink of navAnchorLinks) console.error(`- ${navLink}`);
  }
  if (missingSeo.length) {
    console.error("Pages missing exactly one title and meta description:");
    for (const file of missingSeo) console.error(`- ${file}`);
  }
  if (brokenUrls.length) {
    console.error("Broken external URLs:");
    for (const result of brokenUrls) {
      console.error(`- ${result.status} ${result.url}${result.error ? ` (${result.error})` : ""}`);
    }
  }

  if (
    brokenAnchors.length ||
    brokenRoutes.length ||
    missingLocalAssets.length ||
    navAnchorLinks.length ||
    missingSeo.length ||
    brokenUrls.length
  ) {
    process.exit(1);
  }

  console.log("QA passed: pages, routes, anchors, SEO metadata, and checked external URLs are valid.");
})();
