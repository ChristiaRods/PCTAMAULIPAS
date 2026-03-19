import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Share, Navigation, Copy, X } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type MapLayer = "map" | "hybrid" | "satellite";

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  coords: { lat: number; lng: number };
  address: string;
  municipio: string;
}

const TILE_URLS: Record<MapLayer, { url: string; attribution: string }> = {
  map: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  hybrid: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
  },
};

/* ─── Popup card with glassmorphism ─── */
function buildPopupHTML(address: string, municipio: string): string {
  return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;min-width:220px;max-width:300px;font-family:'Encode Sans',system-ui,sans-serif;">
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:2px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#1C1C1E;display:flex;align-items:center;justify-content:center;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z"/>
            <circle cx="7.5" cy="14.5" r="1.5"/>
            <circle cx="16.5" cy="14.5" r="1.5"/>
          </svg>
        </div>
        <span style="font-size:10px;color:#54565B;">Ruta</span>
      </div>
      <div style="flex:1;min-width:0;">
        <p style="font-size:14px;color:#1C1C1E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;">${address}</p>
        <p style="font-size:12px;color:#54565B;margin:2px 0 0;">${municipio}, Tamps.</p>
      </div>
    </div>
  `;
}

export function MapModal({ isOpen, onClose, coords, address, municipio }: MapModalProps) {
  const [activeLayer, setActiveLayer] = useState<MapLayer>("map");
  const [showShareSheet, setShowShareSheet] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  // Stable ref for onClose to avoid effect re-runs
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ★ Push browser history entry so native swipe-back closes the modal
  //   instead of leaving the page entirely
  useEffect(() => {
    if (!isOpen) return;

    // Push a "map-modal" state so the browser has something to "go back" to
    window.history.pushState({ mapModal: true }, "");

    const handlePopState = () => {
      // Browser back (native swipe or button) → just close the modal
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // If the modal is closing NOT via popstate (e.g. tapping the X/back button),
      // we need to remove the history entry we pushed
      if (window.history.state?.mapModal) {
        window.history.back();
      }
    };
  }, [isOpen]);

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });

    // Custom pin icon — small red dot like Apple Maps
    const pinIcon = L.divIcon({
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -14],
      html: `
        <div style="width:18px;height:18px;border-radius:50%;background:#AB1738;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>
      `,
    });

    const tile = L.tileLayer(TILE_URLS.map.url, {
      attribution: TILE_URLS.map.attribution,
    }).addTo(map);

    const marker = L.marker([coords.lat, coords.lng], { icon: pinIcon }).addTo(map);

    const popup = L.popup({
      offset: [0, -2],
      autoPan: false,
      closeButton: false,
      closeOnClick: false,
      autoClose: false,
      className: "custom-leaflet-popup",
    })
      .setContent(buildPopupHTML(address, municipio));

    marker.bindPopup(popup).openPopup();

    tileRef.current = tile;
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
  }, [isOpen]);

  // Switch tile layers
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    const { url } = TILE_URLS[activeLayer];
    tileRef.current.setUrl(url);
    mapRef.current.attributionControl.setPrefix("");
  }, [activeLayer]);

  if (!isOpen) return null;

  const coordsText = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;

  return (
    <div data-no-swipe className="fixed inset-0 z-[9999] flex flex-col bg-black">
      {/* ─── Leaflet popup & control styles ─── */}
      <style>{`
        .custom-leaflet-popup .leaflet-popup-content-wrapper {
          border-radius: 14px !important;
          padding: 0 !important;
          background: rgba(255,255,255,0.55) !important;
          backdrop-filter: blur(24px) saturate(1.8) !important;
          -webkit-backdrop-filter: blur(24px) saturate(1.8) !important;
          border: 1px solid rgba(255,255,255,0.5) !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6) !important;
          overflow: visible;
        }
        .custom-leaflet-popup .leaflet-popup-content {
          margin: 0 !important;
          min-width: 220px !important;
          background: transparent !important;
        }
        .custom-leaflet-popup .leaflet-popup-tip-container {
          overflow: visible !important;
        }
        .custom-leaflet-popup .leaflet-popup-tip {
          background: rgba(255,255,255,0.55) !important;
          backdrop-filter: blur(24px) !important;
          -webkit-backdrop-filter: blur(24px) !important;
          box-shadow: none !important;
          border: 1px solid rgba(255,255,255,0.5) !important;
          border-top: none !important;
          border-left: none !important;
        }
        .custom-leaflet-popup .leaflet-popup-close-button { display: none !important; }
        .leaflet-control-attribution {
          font-size: 9px !important;
          background: rgba(255,255,255,0.55) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
        }
        .leaflet-control-zoom a {
          background: rgba(255,255,255,0.75) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          color: #1C1C1E !important;
          border-color: rgba(0,0,0,0.1) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(255,255,255,0.9) !important;
        }
      `}</style>

      {/* ─── Header — glassmorphism, overlaid on map ─── */}
      <div
        className="absolute top-0 left-0 right-0 z-[10000] flex items-center gap-3 px-4 pb-3 border-b border-white/20"
        style={{
          paddingTop: "calc(max(env(safe-area-inset-top), 12px) + 8px)",
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(20px) saturate(1.8)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        }}
      >
        <button
          onClick={onClose}
          className="shrink-0 flex items-center justify-center rounded-full active:bg-black/5 transition-colors -ml-1"
          style={{ width: 44, height: 44 }}
        >
          <ChevronLeft className="w-6 h-6 text-[#1C1C1E]" strokeWidth={2.2} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[16px] text-[#1C1C1E] truncate">{address}</p>
          <p className="text-[12px] text-[#54565B]">{municipio}, Tamaulipas</p>
        </div>
        <div className="w-9 shrink-0" />
      </div>

      {/* ─── Leaflet Map (full screen behind header/footer) ─── */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* ─── Bottom bar — glassmorphism ─── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[10000] px-4 border-t border-white/20"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(20px) saturate(1.8)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        }}
      >
        {/* Coordinates row */}
        <div className="flex items-center gap-2 py-2.5 border-b border-black/8">
          <Navigation className="w-4 h-4 text-[#54565B]" strokeWidth={1.8} />
          <span className="text-[13px] text-[#54565B] tabular-nums flex-1">{coordsText}</span>
          <button
            className="flex items-center gap-1 text-[13px] text-[#BC955B] active:opacity-50 transition-opacity"
            onClick={() => navigator.clipboard?.writeText(coordsText)}
          >
            <Copy className="w-3.5 h-3.5" strokeWidth={2} />
            Copiar
          </button>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between py-3">
          {/* Share button */}
          <button
            onClick={() => setShowShareSheet(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5 transition-colors"
          >
            <Share className="w-5 h-5 text-[#1C1C1E]" strokeWidth={1.8} />
          </button>

          {/* Segmented control */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{
              background: "rgba(0,0,0,0.06)",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            {(["map", "hybrid", "satellite"] as MapLayer[]).map((layer) => (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                className={`px-4 py-1.5 text-[13px] transition-colors ${
                  activeLayer === layer
                    ? "bg-white text-[#1C1C1E] shadow-sm"
                    : "text-[#54565B] active:bg-black/5"
                }`}
              >
                {layer === "map" ? "Mapa" : layer === "hybrid" ? "Híbrido" : "Satélite"}
              </button>
            ))}
          </div>

          {/* Spacer to balance layout (search removed) */}
          <div className="w-10" />
        </div>
      </div>

      {/* ─── Share Action Sheet ─── */}
      {showShareSheet && (
        <div className="absolute inset-0 z-[10001] flex items-end">
          {/* Dark overlay */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowShareSheet(false)}
          />
          {/* Sheet */}
          <div
            className="relative w-full rounded-t-2xl overflow-hidden"
            style={{
              background: "#F2F2F7",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3">
              <div className="w-[30px]" />
              <span className="text-[17px] text-[#1C1C1E]" style={{ fontWeight: 600 }}>Selecciona una acción</span>
              <button
                onClick={() => setShowShareSheet(false)}
                className="w-[30px] h-[30px] rounded-full bg-[#E5E5EA] flex items-center justify-center active:bg-[#D1D1D6] transition-colors"
              >
                <X className="w-[14px] h-[14px] text-[#3C3C43]" strokeWidth={2.5} />
              </button>
            </div>

            {/* Options card */}
            <div className="mx-4 mb-4 rounded-xl bg-white overflow-hidden">
              {/* Option: Abrir en Mapas */}
              <button
                className="w-full text-left px-4 py-3.5 active:bg-[#E5E5EA] transition-colors"
                onClick={() => {
                  window.open(`https://maps.apple.com/?ll=${coords.lat},${coords.lng}&q=${encodeURIComponent(address)}`, "_blank");
                  setShowShareSheet(false);
                }}
              >
                <span className="text-[16px] text-[#1C1C1E]">Abrir en Mapas</span>
              </button>

              {/* Divider */}
              <div className="mx-4 h-px bg-[#E5E5EA]" />

              {/* Option: Abrir en Google Maps */}
              <button
                className="w-full text-left px-4 py-3.5 active:bg-[#E5E5EA] transition-colors"
                onClick={() => {
                  window.open(`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`, "_blank");
                  setShowShareSheet(false);
                }}
              >
                <span className="text-[16px] text-[#1C1C1E]">Abrir en Google Maps</span>
              </button>
            </div>

            {/* Safe area bottom padding */}
            <div style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }} />
          </div>
        </div>
      )}
    </div>
  );
}