import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, RefreshCw } from "lucide-react";
import { useNavigate } from "./RouterContext";

type RectSnapshot = { top: number; bottom: number; height: number };

type FixedLayerSnapshot = {
  id: string;
  zIndex: string;
  top: number;
  bottom: number;
  height: number;
};

type Snapshot = {
  path: string;
  routerPath: string;
  viewportMode: string;
  inner: { w: number; h: number };
  visualViewport: { w: number; h: number; top: number; left: number } | null;
  screen: { w: number; h: number };
  doc: { w: number; h: number };
  appHeightVar: number;
  rootRect: RectSnapshot | null;
  routerRect: RectSnapshot | null;
  currentRect: RectSnapshot | null;
  safeArea: { top: number; right: number; bottom: number; left: number };
  bottomElement: string;
  bottomRect: RectSnapshot | null;
  gapBelowBottom: number | null;
  html: { position: string; height: string; overflow: string };
  body: { position: string; height: string; overflow: string };
  fixedLayers: FixedLayerSnapshot[];
  now: string;
};

function round(n: number) {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function toRect(el: Element | null): RectSnapshot | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: round(r.top), bottom: round(r.bottom), height: round(r.height) };
}

function parseCssPx(value: string) {
  return round(parseFloat(value) || 0);
}

function summarizeElement(el: Element | null) {
  if (!el || !(el instanceof HTMLElement)) return "none";
  const id = el.id ? `#${el.id}` : "";
  const cls = (el.className || "")
    .toString()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(".");
  const classPart = cls ? `.${cls}` : "";
  return `${el.tagName.toLowerCase()}${id}${classPart}`;
}

function readViewportMode() {
  const mediaStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as typeof window.navigator & { standalone?: boolean }).standalone === true;
  return mediaStandalone || iosStandalone ? "standalone" : "browser";
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

function readFixedLayers(limit = 6): FixedLayerSnapshot[] {
  const list: FixedLayerSnapshot[] = [];
  const all = document.querySelectorAll<HTMLElement>("body *");
  for (const el of all) {
    const cs = window.getComputedStyle(el);
    if (cs.position !== "fixed") continue;
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const cls = (el.className || "")
      .toString()
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(".");
    list.push({
      id: `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}`,
      zIndex: cs.zIndex || "auto",
      top: round(rect.top),
      bottom: round(rect.bottom),
      height: round(rect.height),
    });
  }
  return list.slice(0, limit);
}

function readSnapshot(probe: HTMLDivElement | null): Snapshot {
  const vv = window.visualViewport;
  const viewportW = round(vv?.width ?? window.innerWidth);
  const viewportH = round(vv?.height ?? window.innerHeight);
  const pointX = Math.round(viewportW / 2);
  const pointY = Math.max(0, viewportH - 2);
  const bottomEl = document.elementFromPoint(pointX, pointY);
  const bottomRect = toRect(bottomEl);
  const htmlCs = window.getComputedStyle(document.documentElement);
  const bodyCs = window.getComputedStyle(document.body);
  const rootStyle = window.getComputedStyle(document.documentElement);
  const root = document.getElementById("root");
  const router = document.querySelector('[data-debug-id="router-shell"]');
  const current = document.querySelector('[data-debug-id="router-current"]');
  const currentEl = current instanceof HTMLElement ? current : null;

  return {
    path: window.location.pathname + window.location.search,
    routerPath: currentEl?.dataset.debugPath || "unknown",
    viewportMode: readViewportMode(),
    inner: { w: round(window.innerWidth), h: round(window.innerHeight) },
    visualViewport: vv
      ? { w: round(vv.width), h: round(vv.height), top: round(vv.offsetTop), left: round(vv.offsetLeft) }
      : null,
    screen: { w: round(window.screen.width), h: round(window.screen.height) },
    doc: { w: round(document.documentElement.clientWidth), h: round(document.documentElement.clientHeight) },
    appHeightVar: parseCssPx(rootStyle.getPropertyValue("--app-height")),
    rootRect: toRect(root),
    routerRect: toRect(router),
    currentRect: toRect(current),
    safeArea: readSafeAreaProbe(probe),
    bottomElement: summarizeElement(bottomEl),
    bottomRect,
    gapBelowBottom: bottomRect ? round(viewportH - bottomRect.bottom) : null,
    html: {
      position: htmlCs.position,
      height: htmlCs.height,
      overflow: htmlCs.overflow,
    },
    body: {
      position: bodyCs.position,
      height: bodyCs.height,
      overflow: bodyCs.overflow,
    },
    fixedLayers: readFixedLayers(),
    now: new Date().toISOString(),
  };
}

export function LayoutIsolatedScreen() {
  const navigate = useNavigate();
  const probeRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [showLog, setShowLog] = useState(true);
  const [scrollMode, setScrollMode] = useState(true);

  const refresh = useCallback(() => {
    setSnapshot(readSnapshot(probeRef.current));
  }, []);

  useEffect(() => {
    refresh();
    const i = window.setInterval(refresh, 500);
    window.addEventListener("resize", refresh, { passive: true });
    window.visualViewport?.addEventListener("resize", refresh, { passive: true });
    window.visualViewport?.addEventListener("scroll", refresh, { passive: true });
    return () => {
      window.clearInterval(i);
      window.removeEventListener("resize", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
      window.visualViewport?.removeEventListener("scroll", refresh);
    };
  }, [refresh]);

  const json = useMemo(() => (snapshot ? JSON.stringify(snapshot, null, 2) : ""), [snapshot]);

  const handleCopy = useCallback(async () => {
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
    } catch (_e) {
      // ignore copy errors
    }
  }, [json]);

  return (
    <div
      className="h-full relative overflow-hidden text-white"
      style={{
        background:
          "linear-gradient(180deg, #130106 0%, #370913 38%, #6A1028 72%, #A0133B 100%)",
      }}
    >
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

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-cyan-300/90" />
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-lime-300/90" />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-black/20" />
      </div>

      <div
        className="absolute inset-x-4 z-30 flex flex-wrap items-center gap-2"
        style={{ top: "max(8px, var(--pc-safe-top-effective, env(safe-area-inset-top, 0px)))" }}
      >
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-xl flex items-center justify-center active:opacity-70"
          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={refresh}
          className="h-10 px-3 rounded-xl text-[12px] flex items-center gap-2 active:opacity-70"
          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
        <button
          onClick={handleCopy}
          className="h-10 px-3 rounded-xl text-[12px] flex items-center gap-2 active:opacity-70"
          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <Copy className="w-4 h-4" />
          Copy JSON
        </button>
        <button
          onClick={() => setScrollMode((v) => !v)}
          className="h-10 px-3 rounded-xl text-[12px] active:opacity-70"
          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          {scrollMode ? "Scroll On" : "Scroll Off"}
        </button>
        <button
          onClick={() => setShowLog((v) => !v)}
          className="h-10 px-3 rounded-xl text-[12px] active:opacity-70"
          style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          {showLog ? "Hide Log" : "Show Log"}
        </button>
      </div>

      <div
        className={scrollMode ? "h-full overflow-y-auto" : "h-full overflow-hidden"}
        style={{
          paddingTop: "calc(var(--pc-safe-top-effective, env(safe-area-inset-top, 0px)) + 64px)",
          paddingBottom: 0,
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
        }}
      >
        <div className="px-4 pb-6 space-y-3">
          <div
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <p className="text-[15px]" style={{ fontWeight: 700 }}>
              Pantalla Aislada Fullscreen
            </p>
            <p className="text-[13px] text-white/90" style={{ lineHeight: 1.45 }}>
              Esta vista no usa AppHeader ni menu inferior. Si aqui aparece corte en bottom, el problema es global del shell.
            </p>
          </div>

          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.88)", color: "#1C1C1E", border: "1px solid rgba(255,255,255,0.65)" }}
            >
              <p className="text-[14px]" style={{ fontWeight: 700 }}>
                Bloque {i + 1}
              </p>
              <p className="text-[13px]" style={{ lineHeight: 1.45 }}>
                Referencia visual para verificar scroll, borde inferior y continuidad del contenido.
              </p>
            </div>
          ))}

          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(20,255,140,0.2)", border: "1px solid rgba(20,255,140,0.45)" }}
          >
            <p className="text-[13px]" style={{ fontWeight: 700 }}>
              Borde inferior real alcanzado
            </p>
          </div>
        </div>
      </div>

      {showLog && snapshot && (
        <div
          className="absolute left-3 right-3 z-40 rounded-2xl overflow-hidden"
          style={{
            top: "calc(var(--pc-safe-top-effective, env(safe-area-inset-top, 0px)) + 56px)",
            background: "rgba(12, 2, 6, 0.9)",
            border: "1px solid rgba(255,255,255,0.24)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            maxHeight: "50vh",
          }}
        >
          <div className="px-3 py-2 border-b border-white/20 text-[12px]" style={{ fontWeight: 700 }}>
            Isolated Log
          </div>
          <div className="px-3 py-2 text-[11px] leading-5 overflow-auto" style={{ maxHeight: "calc(50vh - 36px)" }}>
            <div>mode: {snapshot.viewportMode}</div>
            <div>path: {snapshot.path}</div>
            <div>router-path: {snapshot.routerPath}</div>
            <div>inner: {snapshot.inner.w} x {snapshot.inner.h}</div>
            <div>vv: {snapshot.visualViewport ? `${snapshot.visualViewport.w} x ${snapshot.visualViewport.h}` : "none"}</div>
            <div>screen: {snapshot.screen.w} x {snapshot.screen.h}</div>
            <div>doc: {snapshot.doc.w} x {snapshot.doc.h}</div>
            <div>app-height-var: {snapshot.appHeightVar}</div>
            <div>safe-bottom: {snapshot.safeArea.bottom}</div>
            <div>root: {snapshot.rootRect ? `${snapshot.rootRect.top}-${snapshot.rootRect.bottom} h${snapshot.rootRect.height}` : "none"}</div>
            <div>router: {snapshot.routerRect ? `${snapshot.routerRect.top}-${snapshot.routerRect.bottom} h${snapshot.routerRect.height}` : "none"}</div>
            <div>current: {snapshot.currentRect ? `${snapshot.currentRect.top}-${snapshot.currentRect.bottom} h${snapshot.currentRect.height}` : "none"}</div>
            <div>bottom-element: {snapshot.bottomElement}</div>
            <div>bottom-rect: {snapshot.bottomRect ? `${snapshot.bottomRect.top}-${snapshot.bottomRect.bottom} h${snapshot.bottomRect.height}` : "none"}</div>
            <div>gap-below-bottom: {snapshot.gapBelowBottom ?? "none"}</div>
            <div>html: pos={snapshot.html.position} h={snapshot.html.height} ov={snapshot.html.overflow}</div>
            <div>body: pos={snapshot.body.position} h={snapshot.body.height} ov={snapshot.body.overflow}</div>
            <div style={{ marginTop: 6 }}>fixed layers:</div>
            {snapshot.fixedLayers.map((layer, idx) => (
              <div key={`${layer.id}-${idx}`}>
                {layer.zIndex} | {layer.top}-{layer.bottom} | {layer.id}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

