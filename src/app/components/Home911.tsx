/* ═══════════════════════════════════════════════════════════════
   Home911.tsx — Pantalla de bienvenida para Personal de Campo 911
   Flujo: LoginScreen → Home911 → /911/nuevo (formulario)
   ═══════════════════════════════════════════════════════════════ */

import { AppHeader } from "./AppHeader";
import { SettingsView } from "./SettingsView";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  Flame,
  Droplets,
  HardHat,
  Car,
  Wind,
  Users,
  Zap,
  CircleDot,
  Plus,
  ChevronRight,
  MapPin,
  Shuffle,
  Loader2,
  Shield,
  Clock,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useNavigate } from "./RouterContext";
import {
  getSubmittedReports,
  fetchServerReports,
  type SubmittedReport,
} from "./reportStore";

/* ─── Paleta institucional ─── */
const GUINDO = "#AB1738";
const DORADO = "#BC955B";

/* ─── Pool de operadores para prototipado ─── */
const OPERADORES = [
  "Carlos Mendoza Reyes",
  "Ana Sofía Torres Garza",
  "Luis Hernández Ríos",
  "María José Salinas Vega",
  "Roberto Cavazos Leal",
  "Diana Treviño Soto",
  "Miguel Ángel Vásquez Cruz",
  "Paola Guzmán Elizondo",
  "Javier Morales Jiménez",
  "Fernanda Elizondo Paz",
];

export const STORAGE_KEY_OPERATOR = "pc-911-operator-name";

export function getOperatorName(): string {
  const stored = localStorage.getItem(STORAGE_KEY_OPERATOR);
  if (stored && OPERADORES.includes(stored)) return stored;
  const name = OPERADORES[0];
  localStorage.setItem(STORAGE_KEY_OPERATOR, name);
  return name;
}

/* ─── Tipo de emergencia → ícono + color ─── */
const TIPOS_MAP: Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { icon: React.ComponentType<any>; color: string }
> = {
  "Incendio Estructural": { icon: Flame, color: "#DC2626" },
  "Incendio Forestal": { icon: Flame, color: "#EA580C" },
  "Inundación Vial": { icon: Droplets, color: "#2563EB" },
  Derrumbe: { icon: HardHat, color: "#7C3AED" },
  "Accidente Vial": { icon: Car, color: "#D97706" },
  "Fuga de Gas": { icon: Wind, color: "#059669" },
  "Persona Lesionada": { icon: Users, color: "#DB2777" },
  Rescate: { icon: AlertTriangle, color: "#0891B2" },
  "Corto Circuito": { icon: Zap, color: "#F59E0B" },
  Otro: { icon: CircleDot, color: "#6B7280" },
};

/* ─── Prioridad ─── */
const PRIORIDAD_CFG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  alta: {
    label: "Alta",
    color: "#DC2626",
    bg: "rgba(220,38,38,0.10)",
    border: "rgba(220,38,38,0.22)",
  },
  media: {
    label: "Media",
    color: "#D97706",
    bg: "rgba(217,119,6,0.10)",
    border: "rgba(217,119,6,0.22)",
  },
  baja: {
    label: "Baja",
    color: "#059669",
    bg: "rgba(5,150,105,0.10)",
    border: "rgba(5,150,105,0.22)",
  },
};

/* ─── Estado derivado de prioridad ─── */
function getStatus(prioridad: string): {
  label: string;
  color: string;
  bg: string;
} {
  if (prioridad === "alta")
    return {
      label: "En Atención",
      color: "#DC2626",
      bg: "rgba(220,38,38,0.08)",
    };
  return {
    label: "Registrado",
    color: "#2563EB",
    bg: "rgba(37,99,235,0.08)",
  };
}

/* ─── Estilo Glass compartido ─── */
const glassCard: React.CSSProperties = {
  background: "var(--glass-bg-heavy)",
  boxShadow: "var(--shadow-card), var(--glass-highlight)",
  border: "0.5px solid rgba(255,255,255,0.52)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
};

/* ═══════════════════════════════════════════════════════════════
   REPORT CARD
   ═══════════════════════════════════════════════════════════════ */
function ReportCard({
  report,
  onPress,
}: {
  report: SubmittedReport;
  onPress: () => void;
}) {
  const tipo = TIPOS_MAP[report.tipoEmergencia] ?? TIPOS_MAP["Otro"];
  const IconComp = tipo.icon;
  const prioridad =
    PRIORIDAD_CFG[report.prioridad] ?? PRIORIDAD_CFG.media;
  const status = getStatus(report.prioridad);

  // Relative time from sentAt
  const diffMs = Date.now() - (report.sentAt || 0);
  const diffMin = Math.floor(diffMs / 60000);
  let relTime = "Hace un momento";
  if (diffMin >= 1 && diffMin < 60) relTime = `Hace ${diffMin} min`;
  else if (diffMin >= 60) {
    const hrs = Math.floor(diffMin / 60);
    relTime = `Hace ${hrs} hr${hrs > 1 ? "s" : ""}`;
  }

  return (
    <button
      onClick={onPress}
      className="w-full text-left rounded-2xl p-4 active:scale-[0.985] transition-transform duration-150"
      style={glassCard}
    >
      <div className="flex items-start gap-3.5">
        {/* Tipo ícono */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: `${tipo.color}18`,
            border: `1px solid ${tipo.color}30`,
          }}
        >
          <IconComp
            className="w-5 h-5"
            style={{ color: tipo.color }}
            strokeWidth={2}
          />
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          {/* Título + estado */}
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <span
              className="text-[15px] text-foreground truncate"
              style={{ fontWeight: 600 }}
            >
              {report.tipoEmergencia}
            </span>
            <span
              className="text-[11px] shrink-0 px-2 py-0.5 rounded-full"
              style={{
                color: status.color,
                background: status.bg,
                fontWeight: 600,
              }}
            >
              {status.label}
            </span>
          </div>

          {/* Folio */}
          <p
            className="text-[11px] text-muted-foreground mb-2"
            style={{ fontFamily: "'Courier New', monospace", letterSpacing: "0.02em" }}
          >
            {report.folio}
          </p>

          {/* Meta row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <MapPin
                className="w-3 h-3 shrink-0"
                style={{ color: GUINDO }}
                strokeWidth={2}
              />
              <span className="text-[12px] text-muted-foreground truncate">
                {report.municipio}
              </span>
              <span className="text-[12px] text-muted-foreground/40 mx-0.5">·</span>
              <Clock className="w-3 h-3 shrink-0 text-muted-foreground/50" strokeWidth={2} />
              <span className="text-[12px] text-muted-foreground">{relTime}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  color: prioridad.color,
                  background: prioridad.bg,
                  border: `0.5px solid ${prioridad.border}`,
                  fontWeight: 700,
                }}
              >
                {prioridad.label}
              </span>
              <ChevronRight
                className="w-3.5 h-3.5 text-muted-foreground/30"
                strokeWidth={2.5}
              />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════ */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div
        className="w-20 h-20 rounded-[24px] flex items-center justify-center mb-5"
        style={{
          background: "rgba(171,23,56,0.07)",
          border: "1px solid rgba(171,23,56,0.13)",
          boxShadow: "0 4px 20px rgba(171,23,56,0.06)",
        }}
      >
        <Shield
          className="w-10 h-10"
          style={{ color: `${GUINDO}60` }}
          strokeWidth={1.3}
        />
      </div>
      <p
        className="text-[16px] text-foreground mb-2"
        style={{ fontWeight: 600 }}
      >
        Sin reportes enviados
      </p>
      <p
        className="text-[14px] text-muted-foreground"
        style={{ lineHeight: 1.5 }}
      >
        Presiona el botón de abajo para registrar una emergencia desde campo.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOME 911 — COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
export function Home911() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);

  /* ── Nombre del operador ── */
  const [operatorName, setOperatorName] = useState<string>(getOperatorName);
  const [nameIndex, setNameIndex] = useState<number>(() => {
    const current = localStorage.getItem(STORAGE_KEY_OPERATOR);
    const idx = OPERADORES.indexOf(current ?? "");
    return idx >= 0 ? idx : 0;
  });
  const [showNameFeedback, setShowNameFeedback] = useState(false);

  /* ── Reportes ── */
  const [reports, setReports] = useState<SubmittedReport[]>(getSubmittedReports);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchServerReports()
      .then(() => {
        setReports(getSubmittedReports());
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const handler = () => setReports(getSubmittedReports());
    window.addEventListener("reports-updated", handler);
    return () => window.removeEventListener("reports-updated", handler);
  }, []);

  /* ── Cambiar operador (prototipo) ── */
  const handleNameTap = useCallback(() => {
    const nextIdx = (nameIndex + 1) % OPERADORES.length;
    const nextName = OPERADORES[nextIdx];
    setNameIndex(nextIdx);
    setOperatorName(nextName);
    localStorage.setItem(STORAGE_KEY_OPERATOR, nextName);
    setShowNameFeedback(true);
    setTimeout(() => setShowNameFeedback(false), 2000);
  }, [nameIndex]);

  /* ── Stats ── */
  const total = reports.length;
  const alta = reports.filter((r) => r.prioridad === "alta").length;
  const media = reports.filter((r) => r.prioridad === "media").length;
  const baja = reports.filter((r) => r.prioridad === "baja").length;

  const initials = operatorName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* ── Settings slide-in (mismo patrón que Dashboard911) ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            key="settings-overlay-911"
            className="fixed inset-0 z-[100] bg-[#F2F2F7] flex flex-col overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <SettingsView onClose={() => setShowSettings(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#F2F2F7] flex flex-col">
        <AppHeader
          title="Reportes 911"
          subtitle={operatorName}
          showBack={false}
          onSettingsPress={() => setShowSettings(true)}
        />

        {/* ══ Contenido scrollable ══ */}
        <div className="flex-1 px-4 pt-5 space-y-4 pb-6">

          {/* ── Card de perfil del operador ── */}
          <div className="rounded-2xl overflow-hidden" style={glassCard}>
            {/* Franja guindo superior — indicador de perfil 911 */}
            <div
              style={{
                height: 4,
                background: `linear-gradient(90deg, ${GUINDO} 0%, #C0253F 60%, transparent 100%)`,
              }}
            />
            <div className="p-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div
                  className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(145deg, ${GUINDO} 0%, #7C1028 100%)`,
                    boxShadow: `0 6px 20px rgba(171,23,56,0.38), inset 0 1px 0 rgba(255,255,255,0.15)`,
                  }}
                >
                  <span
                    className="text-white"
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {initials}
                  </span>
                </div>

                {/* Datos */}
                <div className="flex-1 min-w-0">
                  {/* Nombre tappable */}
                  <button
                    onClick={handleNameTap}
                    className="flex items-center gap-2 mb-0.5 active:opacity-65 transition-opacity"
                  >
                    <span
                      className="text-[17px] text-foreground truncate"
                      style={{ fontWeight: 700 }}
                    >
                      {operatorName}
                    </span>
                    <div
                      className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: `rgba(188,149,91,0.14)`,
                        border: `0.5px solid rgba(188,149,91,0.3)`,
                      }}
                    >
                      <Shuffle
                        className="w-3 h-3"
                        style={{ color: DORADO }}
                        strokeWidth={2.5}
                      />
                    </div>
                  </button>

                  {/* Feedback de nombre cambiado / rol */}
                  <div style={{ minHeight: 18 }}>
                    <AnimatePresence mode="wait">
                      {showNameFeedback ? (
                        <motion.p
                          key="feedback"
                          initial={{ opacity: 0, y: -3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 3 }}
                          transition={{ duration: 0.18 }}
                          className="text-[12px]"
                          style={{ color: DORADO, fontWeight: 600 }}
                        >
                          Operador cambiado ✓
                        </motion.p>
                      ) : (
                        <motion.p
                          key="role"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.18 }}
                          className="text-[13px] text-muted-foreground"
                        >
                          Personal de Campo · Reportes 911
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Estado de turno */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "#34C759" }}
                    />
                    <span
                      className="text-[12px]"
                      style={{ color: "#34C759", fontWeight: 500 }}
                    >
                      Turno activo
                    </span>
                  </div>
                </div>
              </div>

              {/* Nota de prototipo */}
              <div
                className="mt-3.5 px-3 py-2.5 rounded-xl flex items-center gap-2.5"
                style={{
                  background: `rgba(188,149,91,0.07)`,
                  border: `0.5px solid rgba(188,149,91,0.22)`,
                }}
              >
                <Shuffle
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: DORADO }}
                  strokeWidth={2}
                />
                <p
                  className="text-[11px]"
                  style={{ color: `rgba(188,149,91,0.9)`, lineHeight: 1.4 }}
                >
                  <span style={{ fontWeight: 700 }}>Prototipo:</span> Toca el
                  nombre para simular cambio de operador
                </p>
              </div>
            </div>
          </div>

          {/* ── Stats de reportes ── */}
          <div className="grid grid-cols-4 gap-2">
            {[
              {
                label: "Total",
                value: total,
                color: GUINDO,
                bg: "rgba(171,23,56,0.07)",
                border: "rgba(171,23,56,0.14)",
              },
              {
                label: "Alta",
                value: alta,
                color: "#DC2626",
                bg: "rgba(220,38,38,0.07)",
                border: "rgba(220,38,38,0.14)",
              },
              {
                label: "Media",
                value: media,
                color: "#D97706",
                bg: "rgba(217,119,6,0.07)",
                border: "rgba(217,119,6,0.14)",
              },
              {
                label: "Baja",
                value: baja,
                color: "#059669",
                bg: "rgba(5,150,105,0.07)",
                border: "rgba(5,150,105,0.14)",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl py-3 px-2 text-center"
                style={{
                  background: stat.bg,
                  border: `0.5px solid ${stat.border}`,
                  boxShadow: "var(--glass-shadow)",
                }}
              >
                <span
                  style={{
                    fontSize: 26,
                    color: stat.color,
                    fontWeight: 700,
                    lineHeight: 1,
                    display: "block",
                  }}
                >
                  {stat.value}
                </span>
                <p
                  className="text-[11px] text-muted-foreground mt-1"
                  style={{ fontWeight: 500 }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* ── Lista de reportes ── */}
          <div>
            {/* Encabezado de sección */}
            <div className="flex items-center justify-between mb-3 px-0.5">
              <div className="flex items-center gap-2">
                <span
                  className="text-[15px] text-foreground"
                  style={{ fontWeight: 700 }}
                >
                  Mis Reportes
                </span>
                {total > 0 && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(171,23,56,0.09)",
                      color: GUINDO,
                      fontWeight: 700,
                      border: "0.5px solid rgba(171,23,56,0.18)",
                    }}
                  >
                    {total}
                  </span>
                )}
              </div>
              {loading && (
                <Loader2
                  className="w-4 h-4 animate-spin"
                  style={{ color: GUINDO }}
                />
              )}
            </div>

            {/* Cards o empty state */}
            {reports.length === 0 && !loading ? (
              <EmptyState />
            ) : (
              <div className="space-y-2.5">
                {reports.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    onPress={() => navigate(`/911/${report.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Espaciador para el botón sticky */}
          <div style={{ height: 88 }} />
        </div>

        {/* ══ Botón sticky "Iniciar Nuevo Reporte 911" ══ */}
        <div
          className="shrink-0 px-4 pt-3 sticky bottom-0"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
            background: "rgba(242,242,247,0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 -0.5px 0 rgba(0,0,0,0.07), 0 -8px 24px rgba(0,0,0,0.04)",
          }}
        >
          <button
            onClick={() => navigate("/911/nuevo")}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl active:scale-[0.97] transition-transform duration-150"
            style={{
              height: 56,
              background: `linear-gradient(135deg, ${GUINDO} 0%, #7C1028 100%)`,
              boxShadow: `0 4px 20px rgba(171,23,56,0.38), 0 1px 4px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.12)`,
              color: "white",
            }}
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>
              Iniciar Nuevo Reporte 911
            </span>
          </button>
        </div>
      </div>
    </>
  );
}