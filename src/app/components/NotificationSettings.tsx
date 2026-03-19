import { useState, useCallback } from "react";
import {
  ChevronLeft, BellOff, Volume2, Eye, Zap,
} from "lucide-react";
import { type NotifPrefs } from "./SettingsView";

/* ─── Institutional palette ─── */
const GUINDO = "#AB1738";
const GUINDO_DARK = "#8B1028";
const DORADO = "#BC955B";

/* ─── iOS 26 system tokens ─── */
const IOS = {
  label: "#1C1C1E",
  sectionHeader: "#86868B",
  secondaryText: "#8E8E93",
  separator: "rgba(60,60,67,0.12)",
  cardBg: "rgba(255,255,255,0.92)",
  pageBg: "#F2F2F7",
};

/* ─── Shared UI primitives ─── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{
        background: IOS.cardBg,
        boxShadow: "0 0 0 0.33px rgba(0,0,0,0.04), 0 0.5px 2px rgba(0,0,0,0.03)",
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] mb-[6px] ml-4" style={{ fontWeight: 400, color: IOS.sectionHeader }}>
      {children}
    </p>
  );
}

function SectionFooter({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] mt-[6px] mx-4" style={{ fontWeight: 400, color: IOS.sectionHeader, lineHeight: "18px" }}>
      {children}
    </p>
  );
}

function Sep({ inset = 16 }: { inset?: number }) {
  return <div style={{ height: 0.33, marginLeft: inset, background: IOS.separator }} />;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative shrink-0 transition-colors duration-300 rounded-full"
      style={{
        width: 51, height: 31,
        background: on ? `linear-gradient(135deg, ${GUINDO}, ${GUINDO_DARK})` : "rgba(120,120,128,0.16)",
      }}
    >
      <div
        className="absolute top-[2px] rounded-full bg-white transition-transform duration-300"
        style={{
          width: 27, height: 27,
          boxShadow: "0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.06)",
          transform: on ? "translateX(22px)" : "translateX(2px)",
        }}
      />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PHONE MOCKUP — CSS-only illustration for the style picker
   ═══════════════════════════════════════════════════════════════ */
function PhoneMockup({ variant, selected }: { variant: "banner" | "stack" | "silent"; selected: boolean }) {
  const borderColor = selected ? GUINDO : "rgba(0,0,0,0.12)";
  const bgFill = selected ? `${GUINDO}08` : "rgba(0,0,0,0.02)";

  return (
    <div className="relative" style={{ width: 62, height: 100 }}>
      <div
        className="absolute inset-0 rounded-[12px] overflow-hidden flex flex-col"
        style={{ border: `1.5px solid ${borderColor}`, background: bgFill, transition: "all 0.3s ease" }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5">
          <span style={{ fontSize: 6, fontWeight: 700, color: selected ? IOS.label : "#AEAEB2" }}>9:41</span>
          <div className="flex gap-[2px]">
            <div className="w-[6px] h-[3px] rounded-[1px]" style={{ background: selected ? IOS.label : "#C7C7CC" }} />
            <div className="w-[6px] h-[3px] rounded-[1px]" style={{ background: selected ? IOS.label : "#C7C7CC" }} />
          </div>
        </div>

        {/* Notch */}
        <div className="mx-auto w-[20px] h-[5px] rounded-full mb-1" style={{ background: selected ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)" }} />

        {/* Content area */}
        <div className="flex-1 flex flex-col items-center justify-center px-1.5 gap-[3px]">
          {variant === "banner" && (
            <>
              <div
                className="w-full rounded-[4px] px-1.5 py-1"
                style={{ background: selected ? `${GUINDO}18` : "rgba(0,0,0,0.05)", border: `0.5px solid ${selected ? `${GUINDO}25` : "rgba(0,0,0,0.04)"}` }}
              >
                <div className="flex items-center gap-1 mb-[2px]">
                  <div className="w-[5px] h-[5px] rounded-[1.5px]" style={{ background: selected ? GUINDO : "#C7C7CC" }} />
                  <div className="h-[2px] rounded-full" style={{ width: 18, background: selected ? GUINDO : "#C7C7CC", opacity: 0.7 }} />
                </div>
                <div className="h-[2px] rounded-full" style={{ width: "90%", background: selected ? `${GUINDO}40` : "rgba(0,0,0,0.08)" }} />
                <div className="h-[2px] rounded-full mt-[2px]" style={{ width: "60%", background: selected ? `${GUINDO}25` : "rgba(0,0,0,0.05)" }} />
              </div>
              <div className="w-full space-y-[3px] mt-1 px-0.5">
                <div className="h-[2px] rounded-full" style={{ width: "100%", background: "rgba(0,0,0,0.04)" }} />
                <div className="h-[2px] rounded-full" style={{ width: "70%", background: "rgba(0,0,0,0.03)" }} />
              </div>
            </>
          )}
          {variant === "stack" && (
            <div className="relative w-full" style={{ height: 36 }}>
              <div className="absolute left-[3px] right-[3px] rounded-[4px]" style={{ top: 0, height: 14, background: selected ? `${DORADO}15` : "rgba(0,0,0,0.03)", border: `0.5px solid ${selected ? `${DORADO}20` : "rgba(0,0,0,0.03)"}` }} />
              <div className="absolute left-[1.5px] right-[1.5px] rounded-[4px]" style={{ top: 5, height: 16, background: selected ? `${GUINDO}12` : "rgba(0,0,0,0.04)", border: `0.5px solid ${selected ? `${GUINDO}18` : "rgba(0,0,0,0.04)"}` }} />
              <div className="absolute left-0 right-0 rounded-[4px] px-1.5 py-1" style={{ top: 11, height: 22, background: selected ? `${GUINDO}18` : "rgba(0,0,0,0.05)", border: `0.5px solid ${selected ? `${GUINDO}25` : "rgba(0,0,0,0.05)"}` }}>
                <div className="flex items-center gap-1 mb-[2px]">
                  <div className="w-[5px] h-[5px] rounded-[1.5px]" style={{ background: selected ? GUINDO : "#C7C7CC" }} />
                  <div className="h-[2px] rounded-full" style={{ width: 14, background: selected ? GUINDO : "#C7C7CC", opacity: 0.7 }} />
                </div>
                <div className="h-[2px] rounded-full" style={{ width: "80%", background: selected ? `${GUINDO}40` : "rgba(0,0,0,0.08)" }} />
              </div>
            </div>
          )}
          {variant === "silent" && (
            <div className="flex flex-col items-center gap-1">
              <BellOff className="w-[16px] h-[16px]" style={{ color: selected ? IOS.secondaryText : "#C7C7CC" }} strokeWidth={1.5} />
              <div className="w-full space-y-[3px] px-1">
                <div className="h-[2px] rounded-full mx-auto" style={{ width: 24, background: "rgba(0,0,0,0.04)" }} />
                <div className="h-[2px] rounded-full mx-auto" style={{ width: 16, background: "rgba(0,0,0,0.03)" }} />
              </div>
            </div>
          )}
        </div>

        {/* Home indicator */}
        <div className="mx-auto mb-1.5 rounded-full" style={{ width: 18, height: 2.5, background: selected ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.06)" }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION SETTINGS — Main exported component
   Estilo de alerta, general settings, and summary.
   ═══════════════════════════════════════════════════════════════ */
export function NotificationSettings({
  onBack,
  prefs,
}: {
  onBack: () => void;
  prefs: NotifPrefs;
  onUpdatePrefs: (partial: Partial<NotifPrefs>) => void;
}) {
  const [alertStyle, setAlertStyle] = useState<"banner" | "stack" | "silent">(() => {
    return (localStorage.getItem("pc-alert-style") as "banner" | "stack" | "silent") || "stack";
  });
  const [sounds, setSounds] = useState(true);

  const handleStyleChange = useCallback((style: "banner" | "stack" | "silent") => {
    setAlertStyle(style);
    localStorage.setItem("pc-alert-style", style);
  }, []);

  const r911ActivePri = [prefs.r911Alta, prefs.r911Media, prefs.r911Baja].filter(Boolean).length;
  const monActivePri = [prefs.monAlta, prefs.monMedia, prefs.monBaja].filter(Boolean).length;

  const styleLabels = { banner: "Banner", stack: "Agrupado", silent: "Silencioso" };

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: IOS.pageBg }}>
      {/* ─── Header ─── */}
      <div
        className="flex items-center gap-1 px-1 shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)", minHeight: 52 }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-0.5 px-2 py-2 active:opacity-50 transition-opacity"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <ChevronLeft className="w-[22px] h-[22px]" style={{ color: GUINDO }} strokeWidth={2} />
          <span className="text-[17px]" style={{ color: GUINDO, fontWeight: 400 }}>Ajustes</span>
        </button>
        <div className="flex-1 flex justify-center pr-[80px]">
          <span className="text-[17px]" style={{ color: IOS.label, fontWeight: 600 }}>
            Notificaciones
          </span>
        </div>
      </div>

      {/* ─── Scrollable content ─── */}
      <div className="flex-1 overflow-y-auto pb-12">

        {/* ═══ Estilo de Alerta — Visual Picker ═══ */}
        <div className="px-4 mt-4 mb-6">
          <SectionHeader>Estilo de Alerta</SectionHeader>
          <Card>
            <div className="flex items-end justify-center gap-4 px-4 pt-5 pb-3">
              {(["banner", "stack", "silent"] as const).map((variant) => {
                const isSelected = alertStyle === variant;
                return (
                  <button
                    key={variant}
                    onClick={() => handleStyleChange(variant)}
                    className="flex flex-col items-center gap-2 active:scale-[0.96] transition-transform"
                  >
                    <PhoneMockup variant={variant} selected={isSelected} />
                    <div
                      className="px-3 py-[5px] rounded-full transition-all"
                      style={{ background: isSelected ? `linear-gradient(135deg, ${GUINDO}, ${GUINDO_DARK})` : "transparent" }}
                    >
                      <span
                        className="text-[13px] transition-colors"
                        style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? "#fff" : IOS.secondaryText }}
                      >
                        {styleLabels[variant]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
          <SectionFooter>
            Elige cómo aparecen las alertas en tu pantalla de bloqueo.
          </SectionFooter>
        </div>

        {/* ═══ General ═══ */}
        <div className="px-4 mb-6">
          <SectionHeader>General</SectionHeader>
          <Card>
            <div className="flex items-center gap-3 px-4" style={{ minHeight: 44 }}>
              <div className="w-[29px] h-[29px] rounded-[7px] flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #FF2D55, #E0245E)" }}>
                <Volume2 className="w-[15px] h-[15px] text-white" strokeWidth={2} />
              </div>
              <span className="flex-1 text-[17px]" style={{ color: IOS.label, fontWeight: 400 }}>Sonidos</span>
              <Toggle on={sounds} onChange={setSounds} />
            </div>
            <Sep inset={56} />
            <div className="flex items-center gap-3 px-4" style={{ minHeight: 44 }}>
              <div className="w-[29px] h-[29px] rounded-[7px] flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #5856D6, #4A48BF)" }}>
                <Eye className="w-[15px] h-[15px] text-white" strokeWidth={2} />
              </div>
              <span className="flex-1 text-[17px]" style={{ color: IOS.label, fontWeight: 400 }}>Vista Previa</span>
              <span className="text-[17px] mr-0.5" style={{ color: IOS.secondaryText, fontWeight: 400 }}>Siempre</span>
            </div>
            <Sep inset={56} />
            <div className="flex items-center gap-3 px-4" style={{ minHeight: 44 }}>
              <div className="w-[29px] h-[29px] rounded-[7px] flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #FF9500, #E8870E)" }}>
                <Zap className="w-[15px] h-[15px] text-white" strokeWidth={2} />
              </div>
              <span className="flex-1 text-[17px]" style={{ color: IOS.label, fontWeight: 400 }}>Alertas Críticas</span>
              <Toggle on={true} onChange={() => {}} />
            </div>
          </Card>
          <SectionFooter>
            Las alertas críticas ignoran el modo silencioso y No Molestar.
          </SectionFooter>
        </div>

        {/* ═══ Resumen ═══ */}
        <div className="px-4 mb-6">
          <SectionHeader>Resumen</SectionHeader>
          <Card>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[15px]" style={{ color: IOS.label, fontWeight: 500 }}>Estado actual</span>
                <span
                  className="text-[13px] px-2 py-0.5 rounded-full"
                  style={{
                    fontWeight: 500,
                    color: (prefs.reportes911 || prefs.monitoreo) ? "#34C759" : IOS.secondaryText,
                    background: (prefs.reportes911 || prefs.monitoreo) ? "#34C75912" : "rgba(0,0,0,0.04)",
                  }}
                >
                  {(prefs.reportes911 || prefs.monitoreo) ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 rounded-[10px] p-3" style={{ background: "rgba(0,0,0,0.025)" }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-[6px] h-[6px] rounded-full" style={{ background: prefs.reportes911 ? GUINDO : "#C7C7CC" }} />
                    <span className="text-[12px]" style={{ color: IOS.secondaryText, fontWeight: 500 }}>911</span>
                  </div>
                  <p className="text-[22px]" style={{ color: IOS.label, fontWeight: 600, lineHeight: 1 }}>{prefs.reportes911 ? r911ActivePri : 0}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: IOS.secondaryText }}>prioridades</p>
                </div>
                <div className="flex-1 rounded-[10px] p-3" style={{ background: "rgba(0,0,0,0.025)" }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-[6px] h-[6px] rounded-full" style={{ background: prefs.monitoreo ? DORADO : "#C7C7CC" }} />
                    <span className="text-[12px]" style={{ color: IOS.secondaryText, fontWeight: 500 }}>Monitoreo</span>
                  </div>
                  <p className="text-[22px]" style={{ color: IOS.label, fontWeight: 600, lineHeight: 1 }}>{prefs.monitoreo ? monActivePri : 0}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: IOS.secondaryText }}>prioridades</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
