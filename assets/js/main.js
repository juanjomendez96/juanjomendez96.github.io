const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let observer;
const observedElements = new WeakSet();

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
      { threshold: 0.2 }
    );
  }

  elements.forEach((el) => {
    if (!observedElements.has(el)) {
      observer.observe(el);
      observedElements.add(el);
    }
  });
};

const loadPartials = () => {
  const containers = document.querySelectorAll("[data-partial]");
  if (!containers.length) {
    return;
  }

  containers.forEach((container) => {
    const name = container.dataset.partial;
    if (!name) {
      return;
    }

    fetch(`partials/${name}.html`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then((html) => {
        const template = document.createElement("template");
        template.innerHTML = html.trim();
        const fragment = template.content;
        const animatedTargets = Array.from(fragment.querySelectorAll("[data-animate]"));

        container.replaceWith(fragment);
        initAnimatedElements(animatedTargets);
        updateYear();
      })
      .catch((error) => {
        console.error(`Failed to load partial "${name}":`, error);
      });
  });
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

initAnimatedElements(document);
updateYear();
loadPartials();
