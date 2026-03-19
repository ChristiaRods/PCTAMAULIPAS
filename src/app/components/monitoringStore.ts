import type { Monitoreo, TrazabilidadItem } from "./feedData";
import { API_BASE, apiHeaders } from "../lib/apiClient";

const STORAGE_KEY = "pc-tamaulipas-monitoring";

export interface SubmittedMonitoring {
  id: string;
  folio: string;
  tipoMonitoreo: string;
  subtipoMonitoreo: string;
  municipio: string;
  localidad: string;
  referencia: string;
  descripcionMonitoreo: string;
  observaciones: string;
  estatus: "Activo" | "Cerrado";
  reportadoPor: string;
  actividades: Array<{ type: string; desc: string; time: string }>;
  evidencias: Array<{ kind: "image" | "pdf" | "audio" | "video"; name: string; src: string }>;
  conteoPersonas: {
    hombres: number;
    mujeres: number;
    ninos: number;
    ninas: number;
    noIdentificados: number;
  };
  resumenOperativo: {
    vehiculos: number;
    personal: number;
    atencionesPre: number;
    traslados: number;
    rescateUrbano: number;
    rescateAcuatico: number;
    rescateTerrestre: number;
    rescateAereo: number;
    lesionadas: number;
    extraviadas: number;
    extraviadaLocalizada: boolean;
    refugios: number;
  };
  datosEspecificos: {
    tempMin: string;
    tempMax: string;
    hectareas: string;
    combustible: string;
    colonias: string;
    mmEncharcamiento: string;
  };
  timestamp: string;
  sentAt: number;
}

let _folioSeq = 35;

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const existing: { folio?: string }[] = JSON.parse(raw);
    for (const r of existing) {
      const match = r.folio?.match(/PC-2026-(\d+)/);
      if (!match) continue;
      const num = parseInt(match[1], 10);
      if (num >= _folioSeq) _folioSeq = num + 1;
    }
  }
} catch {
  // ignore local parse errors
}

function nextFolio(): string {
  const num = _folioSeq++;
  return `PC-2026-${String(num).padStart(4, "0")}`;
}

export function getSubmittedMonitorings(): SubmittedMonitoring[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: SubmittedMonitoring[] = JSON.parse(raw);
    const map = new Map<string, SubmittedMonitoring>();
    for (const item of parsed) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values()).sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));
  } catch {
    return [];
  }
}

function saveToLocalCache(monitoring: SubmittedMonitoring): void {
  const existing = getSubmittedMonitorings().filter((r) => r.id !== monitoring.id);
  existing.unshift(monitoring);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

function mergeServerMonitoring(serverData: SubmittedMonitoring[]): void {
  const local = getSubmittedMonitorings();
  const merged = new Map<string, SubmittedMonitoring>();
  for (const m of serverData) merged.set(m.id, m);
  for (const m of local) {
    if (!merged.has(m.id)) merged.set(m.id, m);
  }
  const sorted = Array.from(merged.values()).sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
}

function dataUrlToFile(dataUrl: string, fallbackName: string): File {
  const [meta, b64 = ""] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || "application/octet-stream";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mime.split("/")[1] || "bin";
  return new File([bytes], `${fallbackName}.${ext}`, { type: mime });
}

async function uploadEvidence(
  item: SubmittedMonitoring["evidencias"][number],
): Promise<SubmittedMonitoring["evidencias"][number]> {
  if (!item.src?.startsWith("data:")) return item;
  try {
    const formData = new FormData();
    formData.append("file", dataUrlToFile(item.src, item.name || "monitoring-evidence"));
    formData.append("folder", "monitoring");
    const res = await fetch(`${API_BASE}/files/upload-evidence`, {
      method: "POST",
      headers: { Authorization: apiHeaders.Authorization },
      body: formData,
    });
    if (!res.ok) return item;
    const data = await res.json();
    return { ...item, src: data.url || item.src };
  } catch {
    return item;
  }
}

export async function saveMonitoring(monitoring: SubmittedMonitoring): Promise<{ success: boolean }> {
  const evidencias = await Promise.all(monitoring.evidencias.map(uploadEvidence));
  const monitoringToSave: SubmittedMonitoring = { ...monitoring, evidencias };

  saveToLocalCache(monitoringToSave);
  window.dispatchEvent(new CustomEvent("monitoring-updated"));

  try {
    const res = await fetch(`${API_BASE}/monitoring`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ monitoring: monitoringToSave }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error(`[monitoringStore] Save failed: ${errData.error || res.status}`);
      return { success: false };
    }
    return { success: true };
  } catch (err) {
    console.error(`[monitoringStore] Save error: ${err}`);
    return { success: false };
  }
}

export async function fetchServerMonitoring(): Promise<SubmittedMonitoring[]> {
  try {
    const res = await fetch(`${API_BASE}/monitoring`, { headers: apiHeaders });
    if (!res.ok) return [];
    const data = await res.json();
    const monitoring: SubmittedMonitoring[] = data.monitoring || [];
    if (monitoring.length > 0) {
      mergeServerMonitoring(monitoring);
      window.dispatchEvent(new CustomEvent("monitoring-updated"));
    }
    return monitoring;
  } catch {
    return [];
  }
}

export function createMonitoring(data: Omit<SubmittedMonitoring, "id" | "folio" | "timestamp" | "sentAt">): SubmittedMonitoring {
  const now = new Date();
  const folio = nextFolio();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");

  return {
    ...data,
    id: folio,
    folio,
    timestamp: `${dd}/${mm}/${yyyy}, ${hh}:${mi}`,
    sentAt: Date.now(),
  };
}

export function toMonitoringFeedItem(m: SubmittedMonitoring): Monitoreo {
  const initials = m.reportadoPor
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const diffMin = Math.floor((Date.now() - m.sentAt) / 60000);
  const relativeTime =
    diffMin < 1
      ? "Hace un momento"
      : diffMin < 60
        ? `Hace ${diffMin} min`
        : `Hace ${Math.floor(diffMin / 60)} hr`;

  const trazabilidad: TrazabilidadItem[] = [
    {
      actor: "Sistema Central",
      tipo: "Sistema",
      hora: (m.timestamp.split(", ")[1] || "00:00"),
      mensaje: `Monitoreo ${m.tipoMonitoreo.toLowerCase()} recibido desde app móvil.`,
    },
    ...m.actividades.map((a) => ({
      actor: m.reportadoPor,
      tipo: "Actividad" as const,
      hora: a.time,
      mensaje: `${a.type}${a.desc ? `: ${a.desc}` : ""}`,
    })),
  ];

  const images = m.evidencias.filter((e) => e.kind === "image").map((e) => e.src);

  return {
    type: "monitoreo",
    id: m.id,
    isNew: true,
    relativeTime,
    timestamp: m.timestamp,
    autor: {
      nombre: m.reportadoPor,
      iniciales: initials || "PC",
      rol: "Operador de Campo - Monitoreo",
      avatarColor: "bg-primary",
    },
    folio: m.folio,
    titulo: m.tipoMonitoreo,
    descripcion: m.observaciones || m.descripcionMonitoreo || "Monitoreo capturado desde app móvil.",
    ubicacion: `${m.localidad}${m.referencia ? `, ${m.referencia}` : ""}`,
    municipio: m.municipio,
    estatus: m.estatus === "Cerrado" ? "Cerrado" : "En seguimiento",
    images,
    datosGenerales: {
      fechaHoraRegistro: m.timestamp,
      municipio: m.municipio,
      localidad: m.localidad,
      tipoMonitoreo: m.tipoMonitoreo,
      subtipoMonitoreo: m.subtipoMonitoreo || "Datos Generales",
      datosMonitoreo: m.descripcionMonitoreo || "Sin datos adicionales",
      tipoAfectaciones: "No localizados",
      descripcionMonitoreo: m.observaciones || m.descripcionMonitoreo || "Sin observaciones",
    },
    detalles: {
      conteoPersonas: m.conteoPersonas,
      totalPersonas:
        m.conteoPersonas.hombres +
        m.conteoPersonas.mujeres +
        m.conteoPersonas.ninos +
        m.conteoPersonas.ninas +
        m.conteoPersonas.noIdentificados,
    },
    actividades: m.actividades.map((a) => ({
      tipoActividad: a.type,
      fechaHora: `${m.timestamp.split(", ")[0]} ${a.time}`,
      descripcion: a.desc || "Actividad registrada desde app móvil",
    })),
    evidencias: m.evidencias.map((e) => ({
      kind: e.kind,
      nombre: e.name,
      src: e.src,
    })),
    conteos: {
      actividades: m.actividades.length,
      evidencias: m.evidencias.length,
    },
    trazabilidad,
  };
}
