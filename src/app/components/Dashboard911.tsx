import { AppHeader } from "./AppHeader";
import { SettingsView } from "./SettingsView";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  MapPin,
  ChevronDown,
  ChevronRight,
  Camera,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Droplets,
  Flame,
  Car,
  Wind,
  Users,
  Zap as ZapIcon,
  HardHat,
  CircleDot,
  Crosshair,
  Loader2,
  Hash,
  Building2,
  MapPinned,
  ChevronUp,
  X,
  LocateFixed,
  Check,
  Mic,
  FileText,
} from "lucide-react";
import {
  AudioRecorder911,
  type AudioValue,
} from "./AudioRecorder911";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  createReport,
  saveReport,
  getSubmittedReports,
  fetchServerReports,
  type SubmittedReport,
  type SubmittedAudioNote,
  type MediaItem,
} from "./reportStore";
import { getOperatorName } from "./Home911";
import { useNavigate } from "./RouterContext";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PullToRefresh } from "./PullToRefresh";

/* ─── Constants ─── */
const TIPOS_EMERGENCIA = [
  {
    value: "Incendio Estructural",
    icon: Flame,
    color: "#DC2626",
  },
  { value: "Incendio Forestal", icon: Flame, color: "#EA580C" },
  {
    value: "Inundación Vial",
    icon: Droplets,
    color: "#2563EB",
  },
  { value: "Derrumbe", icon: HardHat, color: "#7C3AED" },
  { value: "Accidente Vial", icon: Car, color: "#D97706" },
  { value: "Fuga de Gas", icon: Wind, color: "#059669" },
  { value: "Persona Lesionada", icon: Users, color: "#DB2777" },
  { value: "Rescate", icon: AlertTriangle, color: "#0891B2" },
  { value: "Corto Circuito", icon: ZapIcon, color: "#F59E0B" },
  { value: "Otro", icon: CircleDot, color: "#6B7280" },
];

const MUNICIPIOS = [
  "Ciudad Victoria",
  "Reynosa",
  "Tampico",
  "Matamoros",
  "Nuevo Laredo",
  "Ciudad Madero",
  "Altamira",
  "Jaumave",
  "San Fernando",
];

const MUNICIPIO_COORDS: Record<
  string,
  { lat: number; lng: number }
> = {
  "Ciudad Victoria": { lat: 23.7369, lng: -99.1411 },
  Tampico: { lat: 22.2331, lng: -97.8611 },
  Reynosa: { lat: 26.0923, lng: -98.2775 },
  "Nuevo Laredo": { lat: 27.4761, lng: -99.5067 },
  Matamoros: { lat: 25.8697, lng: -97.5028 },
  "Ciudad Madero": { lat: 22.2756, lng: -97.8322 },
  Altamira: { lat: 22.3933, lng: -97.9431 },
  Jaumave: { lat: 23.4117, lng: -99.3739 },
  "San Fernando": { lat: 24.8478, lng: -98.1567 },
};

/* ─── CP → Municipio mapping for Tamaulipas ─── */
const CP_MUNICIPIO: [number, number, string][] = [
  [87000, 87199, "Ciudad Victoria"],
  [87670, 87679, "Jaumave"],
  [87600, 87669, "San Fernando"],
  [87680, 87699, "San Fernando"],
  [88000, 88299, "Nuevo Laredo"],
  [88500, 88699, "Reynosa"],
  [88700, 88899, "Matamoros"],
  [89000, 89199, "Tampico"],
  [89400, 89599, "Ciudad Madero"],
  [89600, 89699, "Altamira"],
];

function cpToMunicipio(cp: string): string | null {
  const n = parseInt(cp, 10);
  if (isNaN(n)) return null;
  for (const [lo, hi, muni] of CP_MUNICIPIO) {
    if (n >= lo && n <= hi) return muni;
  }
  return null;
}

const PRIORIDADES: {
  value: "alta" | "media" | "baja";
  label: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    value: "alta",
    label: "Alta",
    color: "#DC2626",
    bg: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.3)",
  },
  {
    value: "media",
    label: "Media",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.3)",
  },
  {
    value: "baja",
    label: "Baja",
    color: "#059669",
    bg: "rgba(5,150,105,0.08)",
    border: "rgba(5,150,105,0.3)",
  },
];

/* ─── Compose readable address ─── */
function composeAddress(a: {
  calle: string;
  numExterior: string;
  numInterior: string;
  colonia: string;
  codigoPostal: string;
  referencias: string;
}): string {
  const parts: string[] = [];
  if (a.calle) {
    let street = a.calle;
    if (a.numExterior) street += ` #${a.numExterior}`;
    if (a.numInterior) street += `, Int. ${a.numInterior}`;
    parts.push(street);
  }
  if (a.colonia) parts.push(`Col. ${a.colonia}`);
  if (a.codigoPostal) parts.push(`C.P. ${a.codigoPostal}`);
  if (a.referencias) parts.push(`(${a.referencias})`);
  return parts.join(", ");
}

function composeDescriptionFromInputs(
  writtenText: string,
  voiceNotes: AudioValue[],
): string {
  const written = writtenText.trim();
  const transcripts = voiceNotes
    .map((note) => note.transcript.trim())
    .filter((text) => text.length > 0);

  if (written.length > 0) {
    let merged = written;
    for (const transcript of transcripts) {
      if (merged.length >= 100) break;
      if (!merged.toLowerCase().includes(transcript.toLowerCase())) {
        merged = `${merged} ${transcript}`.trim();
      }
    }
    return merged;
  }

  if (transcripts.length === 0) return "";
  return transcripts.join(" • ");
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.length > 0) {
        resolve(reader.result);
        return;
      }
      reject(new Error("blob-to-dataurl-empty"));
    };
    reader.onerror = () => {
      reject(reader.error || new Error("blob-to-dataurl-failed"));
    };
    reader.readAsDataURL(blob);
  });
}

/* ─── Shared marker icon ─── */
function makePinIcon() {
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:50%;background:#AB1738;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center"><div style="width:12px;height:12px;border-radius:50%;background:white"></div></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    className: "",
  });
}

/* ═══════════════════════════════════════════════════════════════
   MAP PICKER MODAL — fullscreen interactive map
   ═══════════════════════════════════════════════════════════════ */
function MapPickerModal({
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: {
  initialLat: number;
  initialLng: number;
  onConfirm: (
    lat: number,
    lng: number,
    address: string,
  ) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [pinLat, setPinLat] = useState(initialLat);
  const [pinLng, setPinLng] = useState(initialLng);
  const [pinAddress, setPinAddress] = useState(
    "Toca el mapa para colocar el pin",
  );
  const [loading, setLoading] = useState(false);

  /* Reverse geocode a position */
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { "Accept-Language": "es" } },
        );
        if (res.ok) {
          const data = await res.json();
          const a = data.address || {};
          const parts: string[] = [];
          if (a.road) {
            let r = a.road;
            if (a.house_number) r += ` #${a.house_number}`;
            parts.push(r);
          }
          if (a.suburb || a.neighbourhood)
            parts.push(a.suburb || a.neighbourhood);
          if (a.city || a.town || a.village)
            parts.push(a.city || a.town || a.village);
          setPinAddress(
            parts.length > 0
              ? parts.join(", ")
              : data.display_name
                  ?.split(",")
                  .slice(0, 3)
                  .join(",") || "Ubicación seleccionada",
          );
        }
      } catch {
        setPinAddress("Ubicación seleccionada");
      }
      setLoading(false);
    },
    [],
  );

  /* Place or move the marker */
  const placePin = useCallback(
    (lat: number, lng: number, map: L.Map) => {
      setPinLat(lat);
      setPinLng(lng);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], {
          icon: makePinIcon(),
          draggable: true,
        }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLatLng();
          setPinLat(pos.lat);
          setPinLng(pos.lng);
          reverseGeocode(pos.lat, pos.lng);
        });
      }
      reverseGeocode(lat, lng);
    },
    [reverseGeocode],
  );

  /* Initialize map */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
      },
    ).addTo(map);

    // Add zoom control at bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    // Place initial marker
    placePin(initialLat, initialLng, map);

    // Click to move pin
    map.on("click", (e: L.LeafletMouseEvent) => {
      placePin(e.latlng.lat, e.latlng.lng, map);
    });

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Center on my location */
  const centerOnMe = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setView([latitude, longitude], 17);
        placePin(latitude, longitude, mapRef.current!);
      },
      () => {
        /* ignore errors */
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [placePin]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: "#000" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          paddingTop:
            "calc(env(safe-area-inset-top, 12px) + 10px)",
          paddingBottom: 12,
          background:
            "linear-gradient(135deg, #6B0F22, #8B1028)",
        }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-white/80 active:opacity-60 py-2 pr-3 -ml-1"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <X className="w-5 h-5" strokeWidth={2} />
          <span
            className="text-[15px]"
            style={{ fontWeight: 600 }}
          >
            Cancelar
          </span>
        </button>
        <span
          className="text-[16px] text-white"
          style={{ fontWeight: 700 }}
        >
          Seleccionar Ubicación
        </span>
        <button
          onClick={() => onConfirm(pinLat, pinLng, pinAddress)}
          className="flex items-center gap-1.5 text-[#E6D5B5] active:opacity-60 py-2 pl-3 -mr-1"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <Check className="w-5 h-5" strokeWidth={2.5} />
          <span
            className="text-[15px]"
            style={{ fontWeight: 700 }}
          >
            Aceptar
          </span>
        </button>
      </div>

      {/* Map */}
      <div ref={containerRef} className="flex-1" />

      {/* Floating "My Location" button */}
      <button
        onClick={centerOnMe}
        className="absolute right-3 active:scale-90 transition-transform"
        style={{
          bottom: 120,
          width: 44,
          height: 44,
          borderRadius: 22,
          background: "#FFFFFF",
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <LocateFixed
          className="w-5 h-5 text-[#AB1738]"
          strokeWidth={2}
        />
      </button>

      {/* Bottom info bar */}
      <div
        className="shrink-0 px-4 pt-3"
        style={{
          paddingBottom:
            "max(env(safe-area-inset-bottom, 16px), 16px)",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.7))",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-start gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#AB1738] flex items-center justify-center shrink-0 mt-0.5">
            <MapPin
              className="w-4 h-4 text-white"
              strokeWidth={2}
            />
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2
                  className="w-3.5 h-3.5 text-[#BC955B] animate-spin"
                  strokeWidth={2}
                />
                <span className="text-[13px] text-white/60">
                  Obteniendo dirección...
                </span>
              </div>
            ) : (
              <p
                className="text-[14px] text-white"
                style={{ fontWeight: 500, lineHeight: 1.4 }}
              >
                {pinAddress}
              </p>
            )}
            <p className="text-[11px] text-white/40 tabular-nums mt-0.5">
              {pinLat.toFixed(6)}°N,{" "}
              {Math.abs(pinLng).toFixed(6)}°W
            </p>
          </div>
        </div>
        <p
          className="text-[12px] text-white/50 text-center"
          style={{ lineHeight: 1.3 }}
        >
          Toca el mapa o arrastra el pin para ajustar la
          ubicación exacta
        </p>
      </div>
    </div>
  );
}

/* ─── Mini Map Preview (non-interactive, tappable) ─── */
function MiniMapPreview({
  lat,
  lng,
  label,
  onTap,
}: {
  lat: number;
  lng: number;
  label?: string;
  onTap?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
      });
      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ).addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 50);
    } else {
      mapRef.current.setView([lat, lng], 16);
    }

    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([lat, lng], {
      icon: makePinIcon(),
    }).addTo(mapRef.current!);
  }, [lat, lng]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="rounded-xl overflow-hidden border border-[#D1D1D6] relative cursor-pointer"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
      onClick={onTap}
    >
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: 150 }}
      />
      {/* Tap to expand overlay */}
      {onTap && (
        <div
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg"
          style={{
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          }}
        >
          <LocateFixed
            className="w-3 h-3 text-white"
            strokeWidth={2}
          />
          <span
            className="text-[11px] text-white"
            style={{ fontWeight: 600 }}
          >
            Ajustar pin
          </span>
        </div>
      )}
      {label && (
        <div
          className="flex items-center gap-1.5 px-3 py-2"
          style={{
            background: "#FAFAFA",
            borderTop: "1px solid #E5E5EA",
          }}
        >
          <MapPin
            className="w-3 h-3 text-[#AB1738] shrink-0"
            strokeWidth={2}
          />
          <span
            className="text-[12px] text-[#636366] truncate"
            style={{ lineHeight: 1.3 }}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export function Dashboard911() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <AnimatePresence>
        {showSettings && (
          <motion.div
            key="settings-overlay"
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
        <AppHeader title="Personal de Campo · 911" subtitle={getOperatorName()} showBack={false} onSettingsPress={() => setShowSettings(true)} />

        <ReportFormView />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP PROGRESS BAR
   ═══════════════════════════════════════════════════════════════ */
function StepProgress({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5">
        {labels.map((label, i) => {
          const s = i + 1;
          const active = s === step;
          const done = s < step;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5 flex-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: done ? "#059669" : active ? "#AB1738" : "#E5E5EA",
                    transition: "background 0.2s",
                  }}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 800, color: active ? "white" : "#AEAEB2" }}>{s}</span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#AB1738" : done ? "#059669" : "#8E8E93",
                    whiteSpace: "nowrap",
                    transition: "color 0.2s",
                  }}
                >
                  {label}
                </span>
              </div>
              {i < labels.length - 1 && (
                <div
                  className="flex-1 h-0.5 rounded-full"
                  style={{ background: done ? "#059669" : "#E5E5EA", minWidth: 12, transition: "background 0.2s" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STEP_LABELS = ["Tipo", "Ubicación", "Descripción", "Enviar"];

/* ═══════════════════════════════════════════════════════════════
   REPORT FORM VIEW  — Wizard 4 pasos
   ═══════════════════════════════════════════════════════════════ */
function ReportFormView() {
  /* ── Wizard step ── */
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const goNext = () => setStep((s) => Math.min(s + 1, 4));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const [tipoEmergencia, setTipoEmergencia] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [voiceNotes, setVoiceNotes] = useState<AudioValue[]>([]);
  const [prioridad, setPrioridad] = useState<
    "alta" | "media" | "baja"
  >("media");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const MAX_MEDIA = 5;

  /* ── Address form visibility ── */
  const [showAddressForm, setShowAddressForm] = useState(false);

  /* Address fields */
  const [codigoPostal, setCodigoPostal] = useState("");
  const [colonia, setColonia] = useState("");
  const [calle, setCalle] = useState("");
  const [numExterior, setNumExterior] = useState("");
  const [numInterior, setNumInterior] = useState("");
  const [referencias, setReferencias] = useState("");

  /* CP lookup state */
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpColonias, setCpColonias] = useState<string[]>([]);
  const [cpMunicipio, setCpMunicipio] = useState<string | null>(
    null,
  );
  const [showColoniaDD, setShowColoniaDD] = useState(false);
  const [showTipoDD, setShowTipoDD] = useState(false);
  const [showMunicipioDD, setShowMunicipioDD] = useState(false);

  /* Geolocation state */
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geoSearchLoading, setGeoSearchLoading] =
    useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsSource, setGpsSource] = useState<
    "gps" | "search" | "pin" | "municipio" | null
  >(null);

  /* Map picker modal */
  const [showMapPicker, setShowMapPicker] = useState(false);

  /* History */
  const [history, setHistory] = useState<SubmittedReport[]>(
    getSubmittedReports,
  );

  useEffect(() => {
    const handler = () => setHistory(getSubmittedReports());
    // Fetch from server on mount (merges into cache + fires "reports-updated")
    fetchServerReports().then(() => handler());
    window.addEventListener("reports-updated", handler);
    return () =>
      window.removeEventListener("reports-updated", handler);
  }, []);

  /* When municipio changes and no better source, set preview to municipio center */
  useEffect(() => {
    if (
      gpsSource !== "gps" &&
      gpsSource !== "search" &&
      gpsSource !== "pin" &&
      municipio &&
      MUNICIPIO_COORDS[municipio]
    ) {
      const c = MUNICIPIO_COORDS[municipio];
      setLat(c.lat);
      setLng(c.lng);
      setGpsSource("municipio");
    }
  }, [municipio, gpsSource]);

  const hasPreview = lat != null && lng != null;

  /* ─── CP Lookup ─── */
  const lookupCP = useCallback(async (cp: string) => {
    if (cp.length !== 5) {
      setCpColonias([]);
      setCpMunicipio(null);
      setCpError(null);
      return;
    }

    setCpLoading(true);
    setCpError(null);
    setCpColonias([]);
    setCpMunicipio(null);
    setColonia("");

    // ── Quick range check: Tamaulipas CPs are 87000–89999 ──
    const cpNum = parseInt(cp, 10);
    if (cpNum < 87000 || cpNum > 89999) {
      setCpError(
        "Este código postal no pertenece a Tamaulipas. Solo se permiten direcciones dentro del estado.",
      );
      setCpLoading(false);
      return;
    }

    // 1) Map CP → Municipio from local table
    const mappedMuni = cpToMunicipio(cp);
    if (mappedMuni) {
      setMunicipio(mappedMuni);
      setCpMunicipio(mappedMuni);
    }

    // 2) Fetch colonias from Zippopotam
    try {
      const res = await fetch(
        `https://api.zippopotam.us/mx/${cp}`,
      );
      if (res.ok) {
        const data = await res.json();

        // ── Verify the API also confirms it's Tamaulipas ──
        const apiState = (
          data.places?.[0]?.state || ""
        ).toLowerCase();
        if (apiState && !apiState.includes("tamaulipas")) {
          const stateName =
            data.places[0].state || "otro estado";
          setCpError(
            `Este código postal pertenece a ${stateName}, no a Tamaulipas. Verifica el C.P.`,
          );
          setCpLoading(false);
          if (mappedMuni) {
            setMunicipio("");
            setCpMunicipio(null);
          }
          return;
        }

        const places: string[] = (data.places || []).map(
          (p: { "place name": string }) => p["place name"],
        );
        if (places.length > 0) {
          setCpColonias(places);
          if (places.length === 1) setColonia(places[0]);

          // If we didn't get municipio from local table, try from API
          if (!mappedMuni) {
            const firstPlace = data.places?.[0];
            if (
              firstPlace?.state
                ?.toLowerCase()
                .includes("tamaulipas")
            ) {
              const matched = MUNICIPIOS.find((m) =>
                (firstPlace["place name"] || "")
                  .toLowerCase()
                  .includes(m.toLowerCase()),
              );
              if (matched) {
                setMunicipio(matched);
                setCpMunicipio(matched);
              }
            }
          }
        } else {
          setCpError(
            "No se encontraron colonias para este C.P.",
          );
        }
      } else if (res.status === 404) {
        setCpError(
          "C.P. no encontrado. Verifica que sea un código postal válido de Tamaulipas.",
        );
      } else {
        setCpError("Error al consultar. Intenta de nuevo.");
      }
    } catch {
      // Offline: still show municipio if we got it from local table
      if (mappedMuni) {
        setCpError(
          "Sin conexión, pero el municipio fue identificado.",
        );
      } else {
        setCpError(
          "Sin conexión. Escribe la colonia manualmente.",
        );
      }
    }
    setCpLoading(false);
  }, []);

  const handleCPChange = useCallback(
    (value: string) => {
      const clean = value.replace(/\D/g, "").slice(0, 5);
      setCodigoPostal(clean);
      if (clean.length === 5) {
        lookupCP(clean);
      } else {
        setCpColonias([]);
        setCpMunicipio(null);
        setCpError(null);
      }
    },
    [lookupCP],
  );

  /* ─── Geocode: structured Nominatim search from address fields ─── */
  const geocodeAddress = useCallback(async () => {
    const city = municipio || cpMunicipio || "";
    const streetQuery = numExterior
      ? `${calle} ${numExterior}`
      : calle;
    const hasStreet = calle.trim().length > 0;
    const hasColonia = colonia.trim().length > 0;
    const hasCity = city.length > 0;
    const hasCP = codigoPostal.length === 5;

    // Need at least something to search
    if (!hasStreet && !hasColonia && !hasCity && !hasCP) return;

    setGeoSearchLoading(true);
    setGpsError(null);

    // Strategy: try most specific first, then progressively broader
    const attempts: string[] = [];

    // 1) Structured search with street (most specific)
    if (hasStreet && hasCity) {
      attempts.push(
        `https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(streetQuery)}&city=${encodeURIComponent(city)}&state=Tamaulipas&country=Mexico${hasCP ? `&postalcode=${codigoPostal}` : ""}&limit=1&addressdetails=1`,
      );
    }

    // 2) Free-text: street + colonia + city
    if (hasStreet) {
      const parts = [
        streetQuery,
        hasColonia ? colonia : "",
        hasCity ? city : "Tamaulipas, Mexico",
      ].filter(Boolean);
      attempts.push(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parts.join(", "))}&limit=1&addressdetails=1`,
      );
    }

    // 3) Free-text: colonia + city
    if (hasColonia) {
      const parts = [
        colonia,
        hasCity ? city : "",
        "Tamaulipas, Mexico",
      ].filter(Boolean);
      attempts.push(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parts.join(", "))}&limit=1&addressdetails=1`,
      );
    }

    // 4) Just city name in Tamaulipas
    if (hasCity && !hasStreet && !hasColonia) {
      attempts.push(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${city}, Tamaulipas, Mexico`)}&limit=1&addressdetails=1`,
      );
    }

    // 5) CP-based search as last resort
    if (hasCP && attempts.length === 0) {
      attempts.push(
        `https://nominatim.openstreetmap.org/search?format=json&postalcode=${codigoPostal}&country=Mexico&limit=1&addressdetails=1`,
      );
    }

    let found = false;
    for (const url of attempts) {
      try {
        const res = await fetch(url, {
          headers: { "Accept-Language": "es" },
        });
        if (res.ok) {
          const results = await res.json();
          if (results.length > 0) {
            const r = results[0];
            setLat(parseFloat(r.lat));
            setLng(parseFloat(r.lon));
            setGpsSource("search");
            found = true;
            break;
          }
        }
      } catch {
        // try next
      }
    }

    if (!found) {
      if (hasCity && MUNICIPIO_COORDS[city]) {
        const c = MUNICIPIO_COORDS[city];
        setLat(c.lat);
        setLng(c.lng);
        setGpsSource("municipio");
        setGpsError(
          "No se encontró la dirección exacta. Se muestra el centro del municipio. Puedes ajustar el pin.",
        );
      } else {
        setGpsError(
          "No se pudo localizar la dirección. Intenta colocar el pin en el mapa.",
        );
      }
    }
    setGeoSearchLoading(false);
  }, [
    calle,
    numExterior,
    colonia,
    municipio,
    cpMunicipio,
    codigoPostal,
  ]);

  /* ─── GPS ─── */
  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocalización no disponible");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLng(longitude);
        setGpsSource("gps");
        setGpsLoading(false);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "es" } },
          );
          if (res.ok) {
            const data = await res.json();
            const a = data.address || {};
            if (a.road) setCalle(a.road);
            if (a.house_number) setNumExterior(a.house_number);
            if (a.suburb || a.neighbourhood || a.quarter)
              setColonia(
                a.suburb || a.neighbourhood || a.quarter,
              );
            if (a.postcode) {
              setCodigoPostal(a.postcode);
              lookupCP(a.postcode);
            }
            const city = (
              a.city ||
              a.town ||
              a.county ||
              ""
            ).toLowerCase();
            const matched = MUNICIPIOS.find((m) =>
              city.includes(m.toLowerCase()),
            );
            if (matched) setMunicipio(matched);
          }
        } catch (err) {
          console.log("Reverse geocoding failed:", err);
        }
      },
      (err) => {
        setGpsLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError("Permiso de ubicación denegado");
            break;
          case err.POSITION_UNAVAILABLE:
            setGpsError("Ubicación no disponible");
            break;
          case err.TIMEOUT:
            setGpsError("Tiempo de espera agotado");
            break;
          default:
            setGpsError("Error al obtener ubicación");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }, [lookupCP]);

  /* ── Auto-scroll to top on every step change ── */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  /* ── Auto-request GPS on step 2 ── */
  useEffect(() => {
    if (step === 2 && gpsSource === null && !gpsLoading) {
      requestGPS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* ─── Map picker confirm ─── */
  const handleMapPinConfirm = useCallback(
    async (
      pinLat: number,
      pinLng: number,
      _pinAddress: string,
    ) => {
      setShowMapPicker(false);
      setLat(pinLat);
      setLng(pinLng);
      setGpsSource("pin");
      setGpsError(null);

      // Reverse geocode to fill fields
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pinLat}&lon=${pinLng}&zoom=18&addressdetails=1`,
          { headers: { "Accept-Language": "es" } },
        );
        if (res.ok) {
          const data = await res.json();
          const a = data.address || {};
          if (a.road) setCalle(a.road);
          if (a.house_number) setNumExterior(a.house_number);
          if (a.suburb || a.neighbourhood || a.quarter)
            setColonia(
              a.suburb || a.neighbourhood || a.quarter,
            );
          if (a.postcode) {
            setCodigoPostal(a.postcode);
            lookupCP(a.postcode);
          }
          const city = (
            a.city ||
            a.town ||
            a.county ||
            ""
          ).toLowerCase();
          const matched = MUNICIPIOS.find((m) =>
            city.includes(m.toLowerCase()),
          );
          if (matched) setMunicipio(matched);
        }
      } catch {
        // keep the coords at least
      }
    },
    [lookupCP],
  );

  /* Open map picker with best center */
  const openMapPicker = useCallback(() => {
    setShowMapPicker(true);
  }, []);

  /* Get initial center for map picker */
  const pickerInitialLat =
    lat ?? MUNICIPIO_COORDS[municipio]?.lat ?? 23.7369;
  const pickerInitialLng =
    lng ?? MUNICIPIO_COORDS[municipio]?.lng ?? -99.1411;

  /* Multi-media handling */
  const handleMediaSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      e.target.value = "";

      setMediaItems((prev) => {
        const remaining = MAX_MEDIA - prev.length;
        if (remaining <= 0) return prev;
        const toProcess = files.slice(0, remaining);
        const newItems: MediaItem[] = [];

        toProcess.forEach((file) => {
          const isVideo = file.type.startsWith("video/");
          if (isVideo) {
            // Videos: use blob URL (local display only)
            const url = URL.createObjectURL(file);
            newItems.push({ type: "video", dataUrl: url });
          } else {
            // Images: base64
            if (file.size > 8 * 1024 * 1024) return; // skip >8MB images
            const reader = new FileReader();
            reader.onload = (ev) => {
              const result = ev.target?.result as string;
              if (result) {
                setMediaItems((cur) => {
                  if (cur.length >= MAX_MEDIA) return cur;
                  return [...cur, { type: "image", dataUrl: result }];
                });
              }
            };
            reader.readAsDataURL(file);
          }
        });

        // Video items added synchronously
        if (newItems.length === 0) return prev;
        return [...prev, ...newItems].slice(0, MAX_MEDIA);
      });
    },
    [],
  );

  const removeMedia = useCallback((idx: number) => {
    setMediaItems((prev) => {
      const item = prev[idx];
      // Revoke blob URL for videos to free memory
      if (item?.type === "video" && item.dataUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.dataUrl);
      }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  /* Submit */
  const handleSubmit = useCallback(async () => {
    setSending(true);

    // Small delay for UI feedback
    await new Promise((r) => setTimeout(r, 600));

    const composedAddr = composeAddress({
      calle,
      numExterior,
      numInterior,
      colonia,
      codigoPostal,
      referencias,
    });

    // ── Jerarquía de descripción: escrito → transcripciones de voz ──
    const finalDescripcion =
      composeDescriptionFromInputs(descripcion, voiceNotes) ||
      "Sin descripción registrada.";

    const audioNotesForReport: SubmittedAudioNote[] = (
      await Promise.all(
        voiceNotes.map(async (note) => {
          let src = "";
          try {
            src = await blobToDataUrl(note.blob);
          } catch (error) {
            console.warn("[Dashboard911] No se pudo serializar nota de audio", {
              noteId: note.id,
              error,
            });
          }

          const transcriptionStatus =
            note.transcriptionStatus ||
            (note.transcript.trim().length > 0
              ? "done"
              : src.length > 0
                ? "pending"
                : "error");

          return {
            id: note.id,
            src,
            mimeType:
              note.mimeType ||
              note.blob.type ||
              "audio/webm",
            transcript: note.transcript || "",
            durationSec: note.durationSec,
            transcriptionStatus,
            transcriptionError:
              src.length > 0
                ? note.transcriptionError ?? null
                : note.transcriptionError || "audio-encode-failed",
            transcribedAt: note.transcribedAt ?? null,
          };
        }),
      )
    ).filter(
      (note) =>
        note.src.length > 0 || note.transcript.trim().length > 0,
    );

    const report = createReport({
      tipoEmergencia,
      ubicacion:
        composedAddr || "Ubicación pendiente de registro",
      municipio,
      descripcion: finalDescripcion,
      prioridad,
      mediaItems,
      audioNotes: audioNotesForReport,
      lat:
        gpsSource === "gps" ||
        gpsSource === "search" ||
        gpsSource === "pin"
          ? lat
          : null,
      lng:
        gpsSource === "gps" ||
        gpsSource === "search" ||
        gpsSource === "pin"
          ? lng
          : null,
    });

    // Save to server + push notification to all devices
    const result = await saveReport(report);
    if (result.push && result.push.sent > 0) {
      console.log(
        `[Dashboard911] Report sent, push delivered to ${result.push.sent}/${result.push.total} devices`,
      );
    } else if (!result.success) {
      console.warn(
        "[Dashboard911] Report saved locally but server sync failed",
      );
    }

    // Revoke any blob URLs before navigating away
    setMediaItems((prev) => {
      prev.forEach((item) => {
        if (item.type === "video" && item.dataUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.dataUrl);
        }
      });
      return [];
    });

    // Navigate back to Home911 after submit
    navigate("/911");
  }, [
    tipoEmergencia,
    calle,
    numExterior,
    numInterior,
    colonia,
    codigoPostal,
    referencias,
    municipio,
    descripcion,
    voiceNotes,
    prioridad,
    mediaItems,
    lat,
    lng,
    gpsSource,
    navigate,
  ]);

  /* ── Derived helpers ── */
  const selectedTipo = TIPOS_EMERGENCIA.find((t) => t.value === tipoEmergencia);
  const composedPreview = composeAddress({ calle, numExterior, numInterior, colonia, codigoPostal, referencias });
  const canGeocode = calle.trim().length > 0 || colonia.trim().length > 0 || municipio.length > 0 || codigoPostal.length === 5;

  /* ─── Clear all location data ─── */
  const clearLocation = useCallback(() => {
    setLat(null); setLng(null); setGpsSource(null); setGpsError(null);
    setCodigoPostal(""); setColonia(""); setCalle(""); setNumExterior("");
    setNumInterior(""); setReferencias(""); setCpColonias([]); setCpMunicipio(null); setCpError(null);
    setMunicipio("");
  }, []);

  const handleRefresh = useCallback(async () => {
    await fetchServerReports();
    setHistory(getSubmittedReports());
  }, []);

  /* ─── Step canProceed guards ─── */
  const canStep1 = tipoEmergencia !== "";
  const canStep2 = municipio !== "";
  const hasDesc = descripcion.trim().length > 0 || voiceNotes.length > 0;

  /* ── Shared nav button style ── */
  const btnBack: React.CSSProperties = {
    width: 80, height: 64, borderRadius: 20, background: "#F2F2F7",
    border: "1.5px solid #E5E5EA", fontSize: 15, fontWeight: 700, color: "#636366",
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const btnNext = (enabled: boolean, color = "#AB1738"): React.CSSProperties => ({
    flex: 1, height: 64, borderRadius: 20, fontSize: 18, fontWeight: 800,
    letterSpacing: "-0.01em", color: enabled ? "white" : "#AEAEB2",
    background: enabled ? `linear-gradient(135deg, ${color}, ${color}CC)` : "#E5E5EA",
    boxShadow: enabled ? `0 6px 24px ${color}55` : "none",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  });

  /* ── Card wrapper style ── */
  const cardStyle: React.CSSProperties = {
    background: "#FFFFFF", borderRadius: 24, padding: 20,
    border: "1px solid #E5E5EA", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 24px rgba(0,0,0,0.06)",
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} className="flex-1 pb-28" scrollRef={scrollRef}>
      {/* ═══ Map Picker Modal ═══ */}
      {showMapPicker && (
        <MapPickerModal
          initialLat={pickerInitialLat}
          initialLng={pickerInitialLng}
          onConfirm={handleMapPinConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {/* File inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaSelect} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleMediaSelect} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleMediaSelect} />

      {/* ═══ WIZARD ═══ */}
      <div className="mx-4 mt-2 mb-4">

        {/* Step progress */}
        <StepProgress step={step} labels={STEP_LABELS} />

        <AnimatePresence mode="wait">

          {/* ══════════════════════════════════════════════════════
              PASO 1 — TIPO DE EMERGENCIA
              ══════════════════════════════════════════════════════ */}
          {step === 1 && (
            <motion.div key="step1"
              initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }} transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <div style={cardStyle}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <AlertTriangle style={{ width: 24, height: 24, color: "#DC2626" }} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: "#8E8E93", fontWeight: 500 }}>¿Qué está pasando?</p>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1E", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Tipo de Emergencia</h2>
                  </div>
                </div>

                {/* Grid de tipos — tarjetas grandes */}
                <div className="grid grid-cols-2 gap-2.5">
                  {TIPOS_EMERGENCIA.map((tipo) => {
                    const sel = tipoEmergencia === tipo.value;
                    return (
                      <button
                        key={tipo.value}
                        onClick={() => setTipoEmergencia(sel ? "" : tipo.value)}
                        className="active:scale-[0.96] transition-transform"
                        style={{
                          minHeight: 88, borderRadius: 18, padding: "14px 10px",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                          background: sel ? `${tipo.color}18` : "#F2F2F7",
                          border: `2px solid ${sel ? tipo.color : "transparent"}`,
                          boxShadow: sel ? `0 4px 16px ${tipo.color}30` : "none",
                          transition: "all 0.15s",
                        }}
                      >
                        <tipo.icon style={{ width: 30, height: 30, color: sel ? tipo.color : "#636366" }} strokeWidth={sel ? 2.5 : 1.8} />
                        <span style={{ fontSize: 13, fontWeight: sel ? 800 : 500, color: sel ? tipo.color : "#3A3A3C", lineHeight: 1.25, textAlign: "center" }}>
                          {tipo.value}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={goNext} disabled={!canStep1}
                className="w-full mt-3 active:scale-[0.97] transition-transform"
                style={btnNext(canStep1)}
              >
                {selectedTipo && <selectedTipo.icon style={{ width: 22, height: 22, color: canStep1 ? "white" : "#AEAEB2" }} strokeWidth={2.5} />}
                <span>{canStep1 ? selectedTipo!.value : "Selecciona el tipo"}</span>
                {canStep1 && <ChevronRight style={{ width: 20, height: 20 }} strokeWidth={2.5} />}
              </button>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 2 — UBICACIÓN
              ══════════════════════════════════════════════════════ */}
          {step === 2 && (
            <motion.div key="step2"
              initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }} transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <div style={cardStyle}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(171,23,56,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MapPin style={{ width: 24, height: 24, color: "#AB1738" }} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: "#8E8E93", fontWeight: 500 }}>¿Dónde ocurrió?</p>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1E", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Ubicación</h2>
                  </div>
                </div>

                {/* ── GPS BUTTON (primario, enorme) ── */}
                <button
                  onClick={requestGPS} disabled={gpsLoading}
                  className="w-full flex items-center gap-4 rounded-2xl active:scale-[0.98] transition-transform mb-3 disabled:opacity-70"
                  style={{
                    minHeight: 88, padding: "0 20px",
                    background: gpsSource === "gps"
                      ? "linear-gradient(135deg,#059669,#047857)"
                      : "linear-gradient(135deg,#AB1738,#7C1028)",
                    boxShadow: gpsSource === "gps"
                      ? "0 6px 24px rgba(5,150,105,0.30)"
                      : "0 6px 24px rgba(171,23,56,0.30)",
                  }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {gpsLoading
                      ? <Loader2 style={{ width: 28, height: 28, color: "white" }} strokeWidth={2} className="animate-spin" />
                      : gpsSource === "gps"
                        ? <CheckCircle2 style={{ width: 28, height: 28, color: "white" }} strokeWidth={2.5} />
                        : <Crosshair style={{ width: 28, height: 28, color: "white" }} strokeWidth={2} />
                    }
                  </div>
                  <div className="text-left flex-1">
                    <p style={{ fontSize: 20, fontWeight: 800, color: "white", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                      {gpsLoading ? "Obteniendo GPS..." : gpsSource === "gps" ? "Ubicación GPS obtenida" : "Usar mi ubicación GPS"}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>
                      {gpsSource === "gps" ? `${lat?.toFixed(5)}°N, ${Math.abs(lng ?? 0).toFixed(5)}°W` : "Más rápido y exacto"}
                    </p>
                  </div>
                </button>

                {/* Mini map preview si GPS obtenido */}
                {hasPreview && (gpsSource === "gps" || gpsSource === "pin" || gpsSource === "search") && (
                  <div className="mb-3">
                    <MiniMapPreview
                      lat={lat!} lng={lng!} onTap={openMapPicker}
                      label={gpsSource === "gps" ? "Ubicación GPS actual" : gpsSource === "pin" ? "Pin colocado en mapa" : composedPreview || "Dirección localizada"}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={openMapPicker}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl active:scale-[0.97] transition-transform"
                        style={{ background: "rgba(139,92,246,0.06)", border: "1.5px solid rgba(139,92,246,0.2)", color: "#7C3AED", fontSize: 14, fontWeight: 700 }}
                      >
                        <LocateFixed style={{ width: 16, height: 16 }} strokeWidth={2} />
                        Ajustar pin
                      </button>
                      <button
                        onClick={clearLocation}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl active:scale-[0.97] transition-transform"
                        style={{ background: "rgba(220,38,38,0.06)", border: "1.5px solid rgba(220,38,38,0.15)", color: "#DC2626", fontSize: 14, fontWeight: 700 }}
                      >
                        <X style={{ width: 16, height: 16 }} strokeWidth={2} />
                        Limpiar
                      </button>
                    </div>
                  </div>
                )}

                {/* Pin en mapa */}
                {!hasPreview && (
                  <button
                    onClick={openMapPicker}
                    className="w-full flex items-center gap-3 rounded-2xl active:scale-[0.98] transition-transform mb-3"
                    style={{ minHeight: 64, padding: "0 16px", background: "#F2F2F7", border: "2px dashed #C7C7CC" }}
                  >
                    <MapPin style={{ width: 22, height: 22, color: "#3B82F6" }} strokeWidth={2} />
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#3B82F6" }}>Colocar pin en el mapa</span>
                  </button>
                )}

                {/* GPS error */}
                {gpsError && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <AlertTriangle style={{ width: 16, height: 16, color: "#F59E0B", flexShrink: 0, marginTop: 2 }} strokeWidth={2} />
                    <p style={{ fontSize: 14, color: "#92400E", lineHeight: 1.4 }}>{gpsError}</p>
                  </div>
                )}

                {/* ── Dirección manual (colapsable) ── */}
                <button
                  onClick={() => setShowAddressForm(!showAddressForm)}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl active:bg-[#E5E5EA] transition-colors"
                  style={{ background: "#F2F2F7", border: "1.5px solid #E5E5EA" }}
                >
                  <span className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700, color: "#48484A" }}>
                    <MapPinned style={{ width: 18, height: 18, color: "#636366" }} strokeWidth={2} />
                    Ingresar dirección manualmente
                  </span>
                  {showAddressForm
                    ? <ChevronUp style={{ width: 18, height: 18, color: "#8E8E93" }} strokeWidth={2} />
                    : <ChevronDown style={{ width: 18, height: 18, color: "#8E8E93" }} strokeWidth={2} />
                  }
                </button>

                {showAddressForm && (
                  <div className="mt-3 rounded-xl p-4 space-y-4" style={{ background: "#F9F9FB", border: "1px solid #E5E5EA" }}>
                    {/* Municipio (requerido) */}
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#636366", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#AB1738", color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>1</span>
                        Municipio <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 700 }}>Requerido</span>
                        {cpMunicipio && <span style={{ fontSize: 11, color: "#059669", background: "rgba(5,150,105,0.1)", borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>Auto</span>}
                      </label>
                      <button
                        onClick={() => { setShowMunicipioDD(!showMunicipioDD); setShowTipoDD(false); setShowColoniaDD(false); }}
                        className="w-full flex items-center justify-between px-4 py-4 rounded-xl text-left"
                        style={{ background: "#FFFFFF", border: municipio ? "1.5px solid rgba(5,150,105,0.4)" : "1.5px solid #D1D1D6", minHeight: 56 }}
                      >
                        <span style={{ fontSize: 16, fontWeight: municipio ? 600 : 400, color: municipio ? "#1C1C1E" : "#C7C7CC" }}>
                          {municipio || "Seleccionar municipio..."}
                        </span>
                        {municipio ? <CheckCircle2 style={{ width: 18, height: 18, color: "#059669" }} strokeWidth={2} /> : <ChevronDown style={{ width: 18, height: 18, color: "#8E8E93" }} strokeWidth={2} />}
                      </button>
                      {showMunicipioDD && (
                        <div className="mt-1.5 rounded-xl overflow-hidden border border-[#D1D1D6] max-h-52 overflow-y-auto" style={{ background: "#FFFFFF", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
                          {MUNICIPIOS.map((m) => (
                            <button key={m} onClick={() => { setMunicipio(m); setShowMunicipioDD(false); }}
                              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[#F2F2F7] transition-colors"
                              style={{ borderBottom: "0.5px solid #F2F2F7", background: municipio === m ? "rgba(171,23,56,0.04)" : "transparent" }}
                            >
                              {municipio === m && <CheckCircle2 style={{ width: 16, height: 16, color: "#AB1738", flexShrink: 0 }} strokeWidth={2} />}
                              <span style={{ fontSize: 16, fontWeight: municipio === m ? 700 : 400, color: municipio === m ? "#AB1738" : "#1C1C1E" }}>{m}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Código Postal */}
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#636366", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#AB1738", color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>2</span>
                        Código Postal
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7C7CC]" strokeWidth={1.8} />
                        <input
                          value={codigoPostal} onChange={(e) => handleCPChange(e.target.value)}
                          placeholder="87000" inputMode="numeric" maxLength={5}
                          className="w-full pl-10 pr-10 py-4 rounded-xl text-[16px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none tracking-wider"
                          style={{ background: "#FFFFFF", border: cpColonias.length > 0 ? "1.5px solid rgba(5,150,105,0.4)" : "1.5px solid #D1D1D6", fontWeight: 600 }}
                        />
                        {cpLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AB1738] animate-spin" strokeWidth={2} />}
                        {cpColonias.length > 0 && !cpLoading && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#059669]" strokeWidth={2} />}
                      </div>
                      {cpError && <p className="text-[13px] text-[#DC2626] mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />{cpError}</p>}
                    </div>

                    {/* Colonia */}
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#636366", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#AB1738", color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>3</span>
                        Colonia
                      </label>
                      {cpColonias.length > 1 ? (
                        <>
                          <button
                            onClick={() => { setShowColoniaDD(!showColoniaDD); setShowMunicipioDD(false); }}
                            className="w-full flex items-center justify-between px-4 py-4 rounded-xl text-left"
                            style={{ background: "#FFFFFF", border: colonia ? "1.5px solid rgba(5,150,105,0.4)" : "1.5px solid #D1D1D6", minHeight: 56 }}
                          >
                            <span style={{ fontSize: 16, fontWeight: colonia ? 600 : 400, color: colonia ? "#1C1C1E" : "#C7C7CC" }}>{colonia || "Selecciona colonia..."}</span>
                            {showColoniaDD ? <ChevronUp className="w-4 h-4 text-[#8E8E93]" strokeWidth={2} /> : <ChevronDown className="w-4 h-4 text-[#8E8E93]" strokeWidth={2} />}
                          </button>
                          {showColoniaDD && (
                            <div className="mt-1.5 rounded-xl overflow-hidden border border-[#D1D1D6] max-h-48 overflow-y-auto" style={{ background: "#FFFFFF", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
                              {cpColonias.map((c) => (
                                <button key={c} onClick={() => { setColonia(c); setShowColoniaDD(false); }}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[#F2F2F7] transition-colors"
                                  style={{ borderBottom: "0.5px solid #F2F2F7" }}
                                >
                                  {colonia === c && <CheckCircle2 className="w-3.5 h-3.5 text-[#AB1738] shrink-0" strokeWidth={2} />}
                                  <span style={{ fontSize: 15, fontWeight: colonia === c ? 700 : 400, color: colonia === c ? "#AB1738" : "#1C1C1E" }}>{c}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <input
                          value={colonia} onChange={(e) => setColonia(e.target.value)}
                          placeholder="Ej: Centro, Del Valle"
                          className="w-full px-4 py-4 rounded-xl text-[16px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none"
                          style={{ background: "#FFFFFF", border: "1.5px solid #D1D1D6" }}
                        />
                      )}
                    </div>

                    {/* Calle */}
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#636366", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#AB1738", color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>4</span>
                        Calle y Número
                      </label>
                      <input
                        value={calle} onChange={(e) => setCalle(e.target.value)}
                        placeholder="Nombre de la calle o avenida"
                        className="w-full px-4 py-4 rounded-xl text-[16px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none mb-2"
                        style={{ background: "#FFFFFF", border: "1.5px solid #D1D1D6" }}
                      />
                      <div className="flex gap-2">
                        <input value={numExterior} onChange={(e) => setNumExterior(e.target.value)} placeholder="Núm. Ext."
                          className="flex-1 px-3 py-3.5 rounded-xl text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none"
                          style={{ background: "#FFFFFF", border: "1.5px solid #D1D1D6" }} />
                        <input value={numInterior} onChange={(e) => setNumInterior(e.target.value)} placeholder="Int. (opt.)"
                          className="flex-1 px-3 py-3.5 rounded-xl text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none"
                          style={{ background: "#FFFFFF", border: "1.5px solid #D1D1D6" }} />
                      </div>
                    </div>

                    {/* Referencias */}
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#BC955B", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#BC955B", color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>5</span>
                        Entre calles / Referencias <span style={{ fontSize: 11, color: "#8E8E93", fontWeight: 500 }}>(opcional)</span>
                      </label>
                      <textarea value={referencias} onChange={(e) => setReferencias(e.target.value)}
                        placeholder="Ej: Entre Calle 8 y Calle 10, frente a la escuela"
                        rows={2} className="w-full px-4 py-3.5 rounded-xl text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none resize-none"
                        style={{ background: "#FFFFFF", border: "1.5px solid #D1D1D6" }} />
                    </div>

                    {/* Buscar dirección */}
                    {canGeocode && (
                      <button onClick={geocodeAddress} disabled={geoSearchLoading}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl active:scale-[0.97] transition-transform disabled:opacity-60"
                        style={{
                          background: gpsSource === "search" ? "rgba(5,150,105,0.08)" : "linear-gradient(135deg,#AB1738,#8B1028)",
                          border: gpsSource === "search" ? "1.5px solid rgba(5,150,105,0.25)" : "none",
                          color: gpsSource === "search" ? "#059669" : "#FFFFFF",
                          fontSize: 16, fontWeight: 700,
                          boxShadow: gpsSource === "search" ? "none" : "0 4px 16px rgba(171,23,56,0.25)",
                        }}
                      >
                        {geoSearchLoading ? <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> Buscando...</>
                          : gpsSource === "search" ? <><CheckCircle2 className="w-4 h-4" strokeWidth={2} /> Dirección localizada — Volver a buscar</>
                          : <><MapPin className="w-5 h-5" strokeWidth={2} /> Buscar y localizar dirección</>}
                      </button>
                    )}

                    {/* Preview */}
                    {composedPreview && (
                      <div className="pt-3 border-t border-[#E5E5EA]">
                        <p style={{ fontSize: 13, color: "#636366", lineHeight: 1.5 }}>
                          <span style={{ color: "#AB1738", fontWeight: 700 }}>Dirección: </span>
                          {composedPreview}{municipio ? `, ${municipio}, Tamaulipas` : ""}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nav */}
              <div className="flex gap-3 mt-3">
                <button onClick={goBack} style={btnBack}>← Atrás</button>
                <button onClick={goNext} disabled={!canStep2} className="active:scale-[0.97] transition-transform" style={btnNext(canStep2)}>
                  <span>{canStep2 ? `${municipio} →` : "Selecciona municipio"}</span>
                  {canStep2 && <ChevronRight style={{ width: 20, height: 20 }} strokeWidth={2.5} />}
                </button>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 3 — DESCRIPCIÓN + NOTAS DE VOZ
              ══════════════════════════════════════════════════════ */}
          {step === 3 && (
            <motion.div key="step3"
              initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }} transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <div style={cardStyle}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(171,23,56,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Mic style={{ width: 24, height: 24, color: "#AB1738" }} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: "#8E8E93", fontWeight: 500 }}>Teclado o voz</p>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1E", letterSpacing: "-0.02em", lineHeight: 1.1 }}>¿Qué ocurrió?</h2>
                  </div>
                </div>

                <div className="space-y-4">
                  <div
                    className="relative rounded-[24px] p-4 overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(150deg, rgba(255,255,255,0.88), rgba(246,246,249,0.74))",
                      border: "1px solid rgba(255,255,255,0.7)",
                      boxShadow:
                        "0 20px 50px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
                      backdropFilter: "blur(16px) saturate(1.35)",
                      WebkitBackdropFilter:
                        "blur(16px) saturate(1.35)",
                    }}
                  >
                    <div
                      className="pointer-events-none absolute left-3 right-3 top-0 h-8 rounded-b-[18px]"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0))",
                      }}
                    />
                    <p
                      className="text-[#1C1C1E] mb-2.5"
                      style={{ fontSize: 16, fontWeight: 700 }}
                    >
                      Descripción escrita
                    </p>
                    <textarea
                      value={descripcion}
                      onChange={(event) =>
                        setDescripcion(event.target.value)
                      }
                      placeholder="¿Qué ocurrió en campo?"
                      rows={4}
                      data-no-swipe=""
                      className="w-full rounded-2xl px-4 py-4 resize-none outline-none"
                      style={{
                        fontSize: 17,
                        lineHeight: 1.55,
                        color: "#1C1C1E",
                        background:
                          "linear-gradient(150deg, rgba(255,255,255,0.88), rgba(246,246,249,0.76))",
                        border: descripcion.trim()
                          ? "1.5px solid rgba(171,23,56,0.4)"
                          : "1.5px solid rgba(209,209,214,0.8)",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 22px rgba(15,23,42,0.07)",
                        backdropFilter:
                          "blur(10px) saturate(1.2)",
                        WebkitBackdropFilter:
                          "blur(10px) saturate(1.2)",
                        transition:
                          "border-color 0.15s ease, box-shadow 0.15s ease",
                      }}
                    />
                    <p
                      className="mt-2 text-[#8E8E93]"
                      style={{ fontSize: 12, fontWeight: 600 }}
                    >
                      Puedes escribir, dictar o combinar ambas.
                    </p>
                  </div>

                  <div
                    className="relative rounded-[24px] p-3 overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(155deg, rgba(255,255,255,0.78), rgba(240,240,246,0.62))",
                      border: "1px solid rgba(255,255,255,0.65)",
                      boxShadow:
                        "0 20px 45px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.86)",
                      backdropFilter: "blur(18px) saturate(1.38)",
                      WebkitBackdropFilter:
                        "blur(18px) saturate(1.38)",
                    }}
                  >
                    <div
                      className="pointer-events-none absolute left-3 right-3 top-0 h-8 rounded-b-[18px]"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0))",
                      }}
                    />
                    <AudioRecorder911
                      values={voiceNotes}
                      onChange={setVoiceNotes}
                      maxNotes={5}
                    />
                  </div>
                </div>
              </div>

              {/* Nav */}
              <div className="flex gap-3 mt-3">
                <button onClick={goBack} style={btnBack}>← Atrás</button>
                <button onClick={goNext} className="active:scale-[0.97] transition-transform" style={btnNext(true, hasDesc ? "#AB1738" : "#48484A")}>
                  <FileText style={{ width: 20, height: 20, color: "white" }} strokeWidth={2} />
                  <span>{hasDesc ? "Siguiente" : "Omitir"}</span>
                  <ChevronRight style={{ width: 20, height: 20 }} strokeWidth={2.5} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 4 — PRIORIDAD + FOTO + ENVIAR
              ══════════════════════════════════════════════════════ */}
          {step === 4 && (
            <motion.div key="step4"
              initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }} transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <div style={cardStyle}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(171,23,56,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Send style={{ width: 24, height: 24, color: "#AB1738" }} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: "#8E8E93", fontWeight: 500 }}>Último paso</p>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1E", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Detalles y Envío</h2>
                  </div>
                </div>

                {/* ── Resumen del reporte ── */}
                <div className="rounded-2xl p-4 mb-5" style={{ background: "#F9F9FB", border: "1.5px solid #E5E5EA" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Resumen</p>
                  <div className="flex items-center gap-3 mb-2">
                    {selectedTipo && (
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${selectedTipo.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <selectedTipo.icon style={{ width: 22, height: 22, color: selectedTipo.color }} strokeWidth={2} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#1C1C1E" }}>{tipoEmergencia || "—"}</p>
                      <p className="truncate" style={{ fontSize: 13, color: "#636366" }}>{municipio}{composedPreview ? ` · ${composedPreview}` : ""}</p>
                    </div>
                  </div>
                  {/* Operador que envía */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#E5E5EA]">
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#AB1738,#7C1028)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "white" }}>
                        {getOperatorName().split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#3A3A3C" }} className="truncate">{getOperatorName()}</span>
                    <span style={{ fontSize: 11, color: "#8E8E93", marginLeft: "auto", flexShrink: 0 }}>En sesión</span>
                  </div>
                  {(descripcion.trim() || voiceNotes.length > 0) && (
                    <div className="mt-2 pt-2 border-t border-[#E5E5EA]">
                      <p style={{ fontSize: 13, color: "#3A3A3C", lineHeight: 1.5 }}>
                        {descripcion.trim() || (voiceNotes[0]?.transcript ? `"${voiceNotes[0].transcript.slice(0, 80)}…"` : "—")}
                      </p>
                      {voiceNotes.length > 0 && (
                        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md" style={{ fontSize: 12, fontWeight: 700, background: "rgba(171,23,56,0.08)", color: "#AB1738" }}>
                          <Mic style={{ width: 11, height: 11 }} strokeWidth={2.5} /> {voiceNotes.length} nota{voiceNotes.length > 1 ? "s" : ""} de voz
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Prioridad ── */}
                <div className="mb-5">
                  <p style={{ fontSize: 17, fontWeight: 700, color: "#1C1C1E", marginBottom: 12 }}>Prioridad</p>
                  <div className="flex gap-2.5">
                    {PRIORIDADES.map((p) => {
                      const sel = prioridad === p.value;
                      return (
                        <button key={p.value} onClick={() => setPrioridad(p.value)}
                          className="flex-1 rounded-2xl active:scale-[0.96] transition-transform"
                          style={{
                            minHeight: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                            background: sel ? p.bg : "#F2F2F7",
                            border: `2px solid ${sel ? p.border : "transparent"}`,
                            boxShadow: sel ? `0 4px 14px ${p.color}30` : "none",
                          }}
                        >
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />
                          <span style={{ fontSize: 15, fontWeight: sel ? 800 : 500, color: sel ? p.color : "#636366" }}>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Evidencia multimedia ── */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <p style={{ fontSize: 17, fontWeight: 700, color: "#1C1C1E" }}>
                      Evidencia
                      <span style={{ fontSize: 14, fontWeight: 400, color: "#8E8E93", marginLeft: 8 }}>(opcional)</span>
                    </p>
                    {mediaItems.length > 0 && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#AB1738", background: "rgba(171,23,56,0.08)", padding: "2px 10px", borderRadius: 20 }}>
                        {mediaItems.length}/{MAX_MEDIA}
                      </span>
                    )}
                  </div>

                  {/* Thumbnails grid */}
                  {mediaItems.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {mediaItems.map((item, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "1/1" }}>
                          {item.type === "image" ? (
                            <img src={item.dataUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ background: "#1C1C1E" }}>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3" fill="white" />
                              </svg>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>VIDEO</span>
                            </div>
                          )}
                          <button
                            onClick={() => removeMedia(idx)}
                            className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full active:scale-90 transition-transform"
                            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
                          >
                            <X style={{ width: 12, height: 12, color: "white" }} strokeWidth={2.5} />
                          </button>
                          {/* type badge */}
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "white", textTransform: "uppercase" }}>{item.type === "video" ? "▶ vid" : "img"}</span>
                          </div>
                        </div>
                      ))}
                      {/* Add more slot */}
                      {mediaItems.length < MAX_MEDIA && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-xl flex flex-col items-center justify-center gap-1 active:scale-[0.96] transition-transform"
                          style={{ aspectRatio: "1/1", background: "#F2F2F7", border: "2px dashed #C7C7CC" }}
                        >
                          <span style={{ fontSize: 24, color: "#AEAEB2", fontWeight: 300, lineHeight: 1 }}>+</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#8E8E93" }}>Agregar</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Action buttons (visible when empty or adding) */}
                  {mediaItems.length < MAX_MEDIA && (
                    <div className="flex gap-2">
                      <button onClick={() => cameraRef.current?.click()}
                        className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl active:scale-[0.97] transition-transform"
                        style={{
                          minHeight: mediaItems.length === 0 ? 88 : 64,
                          background: mediaItems.length === 0 ? "linear-gradient(135deg,#AB1738,#7C1028)" : "rgba(171,23,56,0.06)",
                          border: mediaItems.length === 0 ? "none" : "1.5px solid rgba(171,23,56,0.2)",
                          boxShadow: mediaItems.length === 0 ? "0 4px 16px rgba(171,23,56,0.28)" : "none",
                        }}
                      >
                        <Camera style={{ width: mediaItems.length === 0 ? 26 : 20, height: mediaItems.length === 0 ? 26 : 20, color: mediaItems.length === 0 ? "white" : "#AB1738" }} strokeWidth={2} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: mediaItems.length === 0 ? "white" : "#AB1738" }}>Cámara</span>
                      </button>
                      <button onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl active:scale-[0.97] transition-transform"
                        style={{ minHeight: mediaItems.length === 0 ? 88 : 64, background: "#F2F2F7", border: "2px dashed #C7C7CC" }}
                      >
                        <ImageIcon style={{ width: mediaItems.length === 0 ? 26 : 20, height: mediaItems.length === 0 ? 26 : 20, color: "#636366" }} strokeWidth={1.8} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#636366" }}>Galería</span>
                      </button>
                      <button onClick={() => videoRef.current?.click()}
                        className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl active:scale-[0.97] transition-transform"
                        style={{ minHeight: mediaItems.length === 0 ? 88 : 64, background: "rgba(59,130,246,0.06)", border: "1.5px solid rgba(59,130,246,0.2)" }}
                      >
                        <svg width={mediaItems.length === 0 ? 26 : 20} height={mediaItems.length === 0 ? 26 : 20} viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#3B82F6" }}>Video</span>
                      </button>
                    </div>
                  )}
                  {mediaItems.length > 0 && (
                    <p style={{ fontSize: 12, color: "#8E8E93", textAlign: "center", marginTop: 8 }}>
                      {MAX_MEDIA - mediaItems.length > 0
                        ? `Puedes agregar ${MAX_MEDIA - mediaItems.length} archivo${MAX_MEDIA - mediaItems.length > 1 ? "s" : ""} más`
                        : "Límite de 5 archivos alcanzado"}
                    </p>
                  )}
                </div>

                {/* ── Operador (sesión actual, solo informativo) ── */}
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={{ background: "#F2F2F7", border: "1.5px solid #E5E5EA" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#AB1738,#7C1028)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "white" }}>
                      {getOperatorName().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E" }} className="truncate">{getOperatorName()}</p>
                    <p style={{ fontSize: 12, color: "#8E8E93" }}>Operador en sesión · el reporte se registrará a tu nombre</p>
                  </div>
                </div>
              </div>

              {/* Nav + Enviar */}
              <div className="flex gap-3 mt-3">
                <button onClick={goBack} style={btnBack} disabled={sending}>← Atrás</button>
                <button
                  onClick={handleSubmit} disabled={sending}
                  className="active:scale-[0.97] transition-transform disabled:opacity-60"
                  style={{ ...btnNext(true), flex: 1 }}
                >
                  {sending ? (
                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
                  ) : (
                    <><Send style={{ width: 22, height: 22 }} strokeWidth={2.5} /> ENVIAR REPORTE</>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Historial oculto — no se muestra durante el llenado del formulario */}
    </PullToRefresh>
  );
}
