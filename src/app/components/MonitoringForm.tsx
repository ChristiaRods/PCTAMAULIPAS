import { AppHeader } from "./AppHeader";
import React, { useState, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Thermometer,
  Flame,
  Droplets,
  Save,
  ClipboardList,
  MapPin,
  Users,
  Home,
  FileText,
  Check,
  Clock,
  AlertCircle,
  Camera,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { useNavigate } from "./RouterContext";
import { createMonitoring, saveMonitoring } from "./monitoringStore";

/* ───────── Glass card style helper ───────── */
const glassCard = {
  background: "var(--glass-bg-heavy)",
  boxShadow: "var(--shadow-card), var(--glass-highlight)",
  border: "0.5px solid var(--glass-border)",
} as const;

/* ───────── Stepper Component ───────── */
function NumericStepper({
  label,
  value,
  onChange,
  icon: Icon,
  color = "bg-primary/8 text-primary",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  icon?: React.ElementType;
  color?: string;
}) {
  return (
    <div className="rounded-xl p-3 flex flex-col items-center gap-2" style={glassCard}>
      {Icon && (
        <div className={`w-8 h-8 rounded-[8px] ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4" strokeWidth={1.8} />
        </div>
      )}
      <span className="text-[13px] text-center text-muted-foreground leading-tight">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: "var(--input-background)" }}
        >
          <Minus className="w-5 h-5 text-foreground" strokeWidth={2} />
        </button>
        <span className="w-9 text-center text-xl tabular-nums">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-sm"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/* ───────── Section Wrapper ───────── */
function FormSection({
  title,
  icon: Icon,
  children,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="mx-4 mb-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-[8px] bg-primary/8 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" strokeWidth={2} />
        </div>
        <h2 className="text-[15px] text-foreground flex-1 tracking-tight">{title}</h2>
        {badge && (
          <span className="text-[13px] text-secondary/80 bg-secondary/8 px-2 py-0.5 rounded-md">{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ───────── Accordion ───────── */
function AccordionSection({
  title,
  icon: Icon,
  color,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={glassCard}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3.5 active:bg-foreground/3 transition-colors"
      >
        <div className={`w-9 h-9 rounded-[10px] ${color} flex items-center justify-center shadow-sm`}>
          <Icon className="w-4.5 h-4.5 text-white" strokeWidth={1.8} />
        </div>
        <span className="flex-1 text-left text-[15px] tracking-tight">{title}</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground/40" strokeWidth={2.5} />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground/40" strokeWidth={2.5} />
        )}
      </button>
      {isOpen && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-3" style={{ borderTop: "0.5px solid var(--border)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ───────── Input style helper ───────── */
const inputStyle = "w-full px-4 py-3 rounded-xl text-[15px]";
const inputBg = { background: "var(--input-background)", border: "none" } as const;

/* ───────── Main Form ───────── */
export function MonitoringForm() {
  const navigate = useNavigate();
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);

  const [tipoMonitoreo, setTipoMonitoreo] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [referencia, setReferencia] = useState("");

  const [vehiculos, setVehiculos] = useState(0);
  const [personal, setPersonal] = useState(0);
  const [atencionesPre, setAtencionesPre] = useState(0);
  const [traslados, setTraslados] = useState(0);
  const [rescateUrbano, setRescateUrbano] = useState(0);
  const [rescateAcuatico, setRescateAcuatico] = useState(0);
  const [rescateTerrestre, setRescateTerrestre] = useState(0);
  const [rescateAereo, setRescateAereo] = useState(0);
  const [lesionadas, setLesionadas] = useState(0);
  const [extraviadas, setExtraviadas] = useState(0);
  const [extraviadaLocalizada, setExtraviadaLocalizada] = useState(false);

  const [refugios, setRefugios] = useState(0);
  const [hombres, setHombres] = useState(0);
  const [mujeres, setMujeres] = useState(0);
  const [ninos, setNinos] = useState(0);
  const [ninas, setNinas] = useState(0);

  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [tempMin, setTempMin] = useState("");
  const [tempMax, setTempMax] = useState("");
  const [hectareas, setHectareas] = useState("");
  const [combustible, setCombustible] = useState("");
  const [colonias, setColonias] = useState("");
  const [mmEncharcamiento, setMmEncharcamiento] = useState("");

  const [observaciones, setObservaciones] = useState("");
  const [activities, setActivities] = useState<{ type: string; desc: string; time: string }[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [newActivityType, setNewActivityType] = useState("");
  const [newActivityDesc, setNewActivityDesc] = useState("");
  const [evidencias, setEvidencias] = useState<
    { kind: "image" | "pdf" | "audio" | "video"; name: string; src: string }[]
  >([]);
  const [saving, setSaving] = useState(false);

  const totalPersonas = useMemo(() => hombres + mujeres + ninos + ninas, [hombres, mujeres, ninos, ninas]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  const handleSave = async () => {
    if (activities.length === 0) {
      toast.error("Debes registrar al menos 1 actividad antes de guardar.");
      return;
    }
    if (evidencias.length === 0) {
      toast.error("Debes adjuntar al menos 1 evidencia antes de guardar.");
      return;
    }
    if (!tipoMonitoreo || !municipio || !localidad) {
      toast.error("Completa los campos obligatorios: Tipo, Municipio y Localidad.");
      return;
    }

    const payload = createMonitoring({
      tipoMonitoreo,
      subtipoMonitoreo: openAccordion || "Datos Generales",
      municipio,
      localidad,
      referencia,
      descripcionMonitoreo:
        observaciones ||
        [
          tempMin && tempMax ? `Temperatura ${tempMin}°C - ${tempMax}°C` : "",
          hectareas ? `Hectáreas: ${hectareas}` : "",
          colonias ? `Colonias: ${colonias}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      observaciones,
      estatus: "Activo",
      reportadoPor: "Operador de Campo - Monitoreo",
      actividades: activities,
      evidencias,
      conteoPersonas: {
        hombres,
        mujeres,
        ninos,
        ninas,
        noIdentificados: 0,
      },
      resumenOperativo: {
        vehiculos,
        personal,
        atencionesPre,
        traslados,
        rescateUrbano,
        rescateAcuatico,
        rescateTerrestre,
        rescateAereo,
        lesionadas,
        extraviadas,
        extraviadaLocalizada,
        refugios,
      },
      datosEspecificos: {
        tempMin,
        tempMax,
        hectareas,
        combustible,
        colonias,
        mmEncharcamiento,
      },
    });

    setSaving(true);
    const result = await saveMonitoring(payload);
    setSaving(false);

    if (result.success) {
      toast.success(`Monitoreo guardado: ${payload.folio}`);
      setTimeout(() => navigate("/monitoreo"), 400);
      return;
    }

    toast.warning(`Guardado local: ${payload.folio}. No se pudo sincronizar servidor.`);
  };

  const handleAddActivity = () => {
    if (!newActivityType.trim()) {
      toast.error("Selecciona un tipo de actividad.");
      return;
    }
    setActivities((prev) => [
      ...prev,
      { type: newActivityType, desc: newActivityDesc, time: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) },
    ]);
    setNewActivityType("");
    setNewActivityDesc("");
    setShowActivityModal(false);
    toast.success("Actividad registrada");
  };

  const handleEvidenceSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const selected = Array.from(files).slice(0, 4);
    const parsed = await Promise.all(
      selected.map(
        (file) =>
          new Promise<{ kind: "image" | "pdf" | "audio" | "video"; name: string; src: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const fileType = file.type || "";
              let kind: "image" | "pdf" | "audio" | "video" = "image";
              if (fileType.includes("pdf")) kind = "pdf";
              else if (fileType.includes("audio")) kind = "audio";
              else if (fileType.includes("video")) kind = "video";
              resolve({
                kind,
                name: file.name,
                src: typeof reader.result === "string" ? reader.result : "",
              });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );

    setEvidencias((prev) => [...prev, ...parsed].slice(0, 6));
    toast.success(`${parsed.length} evidencia(s) agregada(s)`);
  };

  const tiposMonitoreo = ["Incendio Forestal", "Semana Santa", "Temporada Lluvias", "Temporada Invernal", "Monitoreo Diario"];
  const tiposActividad = ["Inspección visual", "Evacuación preventiva", "Distribución de apoyo", "Verificación de refugio", "Patrullaje de zona", "Reporte a coordinación"];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <Toaster position="top-center" />
      <AppHeader title="Nuevo Monitoreo" />

      {/* Auto fields */}
      <div className="mx-4 mt-4 mb-5 rounded-xl p-4 flex items-center justify-between" style={glassCard}>
        <div>
          <p className="text-[11px] text-muted-foreground/60">Folio (al guardar)</p>
          <p className="text-[14px] text-primary tabular-nums">PC-2026-XXXX</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 justify-end"><Clock className="w-3 h-3" strokeWidth={1.8} />Fecha/Hora</p>
          <p className="text-[14px]">{dateStr} — {timeStr}</p>
        </div>
      </div>

      {/* SECCIÓN A */}
      <FormSection title="Contexto del Evento" icon={ClipboardList} badge="Sección A">
        <div className="rounded-xl p-4 space-y-4" style={glassCard}>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block">Tipo de Monitoreo *</label>
            <div className="relative">
              <select value={tipoMonitoreo} onChange={(e) => setTipoMonitoreo(e.target.value)} className={`${inputStyle} appearance-none pr-10`} style={inputBg}>
                <option value="">Seleccionar tipo...</option>
                {tiposMonitoreo.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block">Municipio *</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" strokeWidth={1.8} />
              <input type="text" placeholder="Ej: Ciudad Victoria" value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={`${inputStyle} pl-9`} style={inputBg} />
            </div>
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block">Localidad *</label>
            <input type="text" placeholder="Ej: Col. Mainero" value={localidad} onChange={(e) => setLocalidad(e.target.value)} className={inputStyle} style={inputBg} />
          </div>
          <div>
            <label className="text-[13px] text-muted-foreground mb-1.5 block">Lugar / Referencia</label>
            <input type="text" placeholder="Ej: Km 8 Carretera Nacional" value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputStyle} style={inputBg} />
          </div>
        </div>
      </FormSection>

      {/* SECCIÓN B */}
      <FormSection title="Registro Operativo" icon={Users} badge="Sección B">
        <div className="grid grid-cols-2 gap-2.5">
          <NumericStepper label="Vehículos" value={vehiculos} onChange={setVehiculos} color="bg-blue-500/10 text-blue-600" />
          <NumericStepper label="Personal" value={personal} onChange={setPersonal} color="bg-indigo-500/10 text-indigo-600" />
          <NumericStepper label="At. Prehospitalarias" value={atencionesPre} onChange={setAtencionesPre} color="bg-emerald-500/10 text-emerald-600" />
          <NumericStepper label="Traslados" value={traslados} onChange={setTraslados} color="bg-teal-500/10 text-teal-600" />
        </div>

        <div className="mt-3 rounded-xl p-3" style={glassCard}>
          <p className="text-[13px] text-muted-foreground/60 mb-2.5 px-0.5">Rescates por Tipo</p>
          <div className="grid grid-cols-2 gap-2.5">
            <NumericStepper label="Urbano" value={rescateUrbano} onChange={setRescateUrbano} color="bg-orange-500/10 text-orange-600" />
            <NumericStepper label="Acuático" value={rescateAcuatico} onChange={setRescateAcuatico} color="bg-cyan-500/10 text-cyan-600" />
            <NumericStepper label="Terrestre" value={rescateTerrestre} onChange={setRescateTerrestre} color="bg-amber-500/10 text-amber-600" />
            <NumericStepper label="Aéreo" value={rescateAereo} onChange={setRescateAereo} color="bg-sky-500/10 text-sky-600" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <NumericStepper label="Personas Lesionadas" value={lesionadas} onChange={setLesionadas} color="bg-red-500/10 text-red-600" />
          <div className="rounded-xl p-3 flex flex-col items-center gap-2" style={glassCard}>
            <div className="w-8 h-8 rounded-[8px] bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Users className="w-4 h-4" strokeWidth={1.8} />
            </div>
            <span className="text-[13px] text-center text-muted-foreground leading-tight">Extraviadas</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setExtraviadas(Math.max(0, extraviadas - 1))} className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-transform" style={{ background: "var(--input-background)" }}>
                <Minus className="w-4 h-4 text-foreground" strokeWidth={2} />
              </button>
              <span className="w-8 text-center text-lg tabular-nums">{extraviadas}</span>
              <button onClick={() => setExtraviadas(extraviadas + 1)} className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-sm">
                <Plus className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <label className="flex items-center gap-2 mt-0.5 cursor-pointer">
              <div
                onClick={() => setExtraviadaLocalizada(!extraviadaLocalizada)}
                className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                  extraviadaLocalizada ? "bg-green-500" : ""
                }`}
                style={extraviadaLocalizada ? {} : { background: "var(--input-background)" }}
              >
                {extraviadaLocalizada && <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />}
              </div>
              <span className="text-[13px] text-muted-foreground">Localizada</span>
            </label>
          </div>
        </div>
      </FormSection>

      {/* SECCIÓN C */}
      <FormSection title="Censo Poblacional y Refugios" icon={Home} badge="Sección C">
        <div className="rounded-xl p-4 mb-3" style={glassCard}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-primary/8 flex items-center justify-center">
              <Home className="w-5 h-5 text-primary" strokeWidth={1.8} />
            </div>
            <div className="flex-1"><p className="text-[14px] text-muted-foreground">Refugios Activados</p></div>
            <div className="flex items-center gap-2">
              <button onClick={() => setRefugios(Math.max(0, refugios - 1))} className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-transform" style={{ background: "var(--input-background)" }}>
                <Minus className="w-4 h-4" strokeWidth={2} />
              </button>
              <span className="w-8 text-center text-lg tabular-nums">{refugios}</span>
              <button onClick={() => setRefugios(refugios + 1)} className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center active:scale-90 transition-transform shadow-sm">
                <Plus className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4 space-y-3" style={glassCard}>
          <p className="text-[14px] text-muted-foreground">Censo de Personas</p>
          <div className="grid grid-cols-2 gap-2.5">
            <NumericStepper label="Hombres" value={hombres} onChange={setHombres} color="bg-blue-500/10 text-blue-600" />
            <NumericStepper label="Mujeres" value={mujeres} onChange={setMujeres} color="bg-pink-500/10 text-pink-600" />
            <NumericStepper label="Niños" value={ninos} onChange={setNinos} color="bg-sky-500/10 text-sky-600" />
            <NumericStepper label="Niñas" value={ninas} onChange={setNinas} color="bg-rose-500/10 text-rose-500" />
          </div>
          <div className="rounded-xl p-3.5 flex items-center justify-between" style={{ background: "var(--input-background)" }}>
            <span className="text-[14px] text-primary">Total Calculado</span>
            <span className="text-2xl text-primary tabular-nums">{totalPersonas}</span>
          </div>
        </div>
      </FormSection>

      {/* SECCIÓN D */}
      <FormSection title="Datos Específicos" icon={Thermometer} badge="Sección D">
        <div className="space-y-2.5">
          <AccordionSection title="Clima" icon={Thermometer} color="bg-cyan-500" isOpen={openAccordion === "clima"} onToggle={() => setOpenAccordion(openAccordion === "clima" ? null : "clima")}>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[13px] text-muted-foreground mb-1 block">Temp. Mín (°C)</label>
                <input type="number" placeholder="12" value={tempMin} onChange={(e) => setTempMin(e.target.value)} className={`${inputStyle} text-center`} style={inputBg} />
              </div>
              <div>
                <label className="text-[13px] text-muted-foreground mb-1 block">Temp. Máx (°C)</label>
                <input type="number" placeholder="34" value={tempMax} onChange={(e) => setTempMax(e.target.value)} className={`${inputStyle} text-center`} style={inputBg} />
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title="Incendios" icon={Flame} color="bg-orange-500" isOpen={openAccordion === "incendios"} onToggle={() => setOpenAccordion(openAccordion === "incendios" ? null : "incendios")}>
            <div>
              <label className="text-[13px] text-muted-foreground mb-1 block">Hectáreas Consumidas</label>
              <input type="number" placeholder="15.5" value={hectareas} onChange={(e) => setHectareas(e.target.value)} className={inputStyle} style={inputBg} />
            </div>
            <div>
              <label className="text-[13px] text-muted-foreground mb-1 block">Tipo de Combustible</label>
              <div className="relative">
                <select value={combustible} onChange={(e) => setCombustible(e.target.value)} className={`${inputStyle} appearance-none pr-10`} style={inputBg}>
                  <option value="">Seleccionar...</option>
                  <option value="Pastizal">Pastizal</option>
                  <option value="Hojarasca">Hojarasca</option>
                  <option value="Arbolado">Arbolado</option>
                  <option value="Matorral">Matorral</option>
                  <option value="Mixto">Mixto</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" strokeWidth={2.5} />
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title="Inundaciones" icon={Droplets} color="bg-blue-500" isOpen={openAccordion === "inundaciones"} onToggle={() => setOpenAccordion(openAccordion === "inundaciones" ? null : "inundaciones")}>
            <div>
              <label className="text-[13px] text-muted-foreground mb-1 block">Colonias Afectadas</label>
              <textarea placeholder="Col. Mainero, Col. Del Prado..." value={colonias} onChange={(e) => setColonias(e.target.value)} className={`${inputStyle} resize-none`} style={inputBg} rows={2} />
            </div>
            <div>
              <label className="text-[13px] text-muted-foreground mb-1 block">mm de Encharcamiento</label>
              <input type="number" placeholder="150" value={mmEncharcamiento} onChange={(e) => setMmEncharcamiento(e.target.value)} className={inputStyle} style={inputBg} />
            </div>
          </AccordionSection>
        </div>
      </FormSection>

      {/* SECCIÓN E */}
      <FormSection title="Cierre del Monitoreo" icon={FileText} badge="Sección E">
        <div className="rounded-xl p-4 mb-3" style={glassCard}>
          <label className="text-[14px] text-muted-foreground mb-2 block">Observaciones Generales</label>
          <textarea placeholder="Describe las condiciones observadas, riesgos detectados..." value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={`${inputStyle} resize-none`} style={inputBg} rows={4} />
        </div>

        <div className="rounded-xl p-4 space-y-2.5" style={glassCard}>
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-muted-foreground">
              Actividades
              {activities.length === 0 && <span className="text-destructive ml-1">(Mín. 1)</span>}
            </p>
            <span className="text-[13px] text-primary/80 bg-primary/6 px-2 py-0.5 rounded-md tabular-nums">{activities.length}</span>
          </div>

          {activities.length === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(255,59,48,0.06)" }}>
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" strokeWidth={2} />
              <p className="text-[13px] text-destructive">Registra al menos una actividad para guardar.</p>
            </div>
          )}

          {activities.map((act, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "var(--input-background)" }}>
              <div className="w-7 h-7 rounded-[8px] bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px]">{act.type}</p>
                {act.desc && <p className="text-[13px] text-muted-foreground mt-0.5">{act.desc}</p>}
              </div>
              <span className="text-[13px] text-muted-foreground/60 shrink-0">{act.time}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-4 mt-3 space-y-2.5" style={glassCard}>
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-muted-foreground">
              Evidencias
              {evidencias.length === 0 && <span className="text-destructive ml-1">(Mín. 1)</span>}
            </p>
            <span className="text-[13px] text-primary/80 bg-primary/6 px-2 py-0.5 rounded-md tabular-nums">{evidencias.length}</span>
          </div>

          <input
            ref={evidenceInputRef}
            type="file"
            accept="image/*,application/pdf,audio/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleEvidenceSelect(e.target.files);
              e.currentTarget.value = "";
            }}
          />

          <button
            onClick={() => evidenceInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] text-primary active:scale-[0.98] transition-transform"
            style={{
              background: "rgba(171,23,56,0.06)",
              boxShadow: "inset 0 0 0 1px rgba(171,23,56,0.2)",
            }}
          >
            <Camera className="w-4.5 h-4.5" strokeWidth={1.8} />
            <span>Agregar Evidencia</span>
          </button>

          {evidencias.length === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(255,59,48,0.06)" }}>
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" strokeWidth={2} />
              <p className="text-[13px] text-destructive">Debes adjuntar al menos una evidencia para guardar.</p>
            </div>
          )}

          {evidencias.map((ev, i) => (
            <div key={`${ev.name}-${i}`} className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: "var(--input-background)" }}>
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-[13px] flex-1 truncate">{ev.name}</span>
              <button
                onClick={() => setEvidencias((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-[12px] text-destructive px-2 py-1 rounded-lg"
                style={{ background: "rgba(255,59,48,0.08)" }}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      </FormSection>

      {/* Add Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)" }}>
          <div
            className="w-full rounded-t-[28px] p-5 pb-10 space-y-4"
            style={{
              background: "var(--glass-bg-ultra)",
              backdropFilter: "saturate(180%) blur(40px)",
              WebkitBackdropFilter: "saturate(180%) blur(40px)",
              boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.5), 0 -16px 48px rgba(0,0,0,0.1)",
            }}
          >
            <div className="w-9 h-1 rounded-full bg-foreground/15 mx-auto mb-2" />
            <h3 className="text-center text-[18px] tracking-tight">Agregar Actividad</h3>

            <div>
              <label className="text-[14px] text-muted-foreground mb-1.5 block">Tipo de Actividad *</label>
              <div className="relative">
                <select value={newActivityType} onChange={(e) => setNewActivityType(e.target.value)} className={`${inputStyle} appearance-none pr-10`} style={inputBg}>
                  <option value="">Seleccionar...</option>
                  {tiposActividad.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <label className="text-[14px] text-muted-foreground mb-1.5 block">Descripción breve</label>
              <textarea placeholder="Describe la actividad realizada..." value={newActivityDesc} onChange={(e) => setNewActivityDesc(e.target.value)} className={`${inputStyle} resize-none`} style={inputBg} rows={3} />
            </div>
            <button onClick={handleAddActivity} className="w-full py-3.5 rounded-xl bg-primary text-white text-[16px] active:scale-[0.97] transition-transform" style={{ boxShadow: "0 2px 8px rgba(171,23,56,0.2), 0 8px 24px rgba(171,23,56,0.15)" }}>
              Confirmar Actividad
            </button>
            <button onClick={() => setShowActivityModal(false)} className="w-full py-3 text-center text-[16px] text-muted-foreground">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 pb-8 space-y-2.5 z-40"
        style={{
          background: "rgba(242, 241, 239, 0.85)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.4), 0 -8px 24px rgba(0,0,0,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => setShowActivityModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] text-secondary active:scale-[0.97] transition-transform"
          style={{
            background: "rgba(188,149,91,0.08)",
            boxShadow: "inset 0 0 0 1.5px rgba(188,149,91,0.35)",
          }}
        >
          <ClipboardList className="w-4.5 h-4.5" strokeWidth={1.8} />
          <span>Agregar Actividad</span>
          <span className="text-[13px] opacity-50">(Obligatorio)</span>
        </button>
        <button
          type="button"
          onClick={() => evidenceInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] text-primary active:scale-[0.97] transition-transform"
          style={{
            background: "rgba(171,23,56,0.08)",
            boxShadow: "inset 0 0 0 1.5px rgba(171,23,56,0.25)",
          }}
        >
          <Camera className="w-4.5 h-4.5" strokeWidth={1.8} />
          <span>Agregar Evidencia</span>
          <span className="text-[13px] opacity-50">(Obligatorio)</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-white text-[16px] active:scale-[0.97] transition-transform"
          style={{ boxShadow: "0 2px 8px rgba(171,23,56,0.2), 0 8px 24px rgba(171,23,56,0.15)" }}
        >
          <Save className="w-5 h-5" strokeWidth={1.8} />
          <span>{saving ? "Guardando..." : "Guardar Monitoreo"}</span>
        </button>
      </div>
    </div>
  );
}
