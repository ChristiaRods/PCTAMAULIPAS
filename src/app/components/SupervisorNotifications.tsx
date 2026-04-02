import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "./RouterContext";
import { AppHeader } from "./AppHeader";
import { loadNotifPrefs } from "./SettingsView";
import {
  MapPin, AlertTriangle,
  Activity, BarChart3, CheckCircle2, Image as ImageIcon,
  Eye,
  Bell, Shield, AlertCircle, Info, UserCheck, Clock, Megaphone, ChevronRight,
  Download, FileText, Paperclip, Loader2, Play,
} from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { ImageLightbox, type LightboxData } from "./ImageLightbox";
import { feedItems, type FeedItem, type Monitoreo } from "./feedData";
import { getTextPostBackground } from "./textPostBackgrounds";
import { LiquidGlassNav, type NavView } from "./LiquidGlassNav";
import { consumePendingNotificationId, onNotificationClick } from "./NotificationDeepLink";
import { getSubmittedReports, fetchServerReports, toFeedItem } from "./reportStore";
import { PullToRefresh } from "./PullToRefresh";
import { API_BASE, apiHeaders } from "../lib/apiClient";
import { fetchServerMonitoring, getSubmittedMonitorings, toMonitoringFeedItem } from "./monitoringStore";

/* ─── Server push notification type ─── */
interface ServerNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  createdAt: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  linkedReportId?: string;
}

interface ServerNotificationOpenRequest {
  id: string;
  token: number;
}

/* ─── Persist tab state across unmount/remount ─── */
const SUPERVISOR_NAV_STATE_KEY = "pc-supervisor-nav-state-v1";

function loadSupervisorNavState(): {
  view: NavView;
  scroll: Record<string, number>;
} {
  if (typeof window === "undefined") {
    return { view: "home", scroll: {} };
  }
  try {
    const raw = sessionStorage.getItem(SUPERVISOR_NAV_STATE_KEY);
    if (!raw) {
      return { view: "home", scroll: {} };
    }
    const parsed = JSON.parse(raw);
    const view = parsed?.view as NavView;
    const safeView: NavView =
      view === "home" ||
      view === "reportes" ||
      view === "monitoreo" ||
      view === "notificaciones"
        ? view
        : "home";
    return {
      view: safeView,
      scroll:
        parsed?.scroll && typeof parsed.scroll === "object"
          ? parsed.scroll
          : {},
    };
  } catch {
    return { view: "home", scroll: {} };
  }
}

const _initialSupervisorNavState = loadSupervisorNavState();
let _savedNavView: NavView = _initialSupervisorNavState.view;
const _tabScrollPositions: Record<string, number> = {
  ..._initialSupervisorNavState.scroll,
};

function persistSupervisorNavState() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      SUPERVISOR_NAV_STATE_KEY,
      JSON.stringify({
        view: _savedNavView,
        scroll: _tabScrollPositions,
      }),
    );
  } catch (_e) {}
}

/* ─── Post Type Config ─── */
function getTypeConfig(type: FeedItem["type"]) {
  switch (type) {
    case "reporte911": return { icon: AlertTriangle, label: "Reporte 911", accentColor: "#DC2626" };
    case "monitoreo": return { icon: BarChart3, label: "Monitoreo", accentColor: "#AB1738" };
  }
}

/* ─── Status dot color ─── */
function getStatusDotColor(label: string) {
  switch (label) {
    case "En Atención":
    case "En Proceso":
      return "#F59E0B";
    case "Nuevo Reporte":
      return "#EF4444";
    case "Activo":
      return "#3B82F6";
    case "En seguimiento":
      return "#0EA5E9";
    case "En validación":
      return "#8B5CF6";
    case "Atendido":
      return "#059669";
    case "Cerrado":
      return "#6B7280";
    case "Archivado":
      return "#9CA3AF";
    case "Falso reporte":
      return "#FB7185";
    case "No localizado":
      return "#FB923C";
    case "Registrado":
      return "#3B82F6";
    default:
      return "#9CA3AF";
  }
}

type VisualFeedMedia = {
  kind: "image" | "video";
  src: string;
  nombre?: string;
  posterSrc?: string;
};

function getOrderedVisualMedia(item: FeedItem): VisualFeedMedia[] {
  const fromEvidence = (item.evidencias || [])
    .filter((ev) => ev.kind === "image" || ev.kind === "video")
    .map((ev) => ({
      kind: ev.kind as "image" | "video",
      src: ev.src,
      nombre: ev.nombre,
      posterSrc: ev.posterSrc,
    }))
    .filter((ev) => typeof ev.src === "string" && ev.src.trim().length > 0);
  if (fromEvidence.length > 0) return fromEvidence;

  return (item.images || [])
    .filter((src) => typeof src === "string" && src.trim().length > 0)
    .map((src, idx) => ({
      kind: "image" as const,
      src,
      nombre: `imagen_${idx + 1}`,
    }));
}

/* ─── Feed Post Card — Social Feed Style ─── */
function FeedCard({ item, onOpen, onImageClick }: { item: FeedItem; onOpen: () => void; onImageClick: () => void }) {
  const config = getTypeConfig(item.type);
  const statusDot = getStatusDotColor(item.estatus);
  const visualMedia = getOrderedVisualMedia(item);
  const hasVisualMedia = visualMedia.length > 0;
  const primaryVisual = hasVisualMedia ? visualMedia[0] : null;
  const isMonitoreo = item.type === "monitoreo";
  const textBg = !hasVisualMedia ? getTextPostBackground(item.id, item.type) : null;
  const [expanded, setExpanded] = useState(false);

  if (!hasVisualMedia && textBg) {
    console.log(`Text-only post: ${item.id} (${item.type})`);
  }

  const descTruncated = item.descripcion.length > 250 && !expanded;
  const descText = descTruncated
    ? item.descripcion.slice(0, 250).replace(/\s+\S*$/, "") + "..."
    : item.descripcion;

  return (
    <article
      className="overflow-hidden cursor-pointer active:bg-[#FAFAFA] transition-colors"
      style={{ background: "#FFFFFF" }}
      onClick={onOpen}
    >
      <div className="px-4 pt-3.5 pb-2.5">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full ${item.autor.avatarColor} flex items-center justify-center shrink-0`}
          >
            <span className="text-white text-[14px]">{item.autor.iniciales}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[15px] text-[#1C1C1E] truncate" style={{ fontWeight: 600 }}>{item.autor.nombre}</p>
              <span className="text-[13px] text-[#8E8E93] shrink-0">· {item.relativeTime}</span>
              {item.isNew && (
                <span className="shrink-0 w-[7px] h-[7px] rounded-full bg-[#DC2626]" />
              )}
            </div>
            <p className="text-[13px] text-[#8E8E93]">
              {item.autor.rol} · <span className="tabular-nums">{item.folio}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <config.icon className="w-3.5 h-3.5" style={{ color: config.accentColor }} strokeWidth={2.2} />
          <span className="text-[11px]" style={{ color: config.accentColor, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            {config.label}
          </span>
        </div>

        <h3 className="text-[17px] text-[#1C1C1E] mb-1.5" style={{ fontWeight: 600, lineHeight: 1.3 }}>{item.titulo}</h3>

        {isMonitoreo && (
          <p className="text-[13px] text-[#636366] mb-1.5">
            {(item as Monitoreo).datosGenerales.tipoMonitoreo} · {(item as Monitoreo).datosGenerales.subtipoMonitoreo}
          </p>
        )}

        <div className="flex items-center gap-1.5 text-[13px] text-[#8E8E93] mb-2.5">
          <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
          <span className="truncate">{item.ubicacion}, {item.municipio}</span>
          <span className="shrink-0">·</span>
          <span className="inline-flex items-center gap-1 shrink-0">
            <span className="w-[6px] h-[6px] rounded-full" style={{ background: statusDot }} />
            <span style={{ color: statusDot }}>{item.estatus}</span>
          </span>
        </div>

        {hasVisualMedia && (
          <p className="text-[15px] text-[#3A3A3C]" style={{ lineHeight: 1.5 }}>
            {descText}
            {descTruncated && (
              <span
                className="ml-1 cursor-pointer"
                style={{ color: "#BC955B", fontWeight: 500 }}
                onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
              >
                ver más
              </span>
            )}
          </p>
        )}
      </div>

      {hasVisualMedia ? (
        <div className="px-3 pb-3">
          <div className="relative overflow-hidden" style={{ borderRadius: "12px" }}>
            {primaryVisual?.kind === "image" ? (
              <div
                className="relative cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onImageClick(); }}
              >
                <ImageWithFallback src={primaryVisual.src} alt={item.titulo} className="w-full h-52 object-cover" />
              </div>
            ) : (
              <div
                className="relative"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <video
                  src={primaryVisual?.src}
                  poster={primaryVisual?.posterSrc}
                  className="w-full h-52 object-cover bg-[#1C1C1E]"
                  controls
                  playsInline
                  preload="metadata"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
                  >
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            )}

            {visualMedia.length > 1 && (
              <div
                className="absolute bottom-2.5 right-2.5 text-white text-[12px] px-2.5 py-1 rounded-full flex items-center gap-1"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
              >
                {primaryVisual?.kind === "video" ? (
                  <Play className="w-3.5 h-3.5 fill-white" strokeWidth={1.8} />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5" strokeWidth={2} />
                )}
                +{visualMedia.length - 1}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden flex items-center justify-center"
          style={{
            background: textBg!.gradient,
            minHeight: "208px",
          }}
        >
          <div
            className="absolute inset-0"
            style={textBg!.pattern}
          />

          <p
            className="relative z-10 text-white text-center px-6 py-5"
            style={{
              lineHeight: 1.45,
              fontSize: item.descripcion.length > 120 ? "18px" : "22px",
              fontWeight: 600,
              textShadow: "0 1px 3px rgba(0,0,0,0.3)",
              maxWidth: "90%",
            }}
          >
            {item.descripcion}
          </p>
        </div>
      )}
    </article>
  );
}

/* ─── Closed statuses ─── */
const CLOSED_STATUSES = ["Atendido", "Cerrado", "Archivado", "Falso reporte"];

/* ─── Persistent read state ─── */
const READ_STATE_KEY = "pc-tamaulipas-read-notifs";

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_STATE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (_e) { return new Set(); }
}

function saveReadIds(ids: Set<string>) {
  try { localStorage.setItem(READ_STATE_KEY, JSON.stringify([...ids])); } catch (_e) {}
}

function markIdRead(id: string) {
  const ids = loadReadIds();
  ids.add(id);
  saveReadIds(ids);
}

function markIdsRead(newIds: string[]) {
  const ids = loadReadIds();
  newIds.forEach((id) => ids.add(id));
  saveReadIds(ids);
}

/* ─── Notifications Data ─── */
interface AppNotification {
  id: string;
  type: "alerta" | "sistema" | "asignacion" | "actualizacion" | "recordatorio" | "comunicado";
  title: string;
  body: string;
  time: string;
  read: boolean;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  linkedFeedId?: string; // links to a feed item for navigation
  priority: "alta" | "media" | "baja";
  category: "reportes911" | "monitoreo" | "sistema";
}

const mockNotifications: AppNotification[] = [
  {
    id: "n1",
    type: "alerta",
    title: "Alerta meteorológica activa",
    body: "Se prevén lluvias intensas de 75 a 150 mm en zona sur de Tamaulipas. Se activa protocolo preventivo.",
    time: "Hace 3 min",
    read: false,
    icon: AlertTriangle,
    iconBg: "linear-gradient(135deg, #DC2626, #EF4444)",
    iconColor: "#FFFFFF",
    linkedFeedId: "MON-2026-0008",
    priority: "alta",
    category: "monitoreo",
  },
  {
    id: "n2",
    type: "asignacion",
    title: "Nueva asignación: Incendio Estructural",
    body: "Se te asignó la supervisión del reporte 911-2026-0147 — Incendio Estructural en Col. Centro, Victoria.",
    time: "Hace 12 min",
    read: false,
    icon: UserCheck,
    iconBg: "linear-gradient(135deg, #AB1738, #D4214A)",
    iconColor: "#FFFFFF",
    linkedFeedId: "911-2026-0147",
    priority: "alta",
    category: "reportes911",
  },
  {
    id: "n3",
    type: "actualizacion",
    title: "Reporte 911-2026-0148 actualizado",
    body: "El operador cambió el estatus a \"En Atención\". Corto Circuito en Local Comercial, Tampico.",
    time: "Hace 25 min",
    read: false,
    icon: Info,
    iconBg: "linear-gradient(135deg, #3B82F6, #60A5FA)",
    iconColor: "#FFFFFF",
    linkedFeedId: "911-2026-0148",
    priority: "media",
    category: "reportes911",
  },
  {
    id: "n4",
    type: "comunicado",
    title: "Comunicado: Simulacro regional",
    body: "Se realizará simulacro de evacuación el 15 de marzo en coordinación con municipios de la zona sur.",
    time: "Hace 1 hr",
    read: true,
    icon: Megaphone,
    iconBg: "linear-gradient(135deg, #BC955B, #D4AB6E)",
    iconColor: "#FFFFFF",
    linkedFeedId: "MON-2026-0017",
    priority: "baja",
    category: "monitoreo",
  },
  {
    id: "n5",
    type: "sistema",
    title: "Mantenimiento programado",
    body: "El sistema estará en mantenimiento el domingo 16 de marzo de 02:00 a 04:00 hrs.",
    time: "Hace 2 hr",
    read: true,
    icon: Shield,
    iconBg: "linear-gradient(135deg, #6B7280, #9CA3AF)",
    iconColor: "#FFFFFF",
    priority: "baja",
    category: "sistema",
  },
  {
    id: "n6",
    type: "recordatorio",
    title: "Recordatorio: Monitoreo pendiente",
    body: "Tienes 3 monitoreos asignados que requieren seguimiento antes de las 18:00 hrs.",
    time: "Hace 3 hr",
    read: true,
    icon: Clock,
    iconBg: "linear-gradient(135deg, #F59E0B, #FBBF24)",
    iconColor: "#FFFFFF",
    priority: "media",
    category: "monitoreo",
  },
  {
    id: "n7",
    type: "alerta",
    title: "Accidente Vial Múltiple atendido",
    body: "Se reportó accidente vial de 3 vehículos en Carretera Federal 85, Km 14. 2 lesionados atendidos.",
    time: "Hace 4 hr",
    read: true,
    icon: AlertCircle,
    iconBg: "linear-gradient(135deg, #EA580C, #F97316)",
    iconColor: "#FFFFFF",
    linkedFeedId: "911-2026-0145",
    priority: "alta",
    category: "reportes911",
  },
  {
    id: "n8",
    type: "actualizacion",
    title: "Derrumbe Parcial — en atención",
    body: "Se confirma derrumbe parcial de muro perimetral en Col. Las Granjas, Reynosa. Sin personas atrapadas.",
    time: "Hace 5 hr",
    read: true,
    icon: CheckCircle2,
    iconBg: "linear-gradient(135deg, #059669, #34D399)",
    iconColor: "#FFFFFF",
    linkedFeedId: "911-2026-0146",
    priority: "media",
    category: "reportes911",
  },
];

/* ─── Build notifications from submitted reports ─── */
function makeReportSnippet(
  report: import("./reportStore").SubmittedReport,
): string {
  const clip = (text: string, max = 120) => {
    const normalized = text.trim().replace(/\s+/g, " ");
    if (!normalized) return "";
    return normalized.length > max
      ? `${normalized.slice(0, max).trimEnd()}...`
      : normalized;
  };

  const transcripts =
    (report.audioNotes || [])
      .map((note) => (note?.transcript || "").trim())
      .filter((text) => text.length > 0);

  let primary = (report.descripcion || "").trim();
  if (!primary && transcripts.length > 0) {
    primary = transcripts[0];
  } else if (primary.length < 100 && transcripts.length > 0 && !primary.includes(transcripts[0])) {
    primary = `${primary} ${transcripts[0]}`.trim();
  }
  if (primary.length < 100 && transcripts.length > 1 && !primary.includes(transcripts[1])) {
    primary = `${primary} ${transcripts[1]}`.trim();
  }

  if (!primary && report.audioTranscript && report.audioTranscript.trim().length > 0) {
    primary = report.audioTranscript.trim();
  }

  const result = clip(primary);
  if (result) return result;
  return "Sin descripción adicional.";
}

function buildReportNotifications(reports: import("./reportStore").SubmittedReport[]): AppNotification[] {
  return reports.map((r, i) => {
    const sentAt = typeof r.sentAt === "number" ? r.sentAt : Date.now();
    const diffMin = Math.floor((Date.now() - sentAt) / 60000);
    const time = diffMin < 1 ? "Ahora" : diffMin < 60 ? `Hace ${diffMin} min` : `Hace ${Math.floor(diffMin / 60)} hr`;
    const snippet = makeReportSnippet(r);
    return {
      id: `report-notif-${r.id}`,
      type: "alerta" as const,
      title: `Nuevo reporte: ${r.tipoEmergencia}`,
      body: `${r.ubicacion}, ${r.municipio}. ${snippet} Prioridad ${(r.prioridad || "media").toUpperCase()}. Enviado por ${r.reportadoPor}.`,
      time,
      read: i > 0, // only the newest one is unread
      icon: AlertTriangle,
      iconBg: r.prioridad === "alta" ? "linear-gradient(135deg, #DC2626, #EF4444)" : r.prioridad === "media" ? "linear-gradient(135deg, #F59E0B, #FBBF24)" : "linear-gradient(135deg, #059669, #34D399)",
      iconColor: "#FFFFFF",
      linkedFeedId: r.id,
      priority: r.prioridad,
      category: "reportes911",
    };
  });
}

function buildMonitoringNotifications(monitoring: import("./monitoringStore").SubmittedMonitoring[]): AppNotification[] {
  return monitoring.map((m, i) => {
    const diffMin = Math.floor((Date.now() - m.sentAt) / 60000);
    const time = diffMin < 1 ? "Ahora" : diffMin < 60 ? `Hace ${diffMin} min` : `Hace ${Math.floor(diffMin / 60)} hr`;
    return {
      id: `monitoring-notif-${m.id}`,
      type: "sistema" as const,
      title: `Nuevo monitoreo: ${m.tipoMonitoreo}`,
      body: `${m.localidad}, ${m.municipio}. Registrado por ${m.reportadoPor}.`,
      time,
      read: i > 0,
      icon: Activity,
      iconBg: "linear-gradient(135deg, #AB1738, #8B1028)",
      iconColor: "#FFFFFF",
      linkedFeedId: m.id,
      priority: "media",
      category: "monitoreo",
    };
  });
}

/* ─── Notifications View ─── */
function NotificationsView({
  onNavigateToFeed,
  containerRef,
  openServerNotificationRequest,
  onServerNotificationRequestHandled,
}: {
  onNavigateToFeed: (feedId: string) => void;
  containerRef?: React.Ref<HTMLDivElement>;
  openServerNotificationRequest?: ServerNotificationOpenRequest | null;
  onServerNotificationRequestHandled?: (token: number) => void;
}) {
  const [reportNotifs, setReportNotifs] = useState<AppNotification[]>([]);
  const [notifications] = useState(mockNotifications);
  const [serverNotifs, setServerNotifs] = useState<ServerNotification[]>([]);
  const [loadingServer, setLoadingServer] = useState(true);
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());
  const handledOpenRequestTokenRef = useRef<number | null>(null);
  // Counter to force re-render when read state changes in localStorage
  const [readVersion, setReadVersion] = useState(0);

  // Derive read IDs from localStorage on every render (single source of truth)
  const readIds = loadReadIds();

  const isRead = (id: string) => readIds.has(id);

  const persistAndBump = (id: string) => {
    markIdRead(id);
    setReadVersion((v) => v + 1);
  };

  const persistManyAndBump = (ids: string[]) => {
    markIdsRead(ids);
    setReadVersion((v) => v + 1);
  };

  useEffect(() => {
    const req = openServerNotificationRequest;
    if (!req?.id) return;
    if (handledOpenRequestTokenRef.current === req.token) return;

    const serverNotif = serverNotifs.find((notif) => notif.id === req.id);
    if (!serverNotif && loadingServer) return;

    handledOpenRequestTokenRef.current = req.token;
    persistAndBump(`server-${req.id}`);

    let cancelled = false;
    const openLinkedFeed = async () => {
      try {
        let linkedFeedId = serverNotif?.linkedReportId;
        if (!linkedFeedId && !serverNotif) {
          const res = await fetch(`${API_BASE}/push/notification/${req.id}`, {
            headers: apiHeaders,
          });
          if (res.ok) {
            const data = await res.json();
            linkedFeedId = data?.notification?.linkedReportId;
          }
        }

        if (!cancelled && linkedFeedId) {
          onNavigateToFeed(linkedFeedId);
        }
      } finally {
        if (!cancelled) {
          onServerNotificationRequestHandled?.(req.token);
        }
      }
    };

    void openLinkedFeed();
    return () => {
      cancelled = true;
    };
  }, [
    loadingServer,
    onNavigateToFeed,
    onServerNotificationRequestHandled,
    openServerNotificationRequest,
    serverNotifs,
  ]);

  /* Fetch push notifications from server */
  const fetchServerNotifs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/push/notifications`, { headers: apiHeaders });
      if (res.ok) {
        const data = await res.json();
        setServerNotifs(data.notifications || []);
      }
    } catch (err) {
      console.error("[Alertas] Error fetching server notifications:", err);
    } finally {
      setLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    fetchServerNotifs();
    // Poll every 15 seconds
    const poll = setInterval(fetchServerNotifs, 15000);
    return () => clearInterval(poll);
  }, [fetchServerNotifs]);

  /* Load submitted report notifications (from cache, server sync triggers "reports-updated") */
  const loadDynamicNotifs = useCallback(() => {
    const reports = getSubmittedReports();
    const monitoring = getSubmittedMonitorings();
    const notifs = [...buildReportNotifications(reports), ...buildMonitoringNotifications(monitoring)];
    setReportNotifs(notifs);
  }, []);

  useEffect(() => {
    loadDynamicNotifs();
    // Fetch from server on mount
    Promise.all([fetchServerReports(), fetchServerMonitoring()]).then(() => loadDynamicNotifs());
    window.addEventListener("reports-updated", loadDynamicNotifs);
    window.addEventListener("monitoring-updated", loadDynamicNotifs);
    const interval = setInterval(loadDynamicNotifs, 5000);
    return () => {
      window.removeEventListener("reports-updated", loadDynamicNotifs);
      window.removeEventListener("monitoring-updated", loadDynamicNotifs);
      clearInterval(interval);
    };
  }, [loadDynamicNotifs]);

  /* Merge: report notifications first, then mock */
  const allNotifications = [...reportNotifs, ...notifications];

  const markAllRead = () => {
    const allIds = [
      ...allNotifications.map((n) => n.id),
      ...serverNotifs.map((n) => `server-${n.id}`),
    ];
    persistManyAndBump(allIds);
  };

  const handleNotifClick = (n: AppNotification) => {
    // Persist read state (single source of truth: localStorage)
    persistAndBump(n.id);
    // Navigate to feed detail if linked
    if (n.linkedFeedId) {
      onNavigateToFeed(n.linkedFeedId);
    }
  };

  const handleServerNotifClick = (n: ServerNotification) => {
    // Persist read state for server notifications
    persistAndBump(`server-${n.id}`);
    if (n.linkedReportId) {
      onNavigateToFeed(n.linkedReportId);
    }
  };

  const toggleImageExpanded = (id: string) => {
    setExpandedImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* Format server notification time */
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMin < 1) return "Ahora";
      if (diffMin < 60) return `Hace ${diffMin} min`;
      if (diffMin < 1440) return `Hace ${Math.floor(diffMin / 60)} hr`;
      return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    } catch (_e) {
      return iso;
    }
  };

  /* Get tag style for server notifications */
  const getServerTagStyle = (tag?: string) => {
    if (!tag) return { bg: "linear-gradient(135deg, #AB1738, #D4214A)", icon: Bell, label: "Alerta" };
    if (tag === "test-notification") return { bg: "linear-gradient(135deg, #3B82F6, #60A5FA)", icon: Megaphone, label: "Prueba" };
    if (tag === "custom-alert") return { bg: "linear-gradient(135deg, #AB1738, #D4214A)", icon: AlertTriangle, label: "Alerta" };
    if (tag === "report-update" || tag === "incident-update") return { bg: "linear-gradient(135deg, #F59E0B, #D97706)", icon: Info, label: "Actualizacion 911" };
    if (tag === "report-new") return { bg: "linear-gradient(135deg, #DC2626, #EF4444)", icon: AlertTriangle, label: "Nuevo Reporte 911" };
    if (tag === "monitoring-new") return { bg: "linear-gradient(135deg, #AB1738, #D4214A)", icon: BarChart3, label: "Nuevo Monitoreo" };
    if (tag === "monitoring-update") return { bg: "linear-gradient(135deg, #BC955B, #D4AB6E)", icon: Info, label: "Actualizacion Monitoreo" };
    if (tag === "system-notice") return { bg: "linear-gradient(135deg, #6B7280, #4B5563)", icon: Megaphone, label: "Comunicado" };
    if (tag.startsWith("report-")) return { bg: "linear-gradient(135deg, #DC2626, #EF4444)", icon: AlertTriangle, label: "Reporte 911" };
    return { bg: "linear-gradient(135deg, #BC955B, #D4AB6E)", icon: Bell, label: "General" };
  };

  /* ─── Apply notification preference filters ─── */
  const prefs = loadNotifPrefs();

  const filterNotification = (n: AppNotification): boolean => {
    // Category filter
    if (n.category === "reportes911" && !prefs.reportes911) return false;
    if (n.category === "monitoreo" && !prefs.monitoreo) return false;
    // "sistema" category always passes category filter
    // Priority filter — per-category
    if (n.category === "reportes911") {
      if (n.priority === "alta" && !prefs.r911Alta) return false;
      if (n.priority === "media" && !prefs.r911Media) return false;
      if (n.priority === "baja" && !prefs.r911Baja) return false;
    } else if (n.category === "monitoreo") {
      if (n.priority === "alta" && !prefs.monAlta) return false;
      if (n.priority === "media" && !prefs.monMedia) return false;
      if (n.priority === "baja" && !prefs.monBaja) return false;
    }
    return true;
  };

  const filteredNotifs = allNotifications.filter(filterNotification);
  const filteredUnreadCount = filteredNotifs.filter((n) => !isRead(n.id)).length;

  /* Filter server notifs by category preference */
  const filterServerNotif = (n: ServerNotification): boolean => {
    const isReport =
      n.tag?.startsWith("report-") ||
      n.tag === "report-new" ||
      n.tag === "report-update" ||
      n.tag === "incident-update" ||
      !!n.linkedReportId;
    const isMonitoring =
      n.tag === "monitoring-new" ||
      n.tag === "monitoring-update";
    if (isReport && !prefs.reportes911) return false;
    if (isMonitoring && !prefs.monitoreo) return false;
    // Server notifs don't have explicit priority, show them unless category is off
    return true;
  };
  const filteredServerNotifs = serverNotifs.filter(filterServerNotif);
  const unreadServerCount = filteredServerNotifs.filter((n) => !isRead(`server-${n.id}`)).length;
  const totalUnread = filteredUnreadCount + unreadServerCount;

  const allPrioritiesOn = prefs.r911Alta && prefs.r911Media && prefs.r911Baja && prefs.monAlta && prefs.monMedia && prefs.monBaja;
  const isFiltered = !allPrioritiesOn || !prefs.reportes911 || !prefs.monitoreo;

  const handleRefreshNotifs = useCallback(async () => {
    await Promise.all([
      fetchServerNotifs(),
      Promise.all([fetchServerReports(), fetchServerMonitoring()]).then(() => loadDynamicNotifs()),
    ]);
  }, [fetchServerNotifs, loadDynamicNotifs]);

  const totalItems = filteredNotifs.length + filteredServerNotifs.length;

  return (
    <PullToRefresh onRefresh={handleRefreshNotifs} className="flex-1 min-h-0" containerRef={containerRef}>
      {/* Unread badge + Mark all */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[15px] text-[#636366]">
            {totalUnread > 0 ? `${totalUnread} sin leer` : "Todo al día"}
          </span>
          {totalUnread > 0 && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#EF4444" }}
            />
          )}
        </div>
        {totalUnread > 0 && (
          <button
            onClick={markAllRead}
            className="text-[14px] active:opacity-60 transition-opacity"
            style={{ color: "#AB1738", fontWeight: 600 }}
          >
            Marcar todo leído
          </button>
        )}
      </div>

      {/* ─── Active filter indicator ─── */}
      {isFiltered && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(188,149,91,0.08)", border: "1px solid rgba(188,149,91,0.15)" }}>
          <Bell size={14} style={{ color: "#BC955B" }} strokeWidth={2} />
          <span className="text-[13px] text-[#8E8E93] flex-1">
            Filtro activo:{" "}
            {!allPrioritiesOn
              ? "Filtro de prioridad activo"
              : ""}
            {!allPrioritiesOn && (!prefs.reportes911 || !prefs.monitoreo) ? " · " : ""}
            {!prefs.reportes911 ? "Sin 911" : ""}{!prefs.reportes911 && !prefs.monitoreo ? " · " : ""}
            {!prefs.monitoreo ? "Sin monitoreo" : ""}
          </span>
          <span className="text-[12px] text-[#BC955B]" style={{ fontWeight: 600 }}>
            {filteredNotifs.length + filteredServerNotifs.length} de {allNotifications.length + serverNotifs.length}
          </span>
        </div>
      )}

      {/* ═══ Server Push Notifications (real alerts from push system) ═══ */}
      {loadingServer && (
        <div className="flex items-center justify-center py-4 gap-2">
          <Loader2 size={16} className="animate-spin" style={{ color: "#AB1738" }} />
          <span className="text-[13px] text-[#8E8E93]">Cargando alertas del servidor...</span>
        </div>
      )}

      {filteredServerNotifs.length > 0 && (
        <>
          <div className="px-4 pt-1 pb-2">
            <div className="flex items-center gap-2">
              <Bell size={14} style={{ color: "#AB1738" }} strokeWidth={2.5} />
              <span className="text-[12px] text-[#AB1738]" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Alertas Push ({filteredServerNotifs.length})
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            {filteredServerNotifs.map((n, i) => {
              const tagStyle = getServerTagStyle(n.tag);
              const TagIcon = tagStyle.icon;
              const hasImage = n.attachmentType?.startsWith("image/") && n.attachmentUrl;
              const hasFile = n.attachmentUrl && !n.attachmentType?.startsWith("image/");
              const isImageExpanded = expandedImages.has(n.id);
              const isServerRead = isRead(`server-${n.id}`);

              return (
                <div key={n.id}>
                  <button
                    className="w-full text-left px-4 py-3.5 flex items-start gap-3 active:bg-[#F2F2F7] transition-colors"
                    style={{ background: isServerRead ? "#FFFFFF" : "rgba(171,23,56,0.03)" }}
                    onClick={() => handleServerNotifClick(n)}
                  >
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: tagStyle.bg,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                      }}
                    >
                      <TagIcon className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p
                          className="flex-1 text-[15px] text-[#1C1C1E]"
                          style={{ fontWeight: isServerRead ? 500 : 600, lineHeight: 1.3 }}
                        >
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          {n.linkedReportId && (
                            <ChevronRight className="w-4 h-4 text-[#C7C7CC]" strokeWidth={2} />
                          )}
                          {!isServerRead && (
                            <span
                              className="w-[8px] h-[8px] rounded-full"
                              style={{ background: "#AB1738" }}
                            />
                          )}
                        </div>
                      </div>
                      <p
                        className="text-[14px] text-[#636366] mt-0.5"
                        style={{ lineHeight: 1.4 }}
                      >
                        {n.body}
                      </p>

                      {/* ═══ Attachment preview ═══ */}
                      {hasImage && (
                        <div
                          className="mt-2 rounded-xl overflow-hidden"
                          style={{ border: "1px solid #E5E5EA" }}
                          onClick={(e) => { e.stopPropagation(); toggleImageExpanded(n.id); }}
                        >
                          <img
                            src={n.attachmentUrl}
                            alt={n.attachmentName || "Adjunto"}
                            className="w-full object-cover"
                            style={{ maxHeight: isImageExpanded ? "none" : "160px" }}
                          />
                          <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#F9F9FB" }}>
                            <ImageIcon size={14} style={{ color: "#3B82F6" }} />
                            <span className="flex-1 text-[12px] text-[#636366] truncate">{n.attachmentName}</span>
                            <a
                              href={n.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={n.attachmentName}
                              className="p-1.5 rounded-lg active:opacity-60 transition-opacity"
                              style={{ background: "rgba(59,130,246,0.1)" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download size={14} style={{ color: "#3B82F6" }} />
                            </a>
                          </div>
                        </div>
                      )}

                      {hasFile && (
                        <div
                          className="mt-2 rounded-xl overflow-hidden flex items-center gap-2.5 px-3 py-2.5"
                          style={{ border: "1px solid #E5E5EA", background: "#F9F9FB" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: "rgba(188,149,91,0.1)" }}
                          >
                            <FileText size={16} style={{ color: "#BC955B" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-[#1C1C1E] truncate" style={{ fontWeight: 500 }}>
                              {n.attachmentName || "Archivo adjunto"}
                            </p>
                          </div>
                          <a
                            href={n.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={n.attachmentName}
                            className="p-1.5 rounded-lg active:opacity-60 transition-opacity"
                            style={{ background: "rgba(59,130,246,0.1)" }}
                          >
                            <Download size={14} style={{ color: "#3B82F6" }} />
                          </a>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[12px] text-[#8E8E93]">{formatTime(n.createdAt)}</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(171,23,56,0.06)", color: "#AB1738", fontWeight: 600 }}>
                          {tagStyle.label}
                        </span>
                        {n.attachmentUrl && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: "rgba(59,130,246,0.06)", color: "#3B82F6", fontWeight: 600 }}>
                            <Paperclip size={10} />
                            Adjunto
                          </span>
                        )}
                        {n.linkedReportId && (
                          <span className="text-[11px] text-[#AB1738] bg-[#AB1738]/6 px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>
                            Ver detalle
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  {i < filteredServerNotifs.length - 1 && (
                    <div className="h-px bg-[#E5E5EA] ml-[68px] mr-4" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Separator between server and local notifications */}
          <div className="flex items-center gap-3 px-4 my-3">
            <div className="flex-1 h-px bg-[#D1D1D6]" />
            <span className="text-[12px] text-[#8E8E93]">Alertas del sistema</span>
            <div className="flex-1 h-px bg-[#D1D1D6]" />
          </div>
        </>
      )}

      {/* ═══ Local/mock notification items ═══ */}
      <div className="flex flex-col">
        {filteredNotifs.map((n, i) => (
          <div key={n.id}>
            <button
              className="w-full text-left px-4 py-3.5 flex items-start gap-3 active:bg-[#F2F2F7] transition-colors"
              style={{
                background: isRead(n.id) ? "#FFFFFF" : "rgba(171,23,56,0.03)",
              }}
              onClick={() => handleNotifClick(n)}
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: n.iconBg,
                  boxShadow: `0 2px 8px ${n.iconColor === "#FFFFFF" ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.08)"}`,
                }}
              >
                <n.icon className="w-5 h-5" style={{ color: n.iconColor }} strokeWidth={2} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <p
                    className="flex-1 text-[15px] text-[#1C1C1E]"
                    style={{ fontWeight: isRead(n.id) ? 500 : 600, lineHeight: 1.3 }}
                  >
                    {n.title}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    {n.linkedFeedId && (
                      <ChevronRight className="w-4 h-4 text-[#C7C7CC]" strokeWidth={2} />
                    )}
                    {!isRead(n.id) && (
                      <span
                        className="w-[8px] h-[8px] rounded-full"
                        style={{ background: "#AB1738" }}
                      />
                    )}
                  </div>
                </div>
                <p
                  className="text-[14px] text-[#636366] mt-0.5"
                  style={{ lineHeight: 1.4 }}
                >
                  {n.body}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[12px] text-[#8E8E93]">{n.time}</span>
                  {n.linkedFeedId && (
                    <span className="text-[11px] text-[#AB1738] bg-[#AB1738]/6 px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>
                      Ver detalle
                    </span>
                  )}
                </div>
              </div>
            </button>
            {/* Separator */}
            {i < filteredNotifs.length - 1 && (
              <div className="h-px bg-[#E5E5EA] ml-[68px] mr-4" />
            )}
          </div>
        ))}
      </div>

      {/* ─── Empty state when all filtered out ─── */}
      {filteredNotifs.length === 0 && filteredServerNotifs.length === 0 && !loadingServer && (
        <div className="text-center py-16 px-6">
          <Bell className="w-10 h-10 text-[#C7C7CC] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-[16px] text-[#48484A] mb-1" style={{ fontWeight: 600 }}>Sin notificaciones</p>
          <p className="text-[14px] text-[#8E8E93]">
            {isFiltered
              ? "No hay alertas que coincidan con tus filtros. Ajusta tus preferencias en Configuración."
              : "No hay alertas pendientes por el momento."}
          </p>
        </div>
      )}

      {/* ─── End of list indicator ─── */}
      {totalItems > 0 && !loadingServer && (
        <div className="flex items-center justify-center py-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-px bg-[#D1D1D6]" />
            <span className="text-[12px] text-[#C7C7CC]" style={{ fontWeight: 400 }}>
              No hay más alertas
            </span>
            <div className="w-6 h-px bg-[#D1D1D6]" />
          </div>
        </div>
      )}
    </PullToRefresh>
  );
}

/* ─── Main ─── */
export function SupervisorNotifications() {
  const navigate = useNavigate();
  const [lightboxData, setLightboxData] = useState<LightboxData | null>(null);
  const [navView, setNavViewRaw] = useState<NavView>(_savedNavView);
  const [openServerNotificationRequest, setOpenServerNotificationRequest] =
    useState<ServerNotificationOpenRequest | null>(null);
  const openRequestTokenRef = useRef(0);
  const homeScrollRef = useRef<HTMLDivElement | null>(null);
  const reportesScrollRef = useRef<HTMLDivElement | null>(null);
  const monitoreoScrollRef = useRef<HTMLDivElement | null>(null);
  const notificationsScrollRef = useRef<HTMLDivElement | null>(null);

  const getScrollContainer = useCallback((view: NavView) => {
    if (view === "home") return homeScrollRef.current;
    if (view === "reportes") return reportesScrollRef.current;
    if (view === "monitoreo") return monitoreoScrollRef.current;
    if (view === "notificaciones") return notificationsScrollRef.current;
    return null;
  }, []);

  const restoreScrollForView = useCallback((view: NavView) => {
    const applyScroll = () => {
      const target = getScrollContainer(view);
      if (!target) return;
      target.scrollTop = _tabScrollPositions[view] || 0;
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(applyScroll);
    });
  }, [getScrollContainer]);

  /* Persist tab changes to module-level variable */
  const setNavView = (v: NavView) => {
    const currentScrollContainer = getScrollContainer(navView);
    _tabScrollPositions[navView] = currentScrollContainer ? currentScrollContainer.scrollTop : 0;
    _savedNavView = navView;
    persistSupervisorNavState();

    // If user taps "menu" (Settings icon), navigate to /settings instead
    if (v === "menu") {
      navigate("/settings");
      return;
    }

    _savedNavView = v;
    persistSupervisorNavState();
    setNavViewRaw(v);
    // Restore target tab's scroll (or top if first visit)
    restoreScrollForView(v);
  };

  const queueServerNotificationOpen = useCallback((notificationId: string) => {
    openRequestTokenRef.current += 1;
    setOpenServerNotificationRequest({
      id: notificationId,
      token: openRequestTokenRef.current,
    });
  }, []);

  const handleServerNotificationRequestHandled = useCallback((token: number) => {
    setOpenServerNotificationRequest((current) =>
      current?.token === token ? null : current,
    );
  }, []);

  /* ─── Deep link: check for pending notification on mount ─── */
  useEffect(() => {
    const pendingId = consumePendingNotificationId();
    if (pendingId) {
      console.log("[Supervisor] Deep link notification:", pendingId);
      _savedNavView = "notificaciones";
      setNavViewRaw("notificaciones");
      _tabScrollPositions.notificaciones = 0;
      persistSupervisorNavState();
      restoreScrollForView("notificaciones");
      queueServerNotificationOpen(pendingId);
    }
  }, [queueServerNotificationOpen, restoreScrollForView]);

  /* ─── Deep link: listen for SW postMessage (app already open) ─── */
  useEffect(() => {
    const unsubscribe = onNotificationClick((notificationId) => {
      console.log("[Supervisor] SW message — switching to Alertas:", notificationId);
      _savedNavView = "notificaciones";
      setNavViewRaw("notificaciones");
      _tabScrollPositions.notificaciones = 0;
      persistSupervisorNavState();
      restoreScrollForView("notificaciones");
      queueServerNotificationOpen(notificationId);
    });
    return unsubscribe;
  }, [queueServerNotificationOpen, restoreScrollForView]);

  useEffect(() => {
    restoreScrollForView(navView);
  }, [navView, restoreScrollForView]);

  useEffect(() => {
    const target = getScrollContainer(navView);
    if (!target) return;

    const onScroll = () => {
      _tabScrollPositions[navView] = target.scrollTop;
      _savedNavView = navView;
      persistSupervisorNavState();
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [navView, getScrollContainer]);

  useEffect(() => {
    _savedNavView = navView;
    persistSupervisorNavState();
  }, [navView]);

  const openLightbox = (item: FeedItem) => {
    const visualMedia = getOrderedVisualMedia(item);
    if (visualMedia.length > 0) {
      setLightboxData({
        images: visualMedia
          .filter((media) => media.kind === "image")
          .map((media) => media.src),
        media: visualMedia.map((media) => ({
          kind: media.kind,
          src: media.src,
          nombre: media.nombre,
          posterSrc: media.posterSrc,
        })),
        title: item.titulo,
        timestamp: `${item.relativeTime} · ${item.timestamp}`,
        description: item.descripcion,
        startIndex: 0,
      });
    }
  };

  /* ─── Submitted reports from Personal de Campo ─── */
  const [submittedFeedItems, setSubmittedFeedItems] = useState<FeedItem[]>([]);

  const loadFromCache = useCallback(() => {
    const reports = getSubmittedReports();
    const monitorings = getSubmittedMonitorings();
    setSubmittedFeedItems([
      ...reports.map(toFeedItem),
      ...monitorings.map(toMonitoringFeedItem),
    ]);
  }, []);

  useEffect(() => {
    // Load from local cache immediately
    loadFromCache();

    // Fetch from server (merges into local cache and triggers "reports-updated")
    fetchServerReports().then(() => loadFromCache());
    fetchServerMonitoring().then(() => loadFromCache());

    // Listen for local updates (from new report submissions or server sync)
    window.addEventListener("reports-updated", loadFromCache);
    window.addEventListener("monitoring-updated", loadFromCache);

    // Poll server every 15 seconds for cross-device updates
    const serverPoll = setInterval(() => {
      Promise.all([fetchServerReports(), fetchServerMonitoring()]).then(() => loadFromCache());
    }, 15000);

    // Also poll local cache every 3 seconds for cross-tab updates
    const localPoll = setInterval(loadFromCache, 3000);

    return () => {
      window.removeEventListener("reports-updated", loadFromCache);
      window.removeEventListener("monitoring-updated", loadFromCache);
      clearInterval(serverPoll);
      clearInterval(localPoll);
    };
  }, [loadFromCache]);

  /* Merge submitted + mock feed items, submitted first (newest) */
  const allFeedItems = [...submittedFeedItems, ...feedItems];

  /* Filter feed based on nav view */
  const filtered = allFeedItems.filter((p) => {
    if (navView === "home") return true;
    if (navView === "reportes") return p.type === "reporte911";
    if (navView === "monitoreo") return p.type === "monitoreo";
    return true;
  });

  const newCount = allFeedItems.filter((p) => p.isNew).length;

  /* Stats computed from data */
  const activeCount = allFeedItems.filter((p) => !CLOSED_STATUSES.includes(p.estatus)).length;
  const closedToday = allFeedItems.filter((p) => CLOSED_STATUSES.includes(p.estatus)).length;
  const monitorCount = allFeedItems.filter((p) => p.type === "monitoreo").length;

  /* Unread notifications count for badge — uses persisted read state */
  const persistedReadIds = loadReadIds();
  const mockUnreadCount = mockNotifications.filter((n) => !n.read && !persistedReadIds.has(n.id)).length;
  const reportNotifIds = getSubmittedReports().map((r) => `report-notif-${r.id}`);
  const monitoringNotifIds = getSubmittedMonitorings().map((m) => `monitoring-notif-${m.id}`);
  const dynamicNotifUnread = [...reportNotifIds, ...monitoringNotifIds].filter((id) => !persistedReadIds.has(id)).length;
  const unreadNotifCount = mockUnreadCount + dynamicNotifUnread;

  /* Section title based on active nav */
  const sectionTitle = navView === "home"
    ? "Centro de Mando Regional"
    : navView === "reportes"
    ? "Reportes 911"
    : navView === "monitoreo"
    ? "Monitoreo"
    : navView === "notificaciones"
    ? "Notificaciones"
    : "Configuración";

  const feedTabs: NavView[] = ["home", "reportes", "monitoreo"];
  const isFeedView = navView === "home" || navView === "reportes" || navView === "monitoreo";

  const getFeedForView = useCallback((view: NavView) => {
    if (view === "home") return allFeedItems;
    if (view === "reportes") return allFeedItems.filter((p) => p.type === "reporte911");
    if (view === "monitoreo") return allFeedItems.filter((p) => p.type === "monitoreo");
    return allFeedItems;
  }, [allFeedItems]);

  const getFeedContainerRef = (view: NavView) => {
    if (view === "home") return homeScrollRef;
    if (view === "reportes") return reportesScrollRef;
    if (view === "monitoreo") return monitoreoScrollRef;
    return homeScrollRef;
  };

  return (
    <div className="h-[100dvh] bg-[#F2F2F7] flex flex-col overflow-hidden">
      <AppHeader title={sectionTitle} showBack={false} />

      {/* ═══ Notifications View ═══ */}
      {navView === "notificaciones" && (
        <NotificationsView
          onNavigateToFeed={(feedId) => navigate(`/supervisor/${feedId}`)}
          containerRef={notificationsScrollRef}
          openServerNotificationRequest={openServerNotificationRequest}
          onServerNotificationRequestHandled={handleServerNotificationRequestHandled}
        />
      )}

      {/* Feed Views (home / reportes / monitoreo) */}
      <div className={isFeedView ? "flex-1 min-h-0" : "hidden"}>
        {feedTabs.map((view) => {
          const filtered = getFeedForView(view);
          const isActiveFeedTab = navView === view;

          return (
            <PullToRefresh
              key={view}
              onRefresh={async () => {
                await fetchServerReports();
                loadFromCache();
              }}
              className={isActiveFeedTab ? "h-full min-h-0" : "hidden h-full min-h-0"}
              containerRef={getFeedContainerRef(view)}
            >
              {/* 1. Banner */}
              <div className="mx-4 mt-3 mb-3 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#FFF1F3] border border-[#FECDD3]">
                <Eye className="w-5 h-5 text-[#AB1738] shrink-0" strokeWidth={2} />
                <span className="text-[15px] text-[#AB1738]">Modo Supervisor — Solo Lectura</span>
                {unreadNotifCount > 0 && (
                  <span className="ml-auto text-[13px] bg-red-500 text-white px-2.5 py-1 rounded-full tabular-nums">
                    {unreadNotifCount} nuevas
                  </span>
                )}
              </div>

              {/* 2. Stats */}
              <div className="px-4 mb-3">
                <div className="flex gap-2">
                  <div
                    className="flex-1 rounded-xl px-3 py-3 bg-white border border-[#D1D1D6]"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-[13px] text-[#636366]">Activos</span>
                    </div>
                    <span className="text-[22px] text-[#1C1C1E] tabular-nums">{activeCount}</span>
                  </div>
                  <div
                    className="flex-1 rounded-xl px-3 py-3 bg-white border border-[#D1D1D6]"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
                      <span className="text-[13px] text-[#636366]">Cerrados</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[22px] text-[#1C1C1E] tabular-nums">{closedToday}</span>
                      <span className="text-[13px] text-[#8E8E93]">hoy</span>
                    </div>
                  </div>
                  <div
                    className="flex-1 rounded-xl px-3 py-3 bg-white border border-[#D1D1D6]"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-500" strokeWidth={2} />
                      <span className="text-[13px] text-[#636366]">Monitoreos</span>
                    </div>
                    <span className="text-[22px] text-[#1C1C1E] tabular-nums">{monitorCount}</span>
                  </div>
                </div>
              </div>

              {/* Feed */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-3 px-4 mb-0 mt-1">
                  <div className="flex-1 h-px bg-[#D1D1D6]" />
                  <span className="text-[13px] text-[#8E8E93]">Hoy, 5 de marzo 2026</span>
                  <div className="flex-1 h-px bg-[#D1D1D6]" />
                </div>

                {filtered.map((item) => (
                  <FeedCard key={item.id} item={item} onOpen={() => navigate(`/supervisor/${item.id}`)} onImageClick={() => openLightbox(item)} />
                ))}

                {filtered.length === 0 && (
                  <div className="text-center py-16 px-4">
                    <Activity className="w-10 h-10 text-[#8E8E93] mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-[16px] text-[#48484A] mb-1">No hay actividad en esta categoría</p>
                    <p className="text-[14px] text-[#8E8E93]">Selecciona otra sección en el menú</p>
                  </div>
                )}

                {filtered.length > 0 && (
                  <div className="flex items-center justify-center py-6">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-px bg-[#D1D1D6]" />
                      <span className="text-[12px] text-[#C7C7CC]" style={{ fontWeight: 400 }}>
                        No hay más publicaciones
                      </span>
                      <div className="w-6 h-px bg-[#D1D1D6]" />
                    </div>
                  </div>
                )}
              </div>
            </PullToRefresh>
          );
        })}
      </div>
      {/* ═══ Image Lightbox ═══ */}
      {lightboxData && (
        <ImageLightbox data={lightboxData} onClose={() => setLightboxData(null)} />
      )}

      {/* ═══ Liquid Glass Navigation — hidden while image lightbox is open ═══ */}
      {!lightboxData && (
        <LiquidGlassNav
          currentView={navView}
          onChangeView={setNavView}
          notificationCount={navView === "notificaciones" ? 0 : unreadNotifCount}
        />
      )}
    </div>
  );
}
