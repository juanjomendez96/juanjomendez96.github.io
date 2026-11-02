const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

/* Reveals ------------------------------------------------------------------
   Every block animates on its own as it scrolls into view, so there is always
   something happening as you go down the page. Elements that enter together are
   staggered through --d (see the CSS "Motion" section). */

const REVEAL_SELECTOR = [
  ".hero__content > :not(h1)",
  ".hero__visual",
  ".section__label",
  ".section__intro > :not(h2)",
  "[data-stagger] > *",
  ".footer__intro > :not(h2)",
  ".footer__contact",
  ".footer__meta",
].join(", ");

const handleReveals = (entries) => {
  entries
    .filter((entry) => entry.isIntersecting)
    .map((entry) => entry.target)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .forEach((element, index) => {
      element.style.setProperty("--d", Math.min(index, 6));
      element.classList.add("is-visible");
      revealObserver.unobserve(element);
    });
};

// Fire once the top of an element is 10% inside the viewport; a ratio threshold
// would never trigger for blocks taller than the screen.
const revealObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(handleReveals, { threshold: 0, rootMargin: "0px 0px -10% 0px" })
    : null;

// Splits a heading into masked words so they can slide up one after another.
const splitWords = (element) => {
  if (element.dataset.splitDone) {
    return;
  }

  const text = element.textContent.trim();
  const words = text.split(/\s+/);
  element.textContent = "";
  element.setAttribute("aria-label", text);

  words.forEach((word, index) => {
    const outer = document.createElement("span");
    outer.className = "w";
    outer.setAttribute("aria-hidden", "true");
    const inner = document.createElement("span");
    inner.className = "w__i";
    inner.style.setProperty("--w", index);
    inner.textContent = word;
    outer.append(inner);
    element.append(outer);
    if (index < words.length - 1) {
      element.append(" ");
    }
  });

  element.dataset.splitDone = "true";
  element.classList.add("split");
};

const initReveals = (scope) => {
  scope.querySelectorAll("[data-split]").forEach(splitWords);

  const blocks = Array.from(scope.querySelectorAll(REVEAL_SELECTOR));
  blocks.forEach((element) => element.classList.add("reveal"));
  const watched = [...blocks, ...scope.querySelectorAll(".split")];

  if (prefersReducedMotion.matches || !revealObserver) {
    watched.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  watched.forEach((element) => revealObserver.observe(element));
};

/* Gliding highlight ----------------------------------------------------------
   A pill that slides between the items of a [data-highlight] container on hover
   or keyboard focus. The nav pill also rests on the current section. */

let highlights = [];

const initHighlight = (container) => {
  if (!container || container.querySelector(":scope > .hl")) {
    return null;
  }

  const isNav = container.matches(".site-nav");
  const highlight = document.createElement("span");
  highlight.className = "hl hl--instant";
  highlight.setAttribute("aria-hidden", "true");
  container.prepend(highlight);

  let hovered = null;

  const itemFor = (target) => {
    let element = target instanceof Element ? target : null;
    while (element && element.parentElement !== container) {
      element = element.parentElement;
    }
    if (!element || element === highlight || (isNav && element.tagName !== "A")) {
      return null;
    }
    return element;
  };

  const resting = () => (isNav ? container.querySelector('a[aria-current="true"]') : null);

  const place = (item) => {
    if (!item) {
      highlight.style.opacity = "0";
      return;
    }

    // The first appearance jumps into position; later moves glide.
    const wasHidden = highlight.style.opacity !== "1";
    if (wasHidden) {
      highlight.classList.add("hl--instant");
    }
    highlight.style.width = `${item.offsetWidth}px`;
    highlight.style.height = `${item.offsetHeight}px`;
    highlight.style.transform = `translate(${item.offsetLeft}px, ${item.offsetTop}px)`;
    if (wasHidden) {
      void highlight.offsetWidth;
      highlight.classList.remove("hl--instant");
    }
    highlight.style.opacity = "1";
  };

  const sync = () => place(hovered || resting());

  container.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") {
      return;
    }
    hovered = itemFor(event.target);
    sync();
  });
  container.addEventListener("pointerleave", () => {
    hovered = null;
    sync();
  });
  container.addEventListener("focusin", (event) => {
    hovered = itemFor(event.target);
    sync();
  });
  container.addEventListener("focusout", (event) => {
    if (!container.contains(event.relatedTarget)) {
      hovered = null;
      sync();
    }
  });

  const api = { container, sync };
  highlights.push(api);
  return api;
};

const syncHighlights = () => {
  highlights = highlights.filter((item) => item.container.isConnected);
  highlights.forEach((item) => item.sync());
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
let timelines = [];
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

  timelines.forEach(({ element, items }) => {
    const line = window.innerHeight * 0.6;
    const rect = element.getBoundingClientRect();
    const progress = reduced ? 1 : clamp((line - rect.top) / rect.height, 0, 1);
    element.style.setProperty("--tl", progress.toFixed(4));
    items.forEach((item) => {
      item.classList.toggle("is-reached", reduced || item.getBoundingClientRect().top <= line);
    });
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
    // Blocks at the very end of the page can never cross the reveal margin.
    document.querySelectorAll(".reveal:not(.is-visible), .split:not(.is-visible)").forEach((element) => {
      element.classList.add("is-visible");
    });
  }
  spyTargets.forEach((item) => {
    if (item === current) {
      item.link.setAttribute("aria-current", "true");
    } else {
      item.link.removeAttribute("aria-current");
    }
  });
  syncHighlights();
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
  timelines = Array.from(document.querySelectorAll(".timeline")).map((element) => ({
    element,
    items: Array.from(element.querySelectorAll(".timeline__item")),
  }));
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
        initReveals(container);
        container.querySelectorAll("[data-highlight]").forEach(initHighlight);
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

initHighlight(document.querySelector(".site-nav"));
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
