import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "./RouterContext";
import { LiquidGlassNav, type NavView } from "./LiquidGlassNav";

const LAB_NAV_SPACE = "calc(var(--pc-nav-bottom-offset, 8px) + 88px)";
const LAB_TOP_SPACE = "calc(var(--pc-safe-top-effective, env(safe-area-inset-top, 0px)) + 96px)";

type LabCard = {
  id: number;
  title: string;
  body: string;
};

function createCards(): LabCard[] {
  return Array.from({ length: 16 }, (_, idx) => ({
    id: idx + 1,
    title: `Bloque de prueba #${idx + 1}`,
    body: "Este bloque existe para validar scroll real, overlays fijos y espacios inferiores sin parches visuales.",
  }));
}

export function LayoutLabScreen() {
  const navigate = useNavigate();
  const [navView, setNavView] = useState<NavView>("home");
  const [showGrid, setShowGrid] = useState(true);
  const cards = useMemo(() => createCards(), []);

  return (
    <div
      className="h-full relative overflow-hidden text-white"
      style={{
        background:
          "linear-gradient(160deg, #190208 0%, #420A17 42%, #7C1430 70%, #BC955B 100%)",
      }}
    >
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      )}

      <div
        className="absolute inset-x-0 z-20 px-4"
        style={{ top: "max(8px, var(--pc-safe-top-effective, env(safe-area-inset-top, 0px)))" }}
      >
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: "rgba(14, 4, 8, 0.76)",
            border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate("/")}
              className="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-70"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <p className="text-[17px]" style={{ fontWeight: 700 }}>
                Layout Lab
              </p>
              <p className="text-[12px] text-white/75">
                Pantalla aislada para depurar viewport + safe-area + menú
              </p>
            </div>
            <button
              onClick={() => setShowGrid((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-[12px] active:opacity-80"
              style={{ background: "rgba(255,255,255,0.15)", fontWeight: 600 }}
            >
              {showGrid ? "Grid On" : "Grid Off"}
            </button>
          </div>
          <div className="text-[11px] text-white/80 leading-5">
            <div>safe-bottom-effective: var(--pc-safe-bottom-effective)</div>
            <div>safe-bottom-raw: var(--pc-safe-bottom-raw)</div>
            <div>viewport-excludes-insets: var(--pc-safe-viewport-excludes-insets)</div>
          </div>
        </div>
      </div>

      <div
        className="h-full overflow-y-auto px-4"
        style={{
          paddingTop: LAB_TOP_SPACE,
          paddingBottom: LAB_NAV_SPACE,
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
        }}
      >
        <div
          className="rounded-3xl px-4 py-5 mb-4"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.22)",
          }}
        >
          <p className="text-[15px]" style={{ fontWeight: 600, lineHeight: 1.5 }}>
            Si esta pantalla se recorta o muestra un cuadro inferior, el problema es layout base.
            Si aquí se ve bien, el problema está en una vista específica.
          </p>
        </div>

        <div className="space-y-3">
          {cards.map((card) => (
            <div
              key={card.id}
              className="rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.9)",
                color: "#1C1C1E",
                border: "1px solid rgba(255,255,255,0.7)",
                boxShadow: "0 8px 22px rgba(0,0,0,0.16)",
              }}
            >
              <h3 className="text-[16px] mb-1.5" style={{ fontWeight: 700 }}>
                {card.title}
              </h3>
              <p className="text-[14px] text-[#3A3A3C]" style={{ lineHeight: 1.45 }}>
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <LiquidGlassNav
        currentView={navView}
        onChangeView={(view) => {
          if (view === "menu") return;
          setNavView(view);
        }}
      />
    </div>
  );
}
