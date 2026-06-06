const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isAdminRoute = window.location.pathname.startsWith("/admin");
const isAdminLoginRoute = window.location.pathname.replace(/\/$/, "") === "/admin/login";

const header = document.querySelector("[data-site-header]");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const headerContact = document.querySelector(".header-contact");
const navDropdowns = document.querySelectorAll("[data-nav-dropdown]");

if (isAdminRoute && !isAdminLoginRoute) {
  const topbar = document.querySelector(".admin-topbar");
  topbar?.insertAdjacentHTML(
    "beforeend",
    `<div class="admin-publish">
      <button class="button line-button" type="button" data-admin-publish>Publish</button>
      <p data-admin-publish-status>Push current website changes to GitHub and start a Railway deploy.</p>
    </div>`,
  );
}

if (!isAdminRoute) {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="build-modal" data-build-modal hidden>
      <div class="build-modal__shell" role="dialog" aria-modal="true" aria-labelledby="build-modal-title">
        <div class="build-modal__backdrop" data-build-modal-close></div>
        <section class="build-modal__panel" aria-describedby="build-modal-copy">
          <button class="build-modal__close" type="button" aria-label="Close build request" data-build-modal-close>
            <span aria-hidden="true"></span>
          </button>
          <div class="build-modal__content">
            <div class="build-modal__story">
              <p class="eyebrow">Build Intake</p>
              <h2 id="build-modal-title">Start A Build Request</h2>
              <p id="build-modal-copy">Send the project basics now. Photos, measurements, vehicle details, and use-case notes help ADK review what is possible before the first cut.</p>
              <div class="build-modal__points" aria-label="Build request details">
                <div><strong>CAD Supported</strong><span>Measurements, mockups, and fitment review.</span></div>
                <div><strong>Shop Reviewed</strong><span>ADK checks material, access, timeline, and scope.</span></div>
              </div>
              <blockquote>Built like it is going on our own truck.</blockquote>
            </div>
            <form class="build-modal__form" data-build-modal-form>
              <div class="build-modal__success" data-build-modal-success hidden>
                <span aria-hidden="true">✓</span>
                <h3>Request queued.</h3>
                <p>This demo modal does not transmit data yet. Use the full build request page when you are ready to send details to ADK.</p>
                <a class="button line-button" href="/build-request">Open Full Build Request</a>
              </div>
              <div data-build-modal-fields>
                <h3>Project Basics</h3>
                <label>Name<input name="name" type="text" autocomplete="name" required /></label>
                <label>Phone<input name="phone" type="tel" autocomplete="tel" required /></label>
                <label>Email<input name="email" type="email" autocomplete="email" required /></label>
                <label>Vehicle / Project<input name="project" type="text" /></label>
                <label>What do you need built?<textarea name="need" rows="4" required></textarea></label>
                <label class="build-modal__upload">
                  Upload pictures <small>Up to 5 pictures</small>
                  <input name="photos" type="file" accept="image/*" multiple data-build-modal-photos />
                </label>
                <button class="button line-button" type="submit" data-build-modal-submit>Submit Request</button>
                <p class="build-modal__note" data-build-modal-note>Pictures help ADK understand fitment, damage, measurements, and access points. Upload up to 5 pictures here, or use the full request page for more project details.</p>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  `,
  );
}

const buildModal = document.querySelector("[data-build-modal]");
const buildModalForm = document.querySelector("[data-build-modal-form]");
const buildModalFields = document.querySelector("[data-build-modal-fields]");
const buildModalSuccess = document.querySelector("[data-build-modal-success]");
const buildModalSubmit = document.querySelector("[data-build-modal-submit]");
const buildModalPhotos = document.querySelector("[data-build-modal-photos]");
const buildModalNote = document.querySelector("[data-build-modal-note]");
let buildModalTrigger = null;

function setHeaderState() {
  header?.classList.toggle("is-condensed", window.scrollY > 18);
}

function setMobileMenuOffset() {
  if (!header) return;
  const bottom = header.getBoundingClientRect().bottom + 8;
  document.documentElement.style.setProperty("--mobile-menu-top", `${Math.max(72, Math.round(bottom))}px`);
}

setHeaderState();
setMobileMenuOffset();
window.addEventListener("scroll", setHeaderState, { passive: true });
window.addEventListener("resize", setMobileMenuOffset, { passive: true });

function closeNavDropdowns(exceptGroup) {
  navDropdowns.forEach((group) => {
    if (group === exceptGroup) return;
    group.classList.remove("is-open");
    group.querySelector(".nav-trigger")?.setAttribute("aria-expanded", "false");
  });
}

function closeMobileMenu() {
  menuToggle?.setAttribute("aria-expanded", "false");
  siteNav?.classList.remove("is-open");
  headerContact?.classList.remove("is-open");
  document.body.classList.remove("menu-open");
  closeNavDropdowns();
}

navDropdowns.forEach((group) => {
  const trigger = group.querySelector(".nav-trigger");
  if (!trigger) return;

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = trigger.getAttribute("aria-expanded") === "true";
    closeNavDropdowns(group);
    group.classList.toggle("is-open", !isOpen);
    trigger.setAttribute("aria-expanded", String(!isOpen));
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest?.("[data-nav-dropdown]")) {
    closeNavDropdowns();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (buildModal && !buildModal.hidden) closeBuildModal();
    closeNavDropdowns();
    closeMobileMenu();
  }
});

if (menuToggle && siteNav && headerContact) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    siteNav.classList.toggle("is-open", !isOpen);
    headerContact.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("menu-open", !isOpen);
    setMobileMenuOffset();
    if (isOpen) closeNavDropdowns();
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });
}

if (siteNav) {
  const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
  siteNav.querySelectorAll("a").forEach((link) => {
    const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, "") || "/";
    if (linkPath === currentPath) {
      link.setAttribute("aria-current", "page");
    }
  });

  const dropdownControlByPath = {
    "/capabilities": "nav-capabilities-panel",
    "/store": "nav-store-panel",
    "/shop-work": "nav-work-panel",
    "/blog": "nav-resources-panel",
    "/about": "nav-resources-panel",
    "/contact": "nav-resources-panel",
  };
  const activeDropdownTrigger = dropdownControlByPath[currentPath]
    ? siteNav.querySelector(`[aria-controls="${dropdownControlByPath[currentPath]}"]`)
    : null;
  const activeStoreTrigger = currentPath.startsWith("/store/")
    ? siteNav.querySelector(`[aria-controls="nav-store-panel"]`)
    : null;
  const activeBlogTrigger = currentPath.startsWith("/blog/")
    ? siteNav.querySelector(`[aria-controls="nav-resources-panel"]`)
    : null;
  activeDropdownTrigger?.setAttribute("aria-current", "page");
  activeStoreTrigger?.setAttribute("aria-current", "page");
  activeBlogTrigger?.setAttribute("aria-current", "page");
}

function openBuildModal(trigger) {
  if (!buildModal) return;
  buildModalTrigger = trigger;
  closeMobileMenu();
  buildModal.hidden = false;
  document.body.classList.add("build-modal-open");
  window.requestAnimationFrame(() => {
    buildModal.classList.add("is-open");
    buildModal.querySelector("input")?.focus();
  });
}

function closeBuildModal() {
  if (!buildModal) return;
  buildModal.classList.remove("is-open");
  document.body.classList.remove("build-modal-open");
  window.setTimeout(() => {
    buildModal.hidden = true;
    buildModalForm?.reset();
    if (buildModalFields) buildModalFields.hidden = false;
    if (buildModalSuccess) buildModalSuccess.hidden = true;
    if (buildModalSubmit) {
      buildModalSubmit.disabled = false;
      buildModalSubmit.textContent = "Submit Request";
    }
    buildModalTrigger?.focus?.();
    buildModalTrigger = null;
  }, prefersReducedMotion ? 0 : 220);
}

document
  .querySelectorAll('a.button[href="/build-request"], a.small-button[href="/build-request"], a.text-link[href="/build-request"]')
  .forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openBuildModal(link);
    });
  });

document.querySelectorAll("[data-build-modal-close]").forEach((control) => {
  control.addEventListener("click", closeBuildModal);
});

buildModalForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (buildModalPhotos?.files?.length > 5) {
    if (buildModalNote) {
      buildModalNote.textContent = "Upload up to 5 pictures. Remove extra files before submitting.";
    }
    buildModalPhotos.focus();
    return;
  }
  if (buildModalSubmit) {
    buildModalSubmit.disabled = true;
    buildModalSubmit.textContent = "Reviewing...";
  }
  window.setTimeout(() => {
    if (buildModalFields) buildModalFields.hidden = true;
    if (buildModalSuccess) buildModalSuccess.hidden = false;
    buildModalSuccess?.querySelector("a")?.focus();
  }, prefersReducedMotion ? 0 : 750);
});

const revealItems = document.querySelectorAll(".reveal, .workflow-diagram");

if (prefersReducedMotion) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 28, 220)}ms`;
    revealObserver.observe(item);
  });
}

const indexList = document.querySelector("[data-active-row]");

if (indexList) {
  const rows = indexList.querySelectorAll("article");

  function setActiveRow(row) {
    const listRect = indexList.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    indexList.style.setProperty("--active-top", `${rowRect.top - listRect.top}px`);
    indexList.style.setProperty("--active-height", `${rowRect.height}px`);
  }

  rows.forEach((row) => {
    row.addEventListener("mouseenter", () => setActiveRow(row));
    row.addEventListener("focusin", () => setActiveRow(row));
  });

  if (rows[0]) setActiveRow(rows[0]);
  window.addEventListener("resize", () => rows[0] && setActiveRow(rows[0]), { passive: true });
}

const storageKeys = {
  products: "adk.store.products",
  gallery: "adk.store.gallery",
};

const defaultProductData = [
  {
    id: "air-ride",
    label: "Air Ride Systems",
    title: "Peterbilt Air Ride Programs",
    copy: "ADK builds air ride kits and suspension support around fitment, load, routing, and long-term service access.",
    fitment: "Peterbilt 359 / 379 / 389",
    material: "Fabricated steel components",
    use: "Ride height, clearance, and real truck use",
    status: "Request pricing",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/air-ride-user_6d45a40e.jpg",
    alt: "Air ride fabrication components for truck fitment",
    caption: "Peterbilt air ride fitment program",
    parts: [
      "Peterbilt 389 Rear Air Ride Kit",
      "Peterbilt 389 Front Air Leaf Suspension",
      "Peterbilt 389 Full Air Ride System",
      "Peterbilt 379 Air Ride Kit",
      "Peterbilt 359/379/389 Gen III Air Ride Kit",
    ],
  },
  {
    id: "mounts",
    label: "Mounts + Brackets",
    title: "Custom Brackets And Fitment Hardware",
    copy: "Mounting hardware built around the actual install point, not a generic shelf part.",
    fitment: "Custom / truck / overland",
    material: "Steel, stainless, aluminum",
    use: "Secure mounting, clearance, service access",
    status: "Request pricing",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/truck-parts-v2-XEpWn9SrbHcBf4W89SiSnS.webp",
    alt: "Custom brackets and mounts on a fabrication bench",
    caption: "Mounting hardware / shop fitment",
    parts: ["Custom brackets", "Mounts", "Overland mounts", "Tank mounts", "One-off fitment hardware"],
  },
  {
    id: "tanks",
    label: "Tanks + Cooling",
    title: "Cooling And Tank Products",
    copy: "Fabricated tanks, cooling support, and related assemblies built around space, serviceability, and material choice.",
    fitment: "Custom and production",
    material: "Aluminum, stainless, steel",
    use: "Cooling, fluid support, packaging",
    status: "Request pricing",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/coolant-tank-v1_c26f55db.png",
    alt: "Custom fabricated cooling tank component",
    caption: "Cooling / tank product study",
    parts: ["Cooling products", "Tank products", "Aluminum fabrication", "Stainless fabrication", "Custom reservoirs"],
  },
  {
    id: "trailers",
    label: "Trailer Components",
    title: "Repair And Reinforcement Components",
    copy: "Trailer repair support for frames, hitches, cross members, reinforcements, and structural welding.",
    fitment: "Trailer repair / structural support",
    material: "Steel and aluminum",
    use: "Repair, reinforcement, replacement",
    status: "Review required",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/trailer-repair-user_a0ea39bf.jpg",
    alt: "Trailer repair and structural fabrication work",
    caption: "Trailer repair / reinforcement",
    parts: ["Frame repair", "Cross-member replacement", "Hitch repair", "Reinforcement plates", "Structural welding"],
  },
  {
    id: "overland",
    label: "Overland Parts",
    title: "Field-Ready Accessories And Mounting",
    copy: "Overland accessories, utility mounts, tank support, brackets, and practical hardware made to fit the vehicle.",
    fitment: "Custom overland applications",
    material: "Aluminum, steel, stainless",
    use: "Storage, tanks, accessories, utility hardware",
    status: "Request build review",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/fabrication-shop-v2-2JfevkRadwYjNzsMAGApkz.webp",
    alt: "Fabrication shop floor with metalworking equipment",
    caption: "Overland component planning",
    parts: ["Overland mounts", "Accessory brackets", "Storage support", "Tank mounts", "Field-use hardware"],
  },
  {
    id: "oneoff",
    label: "One-Off Fabrication",
    title: "Custom Parts From Idea To Metal",
    copy: "When the part does not exist, ADK can measure, model, cut, weld, test fit, and finish the solution.",
    fitment: "Project-specific",
    material: "Steel, stainless, aluminum, titanium, magnesium",
    use: "Custom repairs, prototypes, rare parts",
    status: "Send build request",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/laser-cutting-user_be584be4.jpg",
    alt: "Laser cut custom metal fabrication detail",
    caption: "CAD to metal / one-off fabrication",
    parts: ["Prototypes", "One-off metalwork", "Laser cut parts", "Custom assemblies", "Specialty material work"],
  },
];

let ecommerceProducts = Array.isArray(window.ADK_PRODUCTS) && window.ADK_PRODUCTS.length
  ? window.ADK_PRODUCTS
  : defaultProductData.map((product, index) => ({
      id: product.id,
      slug: product.id,
      name: product.title,
      category: product.label,
      shortDescription: product.copy,
      description: product.copy,
      images: [product.image],
      price: index % 2 === 0 ? 625 + index * 180 : null,
      requestPricing: index % 2 !== 0,
      status: index % 2 === 0 ? "Built to Order" : "Request Pricing",
      inventory: index % 2 === 0 ? 2 + index : 0,
      fitment: product.fitment,
      material: product.material,
      leadTime: index % 2 === 0 ? "3-5 weeks" : "Quote required",
      buildNotes: product.caption,
      specifications: product.parts || [],
      featured: index < 3,
    }));

window.ADKSetProducts = function ADKSetProducts(products) {
  if (!Array.isArray(products) || !products.length) return;
  ecommerceProducts = products;
  const categoryWrap = document.querySelector("[data-store-categories]");
  const filterWrap = document.querySelector("[data-store-filters]");
  if (categoryWrap) categoryWrap.innerHTML = "";
  if (filterWrap) filterWrap.innerHTML = "";
  renderStore();
  renderProductDetail();
  renderCart();
};

const defaultGalleryData = [
  {
    id: "weld-detail",
    category: "weld",
    size: "span-2",
    title: "TIG Weld Detail",
    note: "Controlled heat / shop finish",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/hero-welding-v2-Dwy2UyuPXnV2BT8WswKmAm.webp",
    alt: "Welder creating controlled sparks in a fabrication shop",
  },
  {
    id: "cad-to-metal",
    category: "cad",
    size: "",
    title: "CAD To Metal",
    note: "Cut profiles / brackets",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/laser-cutting-user_be584be4.jpg",
    alt: "Laser cut metal component detail",
  },
  {
    id: "trailer-repair",
    category: "repair",
    size: "tall",
    title: "Trailer Repair",
    note: "Structural reinforcement",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/trailer-repair-user_a0ea39bf.jpg",
    alt: "Trailer repair and structural fabrication work",
  },
  {
    id: "air-ride-component",
    category: "truck",
    size: "",
    title: "Air Ride Component",
    note: "Steel / Peterbilt fitment",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/air-ride-user_6d45a40e.jpg",
    alt: "Air ride suspension fabrication components",
  },
  {
    id: "tank-product",
    category: "tank",
    size: "",
    title: "Tank Product",
    note: "Aluminum / shop-built",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/coolant-tank-v1_c26f55db.png",
    alt: "Custom fabricated cooling tank component",
  },
  {
    id: "overland-finished",
    category: "overland",
    size: "wide",
    title: "Overland / Finished Parts",
    note: "Measure / mockup / build",
    image:
      "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/fabrication-shop-v2-2JfevkRadwYjNzsMAGApkz.webp",
    alt: "Fabrication shop floor with work tables and metalworking equipment",
  },
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function readStoredList(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredList(key, list) {
  window.localStorage.setItem(key, JSON.stringify(list));
}

function getProducts() {
  return readStoredList(storageKeys.products, defaultProductData);
}

function getGalleryItems() {
  return readStoredList(storageKeys.gallery, defaultGalleryData);
}

function renderSpatialStore(activeId) {
  const switcher = document.querySelector("[data-store-switcher]");
  const products = getProducts();
  if (!switcher || !products.length) return;

  const activeProduct = products.find((product) => product.id === activeId) || products[0];
  const image = document.querySelector("[data-store-image]");
  const status = document.querySelector("[data-store-status]");
  const label = document.querySelector("[data-store-label]");
  const title = document.querySelector("[data-store-title]");
  const copy = document.querySelector("[data-store-copy]");
  const fitment = document.querySelector("[data-store-fitment]");
  const material = document.querySelector("[data-store-material]");
  const use = document.querySelector("[data-store-use]");
  const readiness = document.querySelector("[data-store-readiness]");
  const parts = document.querySelector("[data-store-products]");

  document.querySelector("[data-spatial-store]")?.style.setProperty("--store-accent", activeProduct.accent || "#315e74");

  if (image) {
    image.classList.add("is-changing");
    window.setTimeout(() => {
      image.src = activeProduct.image;
      image.alt = activeProduct.alt || activeProduct.title;
      image.classList.remove("is-changing");
    }, prefersReducedMotion ? 0 : 120);
  }

  if (status) status.textContent = activeProduct.status || "Request pricing";
  if (label) label.textContent = activeProduct.label;
  if (title) title.textContent = activeProduct.title;
  if (copy) copy.textContent = activeProduct.copy;
  if (fitment) fitment.textContent = activeProduct.fitment;
  if (material) material.textContent = activeProduct.material;
  if (use) use.textContent = activeProduct.use;
  if (readiness) readiness.textContent = activeProduct.status || "Request pricing";
  if (parts) {
    parts.innerHTML = (activeProduct.parts || [])
      .map((part) => `<span>${escapeHtml(part)}</span>`)
      .join("");
  }

  switcher.innerHTML = products
    .map(
      (product) => `
        <button type="button" role="tab" aria-selected="${product.id === activeProduct.id}" data-store-product="${escapeHtml(product.id)}">
          <span>${escapeHtml(product.label)}</span>
          <small>${escapeHtml(product.status || "Request pricing")}</small>
        </button>
      `,
    )
    .join("");

  switcher.querySelectorAll("[data-store-product]").forEach((button) => {
    button.addEventListener("click", () => renderSpatialStore(button.dataset.storeProduct));
  });
}

renderSpatialStore();

const materialData = {
  steel: {
    label: "Steel",
    title: "Structural fabrication with repeatable fitment.",
    use: "Brackets, trailer repair, mounts, chassis-related fabrication.",
    process: "Fit-up, weld access, load path, and finish prep all matter.",
    consideration: "Strength is only useful when the part also fits and can be serviced.",
    capability: "Cut, weld, reinforce, mock up, test fit, and finish.",
    image: "/assets/materials/steel-fabrication-coupon.jpg",
    alt: "Steel fabrication coupon on a dark ADK-style workbench",
  },
  stainless: {
    label: "Stainless",
    title: "Clean TIG work for corrosion-resistant assemblies.",
    use: "Tanks, assemblies, detail parts, and corrosion-resistant fabrication.",
    process: "Clean prep, controlled heat, and finish discipline keep the work clean.",
    consideration: "Contamination and poor heat control show quickly on stainless.",
    capability: "TIG welding, fit-up, detail fabrication, and tank-related work.",
    image: "/assets/materials/stainless-fabrication-plate.jpg",
    alt: "Brushed stainless steel fabrication plate on a dark workbench",
  },
  aluminum: {
    label: "Aluminum",
    title: "Lightweight fabrication with controlled prep.",
    use: "Mounts, tanks, brackets, overland components, and lightweight parts.",
    process: "Clean prep, proper heat control, and the right welding process are critical.",
    consideration: "Fit-up and cleanliness matter before the arc starts.",
    capability: "Aluminum fabrication, TIG welding, tanks, brackets, and custom components.",
    image: "/assets/materials/aluminum-bracket-blank.jpg",
    alt: "Aluminum fabricated bracket blank with pilot holes on a workbench",
  },
  titanium: {
    label: "Titanium",
    title: "Specialty fabrication where cleanliness drives quality.",
    use: "Specialty parts where weight, strength, and corrosion resistance matter.",
    process: "Clean handling, controlled heat, and shielding discipline are required.",
    consideration: "Titanium rewards process control and punishes shortcuts.",
    capability: "Specialty TIG work and controlled fabrication planning.",
    image: "/assets/materials/titanium-fabrication-sample.jpg",
    alt: "Titanium fabrication sample with subtle heat tint on a workbench",
  },
  magnesium: {
    label: "Magnesium",
    title: "Specialty metalwork that requires shop judgment.",
    use: "Specialty components and repair contexts where magnesium is required.",
    process: "Material identification, careful prep, and process control come first.",
    consideration: "Not every project is a fit. ADK reviews the job before committing.",
    capability: "Specialty fabrication review, welding support, and process planning.",
    image: "/assets/materials/magnesium-alloy-sample.jpg",
    alt: "Magnesium alloy fabrication sample on a dark workbench",
  },
};

const materialTabs = document.querySelectorAll("button[data-material]");
const materialSwatch = document.querySelector("[data-swatch]");
const materialImage = document.querySelector("[data-material-image]");
const materialAssetPath = (path) => {
  if (window.location.protocol !== "file:") return path;
  return path.replace(/^\/assets\//, "../assets/");
};

function setMaterial(key) {
  const material = materialData[key];
  if (!material) return;

  materialTabs.forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.material === key));
  });

  if (materialSwatch) {
    materialSwatch.className = `material-swatch ${key}`;
  }

  if (materialImage && material.image) {
    materialImage.classList.remove("is-loaded");
    materialImage.src = materialAssetPath(material.image);
    materialImage.alt = material.alt || `${material.label} fabrication material sample`;
  }

  document.querySelector("[data-material-label]").textContent = material.label;
  document.querySelector("[data-material-title]").textContent = material.title;
  document.querySelector("[data-material-use]").textContent = material.use;
  document.querySelector("[data-material-process]").textContent = material.process;
  document.querySelector("[data-material-consideration]").textContent = material.consideration;
  document.querySelector("[data-material-capability]").textContent = material.capability;
}

materialTabs.forEach((tab) => {
  tab.addEventListener("click", () => setMaterial(tab.dataset.material));
});

if (materialImage) {
  materialImage.addEventListener("load", () => materialImage.classList.add("is-loaded"));
  if (materialImage.complete) materialImage.classList.add("is-loaded");
}

function renderGallery(activeFilter = "all") {
  const galleryGrid = document.querySelector("[data-gallery-grid]");
  if (!galleryGrid) return;

  galleryGrid.innerHTML = getGalleryItems()
    .map(
      (item) => `
        <figure class="${escapeHtml(item.size || "")} reveal is-visible" data-category="${escapeHtml(item.category || "weld")}">
          <img loading="lazy" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title)}" />
          <figcaption><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.note || "")}</small></figcaption>
        </figure>
      `,
    )
    .join("");

  filterGallery(activeFilter);
}

function filterGallery(activeFilter) {
  const portfolioItems = document.querySelectorAll(".masonry [data-category]");
  portfolioItems.forEach((item) => {
    const shouldShow = activeFilter === "all" || item.dataset.category === activeFilter;
    item.classList.toggle("is-hidden", !shouldShow);
  });
}

const filters = document.querySelectorAll("[data-filter]");

filters.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter || "all";
    filters.forEach((filterButton) => {
      filterButton.setAttribute("aria-pressed", String(filterButton === button));
    });
    filterGallery(filter);
  });
});

renderGallery();

function createId(prefix, title) {
  const slug = String(title || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  return `${prefix}-${slug || "item"}-${Date.now().toString(36)}`;
}

function renderAdminLists() {
  const productList = document.querySelector("[data-admin-products-list]");
  const galleryList = document.querySelector("[data-admin-gallery-list]");

  if (productList) {
    productList.innerHTML = getProducts()
      .map(
        (product) => `
          <div class="admin-list__row">
            <img src="${escapeHtml(product.image)}" alt="" loading="lazy" />
            <div>
              <strong>${escapeHtml(product.title)}</strong>
              <span>${escapeHtml(product.label)} · ${escapeHtml(product.status || "Request pricing")}</span>
            </div>
            <button type="button" data-remove-product="${escapeHtml(product.id)}">Remove</button>
          </div>
        `,
      )
      .join("");

    productList.querySelectorAll("[data-remove-product]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextProducts = getProducts().filter((product) => product.id !== button.dataset.removeProduct);
        writeStoredList(storageKeys.products, nextProducts.length ? nextProducts : defaultProductData);
        renderAdminLists();
        renderSpatialStore();
      });
    });
  }

  if (galleryList) {
    galleryList.innerHTML = getGalleryItems()
      .map(
        (item) => `
          <div class="admin-list__row">
            <img src="${escapeHtml(item.image)}" alt="" loading="lazy" />
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.category)} · ${escapeHtml(item.note || "")}</span>
            </div>
            <button type="button" data-remove-gallery="${escapeHtml(item.id)}">Remove</button>
          </div>
        `,
      )
      .join("");

    galleryList.querySelectorAll("[data-remove-gallery]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextGallery = getGalleryItems().filter((item) => item.id !== button.dataset.removeGallery);
        writeStoredList(storageKeys.gallery, nextGallery.length ? nextGallery : defaultGalleryData);
        renderAdminLists();
        renderGallery();
      });
    });
  }
}

const adminProductForm = document.querySelector("[data-admin-product-form]");
const adminGalleryForm = document.querySelector("[data-admin-gallery-form]");

adminProductForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(adminProductForm);
  const title = formData.get("title");
  const product = {
    id: createId("part", title),
    label: String(formData.get("label") || "").trim(),
    title: String(title || "").trim(),
    copy: String(formData.get("copy") || "").trim(),
    fitment: String(formData.get("fitment") || "Custom / review required").trim(),
    material: String(formData.get("material") || "Shop-selected material").trim(),
    use: String(formData.get("use") || "Fitment, function, and real use").trim(),
    status: String(formData.get("status") || "Request pricing").trim(),
    image: String(formData.get("image") || "").trim(),
    alt: String(formData.get("alt") || title || "ADK fabricated part").trim(),
    caption: String(title || "ADK product").trim(),
    parts: String(formData.get("parts") || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  };

  writeStoredList(storageKeys.products, [...getProducts(), product]);
  adminProductForm.reset();
  renderAdminLists();
  renderSpatialStore(product.id);
});

adminGalleryForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(adminGalleryForm);
  const title = formData.get("title");
  const item = {
    id: createId("gallery", title),
    category: String(formData.get("category") || "weld"),
    size: String(formData.get("size") || ""),
    title: String(title || "").trim(),
    note: String(formData.get("note") || "").trim(),
    image: String(formData.get("image") || "").trim(),
    alt: String(formData.get("alt") || title || "ADK shop work").trim(),
  };

  writeStoredList(storageKeys.gallery, [...getGalleryItems(), item]);
  adminGalleryForm.reset();
  renderAdminLists();
  renderGallery();
});

document.querySelector("[data-admin-reset-products]")?.addEventListener("click", () => {
  writeStoredList(storageKeys.products, defaultProductData);
  renderAdminLists();
  renderSpatialStore();
});

document.querySelector("[data-admin-reset-gallery]")?.addEventListener("click", () => {
  writeStoredList(storageKeys.gallery, defaultGalleryData);
  renderAdminLists();
  renderGallery();
});

renderAdminLists();

const cartKey = "adk.store.cart";

function formatPrice(value) {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
    : "Request Pricing";
}

function getCart() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cartKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setCart(cart) {
  window.localStorage.setItem(cartKey, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  if (window.ADKShopify?.isConfigured?.()) {
    window.ADKShopify.getCart?.().then((cart) => {
      document.querySelectorAll("[data-cart-count]").forEach((node) => {
        node.textContent = String(cart?.totalQuantity || 0);
      });
    }).catch(() => {
      document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = "0"; });
    });
    return;
  }
  const count = getCart().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(count);
  });
}

function productCard(product, compact = false) {
  const hasFixedPrice = !product.requestPricing && typeof product.price === "number" && (product.inventory === null || product.inventory > 0);
  const canBuy = hasFixedPrice && (product.variantId || product.source === "local-fallback" || !window.ADKShopify?.isConfigured?.());
  const status = product.status || (canBuy ? "In Stock" : "Request Pricing");
  const reviewNote = canBuy
    ? "Fixed-price products move through secure Shopify checkout when connected."
    : "Fitment review recommended: send truck details, photos, and measurements before pricing.";
  return `
    <article class="store-card ${compact ? "store-card--compact" : ""}" data-category="${escapeHtml(product.category)}" data-product-id="${escapeHtml(product.id)}">
      <a class="store-card__image" href="/store/${escapeHtml(product.slug)}">
        <img loading="lazy" src="${escapeHtml(product.images?.[0] || "")}" alt="${escapeHtml(product.name)}" />
        <span>${escapeHtml(status)}</span>
      </a>
      <div class="store-card__body">
        <p class="eyebrow">${escapeHtml(product.category)}</p>
        <h3><a href="/store/${escapeHtml(product.slug)}">${escapeHtml(product.name)}</a></h3>
        <p>${escapeHtml(product.shortDescription)}</p>
        <dl class="store-card__specs">
          <div><dt>Fitment</dt><dd>${escapeHtml(product.fitment)}</dd></div>
          <div><dt>Material</dt><dd>${escapeHtml(product.material)}</dd></div>
          <div><dt>Lead Time</dt><dd>${escapeHtml(product.leadTime || "Confirmed at checkout")}</dd></div>
          <div><dt>Price</dt><dd>${formatPrice(product.price)}</dd></div>
        </dl>
        <p class="store-card__note">${escapeHtml(reviewNote)}</p>
        <div class="store-card__actions">
          <a class="text-link" href="/store/${escapeHtml(product.slug)}">View Product</a>
          ${
            canBuy
              ? `<button class="button line-button" type="button" data-add-cart="${escapeHtml(product.id)}">Add To Cart</button>`
              : `<a class="button line-button" href="/build-request?product=${encodeURIComponent(product.slug || product.handle || product.id)}&intent=fitment-review">Request Fitment Review</a>`
          }
        </div>
      </div>
    </article>
  `;
}

function getFilteredProducts() {
  const search = document.querySelector("[data-store-search]")?.value?.toLowerCase().trim() || "";
  const category = document.querySelector("[data-store-categories] button[aria-selected='true']")?.dataset.category || "All";
  const activeChip = document.querySelector("[data-store-filters] button[aria-pressed='true']")?.dataset.filter || "All";
  let products = ecommerceProducts.filter((product) => {
    const haystack = `${product.name} ${product.category} ${product.shortDescription} ${product.fitment} ${product.material} ${product.status}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesCategory = category === "All" || product.category === category;
    const matchesChip =
      activeChip === "All" ||
      product.status === activeChip ||
      product.category.includes(activeChip) ||
      product.fitment.includes(activeChip);
    return matchesSearch && matchesCategory && matchesChip;
  });
  const sort = document.querySelector("[data-store-sort]")?.value || "Featured";
  if (sort === "Price: Low to High") products = products.sort((a, b) => (a.price ?? 999999) - (b.price ?? 999999));
  if (sort === "Price: High to Low") products = products.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  if (sort === "Newest") products = products.slice().reverse();
  if (sort === "Availability") products = products.sort((a, b) => Number(!b.requestPricing && b.availableForSale !== false) - Number(!a.requestPricing && a.availableForSale !== false));
  if (sort === "Featured") products = products.sort((a, b) => Number(b.featured) - Number(a.featured));
  return products;
}

function renderStore() {
  const grid = document.querySelector("[data-store-grid]");
  if (!grid) return;
  const categories = ["All", ...new Set(ecommerceProducts.map((product) => product.category)), "Merch / Accessories"];
  const chips = ["All", "In Stock", "Built to Order", "Request Pricing", "Air Ride", "Overland", "Trailer", "Peterbilt"];
  const categoryWrap = document.querySelector("[data-store-categories]");
  const filterWrap = document.querySelector("[data-store-filters]");
  if (categoryWrap && !categoryWrap.children.length) {
    const requestedCategory = new URLSearchParams(window.location.search).get("category");
    categoryWrap.innerHTML = categories
      .map((category, index) => {
        const selected = requestedCategory ? category.toLowerCase().includes(requestedCategory.replace(/-/g, " ").toLowerCase()) : index === 0;
        return `<button type="button" aria-selected="${selected}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`;
      })
      .join("");
    if (!categoryWrap.querySelector("[aria-selected='true']")) {
      categoryWrap.querySelector("button")?.setAttribute("aria-selected", "true");
    }
  }
  if (filterWrap && !filterWrap.children.length) {
    filterWrap.innerHTML = chips
      .map((chip, index) => `<button type="button" aria-pressed="${index === 0}" data-filter="${escapeHtml(chip)}">${escapeHtml(chip)}</button>`)
      .join("");
  }
  const products = getFilteredProducts();
  grid.innerHTML = products.length
    ? products.map((product) => productCard(product)).join("")
    : `<div class="store-empty"><p class="eyebrow">No Match</p><h2>No products match that filter.</h2><p>Try a different search, or send ADK a build request for custom work.</p><a class="button line-button" href="/build-request">Request A Build</a></div>`;
}

document.querySelector("[data-store-search]")?.addEventListener("input", renderStore);
document.querySelector("[data-store-sort]")?.addEventListener("change", renderStore);
document.querySelector("[data-store-categories]")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  event.currentTarget.querySelectorAll("button").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
  renderStore();
});
document.querySelector("[data-store-filters]")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  event.currentTarget.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  renderStore();
});

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-cart], [data-detail-primary]");
  if (!addButton) return;
  const product = ecommerceProducts.find((item) => item.id === addButton.dataset.addCart || item.id === addButton.dataset.productId);
  if (!product) return;
  if (product.requestPricing || typeof product.price !== "number" || (window.ADKShopify?.isConfigured?.() && !product.variantId)) {
    window.location.href = `/build-request?product=${encodeURIComponent(product.slug || product.handle || product.id)}&intent=fitment-review`;
    return;
  }
  const quantity = Number(document.querySelector("[data-detail-qty]")?.value || 1);
  const originalText = addButton.textContent;
  addButton.disabled = true;
  addButton.textContent = "Adding";
  if (window.ADKShopify?.isConfigured?.() && product.variantId) {
    window.ADKShopify.addToCart(product.variantId, quantity)
      .then(() => {
        addButton.textContent = "Added";
        updateCartCount();
      })
      .catch((error) => {
        addButton.textContent = error.message.includes("variant") ? "Select Variant" : "Cart Error";
      })
      .finally(() => {
        window.setTimeout(() => {
          addButton.disabled = false;
          addButton.textContent = originalText || "Add To Cart";
        }, 1100);
      });
    return;
  }
  const cart = getCart();
  const existing = cart.find((item) => item.id === product.id);
  if (existing) existing.quantity += quantity;
  else cart.push({ id: product.id, quantity });
  setCart(cart);
  addButton.textContent = "Added";
  window.setTimeout(() => {
    addButton.disabled = false;
    addButton.textContent = originalText || "Add To Cart";
  }, 900);
});

function renderProductDetail() {
  const detail = document.querySelector("[data-product-detail]");
  if (!detail) return;
  const slug = detail.dataset.productSlug || window.location.pathname.split("/").filter(Boolean).pop();
  const product = ecommerceProducts.find((item) => item.slug === slug);
  if (!product) return;
  const primary = detail.querySelector("[data-detail-primary]");
  detail.querySelector("[data-detail-image]").src = product.images[0];
  detail.querySelector("[data-detail-image]").alt = product.name;
  detail.querySelector("[data-detail-category]").textContent = product.category;
  detail.querySelector("[data-detail-name]").textContent = product.name;
  detail.querySelector("[data-detail-description]").textContent = product.description;
  detail.querySelector("[data-detail-price]").textContent = formatPrice(product.price);
  detail.querySelector("[data-detail-status]").textContent = product.status;
  detail.querySelector("[data-detail-fitment]").textContent = product.fitment;
  detail.querySelector("[data-detail-material]").textContent = product.material;
  detail.querySelector("[data-detail-fitment-text]").textContent = product.fitment;
  detail.querySelector("[data-detail-material-text]").textContent = product.material;
  detail.querySelector("[data-detail-lead]").textContent = product.leadTime;
  const shipping = detail.querySelector("[data-detail-shipping]");
  if (shipping) shipping.textContent = product.shippingNotes || "Secure checkout powered by Shopify. Pickup can be arranged by ADK.";
  detail.querySelector("[data-detail-notes]").textContent = product.buildNotes;
  detail.querySelector("[data-detail-specs]").innerHTML = (product.specifications || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  detail.querySelector("[data-detail-thumbs]").innerHTML = (product.images || [])
    .map((image) => `<button type="button"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)} thumbnail" /></button>`)
    .join("");
  primary.dataset.productId = product.id;
  primary.dataset.addCart = product.id;
  const detailCanBuy = !product.requestPricing && typeof product.price === "number" && (product.variantId || product.source === "local-fallback" || !window.ADKShopify?.isConfigured?.());
  primary.textContent = detailCanBuy ? "Add To Cart" : "Request Fitment Review";
  const buyNow = detail.querySelector("[data-buy-now]");
  if (buyNow) {
    buyNow.hidden = !detailCanBuy;
    buyNow.dataset.productId = product.id;
  }
  const variantWrap = detail.querySelector("[data-variant-wrap]");
  if (variantWrap && Array.isArray(product.variants) && product.variants.length > 1) {
    variantWrap.innerHTML = `<label>Variant<select data-product-variant>${product.variants
      .map((variant) => `<option value="${escapeHtml(variant.id)}" ${variant.id === product.variantId ? "selected" : ""} ${variant.availableForSale ? "" : "disabled"}>${escapeHtml(variant.title)}${variant.availableForSale ? "" : " — sold out"}</option>`)
      .join("")}</select></label>`;
    variantWrap.querySelector("select")?.addEventListener("change", (event) => {
      product.variantId = event.target.value;
    });
  }
  detail.querySelector("[data-detail-thumbs]")?.addEventListener("click", (event) => {
    const img = event.target.closest("img");
    if (img) detail.querySelector("[data-detail-image]").src = img.src;
  });
  const related = document.querySelector("[data-related-products]");
  if (related) {
    related.innerHTML = ecommerceProducts
      .filter((item) => item.id !== product.id && item.category === product.category)
      .slice(0, 3)
      .map((item) => productCard(item, true))
      .join("");
  }
}

document.querySelector("[data-buy-now]")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const product = ecommerceProducts.find((item) => item.id === button.dataset.productId);
  if (!product?.variantId) return;
  button.disabled = true;
  button.textContent = "Opening Checkout";
  try {
    if (!window.ADKShopify?.isConfigured?.()) throw new Error("Shopify checkout is not connected yet.");
    await window.ADKShopify.addToCart(product.variantId, Number(document.querySelector("[data-detail-qty]")?.value || 1));
    const url = await window.ADKShopify.getCheckoutUrl();
    if (!url) throw new Error("Checkout unavailable.");
    window.location.href = url;
  } catch (error) {
    button.textContent = error.message || "Checkout Error";
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = "Buy Now";
    }, 1400);
  }
});

function renderCart() {
  const cartItems = document.querySelector("[data-cart-items]");
  if (!cartItems) return;
  if (window.ADKShopify?.isConfigured?.()) {
    cartItems.innerHTML = `<div class="store-empty"><p class="eyebrow">Cart</p><h2>Loading Shopify cart…</h2><p>Secure checkout powered by Shopify.</p></div>`;
    window.ADKShopify.getCart().then((cart) => {
      if (!cart?.lines?.length) {
        cartItems.innerHTML = `<div class="store-empty"><p class="eyebrow">Cart Empty</p><h2>No Shopify products are in the cart.</h2><p>Request-pricing products move through the quote flow.</p><a class="button line-button" href="/store">Shop ADK</a></div>`;
        document.querySelector("[data-cart-subtotal]").textContent = "$0.00";
        updateCartCount();
        return;
      }
      cartItems.innerHTML = cart.lines.map((item) => `
        <article class="cart-row">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title)}" />
          <div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.variantTitle)} · ${window.ADKShopify.formatMoney(item.price)}</p></div>
          <label>Qty<input type="number" min="1" value="${item.quantity}" data-shopify-cart-qty="${escapeHtml(item.id)}" /></label>
          <strong>${window.ADKShopify.formatMoney((item.price?.amount || 0) * item.quantity)}</strong>
          <button type="button" data-shopify-cart-remove="${escapeHtml(item.id)}">Remove</button>
        </article>
      `).join("");
      document.querySelector("[data-cart-subtotal]").textContent = window.ADKShopify.formatMoney(cart.subtotal);
      document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = String(cart.totalQuantity || 0); });
    }).catch(() => {
      cartItems.innerHTML = `<div class="store-empty"><p class="eyebrow">Cart Error</p><h2>The Shopify cart could not be loaded.</h2><p>Try refreshing the page, or contact ADK directly.</p></div>`;
    });
    return;
  }
  const cart = getCart();
  const rows = cart.map((item) => ({ ...item, product: ecommerceProducts.find((product) => product.id === item.id) })).filter((item) => item.product);
  const subtotal = rows.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  cartItems.innerHTML = rows.length
    ? rows
        .map(
          (item) => `
          <article class="cart-row">
            <img src="${escapeHtml(item.product.images[0])}" alt="${escapeHtml(item.product.name)}" />
            <div><h2>${escapeHtml(item.product.name)}</h2><p>${escapeHtml(item.product.category)} · ${formatPrice(item.product.price)}</p></div>
            <label>Qty<input type="number" min="1" value="${item.quantity}" data-cart-qty="${escapeHtml(item.id)}" /></label>
            <strong>${formatPrice(item.product.price * item.quantity)}</strong>
            <button type="button" data-cart-remove="${escapeHtml(item.id)}">Remove</button>
          </article>
        `,
        )
        .join("")
    : `<div class="store-empty"><p class="eyebrow">Cart Empty</p><h2>No fixed-price products are in the cart.</h2><p>Request-pricing products move through the quote flow.</p><a class="button line-button" href="/store">Shop ADK</a></div>`;
  document.querySelector("[data-cart-subtotal]").textContent = formatPrice(subtotal);
}

document.querySelector("[data-cart-items]")?.addEventListener("input", (event) => {
  const shopifyInput = event.target.closest("[data-shopify-cart-qty]");
  if (shopifyInput && window.ADKShopify?.isConfigured?.()) {
    window.ADKShopify.updateLineQuantity(shopifyInput.dataset.shopifyCartQty, Math.max(1, Number(shopifyInput.value || 1))).then(renderCart).catch(renderCart);
    return;
  }
  const input = event.target.closest("[data-cart-qty]");
  if (!input) return;
  const cart = getCart().map((item) => (item.id === input.dataset.cartQty ? { ...item, quantity: Math.max(1, Number(input.value || 1)) } : item));
  setCart(cart);
  renderCart();
});
document.querySelector("[data-cart-items]")?.addEventListener("click", (event) => {
  const shopifyButton = event.target.closest("[data-shopify-cart-remove]");
  if (shopifyButton && window.ADKShopify?.isConfigured?.()) {
    window.ADKShopify.updateLineQuantity(shopifyButton.dataset.shopifyCartRemove, 0).then(renderCart).catch(renderCart);
    return;
  }
  const button = event.target.closest("[data-cart-remove]");
  if (!button) return;
  setCart(getCart().filter((item) => item.id !== button.dataset.cartRemove));
  renderCart();
});

function renderAdminData() {
  document.querySelectorAll("[data-admin-total-products]").forEach((node) => (node.textContent = String(ecommerceProducts.length)));
  const table = document.querySelector("[data-admin-products-table]");
  if (table) {
    table.innerHTML = `<div class="admin-table__head"><span>Image</span><span>Name</span><span>Category</span><span>Price</span><span>Status</span><span>Inventory</span><span>Action</span></div>${ecommerceProducts
      .map(
        (product) => `<div class="admin-table__row"><img src="${escapeHtml(product.images[0])}" alt="" /><span>${escapeHtml(product.name)}</span><span>${escapeHtml(product.category)}</span><span>${formatPrice(product.price)}</span><span>${escapeHtml(product.status)}</span><span>${product.inventory}</span><a href="/admin/products/[id]">Edit</a></div>`,
      )
      .join("")}`;
  }
}

document.querySelector("[data-toggle-password]")?.addEventListener("click", (event) => {
  const input = document.querySelector("[data-admin-password]");
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
  event.currentTarget.textContent = input.type === "password" ? "Show" : "Hide";
});

document.querySelector("[data-admin-login-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const note = document.querySelector("[data-admin-login-note]");
  const button = form.querySelector("button[type='submit']");
  note.textContent = "Checking admin credentials...";
  if (button) button.textContent = "Checking";

  fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: form.elements.email.value,
      password: form.elements.password.value,
    }),
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || "Unable to sign in.");
      note.textContent = "Access confirmed. Opening admin dashboard...";
      window.setTimeout(() => window.location.assign("/admin"), prefersReducedMotion ? 0 : 350);
    })
    .catch((error) => {
      note.textContent = error.message;
      if (button) button.textContent = "Sign in";
    });
});

document.querySelector("[data-admin-logout]")?.addEventListener("click", () => {
  fetch("/api/admin/logout", { method: "POST" }).finally(() => window.location.assign("/admin/login"));
});

document.querySelector("[data-admin-publish]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const status = document.querySelector("[data-admin-publish-status]");
  button.disabled = true;
  button.textContent = "Publishing";
  status.textContent = "Checking Git status, pushing to GitHub, then starting Railway deploy...";

  fetch("/api/admin/publish", { method: "POST" })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || "Publish failed.");
      const summary = Array.isArray(data.steps)
        ? data.steps.map((step) => `${step.name}: ${step.output}`).join(" ")
        : data.message;
      status.textContent = data.workflowUrl ? `${summary} Track it here: ${data.workflowUrl}` : summary;
    })
    .catch((error) => {
      status.textContent = error.message;
    })
    .finally(() => {
      button.disabled = false;
      button.textContent = "Publish";
    });
});

renderStore();
renderProductDetail();
renderCart();
renderAdminData();
updateCartCount();

const buildForm = document.querySelector(".build-form");
const formNote = document.querySelector(".form-note");

if (buildForm && formNote) {
  const requestedProduct = new URLSearchParams(window.location.search).get("product");
  if (requestedProduct) {
    const projectField = buildForm.elements.project;
    const needField = buildForm.elements.need;
    const product = ecommerceProducts.find((item) => item.slug === requestedProduct || item.handle === requestedProduct || item.id === requestedProduct);
    if (projectField && !projectField.value) projectField.value = product?.fitment || requestedProduct;
    if (needField && !needField.value) {
      needField.value = product
        ? `Quote request for ${product.name || product.title} (${product.slug || product.handle}). Product URL: ${window.location.origin}/store/${product.slug || product.handle}`
        : `Quote request for ADK store product: ${requestedProduct}. Product URL: ${window.location.origin}/store/${requestedProduct}`;
    }
  }

  buildForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const isContactForm = buildForm.classList.contains("contact-form");
    const submitBtn = buildForm.querySelector("button[type='submit']");
    const originalLabel = submitBtn?.textContent;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Sending…"; }
    formNote.textContent = "Sending…";
    formNote.style.color = "";

    const formData = new FormData(buildForm);
    const productForQuote = new URLSearchParams(window.location.search).get("product");
    const endpoint = isContactForm || productForQuote ? "/api/public/quote-request" : "/api/public/build-request";

    const payload = isContactForm
      ? {
          contact_name: formData.get("name") || "",
          contact_email: formData.get("email") || "",
          contact_phone: formData.get("phone") || "",
          product_name: formData.get("project") || formData.get("subject") || "",
          message: formData.get("need") || formData.get("message") || "",
          source: "contact-form",
        }
      : productForQuote
      ? {
          contact_name: formData.get("name") || "",
          contact_email: formData.get("email") || "",
          contact_phone: formData.get("phone") || "",
          product_handle: productForQuote,
          product_url: `${window.location.origin}/store/${productForQuote}`,
          product_name: productForQuote,
          vehicle: formData.get("project") || "",
          message: formData.get("need") || "",
          timeline: formData.get("timeline") || "",
          budget: formData.get("budget") || "",
          source: "store-request-pricing",
        }
      : {
          contact_name: formData.get("name") || "",
          contact_email: formData.get("email") || "",
          contact_phone: formData.get("phone") || "",
          vehicle: formData.get("project") || "",
          scope: formData.get("need") || "",
          timeline: formData.get("timeline") || "",
          budget: formData.get("budget") || "",
          source: "build-request-form",
        };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || `Submit failed (${response.status})`);
      formNote.textContent = isContactForm
        ? "Got it — ADK will reply by email or phone."
        : "Build request received. ADK will follow up directly.";
      formNote.style.color = "var(--blueprint, #315e74)";
      buildForm.reset();
      if (submitBtn) submitBtn.textContent = isContactForm ? "Message Sent" : "Request Sent";
    } catch (error) {
      formNote.textContent = `Couldn't submit: ${error.message}. Call ADK at (702) 810-9021.`;
      formNote.style.color = "#9f2632";
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
    }
  });
}
