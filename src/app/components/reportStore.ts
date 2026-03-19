/* ═══════════════════════════════════════════════════════════════
   reportStore.ts — Server-synced + localStorage cache for reports
   Personal de Campo → Servidor → Push a todos → Coordinador Regional
   ═══════════════════════════════════════════════════════════════ */

import type { Reporte911, TrazabilidadItem } from "./feedData";
import { API_BASE, apiHeaders } from "../lib/apiClient";

const STORAGE_KEY = "pc-tamaulipas-reports";

export interface SubmittedReport {
  id: string;
  folio: string;
  tipoEmergencia: string;
  ubicacion: string;
  municipio: string;
  descripcion: string;
  prioridad: "alta" | "media" | "baja";
  reportadoPor: string;
  imageDataUrl: string | null; // base64 preview for prototype
  audioDataUrl?: string | null; // base64 audio blob (local-only if large)
  audioTranscript?: string | null; // transcripción de voz
  lat: number | null;
  lng: number | null;
  timestamp: string; // ISO
  sentAt: number; // Date.now()
}

/* ─── Folio generator ─── */
let _folioSeq = 200;

// Initialize sequence from existing reports to avoid duplicate IDs
try {
  const raw = localStorage.getItem("pc-tamaulipas-reports");
  if (raw) {
    const existing: { folio?: string }[] = JSON.parse(raw);
    for (const r of existing) {
      const match = r.folio?.match(/911-2026-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= _folioSeq) _folioSeq = num + 1;
      }
    }
  }
} catch { /* ignore */ }

function nextFolio(): string {
  const num = _folioSeq++;
  return `911-2026-${String(num).padStart(4, "0")}`;
}

/* ─── Local cache CRUD ─── */
export function getSubmittedReports(): SubmittedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: SubmittedReport[] = JSON.parse(raw);
    // Deduplicate by id (keep first occurrence = newest)
    const seen = new Set<string>();
    return parsed.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  } catch {
    return [];
  }
}

/** Save report to local cache con manejo de QuotaExceededError de iOS Safari */
function saveToLocalCache(report: SubmittedReport): void {
  const existing = getSubmittedReports().filter((r) => r.id !== report.id);
  existing.unshift(report); // newest first

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (_e1) {
    // QuotaExceededError — liberar espacio eliminando imágenes y audios de reportes anteriores
    console.warn("[reportStore] localStorage quota exceeded — limpiando imágenes y audios antiguos");
    try {
      const stripped = existing.map((r, i) =>
        // Preservar imagen y audio solo del reporte más reciente (index 0)
        i === 0 ? r : { ...r, imageDataUrl: null, audioDataUrl: null }
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch (_e2) {
      // Último recurso: guardar solo el reporte nuevo sin imagen ni audio
      console.warn("[reportStore] localStorage aún lleno — guardando sin imagen ni audio");
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...report, imageDataUrl: null, audioDataUrl: null }]));
      } catch (_e3) {
        console.error("[reportStore] localStorage completamente lleno, no se pudo guardar localmente");
      }
    }
  }
}

/** Merge server reports into local cache (deduplicating) */
function mergeServerReports(serverReports: SubmittedReport[]): void {
  const local = getSubmittedReports();
  const merged = new Map<string, SubmittedReport>();
  // Server reports take priority
  for (const r of serverReports) merged.set(r.id, r);
  // Keep local-only reports that haven't synced yet
  for (const r of local) {
    if (!merged.has(r.id)) merged.set(r.id, r);
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

async function uploadEvidenceDataUrl(dataUrl: string, folder: "reports" | "monitoring"): Promise<string | null> {
  try {
    const file = dataUrlToFile(dataUrl, `evidence-${Date.now()}`);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const res = await fetch(`${API_BASE}/files/upload-evidence`, {
      method: "POST",
      headers: { Authorization: apiHeaders.Authorization },
      body: formData,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}

/* ─── Server sync: save report + push notification ─── */
export async function saveReport(report: SubmittedReport): Promise<{ success: boolean; push?: { sent: number; total: number } }> {
  const reportToSave: SubmittedReport = { ...report };
  if (reportToSave.imageDataUrl && reportToSave.imageDataUrl.startsWith("data:")) {
    const uploadedUrl = await uploadEvidenceDataUrl(reportToSave.imageDataUrl, "reports");
    if (uploadedUrl) reportToSave.imageDataUrl = uploadedUrl;
  }

  // 1. Always save to local cache immediately (optimistic)
  saveToLocalCache(reportToSave);
  window.dispatchEvent(new CustomEvent("reports-updated"));

  // 2. Send to server (which also triggers push to all devices)
  try {
    // Don't send large base64 blobs to server (too large for KV store / Edge Function payload)
    const serverReport = { ...reportToSave };
    if (serverReport.imageDataUrl && serverReport.imageDataUrl.length > 200_000) {
      serverReport.imageDataUrl = "[image-local-only]";
    }
    // Audio can be several MB — always mark as local-only on server
    if (serverReport.audioDataUrl) {
      serverReport.audioDataUrl = "[audio-local-only]";
    }

    const res = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ report: serverReport }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error(`[reportStore] Server save failed: ${errData.error || res.status}`);
      return { success: false };
    }

    const data = await res.json();
    console.log(`[reportStore] Report synced to server: ${reportToSave.id}, push: ${data.push?.sent}/${data.push?.total}`);
    return { success: true, push: data.push };
  } catch (err) {
    console.error(`[reportStore] Server sync error (report saved locally): ${err}`);
    return { success: false };
  }
}

/* ─── Fetch all reports from server ─── */
export async function fetchServerReports(): Promise<SubmittedReport[]> {
  try {
    const res = await fetch(`${API_BASE}/reports`, { headers: apiHeaders });
    if (!res.ok) {
      console.error(`[reportStore] Fetch reports failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const reports: SubmittedReport[] = data.reports || [];

    // Merge into local cache
    if (reports.length > 0) {
      mergeServerReports(reports);
      window.dispatchEvent(new CustomEvent("reports-updated"));
    }

    return reports;
  } catch (err) {
    console.error(`[reportStore] Fetch reports error: ${err}`);
    return [];
  }
}

export function clearReports(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("reports-updated"));
}

/* ─── Create a SubmittedReport from form data ─── */
export function createReport(data: {
  tipoEmergencia: string;
  ubicacion: string;
  municipio: string;
  descripcion: string;
  prioridad: "alta" | "media" | "baja";
  reportadoPor: string;
  imageDataUrl: string | null;
  audioDataUrl?: string | null;
  audioTranscript?: string | null;
  lat: number | null;
  lng: number | null;
}): SubmittedReport {
  const now = new Date();
  const folio = nextFolio();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const timestamp = `${dd}/${mm}/${yyyy}, ${hh}:${mi}`;

  return {
    id: folio,
    folio,
    tipoEmergencia: data.tipoEmergencia || "Emergencia General",
    ubicacion: data.ubicacion || "Ubicación pendiente de registro",
    municipio: data.municipio || "Ciudad Victoria",
    descripcion:
      data.descripcion ||
      "Pendiente de captura — Lorem ipsum dolor sit amet, información en proceso de actualización por personal en campo. Se requiere verificación en sitio para completar la descripción del evento.",
    prioridad: data.prioridad,
    reportadoPor: data.reportadoPor || "Personal de Campo (sin identificar)",
    imageDataUrl: data.imageDataUrl,
    audioDataUrl: data.audioDataUrl ?? null,
    audioTranscript: data.audioTranscript ?? null,
    lat: data.lat,
    lng: data.lng,
    timestamp,
    sentAt: Date.now(),
  };
}

/* ─── Avatar colors pool ─── */
const AVATAR_COLORS = [
  "bg-red-600", "bg-blue-600", "bg-emerald-700", "bg-amber-700",
  "bg-indigo-600", "bg-cyan-600", "bg-rose-600", "bg-primary",
];

/* ─── Convert SubmittedReport → FeedItem (Reporte911) ─── */
export function toFeedItem(report: SubmittedReport): Reporte911 {
  const initials = report.reportadoPor
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colorIdx =
    report.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
    AVATAR_COLORS.length;

  // Calculate relative time
  const diffMs = Date.now() - report.sentAt;
  const diffMin = Math.floor(diffMs / 60000);
  let relativeTime: string;
  if (diffMin < 1) relativeTime = "Hace un momento";
  else if (diffMin < 60) relativeTime = `Hace ${diffMin} min`;
  else {
    const hrs = Math.floor(diffMin / 60);
    relativeTime = `Hace ${hrs} hr${hrs > 1 ? "s" : ""}`;
  }

  const statusMap: Record<string, string> = {
    alta: "En Atención",
    media: "Registrado",
    baja: "Registrado",
  };

  const images: string[] = report.imageDataUrl && report.imageDataUrl !== "[image-local-only]" ? [report.imageDataUrl] : [];

  const trazabilidad: TrazabilidadItem[] = [
    {
      actor: "Sistema Central",
      tipo: "Sistema",
      hora: report.timestamp.split(", ")[1] || "00:00",
      mensaje: `Reporte de ${report.tipoEmergencia.toLowerCase()} recibido desde app móvil de Personal de Campo.`,
    },
    {
      actor: report.reportadoPor,
      tipo: "Estatus",
      hora: report.timestamp.split(", ")[1] || "00:00",
      mensaje: `Reporte enviado desde campo. Prioridad: ${report.prioridad.toUpperCase()}. ${report.descripcion.slice(0, 80)}...`,
    },
  ];

  // Add image evidence entry if image exists
  if (report.imageDataUrl && report.imageDataUrl !== "[image-local-only]") {
    trazabilidad.push({
      actor: report.reportadoPor,
      tipo: "Evidencia",
      hora: report.timestamp.split(", ")[1] || "00:00",
      mensaje: "Evidencia fotográfica adjunta desde dispositivo móvil.",
    });
  }

  // Add audio evidence entry if audio/transcript exists
  if (report.audioDataUrl || report.audioTranscript) {
    trazabilidad.push({
      actor: report.reportadoPor,
      tipo: "Evidencia",
      hora: report.timestamp.split(", ")[1] || "00:00",
      mensaje: report.audioTranscript
        ? `Descripción de voz: "${report.audioTranscript.slice(0, 100)}${report.audioTranscript.length > 100 ? "…" : ""}"`
        : "Evidencia de audio adjunta desde dispositivo móvil.",
    });
  }

  return {
    type: "reporte911",
    id: report.id,
    isNew: true,
    isPinned: report.prioridad === "alta",
    relativeTime,
    timestamp: report.timestamp,
    autor: {
      nombre: report.reportadoPor,
      iniciales: initials || "PC",
      rol: "Operador de Campo - 911",
      avatarColor: AVATAR_COLORS[colorIdx],
    },
    folio: report.folio,
    titulo: report.tipoEmergencia,
    descripcion: report.descripcion,
    ubicacion: report.ubicacion,
    municipio: report.municipio,
    coords: report.lat != null && report.lng != null ? { lat: report.lat, lng: report.lng } : undefined,
    estatus: statusMap[report.prioridad] || "Registrado",
    images,
    kpis: {
      personal: report.prioridad === "alta" ? 4 : report.prioridad === "media" ? 2 : 1,
      unidades: report.prioridad === "alta" ? 2 : 1,
      atencionesPrehosp: 0,
      duracionMin: 0,
    },
    conteos: {
      actualizaciones: trazabilidad.length,
      actividades: 1,
      evidencias: (report.imageDataUrl && report.imageDataUrl !== "[image-local-only]" ? 1 : 0) +
                  (report.audioDataUrl || report.audioTranscript ? 1 : 0),
    },
    trazabilidad,
  };
}
