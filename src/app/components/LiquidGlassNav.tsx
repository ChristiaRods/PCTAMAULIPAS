import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Home, FileText, Activity, Bell, Settings } from "lucide-react";

/* ─── Types ─── */
export type NavView = "home" | "reportes" | "monitoreo" | "notificaciones" | "menu";

/* ─── Nav Items ─── */
const navItems: { id: NavView; icon: React.ElementType; label: string }[] = [
  { id: "home", icon: Home, label: "Inicio" },
  { id: "reportes", icon: FileText, label: "Reportes" },
  { id: "monitoreo", icon: Activity, label: "Monitoreo" },
  { id: "notificaciones", icon: Bell, label: "Alertas" },
  { id: "menu", icon: Settings, label: "Config" },
];

/* ─── Theme ─── */
const THEME = {
  light: {
    activeColor: "#AB1738",
    inactiveColor: "#54565B",
    barBg: "rgba(255,255,255,0.72)",
    barBorder: "rgba(188,149,91,0.18)",
    barShadow:
      "0 2px 20px rgba(78,11,21,0.05), 0 8px 40px rgba(0,0,0,0.04)",
    bubbleBg: "rgba(255,255,255,0.65)",
    bubbleBorder: "rgba(188,149,91,0.15)",
    bubbleShadow:
      "0 1px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
    crescentBg: "rgba(188,149,91,0.35)",
    specularHighlight:
      "linear-gradient(to bottom, rgba(255,255,255,0.70), rgba(255,255,255,0.0))",
    specularBubble:
      "linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)",
    iridescentRim:
      "conic-gradient(from 0deg, rgba(171,23,56,0.10), rgba(188,149,91,0.08), rgba(230,213,181,0.06), rgba(205,166,122,0.08), rgba(84,86,91,0.06), rgba(171,23,56,0.10))",
  },
};

interface LiquidGlassNavProps {
  currentView: NavView;
  onChangeView: (view: NavView) => void;
  notificationCount?: number;
  layoutMode?: "overlay" | "inline";
}

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
  const t = THEME.light;

  /* ─── Bubble position ─── */
  const [bubblePos, setBubblePos] = useState<{ left: number; width: number; top: number; height: number } | null>(null);

  /* ─── Measure button position relative to container ─── */
  const measureButton = useCallback((viewId: NavView) => {
    const btn = buttonRefs.current.get(viewId);
    const container = navContainerRef.current;
    if (!btn || !container) return null;
    const btnRect = btn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
      left: btnRect.left - containerRect.left,
      top: btnRect.top - containerRect.top,
      width: btnRect.width,
      height: btnRect.height,
    };
  }, []);

  /* ─── Update position + fire squish via Web Animations API ─── */
  useEffect(() => {
    const pos = measureButton(currentView);
    if (!pos) return;

    const prevIndex = navItems.findIndex((n) => n.id === prevViewRef.current);
    const currIndex = navItems.findIndex((n) => n.id === currentView);
    const distance = Math.abs(currIndex - prevIndex);

    setBubblePos(pos);

    // Web Animations API — native, reliable, doesn't conflict with Motion
    if (!isFirstRender.current && distance > 0 && squishRef.current) {
      const sx = 1 + Math.min(distance * 0.14, 0.38);
      const sy = 1 - Math.min(distance * 0.07, 0.18);

      squishRef.current.animate(
        [
          { transform: "scaleX(1) scaleY(1)", offset: 0 },
          { transform: `scaleX(${sx}) scaleY(${sy})`, offset: 0.3 },
          { transform: "scaleX(0.95) scaleY(1.05)", offset: 0.65 },
          { transform: "scaleX(1) scaleY(1)", offset: 1 },
        ],
        {
          duration: 500,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "none",
        }
      );
    }

    prevViewRef.current = currentView;
    isFirstRender.current = false;
  }, [currentView, measureButton]);

  /* ─── Re-measure on resize ─── */
  useEffect(() => {
    const handleResize = () => {
      const pos = measureButton(currentView);
      if (pos) setBubblePos(pos);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentView, measureButton]);

  /* ─── Register button ref ─── */
  const setButtonRef = useCallback((id: NavView) => (el: HTMLButtonElement | null) => {
    if (el) {
      buttonRefs.current.set(id, el);
    } else {
      buttonRefs.current.delete(id);
    }
  }, []);

  /* ─── Initial measurement ─── */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const pos = measureButton(currentView);
      if (pos) setBubblePos(pos);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const navCore = (
    <div
      ref={navContainerRef}
      data-debug-id="liquid-nav-core"
      data-debug-nav-mode={layoutMode}
      className="relative flex items-center gap-0 px-2 py-1 rounded-full overflow-visible pointer-events-auto"
      style={{
        background: t.barBg,
        backdropFilter: "blur(60px) saturate(1.8)",
        WebkitBackdropFilter: "blur(60px) saturate(1.8)",
        border: `0.5px solid ${t.barBorder}`,
        boxShadow: t.barShadow,
        transition:
          "background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease",
      }}
    >
        {/* Top specular highlight */}
        <div
          className="absolute inset-x-3 top-[2px] h-[45%] rounded-full pointer-events-none"
          style={{ background: t.specularHighlight }}
        />

        {/* ─── Liquid Glass Bubble ─── */}
        {/* OUTER: motion.div → spring position animation */}
        {/* INNER: plain div with ref → Web Animations API squish */}
        {bubblePos && (
          <motion.div
            className="absolute z-0 pointer-events-none"
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
            style={{ overflow: "visible" }}
          >
            {/* Squish shell — stable ref, never unmounts */}
            <div
              ref={squishRef}
              className="absolute inset-0 rounded-full"
              style={{
                background: t.bubbleBg,
                backdropFilter: "blur(25px) brightness(1.08)",
                WebkitBackdropFilter: "blur(25px) brightness(1.08)",
                border: `0.5px solid ${t.bubbleBorder}`,
                boxShadow: t.bubbleShadow,
                overflow: "visible",
                willChange: "transform",
              }}
            >
              {/* Iridescent / Chromatic rim */}
              <div
                className="absolute inset-0 rounded-[inherit] pointer-events-none"
                style={{
                  background: t.iridescentRim,
                  mask: "linear-gradient(black, black) content-box, linear-gradient(black, black)",
                  maskComposite: "exclude",
                  WebkitMaskComposite: "xor",
                  padding: "2px",
                  borderRadius: "inherit",
                }}
              />
              {/* Inner specular reflection */}
              <div
                className="absolute inset-x-3 top-[1px] h-[40%] rounded-full pointer-events-none"
                style={{ background: t.specularBubble }}
              />
            </div>
          </motion.div>
        )}

        {/* ─── Nav Buttons ─── */}
        {navItems.map((item) => {
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              ref={setButtonRef(item.id)}
              data-id={item.id}
              onClick={() => onChangeView(item.id)}
              className="relative flex-1 py-3 rounded-[20px] flex flex-col items-center gap-1.5 z-10 overflow-visible"
            >
              {/* Crescent highlight */}
              <div
                className="absolute bottom-[5px] left-1/2 -translate-x-1/2 pointer-events-none"
                style={{
                  width: "24px",
                  height: "4px",
                  borderRadius: "2px",
                  background: t.crescentBg,
                  opacity: isActive ? 0 : 0.55,
                  filter: "blur(1px)",
                  transition: "opacity 0.3s ease",
                }}
              />

              {/* Icon */}
              <div
                data-icon-wrapper
                className="relative z-10 transition-transform duration-300 origin-center pointer-events-none"
              >
                <item.icon
                  size={24}
                  style={{
                    color: isActive ? t.activeColor : t.inactiveColor,
                    strokeWidth: isActive ? 2.4 : 1.6,
                    transition:
                      "color 0.3s ease, stroke-width 0.3s ease",
                  }}
                />
                {/* Notification badge */}
                {item.id === "notificaciones" && notificationCount > 0 && !isActive && (
                  <div
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full px-1 pointer-events-none"
                    style={{
                      background: "#EF4444",
                      boxShadow: "0 1px 4px rgba(239,68,68,0.4)",
                    }}
                  >
                    <span className="text-[10px] text-white tabular-nums" style={{ fontWeight: 700, lineHeight: 1 }}>
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </span>
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                className="relative z-10 text-[11px] pointer-events-none whitespace-nowrap"
                style={{
                  color: isActive ? t.activeColor : t.inactiveColor,
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
        className="relative z-50 overflow-visible pointer-events-none px-4"
        style={{ paddingBottom: 0 }}
      >
        {navCore}
      </div>
    );
  }

  const nav = (
    <div
      data-debug-id="liquid-nav"
      data-debug-nav-mode={layoutMode}
      className="fixed left-4 right-4 z-50 overflow-visible pointer-events-none"
      style={{
        bottom: "var(--pc-nav-bottom-offset, 0px)",
      }}
    >
      {navCore}
    </div>
  );

  if (typeof document === "undefined") return nav;
  return createPortal(nav, document.body);
}
