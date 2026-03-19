import React, { createContext, useContext, useState, useCallback, useRef, useEffect, memo } from "react";
import { flushSync } from "react-dom";

interface RouterContextType {
  path: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
  goBack: () => void;
  canGoBack: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const RouterContext = createContext<RouterContextType>({
  path: "/",
  params: {},
  navigate: () => {},
  goBack: () => {},
  canGoBack: false,
  scrollContainerRef: { current: null },
});

export function useNavigate() {
  return useContext(RouterContext).navigate;
}

export function useLocation() {
  return { pathname: useContext(RouterContext).path };
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useContext(RouterContext).params as T;
}

export function useGoBack() {
  return useContext(RouterContext).goBack;
}

export function useScrollContainer() {
  return useContext(RouterContext).scrollContainerRef;
}

interface RouteConfig {
  path: string;
  component: React.ComponentType;
}

function matchRoute(routePath: string, currentPath: string): Record<string, string> | null {
  const routeParts = routePath.split("/").filter(Boolean);
  const pathParts = currentPath.split("/").filter(Boolean);

  if (routeParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i].startsWith(":")) {
      params[routeParts[i].slice(1)] = pathParts[i];
    } else if (routeParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function resolveRoute(routes: RouteConfig[], path: string) {
  for (const route of routes) {
    if (route.path === path) {
      return { component: route.component, params: {} as Record<string, string> };
    }
    const params = matchRoute(route.path, path);
    if (params) {
      return { component: route.component, params };
    }
  }
  return null;
}

/* ─── Memoized screen wrapper — never re-renders during gesture ─── */
const FrozenScreen = memo(function FrozenScreen({
  Component,
  contextValue,
}: {
  Component: React.ComponentType;
  contextValue: RouterContextType;
}) {
  return (
    <RouterContext.Provider value={contextValue}>
      <Component />
    </RouterContext.Provider>
  );
});

/* ─── iOS-style swipe-back constants ─── */
const ACTIVATE_THRESHOLD = 0.35;  // 35% distance triggers back
const VELOCITY_THRESHOLD = 600;   // px/s — fast flick triggers back regardless of distance
const PREV_PARALLAX = 0.3;        // previous screen starts offset at -30%
const ANIMATION_MS = 300;
const EASING = "cubic-bezier(0.2, 0.9, 0.3, 1)";
const DIRECTION_RATIO = 1.5;      // dx must be 1.5× dy to lock horizontal (stricter for full-width)
const LOCK_THRESHOLD = 10;        // px of movement before locking direction

/* ─── Paths where swipe-back should be blocked (root dashboards) ─── */
const BLOCK_BACK_TO = new Set(["/"]);

export function SimpleRouter({ routes, initialPath }: { routes: RouteConfig[]; initialPath?: string }) {
  const [path, setPath] = useState(initialPath || "/");
  const [history, setHistory] = useState<string[]>([]);
  const scrollHistory = useRef<number[]>([]);
  
  /* ─── Scroll container ref (the current screen div is the scroll container) ─── */
  const scrollContainerRefStable = useRef<HTMLDivElement>(null);

  /*
   * showPrevScreen has 2 states now:
   *  false     → not mounted
   *  "visible" → mounted and visible (direction confirmed horizontal)
   */
  const [showPrevScreen, setShowPrevScreen] = useState<false | "visible">(false);

  /* ─── Gesture refs (no React state = no re-renders during drag) ─── */
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isTouchActiveRef = useRef(false);
  const directionLockedRef = useRef(false);
  const isHorizontalRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const prevScrollRef = useRef(0);

  /* ─── Velocity tracking ─── */
  const velTimestampRef = useRef(0);
  const velPositionRef = useRef(0);
  const velocityRef = useRef(0);

  /* ─── DOM refs for direct manipulation ─── */
  const containerRef = useRef<HTMLDivElement>(null);
  const currentScreenRef = useRef<HTMLDivElement>(null);
  const prevScreenRef = useRef<HTMLDivElement>(null);
  const dimOverlayRef = useRef<HTMLDivElement>(null);

  const screenWidthRef = useRef(typeof window !== "undefined" ? window.innerWidth : 390);
  const canGoBackRef = useRef(false);
  const prevPathRef = useRef<string | null>(null);

  /**
   * ★ Frozen prev screen — survives path/history changes during swipe.
   * Updated every render while NO gesture is active.
   * When gesture starts, stops updating → "freezes" the snapshot.
   * Cleared when setShowPrevScreen(false) is called.
   */
  const frozenPrevRef = useRef<{
    Component: React.ComponentType;
    ctx: RouterContextType;
  } | null>(null);

  /* ─── Keep refs in sync with state (read during gesture, no re-render) ─── */
  canGoBackRef.current = history.length > 0;
  prevPathRef.current = history.length > 0 ? history[history.length - 1] : null;

  /* ─── Stable ref for current path (avoids stale closure in navigate) ─── */
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    const update = () => { screenWidthRef.current = window.innerWidth; };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const navigate = useCallback((to: string) => {
    const sc = scrollContainerRefStable.current;
    scrollHistory.current.push(sc ? sc.scrollTop : 0);
    setHistory((prev) => [...prev, pathRef.current]);
    setPath(to);
    // Scroll new screen to top
    requestAnimationFrame(() => {
      if (scrollContainerRefStable.current) scrollContainerRefStable.current.scrollTop = 0;
    });
  }, []);

  const goBack = useCallback(() => {
    const savedScroll = scrollHistory.current.pop();
    setHistory((prev) => {
      const newHistory = [...prev];
      const lastPath = newHistory.pop();
      if (lastPath !== undefined) {
        setPath(lastPath);
        if (savedScroll !== undefined) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (scrollContainerRefStable.current) scrollContainerRefStable.current.scrollTop = savedScroll;
            });
          });
        }
      }
      return newHistory;
    });
  }, []);

  /* ─── Direct DOM transforms (zero React renders) ─── */
  const applyTransform = useCallback((progress: number, animate: boolean) => {
    const sw = screenWidthRef.current;
    const cur = currentScreenRef.current;
    const prev = prevScreenRef.current;
    const dim = dimOverlayRef.current;
    const t = animate ? `transform ${ANIMATION_MS}ms ${EASING}` : "none";

    if (cur) {
      cur.style.transition = t;
      cur.style.transform = `translate3d(${progress * sw}px, 0, 0)`;
      cur.style.boxShadow = progress > 0
        ? `-8px 0 32px rgba(0,0,0,${0.08 + progress * 0.1})`
        : "none";
    }
    if (prev) {
      prev.style.transition = t;
      prev.style.transform = `translate3d(${-sw * PREV_PARALLAX * (1 - progress)}px, 0, 0)`;
      prev.style.visibility = "visible";
    }
    if (dim) {
      dim.style.transition = animate ? `opacity ${ANIMATION_MS}ms ${EASING}` : "none";
      dim.style.opacity = String(0.15 * (1 - progress));
    }
  }, []);

  /**
   * ★ Swipe-back completion — "off-screen atomic swap" strategy.
   *
   * Problem: any `transform` value (including translate3d(0,0,0)) or
   * `will-change: transform` on the current screen div creates a CSS
   * "containing block" that breaks `position: fixed` for ALL descendants
   * (LiquidGlassNav, ImageLightbox). Fixed elements get positioned relative
   * to the div instead of the viewport, causing them to appear off-screen.
   *
   * Previous approach had a 1-frame gap between setting translate3d(0,0,0)
   * (step 5) and cleaning up to transform:none (step 7 in a separate rAF).
   * During that gap, the nav was mispositioned. If the cleanup rAF was
   * delayed, the nav stayed "disappeared".
   *
   * Solution: skip the intermediate translate3d(0,0,0) entirely. Go directly
   * from off-screen (translate3d(sw,0,0)) to transform:none in ONE atomic
   * operation. No gap, no frame where fixed positioning is broken.
   *
   * Why no flash: the content was rendered by flushSync 2 frames ago. The
   * browser has already laid it out. Setting transform:none just tells the
   * browser to paint it on the main layer (instead of a GPU texture). Since
   * layout is already done, this paint is fast. If it exceeds the frame
   * budget, the browser shows the prev screen (still mounted) for 1 extra
   * frame — no flash possible because the prev screen covers the viewport.
   *
   * Sequence:
   * 1. Kill transition, ensure screen is fully off-screen right
   * 2. flushSync → React renders new content (off-screen)
   * 3. scrollTo → restore scroll (off-screen)
   * 4. Double rAF → browser has laid out + painted content
   * 5. ATOMIC: willChange=auto + transform=none + unmount prev screen
   *    → containing block removed → position:fixed works immediately
   */
  const goBackFromSwipe = useCallback(() => {
    const savedScroll = scrollHistory.current.pop() ?? 0;
    const cur = currentScreenRef.current;
    const sw = screenWidthRef.current;

    // ── 1. Ensure fully off-screen + kill transition ──
    if (cur) {
      cur.style.transition = "none";
      cur.style.transform = `translate3d(${sw}px, 0, 0)`;
      cur.style.boxShadow = "none";
    }

    // ── 2. Change path synchronously ──
    flushSync(() => {
      setHistory((prev) => {
        const newHistory = [...prev];
        const lastPath = newHistory.pop();
        if (lastPath !== undefined) {
          setPath(lastPath);
        }
        return newHistory;
      });
    });

    // ── 3. Restore scroll ──
    if (scrollContainerRefStable.current) scrollContainerRefStable.current.scrollTop = savedScroll;

    // ── 4. Wait for browser to lay out + paint the new content ──
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // ── 5. ATOMIC SWAP: remove GPU layer + containing block in one step ──
        //    Going directly from translate3d(sw,0,0) → transform:none.
        //    No intermediate translate3d(0,0,0) that would leave a frame
        //    with a containing block and broken position:fixed.
        if (cur) {
          cur.style.willChange = "auto";
          cur.style.transform = "none";
          cur.style.boxShadow = "none";
        }

        // ── 6. Unmount prev screen (same JS tick → same paint frame) ──
        frozenPrevRef.current = null;
        setShowPrevScreen(false);
        isAnimatingRef.current = false;
      });
    });
  }, []);

  /* ─── Touch handlers ─── */
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isAnimatingRef.current || !canGoBackRef.current) return;

    // Block if previous path is a root dashboard
    if (prevPathRef.current && BLOCK_BACK_TO.has(prevPathRef.current)) return;

    const t = e.touches[0];
    if (!t) return;

    // ★ Walk up from touch target — skip if inside data-no-swipe or horizontal-scrollable
    let el = e.target as HTMLElement | null;
    while (el && el !== containerRef.current) {
      if (el.getAttribute("data-no-swipe") !== null) return;
      if (el.scrollWidth > el.clientWidth + 1) return;
      el = el.parentElement;
    }

    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    isTouchActiveRef.current = true;
    directionLockedRef.current = false;
    isHorizontalRef.current = false;
    progressRef.current = 0;
    velTimestampRef.current = Date.now();
    velPositionRef.current = t.clientX;
    velocityRef.current = 0;

    // Save current scroll position so the prev screen can be shown at correct scroll
    prevScrollRef.current = scrollHistory.current[scrollHistory.current.length - 1] ?? 0;
    screenWidthRef.current = window.innerWidth;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isTouchActiveRef.current) return;

    const t = e.touches[0];
    if (!t) return;

    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;

    // Direction locking phase
    if (!directionLockedRef.current) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < LOCK_THRESHOLD && absDy < LOCK_THRESHOLD) return;

      directionLockedRef.current = true;

      if (dx > 0 && absDx > absDy * DIRECTION_RATIO) {
        isHorizontalRef.current = true;
        // Mount prev screen
        flushSync(() => {
          setShowPrevScreen("visible");
        });
        // Promote current screen to GPU layer
        const cur = currentScreenRef.current;
        if (cur) {
          cur.style.willChange = "transform";
        }
      } else {
        isHorizontalRef.current = false;
        isTouchActiveRef.current = false;
        return;
      }
    }

    if (!isHorizontalRef.current) return;

    // Prevent vertical scroll while swiping
    e.preventDefault();

    // Calculate progress [0..1]
    const progress = Math.max(0, Math.min(1, dx / screenWidthRef.current));
    progressRef.current = progress;

    // Velocity tracking
    const now = Date.now();
    const dt = now - velTimestampRef.current;
    if (dt > 16) {
      velocityRef.current = ((t.clientX - velPositionRef.current) / dt) * 1000;
      velTimestampRef.current = now;
      velPositionRef.current = t.clientX;
    }

    // Apply transform via direct DOM manipulation (no React re-renders)
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      applyTransform(progress, false);
    });
  }, [applyTransform]);

  const handleTouchEnd = useCallback(() => {
    if (!isTouchActiveRef.current || !isHorizontalRef.current) {
      isTouchActiveRef.current = false;
      return;
    }

    isTouchActiveRef.current = false;
    cancelAnimationFrame(rafRef.current);

    const progress = progressRef.current;
    const velocity = velocityRef.current;
    const shouldComplete = progress > ACTIVATE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    isAnimatingRef.current = true;

    if (shouldComplete) {
      // Animate current screen off to the right
      applyTransform(1, true);

      setTimeout(() => {
        goBackFromSwipe();
      }, ANIMATION_MS);
    } else {
      // Snap back to origin
      applyTransform(0, true);

      setTimeout(() => {
        // ATOMIC cleanup: remove willChange + transform in one step
        // to avoid any frame where the containing block breaks position:fixed
        const cur = currentScreenRef.current;
        if (cur) {
          cur.style.transition = "none";
          cur.style.willChange = "auto";
          cur.style.transform = "none";
          cur.style.boxShadow = "none";
        }
        isAnimatingRef.current = false;
        frozenPrevRef.current = null;
        setShowPrevScreen(false);
      }, ANIMATION_MS);
    }
  }, [applyTransform, goBackFromSwipe]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  /* ─── Route resolution ─── */
  const currentMatch = resolveRoute(routes, path);
  const CurrentComponent = currentMatch?.component || routes[0]?.component;
  const currentParams = currentMatch?.params || {};
  const canGoBack = history.length > 0;

  const previousPath = history.length > 0 ? history[history.length - 1] : null;
  const previousMatch = previousPath ? resolveRoute(routes, previousPath) : null;
  const PreviousComponent = previousMatch?.component || null;
  const previousParams = previousMatch?.params || {};

  const currentCtx = React.useMemo<RouterContextType>(
    () => ({ path, params: currentParams, navigate, goBack, canGoBack, scrollContainerRef: scrollContainerRefStable }),
    [path, currentParams, navigate, goBack, canGoBack]
  );

  const prevCtx = React.useMemo<RouterContextType>(
    () => ({
      path: previousPath || "/",
      params: previousParams,
      navigate,
      goBack,
      canGoBack: history.length > 1,
      scrollContainerRef: scrollContainerRefStable,
    }),
    [previousPath, previousParams, navigate, goBack, history.length]
  );

  const isPrevMounted = showPrevScreen !== false;

  /**
   * ★ Keep frozenPrevRef updated every render WHILE no gesture is active.
   * Once a gesture starts (isPrevMounted becomes true and frozenPrevRef is set),
   * we stop updating so the snapshot is "frozen" for the duration of the swipe.
   * This ensures the prev screen never changes component or context mid-gesture.
   */
  if (!isPrevMounted) {
    // Not in a gesture — keep the ref fresh for next potential swipe
    if (PreviousComponent) {
      frozenPrevRef.current = { Component: PreviousComponent, ctx: prevCtx };
    } else {
      frozenPrevRef.current = null;
    }
  }
  // When isPrevMounted is true → frozenPrevRef stays as-is (frozen)

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: "var(--app-height, 100dvh)", overflow: "hidden" }}
    >
      {/* ═══ Previous screen (behind) — uses FROZEN ref, survives history changes ═══ */}
      {isPrevMounted && frozenPrevRef.current && (
        <div
          ref={prevScreenRef}
          className="fixed inset-0 z-0"
          style={{
            transform: `translate3d(${-screenWidthRef.current * PREV_PARALLAX}px, 0, 0)`,
            willChange: "transform",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              transform: `translateY(-${prevScrollRef.current}px)`,
              pointerEvents: "none",
            }}
          >
            <FrozenScreen Component={frozenPrevRef.current.Component} contextValue={frozenPrevRef.current.ctx} />
          </div>
          {/* Dim overlay */}
          <div
            ref={dimOverlayRef}
            className="absolute inset-0 z-10 pointer-events-none"
            style={{ background: "rgba(0,0,0,1)", opacity: 0.15 }}
          />
        </div>
      )}

      {/* ═══ Current screen (on top) — THIS is the scroll container ═══ */}
      <div
        ref={(el) => {
          (currentScreenRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (scrollContainerRefStable as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className="relative z-20"
        style={{
          height: "var(--app-height, 100dvh)",
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehaviorY: "contain",
          WebkitOverflowScrolling: "touch" as any,
          background: "#F2F2F7",
        }}
      >
        <FrozenScreen Component={CurrentComponent!} contextValue={currentCtx} />
      </div>
    </div>
  );
}
