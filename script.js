const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const header = document.querySelector("[data-site-header]");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const headerContact = document.querySelector(".header-contact");
const navDropdowns = document.querySelectorAll("[data-nav-dropdown]");

function setHeaderState() {
  header?.classList.toggle("is-condensed", window.scrollY > 18);
}

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

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
    "/parts": "nav-parts-panel",
    "/shop-work": "nav-work-panel",
  };
  const activeDropdownTrigger = dropdownControlByPath[currentPath]
    ? siteNav.querySelector(`[aria-controls="${dropdownControlByPath[currentPath]}"]`)
    : null;
  activeDropdownTrigger?.setAttribute("aria-current", "page");
}

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

const productData = {
  "air-ride": {
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
  mounts: {
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
  tanks: {
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
  trailers: {
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
  overland: {
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
  oneoff: {
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
};

const productTabs = document.querySelectorAll("[data-product]");
const productImage = document.querySelector("[data-product-image]");
const productCaption = document.querySelector("[data-product-caption]");
const productLabel = document.querySelector("[data-product-label]");
const productTitle = document.querySelector("[data-product-title]");
const productCopy = document.querySelector("[data-product-copy]");
const partList = document.querySelector(".part-list");

function setProduct(key) {
  const product = productData[key];
  if (!product) return;

  productTabs.forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.product === key));
  });

  productImage?.classList.add("is-changing");

  window.setTimeout(() => {
    if (productImage) {
      productImage.src = product.image;
      productImage.alt = product.alt;
      productImage.classList.remove("is-changing");
    }
    if (productCaption) productCaption.textContent = product.caption;
    if (productLabel) productLabel.textContent = product.label;
    if (productTitle) productTitle.textContent = product.title;
    if (productCopy) productCopy.textContent = product.copy;

    document.querySelector("[data-fitment]").textContent = product.fitment;
    document.querySelector("[data-product-material]").textContent = product.material;
    document.querySelector("[data-use]").textContent = product.use;
    document.querySelector("[data-status]").textContent = product.status;

    if (partList) {
      partList.innerHTML = product.parts.map((part) => `<span>${part}</span>`).join("");
    }
  }, prefersReducedMotion ? 0 : 160);
}

productTabs.forEach((tab) => {
  tab.addEventListener("click", () => setProduct(tab.dataset.product));
});

const materialData = {
  steel: {
    label: "Steel",
    title: "Structural fabrication with repeatable fitment.",
    use: "Brackets, trailer repair, mounts, chassis-related fabrication.",
    process: "Fit-up, weld access, load path, and finish prep all matter.",
    consideration: "Strength is only useful when the part also fits and can be serviced.",
    capability: "Cut, weld, reinforce, mock up, test fit, and finish.",
  },
  stainless: {
    label: "Stainless",
    title: "Clean TIG work for corrosion-resistant assemblies.",
    use: "Tanks, assemblies, detail parts, and corrosion-resistant fabrication.",
    process: "Clean prep, controlled heat, and finish discipline keep the work clean.",
    consideration: "Contamination and poor heat control show quickly on stainless.",
    capability: "TIG welding, fit-up, detail fabrication, and tank-related work.",
  },
  aluminum: {
    label: "Aluminum",
    title: "Lightweight fabrication with controlled prep.",
    use: "Mounts, tanks, brackets, overland components, and lightweight parts.",
    process: "Clean prep, proper heat control, and the right welding process are critical.",
    consideration: "Fit-up and cleanliness matter before the arc starts.",
    capability: "Aluminum fabrication, TIG welding, tanks, brackets, and custom components.",
  },
  titanium: {
    label: "Titanium",
    title: "Specialty fabrication where cleanliness drives quality.",
    use: "Specialty parts where weight, strength, and corrosion resistance matter.",
    process: "Clean handling, controlled heat, and shielding discipline are required.",
    consideration: "Titanium rewards process control and punishes shortcuts.",
    capability: "Specialty TIG work and controlled fabrication planning.",
  },
  magnesium: {
    label: "Magnesium",
    title: "Specialty metalwork that requires shop judgment.",
    use: "Specialty components and repair contexts where magnesium is required.",
    process: "Material identification, careful prep, and process control come first.",
    consideration: "Not every project is a fit. ADK reviews the job before committing.",
    capability: "Specialty fabrication review, welding support, and process planning.",
  },
};

const materialTabs = document.querySelectorAll("button[data-material]");
const materialSwatch = document.querySelector("[data-swatch]");

function setMaterial(key) {
  const material = materialData[key];
  if (!material) return;

  materialTabs.forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.material === key));
  });

  if (materialSwatch) {
    materialSwatch.className = `material-swatch ${key}`;
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

const filters = document.querySelectorAll("[data-filter]");
const portfolioItems = document.querySelectorAll(".masonry [data-category]");

filters.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filters.forEach((filterButton) => {
      filterButton.setAttribute("aria-pressed", String(filterButton === button));
    });

    portfolioItems.forEach((item) => {
      const shouldShow = filter === "all" || item.dataset.category === filter;
      item.classList.toggle("is-hidden", !shouldShow);
    });
  });
});

const buildForm = document.querySelector(".build-form");
const formNote = document.querySelector(".form-note");

if (buildForm && formNote) {
  buildForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const isContactForm = buildForm.classList.contains("contact-form");
    formNote.textContent = isContactForm
      ? "Message staged. Call ADK at (702) 810-9021 to connect this form to live contact."
      : "Build request staged. Call ADK at (702) 810-9021 to connect this form to live intake.";
    buildForm.querySelector("button[type='submit']").textContent = isContactForm
      ? "Message Staged"
      : "Request Staged";
  });
}
