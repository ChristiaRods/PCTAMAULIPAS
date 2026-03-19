import { AppHeader } from "./AppHeader";
import { MapPin, Clock, Camera, Image, Plus, Check, AlertTriangle, X, Eye } from "lucide-react";
import { useState } from "react";
import { useParams } from "./RouterContext";
import { toast, Toaster } from "sonner";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { ImageLightbox, type LightboxData } from "./ImageLightbox";

const eventImages = [
  { url: "https://images.unsplash.com/photo-1764314660558-bf38b53e007d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGZpcmUlMjBzbW9rZSUyMHVyYmFuJTIwZW1lcmdlbmN5fGVufDF8fHx8MTc3MjczMjA5MHww&ixlib=rb-4.1.0&q=80&w=1080", label: "Fachada con humo visible" },
  { url: "https://images.unsplash.com/photo-1764231503535-0b19196e324c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXJlZmlnaHRlciUyMHJlc2N1ZSUyMHRlYW0lMjBvcGVyYXRpb258ZW58MXx8fHwxNzcyNzMyMDkwfDA&ixlib=rb-4.1.0&q=80&w=1080", label: "Equipo de respuesta en zona" },
  { url: "https://images.unsplash.com/photo-1768685318695-13499e5412c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbWVyZ2VuY3klMjByZXNwb25kZXIlMjBmaXJlJTIwcmVzY3VlfGVufDF8fHx8MTc3MjY2MzgxMXww&ixlib=rb-4.1.0&q=80&w=1080", label: "Atención del incidente" },
];

export function ReportDetail() {
  const { id } = useParams();
  const [status, setStatus] = useState("En Proceso");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [lightboxData, setLightboxData] = useState<LightboxData | null>(null);
  const [activities] = useState([
    { type: "Inspección Visual", desc: "Se realizó evaluación preliminar del área", time: "14:32" },
  ]);

  const statuses = [
    { label: "En atención", icon: Eye, color: "bg-green-500" },
    { label: "Atendido", icon: Check, color: "bg-gray-500" },
    { label: "Falso reporte", icon: X, color: "bg-red-500" },
    { label: "No localizado", icon: AlertTriangle, color: "bg-amber-500" },
  ];

  const openLightbox = (startIndex: number) => {
    setLightboxData({
      images: eventImages.map(img => img.url),
      title: `Reporte ${id || "911-2026-0147"}`,
      timestamp: "04/03/2026, 14:20 hrs",
      description: "Se reporta humo saliendo de edificio de 2 pisos en esquina",
      startIndex,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-48">
      <Toaster position="top-center" />
      <AppHeader title={`Reporte ${id || "911-2026-0147"}`} />

      {/* Incident info */}
      <div
        className="mx-4 mt-4 rounded-2xl p-4 space-y-3"
        style={{
          background: "var(--glass-bg-heavy)",
          boxShadow: "var(--shadow-card), var(--glass-highlight)",
          border: "0.5px solid var(--glass-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-primary/80 bg-primary/6 px-2.5 py-0.5 rounded-md tabular-nums">{id || "911-2026-0147"}</span>
          <span className="text-[13px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md">{status}</span>
        </div>
        <div className="rounded-xl p-4 space-y-2.5" style={{ background: "var(--input-background)" }}>
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground/60">
            <Eye className="w-4 h-4" strokeWidth={2} /> Solo lectura — Datos del incidente
          </div>
          <p className="text-[15px] text-foreground"><span className="text-muted-foreground">Tipo:</span> Incendio Estructural</p>
          <p className="text-[15px] text-foreground"><span className="text-muted-foreground">Descripción:</span> Se reporta humo saliendo de edificio de 2 pisos en esquina</p>
          <p className="text-[14px] text-muted-foreground flex items-center gap-1.5"><MapPin className="w-4 h-4" strokeWidth={1.8} />Col. Centro, Ciudad Victoria</p>
          <p className="text-[14px] text-muted-foreground flex items-center gap-1.5"><Clock className="w-4 h-4" strokeWidth={1.8} />04/03/2026, 14:20 hrs</p>
        </div>
      </div>

      {/* Activities */}
      <div className="mx-4 mt-5 space-y-2.5">
        <h3 className="text-[15px] text-muted-foreground px-1">Actividades Registradas</h3>
        {activities.map((act, i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{
              background: "var(--glass-bg-heavy)",
              boxShadow: "var(--glass-shadow), var(--glass-highlight)",
              border: "0.5px solid var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[15px] text-primary">{act.type}</span>
              <span className="text-[13px] text-muted-foreground/60">{act.time}</span>
            </div>
            <p className="text-[14px] text-muted-foreground">{act.desc}</p>
          </div>
        ))}
      </div>

      {/* Evidence gallery — social media style */}
      <div className="mx-4 mt-5 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[15px] text-muted-foreground">Evidencias del Evento</h3>
          <span className="text-[13px] text-muted-foreground/60">{eventImages.length} fotos</span>
        </div>
        {/* Hero image */}
        <div 
          className="relative rounded-xl overflow-hidden border border-[#E5E5EA] cursor-pointer"
          onClick={() => openLightbox(0)}
        >
          <ImageWithFallback
            src={eventImages[0].url}
            alt={eventImages[0].label}
            className="w-full h-52 object-cover"
          />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2.5">
            <p className="text-[13px] text-white">{eventImages[0].label}</p>
          </div>
        </div>
        {/* Grid 2-up */}
        <div className="grid grid-cols-2 gap-2">
          {eventImages.slice(1).map((img, i) => (
            <div 
              key={i} 
              className="relative rounded-xl overflow-hidden border border-[#E5E5EA] aspect-[4/3] cursor-pointer"
              onClick={() => openLightbox(i + 1)}
            >
              <ImageWithFallback
                src={img.url}
                alt={img.label}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 py-2">
                <p className="text-[12px] text-white">{img.label}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Add more */}
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-[#D1D1D6]">
            <Camera className="w-4 h-4 text-[#636366]" strokeWidth={1.8} />
            <span className="text-[14px] text-[#636366]">Tomar foto</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-[#D1D1D6]">
            <Image className="w-4 h-4 text-[#636366]" strokeWidth={1.8} />
            <span className="text-[14px] text-[#636366]">Galería</span>
          </button>
        </div>
      </div>

      {/* Status change modal */}
      {showStatusMenu && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)" }}>
          <div
            className="w-full rounded-t-[28px] p-5 pb-10 space-y-2.5"
            style={{
              background: "var(--glass-bg-ultra)",
              backdropFilter: "saturate(180%) blur(40px)",
              WebkitBackdropFilter: "saturate(180%) blur(40px)",
              boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.5), 0 -16px 48px rgba(0,0,0,0.1)",
            }}
          >
            <div className="w-9 h-1 rounded-full bg-foreground/15 mx-auto mb-3" />
            <h3 className="text-center text-[18px] mb-3 tracking-tight">Cambiar Estatus</h3>
            {statuses.map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  setStatus(s.label);
                  setShowStatusMenu(false);
                  toast.success(`Estatus actualizado a "${s.label}"`);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl active:bg-foreground/5 transition-colors"
                style={{
                  background: "var(--glass-bg)",
                  boxShadow: "var(--glass-shadow), var(--glass-highlight)",
                  border: "0.5px solid var(--glass-border)",
                }}
              >
                <div className={`w-10 h-10 rounded-[10px] ${s.color} flex items-center justify-center shadow-sm`}>
                  <s.icon className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <span className="text-[16px]">{s.label}</span>
              </button>
            ))}
            <button onClick={() => setShowStatusMenu(false)} className="w-full p-3 text-center text-[16px] text-muted-foreground mt-1">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxData && (
        <ImageLightbox data={lightboxData} onClose={() => setLightboxData(null)} />
      )}

      {/* Bottom action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 pb-8 space-y-3 z-40"
        style={{
          background: "rgba(242, 241, 239, 0.85)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.4), 0 -8px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex gap-2.5">
          {[
            { icon: Plus, label: "Actividad", action: () => toast.success("Actividad agregada") },
            { icon: Camera, label: "Cámara", action: () => {} },
            { icon: Image, label: "Galería", action: () => {} },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-xl active:scale-95 transition-transform"
              style={{
                background: "var(--glass-bg-heavy)",
                boxShadow: "var(--glass-shadow), var(--glass-highlight)",
                border: "0.5px solid var(--glass-border)",
              }}
            >
              <btn.icon className="w-5 h-5 text-primary" strokeWidth={1.8} />
              <span className="text-[14px] text-primary">{btn.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowStatusMenu(true)}
          className="w-full py-4 rounded-xl bg-primary text-white text-[16px] active:scale-[0.97] transition-transform"
          style={{ boxShadow: "0 2px 8px rgba(171,23,56,0.2), 0 8px 24px rgba(171,23,56,0.15)" }}
        >
          Cambiar Estatus
        </button>
      </div>
    </div>
  );
}