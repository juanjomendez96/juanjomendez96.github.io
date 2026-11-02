const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let observer;
const observedElements = new WeakSet();

const SUPPORTED_LOCALES = ["en", "es"];
const DEFAULT_LOCALE = "en";
const LOCALE_STORAGE_KEY = "preferred-locale";
const THEME_STORAGE_KEY = "preferred-theme";
let currentLocale = DEFAULT_LOCALE;
let localeStrings = {};

const rootElement = document.documentElement;
const siteHeader = document.querySelector(".site-header");
const pipeline = document.querySelector(".pipeline");
const systemLightQuery = window.matchMedia("(prefers-color-scheme: light)");

const safeStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn("Unable to read from localStorage:", error);
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn("Unable to persist preference:", error);
    }
  },
};

const getNestedValue = (object, path) =>
  path.split(".").reduce((accumulator, segment) => {
    if (accumulator === undefined || accumulator === null) {
      return undefined;
    }
    return accumulator[segment];
  }, object);

const requestLocaleStrings = async (locale) => {
  const response = await fetch(`i18n/${locale}.json`);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
};

const fetchLocaleStrings = async (locale) => {
  try {
    return await requestLocaleStrings(locale);
  } catch (error) {
    if (locale !== DEFAULT_LOCALE) {
      return requestLocaleStrings(DEFAULT_LOCALE);
    }
    throw error;
  }
};

const applyLocaleStrings = (strings) => {
  if (!strings || typeof strings !== "object") {
    return;
  }

  const documentStrings = strings.document || {};
  if (typeof documentStrings.title === "string") {
    document.title = documentStrings.title;
  }
  if (typeof documentStrings.description === "string") {
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute("content", documentStrings.description);
    }
  }

  document.querySelectorAll("[data-i18n-key]").forEach((element) => {
    const key = element.dataset.i18nKey;
    const value = getNestedValue(strings, key);
    if (typeof value === "string") {
      element.textContent = value;
    }
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
    const mappings = element.dataset.i18nAttr
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean);

    mappings.forEach((mapping) => {
      const [attribute, key] = mapping.split(":").map((part) => part.trim());
      if (!attribute || !key) {
        return;
      }
      const value = getNestedValue(strings, key);
      if (typeof value === "string") {
        element.setAttribute(attribute, value);
      }
    });
  });
};

const loadLocaleStrings = async (locale) => {
  try {
    localeStrings = await fetchLocaleStrings(locale);
  } catch (error) {
    console.error(`Failed to load locale strings for "${locale}":`, error);
    localeStrings = {};
  }

  applyLocaleStrings(localeStrings);
};

const updateYear = (scope = document) => {
  const target =
    (scope instanceof Element || scope instanceof DocumentFragment ? scope.querySelector("#year") : null) ||
    document.getElementById("year");

  if (target) {
    target.textContent = new Date().getFullYear();
  }
};

const initAnimatedElements = (source = document) => {
  let elements = [];

  if (source instanceof Element || source instanceof Document || source instanceof DocumentFragment) {
    elements = Array.from(source.querySelectorAll("[data-animate]"));
    if (source instanceof Element && source.matches("[data-animate]")) {
      elements.unshift(source);
    }
  } else if (source instanceof NodeList || Array.isArray(source)) {
    elements = Array.from(source);
  }

  if (!elements.length) {
    return;
  }

  if (prefersReducedMotion.matches) {
    elements.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
            observedElements.delete(entry.target);
          }
        });
      },
      // Reveal once the top of an element is 12% inside the viewport. A ratio
      // threshold would never fire for sections taller than the screen.
      { threshold: 0, rootMargin: "0px 0px -12% 0px" }
    );
  }

  elements.forEach((el) => {
    if (!observedElements.has(el)) {
      observer.observe(el);
      observedElements.add(el);
    }
  });
};

// Children of [data-stagger] reveal one after another; --i drives the delay.
const applyStaggerIndices = (scope) => {
  scope.querySelectorAll("[data-stagger]").forEach((parent) => {
    Array.from(parent.children).forEach((child, index) => {
      child.style.setProperty("--i", index);
    });
  });
};

/* Theme ------------------------------------------------------------------ */

const getTheme = () => (rootElement.getAttribute("data-theme") === "light" ? "light" : "dark");

const applyTheme = (theme) => {
  rootElement.setAttribute("data-theme", theme);
  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.setAttribute("aria-pressed", String(theme === "light"));
  });
};

const initThemeToggle = () => {
  const button = document.querySelector(".theme-toggle");
  if (!button) {
    return;
  }

  // The inline script in <head> already resolved the theme; sync the button.
  applyTheme(getTheme());

  button.addEventListener("click", () => {
    const next = getTheme() === "light" ? "dark" : "light";

    if (!prefersReducedMotion.matches) {
      rootElement.classList.add("theme-transition");
      window.setTimeout(() => rootElement.classList.remove("theme-transition"), 400);
    }

    applyTheme(next);
    safeStorage.set(THEME_STORAGE_KEY, next);
  });

  // Follow the OS only until the visitor makes an explicit choice.
  systemLightQuery.addEventListener("change", (event) => {
    if (!safeStorage.get(THEME_STORAGE_KEY)) {
      applyTheme(event.matches ? "light" : "dark");
    }
  });
};

/* Pipeline, header and scroll-spy ------------------------------------------ */

let nodes = [];
let nodeMarks = [];
let spyTargets = [];
let pipelineTop = 0;
let pipelineHeight = 1;
let scrollFrame = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Document-space Y of the centre of a node's dot (its ::before pseudo-element).
const getDotCenter = (node) => {
  const dot = window.getComputedStyle(node, "::before");
  const top = parseFloat(dot.top) || 0;
  const size = parseFloat(dot.height) || 0;
  return node.getBoundingClientRect().top + window.scrollY + top + size / 2;
};

const layoutPipeline = () => {
  if (!pipeline || nodes.length < 2) {
    return;
  }

  nodeMarks = nodes.map(getDotCenter);
  pipelineTop = nodeMarks[0];
  pipelineHeight = Math.max(1, nodeMarks[nodeMarks.length - 1] - pipelineTop);

  const pageTop = pipeline.offsetParent
    ? pipeline.offsetParent.getBoundingClientRect().top + window.scrollY
    : 0;
  pipeline.style.top = `${pipelineTop - pageTop}px`;
  pipeline.style.height = `${pipelineHeight}px`;
};

const updateScrollEffects = () => {
  scrollFrame = 0;

  const scrollY = window.scrollY;
  const reduced = prefersReducedMotion.matches;
  const marker = scrollY + window.innerHeight * 0.55;

  if (siteHeader) {
    siteHeader.classList.toggle("is-scrolled", scrollY > 24);
  }

  if (pipeline) {
    const progress = reduced ? 1 : clamp((marker - pipelineTop) / pipelineHeight, 0, 1);
    pipeline.style.setProperty("--progress", progress.toFixed(4));
  }

  nodes.forEach((node, index) => {
    node.classList.toggle("is-reached", reduced || marker >= (nodeMarks[index] ?? Infinity));
  });

  const atBottom = scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  let current = null;
  spyTargets.forEach((item) => {
    if (item.target.getBoundingClientRect().top <= window.innerHeight * 0.35) {
      current = item;
    }
  });
  if (atBottom && spyTargets.length) {
    current = spyTargets[spyTargets.length - 1];
  }
  spyTargets.forEach((item) => {
    if (item === current) {
      item.link.setAttribute("aria-current", "true");
    } else {
      item.link.removeAttribute("aria-current");
    }
  });
};

const requestScrollUpdate = () => {
  if (!scrollFrame) {
    scrollFrame = window.requestAnimationFrame(updateScrollEffects);
  }
};

// Re-measure after partials (re)load, fonts settle, or the layout resizes.
const refreshScrollEffects = () => {
  nodes = Array.from(document.querySelectorAll(".hero, .section, .site-footer"));
  spyTargets = Array.from(navLinks)
    .filter((link) => link.hash)
    .map((link) => ({ link, target: document.querySelector(link.hash) }))
    .filter((item) => item.target);
  layoutPipeline();
  updateScrollEffects();
};

const initScrollEffects = () => {
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", () => {
    layoutPipeline();
    requestScrollUpdate();
  });

  const page = document.querySelector(".page");
  if (page && "ResizeObserver" in window) {
    new ResizeObserver(() => {
      layoutPipeline();
      requestScrollUpdate();
    }).observe(page);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refreshScrollEffects);
  }

  prefersReducedMotion.addEventListener("change", requestScrollUpdate);
};

const getInitialLocale = () => {
  const params = new URLSearchParams(window.location.search);
  const queryLocale = params.get("lang");
  if (queryLocale && SUPPORTED_LOCALES.includes(queryLocale)) {
    safeStorage.set(LOCALE_STORAGE_KEY, queryLocale);
    return queryLocale;
  }

  const storedLocale = safeStorage.get(LOCALE_STORAGE_KEY);
  if (storedLocale && SUPPORTED_LOCALES.includes(storedLocale)) {
    return storedLocale;
  }

  const navigatorLocale = navigator.language ? navigator.language.slice(0, 2).toLowerCase() : null;
  if (navigatorLocale && SUPPORTED_LOCALES.includes(navigatorLocale)) {
    return navigatorLocale;
  }

  return DEFAULT_LOCALE;
};

const setDocumentLanguage = (locale) => {
  document.documentElement.setAttribute("lang", locale);
};

const updateUrlLocaleParam = (locale) => {
  const url = new URL(window.location.href);
  if (locale === DEFAULT_LOCALE) {
    url.searchParams.delete("lang");
  } else {
    url.searchParams.set("lang", locale);
  }
  window.history.replaceState({}, "", url);
};

const markActiveLocaleButton = () => {
  document.querySelectorAll("[data-locale]").forEach((button) => {
    const isActive = button.dataset.locale === currentLocale;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

const requestPartial = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
};

const fetchPartial = async (name, locale) => {
  try {
    return await requestPartial(`partials/${locale}/${name}.html`);
  } catch (error) {
    if (locale !== DEFAULT_LOCALE) {
      return requestPartial(`partials/${DEFAULT_LOCALE}/${name}.html`);
    }
    throw error;
  }
};

const loadPartials = async () => {
  const containers = document.querySelectorAll("[data-partial]");
  if (!containers.length) {
    return;
  }

  await Promise.all(
    Array.from(containers).map(async (container) => {
      const name = container.dataset.partial;
      if (!name) {
        return;
      }

      container.classList.add("partial-container");

      try {
        const html = await fetchPartial(name, currentLocale);
        container.innerHTML = html.trim();
        applyStaggerIndices(container);
        const animatedTargets = Array.from(container.querySelectorAll("[data-animate]"));

        initAnimatedElements(animatedTargets);
      } catch (error) {
        console.error(`Failed to load partial "${name}" for locale "${currentLocale}":`, error);
      }
    })
  );

  updateYear();
  refreshScrollEffects();
};

const setLocale = async (locale) => {
  if (!locale || locale === currentLocale || !SUPPORTED_LOCALES.includes(locale)) {
    return;
  }

  currentLocale = locale;
  safeStorage.set(LOCALE_STORAGE_KEY, locale);
  setDocumentLanguage(locale);
  updateUrlLocaleParam(locale);
  markActiveLocaleButton();
  await Promise.all([loadLocaleStrings(locale), loadPartials()]);
  markActiveLocaleButton();
};

const initLocaleSwitcher = () => {
  const buttons = document.querySelectorAll("[data-locale]");
  if (!buttons.length) {
    return;
  }

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const { locale } = button.dataset;
      await setLocale(locale);
    });
  });

  markActiveLocaleButton();
};

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach((link) =>
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

document.addEventListener("click", (event) => {
  const backToTop = event.target instanceof Element ? event.target.closest(".back-to-top") : null;
  if (!backToTop) {
    return;
  }

  event.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

currentLocale = getInitialLocale();
setDocumentLanguage(currentLocale);
updateUrlLocaleParam(currentLocale);

initAnimatedElements(document);
updateYear();
loadLocaleStrings(currentLocale).catch((error) => {
  console.error("Failed to initialize locale strings:", error);
});
loadPartials().catch((error) => {
  console.error("Failed to load partials:", error);
});
initLocaleSwitcher();
initThemeToggle();
initScrollEffects();
