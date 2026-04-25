const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]));
const anchorHrefs = [...html.matchAll(/<a\b(?=[^>]*href=["']([^"']+)["'])[^>]*>/g)].map(
  (match) => match[1],
);
const srcs = [...html.matchAll(/src=["']([^"']+)["']/g)].map((match) => match[1]);

const brokenAnchors = anchorHrefs
  .filter((href) => href.startsWith("#") && href.length > 1)
  .filter((href) => !ids.has(href.slice(1)));

const clickableUrls = anchorHrefs.filter((href) => /^https?:\/\//.test(href));
const assetUrls = srcs.filter((src) => /^https?:\/\//.test(src));
const stylesheetUrls = [
  ...html.matchAll(/<link\b(?=[^>]*rel=["']stylesheet["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/g),
].map((match) => match[1]).filter((href) => /^https?:\/\//.test(href));

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

  console.log(`IDs: ${ids.size}`);
  console.log(`Local anchors: ${anchorHrefs.filter((href) => href.startsWith("#")).length}`);
  console.log(`External URLs checked: ${urls.length}`);

  if (brokenAnchors.length) {
    console.error("Broken local anchors:");
    for (const anchor of brokenAnchors) console.error(`- ${anchor}`);
  }

  if (brokenUrls.length) {
    console.error("Broken external URLs:");
    for (const result of brokenUrls) {
      console.error(`- ${result.status} ${result.url}${result.error ? ` (${result.error})` : ""}`);
    }
  }

  if (brokenAnchors.length || brokenUrls.length) {
    process.exit(1);
  }

  console.log("QA passed: no broken anchors or checked external URLs.");
})();
