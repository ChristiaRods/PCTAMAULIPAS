import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FixedLayerSnapshot = {
  id: string;
  zIndex: string;
  pointerEvents: string;
  top: number;
  bottom: number;
  height: number;
};

type MetricsSnapshot = {
  path: string;
  routerPath: string;
  userAgent: string;
  viewportMode: string;
  windowInner: { w: number; h: number };
  windowOuter: { w: number; h: number };
  visualViewport: { w: number; h: number; offsetTop: number; offsetLeft: number } | null;
  screen: { w: number; h: number };
  docClient: { w: number; h: number };
  rootRect: { top: number; bottom: number; height: number } | null;
  routerRect: { top: number; bottom: number; height: number } | null;
  currentRect: { top: number; bottom: number; height: number } | null;
  navRect: { top: number; bottom: number; height: number } | null;
  navCoreRect: { top: number; bottom: number; height: number } | null;
  navMode: string;
  navPosition: string;
  navBottomStyle: string;
  appHeightVar: number;
  safeArea: { top: number; right: number; bottom: number; left: number };
  safeAreaRuntime: {
    topRaw: number;
    bottomRaw: number;
    topEffective: number;
    bottomEffective: number;
    mode: string;
    viewportExcludesInsets: string;
    viewportExcludesTop: string;
    viewportExcludesBottom: string;
    navBottomOffset: number;
  };
  gapBelowNav: number | null;
  bottomElement: string;
  bottomElementRect: { top: number; bottom: number; height: number } | null;
  gapBelowBottomElement: number | null;
  bottomStack: string[];
  fixedLayers: FixedLayerSnapshot[];
  now: string;
};

function round(n: number) {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseCssPx(value: string) {
  return round(parseFloat(value) || 0);
}

function toRect(el: Element | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: round(r.top), bottom: round(r.bottom), height: round(r.height) };
}

function summarizeElement(el: Element | null) {
  if (!el || !(el instanceof HTMLElement)) return "none";
  const id = el.id ? `#${el.id}` : "";
  const cls = (el.className || "").toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
  const classPart = cls ? `.${cls}` : "";
  return `${el.tagName.toLowerCase()}${id}${classPart}`;
}

function formatLayerId(el: HTMLElement) {
  const debugId = el.dataset.debugId ? `[${el.dataset.debugId}]` : "";
  const id = el.id ? `#${el.id}` : "";
  const cls = (el.className || "").toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
  const classPart = cls ? `.${cls}` : "";
  return `${el.tagName.toLowerCase()}${id}${classPart}${debugId}`;
}

function readSafeAreaProbe(probe: HTMLDivElement | null) {
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = window.getComputedStyle(probe);
  return {
    top: round(parseFloat(cs.paddingTop) || 0),
    right: round(parseFloat(cs.paddingRight) || 0),
    bottom: round(parseFloat(cs.paddingBottom) || 0),
    left: round(parseFloat(cs.paddingLeft) || 0),
  };
}

function readViewportMode() {
  const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as typeof window.navigator & { standalone?: boolean }).standalone === true;
  if (standaloneMedia || iosStandalone) return "standalone";
  return "browser";
}

function readFixedLayers(limit = 8) {
  const layers: FixedLayerSnapshot[] = [];
  const nodes = document.querySelectorAll<HTMLElement>("body *");
  for (const el of nodes) {
    const cs = window.getComputedStyle(el);
    if (cs.position !== "fixed") continue;
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    layers.push({
      id: formatLayerId(el),
      zIndex: cs.zIndex || "auto",
      pointerEvents: cs.pointerEvents || "auto",
      top: round(rect.top),
      bottom: round(rect.bottom),
      height: round(rect.height),
    });
  }

  layers.sort((a, b) => {
    const za = Number.parseInt(a.zIndex, 10);
    const zb = Number.parseInt(b.zIndex, 10);
    if (Number.isFinite(za) && Number.isFinite(zb)) return zb - za;
    if (Number.isFinite(za)) return -1;
    if (Number.isFinite(zb)) return 1;
    return b.height - a.height;
  });

  return layers.slice(0, limit);
}

function readMetrics(probe: HTMLDivElement | null): MetricsSnapshot {
  const vv = window.visualViewport;
  const viewportHeight = round(vv?.height ?? window.innerHeight);
  const viewportWidth = round(vv?.width ?? window.innerWidth);
  const nav = document.querySelector('[data-debug-id="liquid-nav"]');
  const navCore = document.querySelector('[data-debug-id="liquid-nav-core"]');
  const router = document.querySelector('[data-debug-id="router-shell"]');
  const current = document.querySelector('[data-debug-id="router-current"]');
  const root = document.getElementById("root");
  const safeArea = readSafeAreaProbe(probe);
  const navRect = toRect(nav);
  const navCoreRect = toRect(navCore);
  const gapBelowNav = navCoreRect ? round(viewportHeight - navCoreRect.bottom) : null;
  const pointY = Math.max(0, viewportHeight - 2);
  const bottomEl = document.elementFromPoint(Math.round(viewportWidth / 2), pointY);
  const bottomElement = summarizeElement(bottomEl);
  const bottomElementRect = toRect(bottomEl);
  const gapBelowBottomElement = bottomElementRect
    ? round(viewportHeight - bottomElementRect.bottom)
    : null;
  const bottomStack = document
    .elementsFromPoint(Math.round(viewportWidth / 2), pointY)
    .slice(0, 5)
    .map((el) => summarizeElement(el));
  const navEl = nav instanceof HTMLElement ? nav : null;
  const navCs = navEl ? window.getComputedStyle(navEl) : null;
  const currentEl = current instanceof HTMLElement ? current : null;
  const routerPath = currentEl?.dataset.debugPath || "unknown";
  const navMode = navEl?.dataset.debugNavMode || "unknown";
  const rootStyle = window.getComputedStyle(document.documentElement);
  const safeAreaRuntime = {
    topRaw: parseCssPx(rootStyle.getPropertyValue("--pc-safe-top-raw")),
    bottomRaw: parseCssPx(rootStyle.getPropertyValue("--pc-safe-bottom-raw")),
    topEffective: parseCssPx(rootStyle.getPropertyValue("--pc-safe-top-effective")),
    bottomEffective: parseCssPx(rootStyle.getPropertyValue("--pc-safe-bottom-effective")),
    mode: rootStyle.getPropertyValue("--pc-safe-mode").trim() || "unset",
    viewportExcludesInsets:
      rootStyle.getPropertyValue("--pc-safe-viewport-excludes-insets").trim() || "unset",
    viewportExcludesTop:
      rootStyle.getPropertyValue("--pc-safe-viewport-excludes-top").trim() || "unset",
    viewportExcludesBottom:
      rootStyle.getPropertyValue("--pc-safe-viewport-excludes-bottom").trim() || "unset",
    navBottomOffset: parseCssPx(rootStyle.getPropertyValue("--pc-nav-bottom-offset")),
  };

  return {
    path: window.location.pathname + window.location.search,
    routerPath,
    userAgent: navigator.userAgent,
    viewportMode: readViewportMode(),
    windowInner: { w: round(window.innerWidth), h: round(window.innerHeight) },
    windowOuter: { w: round(window.outerWidth), h: round(window.outerHeight) },
    visualViewport: vv
      ? {
          w: round(vv.width),
          h: round(vv.height),
          offsetTop: round(vv.offsetTop),
          offsetLeft: round(vv.offsetLeft),
        }
      : null,
    screen: { w: round(window.screen.width), h: round(window.screen.height) },
    docClient: {
      w: round(document.documentElement.clientWidth),
      h: round(document.documentElement.clientHeight),
    },
    rootRect: toRect(root),
    routerRect: toRect(router),
    currentRect: toRect(current),
    navRect,
    navCoreRect,
    navMode,
    navPosition: navCs?.position || "none",
    navBottomStyle: navCs?.bottom || "none",
    appHeightVar: parseCssPx(rootStyle.getPropertyValue("--app-height")),
    safeArea,
    safeAreaRuntime,
    gapBelowNav,
    bottomElement,
    bottomElementRect,
    gapBelowBottomElement,
    bottomStack,
    fixedLayers: readFixedLayers(),
    now: new Date().toISOString(),
  };
}

function initialEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const queryFlag = params.get("debugLayout");
  if (queryFlag === "1") return true;
  if (queryFlag === "0") return false;
  try {
    const saved = localStorage.getItem("pc-layout-debug");
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch (_e) {
    // ignore localStorage errors
  }
  // Default OFF; enable with ?debugLayout=1 when needed.
  return false;
}

export function LayoutDebugPanel() {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [collapsed, setCollapsed] = useState(false);
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const probeRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setSnapshot(readMetrics(probeRef.current));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("scroll", refresh, { passive: true });
    window.visualViewport?.addEventListener("resize", refresh, { passive: true });
    window.visualViewport?.addEventListener("scroll", refresh, { passive: true });
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
      window.visualViewport?.removeEventListener("scroll", refresh);
    };
  }, [enabled, refresh]);

  const jsonText = useMemo(() => (snapshot ? JSON.stringify(snapshot, null, 2) : ""), [snapshot]);

  const handleHide = () => {
    try {
      localStorage.setItem("pc-layout-debug", "0");
    } catch (_e) {
      // ignore localStorage errors
    }
    setEnabled(false);
  };

  const handleCopy = async () => {
    if (!jsonText) return;
    try {
      await navigator.clipboard.writeText(jsonText);
    } catch (_e) {
      // ignore clipboard failures
    }
  };

  if (!enabled) return null;

  return (
    <>
      <div
        ref={probeRef}
        style={{
          position: "fixed",
          visibility: "hidden",
          pointerEvents: "none",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "max(6px, env(safe-area-inset-top, 0px))",
          right: 6,
          zIndex: 2147483647,
          width: collapsed ? 126 : "min(92vw, 360px)",
          maxHeight: collapsed ? 44 : "min(70vh, 520px)",
          overflow: "hidden",
          borderRadius: 12,
          border: "1px solid rgba(171,23,56,0.45)",
          background: "rgba(18, 5, 10, 0.92)",
          color: "#FCEEF1",
          fontFamily: "monospace",
          fontSize: 11,
          lineHeight: 1.4,
          boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 10px",
            borderBottom: collapsed ? "none" : "1px solid rgba(252,238,241,0.2)",
            background: "rgba(171,23,56,0.35)",
          }}
        >
          <strong style={{ flex: 1, fontSize: 11 }}>Layout Debug</strong>
          <button
            onClick={() => setCollapsed((v) => !v)}
            style={{
              border: "1px solid rgba(252,238,241,0.4)",
              background: "transparent",
              color: "#FCEEF1",
              borderRadius: 6,
              padding: "1px 6px",
              fontSize: 11,
            }}
          >
            {collapsed ? "Open" : "Min"}
          </button>
          <button
            onClick={handleHide}
            style={{
              border: "1px solid rgba(252,238,241,0.4)",
              background: "transparent",
              color: "#FCEEF1",
              borderRadius: 6,
              padding: "1px 6px",
              fontSize: 11,
            }}
          >
            Hide
          </button>
        </div>

        {!collapsed && snapshot && (
          <div style={{ padding: 10, overflow: "auto", maxHeight: "min(60vh, 470px)" }}>
            <div>mode: {snapshot.viewportMode}</div>
            <div>url-path: {snapshot.path}</div>
            <div>router-path: {snapshot.routerPath}</div>
            <div>inner: {snapshot.windowInner.w} x {snapshot.windowInner.h}</div>
            <div>vv: {snapshot.visualViewport ? `${snapshot.visualViewport.w} x ${snapshot.visualViewport.h}` : "none"}</div>
            <div>doc: {snapshot.docClient.w} x {snapshot.docClient.h}</div>
            <div>screen: {snapshot.screen.w} x {snapshot.screen.h}</div>
            <div>safe-bottom: {snapshot.safeArea.bottom}</div>
            <div>safe-bottom-raw-var: {snapshot.safeAreaRuntime.bottomRaw}</div>
            <div>safe-bottom-effective-var: {snapshot.safeAreaRuntime.bottomEffective}</div>
            <div>safe-top-raw-var: {snapshot.safeAreaRuntime.topRaw}</div>
            <div>safe-top-effective-var: {snapshot.safeAreaRuntime.topEffective}</div>
            <div>safe-mode-var: {snapshot.safeAreaRuntime.mode}</div>
            <div>viewport-excludes-insets-var: {snapshot.safeAreaRuntime.viewportExcludesInsets}</div>
            <div>viewport-excludes-top-var: {snapshot.safeAreaRuntime.viewportExcludesTop}</div>
            <div>viewport-excludes-bottom-var: {snapshot.safeAreaRuntime.viewportExcludesBottom}</div>
            <div>nav-bottom-offset-var: {snapshot.safeAreaRuntime.navBottomOffset}</div>
            <div>nav: {snapshot.navRect ? `${snapshot.navRect.top}-${snapshot.navRect.bottom} h${snapshot.navRect.height}` : "none"}</div>
            <div>nav-core: {snapshot.navCoreRect ? `${snapshot.navCoreRect.top}-${snapshot.navCoreRect.bottom} h${snapshot.navCoreRect.height}` : "none"}</div>
            <div>nav-mode: {snapshot.navMode}</div>
            <div>nav-position: {snapshot.navPosition}</div>
            <div>nav-bottom-style: {snapshot.navBottomStyle}</div>
            <div>app-height-var: {snapshot.appHeightVar}</div>
            <div>gap-below-nav: {snapshot.gapBelowNav ?? "none"}</div>
            <div>bottom-element: {snapshot.bottomElement}</div>
            <div>
              bottom-rect:{" "}
              {snapshot.bottomElementRect
                ? `${snapshot.bottomElementRect.top}-${snapshot.bottomElementRect.bottom} h${snapshot.bottomElementRect.height}`
                : "none"}
            </div>
            <div>gap-below-bottom-element: {snapshot.gapBelowBottomElement ?? "none"}</div>
            <div>bottom-stack: {snapshot.bottomStack.join(" > ")}</div>
            <div>root: {snapshot.rootRect ? `${snapshot.rootRect.top}-${snapshot.rootRect.bottom} h${snapshot.rootRect.height}` : "none"}</div>
            <div>router: {snapshot.routerRect ? `${snapshot.routerRect.top}-${snapshot.routerRect.bottom} h${snapshot.routerRect.height}` : "none"}</div>
            <div>current: {snapshot.currentRect ? `${snapshot.currentRect.top}-${snapshot.currentRect.bottom} h${snapshot.currentRect.height}` : "none"}</div>
            <div style={{ marginTop: 8, opacity: 0.9 }}>fixed layers:</div>
            {snapshot.fixedLayers.map((layer, idx) => (
              <div key={`${layer.id}-${idx}`} style={{ opacity: 0.85 }}>
                {layer.zIndex} {layer.pointerEvents} | {layer.top}-{layer.bottom} | {layer.id}
              </div>
            ))}
            <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
              <button
                onClick={refresh}
                style={{
                  border: "1px solid rgba(252,238,241,0.4)",
                  background: "transparent",
                  color: "#FCEEF1",
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: 11,
                }}
              >
                Refresh
              </button>
              <button
                onClick={handleCopy}
                style={{
                  border: "1px solid rgba(252,238,241,0.4)",
                  background: "transparent",
                  color: "#FCEEF1",
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: 11,
                }}
              >
                Copy JSON
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
