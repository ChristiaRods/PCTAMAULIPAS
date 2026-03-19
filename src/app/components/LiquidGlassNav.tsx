import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
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
  { id: "menu", icon: Settings, label: "Config" },
];

const THEME = {
  activeColor: "#AB1738",
  inactiveColor: "#54565B",
  barBg: "rgba(255,255,255,0.72)",
  barBorder: "rgba(188,149,91,0.18)",
  barShadow: "0 2px 20px rgba(78,11,21,0.05), 0 8px 40px rgba(0,0,0,0.04)",
  bubbleBg: "rgba(255,255,255,0.65)",
  bubbleBorder: "rgba(188,149,91,0.15)",
  bubbleShadow: "0 1px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
  crescentBg: "rgba(188,149,91,0.35)",
  specularHighlight:
    "linear-gradient(to bottom, rgba(255,255,255,0.70), rgba(255,255,255,0.0))",
  specularBubble:
    "linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)",
  iridescentRim:
    "conic-gradient(from 0deg, rgba(171,23,56,0.10), rgba(188,149,91,0.08), rgba(230,213,181,0.06), rgba(205,166,122,0.08), rgba(84,86,91,0.06), rgba(171,23,56,0.10))",
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

export function LiquidGlassNav({
  currentView,
  onChangeView,
  notificationCount = 0,
  layoutMode = "overlay",
}: LiquidGlassNavProps) {
  const navContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<NavView, HTMLButtonElement>>(new Map());
  const prevViewRef = useRef<NavView>(currentView);
  const isFirstRender = useRef(true);
  const squishRef = useRef<HTMLDivElement>(null);
  const [bubblePos, setBubblePos] = useState<BubblePosition | null>(null);

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

    if (!isFirstRender.current && distance > 0 && squishRef.current) {
      const scaleX = 1 + Math.min(distance * 0.14, 0.38);
      const scaleY = 1 - Math.min(distance * 0.07, 0.18);

      squishRef.current.animate(
        [
          { transform: "scaleX(1) scaleY(1)", offset: 0 },
          { transform: `scaleX(${scaleX}) scaleY(${scaleY})`, offset: 0.3 },
          { transform: "scaleX(0.95) scaleY(1.05)", offset: 0.65 },
          { transform: "scaleX(1) scaleY(1)", offset: 1 },
        ],
        {
          duration: 500,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "none",
        },
      );
    }

    prevViewRef.current = currentView;
    isFirstRender.current = false;
  }, [currentView, measureButton]);

  useEffect(() => {
    const refresh = () => {
      const position = measureButton(currentView);
      if (position) setBubblePos(position);
    };

    window.addEventListener("resize", refresh);
    window.visualViewport?.addEventListener("resize", refresh, { passive: true });
    window.visualViewport?.addEventListener("scroll", refresh, { passive: true });

    return () => {
      window.removeEventListener("resize", refresh);
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

  const navCore = (
    <div
      ref={navContainerRef}
      data-debug-id="liquid-nav-core"
      data-debug-nav-mode={layoutMode}
      className="relative flex items-center gap-0 rounded-full px-2 py-1 overflow-visible pointer-events-auto"
      style={{
        background: THEME.barBg,
        backdropFilter: "blur(60px) saturate(1.8)",
        WebkitBackdropFilter: "blur(60px) saturate(1.8)",
        border: `0.5px solid ${THEME.barBorder}`,
        boxShadow: THEME.barShadow,
        transition: "background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease",
      }}
    >
      <div
        className="absolute inset-x-3 top-[2px] h-[45%] rounded-full pointer-events-none"
        style={{ background: THEME.specularHighlight }}
      />

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
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 24,
            mass: 0.85,
          }}
        >
          <div
            ref={squishRef}
            className="absolute inset-0 rounded-full"
            style={{
              background: THEME.bubbleBg,
              backdropFilter: "blur(25px) brightness(1.08)",
              WebkitBackdropFilter: "blur(25px) brightness(1.08)",
              border: `0.5px solid ${THEME.bubbleBorder}`,
              boxShadow: THEME.bubbleShadow,
              willChange: "transform",
            }}
          >
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
          <button
            key={item.id}
            ref={setButtonRef(item.id)}
            data-id={item.id}
            onClick={() => onChangeView(item.id)}
            className="relative z-10 flex flex-1 flex-col items-center gap-1.5 rounded-[20px] py-3 active:scale-[0.98] transition-transform duration-200 overflow-visible"
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

            <div className="relative z-10 pointer-events-none">
              <Icon
                size={24}
                style={{
                  color: isActive ? THEME.activeColor : THEME.inactiveColor,
                  strokeWidth: isActive ? 2.35 : 1.65,
                  transition: "color 0.3s ease, stroke-width 0.3s ease",
                }}
              />
              {item.id === "notificaciones" && notificationCount > 0 && !isActive && (
                <div
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
                </div>
              )}
            </div>

            <span
              className="relative z-10 text-[11px] whitespace-nowrap pointer-events-none"
              style={{
                color: isActive ? THEME.activeColor : THEME.inactiveColor,
                fontWeight: isActive ? 700 : 500,
                transition: "color 0.3s ease",
              }}
            >
              {item.label}
            </span>
          </button>
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
      className="fixed bottom-6 left-4 right-4 z-50 overflow-visible pointer-events-none"
    >
      {navCore}
    </div>
  );

  if (typeof document === "undefined") return nav;
  return createPortal(nav, document.body);
}
