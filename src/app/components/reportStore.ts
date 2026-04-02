import type { Reporte911, TrazabilidadItem } from "./feedData";
import { API_BASE, apiHeaders } from "../lib/apiClient";

const STORAGE_KEY = "pc-tamaulipas-reports";
const IMAGE_LOCAL_ONLY = "[image-local-only]";
const AUDIO_LOCAL_ONLY = "[audio-local-only]";

export interface SubmittedAudioNote {
  id: string;
  src: string;
  mimeType: string;
  transcript: string;
  durationSec: number;
  transcriptionStatus?: "pending" | "processing" | "done" | "error";
  transcriptionError?: string | null;
  transcribedAt?: string | null;
}

export interface MediaItem {
  type: "image" | "video";
  dataUrl: string;
  mimeType?: string;
  fileName?: string;
}

export interface SubmittedReport {
  id: string;
  folio: string;
  tipoEmergencia: string;
  ubicacion: string;
  municipio: string;
  descripcion: string;
  prioridad: "alta" | "media" | "baja";
  reportadoPor: string;
  mediaItems?: MediaItem[];
  imageDataUrls: string[];
  // Legacy field kept for backward compatibility with older cached reports.
  imageDataUrl?: string | null;
  audioNotes?: SubmittedAudioNote[];
  // Legacy fields kept for backward compatibility with older cached reports.
  audioDataUrl?: string | null;
  audioTranscript?: string | null;
  lat: number | null;
  lng: number | null;
  timestamp: string;
  sentAt: number;
}

/* Folio generator */
let _folioSeq = 200;

try {
  const raw = localStorage.getItem(STORAGE_KEY);
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
} catch {
  // ignore
}

function nextFolio(): string {
  const num = _folioSeq++;
  return `911-2026-${String(num).padStart(4, "0")}`;
}

function normalizeAudioNotes(raw: unknown): SubmittedAudioNote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      const note = (item || {}) as Partial<SubmittedAudioNote>;
      const transcript = typeof note.transcript === "string" ? note.transcript : "";
      const normalizedSrc = typeof note.src === "string" ? note.src : "";
      const statusFromPayload =
        note.transcriptionStatus === "pending" ||
        note.transcriptionStatus === "processing" ||
        note.transcriptionStatus === "done" ||
        note.transcriptionStatus === "error"
          ? note.transcriptionStatus
          : undefined;
      const transcriptionStatus =
        statusFromPayload ||
        (transcript.trim().length > 0
          ? "done"
          : normalizedSrc.length > 0
            ? "pending"
            : "error");
      return {
        id: typeof note.id === "string" && note.id.trim().length > 0 ? note.id : `audio-${idx + 1}`,
        src: normalizedSrc,
        mimeType: typeof note.mimeType === "string" && note.mimeType ? note.mimeType : "audio/webm",
        transcript,
        durationSec:
          typeof note.durationSec === "number" && Number.isFinite(note.durationSec)
            ? Math.max(0, Math.round(note.durationSec))
            : 0,
        transcriptionStatus,
        transcriptionError:
          typeof note.transcriptionError === "string" ? note.transcriptionError : null,
        transcribedAt:
          typeof note.transcribedAt === "string" ? note.transcribedAt : null,
      };
    })
    .filter((note) => note.src.length > 0 || note.transcript.trim().length > 0);
}

function ensureAudioNotes(report: SubmittedReport): SubmittedAudioNote[] {
  const normalized = normalizeAudioNotes(report.audioNotes);
  if (normalized.length > 0) return normalized;

  const legacySrc = typeof report.audioDataUrl === "string" ? report.audioDataUrl : "";
  const legacyTranscript = typeof report.audioTranscript === "string" ? report.audioTranscript : "";
  if (!legacySrc && !legacyTranscript) return [];

  return [
    {
      id: `legacy-${report.id || "audio"}`,
      src: legacySrc,
      mimeType: "audio/webm",
      transcript: legacyTranscript,
      durationSec: 0,
      transcriptionStatus: legacyTranscript.trim().length > 0 ? "done" : "pending",
      transcriptionError: null,
      transcribedAt: null,
    },
  ];
}

function normalizeLegacyImageDataUrls(report: SubmittedReport): string[] {
  const fromArray = Array.isArray(report.imageDataUrls)
    ? report.imageDataUrls.filter((url) => typeof url === "string" && url.trim().length > 0)
    : [];
  if (fromArray.length > 0) return fromArray;

  const legacy = typeof report.imageDataUrl === "string" ? report.imageDataUrl : "";
  return legacy ? [legacy] : [];
}

function normalizeMediaItems(report: SubmittedReport): MediaItem[] {
  const fromArray = Array.isArray(report.mediaItems)
    ? report.mediaItems
        .map((item) => {
          const nextType = item?.type === "video" ? "video" : "image";
          const nextDataUrl =
            typeof item?.dataUrl === "string" ? item.dataUrl.trim() : "";
          if (!nextDataUrl) return null;
          return {
            type: nextType,
            dataUrl: nextDataUrl,
            mimeType:
              typeof item?.mimeType === "string" && item.mimeType.trim().length > 0
                ? item.mimeType.trim()
                : undefined,
            fileName:
              typeof item?.fileName === "string" && item.fileName.trim().length > 0
                ? item.fileName.trim()
                : undefined,
          } as MediaItem;
        })
        .filter((item): item is MediaItem => item !== null)
    : [];
  if (fromArray.length > 0) return fromArray;

  const legacyImages = normalizeLegacyImageDataUrls(report);
  return legacyImages.map((src) => ({ type: "image", dataUrl: src }));
}

function normalizeImageDataUrls(report: SubmittedReport): string[] {
  const fromMedia = normalizeMediaItems(report)
    .filter((item) => item.type === "image")
    .map((item) => item.dataUrl)
    .filter((url) => url.trim().length > 0);
  if (fromMedia.length > 0) return fromMedia;
  return normalizeLegacyImageDataUrls(report);
}

function normalizeReport(report: SubmittedReport): SubmittedReport {
  const normalizedNotes = ensureAudioNotes(report);
  const normalizedMedia = normalizeMediaItems(report);
  const normalizedMediaImages = normalizedMedia
    .filter((item) => item.type === "image")
    .map((item) => item.dataUrl);
  const normalizedImages = normalizeImageDataUrls(report);
  const firstTranscript =
    normalizedNotes.map((n) => n.transcript.trim()).find((text) => text.length > 0) || null;
  const firstAudioSrc = normalizedNotes.find((n) => n.src)?.src || null;

  return {
    ...report,
    mediaItems: normalizedMedia,
    imageDataUrls:
      normalizedMediaImages.length > 0 ? normalizedMediaImages : normalizedImages,
    imageDataUrl:
      (normalizedMediaImages.length > 0 ? normalizedMediaImages[0] : normalizedImages[0]) ||
      null,
    audioNotes: normalizedNotes,
    audioDataUrl:
      typeof report.audioDataUrl === "string"
        ? report.audioDataUrl
        : firstAudioSrc,
    audioTranscript:
      typeof report.audioTranscript === "string"
        ? report.audioTranscript
        : firstTranscript,
  };
}

function stripHeavyMedia(report: SubmittedReport): SubmittedReport {
  const normalized = normalizeReport(report);
  return {
    ...normalized,
    mediaItems: [],
    imageDataUrls: [],
    imageDataUrl: null,
    audioNotes: normalized.audioNotes?.map((note) => ({ ...note, src: "" })) || [],
    audioDataUrl: null,
  };
}

function mergeAudioNotesPreferLocal(
  serverNotes: SubmittedAudioNote[],
  localNotes: SubmittedAudioNote[],
): SubmittedAudioNote[] {
  const localById = new Map(localNotes.map((note) => [note.id, note]));
  const merged: SubmittedAudioNote[] = serverNotes.map((serverNote) => {
    const localNote = localById.get(serverNote.id);
    const serverHasPlayableSrc = !!serverNote.src && serverNote.src !== AUDIO_LOCAL_ONLY;
    const localHasPlayableSrc = !!localNote?.src && localNote.src !== AUDIO_LOCAL_ONLY;
    return {
      ...serverNote,
      src: serverHasPlayableSrc ? serverNote.src : localHasPlayableSrc ? localNote.src : serverNote.src,
      mimeType: serverNote.mimeType || localNote?.mimeType || "audio/webm",
      durationSec: serverNote.durationSec || localNote?.durationSec || 0,
      transcript: serverNote.transcript || localNote?.transcript || "",
      transcriptionStatus:
        serverNote.transcriptionStatus ||
        localNote?.transcriptionStatus ||
        ((serverNote.transcript || localNote?.transcript || "").trim().length > 0
          ? "done"
          : "pending"),
      transcriptionError:
        serverNote.transcriptionError ??
        localNote?.transcriptionError ??
        null,
      transcribedAt:
        serverNote.transcribedAt ??
        localNote?.transcribedAt ??
        null,
    };
  });

  const mergedIds = new Set(merged.map((note) => note.id));
  for (const localNote of localNotes) {
    if (!mergedIds.has(localNote.id)) {
      merged.push(localNote);
    }
  }
  return merged;
}

function mergeServerWithLocal(
  serverReport: SubmittedReport,
  localReport?: SubmittedReport,
): SubmittedReport {
  if (!localReport) return normalizeReport(serverReport);

  const serverNormalized = normalizeReport(serverReport);
  const localNormalized = normalizeReport(localReport);

  const serverMedia = (serverNormalized.mediaItems || []).filter(
    (item) => !!item.dataUrl && item.dataUrl !== IMAGE_LOCAL_ONLY,
  );
  const localMedia = (localNormalized.mediaItems || []).filter(
    (item) => !!item.dataUrl && item.dataUrl !== IMAGE_LOCAL_ONLY,
  );
  const mediaItems = serverMedia.length > 0
    ? serverNormalized.mediaItems || []
    : localMedia.length > 0
      ? localNormalized.mediaItems || []
      : serverNormalized.mediaItems || [];

  const imageDataUrls = mediaItems
    .filter((item) => item.type === "image")
    .map((item) => item.dataUrl);

  const serverImages = serverNormalized.imageDataUrls.filter(
    (url) => !!url && url !== IMAGE_LOCAL_ONLY,
  );
  const localImages = localNormalized.imageDataUrls.filter(
    (url) => !!url && url !== IMAGE_LOCAL_ONLY,
  );
  const fallbackImageDataUrls = serverImages.length > 0
    ? serverNormalized.imageDataUrls
    : localImages.length > 0
      ? localNormalized.imageDataUrls
      : serverNormalized.imageDataUrls;

  const mergedAudioNotes = mergeAudioNotesPreferLocal(
    ensureAudioNotes(serverNormalized),
    ensureAudioNotes(localNormalized),
  );

  return normalizeReport({
    ...serverNormalized,
    mediaItems,
    imageDataUrls:
      imageDataUrls.length > 0 ? imageDataUrls : fallbackImageDataUrls,
    imageDataUrl:
      imageDataUrls[0] ||
      fallbackImageDataUrls[0] ||
      null,
    audioNotes: mergedAudioNotes,
    audioDataUrl: serverNormalized.audioDataUrl || localNormalized.audioDataUrl || null,
    audioTranscript: serverNormalized.audioTranscript || localNormalized.audioTranscript || null,
  });
}

/* Local cache CRUD */
export function getSubmittedReports(): SubmittedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map((item) => normalizeReport(item as SubmittedReport));

    // Deduplicate by id (keep first occurrence = newest)
    const seen = new Set<string>();
    return normalized.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  } catch {
    return [];
  }
}

function saveToLocalCache(report: SubmittedReport): void {
  const normalizedReport = normalizeReport(report);
  const existing = getSubmittedReports().filter((r) => r.id !== normalizedReport.id);
  existing.unshift(normalizedReport);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    console.warn("[reportStore] localStorage quota exceeded. Stripping old media payloads.");
    try {
      const stripped = existing.map((r, i) => (i === 0 ? r : stripHeavyMedia(r)));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch {
      console.warn("[reportStore] localStorage still full. Saving only latest report with text/transcripts.");
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([stripHeavyMedia(normalizedReport)]));
      } catch {
        console.error("[reportStore] localStorage completely full. Could not persist report cache.");
      }
    }
  }
}

function mergeServerReports(serverReports: SubmittedReport[]): void {
  const local = getSubmittedReports();
  const localById = new Map(local.map((r) => [r.id, r]));
  const merged = new Map<string, SubmittedReport>();

  for (const serverReport of serverReports) {
    const localVersion = localById.get(serverReport.id);
    merged.set(serverReport.id, mergeServerWithLocal(serverReport, localVersion));
  }
  for (const localReport of local) {
    if (!merged.has(localReport.id)) {
      merged.set(localReport.id, localReport);
    }
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
  const extRaw = mime.split("/")[1] || "bin";
  const ext = extRaw.split(";")[0].replace(/[^a-zA-Z0-9]/g, "") || "bin";
  return new File([bytes], `${fallbackName}.${ext}`, { type: mime });
}

async function sourceToFile(
  source: string,
  fallbackName: string,
  mimeTypeHint?: string,
): Promise<File | null> {
  if (source.startsWith("data:")) {
    return dataUrlToFile(source, fallbackName);
  }

  if (source.startsWith("blob:")) {
    const res = await fetch(source);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type || mimeTypeHint || "application/octet-stream";
    const extRaw = mime.split("/")[1] || "bin";
    const ext = extRaw.split(";")[0].replace(/[^a-zA-Z0-9]/g, "") || "bin";
    return new File([blob], `${fallbackName}.${ext}`, { type: mime });
  }

  return null;
}

async function uploadEvidenceSource(
  source: string,
  folder: "reports" | "monitoring",
  mimeTypeHint?: string,
  fallbackName = `evidence-${Date.now()}`,
): Promise<string | null> {
  try {
    if (!source) return null;
    if (!source.startsWith("data:") && !source.startsWith("blob:")) {
      return source;
    }
    if (!API_BASE) {
      console.error("[reportStore] API_BASE is empty. Verify Supabase env vars.");
      return null;
    }
    const file = await sourceToFile(source, fallbackName, mimeTypeHint);
    if (!file) return null;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const res = await fetch(`${API_BASE}/files/upload-evidence`, {
      method: "POST",
      headers: { Authorization: apiHeaders.Authorization },
      body: formData,
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[reportStore] upload-evidence failed: ${res.status} ${errBody}`);
      return null;
    }
    const data = await res.json();
    return data.url || null;
  } catch (err) {
    console.error(`[reportStore] upload-evidence exception: ${err}`);
    return null;
  }
}

/* Server sync: save report + push notification */
export async function saveReport(
  report: SubmittedReport,
): Promise<{
  success: boolean;
  push?: { sent: number; total: number };
  uploadFailures?: { images: number; videos: number; audio: number };
  error?: string;
}> {
  if (!API_BASE) {
    return {
      success: false,
      error: "API_BASE missing. Verify VITE_SUPABASE_PROJECT_ID and VITE_SUPABASE_ANON_KEY.",
      uploadFailures: { images: 0, videos: 0, audio: 0 },
    };
  }

  const reportToSave = normalizeReport(report);
  let failedImageUploads = 0;
  let failedVideoUploads = 0;
  let failedAudioUploads = 0;

  const uploadedMediaItems: MediaItem[] = [];
  for (const item of reportToSave.mediaItems || []) {
    let src = item.dataUrl;
    if (src && (src.startsWith("data:") || src.startsWith("blob:"))) {
      const uploadedUrl = await uploadEvidenceSource(
        src,
        "reports",
        item.mimeType,
        `${item.type}-evidence-${Date.now()}`,
      );
      if (uploadedUrl) src = uploadedUrl;
      else if (item.type === "video") failedVideoUploads += 1;
      else failedImageUploads += 1;
    }
    uploadedMediaItems.push({ ...item, dataUrl: src });
  }
  reportToSave.mediaItems = uploadedMediaItems;

  const uploadedImages = uploadedMediaItems
    .filter((item) => item.type === "image")
    .map((item) => item.dataUrl);
  reportToSave.imageDataUrls = uploadedImages;
  reportToSave.imageDataUrl = uploadedImages[0] || null;

  const uploadedAudioNotes: SubmittedAudioNote[] = [];
  for (const note of ensureAudioNotes(reportToSave)) {
    let src = note.src;
    if (src && (src.startsWith("data:") || src.startsWith("blob:"))) {
      const uploadedUrl = await uploadEvidenceSource(
        src,
        "reports",
        note.mimeType,
        `audio-evidence-${Date.now()}`,
      );
      if (uploadedUrl) src = uploadedUrl;
      else failedAudioUploads += 1;
    }
    uploadedAudioNotes.push({
      ...note,
      src,
      transcriptionStatus:
        note.transcript.trim().length > 0
          ? "done"
          : src.length > 0
            ? note.transcriptionStatus || "pending"
            : "error",
      transcriptionError:
        src.length > 0
          ? note.transcriptionError ?? null
          : note.transcriptionError || "audio-upload-failed",
    });
  }
  reportToSave.audioNotes = uploadedAudioNotes;
  if (!reportToSave.audioTranscript) {
    const firstTranscript =
      uploadedAudioNotes.map((n) => n.transcript.trim()).find((text) => text.length > 0) || null;
    reportToSave.audioTranscript = firstTranscript;
  }
  if (!reportToSave.audioDataUrl) {
    reportToSave.audioDataUrl = uploadedAudioNotes.find((n) => n.src)?.src || null;
  }

  saveToLocalCache(reportToSave);
  window.dispatchEvent(new CustomEvent("reports-updated"));

  try {
    const serverReport: SubmittedReport = normalizeReport({ ...reportToSave });
    serverReport.imageDataUrl = serverReport.imageDataUrls[0] || null;
    serverReport.audioNotes = ensureAudioNotes(serverReport);

    const res = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ report: serverReport }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const error = String(errData.error || res.status || "unknown");
      console.error(`[reportStore] Server save failed: ${error}`);
      return {
        success: false,
        error,
        uploadFailures: {
          images: failedImageUploads,
          videos: failedVideoUploads,
          audio: failedAudioUploads,
        },
      };
    }

    const data = await res.json();
    console.log(
      `[reportStore] Report synced to server: ${reportToSave.id}, push: ${data.push?.sent}/${data.push?.total}`,
    );
    return {
      success: true,
      push: data.push,
      uploadFailures: {
        images: failedImageUploads,
        videos: failedVideoUploads,
        audio: failedAudioUploads,
      },
    };
  } catch (err) {
    console.error(`[reportStore] Server sync error (report saved locally): ${err}`);
    return {
      success: false,
      error: String(err),
      uploadFailures: {
        images: failedImageUploads,
        videos: failedVideoUploads,
        audio: failedAudioUploads,
      },
    };
  }
}

/* Fetch all reports from server */
export async function fetchServerReports(): Promise<SubmittedReport[]> {
  if (!API_BASE) {
    console.error("[reportStore] API_BASE missing. Verify Supabase env vars.");
    return [];
  }
  try {
    const res = await fetch(`${API_BASE}/reports`, { headers: apiHeaders });
    if (!res.ok) {
      console.error(`[reportStore] Fetch reports failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const reports: SubmittedReport[] = Array.isArray(data.reports)
      ? data.reports.map((item: SubmittedReport) => normalizeReport(item))
      : [];

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

/* Create a SubmittedReport from form data */
export function createReport(data: {
  tipoEmergencia: string;
  ubicacion: string;
  municipio: string;
  descripcion: string;
  prioridad: "alta" | "media" | "baja";
  reportadoPor?: string;
  imageDataUrls?: string[];
  mediaItems?: MediaItem[];
  imageDataUrl?: string | null;
  audioNotes?: SubmittedAudioNote[];
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

  const audioNotes = normalizeAudioNotes(data.audioNotes);
  const firstTranscript = audioNotes.map((n) => n.transcript.trim()).find((text) => text.length > 0) || null;
  const firstAudioSrc = audioNotes.find((n) => n.src)?.src || null;

  const mediaItemsFromPayload = (Array.isArray(data.mediaItems) ? data.mediaItems : [])
    .map((item) => {
      const nextType = item?.type === "video" ? "video" : "image";
      const nextDataUrl =
        typeof item?.dataUrl === "string" ? item.dataUrl.trim() : "";
      if (!nextDataUrl) return null;
      return {
        type: nextType,
        dataUrl: nextDataUrl,
        mimeType:
          typeof item?.mimeType === "string" && item.mimeType.trim().length > 0
            ? item.mimeType.trim()
            : undefined,
        fileName:
          typeof item?.fileName === "string" && item.fileName.trim().length > 0
            ? item.fileName.trim()
            : undefined,
      } as MediaItem;
    })
    .filter((item): item is MediaItem => item !== null);

  const mediaImageDataUrls = mediaItemsFromPayload
    .filter((item) => item.type === "image")
    .map((item) => item.dataUrl);
  const imageDataUrls = (Array.isArray(data.imageDataUrls) ? data.imageDataUrls : mediaImageDataUrls)
    .filter((url) => typeof url === "string" && url.trim().length > 0);
  const mediaItems = mediaItemsFromPayload.length > 0
    ? mediaItemsFromPayload
    : imageDataUrls.map((url) => ({ type: "image" as const, dataUrl: url }));

  return {
    id: folio,
    folio,
    tipoEmergencia: data.tipoEmergencia || "Emergencia General",
    ubicacion: data.ubicacion || "Ubicacion pendiente de registro",
    municipio: data.municipio || "Ciudad Victoria",
    descripcion:
      data.descripcion ||
      "Pendiente de captura. Informacion en proceso de actualizacion por personal en campo.",
    prioridad: data.prioridad,
    reportadoPor: data.reportadoPor || "Personal de Campo (sin identificar)",
    mediaItems,
    imageDataUrls,
    imageDataUrl: imageDataUrls[0] || data.imageDataUrl || null,
    audioNotes,
    audioDataUrl: data.audioDataUrl ?? firstAudioSrc,
    audioTranscript: data.audioTranscript ?? firstTranscript,
    lat: data.lat,
    lng: data.lng,
    timestamp,
    sentAt: Date.now(),
  };
}

const AVATAR_COLORS = [
  "bg-red-600",
  "bg-blue-600",
  "bg-emerald-700",
  "bg-amber-700",
  "bg-indigo-600",
  "bg-cyan-600",
  "bg-rose-600",
  "bg-primary",
];

function getAudioExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function composePrimaryReportText(
  rawDescription: string,
  audioNotes: SubmittedAudioNote[],
): string {
  const description = rawDescription.trim();
  const transcripts = audioNotes
    .map((note) => note.transcript.trim())
    .filter((text) => text.length > 0);

  const appendByRule = (base: string): string => {
    let result = base.trim();
    if (result.length < 100 && transcripts.length > 0 && !result.includes(transcripts[0])) {
      result = `${result} ${transcripts[0]}`.trim();
    }
    if (result.length < 100 && transcripts.length > 1 && !result.includes(transcripts[1])) {
      result = `${result} ${transcripts[1]}`.trim();
    }
    return result;
  };

  if (description.length > 0) {
    return appendByRule(description);
  }
  if (transcripts.length > 0) {
    return appendByRule(transcripts[0]);
  }
  return "Pendiente de captura. Informacion en proceso de actualizacion por personal en campo.";
}

/* Convert SubmittedReport -> FeedItem (Reporte911) */
export function toFeedItem(report: SubmittedReport): Reporte911 {
  const normalized = normalizeReport(report);
  const audioNotes = ensureAudioNotes(normalized).filter(
    (note) => note.src.length > 0 || note.transcript.trim().length > 0,
  );
  const primaryDescription = composePrimaryReportText(normalized.descripcion || "", audioNotes);

  const initials = normalized.reportadoPor
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colorIdx =
    normalized.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
    AVATAR_COLORS.length;

  const sentAt = typeof normalized.sentAt === "number" ? normalized.sentAt : Date.now();
  const diffMs = Date.now() - sentAt;
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

  const visualMedia = (normalized.mediaItems || [])
    .filter(
      (item) =>
        (item.type === "image" || item.type === "video") &&
        !!item.dataUrl &&
        item.dataUrl !== IMAGE_LOCAL_ONLY,
    )
    .map((item) => ({
      kind: item.type,
      src: item.dataUrl,
    }));
  const images: string[] = visualMedia
    .filter((item) => item.kind === "image")
    .map((item) => item.src);

  const hora = normalized.timestamp.split(", ")[1] || "00:00";
  const safeDescription = primaryDescription;
  const summaryForThread = safeDescription.length > 80
    ? `${safeDescription.slice(0, 80)}...`
    : safeDescription;

  const trazabilidad: TrazabilidadItem[] = [
    {
      actor: "Sistema Central",
      tipo: "Sistema",
      hora,
      mensaje: `Reporte de ${normalized.tipoEmergencia.toLowerCase()} recibido desde app movil de Personal de Campo.`,
    },
    {
      actor: normalized.reportadoPor,
      tipo: "Estatus",
      hora,
      mensaje: `Reporte enviado desde campo. Prioridad: ${normalized.prioridad.toUpperCase()}. ${summaryForThread}`,
    },
  ];

  if (visualMedia.length > 0) {
    const imageCount = visualMedia.filter((item) => item.kind === "image").length;
    const videoCount = visualMedia.filter((item) => item.kind === "video").length;
    const visualSummary: string[] = [];
    if (imageCount > 0) {
      visualSummary.push(`${imageCount} ${imageCount === 1 ? "imagen" : "imagenes"}`);
    }
    if (videoCount > 0) {
      visualSummary.push(`${videoCount} ${videoCount === 1 ? "video" : "videos"}`);
    }
    trazabilidad.push({
      actor: normalized.reportadoPor,
      tipo: "Evidencia",
      hora,
      mensaje:
        visualSummary.length > 0
          ? `Evidencia multimedia adjunta: ${visualSummary.join(", ")}.`
          : "Evidencia multimedia adjunta desde dispositivo movil.",
    });
  }

  visualMedia
    .filter((item) => item.kind === "video")
    .forEach((item, idx) => {
      trazabilidad.push({
        actor: normalized.reportadoPor,
        tipo: "Evidencia",
        hora,
        mensaje: `Video ${idx + 1} adjunto desde dispositivo movil.`,
        videoSrc: item.src,
      });
    });

  audioNotes.forEach((note, idx) => {
    const transcript = note.transcript.trim();
    const shortTranscript =
      transcript.length > 0
        ? transcript.length > 110
          ? `${transcript.slice(0, 110)}...`
          : transcript
        : "";

    trazabilidad.push({
      actor: normalized.reportadoPor,
      tipo: "Evidencia",
      hora,
      mensaje:
        shortTranscript.length > 0
          ? `Nota de voz ${idx + 1}: ${shortTranscript}`
          : `Nota de voz ${idx + 1} adjunta desde dispositivo movil.`,
      transcript: transcript || undefined,
      audioSrc:
        note.src && note.src !== AUDIO_LOCAL_ONLY
          ? note.src
          : undefined,
    });
  });

  let imageSeq = 0;
  let videoSeq = 0;
  const visualEvidencias = visualMedia.map((item) => {
    if (item.kind === "image") {
      imageSeq += 1;
      return {
        kind: "image" as const,
        nombre: `evidencia_${imageSeq}.jpg`,
        src: item.src,
      };
    }
    videoSeq += 1;
    return {
      kind: "video" as const,
      nombre: `video_${videoSeq}.mp4`,
      src: item.src,
    };
  });

  const audioEvidencias = audioNotes
    .filter((note) => note.src && note.src !== AUDIO_LOCAL_ONLY)
    .map((note, idx) => ({
      kind: "audio" as const,
      nombre: `nota_voz_${idx + 1}.${getAudioExtension(note.mimeType)}`,
      src: note.src,
      transcript: note.transcript.trim() || undefined,
    }));

  const evidenciasCount =
    visualMedia.length +
    audioNotes.filter((note) => note.src.length > 0 || note.transcript.trim().length > 0).length;

  return {
    type: "reporte911",
    id: normalized.id,
    isNew: true,
    isPinned: normalized.prioridad === "alta",
    relativeTime,
    timestamp: normalized.timestamp,
    autor: {
      nombre: normalized.reportadoPor,
      iniciales: initials || "PC",
      rol: "Operador de Campo - 911",
      avatarColor: AVATAR_COLORS[colorIdx],
    },
    folio: normalized.folio,
    titulo: normalized.tipoEmergencia,
    descripcion: primaryDescription,
    ubicacion: normalized.ubicacion,
    municipio: normalized.municipio,
    coords:
      normalized.lat != null && normalized.lng != null
        ? { lat: normalized.lat, lng: normalized.lng }
        : undefined,
    estatus: statusMap[normalized.prioridad] || "Registrado",
    images,
    evidencias: [...visualEvidencias, ...audioEvidencias],
    kpis: {
      personal: normalized.prioridad === "alta" ? 4 : normalized.prioridad === "media" ? 2 : 1,
      unidades: normalized.prioridad === "alta" ? 2 : 1,
      atencionesPrehosp: 0,
      duracionMin: 0,
    },
    conteos: {
      actualizaciones: trazabilidad.length,
      actividades: 1,
      evidencias: evidenciasCount,
    },
    trazabilidad,
  };
}
