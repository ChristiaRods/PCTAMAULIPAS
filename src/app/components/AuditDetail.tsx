import { AppHeader } from "./AppHeader";
import {
  MapPin, Clock, AlertTriangle, Users, Truck, Heart, MessageSquare,
  Image as ImageIcon, Activity, ChevronDown, ChevronUp, Eye, Navigation,
  CheckCircle2, FileText, BarChart3, Droplets, Mic, Video, File,
  ChevronRight,
} from "lucide-react";
import { useParams, useScrollContainer } from "./RouterContext";
import { useState, useEffect, useRef } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { ImageLightbox, type LightboxData } from "./ImageLightbox";
import { getFeedItemById, type FeedItem, type Reporte911, type Monitoreo, type TrazabilidadItem } from "./feedData";
import { MapModal } from "./MapModal";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ─── Inline Leaflet mini-map (no controls) ─── */
function InlineMap({ coords, height = 160 }: { coords: { lat: number; lng: number }; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const map = L.map(containerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    mapInstanceRef.current = map;
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [coords.lat, coords.lng]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        filter: "saturate(0.12) brightness(1.06) contrast(0.95)",
      }}
    />
  );
}

/* ─── Coords lookup by municipio ─── */
const MUNICIPIO_COORDS: Record<string, { lat: number; lng: number }> = {
  "Ciudad Victoria": { lat: 23.7369, lng: -99.1411 },
  "Tampico": { lat: 22.2331, lng: -97.8611 },
  "Reynosa": { lat: 26.0923, lng: -98.2775 },
  "Nuevo Laredo": { lat: 27.4761, lng: -99.5067 },
  "Matamoros": { lat: 25.8697, lng: -97.5028 },
  "Ciudad Madero": { lat: 22.2756, lng: -97.8322 },
  "Altamira": { lat: 22.3933, lng: -97.9431 },
  "Jaumave": { lat: 23.4117, lng: -99.3739 },
  "San Fernando": { lat: 24.8478, lng: -98.1567 },
};

function getCoordsForItem(municipio: string, itemCoords?: { lat: number; lng: number }): { lat: number; lng: number } {
  // Prefer exact coords from GPS if available
  if (itemCoords) return itemCoords;
  return MUNICIPIO_COORDS[municipio] || { lat: 23.7369, lng: -99.1411 };
}

/* ─── MD3 Solid Style ─── */
const solidCard = {
  background: "#FFFFFF",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.10)",
  border: "1px solid #D1D1D6",
} as const;

/* ─── Status pill ─── */
function getStatusPill(label: string) {
  switch (label) {
    case "En Atención": case "En Proceso": return { bg: "bg-amber-500", text: "text-white" };
    case "Activo": return { bg: "bg-blue-500", text: "text-white" };
    case "En seguimiento": return { bg: "bg-sky-500", text: "text-white" };
    case "En validación": return { bg: "bg-violet-500", text: "text-white" };
    case "Atendido": return { bg: "bg-emerald-600", text: "text-white" };
    case "Cerrado": return { bg: "bg-gray-500", text: "text-white" };
    case "Archivado": return { bg: "bg-gray-400", text: "text-white" };
    case "Falso reporte": return { bg: "bg-rose-400", text: "text-white" };
    case "Registrado": return { bg: "bg-blue-500", text: "text-white" };
    default: return { bg: "bg-gray-400", text: "text-white" };
  }
}

/* ─── Trazabilidad type config ─── */
function getTrazaConfig(tipo: TrazabilidadItem["tipo"]) {
  switch (tipo) {
    case "Sistema": return { icon: CheckCircle2, label: "Sistema", iconBg: "bg-gray-100 text-gray-500" };
    case "Estatus": return { icon: Activity, label: "Estatus", iconBg: "bg-blue-50 text-blue-600" };
    case "Actividad": return { icon: CheckCircle2, label: "Actividad", iconBg: "bg-emerald-50 text-emerald-600" };
    case "Evidencia": return { icon: ImageIcon, label: "Evidencia", iconBg: "bg-purple-50 text-purple-600" };
    case "Ubicacion": return { icon: Navigation, label: "Ubicación", iconBg: "bg-green-50 text-green-600" };
    default: return { icon: Activity, label: tipo, iconBg: "bg-gray-100 text-gray-500" };
  }
}

/* ─── Thread Reply (MD3) ─── */
function ThreadReply({ entry, isLast }: { entry: TrazabilidadItem; isLast: boolean }) {
  const config = getTrazaConfig(entry.tipo);
  const initials = entry.actor.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const isSystem = entry.tipo === "Sistema" || entry.actor === "GPS Automático";

  return (
    <div className="flex gap-3 relative">
      {!isLast && <div className="absolute left-[19px] top-[40px] bottom-0 w-[1.5px] bg-[#E5E5EA]" />}
      <div className="shrink-0 z-10">
        <div className={`w-[38px] h-[38px] rounded-full ${isSystem ? "bg-gray-400" : "bg-[#AB1738]"} flex items-center justify-center ring-2 ring-white`}
          style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
          <span className="text-white text-[12px]">{entry.actor === "GPS Automático" ? "📍" : initials}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-center flex-wrap gap-x-2 mb-1">
          <span className="text-[14px] text-[#1C1C1E] tracking-tight">{entry.actor}</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1 text-[13px] px-2 py-0.5 rounded-md ${config.iconBg}`}>
            <config.icon className="w-3 h-3" strokeWidth={2} />
            {config.label}
          </span>
          <span className="text-[13px] text-[#8E8E93] flex items-center gap-1">
            <Clock className="w-3 h-3" strokeWidth={1.8} />{entry.hora} hrs
          </span>
        </div>
        <div className="rounded-xl rounded-tl-[4px] p-3 bg-[#F2F2F7] border border-[#E5E5EA]">
          <p className="text-[14px] text-[#3A3A3C] leading-relaxed">{entry.mensaje}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Evidence file icon ─── */
function EvidenceIcon({ kind }: { kind: string }) {
  switch (kind) {
    case "pdf": return <FileText className="w-5 h-5 text-red-500" strokeWidth={1.8} />;
    case "audio": return <Mic className="w-5 h-5 text-blue-500" strokeWidth={1.8} />;
    case "video": return <Video className="w-5 h-5 text-purple-500" strokeWidth={1.8} />;
    default: return <File className="w-5 h-5 text-gray-500" strokeWidth={1.8} />;
  }
}

/* ─── Duration formatter ─── */
function formatDuration(min: number): string {
  if (min === 0) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ─── Human-readable date formatter ─── */
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function formatHumanDate(ts: string): string {
  // ts = "05/03/2026, 14:22"
  const [datePart, timePart] = ts.split(", ");
  if (!datePart || !timePart) return ts;
  const [dd, mm, yyyy] = datePart.split("/");
  const day = parseInt(dd, 10);
  const month = MESES[parseInt(mm, 10) - 1] || mm;
  const [hh, mi] = timePart.split(":");
  let hour = parseInt(hh, 10);
  const suffix = hour >= 12 ? "pm" : "am";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${day} de ${month} de ${yyyy} ${hour}:${mi}${suffix}`;
}

/* ─── 911 Detail Section ─── */
function Reporte911Detail({ item, onImageClick }: { item: Reporte911; onImageClick: (idx: number) => void }) {
  const coords = getCoordsForItem(item.municipio, item.coords);
  const isExactGPS = !!item.coords;
  const [showMapModal, setShowMapModal] = useState(false);
  return (
    <>
      {/* Photo */}
      {item.images.length > 0 && (
        <div className="px-4 pb-3">
          <div className="relative rounded-xl overflow-hidden border border-[#E5E5EA] cursor-pointer" onClick={() => onImageClick(0)}>
            <ImageWithFallback src={item.images[0]} alt={item.titulo} className="w-full h-48 object-cover" />
            {item.images.length > 1 && (
              <div className="absolute bottom-2.5 right-2.5 text-white text-[13px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 bg-[#1C1C1E] border border-[#3A3A3C]">
                <ImageIcon className="w-4 h-4" strokeWidth={2} />
                +{item.images.length - 1} más
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="px-4 pb-3">
        <div className="flex gap-2">
          {[
            { icon: Users, value: String(item.kpis.personal), label: "Personal" },
            { icon: Truck, value: String(item.kpis.unidades), label: "Unidades" },
            { icon: Heart, value: String(item.kpis.atencionesPrehosp), label: "At. Prehosp." },
            { icon: Clock, value: formatDuration(item.kpis.duracionMin), label: "Duración" },
          ].map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center py-2 rounded-lg bg-[#F2F2F7] border border-[#E5E5EA]">
              <m.icon className="w-3.5 h-3.5 text-[#636366] mb-0.5" strokeWidth={1.8} />
              <span className="text-[14px] text-[#1C1C1E] tabular-nums">{m.value}</span>
              <span className="text-[12px] text-[#636366]">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="px-4 pb-3">
        <div
          className="rounded-xl overflow-hidden border border-[#E5E5EA] cursor-pointer active:opacity-80 transition-opacity"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
          onClick={() => setShowMapModal(true)}
        >
          <div className="relative" style={{ height: 160 }}>
            <InlineMap coords={coords} height={160} />
            {/* WhatsApp-style pin */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full" style={{ pointerEvents: "none" }}>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-[#E53935] border-[2.5px] border-white flex items-center justify-center" style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div className="w-[2px] h-2 bg-[#8E8E93] -mt-[1px] rounded-b-full" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F9F9FB] border-t border-[#E5E5EA]">
            <MapPin className="w-4 h-4 shrink-0 text-[#AB1738]" strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] text-[#1C1C1E] truncate">{item.ubicacion} — {item.municipio}</p>
                {isExactGPS && (
                  <span className="shrink-0 text-[10px] text-[#059669] bg-[#059669]/10 px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>GPS</span>
                )}
              </div>
              <p className="text-[12px] text-[#8E8E93] tabular-nums">{coords.lat.toFixed(4)}° N, {Math.abs(coords.lng).toFixed(4)}° W</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC] shrink-0" strokeWidth={2} />
          </div>
        </div>
      </div>

      <MapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        coords={coords}
        address={item.ubicacion}
        municipio={item.municipio}
      />
    </>
  );
}

/* ─── Monitoreo Detail Section ─── */
function MonitoreoDetail({ item, onImageClick }: { item: Monitoreo; onImageClick: (idx: number) => void }) {
  const dg = item.datosGenerales;
  const cp = item.detalles.conteoPersonas;
  const coords = getCoordsForItem(item.municipio);
  const [showMapModal, setShowMapModal] = useState(false);

  return (
    <>
      {/* Photo */}
      {item.images.length > 0 && (
        <div className="px-4 pb-3">
          <div className="relative rounded-xl overflow-hidden border border-[#E5E5EA] cursor-pointer" onClick={() => onImageClick(0)}>
            <ImageWithFallback src={item.images[0]} alt={item.titulo} className="w-full h-48 object-cover" />
            {item.images.length > 1 && (
              <div className="absolute bottom-2.5 right-2.5 text-white text-[13px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 bg-[#1C1C1E] border border-[#3A3A3C]">
                <ImageIcon className="w-4 h-4" strokeWidth={2} />
                +{item.images.length - 1} más
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECCIÓN: Datos Generales ── */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-[15px] text-[#1C1C1E]">Datos Generales</h4>
          <div className="flex-1 h-px bg-[#E5E5EA]" />
        </div>
        <div className="space-y-2">
          <DetailRow label="Tipo de Monitoreo" value={dg.tipoMonitoreo} />
          <DetailRow label="Subtipo" value={dg.subtipoMonitoreo} />
          <DetailRow label="Municipio" value={dg.municipio} />
          <DetailRow label="Localidad" value={dg.localidad} />
          <DetailRow label="Afectaciones" value={dg.tipoAfectaciones} />
          <DetailRow label="Registro" value={dg.fechaHoraRegistro} />
          {dg.datosMonitoreo && (
            <div className="pt-1">
              <p className="text-[13px] text-[#636366] mb-0.5">Datos del Monitoreo</p>
              <p className="text-[14px] text-[#3A3A3C] leading-relaxed bg-[#F2F2F7] border border-[#E5E5EA] rounded-lg px-3 py-2">{dg.datosMonitoreo}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── SECCIÓN: Detalles — Conteo de Personas ── */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-[15px] text-[#1C1C1E]">Detalles — Conteo de Personas</h4>
          <div className="flex-1 h-px bg-[#E5E5EA]" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <PersonChip label="Hombres" value={cp.hombres} />
          <PersonChip label="Mujeres" value={cp.mujeres} />
          <PersonChip label="Niños" value={cp.ninos} />
          <PersonChip label="Niñas" value={cp.ninas} />
          {cp.noIdentificados > 0 && <PersonChip label="No Ident." value={cp.noIdentificados} />}
        </div>
        <div className="mt-2 flex items-center gap-2 bg-[#AB1738]/5 border border-[#AB1738]/15 rounded-lg px-3 py-2">
          <Users className="w-4 h-4 text-[#AB1738]" strokeWidth={2} />
          <span className="text-[15px] text-[#AB1738] tabular-nums">{item.detalles.totalPersonas}</span>
          <span className="text-[14px] text-[#AB1738]">Total Personas</span>
        </div>
      </div>

      {/* ── SECCIÓN: Actividades ── */}
      {item.actividades.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-[15px] text-[#1C1C1E]">Actividades</h4>
            <div className="flex-1 h-px bg-[#E5E5EA]" />
            <span className="text-[13px] text-[#8E8E93] tabular-nums">{item.actividades.length}</span>
          </div>
          <div className="space-y-2">
            {item.actividades.map((act, i) => (
              <div key={i} className="bg-[#F2F2F7] border border-[#E5E5EA] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] text-[#AB1738] bg-[#AB1738]/8 px-2 py-0.5 rounded-md">{act.tipoActividad}</span>
                  <span className="text-[12px] text-[#8E8E93] ml-auto">{act.fechaHora}</span>
                </div>
                <p className="text-[14px] text-[#3A3A3C] leading-relaxed">{act.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="px-4 pb-3">
        <div
          className="rounded-xl overflow-hidden border border-[#E5E5EA] cursor-pointer active:opacity-80 transition-opacity"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
          onClick={() => setShowMapModal(true)}
        >
          <div className="relative" style={{ height: 160 }}>
            <InlineMap coords={coords} height={160} />
            {/* WhatsApp-style pin */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full" style={{ pointerEvents: "none" }}>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-[#E53935] border-[2.5px] border-white flex items-center justify-center" style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div className="w-[2px] h-2 bg-[#8E8E93] -mt-[1px] rounded-b-full" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F9F9FB] border-t border-[#E5E5EA]">
            <MapPin className="w-4 h-4 shrink-0 text-[#AB1738]" strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#1C1C1E] truncate">{item.ubicacion} — {item.municipio}</p>
              <p className="text-[12px] text-[#8E8E93] tabular-nums">{coords.lat.toFixed(4)}° N, {Math.abs(coords.lng).toFixed(4)}° W</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#C7C7CC] shrink-0" strokeWidth={2} />
          </div>
        </div>
      </div>

      <MapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        coords={coords}
        address={item.ubicacion}
        municipio={item.municipio}
      />
    </>
  );
}

/* ─── Small helpers ─── */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[13px] text-[#636366] w-[120px] shrink-0 pt-0.5">{label}</span>
      <span className="text-[14px] text-[#1C1C1E] flex-1">{value}</span>
    </div>
  );
}

function PersonChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-2 rounded-lg">
      <span className="text-[14px] text-[#1C1C1E] tabular-nums">{value}</span>
      <span className="text-[14px] text-[#636366]">{label}</span>
    </div>
  );
}

/* ─── Main ─── */
export function AuditDetail() {
  const scrollContainerRef = useScrollContainer();
  useEffect(() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0; }, []);
  const { id } = useParams();
  const [showAllThread, setShowAllThread] = useState(false);
  const [lightboxData, setLightboxData] = useState<LightboxData | null>(null);

  const item = getFeedItemById(id || "");

  if (!item) {
    return (
      <div className="h-full bg-[#F2F2F7] flex flex-col">
        <AppHeader title="Detalle del Evento" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[16px] text-[#636366]">Evento no encontrado</p>
        </div>
      </div>
    );
  }

  const statusPill = getStatusPill(item.estatus);
  const isMonitoreo = item.type === "monitoreo";
  const typeConfig = isMonitoreo
    ? { icon: BarChart3, label: "Monitoreo", color: "text-[#AB1738]", bg: "bg-[#AB1738]/8" }
    : { icon: AlertTriangle, label: "Reporte 911", color: "text-[#DC2626]", bg: "bg-red-50" };

  const trazabilidad = item.trazabilidad;
  const visibleThread = showAllThread ? trazabilidad : trazabilidad.slice(0, 4);
  const hiddenCount = trazabilidad.length - 4;

  const openLightbox = (startIndex: number) => {
    if (item.images.length > 0) {
      setLightboxData({
        images: item.images,
        title: item.titulo,
        timestamp: `${item.relativeTime} · ${item.timestamp}`,
        description: item.descripcion,
        startIndex,
      });
    }
  };

  // Collect all evidence images (for gallery)
  const galleryImages: { url: string; label: string }[] = [];
  const galleryFiles: { kind: string; nombre: string }[] = [];

  if (isMonitoreo) {
    const mon = item as Monitoreo;
    mon.evidencias.forEach((ev) => {
      if (ev.kind === "image") {
        galleryImages.push({ url: ev.src, label: ev.nombre });
      } else {
        galleryFiles.push({ kind: ev.kind, nombre: ev.nombre });
      }
    });
  } else {
    // For 911, use the images array
    item.images.forEach((img, i) => {
      galleryImages.push({ url: img, label: `Evidencia ${i + 1}` });
    });
  }

  const totalEvidenceCount = isMonitoreo
    ? (item as Monitoreo).evidencias.length
    : (item as Reporte911).conteos.evidencias;

  return (
    <div className="h-full bg-[#F2F2F7] flex flex-col">
      <AppHeader title="Detalle del Evento" />

      {/* ═══ Original Post Card ═══ */}
      <div className="mx-4 mt-4 rounded-2xl overflow-hidden" style={solidCard}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-full ${item.autor.avatarColor} flex items-center justify-center shrink-0`}
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
              <span className="text-white text-[13px]">{item.autor.iniciales}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-[#1C1C1E] tracking-tight">{item.autor.nombre}</p>
              <p className="text-[13px] text-[#636366]">{item.autor.rol}</p>
              <span className="text-[12px] text-[#8E8E93] flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" strokeWidth={1.8} />{formatHumanDate(item.timestamp)}
              </span>
            </div>
            <span className={`text-[13px] px-2.5 py-1 rounded-lg ${statusPill.bg} ${statusPill.text}`}>
              {item.estatus}
            </span>
          </div>
        </div>

        {/* Type chips + title */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className={`flex items-center gap-1 text-[12px] ${typeConfig.bg} ${typeConfig.color} px-2 py-0.5 rounded-md`}>
              <typeConfig.icon className="w-3 h-3" strokeWidth={2} />{typeConfig.label}
            </span>
            <span className="text-[12px] bg-[#F2F2F7] text-[#48484A] px-2 py-0.5 rounded-md tabular-nums border border-[#E5E5EA]">{item.folio}</span>
          </div>
          <h2 className="text-[20px] text-[#1C1C1E] tracking-tight mb-1">{item.titulo}</h2>

          {/* Monitoreo subtitle */}
          {isMonitoreo && (
            <p className="text-[14px] text-[#636366] mb-1">
              {(item as Monitoreo).datosGenerales.tipoMonitoreo} · {(item as Monitoreo).datosGenerales.subtipoMonitoreo}
            </p>
          )}

          <p className="text-[14px] text-[#3A3A3C] leading-relaxed mb-3">{item.descripcion}</p>
        </div>

        {/* Conditional detail sections */}
        {item.type === "reporte911" ? (
          <Reporte911Detail item={item} onImageClick={openLightbox} />
        ) : (
          <MonitoreoDetail item={item as Monitoreo} onImageClick={openLightbox} />
        )}
      </div>

      {/* ═══ Read-only badge ═══ */}
      <div className="mx-4 mt-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#FFF1F3] border border-[#FECDD3]">
        <Eye className="w-4 h-4 text-[#AB1738] shrink-0" strokeWidth={1.8} />
        <span className="text-[14px] text-[#AB1738]">Bitácora de Solo Lectura — Perfil Supervisor</span>
      </div>

      {/* ═══ Thread — Hilo de Trazabilidad ═══ */}
      <div className="mx-4 mt-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-[15px] text-[#1C1C1E] tracking-tight">Hilo de Trazabilidad</h3>
          <div className="flex-1 h-px bg-[#E5E5EA]" />
          <span className="text-[13px] text-[#8E8E93] tabular-nums">{trazabilidad.length} registros</span>
        </div>
        <div>
          {visibleThread.map((entry, i) => (
            <ThreadReply key={i} entry={entry} isLast={i === visibleThread.length - 1 && (showAllThread || trazabilidad.length <= 4)} />
          ))}
        </div>
        {trazabilidad.length > 4 && (
          <button
            onClick={() => setShowAllThread(!showAllThread)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] text-[#AB1738] active:bg-[#F2F2F7] transition-colors mt-1 bg-white border border-[#D1D1D6]"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
          >
            {showAllThread ? <><ChevronUp className="w-4 h-4" strokeWidth={2} />Mostrar menos</> : <><ChevronDown className="w-4 h-4" strokeWidth={2} />Ver {hiddenCount} actualizaciones más</>}
          </button>
        )}
      </div>

      {/* ═══ Evidence Gallery ═══ */}
      {totalEvidenceCount > 0 && (
        <div className="mx-4 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-[15px] text-[#1C1C1E] tracking-tight">Galería de Evidencias</h3>
            <div className="flex-1 h-px bg-[#E5E5EA]" />
            <span className="text-[13px] text-[#8E8E93]">{totalEvidenceCount} archivos</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* Image evidences */}
            {galleryImages.map((img, i) => (
              <div
                key={`img-${i}`}
                className="relative aspect-square rounded-xl overflow-hidden border border-[#E5E5EA] cursor-pointer"
                style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}
                onClick={() => {
                  setLightboxData({
                    images: galleryImages.map(g => g.url),
                    title: item.titulo,
                    timestamp: item.timestamp,
                    description: img.label,
                    startIndex: i,
                  });
                }}
              >
                <ImageWithFallback src={img.url} alt={img.label} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                  <p className="text-[11px] text-white truncate">{img.label}</p>
                </div>
              </div>
            ))}

            {/* File evidences (pdf, audio, video) */}
            {galleryFiles.map((f, i) => (
              <div
                key={`file-${i}`}
                className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 bg-white border border-[#D1D1D6]"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              >
                <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center ${
                  f.kind === "pdf" ? "bg-red-50" : f.kind === "audio" ? "bg-blue-50" : f.kind === "video" ? "bg-purple-50" : "bg-gray-50"
                }`}>
                  <EvidenceIcon kind={f.kind} />
                </div>
                <span className="text-[10px] text-[#636366] text-center px-1 truncate w-full">{f.nombre}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Lightbox ═══ */}
      {lightboxData && (
        <ImageLightbox data={lightboxData} onClose={() => setLightboxData(null)} />
      )}
    </div>
  );
}
