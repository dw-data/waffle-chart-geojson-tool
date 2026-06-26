(function () {
  const ROOT_SELECTOR = ".dw-navigation-tabs";
  let rtlScrollTypeCache = null;

  function getDirection(root) {
    const dir =
      root.getAttribute("dir") ||
      root.closest("[dir]")?.getAttribute("dir") ||
      document.documentElement.getAttribute("dir") ||
      "ltr";
    return String(dir).toLowerCase() === "rtl" ? "rtl" : "ltr";
  }

  function getStep(viewport) {
    return Math.max(120, Math.round(viewport.clientWidth * 0.6));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function detectRtlScrollType() {
    if (rtlScrollTypeCache) return rtlScrollTypeCache;

    const outer = document.createElement("div");
    const inner = document.createElement("div");

    outer.setAttribute("dir", "rtl");
    outer.style.width = "4px";
    outer.style.height = "1px";
    outer.style.position = "absolute";
    outer.style.top = "-1000px";
    outer.style.overflow = "scroll";
    outer.style.visibility = "hidden";

    inner.style.width = "8px";
    inner.style.height = "1px";

    outer.appendChild(inner);
    document.body.appendChild(outer);

    let type = "reverse";
    if (outer.scrollLeft > 0) {
      type = "default";
    } else {
      outer.scrollLeft = 1;
      type = outer.scrollLeft === 0 ? "negative" : "reverse";
    }

    document.body.removeChild(outer);
    rtlScrollTypeCache = type;
    return type;
  }

  function getMaxScroll(viewport) {
    return Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  }

  function getLogicalScrollLeft(viewport, dir) {
    const max = getMaxScroll(viewport);
    const raw = viewport.scrollLeft;

    if (dir !== "rtl") return clamp(raw, 0, max);

    switch (detectRtlScrollType()) {
      case "negative":
        return clamp(max + raw, 0, max);
      case "reverse":
        return clamp(max - raw, 0, max);
      default:
        return clamp(raw, 0, max);
    }
  }

  function setLogicalScrollLeft(viewport, dir, logicalLeft) {
    const max = getMaxScroll(viewport);
    const next = clamp(logicalLeft, 0, max);

    if (dir !== "rtl") {
      viewport.scrollTo({ left: next, behavior: "smooth" });
      return;
    }

    switch (detectRtlScrollType()) {
      case "negative":
        viewport.scrollTo({ left: next - max, behavior: "smooth" });
        break;
      case "reverse":
        viewport.scrollTo({ left: max - next, behavior: "smooth" });
        break;
      default:
        viewport.scrollTo({ left: next, behavior: "smooth" });
        break;
    }
  }

  function ensureStructure(root) {
    if (!root) return null;

    let viewport = root.querySelector(".dw-navigation-tabs__viewport");
    let list = root.querySelector(".dw-navigation-tabs__list");
    let prevBtn = root.querySelector(".dw-navigation-tabs__nav-btn--prev");
    let nextBtn = root.querySelector(".dw-navigation-tabs__nav-btn--next");

    if (!viewport && list) {
      viewport = document.createElement("div");
      viewport.className = "dw-navigation-tabs__viewport";
      list.parentNode.insertBefore(viewport, list);
      viewport.appendChild(list);
    }

    if (!prevBtn) {
      prevBtn = document.createElement("button");
      prevBtn.className = "dw-navigation-tabs__nav-btn dw-navigation-tabs__nav-btn--prev";
      prevBtn.type = "button";
      prevBtn.setAttribute("aria-label", "Nach links scrollen");
      root.insertBefore(prevBtn, viewport || root.firstChild);
    }

    if (!nextBtn) {
      nextBtn = document.createElement("button");
      nextBtn.className = "dw-navigation-tabs__nav-btn dw-navigation-tabs__nav-btn--next";
      nextBtn.type = "button";
      nextBtn.setAttribute("aria-label", "Nach rechts scrollen");
      root.appendChild(nextBtn);
    }

    return { viewport, list, prevBtn, nextBtn };
  }

  function syncDirectionState(root, prevBtn, nextBtn, dir) {
    root.dataset.dwNavigationTabsDir = dir;

    if (dir === "rtl") {
      prevBtn.setAttribute("aria-label", "Nach rechts scrollen");
      nextBtn.setAttribute("aria-label", "Nach links scrollen");
    } else {
      prevBtn.setAttribute("aria-label", "Nach links scrollen");
      nextBtn.setAttribute("aria-label", "Nach rechts scrollen");
    }
  }

  function update(root) {
    const parts = ensureStructure(root);
    if (!parts || !parts.viewport || !parts.prevBtn || !parts.nextBtn) return;

    const { viewport, prevBtn, nextBtn } = parts;
    const dir = getDirection(root);
    syncDirectionState(root, prevBtn, nextBtn, dir);
    const max = getMaxScroll(viewport);
    const current = getLogicalScrollLeft(viewport, dir);
    const overflowing = max > 2;

    root.classList.toggle("is-overflowing", overflowing);
    prevBtn.hidden = !overflowing;
    nextBtn.hidden = !overflowing;

    if (!overflowing) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    const atStart = current <= 1;
    const atEnd = current >= max - 1;

    if (dir === "rtl") {
      prevBtn.disabled = atEnd;
      nextBtn.disabled = atStart;
    } else {
      prevBtn.disabled = atStart;
      nextBtn.disabled = atEnd;
    }
  }

  function bind(root) {
    if (!root || root.dataset.dwNavigationTabsBound === "true") return;
    root.dataset.dwNavigationTabsBound = "true";

    const parts = ensureStructure(root);
    if (!parts || !parts.viewport || !parts.prevBtn || !parts.nextBtn) return;

    const { viewport, prevBtn, nextBtn } = parts;

    function scrollByIntent(intent) {
      const dir = getDirection(root);
      const step = getStep(viewport);
      const current = getLogicalScrollLeft(viewport, dir);

      let next = current;
      if (dir === "rtl") {
        next = intent === "prev" ? current + step : current - step;
      } else {
        next = intent === "prev" ? current - step : current + step;
      }

      setLogicalScrollLeft(viewport, dir, next);
    }

    prevBtn.addEventListener("click", () => scrollByIntent("prev"));
    nextBtn.addEventListener("click", () => scrollByIntent("next"));
    viewport.addEventListener("scroll", () => update(root), { passive: true });
    window.addEventListener("resize", () => update(root), { passive: true });

    const observer = new MutationObserver(() => update(root));
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["dir", "data-dw-theme", "class", "aria-selected", "aria-disabled"]
    });

    root.__dwNavigationTabsObserver = observer;
  }

  function init(root) {
    if (!root) return;
    bind(root);
    update(root);
  }

  function initAll(scope) {
    (scope || document).querySelectorAll(ROOT_SELECTOR).forEach(init);
  }

  window.DWNavigationTabs = {
    init,
    initAll,
    update,
    updateOverflow: update
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll(document), { once: true });
  } else {
    initAll(document);
  }
})();