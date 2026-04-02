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
  { id: "menu", icon: Settings, label: "Ajustes" },
  { id: "notificaciones", icon: Bell, label: "Alertas" },
];

const coreNavItems = navItems.filter((item) => item.id !== "notificaciones");
const satelliteNavItem = navItems.find((item) => item.id === "notificaciones")!;

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
  pressedBarShadow:
    "0 8px 20px rgba(58,5,16,0.18), 0 1px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.42)",
  activeSatelliteShadow:
    "0 14px 28px rgba(56,8,18,0.24), 0 3px 9px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.56)",
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

type InteractionState = {
  x: number;
  y: number;
  intensity: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
  const interactionRafRef = useRef<number | null>(null);
  const interactionSnapshotRef = useRef<InteractionState>({
    x: 50,
    y: 16,
    intensity: 0.18,
  });
  const [bubblePos, setBubblePos] = useState<BubblePosition | null>(null);
  const [hasBackdrop, setHasBackdrop] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [interaction, setInteraction] = useState<InteractionState>({
    x: 50,
    y: 16,
    intensity: 0.18,
  });
  const [isPressingNav, setIsPressingNav] = useState(false);
  const [pressedView, setPressedView] = useState<NavView | null>(null);

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

  const commitInteraction = useCallback((next: InteractionState) => {
    interactionSnapshotRef.current = next;
    if (interactionRafRef.current !== null) return;
    interactionRafRef.current = requestAnimationFrame(() => {
      interactionRafRef.current = null;
      setInteraction(interactionSnapshotRef.current);
    });
  }, []);

  const setInteractionFromClientPoint = useCallback(
    (clientX: number, clientY: number, intensity: number) => {
      const container = navContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
      const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
      commitInteraction({
        x,
        y,
        intensity: clamp(intensity, 0.06, 1),
      });
    },
    [commitInteraction],
  );

  const releaseInteraction = useCallback(() => {
    setIsPressingNav(false);
    setPressedView(null);
    commitInteraction({
      x: interactionSnapshotRef.current.x,
      y: interactionSnapshotRef.current.y,
      intensity: 0.18,
    });
  }, [commitInteraction]);

  useEffect(() => {
    return () => {
      if (interactionRafRef.current !== null) {
        cancelAnimationFrame(interactionRafRef.current);
        interactionRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isPressingNav) return;
    const endPress = () => releaseInteraction();
    window.addEventListener("pointerup", endPress, { passive: true });
    window.addEventListener("pointercancel", endPress, { passive: true });
    return () => {
      window.removeEventListener("pointerup", endPress);
      window.removeEventListener("pointercancel", endPress);
    };
  }, [isPressingNav, releaseInteraction]);

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
    if (!position) {
      setBubblePos(null);
      prevViewRef.current = currentView;
      isFirstRender.current = false;
      return;
    }

    const previousIndex = coreNavItems.findIndex((item) => item.id === prevViewRef.current);
    const currentIndex = coreNavItems.findIndex((item) => item.id === currentView);
    const distance = Math.abs(currentIndex - previousIndex);
    setBubblePos(position);

    if (!reduceMotion && !isFirstRender.current && distance > 0 && previousIndex >= 0 && currentIndex >= 0 && squishRef.current) {
      const scaleX = 1 + Math.min(distance * 0.22, 0.58);
      const scaleY = 1 - Math.min(distance * 0.12, 0.24);
      const direction = currentIndex > previousIndex ? 1 : -1;
      const skew = direction * Math.min(5 + distance, 8);

      squishRef.current.animate(
        [
          { transform: "scaleX(1) scaleY(1)", offset: 0 },
          { transform: `scaleX(${scaleX}) scaleY(${scaleY}) skewX(${skew}deg)`, offset: 0.28 },
          { transform: `scaleX(0.92) scaleY(1.08) skewX(${-skew * 0.34}deg)`, offset: 0.62 },
          { transform: "scaleX(1) scaleY(1)", offset: 1 },
        ],
        {
          duration: 620,
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
  const isSatelliteActive = currentView === satelliteNavItem.id;
  const SatelliteIcon = satelliteNavItem.icon;

  const navContainerStyle = useMemo<React.CSSProperties>(() => {
    const interactionOpacity = 0.12 + interaction.intensity * 0.2;
    const background = hasBackdrop
      ? `radial-gradient(120% 100% at ${interaction.x}% ${interaction.y}%, rgba(255,255,255,${interactionOpacity}), rgba(255,255,255,0) 68%), ${THEME.barBg}`
      : THEME.barBgFallback;
    const border = hasBackdrop ? THEME.barBorder : THEME.barBorderFallback;

    return {
      background,
      backdropFilter: hasBackdrop ? "blur(44px) saturate(2.1)" : "none",
      WebkitBackdropFilter: hasBackdrop ? "blur(44px) saturate(2.1)" : "none",
      border: `0.5px solid ${border}`,
      boxShadow: isPressingNav ? THEME.pressedBarShadow : THEME.barShadow,
      transform: isPressingNav ? "translateY(1px) scale(0.997)" : "translateY(0) scale(1)",
      transition: reduceMotion
        ? "background 0.15s linear, border-color 0.15s linear"
        : "background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease, transform 0.22s ease",
      isolation: "isolate",
    };
  }, [hasBackdrop, interaction.intensity, interaction.x, interaction.y, isPressingNav, reduceMotion]);

  const bubbleStyle = useMemo<React.CSSProperties>(() => {
    const bubbleHighlightY = clamp(interaction.y - 8, 0, 100);
    const glowStrength = clamp(0.82 + interaction.intensity * 0.16, 0.82, 1);
    return {
      background: hasBackdrop
        ? `radial-gradient(136% 118% at ${interaction.x}% ${bubbleHighlightY}%, rgba(255,255,255,${glowStrength}), rgba(255,255,255,0.64) 48%, rgba(255,255,255,0.42) 100%)`
        : THEME.bubbleBgFallback,
      backdropFilter: hasBackdrop ? "blur(26px) brightness(1.12) saturate(1.2)" : "none",
      WebkitBackdropFilter: hasBackdrop ? "blur(26px) brightness(1.12) saturate(1.2)" : "none",
      border: `0.5px solid ${THEME.bubbleBorder}`,
      boxShadow: isPressingNav
        ? "0 4px 10px rgba(56,9,18,0.13), inset 0 1px 0 rgba(255,255,255,0.92)"
        : THEME.bubbleShadow,
      willChange: "transform",
    };
  }, [hasBackdrop, interaction.intensity, interaction.x, interaction.y, isPressingNav]);

  const satelliteButtonStyle = useMemo<React.CSSProperties>(() => {
    const satelliteGlow = clamp(0.2 + interaction.intensity * 0.22, 0.2, 0.42);
    return {
      background: hasBackdrop
        ? `radial-gradient(120% 120% at ${interaction.x}% ${interaction.y}%, rgba(255,255,255,${satelliteGlow}), rgba(255,255,255,0.12) 64%, rgba(255,255,255,0.06) 100%), rgba(255,255,255,0.56)`
        : "rgba(246,246,248,0.94)",
      backdropFilter: hasBackdrop ? "blur(34px) saturate(1.95)" : "none",
      WebkitBackdropFilter: hasBackdrop ? "blur(34px) saturate(1.95)" : "none",
      border: hasBackdrop
        ? isSatelliteActive
          ? "0.6px solid rgba(171,23,56,0.34)"
          : "0.5px solid rgba(188,149,91,0.26)"
        : "0.5px solid rgba(188,149,91,0.34)",
      boxShadow:
        isPressingNav
          ? "0 7px 16px rgba(56,8,18,0.18), 0 1px 5px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.52)"
          : isSatelliteActive
            ? THEME.activeSatelliteShadow
            : "0 10px 24px rgba(56,8,18,0.20), 0 2px 8px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.52)",
    };
  }, [hasBackdrop, interaction.intensity, interaction.x, interaction.y, isPressingNav, isSatelliteActive]);

  const navCore = (
    <div
      ref={navContainerRef}
      data-debug-id="liquid-nav-core"
      data-debug-nav-mode={layoutMode}
      className="relative flex items-center gap-0 rounded-full px-2 py-1 overflow-visible pointer-events-auto"
      style={navContainerStyle}
      onPointerDown={(event) => {
        setIsPressingNav(true);
        setInteractionFromClientPoint(event.clientX, event.clientY, 1);
      }}
      onPointerMove={(event) => {
        if (!isPressingNav && event.pointerType === "touch") return;
        setInteractionFromClientPoint(event.clientX, event.clientY, isPressingNav ? 0.92 : 0.42);
      }}
      onPointerEnter={(event) => {
        setInteractionFromClientPoint(event.clientX, event.clientY, 0.36);
      }}
      onPointerLeave={releaseInteraction}
      onPointerUp={releaseInteraction}
      onPointerCancel={releaseInteraction}
    >
      <div
        className="absolute inset-x-3 top-[2px] h-[45%] rounded-full pointer-events-none"
        style={{ background: hasBackdrop ? THEME.specularHighlight : THEME.fallbackTopHighlight }}
      />
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(160px 96px at ${interaction.x}% ${interaction.y}%, rgba(255,255,255,${0.14 + interaction.intensity * 0.2}), rgba(255,255,255,0) 74%)`,
          opacity: hasBackdrop ? 1 : 0.6,
          mixBlendMode: hasBackdrop ? "screen" : "normal",
          transition: reduceMotion ? "opacity 0.12s linear" : "opacity 0.22s ease",
        }}
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

      {coreNavItems.map((item) => {
        const isActive = currentView === item.id;
        const isPressed = pressedView === item.id;
        const Icon = item.icon;

        return (
          <motion.button
            key={item.id}
            ref={setButtonRef(item.id)}
            data-id={item.id}
            onClick={() => onChangeView(item.id)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            onPointerDown={(event) => {
              setPressedView(item.id);
              setIsPressingNav(true);
              setInteractionFromClientPoint(event.clientX, event.clientY, 1);
            }}
            onPointerUp={() => {
              setPressedView((prev) => (prev === item.id ? null : prev));
            }}
            onPointerLeave={() => {
              setPressedView((prev) => (prev === item.id ? null : prev));
            }}
            onPointerCancel={() => {
              setPressedView((prev) => (prev === item.id ? null : prev));
            }}
            whileTap={reduceMotion ? undefined : { scale: 0.91, y: 1.5 }}
            transition={reduceMotion ? { duration: 0.08 } : { type: "spring", stiffness: 560, damping: 32, mass: 0.6 }}
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
                : isPressed
                  ? { scale: 0.94, y: 1.1 }
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
            </motion.div>

            <motion.span
              className="relative z-10 text-[11px] whitespace-nowrap pointer-events-none"
              initial={false}
              animate={reduceMotion
                ? { y: 0, opacity: 1 }
                : isPressed
                  ? { y: 0.8, opacity: 0.92 }
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

  const navShell = (
    <div className="flex items-end gap-2.5 px-0 pointer-events-none">
      <div className="flex-1 min-w-0 pointer-events-auto">{navCore}</div>
      <motion.button
        data-id={satelliteNavItem.id}
        aria-label={satelliteNavItem.label}
        aria-current={isSatelliteActive ? "page" : undefined}
        onClick={() => onChangeView(satelliteNavItem.id)}
        onPointerDown={(event) => {
          setPressedView(satelliteNavItem.id);
          setIsPressingNav(true);
          setInteractionFromClientPoint(event.clientX, event.clientY, 1);
        }}
        onPointerUp={() => {
          setPressedView((prev) => (prev === satelliteNavItem.id ? null : prev));
          releaseInteraction();
        }}
        onPointerLeave={() => {
          setPressedView((prev) => (prev === satelliteNavItem.id ? null : prev));
          releaseInteraction();
        }}
        onPointerCancel={() => {
          setPressedView((prev) => (prev === satelliteNavItem.id ? null : prev));
          releaseInteraction();
        }}
        whileTap={reduceMotion ? undefined : { scale: 0.9, y: 1.2 }}
        transition={reduceMotion ? { duration: 0.08 } : { type: "spring", stiffness: 500, damping: 28, mass: 0.62 }}
        className="relative z-20 mb-1.5 h-[68px] w-[68px] shrink-0 rounded-full overflow-hidden pointer-events-auto"
        style={satelliteButtonStyle}
      >
        <div
          className="absolute inset-[1px] rounded-full pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.42), rgba(255,255,255,0.05) 55%, rgba(255,255,255,0.00))",
          }}
        />
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(110% 90% at 50% 8%, rgba(255,255,255,0.32), rgba(255,255,255,0.05) 62%, transparent 100%)",
          }}
        />
        <motion.div
          className="relative z-10 h-full w-full flex items-center justify-center"
          initial={false}
          animate={reduceMotion
            ? { scale: 1, y: 0 }
            : pressedView === satelliteNavItem.id
              ? { scale: 0.93, y: 1 }
              : isSatelliteActive
              ? { scale: 1.06, y: -0.5 }
              : { scale: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0.1 } : { type: "spring", stiffness: 380, damping: 24, mass: 0.6 }}
        >
          <SatelliteIcon
            size={31}
            style={{
              color: isSatelliteActive ? THEME.activeColor : iconColor,
              strokeWidth: isSatelliteActive ? 2.3 : 1.9,
              transition: reduceMotion
                ? "color 0.12s linear, stroke-width 0.12s linear"
                : "color 0.28s ease, stroke-width 0.28s ease",
            }}
          />
          {notificationCount > 0 && !isSatelliteActive && (
            <motion.div
              layout
              className="absolute top-2 right-2 min-w-[18px] h-[18px] rounded-full px-1.5 flex items-center justify-center pointer-events-none"
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
      </motion.button>
    </div>
  );

  if (layoutMode === "inline") {
    return (
      <div
        data-debug-id="liquid-nav"
        data-debug-nav-mode={layoutMode}
        className="relative z-50 px-4 overflow-visible pointer-events-none"
      >
        {navShell}
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
      {navShell}
    </div>
  );

  if (typeof document === "undefined") return nav;
  return createPortal(nav, document.body);
}
