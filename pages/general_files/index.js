// ===== Base selectors (safe-guarded) =====
const sideMenu = document.querySelector("aside");
const menuBtn  = document.getElementById("menu-btn");
const closeBtn = document.getElementById("close-btn");
const darkMode = document.querySelector(".dark-mode");
const container = document.querySelector(".container"); // optional, used for grid adjustment in fallback

// ===== Existing behavior (kept, but null-safe) =====
if (menuBtn && sideMenu) {
  menuBtn.addEventListener("click", () => {
    sideMenu.style.display = "block";
  });
}
if (closeBtn && sideMenu) {
  closeBtn.addEventListener("click", () => {
    sideMenu.style.display = "none";
  });
}
if (darkMode) {
  darkMode.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode-variables");
    const s1 = darkMode.querySelector("span:nth-child(1)");
    const s2 = darkMode.querySelector("span:nth-child(2)");
    s1 && s1.classList.toggle("active");
    s2 && s2.classList.toggle("active");
  });
}

// ===== Sticky Sidebar (global) =====
(function makeSidebarSticky() {
  if (!sideMenu) return;

  // Ensure the grid aligns from the top so sticky can do correct math
  if (container && getComputedStyle(container).alignItems !== "start") {
    container.style.alignItems = "start";
  }

  // Feature-detect CSS sticky support
  const supportsSticky = CSS && CSS.supports && CSS.supports("position", "sticky");

  if (supportsSticky) {
    // Use native sticky on modern browsers
    sideMenu.style.position = "sticky";
    sideMenu.style.top = "0";
    sideMenu.style.alignSelf = "start";
    sideMenu.style.zIndex = "5";

    // If the page uses an inner .sidebar card (common in your layouts),
    // keep it neatly bounded within the viewport.
    const inner = sideMenu.querySelector(".sidebar");
    // In the sticky branch:
if (inner) {
  inner.style.position = "sticky";
  inner.style.top = hasExistingTop ? getComputedStyle(inner).top : "1.5rem";
  inner.style.height = "calc(100vh - 3rem)";
  inner.style.overflowY = "auto";   // was: overflow = "auto"
  inner.style.overflowX = "hidden";
}

// In the fixed-position fallback:
sideMenu.style.height = "100vh";
sideMenu.style.overflowY = "auto";  // was: overflow = "auto"
sideMenu.style.overflowX = "hidden";

  }

  // ===== Fixed-position Fallback (older browsers) =====
  // Locks the aside visually, and keeps the main grid aligned
  function applyFixedPosition() {
    const rect = sideMenu.getBoundingClientRect();
    const docLeft = rect.left + window.scrollX;
    const widthPx = rect.width + "px";
    const leftPx = docLeft + "px";

    sideMenu.style.position = "fixed";
    sideMenu.style.top = "0";
    sideMenu.style.left = leftPx;
    sideMenu.style.width = widthPx;
    sideMenu.style.height = "100vh";
    sideMenu.style.overflow = "auto";
    sideMenu.style.zIndex = "5";

    // Keep layout aligned: turn first grid column into the fixed width
    if (container) {
      // Preserve gap by keeping grid and forcing first column width
      const current = getComputedStyle(container).gridTemplateColumns;
      // If already two columns, replace first with fixed width; otherwise set explicitly
      const cols = current && current.includes(" ")
        ? widthPx + " 1fr"
        : widthPx + " 1fr";
      container.style.gridTemplateColumns = cols;
      container.style.alignItems = "start";
    }
  }

  // Debounced resize for the fallback so it tracks layout changes
  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => applyFixedPosition(), 60);
  }

  // Initial lock + listeners
  applyFixedPosition();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // When menu is toggled (on small screens), maintain fixed measurements
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      // run after layout paints
      requestAnimationFrame(() => requestAnimationFrame(applyFixedPosition));
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      // no-op; if you fully hide aside, layout will reflow naturally
      // when shown again, menuBtn handler re-applies sizing
    });
  }
})();
