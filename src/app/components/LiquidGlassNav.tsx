import React from "react";
import { createPortal } from "react-dom";
import { Home, FileText, Activity, Bell, Settings } from "lucide-react";

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
  const navCore = (
    <div
      data-debug-id="liquid-nav-core"
      data-debug-nav-mode={layoutMode}
      className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-full overflow-hidden pointer-events-auto"
      style={{
        background: "#F7F7FA",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      }}
    >
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            data-id={item.id}
            onClick={() => onChangeView(item.id)}
            className="relative flex-1 py-2.5 rounded-[20px] flex flex-col items-center gap-1 z-10"
            style={{
              background: isActive ? "#FFFFFF" : "transparent",
              boxShadow: isActive ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <div className="relative">
              <Icon
                size={24}
                style={{
                  color: isActive ? "#AB1738" : "#54565B",
                  strokeWidth: isActive ? 2.3 : 1.8,
                }}
              />
              {item.id === "notificaciones" && notificationCount > 0 && !isActive && (
                <div
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] flex items-center justify-center rounded-full px-1"
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

            <span
              className="text-[11px] whitespace-nowrap"
              style={{
                color: isActive ? "#AB1738" : "#54565B",
                fontWeight: isActive ? 700 : 500,
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
      className="fixed bottom-6 left-4 right-4 z-50 overflow-visible pointer-events-none"
    >
      {navCore}
    </div>
  );

  if (typeof document === "undefined") return nav;
  return createPortal(nav, document.body);
}
