// ADK Admin — shared client utilities
// Loaded by every admin page. No external deps.

const ADKAdmin = (() => {
  const state = { sessionChecked: false };

  /* ---------- Toast ---------- */
  let toastNode = null;
  function ensureToast() {
    if (toastNode) return toastNode;
    toastNode = document.createElement("div");
    toastNode.className = "admin-toast";
    toastNode.setAttribute("role", "status");
    document.body.appendChild(toastNode);
    return toastNode;
  }

  function toast(message, kind = "default", duration = 3200) {
    const node = ensureToast();
    node.textContent = message;
    node.classList.remove("is-error", "is-success");
    if (kind === "error") node.classList.add("is-error");
    if (kind === "success") node.classList.add("is-success");
    node.classList.add("is-visible");
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => {
      node.classList.remove("is-visible");
    }, duration);
  }

  /* ---------- Loading bar ---------- */
  let loadingNode = null;
  function setLoading(isOn) {
    if (!loadingNode) {
      loadingNode = document.createElement("div");
      loadingNode.className = "admin-loading";
      document.body.appendChild(loadingNode);
    }
    loadingNode.classList.toggle("is-active", Boolean(isOn));
  }

  /* ---------- Fetch helpers ---------- */
  async function api(method, url, body) {
    setLoading(true);
    try {
      const init = { method, headers: { "Content-Type": "application/json" }, credentials: "same-origin" };
      if (body !== undefined) init.body = JSON.stringify(body);
      const response = await fetch(url, init);
      const text = await response.text();
      let payload = null;
      if (text) {
        try { payload = JSON.parse(text); } catch { payload = { ok: false, message: text }; }
      }
      if (response.status === 401) {
        window.location.href = "/admin/login";
        throw new Error("Unauthorized");
      }
      if (!response.ok) {
        throw new Error(payload?.message || `Request failed (${response.status})`);
      }
      return payload || { ok: true };
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Session ---------- */
  async function ensureAuth() {
    if (state.sessionChecked) return true;
    try {
      const response = await fetch("/api/admin/session", { credentials: "same-origin" });
      const data = await response.json();
      if (!data.authenticated) {
        window.location.href = "/admin/login";
        return false;
      }
      state.sessionChecked = true;
      return true;
    } catch {
      window.location.href = "/admin/login";
      return false;
    }
  }

  async function logout() {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } catch {}
    window.location.href = "/admin/login";
  }

  /* ---------- Publish ---------- */
  async function publish() {
    if (!confirm("Publish all admin changes to the live site?\n\nThis triggers a Railway redeploy via GitHub Actions and takes 1-3 minutes.")) return;
    try {
      const result = await api("POST", "/api/admin/publish");
      toast("Publish queued. Live in 1-3 minutes.", "success");
      if (result.workflowUrl) {
        console.info("Publish workflow:", result.workflowUrl);
      }
    } catch (error) {
      toast(error.message || "Publish failed.", "error", 5000);
    }
  }

  /* ---------- Sidebar toggle ---------- */
  function bindSidebar() {
    const toggle = document.querySelector("[data-admin-menu-toggle]");
    const sidebar = document.querySelector("[data-admin-sidebar]");
    const scrim = document.querySelector("[data-admin-scrim]");
    if (!toggle || !sidebar) return;
    const close = () => {
      sidebar.classList.remove("is-open");
      scrim?.classList.remove("is-visible");
      toggle.setAttribute("aria-expanded", "false");
    };
    const open = () => {
      sidebar.classList.add("is-open");
      scrim?.classList.add("is-visible");
      toggle.setAttribute("aria-expanded", "true");
    };
    toggle.addEventListener("click", () => {
      sidebar.classList.contains("is-open") ? close() : open();
    });
    scrim?.addEventListener("click", close);
    sidebar.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  function bindTopbar() {
    const logoutBtn = document.querySelector("[data-admin-logout]");
    logoutBtn?.addEventListener("click", logout);
    const publishBtn = document.querySelector("[data-admin-publish]");
    publishBtn?.addEventListener("click", publish);
  }

  /* ---------- Active nav ---------- */
  function markActiveNav() {
    const links = document.querySelectorAll(".admin-sidebar__link");
    const current = window.location.pathname.replace(/\/$/, "") || "/admin";
    links.forEach((link) => {
      const href = (link.getAttribute("href") || "").replace(/\/$/, "");
      if (!href) return;
      const isMatch =
        href === current ||
        (href !== "/admin" && current.startsWith(href));
      link.classList.toggle("is-active", isMatch);
    });
  }

  /* ---------- Formatting ---------- */
  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  }

  function formatRelative(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    return formatDate(value);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* ---------- Init ---------- */
  function init() {
    document.body.classList.add("admin-body");
    ensureAuth();
    bindSidebar();
    bindTopbar();
    markActiveNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { api, toast, ensureAuth, logout, publish, formatDate, formatRelative, escapeHtml };
})();

window.ADKAdmin = ADKAdmin;
