import { AppHeader } from "./AppHeader";
import { useNavigate } from "./RouterContext";
import {
  Send,
  MapPin,
  ChevronDown,
  Camera,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Clock,
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
  Navigation,
  Hash,
  Building2,
  MapPinned,
  ChevronUp,
  Eye,
  X,
  LocateFixed,
  Check,
} from "lucide-react";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { PushNotificationManager } from "./PushNotificationManager";
import {
  createReport,
  saveReport,
  getSubmittedReports,
  fetchServerReports,
  type SubmittedReport,
} from "./reportStore";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PullToRefresh } from "./PullToRefresh";
import { AudioRecorder911, type AudioValue } from "./AudioRecorder911";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function buildFinalDescription(
  manualText: string,
  audioNotes: AudioValue[],
): string {
  const cleanManual = manualText.trim();
  const transcripts = audioNotes
    .map((note) => note.transcript.trim())
    .filter((text) => text.length > 0);

  const appendSecondIfShort = (base: string): string => {
    let result = base.trim();
    if (result.length < 100 && transcripts.length > 0) {
      const first = transcripts[0];
      if (first && !result.includes(first)) {
        result = `${result} ${first}`.trim();
      }
    }
    if (result.length < 100 && transcripts.length > 1) {
      const second = transcripts[1];
      if (second && !result.includes(second)) {
        result = `${result} ${second}`.trim();
      }
    }
    return result;
  };

  if (cleanManual) {
    return appendSecondIfShort(cleanManual);
  }

  if (transcripts.length > 0) {
    return appendSecondIfShort(transcripts[0]);
  }

  if (audioNotes.length > 0) {
    return "Nota de voz enviada por personal de campo.";
  }

  return "";
}

const MAX_REPORT_IMAGES = 5;

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

/* ─── Tab type ─── */
type TabId = "reportes" | "push";

/* ─── Main Component ─── */
export function Dashboard911() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("reportes");

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col">
      <AppHeader title="Personal de Campo" showBack={false} onSettingsPress={() => navigate("/settings")} />

      <div
        className="flex gap-1 mx-4 mt-3 mb-2 p-1 rounded-xl"
        style={{ background: "#E5E5EA" }}
      >
        <button
          onClick={() => setActiveTab("reportes")}
          className="flex-1 py-2 rounded-lg text-[14px] transition-all"
          style={{
            background:
              activeTab === "reportes"
                ? "#FFFFFF"
                : "transparent",
            color:
              activeTab === "reportes" ? "#AB1738" : "#636366",
            fontWeight: activeTab === "reportes" ? 700 : 500,
            boxShadow:
              activeTab === "reportes"
                ? "0 1px 3px rgba(0,0,0,0.1)"
                : "none",
          }}
        >
          Reportes 911
        </button>
        <button
          onClick={() => setActiveTab("push")}
          className="flex-1 py-2 rounded-lg text-[14px] transition-all"
          style={{
            background:
              activeTab === "push" ? "#FFFFFF" : "transparent",
            color: activeTab === "push" ? "#8B5CF6" : "#636366",
            fontWeight: activeTab === "push" ? 700 : 500,
            boxShadow:
              activeTab === "push"
                ? "0 1px 3px rgba(0,0,0,0.1)"
                : "none",
          }}
        >
          Notificaciones
        </button>
      </div>

      {activeTab === "reportes" && <ReportFormView />}
      {activeTab === "push" && <PushNotificationManager />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE COMPRESSION HELPER
   Comprime con Canvas — foto iPhone 4032×3024 px (5 MB) → ~250 KB.
   iOS Safari respeta EXIF orientation automáticamente al cargar via
   objectURL, por lo que el drawImage() siempre queda correctamente
   orientado sin necesidad de leer el EXIF manualmente.
   ═══════════════════════════════════════════════════════════════ */
async function compressImage(
  file: File,
  maxPx = 1280,
  quality = 0.80,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxPx || h > maxPx) {
        if (w >= h) { h = Math.round((h * maxPx) / w); w = maxPx; }
        else        { w = Math.round((w * maxPx) / h); h = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo cargar la imagen"));
    };
    img.src = objectUrl;
  });
}

/* ═══════════════════════════════════════════════════════════════
   REPORT FORM VIEW
   ═══════════════════════════════════════════════════════════════ */
function ReportFormView() {
  const [tipoEmergencia, setTipoEmergencia] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState<
    "alta" | "media" | "baja"
  >("media");
  const [reportadoPor, setReportadoPor] = useState("");
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([]);
  const [audioNotes, setAudioNotes] = useState<AudioValue[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /* Image handling — compresión Canvas antes de guardar en estado */
  const [compressingImage, setCompressingImage] = useState(false);

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length === 0) return;

      const availableSlots = Math.max(0, MAX_REPORT_IMAGES - imageDataUrls.length);
      if (availableSlots <= 0) {
        alert(`Puedes adjuntar hasta ${MAX_REPORT_IMAGES} fotografías por reporte.`);
        return;
      }

      const selected = files.slice(0, availableSlots);
      if (files.length > availableSlots) {
        alert(`Solo se agregarán ${availableSlots} fotografías (máximo ${MAX_REPORT_IMAGES}).`);
      }

      setCompressingImage(true);
      try {
        const compressedImages: string[] = [];
        for (const file of selected) {
          const compressed = await compressImage(file);
          compressedImages.push(compressed);
        }
        setImageDataUrls((prev) => [...prev, ...compressedImages].slice(0, MAX_REPORT_IMAGES));
      } catch (err) {
        console.error("[Dashboard911] compressImage failed:", err);
        alert("No se pudo procesar una o más imágenes. Intenta nuevamente.");
      } finally {
        setCompressingImage(false);
      }
    },
    [imageDataUrls.length],
  );

  const removeImageAt = useCallback((index: number) => {
    setImageDataUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* Submit */
  const handleSubmit = useCallback(async () => {
    setSending(true);
    setSent(false);

    try {
      // Small delay for UI feedback
      await new Promise((r) => setTimeout(r, 400));

      const composedAddr = composeAddress({
        calle,
        numExterior,
        numInterior,
        colonia,
        codigoPostal,
        referencias,
      });
      const finalDescription = buildFinalDescription(descripcion, audioNotes);
      if (!finalDescription.trim()) {
        alert("Agrega texto manual o al menos una nota de voz antes de enviar el reporte.");
        return;
      }

      /* ── Convert audio notes to base64 (for upload pipeline) ── */
      const serializedAudioNotes = await Promise.all(
        audioNotes.map(async (note) => {
          try {
            const src = await blobToDataUrl(note.blob);
            return {
              id: note.id,
              src,
              mimeType: note.mimeType,
              transcript: note.transcript,
              durationSec: note.durationSec,
            };
          } catch {
            console.warn("[Dashboard911] Could not convert one audio note to base64");
            return {
              id: note.id,
              src: "",
              mimeType: note.mimeType,
              transcript: note.transcript,
              durationSec: note.durationSec,
            };
          }
        }),
      );

      const report = createReport({
        tipoEmergencia,
        ubicacion:
          composedAddr || "Ubicación pendiente de registro",
        municipio,
        descripcion: finalDescription,
        prioridad,
        reportadoPor,
        imageDataUrls,
        audioNotes: serializedAudioNotes,
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

      // Reset form
      setTipoEmergencia("");
      setCodigoPostal("");
      setColonia("");
      setCalle("");
      setNumExterior("");
      setNumInterior("");
      setReferencias("");
      setCpColonias([]);
      setCpMunicipio(null);
      setCpError(null);
      setMunicipio("");
      setDescripcion("");
      setPrioridad("media");
      setReportadoPor("");
      setImageDataUrls([]);
      setAudioNotes([]);
      setLat(null);
      setLng(null);
      setGpsSource(null);
      setGpsError(null);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      console.error("[Dashboard911] handleSubmit error:", err);
      alert("Ocurrió un error al enviar el reporte. Intenta nuevamente.");
    } finally {
      // SIEMPRE libera el estado de envío, pase lo que pase
      setSending(false);
    }
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
    prioridad,
    reportadoPor,
    imageDataUrls,
    audioNotes,
    lat,
    lng,
    gpsSource,
  ]);

  /* Dropdown states */
  const [showTipoDD, setShowTipoDD] = useState(false);
  const [showMunicipioDD, setShowMunicipioDD] = useState(false);
  const selectedTipo = TIPOS_EMERGENCIA.find(
    (t) => t.value === tipoEmergencia,
  );
  const composedPreview = composeAddress({
    calle,
    numExterior,
    numInterior,
    colonia,
    codigoPostal,
    referencias,
  });
  const canGeocode =
    calle.trim().length > 0 ||
    colonia.trim().length > 0 ||
    municipio.length > 0 ||
    codigoPostal.length === 5;

  /* ─── Clear all location data ─── */
  const clearLocation = useCallback(() => {
    setLat(null);
    setLng(null);
    setGpsSource(null);
    setGpsError(null);
    setCodigoPostal("");
    setColonia("");
    setCalle("");
    setNumExterior("");
    setNumInterior("");
    setReferencias("");
    setCpColonias([]);
    setCpMunicipio(null);
    setCpError(null);
    setMunicipio("");
  }, []);

  const handleRefresh = useCallback(async () => {
    await fetchServerReports();
    setHistory(getSubmittedReports());
  }, []);

  return (
    <PullToRefresh onRefresh={handleRefresh} className="flex-1 min-h-0">
      {/* ═══ Map Picker Modal ═══ */}
      {showMapPicker && (
        <MapPickerModal
          initialLat={pickerInitialLat}
          initialLng={pickerInitialLng}
          onConfirm={handleMapPinConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {/* ═══ Form Card ═══ */}
      <div className="mx-4 mt-2 mb-4">
        <div
          className="rounded-2xl p-4 space-y-4"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E5EA",
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
          }}
        >
          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(220,38,38,0.08)" }}
            >
              <AlertTriangle
                className="w-4 h-4 text-[#DC2626]"
                strokeWidth={2}
              />
            </div>
            <h2
              className="text-[18px] text-[#1C1C1E]"
              style={{ fontWeight: 700 }}
            >
              Nuevo Reporte 911
            </h2>
          </div>

          {/* Tipo de Emergencia */}
          <div>
            <label
              className="text-[13px] text-[#636366] mb-1.5 block"
              style={{ fontWeight: 600 }}
            >
              Tipo de Emergencia
            </label>
            <button
              onClick={() => {
                setShowTipoDD(!showTipoDD);
                setShowMunicipioDD(false);
                setShowColoniaDD(false);
              }}
              className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-left"
              style={{
                background: "#F2F2F7",
                border: "1px solid #E5E5EA",
              }}
            >
              {selectedTipo ? (
                <span className="flex items-center gap-2 text-[15px] text-[#1C1C1E]">
                  <selectedTipo.icon
                    className="w-4 h-4"
                    style={{ color: selectedTipo.color }}
                    strokeWidth={2}
                  />
                  {selectedTipo.value}
                </span>
              ) : (
                <span className="text-[15px] text-[#C7C7CC]">
                  Seleccionar tipo...
                </span>
              )}
              <ChevronDown
                className="w-4 h-4 text-[#8E8E93]"
                strokeWidth={2}
              />
            </button>
            {showTipoDD && (
              <div
                className="mt-1 rounded-xl overflow-hidden border border-[#E5E5EA]"
                style={{
                  background: "#FFFFFF",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                }}
              >
                {TIPOS_EMERGENCIA.map((tipo) => (
                  <button
                    key={tipo.value}
                    onClick={() => {
                      setTipoEmergencia(tipo.value);
                      setShowTipoDD(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left active:bg-[#F2F2F7] transition-colors"
                    style={{
                      borderBottom: "0.5px solid #F2F2F7",
                    }}
                  >
                    <tipo.icon
                      className="w-4 h-4 shrink-0"
                      style={{ color: tipo.color }}
                      strokeWidth={2}
                    />
                    <span className="text-[15px] text-[#1C1C1E]">
                      {tipo.value}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════
              UBICACIÓN
              ═══════════════════════════════════════ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                className="text-[13px] text-[#636366]"
                style={{ fontWeight: 600 }}
              >
                Ubicación del Incidente
              </label>
              {gpsSource === "gps" && (
                <span
                  className="text-[11px] text-white bg-[#059669] px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ fontWeight: 600 }}
                >
                  <Navigation
                    className="w-3 h-3"
                    strokeWidth={2}
                  />{" "}
                  GPS
                </span>
              )}
              {gpsSource === "search" && (
                <span
                  className="text-[11px] text-white bg-[#3B82F6] px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ fontWeight: 600 }}
                >
                  <CheckCircle2
                    className="w-3 h-3"
                    strokeWidth={2}
                  />{" "}
                  Localizada
                </span>
              )}
              {gpsSource === "pin" && (
                <span
                  className="text-[11px] text-white bg-[#8B5CF6] px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ fontWeight: 600 }}
                >
                  <Eye className="w-3 h-3" strokeWidth={2} />{" "}
                  Pin manual
                </span>
              )}
            </div>

            {/* Action buttons row */}
            <div className="flex gap-2 mb-3">
              {/* GPS Button */}
              <button
                onClick={requestGPS}
                disabled={gpsLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl active:scale-[0.97] transition-all disabled:opacity-60"
                style={{
                  background:
                    gpsSource === "gps"
                      ? "rgba(5,150,105,0.08)"
                      : "rgba(171,23,56,0.04)",
                  border:
                    gpsSource === "gps"
                      ? "1.5px solid rgba(5,150,105,0.3)"
                      : "1.5px solid rgba(171,23,56,0.12)",
                }}
              >
                {gpsLoading ? (
                  <Loader2
                    className="w-4 h-4 text-[#AB1738] animate-spin"
                    strokeWidth={2}
                  />
                ) : gpsSource === "gps" ? (
                  <CheckCircle2
                    className="w-4 h-4 text-[#059669]"
                    strokeWidth={2}
                  />
                ) : (
                  <Crosshair
                    className="w-4 h-4 text-[#AB1738]"
                    strokeWidth={2}
                  />
                )}
                <span
                  className="text-[13px]"
                  style={{
                    fontWeight: 600,
                    color:
                      gpsSource === "gps"
                        ? "#059669"
                        : "#AB1738",
                  }}
                >
                  {gpsLoading
                    ? "Obteniendo..."
                    : gpsSource === "gps"
                      ? "GPS listo"
                      : "Usar GPS"}
                </span>
              </button>

              {/* Map Pin Button */}
              <button
                onClick={openMapPicker}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl active:scale-[0.97] transition-all"
                style={{
                  background:
                    gpsSource === "pin"
                      ? "rgba(59,130,246,0.08)"
                      : "rgba(59,130,246,0.04)",
                  border:
                    gpsSource === "pin"
                      ? "1.5px solid rgba(59,130,246,0.3)"
                      : "1.5px solid rgba(59,130,246,0.12)",
                }}
              >
                {gpsSource === "pin" ? (
                  <CheckCircle2
                    className="w-4 h-4 text-[#3B82F6]"
                    strokeWidth={2}
                  />
                ) : (
                  <MapPin
                    className="w-4 h-4 text-[#3B82F6]"
                    strokeWidth={2}
                  />
                )}
                <span
                  className="text-[13px] text-[#3B82F6]"
                  style={{ fontWeight: 600 }}
                >
                  {gpsSource === "pin"
                    ? "Pin colocado"
                    : "Poner pin en mapa"}
                </span>
              </button>
            </div>

            {/* GPS/search/pin coords badge */}
            {(gpsSource === "gps" ||
              gpsSource === "search" ||
              gpsSource === "pin") &&
              lat != null &&
              lng != null && (
                <div
                  className="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg"
                  style={{
                    background: "rgba(5,150,105,0.04)",
                    border: "1px solid rgba(5,150,105,0.12)",
                  }}
                >
                  <Navigation
                    className="w-3 h-3 text-[#059669] shrink-0"
                    strokeWidth={2}
                  />
                  <span
                    className="text-[12px] text-[#059669] tabular-nums"
                    style={{ fontWeight: 500 }}
                  >
                    {lat.toFixed(6)}°N,{" "}
                    {Math.abs(lng).toFixed(6)}°W
                  </span>
                  <button
                    onClick={clearLocation}
                    className="ml-auto text-[11px] text-[#DC2626] px-2 py-0.5 rounded-md active:opacity-60"
                    style={{
                      background: "rgba(220,38,38,0.06)",
                      fontWeight: 600,
                    }}
                  >
                    Limpiar
                  </button>
                </div>
              )}

            {/* GPS Error */}
            {gpsError && (
              <div
                className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg"
                style={{ background: "rgba(220,38,38,0.04)" }}
              >
                <AlertTriangle
                  className="w-3.5 h-3.5 text-[#F59E0B] shrink-0"
                  strokeWidth={2}
                />
                <span className="text-[12px] text-[#8B6914]">
                  {gpsError}
                </span>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-[#E5E5EA]" />
              <span
                className="text-[11px] text-[#8E8E93] uppercase tracking-wider"
                style={{ fontWeight: 600 }}
              >
                Dirección
              </span>
              <div className="flex-1 h-px bg-[#E5E5EA]" />
            </div>

            {/* ─── Structured Address Card ─── */}
            <div
              className="rounded-xl p-3 space-y-3"
              style={{
                background: "#F9F9FB",
                border: "1px solid #E5E5EA",
              }}
            >
              {/* STEP 1: Código Postal */}
              <div>
                <label
                  className="text-[12px] text-[#636366] mb-1 flex items-center gap-1"
                  style={{ fontWeight: 700 }}
                >
                  <span
                    className="w-4 h-4 rounded-full bg-[#AB1738] text-white text-[10px] flex items-center justify-center"
                    style={{ fontWeight: 700 }}
                  >
                    1
                  </span>
                  Código Postal
                </label>
                <div className="relative">
                  <Hash
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7C7CC]"
                    strokeWidth={1.8}
                  />
                  <input
                    value={codigoPostal}
                    onChange={(e) =>
                      handleCPChange(e.target.value)
                    }
                    placeholder="Ej: 87000"
                    inputMode="numeric"
                    maxLength={5}
                    className="w-full pl-9 pr-10 py-3 rounded-xl text-[16px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none tracking-wider focus:ring-2 focus:ring-[#AB1738]/20"
                    style={{
                      background: "#FFFFFF",
                      border:
                        cpColonias.length > 0
                          ? "1.5px solid rgba(5,150,105,0.3)"
                          : "1px solid #D1D1D6",
                      fontWeight: 600,
                    }}
                  />
                  {cpLoading && (
                    <Loader2
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AB1738] animate-spin"
                      strokeWidth={2}
                    />
                  )}
                  {cpColonias.length > 0 && !cpLoading && (
                    <CheckCircle2
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#059669]"
                      strokeWidth={2}
                    />
                  )}
                </div>
                {cpError && (
                  <p className="text-[12px] text-[#DC2626] mt-1 px-1 flex items-center gap-1">
                    <AlertTriangle
                      className="w-3 h-3 shrink-0"
                      strokeWidth={2}
                    />
                    {cpError}
                  </p>
                )}
                {cpColonias.length > 0 && (
                  <p
                    className="text-[11px] text-[#059669] mt-1 px-1"
                    style={{ fontWeight: 500 }}
                  >
                    {cpColonias.length} colonia
                    {cpColonias.length > 1 ? "s" : ""}{" "}
                    encontrada{cpColonias.length > 1 ? "s" : ""}
                    {cpMunicipio &&
                      ` — ${cpMunicipio}, Tamaulipas`}
                  </p>
                )}
              </div>

              {/* STEP 2: Colonia */}
              <div>
                <label
                  className="text-[12px] text-[#636366] mb-1 flex items-center gap-1"
                  style={{ fontWeight: 700 }}
                >
                  <span
                    className="w-4 h-4 rounded-full bg-[#AB1738] text-white text-[10px] flex items-center justify-center"
                    style={{ fontWeight: 700 }}
                  >
                    2
                  </span>
                  Colonia
                </label>
                {cpColonias.length > 1 ? (
                  <div>
                    <button
                      onClick={() => {
                        setShowColoniaDD(!showColoniaDD);
                        setShowTipoDD(false);
                        setShowMunicipioDD(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-left"
                      style={{
                        background: "#FFFFFF",
                        border: colonia
                          ? "1.5px solid rgba(5,150,105,0.3)"
                          : "1px solid #D1D1D6",
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <MapPinned
                          className="w-4 h-4 text-[#8E8E93]"
                          strokeWidth={1.8}
                        />
                        <span
                          className={`text-[15px] ${colonia ? "text-[#1C1C1E]" : "text-[#C7C7CC]"}`}
                          style={{
                            fontWeight: colonia ? 500 : 400,
                          }}
                        >
                          {colonia || "Selecciona colonia..."}
                        </span>
                      </span>
                      {showColoniaDD ? (
                        <ChevronUp
                          className="w-4 h-4 text-[#8E8E93]"
                          strokeWidth={2}
                        />
                      ) : (
                        <ChevronDown
                          className="w-4 h-4 text-[#8E8E93]"
                          strokeWidth={2}
                        />
                      )}
                    </button>
                    {showColoniaDD && (
                      <div
                        className="mt-1 rounded-xl overflow-hidden border border-[#D1D1D6] max-h-48 overflow-y-auto"
                        style={{
                          background: "#FFFFFF",
                          boxShadow:
                            "0 4px 20px rgba(0,0,0,0.12)",
                        }}
                      >
                        {cpColonias.map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              setColonia(c);
                              setShowColoniaDD(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left active:bg-[#F2F2F7] transition-colors"
                            style={{
                              borderBottom:
                                "0.5px solid #F2F2F7",
                              background:
                                colonia === c
                                  ? "rgba(171,23,56,0.04)"
                                  : "transparent",
                            }}
                          >
                            {colonia === c && (
                              <CheckCircle2
                                className="w-3.5 h-3.5 text-[#AB1738] shrink-0"
                                strokeWidth={2}
                              />
                            )}
                            <span
                              className={`text-[15px] ${colonia === c ? "text-[#AB1738]" : "text-[#1C1C1E]"}`}
                              style={{
                                fontWeight:
                                  colonia === c ? 600 : 400,
                              }}
                            >
                              {c}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <MapPinned
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7C7CC]"
                      strokeWidth={1.8}
                    />
                    <input
                      value={colonia}
                      onChange={(e) =>
                        setColonia(e.target.value)
                      }
                      placeholder={
                        cpColonias.length === 1
                          ? cpColonias[0]
                          : "Ej: Centro, Del Valle, Las Flores"
                      }
                      className="w-full pl-9 pr-3 py-3 rounded-xl text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none focus:ring-2 focus:ring-[#AB1738]/20"
                      style={{
                        background: "#FFFFFF",
                        border: colonia
                          ? "1.5px solid rgba(5,150,105,0.3)"
                          : "1px solid #D1D1D6",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* STEP 3: Municipio */}
              <div>
                <label
                  className="text-[12px] text-[#636366] mb-1 flex items-center gap-1"
                  style={{ fontWeight: 700 }}
                >
                  <span
                    className="w-4 h-4 rounded-full bg-[#AB1738] text-white text-[10px] flex items-center justify-center"
                    style={{ fontWeight: 700 }}
                  >
                    3
                  </span>
                  Municipio
                  {cpMunicipio && (
                    <span
                      className="text-[10px] text-[#059669] bg-[#059669]/10 px-1.5 py-0.5 rounded-full ml-1"
                      style={{ fontWeight: 600 }}
                    >
                      Auto
                    </span>
                  )}
                </label>
                <button
                  onClick={() => {
                    setShowMunicipioDD(!showMunicipioDD);
                    setShowTipoDD(false);
                    setShowColoniaDD(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-left"
                  style={{
                    background: "#FFFFFF",
                    border: municipio
                      ? "1.5px solid rgba(5,150,105,0.3)"
                      : "1px solid #D1D1D6",
                  }}
                >
                  <span
                    className={`text-[15px] ${municipio ? "text-[#1C1C1E]" : "text-[#C7C7CC]"}`}
                    style={{
                      fontWeight: municipio ? 500 : 400,
                    }}
                  >
                    {municipio || "Seleccionar municipio..."}
                  </span>
                  <ChevronDown
                    className="w-4 h-4 text-[#8E8E93]"
                    strokeWidth={2}
                  />
                </button>
                {showMunicipioDD && (
                  <div
                    className="mt-1 rounded-xl overflow-hidden border border-[#D1D1D6] max-h-48 overflow-y-auto"
                    style={{
                      background: "#FFFFFF",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                    }}
                  >
                    {MUNICIPIOS.map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setMunicipio(m);
                          setShowMunicipioDD(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[15px] active:bg-[#F2F2F7] transition-colors"
                        style={{
                          borderBottom: "0.5px solid #F2F2F7",
                          background:
                            municipio === m
                              ? "rgba(171,23,56,0.04)"
                              : "transparent",
                          fontWeight:
                            municipio === m ? 600 : 400,
                          color:
                            municipio === m
                              ? "#AB1738"
                              : "#1C1C1E",
                        }}
                      >
                        {municipio === m && (
                          <CheckCircle2
                            className="w-3.5 h-3.5 text-[#AB1738] shrink-0"
                            strokeWidth={2}
                          />
                        )}
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* STEP 4: Calle y Número */}
              <div>
                <label
                  className="text-[12px] text-[#636366] mb-1 flex items-center gap-1"
                  style={{ fontWeight: 700 }}
                >
                  <span
                    className="w-4 h-4 rounded-full bg-[#AB1738] text-white text-[10px] flex items-center justify-center"
                    style={{ fontWeight: 700 }}
                  >
                    4
                  </span>
                  Calle y Número
                </label>
                <div className="relative mb-2">
                  <MapPin
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7C7CC]"
                    strokeWidth={1.8}
                  />
                  <input
                    value={calle}
                    onChange={(e) => setCalle(e.target.value)}
                    placeholder="Nombre de la calle o avenida"
                    className="w-full pl-9 pr-3 py-3 rounded-xl text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none focus:ring-2 focus:ring-[#AB1738]/20"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #D1D1D6",
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Hash
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C7C7CC]"
                      strokeWidth={1.8}
                    />
                    <input
                      value={numExterior}
                      onChange={(e) =>
                        setNumExterior(e.target.value)
                      }
                      placeholder="Núm. Ext."
                      className="w-full pl-8 pr-2 py-2.5 rounded-lg text-[14px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none focus:ring-2 focus:ring-[#AB1738]/20"
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #D1D1D6",
                      }}
                    />
                  </div>
                  <div className="flex-1 relative">
                    <Building2
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C7C7CC]"
                      strokeWidth={1.8}
                    />
                    <input
                      value={numInterior}
                      onChange={(e) =>
                        setNumInterior(e.target.value)
                      }
                      placeholder="Int. (opcional)"
                      className="w-full pl-8 pr-2 py-2.5 rounded-lg text-[14px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none focus:ring-2 focus:ring-[#AB1738]/20"
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #D1D1D6",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* STEP 5: Referencias */}
              <div>
                <label
                  className="text-[12px] text-[#636366] mb-1 flex items-center gap-1"
                  style={{ fontWeight: 700 }}
                >
                  <span
                    className="w-4 h-4 rounded-full bg-[#BC955B] text-white text-[10px] flex items-center justify-center"
                    style={{ fontWeight: 700 }}
                  >
                    5
                  </span>
                  Entre calles / Referencias
                  <span className="text-[10px] text-[#8E8E93] ml-0.5">
                    (opcional)
                  </span>
                </label>
                <textarea
                  value={referencias}
                  onChange={(e) =>
                    setReferencias(e.target.value)
                  }
                  placeholder="Ej: Entre Calle 8 y Calle 10, frente a la escuela primaria"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl text-[14px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none resize-none focus:ring-2 focus:ring-[#AB1738]/20"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D1D1D6",
                  }}
                />
              </div>

              {/* Composed address preview */}
              {composedPreview && (
                <div className="pt-2 border-t border-[#E5E5EA]">
                  <p
                    className="text-[12px] text-[#636366]"
                    style={{ lineHeight: 1.5 }}
                  >
                    <span
                      className="text-[#AB1738]"
                      style={{ fontWeight: 700 }}
                    >
                      Dirección:{" "}
                    </span>
                    {composedPreview}
                    {municipio
                      ? `, ${municipio}, Tamaulipas`
                      : ""}
                  </p>
                </div>
              )}
            </div>

            {/* ─── "Buscar dirección" button: geocode from whatever fields the user filled ─── */}
            {canGeocode && (
              <button
                onClick={geocodeAddress}
                disabled={geoSearchLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl mt-3 active:scale-[0.97] transition-all disabled:opacity-60"
                style={{
                  background:
                    gpsSource === "search"
                      ? "rgba(5,150,105,0.06)"
                      : "linear-gradient(135deg, #AB1738, #8B1028)",
                  border:
                    gpsSource === "search"
                      ? "1.5px solid rgba(5,150,105,0.2)"
                      : "none",
                  color:
                    gpsSource === "search"
                      ? "#059669"
                      : "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "15px",
                  boxShadow:
                    gpsSource === "search"
                      ? "none"
                      : "0 2px 8px rgba(171,23,56,0.25)",
                }}
              >
                {geoSearchLoading ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      strokeWidth={2}
                    />
                    Buscando dirección...
                  </>
                ) : gpsSource === "search" ? (
                  <>
                    <CheckCircle2
                      className="w-4 h-4"
                      strokeWidth={2}
                    />
                    Dirección localizada — Buscar de nuevo
                  </>
                ) : (
                  <>
                    <MapPin
                      className="w-5 h-5"
                      strokeWidth={2}
                    />
                    Buscar dirección
                  </>
                )}
              </button>
            )}

            {/* Mini Map Preview — tappable to open map picker to adjust */}
            {hasPreview &&
              (gpsSource === "gps" ||
                gpsSource === "search" ||
                gpsSource === "pin") && (
                <div className="mt-3">
                  <MiniMapPreview
                    lat={lat!}
                    lng={lng!}
                    onTap={openMapPicker}
                    label={
                      gpsSource === "gps"
                        ? "Ubicación GPS del dispositivo"
                        : gpsSource === "search"
                          ? composedPreview +
                            (municipio ? `, ${municipio}` : "")
                          : gpsSource === "pin"
                            ? "Pin colocado manualmente en el mapa"
                            : `Centro de ${municipio}`
                    }
                  />
                </div>
              )}

            {/* Secondary: "Ajustar pin" or "Colocar pin manualmente" */}
            {(gpsSource === "search" || gpsSource === "gps") &&
              hasPreview && (
                <button
                  onClick={openMapPicker}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl mt-2 active:scale-[0.97] transition-all"
                  style={{
                    background: "rgba(139,92,246,0.05)",
                    border: "1.5px solid rgba(139,92,246,0.15)",
                    color: "#7C3AED",
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                >
                  <LocateFixed
                    className="w-4 h-4"
                    strokeWidth={2}
                  />
                  ¿No es exacta? Ajustar pin en el mapa
                </button>
              )}

            {/* When no coords at all and no geocode possible, show map picker button */}
            {!hasPreview && !canGeocode && (
              <button
                onClick={openMapPicker}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl mt-3 active:scale-[0.98] transition-all"
                style={{
                  background:
                    "linear-gradient(135deg, #3B82F6, #2563EB)",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "15px",
                  boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
                }}
              >
                <MapPin className="w-4 h-4" strokeWidth={2} />
                Seleccionar ubicación en mapa
              </button>
            )}
          </div>

          {/* Descripción */}
          <div>
            <label
              className="text-[13px] text-[#636366] mb-1.5 block"
              style={{ fontWeight: 600 }}
            >
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describa la situación en campo..."
              rows={3}
              className="w-full px-3 py-3 rounded-xl text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none resize-none"
              style={{
                background: "#F2F2F7",
                border: "1px solid #E5E5EA",
              }}
            />
            <AudioRecorder911
              values={audioNotes}
              onChange={setAudioNotes}
              maxNotes={6}
            />
          </div>

          {/* Prioridad */}
          <div>
            <label
              className="text-[13px] text-[#636366] mb-1.5 block"
              style={{ fontWeight: 600 }}
            >
              Prioridad
            </label>
            <div className="flex gap-2">
              {PRIORIDADES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPrioridad(p.value)}
                  className="flex-1 py-2.5 rounded-xl text-[14px] transition-all"
                  style={{
                    background:
                      prioridad === p.value ? p.bg : "#F2F2F7",
                    border: `1.5px solid ${prioridad === p.value ? p.border : "#E5E5EA"}`,
                    color:
                      prioridad === p.value
                        ? p.color
                        : "#8E8E93",
                    fontWeight:
                      prioridad === p.value ? 700 : 500,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Evidencia */}
          <div>
            <label
              className="text-[13px] text-[#636366] mb-1.5 block"
              style={{ fontWeight: 600 }}
            >
              Evidencia Fotográfica
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
              accept="image/*"
              multiple
            />
            {imageDataUrls.length === 0 ? (
              <button
                onClick={() => !compressingImage && fileInputRef.current?.click()}
                disabled={compressingImage}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl transition-opacity"
                style={{
                  background: "#F2F2F7",
                  border: "1.5px dashed #C7C7CC",
                  opacity: compressingImage ? 0.6 : 1,
                }}
              >
                {compressingImage ? (
                  <Loader2 className="w-5 h-5 text-[#8E8E93] animate-spin" strokeWidth={2} />
                ) : (
                  <Camera className="w-5 h-5 text-[#8E8E93]" strokeWidth={1.8} />
                )}
                <span
                  className="text-[14px] text-[#8E8E93]"
                  style={{ fontWeight: 500 }}
                >
                  {compressingImage ? "Procesando imagen…" : "Tomar foto o seleccionar imagen"}
                </span>
              </button>
            ) : (
              <div
                className="rounded-xl overflow-hidden border border-[#E5E5EA]"
                style={{ background: "#F9F9FB" }}
              >
                <div className="grid grid-cols-2 gap-2 p-2.5">
                  {imageDataUrls.map((src, idx) => (
                    <div
                      key={`photo-${idx}`}
                      className="relative rounded-lg overflow-hidden border border-[#E5E5EA]"
                    >
                      <img
                        src={src}
                        alt={`Preview ${idx + 1}`}
                        className="w-full h-28 object-cover"
                      />
                      <button
                        onClick={() => removeImageAt(idx)}
                        className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-1 rounded-md active:opacity-60"
                        style={{ background: "rgba(0,0,0,0.55)" }}
                        aria-label={`Quitar imagen ${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-3 pb-3 pt-1">
                  <span className="flex items-center gap-1.5 text-[13px] text-[#636366]">
                    <ImageIcon className="w-4 h-4" strokeWidth={1.8} />
                    {imageDataUrls.length} / {MAX_REPORT_IMAGES} imágenes
                  </span>
                  <button
                    onClick={() => !compressingImage && fileInputRef.current?.click()}
                    disabled={compressingImage || imageDataUrls.length >= MAX_REPORT_IMAGES}
                    className="px-2.5 py-1.5 rounded-lg text-[12px] active:opacity-60 transition-opacity disabled:opacity-40"
                    style={{
                      background: "rgba(171,23,56,0.08)",
                      color: "#AB1738",
                      fontWeight: 700,
                    }}
                  >
                    {imageDataUrls.length >= MAX_REPORT_IMAGES
                      ? "Límite alcanzado"
                      : "Agregar más"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reportado por */}
          <div>
            <label
              className="text-[13px] text-[#636366] mb-1.5 block"
              style={{ fontWeight: 600 }}
            >
              Reportado por
            </label>
            <input
              value={reportadoPor}
              onChange={(e) => setReportadoPor(e.target.value)}
              placeholder="Nombre del personal en campo"
              className="w-full px-3 py-3 rounded-xl text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none"
              style={{
                background: "#F2F2F7",
                border: "1px solid #E5E5EA",
              }}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white active:scale-[0.97] transition-all disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, #AB1738, #8B1028)",
              fontWeight: 700,
              fontSize: "16px",
              boxShadow:
                "0 2px 8px rgba(171,23,56,0.2), 0 8px 24px rgba(171,23,56,0.15)",
            }}
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                Enviando...
              </>
            ) : sent ? (
              <>
                <CheckCircle2
                  className="w-5 h-5"
                  strokeWidth={2}
                />{" "}
                ¡Reporte Enviado!
              </>
            ) : (
              <>
                <Send className="w-5 h-5" strokeWidth={2} />{" "}
                Enviar Reporte
              </>
            )}
          </button>

          {sent && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl"
              style={{
                background: "rgba(5,150,105,0.06)",
                border: "1px solid rgba(5,150,105,0.15)",
              }}
            >
              <CheckCircle2
                className="w-4 h-4 text-[#059669] shrink-0 mt-0.5"
                strokeWidth={2}
              />
              <p
                className="text-[13px] text-[#059669]"
                style={{ lineHeight: 1.4 }}
              >
                Reporte enviado exitosamente. Ya está disponible
                en el feed del Coordinador Regional.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Historial ═══ */}
      {history.length > 0 && (
        <div className="mx-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3
              className="text-[15px] text-[#1C1C1E]"
              style={{ fontWeight: 600 }}
            >
              Historial de Envíos
            </h3>
            <div className="flex-1 h-px bg-[#E5E5EA]" />
            <span className="text-[13px] text-[#8E8E93] tabular-nums">
              {history.length}
            </span>
          </div>
          <div className="space-y-2">
            {history.map((r, idx) => {
              const tipo = TIPOS_EMERGENCIA.find(
                (t) => t.value === r.tipoEmergencia,
              );
              const diffMin = Math.floor(
                (Date.now() - r.sentAt) / 60000,
              );
              const timeLabel =
                diffMin < 1
                  ? "Ahora"
                  : diffMin < 60
                    ? `Hace ${diffMin} min`
                    : `Hace ${Math.floor(diffMin / 60)} hr`;
              const prioColor =
                r.prioridad === "alta"
                  ? "#DC2626"
                  : r.prioridad === "media"
                    ? "#F59E0B"
                    : "#059669";
              const firstHistoryImage =
                (Array.isArray((r as { imageDataUrls?: string[] }).imageDataUrls)
                  ? (r as { imageDataUrls?: string[] }).imageDataUrls?.[0]
                  : undefined) || r.imageDataUrl || null;
              return (
                <div
                  key={`${r.id}-${idx}`}
                  className="rounded-xl p-3.5"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E5EA",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    {firstHistoryImage ? (
                      <img
                        src={firstHistoryImage}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                        style={{ border: "1px solid #E5E5EA" }}
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: tipo?.color
                            ? `${tipo.color}15`
                            : "#F2F2F7",
                        }}
                      >
                        {tipo ? (
                          <tipo.icon
                            className="w-5 h-5"
                            style={{ color: tipo.color }}
                            strokeWidth={2}
                          />
                        ) : (
                          <AlertTriangle
                            className="w-5 h-5 text-[#8E8E93]"
                            strokeWidth={2}
                          />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: prioColor }}
                        />
                        <span
                          className="text-[15px] text-[#1C1C1E] truncate"
                          style={{ fontWeight: 600 }}
                        >
                          {r.tipoEmergencia}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[13px] text-[#8E8E93] mb-1">
                        <MapPin
                          className="w-3 h-3 shrink-0"
                          strokeWidth={1.8}
                        />
                        <span className="truncate">
                          {r.ubicacion}, {r.municipio}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] text-[#8E8E93] flex items-center gap-1">
                          <Clock
                            className="w-3 h-3"
                            strokeWidth={1.8}
                          />
                          {timeLabel}
                        </span>
                        {r.lat != null && r.lng != null && (
                          <span className="text-[11px] text-[#059669] flex items-center gap-0.5">
                            <Navigation
                              className="w-2.5 h-2.5"
                              strokeWidth={2}
                            />{" "}
                            GPS
                          </span>
                        )}
                        <span
                          className="text-[12px] text-[#059669] flex items-center gap-1 bg-[#059669]/8 px-1.5 py-0.5 rounded"
                          style={{ fontWeight: 600 }}
                        >
                          <CheckCircle2
                            className="w-3 h-3"
                            strokeWidth={2}
                          />{" "}
                          Enviado
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-[#8E8E93] bg-[#F2F2F7] px-2 py-0.5 rounded tabular-nums shrink-0">
                      {r.folio}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PullToRefresh>
  );
}
