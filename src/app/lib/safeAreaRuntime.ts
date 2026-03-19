type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const TOLERANCE_PX = 4;

function roundPx(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function readSafeInsets(): SafeInsets {
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.paddingTop = "env(safe-area-inset-top, 0px)";
  probe.style.paddingRight = "env(safe-area-inset-right, 0px)";
  probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
  probe.style.paddingLeft = "env(safe-area-inset-left, 0px)";
  document.body.appendChild(probe);
  const cs = window.getComputedStyle(probe);
  const insets = {
    top: roundPx(parseFloat(cs.paddingTop) || 0),
    right: roundPx(parseFloat(cs.paddingRight) || 0),
    bottom: roundPx(parseFloat(cs.paddingBottom) || 0),
    left: roundPx(parseFloat(cs.paddingLeft) || 0),
  };
  probe.remove();
  return insets;
}

function isStandaloneDisplayMode() {
  const mediaStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as typeof window.navigator & { standalone?: boolean }).standalone === true;
  return mediaStandalone || iosStandalone;
}

function detectViewportAlreadyExcludesInsets(insets: SafeInsets) {
  const viewportHeight = roundPx(window.visualViewport?.height ?? window.innerHeight);
  const combined = viewportHeight + insets.top + insets.bottom;
  const screenHeight = roundPx(window.screen.height);
  return Math.abs(combined - screenHeight) <= TOLERANCE_PX;
}

function applySafeAreaVariables() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const insets = readSafeInsets();
  const standalone = isStandaloneDisplayMode();
  const viewportExcludesInsets = standalone && detectViewportAlreadyExcludesInsets(insets);

  const effectiveTop = viewportExcludesInsets ? 0 : insets.top;
  const effectiveBottom = viewportExcludesInsets ? 0 : insets.bottom;

  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--pc-safe-top-raw", `${insets.top}px`);
  rootStyle.setProperty("--pc-safe-right-raw", `${insets.right}px`);
  rootStyle.setProperty("--pc-safe-bottom-raw", `${insets.bottom}px`);
  rootStyle.setProperty("--pc-safe-left-raw", `${insets.left}px`);
  rootStyle.setProperty("--pc-safe-top-effective", `${effectiveTop}px`);
  rootStyle.setProperty("--pc-safe-bottom-effective", `${effectiveBottom}px`);
  rootStyle.setProperty("--pc-safe-mode", standalone ? "standalone" : "browser");
  rootStyle.setProperty("--pc-safe-viewport-excludes-insets", viewportExcludesInsets ? "1" : "0");
}

export function installSafeAreaRuntimeVars() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const refresh = () => applySafeAreaVariables();
  refresh();

  const interval = window.setInterval(refresh, 1500);
  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("orientationchange", refresh);
  window.visualViewport?.addEventListener("resize", refresh, { passive: true });
  window.visualViewport?.addEventListener("scroll", refresh, { passive: true });

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("resize", refresh);
    window.removeEventListener("orientationchange", refresh);
    window.visualViewport?.removeEventListener("resize", refresh);
    window.visualViewport?.removeEventListener("scroll", refresh);
  };
}
