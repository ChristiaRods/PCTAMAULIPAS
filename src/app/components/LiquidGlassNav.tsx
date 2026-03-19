import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { Activity, Bell, FileText, Home, Settings } from "lucide-react";

export type NavView =
  | "home"
  | "reportes"
  | "monitoreo"
  | "notificaciones"
  | "menu";

const navItems: { id: NavView; icon: React.ElementType; label: string }[] = [
  { id: "home", icon: Home, label: "Inicio" },
  { id: "reportes", icon: FileText, label: "Reportes" },
  { id: "monitoreo", icon: Activity, label: "Monitoreo" },
  { id: "notificaciones", icon: Bell, label: "Alertas" },
  { id: "menu", icon: Settings, label: "Ajustes" },
];

const THEME = {
  activeColor: "#AB1738",
  inactiveColor: "#54565B",
  highContrastInactive: "#3A3A3C",
  barBg: "rgba(255,255,255,0.58)",
  barBgFallback: "rgba(246,246,248,0.94)",
  barBorder: "rgba(188,149,91,0.24)",
  barBorderFallback: "rgba(188,149,91,0.34)",
  barShadow: "0 14px 38px rgba(58,5,16,0.16), 0 2px 12px rgba(0,0,0,0.08)",
  bubbleBg: "rgba(255,255,255,0.76)",
  bubbleBgFallback: "rgba(255,255,255,0.98)",
  bubbleBorder: "rgba(188,149,91,0.22)",
  bubbleShadow: "0 8px 18px rgba(56,9,18,0.12), inset 0 1px 0 rgba(255,255,255,0.94)",
  crescentBg: "rgba(188,149,91,0.35)",
  glassFlow:
    "linear-gradient(112deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.50) 44%, rgba(255,255,255,0.00) 70%)",
  specularHighlight:
    "linear-gradient(to bottom, rgba(255,255,255,0.84), rgba(255,255,255,0.0))",
  specularBubble:
    "linear-gradient(to bottom, rgba(255,255,255,0.52), transparent)",
  bubbleGlow:
    "radial-gradient(110% 80% at 50% 0%, rgba(255,255,255,0.58), rgba(255,255,255,0.08) 62%, rgba(255,255,255,0) 100%)",
  iridescentRim:
    "conic-gradient(from 0deg, rgba(171,23,56,0.10), rgba(188,149,91,0.08), rgba(230,213,181,0.06), rgba(205,166,122,0.08), rgba(84,86,91,0.06), rgba(171,23,56,0.10))",
  fallbackTopHighlight:
    "linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(255,255,255,0.0))",
} as const;

interface LiquidGlassNavProps {
  currentView: NavView;
  onChangeView: (view: NavView) => void;
  notificationCount?: number;
  layoutMode?: "overlay" | "inline";
}

type BubblePosition = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function supportsBackdropFilter() {
  if (typeof window === "undefined" || typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return false;
  }
  return (
    CSS.supports("backdrop-filter: blur(1px)") ||
    CSS.supports("-webkit-backdrop-filter: blur(1px)")
  );
}

export function LiquidGlassNav({
  currentView,
  onChangeView,
  notificationCount = 0,
  layoutMode = "overlay",
}: LiquidGlassNavProps) {
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = prefersReducedMotion === true;
  const navContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<NavView, HTMLButtonElement>>(new Map());
  const prevViewRef = useRef<NavView>(currentView);
  const isFirstRender = useRef(true);
  const squishRef = useRef<HTMLDivElement>(null);
  const [bubblePos, setBubblePos] = useState<BubblePosition | null>(null);
  const [hasBackdrop, setHasBackdrop] = useState(true);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    setHasBackdrop(supportsBackdropFilter());

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-contrast: more)");
    const applyContrast = () => setHighContrast(mediaQuery.matches);
    applyContrast();
    mediaQuery.addEventListener?.("change", applyContrast);

    return () => {
      mediaQuery.removeEventListener?.("change", applyContrast);
    };
  }, []);

  const measureButton = useCallback((viewId: NavView): BubblePosition | null => {
    const button = buttonRefs.current.get(viewId);
    const container = navContainerRef.current;
    if (!button || !container) return null;

    const buttonRect = button.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    return {
      left: buttonRect.left - containerRect.left,
      top: buttonRect.top - containerRect.top,
      width: buttonRect.width,
      height: buttonRect.height,
    };
  }, []);

  useEffect(() => {
    const position = measureButton(currentView);
    if (!position) return;

    const previousIndex = navItems.findIndex((item) => item.id === prevViewRef.current);
    const currentIndex = navItems.findIndex((item) => item.id === currentView);
    const distance = Math.abs(currentIndex - previousIndex);
    setBubblePos(position);

    if (!reduceMotion && !isFirstRender.current && distance > 0 && squishRef.current) {
      const scaleX = 1 + Math.min(distance * 0.22, 0.58);
      const scaleY = 1 - Math.min(distance * 0.12, 0.24);

      squishRef.current.animate(
        [
          { transform: "scaleX(1) scaleY(1)", offset: 0 },
          { transform: `scaleX(${scaleX}) scaleY(${scaleY})`, offset: 0.3 },
          { transform: "scaleX(0.92) scaleY(1.08)", offset: 0.65 },
          { transform: "scaleX(1) scaleY(1)", offset: 1 },
        ],
        {
          duration: 560,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "none",
        },
      );
    }

    prevViewRef.current = currentView;
    isFirstRender.current = false;
  }, [currentView, measureButton, reduceMotion]);

  useEffect(() => {
    const refresh = () => {
      const position = measureButton(currentView);
      if (position) setBubblePos(position);
    };

    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    window.addEventListener("pageshow", refresh);
    window.visualViewport?.addEventListener("resize", refresh, { passive: true });
    window.visualViewport?.addEventListener("scroll", refresh, { passive: true });

    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      window.removeEventListener("pageshow", refresh);
      window.visualViewport?.removeEventListener("resize", refresh);
      window.visualViewport?.removeEventListener("scroll", refresh);
    };
  }, [currentView, measureButton]);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const position = measureButton(currentView);
      if (position) setBubblePos(position);
    });
    return () => cancelAnimationFrame(rafId);
  }, [currentView, measureButton]);

  const setButtonRef = useCallback(
    (id: NavView) => (element: HTMLButtonElement | null) => {
      if (element) {
        buttonRefs.current.set(id, element);
      } else {
        buttonRefs.current.delete(id);
      }
    },
    [],
  );

  const iconColor = useMemo(() => {
    if (highContrast) return THEME.highContrastInactive;
    return THEME.inactiveColor;
  }, [highContrast]);

  const navContainerStyle = useMemo<React.CSSProperties>(() => {
    const background = hasBackdrop ? THEME.barBg : THEME.barBgFallback;
    const border = hasBackdrop ? THEME.barBorder : THEME.barBorderFallback;

    return {
      background,
      backdropFilter: hasBackdrop ? "blur(44px) saturate(2.1)" : "none",
      WebkitBackdropFilter: hasBackdrop ? "blur(44px) saturate(2.1)" : "none",
      border: `0.5px solid ${border}`,
      boxShadow: THEME.barShadow,
      transition: reduceMotion
        ? "background 0.15s linear, border-color 0.15s linear"
        : "background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease",
      isolation: "isolate",
    };
  }, [hasBackdrop, reduceMotion]);

  const bubbleStyle = useMemo<React.CSSProperties>(() => {
    return {
      background: hasBackdrop ? THEME.bubbleBg : THEME.bubbleBgFallback,
      backdropFilter: hasBackdrop ? "blur(26px) brightness(1.12) saturate(1.2)" : "none",
      WebkitBackdropFilter: hasBackdrop ? "blur(26px) brightness(1.12) saturate(1.2)" : "none",
      border: `0.5px solid ${THEME.bubbleBorder}`,
      boxShadow: THEME.bubbleShadow,
      willChange: "transform",
    };
  }, [hasBackdrop]);

  const navCore = (
    <div
      ref={navContainerRef}
      data-debug-id="liquid-nav-core"
      data-debug-nav-mode={layoutMode}
      className="relative flex items-center gap-0 rounded-full px-2 py-1 overflow-visible pointer-events-auto"
      style={navContainerStyle}
    >
      <div
        className="absolute inset-x-3 top-[2px] h-[45%] rounded-full pointer-events-none"
        style={{ background: hasBackdrop ? THEME.specularHighlight : THEME.fallbackTopHighlight }}
      />
      {bubblePos && (
        <motion.div
          className="absolute inset-y-0 w-[52%] rounded-full pointer-events-none"
          initial={false}
          animate={{ left: Math.max(0, bubblePos.left - 20) }}
          transition={
            reduceMotion
              ? { duration: 0.12, ease: "linear" }
              : { type: "spring", stiffness: 220, damping: 24, mass: 0.84 }
          }
          style={{
            background: THEME.glassFlow,
            opacity: hasBackdrop ? 0.72 : 0.3,
            mixBlendMode: hasBackdrop ? "screen" : "normal",
            filter: "blur(0.4px)",
          }}
        />
      )}

      {bubblePos && (
        <motion.div
          className="absolute z-0 pointer-events-none overflow-visible"
          initial={false}
          animate={{
            left: bubblePos.left,
            top: bubblePos.top,
            width: bubblePos.width,
            height: bubblePos.height,
          }}
          transition={
            reduceMotion
              ? { duration: 0.14, ease: "easeOut" }
              : { type: "spring", stiffness: 250, damping: 25, mass: 0.82 }
          }
        >
          <div
            ref={squishRef}
            className="absolute inset-0 rounded-full"
            style={bubbleStyle}
          >
            <div
              className="absolute inset-0 rounded-[inherit] pointer-events-none"
              style={{
                background: THEME.bubbleGlow,
                opacity: hasBackdrop ? 1 : 0.7,
              }}
            />
            {hasBackdrop && (
              <div
                className="absolute inset-0 rounded-[inherit] pointer-events-none"
                style={{
                  background: THEME.iridescentRim,
                  mask: "linear-gradient(black, black) content-box, linear-gradient(black, black)",
                  maskComposite: "exclude",
                  WebkitMaskComposite: "xor",
                  padding: "2px",
                }}
              />
            )}
            <div
              className="absolute inset-x-3 top-[1px] h-[40%] rounded-full pointer-events-none"
              style={{ background: THEME.specularBubble }}
            />
          </div>
        </motion.div>
      )}

      {navItems.map((item) => {
        const isActive = currentView === item.id;
        const Icon = item.icon;

        return (
          <motion.button
            key={item.id}
            ref={setButtonRef(item.id)}
            data-id={item.id}
            onClick={() => onChangeView(item.id)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            whileTap={reduceMotion ? undefined : { scale: 0.94, y: 1.1 }}
            transition={reduceMotion ? { duration: 0.08 } : { type: "spring", stiffness: 540, damping: 30, mass: 0.6 }}
            className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-[20px] py-3 min-h-[62px] overflow-visible"
          >
            <div
              className="absolute bottom-[5px] left-1/2 -translate-x-1/2 pointer-events-none"
              style={{
                width: "24px",
                height: "4px",
                borderRadius: "2px",
                background: THEME.crescentBg,
                opacity: isActive ? 0 : 0.55,
                filter: "blur(1px)",
                transition: "opacity 0.3s ease",
              }}
            />

            <motion.div
              className="relative z-10 pointer-events-none"
              initial={false}
              animate={reduceMotion
                ? { scale: 1, y: 0 }
                : isActive
                  ? { scale: 1.06, y: -1.1 }
                  : { scale: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0.1 } : { type: "spring", stiffness: 360, damping: 24, mass: 0.6 }}
            >
              <Icon
                size={24}
                style={{
                  color: isActive ? THEME.activeColor : iconColor,
                  strokeWidth: isActive ? 2.35 : 1.7,
                  transition: reduceMotion
                    ? "color 0.12s linear, stroke-width 0.12s linear"
                    : "color 0.28s ease, stroke-width 0.28s ease",
                }}
              />
              {item.id === "notificaciones" && notificationCount > 0 && !isActive && (
                <motion.div
                  layout
                  className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] rounded-full px-1 flex items-center justify-center pointer-events-none"
                  style={{
                    background: "#EF4444",
                    boxShadow: "0 1px 4px rgba(239,68,68,0.4)",
                  }}
                >
                  <span
                    className="text-[10px] text-white tabular-nums"
                    style={{ fontWeight: 700, lineHeight: 1 }}
                  >
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                </motion.div>
              )}
            </motion.div>

            <motion.span
              className="relative z-10 text-[11px] whitespace-nowrap pointer-events-none"
              initial={false}
              animate={reduceMotion
                ? { y: 0, opacity: 1 }
                : isActive
                  ? { y: -0.8, opacity: 1 }
                  : { y: 0, opacity: 0.93 }}
              transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 380, damping: 28, mass: 0.58 }}
              style={{
                color: isActive ? THEME.activeColor : iconColor,
                fontWeight: isActive ? 700 : 500,
                transition: reduceMotion ? "color 0.12s linear" : "color 0.28s ease",
              }}
            >
              {item.label}
            </motion.span>
          </motion.button>
        );
      })}
    </div>
  );

  if (layoutMode === "inline") {
    return (
      <div
        data-debug-id="liquid-nav"
        data-debug-nav-mode={layoutMode}
        className="relative z-50 px-4 overflow-visible pointer-events-none"
      >
        {navCore}
      </div>
    );
  }

  const nav = (
    <div
      data-debug-id="liquid-nav"
      data-debug-nav-mode={layoutMode}
      data-debug-glass={hasBackdrop ? "backdrop" : "fallback"}
      data-debug-reduce-motion={reduceMotion ? "1" : "0"}
      className="fixed bottom-6 left-4 right-4 z-50 overflow-visible pointer-events-none"
    >
      {navCore}
    </div>
  );

  if (typeof document === "undefined") return nav;
  return createPortal(nav, document.body);
}
