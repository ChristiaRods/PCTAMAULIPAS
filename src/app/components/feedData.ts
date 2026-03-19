/* ═══════════════════════════════════════════════════════════════
   feedData.ts — Shared mock data for Coordinador Regional feed
   20 items: reporte911 + monitoreo (solo Tamaulipas)
   Intercalados cronológicamente (más reciente primero)
   ═══════════════════════════════════════════════════════════════ */

/* ─── Types ─── */
export interface TrazabilidadItem {
  actor: string;
  tipo: "Sistema" | "Estatus" | "Actividad" | "Evidencia" | "Ubicacion";
  hora: string;
  mensaje: string;
}

export interface Autor {
  nombre: string;
  iniciales: string;
  rol: string;
  avatarColor: string;
}

/* ── Reporte 911 ── */
export interface Reporte911 {
  type: "reporte911";
  id: string;
  isNew: boolean;
  isPinned?: boolean;
  relativeTime: string;
  timestamp: string;
  autor: Autor;
  folio: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  municipio: string;
  coords?: { lat: number; lng: number };
  estatus: string;
  images: string[];
  kpis: { personal: number; unidades: number; atencionesPrehosp: number; duracionMin: number };
  conteos: { actualizaciones: number; actividades: number; evidencias: number };
  trazabilidad: TrazabilidadItem[];
}

/* ── Monitoreo ── */
export interface ActividadMonitoreo {
  tipoActividad: string;
  fechaHora: string;
  descripcion: string;
}

export interface EvidenciaMonitoreo {
  kind: "image" | "pdf" | "audio" | "video";
  nombre: string;
  src: string;
}

export interface Monitoreo {
  type: "monitoreo";
  id: string;
  isNew: boolean;
  isPinned?: boolean;
  relativeTime: string;
  timestamp: string;
  autor: Autor;
  folio: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  municipio: string;
  estatus: string;
  images: string[];
  datosGenerales: {
    fechaHoraRegistro: string;
    municipio: string;
    localidad: string;
    tipoMonitoreo: string;
    subtipoMonitoreo: string;
    datosMonitoreo: string;
    tipoAfectaciones: string;
    descripcionMonitoreo: string;
  };
  detalles: {
    conteoPersonas: { hombres: number; mujeres: number; ninos: number; ninas: number; noIdentificados: number };
    totalPersonas: number;
  };
  actividades: ActividadMonitoreo[];
  evidencias: EvidenciaMonitoreo[];
  conteos: { actividades: number; evidencias: number };
  trazabilidad: TrazabilidadItem[];
}

export type FeedItem = Reporte911 | Monitoreo;

/* ─── Images ─── */
const IMG = {
  fireRescue: "https://images.unsplash.com/photo-1768685318695-13499e5412c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbWVyZ2VuY3klMjByZXNwb25kZXIlMjBmaXJlJTIwcmVzY3VlfGVufDF8fHx8MTc3MjY2MzgxMXww&ixlib=rb-4.1.0&q=80&w=1080",
  buildingSmoke: "https://images.unsplash.com/photo-1764314660558-bf38b53e007d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGZpcmUlMjBzbW9rZSUyMHVyYmFuJTIwZW1lcmdlbmN5fGVufDF8fHx8MTc3MjczMjA5MHww&ixlib=rb-4.1.0&q=80&w=1080",
  firefighterTeam: "https://images.unsplash.com/photo-1764231503535-0b19196e324c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXJlZmlnaHRlciUyMHJlc2N1ZSUyMHRlYW0lMjBvcGVyYXRpb258ZW58MXx8fHwxNzcyNzMyMDkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
  stormTree: "https://images.unsplash.com/photo-1769731431903-de98105592e9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdG9ybSUyMGRhbWFnZSUyMGZhbGxlbiUyMHRyZWUlMjByb2FkfGVufDF8fHx8MTc3MjY2MzgxM3ww&ixlib=rb-4.1.0&q=80&w=1080",
  collapsed: "https://images.unsplash.com/photo-1610774149656-f4d74dafa99b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xsYXBzZWQlMjBidWlsZGluZyUyMHJ1YmJsZSUyMHJlc2N1ZXxlbnwxfHx8fDE3NzI3MzIwOTB8MA&ixlib=rb-4.1.0&q=80&w=1080",
  floodStreet: "https://images.unsplash.com/photo-1576749288264-207936efb479?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmbG9vZCUyMHVyYmFuJTIwc3RyZWV0JTIwd2F0ZXJ8ZW58MXx8fHwxNzcyNjYzODEyfDA&ixlib=rb-4.1.0&q=80&w=1080",
  floodedDamage: "https://images.unsplash.com/photo-1617252820855-a829ba1babe7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmbG9vZGVkJTIwc3RyZWV0JTIwdXJiYW4lMjB3YXRlciUyMGRhbWFnZXxlbnwxfHx8fDE3NzI3MzIwOTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
  forestFire: "https://images.unsplash.com/photo-1624929303592-230462f729be?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb3Jlc3QlMjBmaXJlJTIwc21va2UlMjBoZWxpY29wdGVyfGVufDF8fHx8MTc3MjY2MzgxMnww&ixlib=rb-4.1.0&q=80&w=1080",
  ambulance: "https://images.unsplash.com/photo-1697952431905-9c8d169d9d2b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbWVyZ2VuY3klMjBtZWRpY2FsJTIwYW1idWxhbmNlfGVufDF8fHx8MTc3MjY2MzgxMnww&ixlib=rb-4.1.0&q=80&w=1080",
  paramedic: "https://images.unsplash.com/photo-1619025873875-59dfdd2bbbd6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbWVyZ2VuY3klMjBwYXJhbWVkaWMlMjBzdHJldGNoZXIlMjBhbWJ1bGFuY2V8ZW58MXx8fHwxNzcyNzMyMDkxfDA&ixlib=rb-4.1.0&q=80&w=1080",
  civilTeam: "https://images.unsplash.com/photo-1614554768026-6dc74af4e11a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaXZpbCUyMHByb3RlY3Rpb24lMjB0ZWFtJTIwZmllbGR8ZW58MXx8fHwxNzcyNjYzODEzfDA&ixlib=rb-4.1.0&q=80&w=1080",
  floodRain: "https://images.unsplash.com/photo-1673942504079-f90bb4c71570?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmbG9vZGVkJTIwc3RyZWV0JTIwdXJiYW4lMjByYWluJTIwTWV4aWNvfGVufDF8fHx8MTc3Mjc0ODYwNXww&ixlib=rb-4.1.0&q=80&w=1080",
  beachCrowd: "https://images.unsplash.com/photo-1771526963749-f6522c838a6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFjaCUyMGNyb3dkJTIwdG91cmlzbSUyMGxpZmVndWFyZCUyMHN0YXRpb258ZW58MXx8fHwxNzcyNzQ4NjA2fDA&ixlib=rb-4.1.0&q=80&w=1080",
  wildfireAerial: "https://images.unsplash.com/photo-1761344446179-9098cb7fe465?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aWxkZmlyZSUyMGZvcmVzdCUyMHNtb2tlJTIwYWVyaWFsfGVufDF8fHx8MTc3Mjc0ODYwN3ww&ixlib=rb-4.1.0&q=80&w=1080",
  shelter: "https://images.unsplash.com/photo-1559733970-2e2583d40317?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbWVyZ2VuY3klMjBzaGVsdGVyJTIwcmVmdWdlZXMlMjBjb3RzfGVufDF8fHx8MTc3Mjc0ODYwOHww&ixlib=rb-4.1.0&q=80&w=1080",
  carAccident: "https://images.unsplash.com/photo-1582210537264-71d50b781fad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXIlMjBhY2NpZGVudCUyMHJvYWQlMjBlbWVyZ2VuY3klMjBuaWdodHxlbnwxfHx8fDE3NzI3NDg2MDh8MA&ixlib=rb-4.1.0&q=80&w=1080",
  paramedicNew: "https://images.unsplash.com/photo-1690520760201-e0a37f372b67?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXJhbWVkaWMlMjBzdHJldGNoZXIlMjBhbWJ1bGFuY2UlMjBwYXRpZW50fGVufDF8fHx8MTc3Mjc0ODYwOHww&ixlib=rb-4.1.0&q=80&w=1080",
  winterStorm: "https://images.unsplash.com/photo-1765389122313-e8eb73621ed1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xkJTIwd2VhdGhlciUyMHdpbnRlciUyMHN0b3JtJTIwcm9hZHxlbnwxfHx8fDE3NzI3NDg2MDh8MA&ixlib=rb-4.1.0&q=80&w=1080",
  riverFlood: "https://images.unsplash.com/photo-1679311563186-8f82903730fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaXZlciUyMGZsb29kJTIwbW9uaXRvcmluZyUyMHdhdGVyJTIwbGV2ZWx8ZW58MXx8fHwxNzcyNzQ4NjA5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  rescueWorkers: "https://images.unsplash.com/photo-1734445558870-72ee57ee3930?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbWVyZ2VuY3klMjB0ZWFtJTIwcmVzY3VlJTIwd29ya2VycyUyMGZpZWxkfGVufDF8fHx8MTc3Mjc0ODYwOXww&ixlib=rb-4.1.0&q=80&w=1080",
  hazmat: "https://images.unsplash.com/photo-1558025646-164a64e5ea3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYXMlMjBsZWFrJTIwaGF6bWF0JTIwZW1lcmdlbmN5JTIwdXJiYW58ZW58MXx8fHwxNzcyNzQ4NjEwfDA&ixlib=rb-4.1.0&q=80&w=1080",
  collapsedCrew: "https://images.unsplash.com/photo-1682775563545-50b19972c7bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xsYXBzZWQlMjBidWlsZGluZyUyMHJ1YmJsZSUyMHJlc2N1ZSUyMGNyZXd8ZW58MXx8fHwxNzcyNzQ4NjEwfDA&ixlib=rb-4.1.0&q=80&w=1080",
  hurricaneDamage: "https://images.unsplash.com/photo-1706041093145-004fffb68eed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxodXJyaWNhbmUlMjBkYW1hZ2UlMjBmYWxsZW4lMjB0cmVlJTIwcG93ZXIlMjBsaW5lc3xlbnwxfHx8fDE3NzI3NDg2MTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
  firefighterHose: "https://images.unsplash.com/photo-1757967771758-d9b2ea992b3c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXJlZmlnaHRlciUyMHRlYW0lMjB3YXRlciUyMGhvc2UlMjBidWlsZGluZ3xlbnwxfHx8fDE3NzI3NDg2MTN8MA&ixlib=rb-4.1.0&q=80&w=1080",
  floodBoat: "https://images.unsplash.com/photo-1741081288260-877057e3fa27?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmbG9vZCUyMGV2YWN1YXRpb24lMjBib2F0JTIwcmVzY3VlJTIwbmVpZ2hib3Job29kfGVufDF8fHx8MTc3Mjc0ODYxNHww&ixlib=rb-4.1.0&q=80&w=1080",
  festivalCrowd: "https://images.unsplash.com/photo-1573463908761-567b9356c64f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvdXRkb29yJTIwY29uY2VydCUyMGZlc3RpdmFsJTIwY3Jvd2QlMjBzYWZldHl8ZW58MXx8fHwxNzcyNzQ4NjE0fDA&ixlib=rb-4.1.0&q=80&w=1080",
  powerLine: "https://images.unsplash.com/photo-1574358524001-2be1d31674d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3dlciUyMGxpbmUlMjByZXBhaXIlMjB1dGlsaXR5JTIwd29ya2VycyUyMHRydWNrfGVufDF8fHx8MTc3Mjc0ODYxNHww&ixlib=rb-4.1.0&q=80&w=1080",
  firstAidTent: "https://images.unsplash.com/photo-1762090241113-a8cf1f4b29b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwZmlyc3QlMjBhaWQlMjB0ZW50JTIwb3V0ZG9vciUyMGV2ZW50fGVufDF8fHx8MTc3Mjc0ODYxNXww&ixlib=rb-4.1.0&q=80&w=1080",
};

/* ═══════════════════════════════════════════════════════════════
   FEED ITEMS — 29 items intercalados cronológicamente
   R = reporte911, M = monitoreo (13 text-only posts para fondos únicos)
   20 originales + 9 nuevos text-only intercalados
   ═══════════════════════════════════════════════════════════════ */
export const feedItems: FeedItem[] = [

  // ── 1. R: Inundación Vial ── 14:25 (sin imágenes) ★ MOVED TO TOP TO SHOWCASE TEXT-ONLY GRADIENT
  {
    type: "reporte911", id: "911-2026-0138", isNew: true,
    relativeTime: "Hace 3 min", timestamp: "05/03/2026, 14:25",
    autor: { nombre: "Roberto Martínez Solís", iniciales: "RM", rol: "Operador de Campo - 911", avatarColor: "bg-indigo-600" },
    folio: "911-2026-0138", titulo: "Inundación Vial",
    descripcion: "Se reporta acumulación de agua pluvial de aproximadamente 40cm en cruce vial. Vehículos varados. Se solicita apoyo de bomberos para achique y señalización preventiva en ambos sentidos del boulevard.",
    ubicacion: "Blvd. Tamaulipas esq. Av. Universidad", municipio: "Ciudad Victoria",
    estatus: "En Atención",
    images: [],
    kpis: { personal: 3, unidades: 1, atencionesPrehosp: 0, duracionMin: 0 },
    conteos: { actualizaciones: 2, actividades: 1, evidencias: 0 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "14:25", mensaje: "Reporte de inundación vial recibido del 911." },
      { actor: "Roberto Martínez Solís", tipo: "Estatus", hora: "14:27", mensaje: "En camino con equipo de achique y señalización." },
    ],
  },

  // ── 2. R: Corto Circuito ── 14:22
  {
    type: "reporte911", id: "911-2026-0148", isNew: true,
    relativeTime: "Hace 6 min", timestamp: "05/03/2026, 14:22",
    autor: { nombre: "Francisco Torres Leal", iniciales: "FT", rol: "Operador de Campo - 911", avatarColor: "bg-amber-700" },
    folio: "911-2026-0148", titulo: "Corto Circuito en Local Comercial",
    descripcion: "Se reporta humo y chispas en local comercial de la zona centro. Se evacuó el inmueble preventivamente. CFE notificada para corte de suministro.",
    ubicacion: "Calle Morelos #1420, Zona Centro", municipio: "Tampico",
    estatus: "En Atención",
    images: [IMG.powerLine],
    kpis: { personal: 3, unidades: 1, atencionesPrehosp: 0, duracionMin: 0 },
    conteos: { actualizaciones: 2, actividades: 1, evidencias: 1 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "14:22", mensaje: "Reporte de corto circuito recibido vía 911." },
      { actor: "Francisco Torres Leal", tipo: "Estatus", hora: "14:25", mensaje: "En camino con Unidad 09. CFE notificada." },
    ],
  },

  // ── 3. M: Temporada de Lluvias — Victoria ── 14:17
  {
    type: "monitoreo", id: "MON-2026-0008", isNew: true,
    relativeTime: "Hace 11 min", timestamp: "05/03/2026, 14:17",
    autor: { nombre: "María Fernanda Salinas", iniciales: "MS", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-primary" },
    folio: "PC-2026-0008", titulo: "Temporada de Lluvias",
    descripcion: "Recorrido preventivo en zona baja; se observan encharcamientos y aumento de escurrimientos en arroyos cercanos.",
    ubicacion: "Fracc. Las Flores, Zona Baja", municipio: "Ciudad Victoria",
    estatus: "En seguimiento",
    images: [IMG.floodRain, IMG.riverFlood],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 02:17 p.m.",
      municipio: "Ciudad Victoria",
      localidad: "Fracc. Las Flores",
      tipoMonitoreo: "Temporada de Lluvias",
      subtipoMonitoreo: "Datos Generales",
      datosMonitoreo: "Nivel de escurrimiento y puntos de riesgo en zona baja de Ciudad Victoria",
      tipoAfectaciones: "Damnificados",
      descripcionMonitoreo: "Se detecta acumulación de agua en vialidades secundarias; se recomienda acordonar zonas con flujo rápido.",
    },
    detalles: {
      conteoPersonas: { hombres: 3, mujeres: 4, ninos: 2, ninas: 1, noIdentificados: 0 },
      totalPersonas: 10,
    },
    actividades: [
      { tipoActividad: "Recorrido", fechaHora: "05/03/2026 14:25", descripcion: "Se realiza recorrido en puntos críticos y se documentan encharcamientos en 4 cruces viales." },
      { tipoActividad: "Coordinación", fechaHora: "05/03/2026 14:40", descripcion: "Se notifica a Coordinación Regional para canalización preventiva de unidades." },
    ],
    evidencias: [
      { kind: "image", nombre: "encharcamiento_01.jpg", src: IMG.floodRain },
      { kind: "image", nombre: "arroyo_nivel.jpg", src: IMG.riverFlood },
      { kind: "pdf", nombre: "reporte_preventivo.pdf", src: "mock://monitoreo/victoria/reporte_preventivo.pdf" },
      { kind: "audio", nombre: "nota_voz_01.m4a", src: "mock://monitoreo/victoria/nota_voz_01.m4a" },
    ],
    conteos: { actividades: 2, evidencias: 4 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "14:17", mensaje: "Monitoreo capturado y asociado a Centro Regional Victoria." },
      { actor: "María F. Salinas", tipo: "Actividad", hora: "14:25", mensaje: "Actividad registrada: Recorrido en puntos críticos." },
      { actor: "Sistema Central", tipo: "Evidencia", hora: "14:35", mensaje: "Evidencias anexadas: 2 imágenes, 1 PDF, 1 audio." },
      { actor: "María F. Salinas", tipo: "Actividad", hora: "14:40", mensaje: "Coordinación preventiva solicitada." },
    ],
  },

  // ── 4. R: Incendio Estructural ── 14:10 (PINNED)
  {
    type: "reporte911", id: "911-2026-0147", isNew: true, isPinned: true,
    relativeTime: "Hace 18 min", timestamp: "05/03/2026, 14:10",
    autor: { nombre: "Carlos López Hernández", iniciales: "CL", rol: "Operador de Campo - 911", avatarColor: "bg-red-600" },
    folio: "911-2026-0147", titulo: "Incendio Estructural",
    descripcion: "Se reporta columna de humo visible desde edificio de 2 pisos en esquina. Vecinos alertaron presencia de personas en planta alta. Se acude de inmediato con unidad 07.",
    ubicacion: "Col. Centro, Calle 5a Norte #412", municipio: "Ciudad Victoria",
    estatus: "En Atención",
    images: [IMG.fireRescue, IMG.buildingSmoke, IMG.firefighterTeam],
    kpis: { personal: 6, unidades: 2, atencionesPrehosp: 1, duracionMin: 75 },
    conteos: { actualizaciones: 8, actividades: 4, evidencias: 5 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "14:10", mensaje: "Reporte recibido del Centro de Emergencias 911. Se genera folio y se asigna al Centro Regional Victoria." },
      { actor: "Coordinación Regional", tipo: "Sistema", hora: "14:13", mensaje: "Reporte asignado a Operador Carlos López Hernández. Notificación enviada a app móvil." },
      { actor: "Carlos López Hernández", tipo: "Estatus", hora: "14:18", mensaje: "Reporte aceptado. En camino con Unidad 07. ETA 8 minutos." },
      { actor: "GPS Automático", tipo: "Ubicacion", hora: "14:26", mensaje: "Llegada confirmada. Coordenadas registradas. Distancia al punto reportado: 42 m." },
      { actor: "Carlos López Hernández", tipo: "Actividad", hora: "14:35", mensaje: "Se realizó inspección visual del edificio. Se confirma presencia de humo en planta alta. 2 personas evacuadas por vecinos." },
      { actor: "Carlos López Hernández", tipo: "Evidencia", hora: "14:42", mensaje: "Se adjunta evidencia fotográfica del área de atención. Extinción en progreso con equipo portátil." },
      { actor: "Carlos López Hernández", tipo: "Actividad", hora: "15:00", mensaje: "Evacuación completada. 12 personas (8 adultos, 4 menores). Atención prehospitalaria a 1 persona por inhalación leve." },
      { actor: "Carlos López Hernández", tipo: "Estatus", hora: "15:25", mensaje: "Incendio controlado y extinguido. Inmueble sin daño estructural. Cierre de operativo." },
    ],
  },

  // ── 5. M: Temporada de Lluvias — Refugios — Reynosa ── 13:45
  {
    type: "monitoreo", id: "MON-2026-0009", isNew: true,
    relativeTime: "Hace 43 min", timestamp: "05/03/2026, 13:45",
    autor: { nombre: "Laura Elizondo Ríos", iniciales: "LE", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-emerald-700" },
    folio: "PC-2026-0009", titulo: "Temporada de Lluvias — Refugios",
    descripcion: "Verificación de refugios temporales activos. 3 refugios operando al 65% de capacidad. Se requieren cobijas y kits de higiene adicionales.",
    ubicacion: "Col. Rodríguez, Refugio Esc. Primaria Juárez", municipio: "Reynosa",
    estatus: "En seguimiento",
    images: [IMG.shelter],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 01:45 p.m.",
      municipio: "Reynosa",
      localidad: "Col. Rodríguez",
      tipoMonitoreo: "Temporada de Lluvias",
      subtipoMonitoreo: "Refugios y Evacuados",
      datosMonitoreo: "3 refugios activos; capacidad total 200 personas; ocupación actual 130",
      tipoAfectaciones: "Evacuados",
      descripcionMonitoreo: "Refugios operando con normalidad. Se requiere reabastecimiento de insumos básicos para las próximas 48 horas.",
    },
    detalles: {
      conteoPersonas: { hombres: 35, mujeres: 42, ninos: 28, ninas: 22, noIdentificados: 3 },
      totalPersonas: 130,
    },
    actividades: [
      { tipoActividad: "Verificación", fechaHora: "05/03/2026 13:55", descripcion: "Inspección de los 3 refugios: condiciones sanitarias adecuadas." },
      { tipoActividad: "Logística", fechaHora: "05/03/2026 14:10", descripcion: "Solicitud de 50 cobijas y 80 kits de higiene al almacén regional." },
    ],
    evidencias: [
      { kind: "image", nombre: "refugio_01.jpg", src: IMG.shelter },
      { kind: "pdf", nombre: "censo_refugiados.pdf", src: "mock://monitoreo/reynosa/censo.pdf" },
      { kind: "audio", nombre: "reporte_voz.m4a", src: "mock://monitoreo/reynosa/reporte_voz.m4a" },
    ],
    conteos: { actividades: 2, evidencias: 3 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "13:45", mensaje: "Monitoreo de refugios registrado — Reynosa." },
      { actor: "Laura Elizondo R.", tipo: "Actividad", hora: "13:55", mensaje: "Inspección de refugios completada." },
      { actor: "Laura Elizondo R.", tipo: "Actividad", hora: "14:10", mensaje: "Solicitud de insumos enviada al almacén regional." },
    ],
  },

  // ── 6. R: Derrumbe Parcial ── 13:30
  {
    type: "reporte911", id: "911-2026-0146", isNew: false,
    relativeTime: "Hace 58 min", timestamp: "05/03/2026, 13:30",
    autor: { nombre: "María García Ruiz", iniciales: "MG", rol: "Operadora de Campo - 911", avatarColor: "bg-blue-600" },
    folio: "911-2026-0146", titulo: "Derrumbe Parcial",
    descripcion: "Se confirma derrumbe parcial de muro perimetral en zona habitacional. No hay personas atrapadas. Zona acordonada. Se realizó inspección estructural preliminar.",
    ubicacion: "Col. Las Granjas, Av. Principal", municipio: "Reynosa",
    estatus: "En Atención",
    images: [IMG.collapsed, IMG.collapsedCrew],
    kpis: { personal: 4, unidades: 1, atencionesPrehosp: 0, duracionMin: 45 },
    conteos: { actualizaciones: 5, actividades: 3, evidencias: 5 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "13:30", mensaje: "Reporte recibido del 911. Folio generado automáticamente." },
      { actor: "María García Ruiz", tipo: "Estatus", hora: "13:38", mensaje: "Reporte aceptado. En ruta con Unidad 12." },
      { actor: "GPS Automático", tipo: "Ubicacion", hora: "13:48", mensaje: "Llegada confirmada al sitio del derrumbe." },
      { actor: "María García Ruiz", tipo: "Actividad", hora: "13:55", mensaje: "Inspección visual completada. Muro perimetral colapsado parcialmente. No hay víctimas." },
      { actor: "María García Ruiz", tipo: "Evidencia", hora: "14:00", mensaje: "Evidencia fotográfica adjunta. Se recomienda demolición controlada del muro restante." },
    ],
  },

  // ── 6b. NEW R: Rescate en Canal de Riego ── 13:20
  {
    type: "reporte911", id: "911-2026-0149", isNew: false,
    relativeTime: "Hace 1 hr 8 min", timestamp: "05/03/2026, 13:20",
    autor: { nombre: "Raúl Ibarra Montoya", iniciales: "RI", rol: "Operador de Campo - 911", avatarColor: "bg-amber-800" },
    folio: "911-2026-0149", titulo: "Rescate en Canal de Riego",
    descripcion: "Persona cayó a canal de riego con corriente moderada. Se realizó rescate acuático exitoso. Persona consciente y sin lesiones graves. Trasladada a valoración médica.",
    ubicacion: "Canal Principal de Riego, Km 6", municipio: "Matamoros",
    estatus: "Atendido",
    images: [],
    kpis: { personal: 4, unidades: 2, atencionesPrehosp: 1, duracionMin: 40 },
    conteos: { actualizaciones: 4, actividades: 3, evidencias: 0 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "13:20", mensaje: "Reporte de persona en canal de riego recibido vía 911." },
      { actor: "Raúl Ibarra Montoya", tipo: "Estatus", hora: "13:25", mensaje: "En camino con equipo de rescate acuático." },
      { actor: "Raúl Ibarra Montoya", tipo: "Actividad", hora: "13:35", mensaje: "Rescate completado. Persona consciente, hipotermia leve." },
      { actor: "Raúl Ibarra Montoya", tipo: "Estatus", hora: "14:00", mensaje: "Traslado a Hospital General. Cierre de operativo." },
    ],
  },

  // ── 7. M: Semana Santa — Playa Miramar ── 13:10
  {
    type: "monitoreo", id: "MON-2026-0012", isNew: false,
    relativeTime: "Hace 1 hr 18 min", timestamp: "05/03/2026, 13:10",
    autor: { nombre: "Jorge Peña Ramírez", iniciales: "JP", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-sky-600" },
    folio: "PC-2026-0012", titulo: "Semana Santa — Playa Miramar",
    descripcion: "Alta concentración de personas en zona turística; se reportan atenciones menores y traslados preventivos por deshidratación.",
    ubicacion: "Playa Miramar, Acceso Principal", municipio: "Ciudad Madero",
    estatus: "Activo",
    images: [IMG.beachCrowd, IMG.firstAidTent],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 01:10 p.m.",
      municipio: "Ciudad Madero",
      localidad: "Playa Miramar",
      tipoMonitoreo: "Semana Santa",
      subtipoMonitoreo: "Atenciones y Traslados",
      datosMonitoreo: "Atenciones menores en sitio; módulo de hidratación activo",
      tipoAfectaciones: "Heridos",
      descripcionMonitoreo: "Se realizan acciones de prevención y atención básica; se mantiene monitoreo en accesos principales.",
    },
    detalles: {
      conteoPersonas: { hombres: 5, mujeres: 6, ninos: 3, ninas: 2, noIdentificados: 1 },
      totalPersonas: 17,
    },
    actividades: [
      { tipoActividad: "Primeros Auxilios", fechaHora: "05/03/2026 13:25", descripcion: "Atención prehospitalaria menor a 2 personas por deshidratación leve." },
      { tipoActividad: "Traslado", fechaHora: "05/03/2026 13:40", descripcion: "Traslado preventivo a módulo de salud para valoración." },
      { tipoActividad: "Prevención", fechaHora: "05/03/2026 14:00", descripcion: "Recomendaciones a visitantes y reforzamiento de puntos de hidratación." },
    ],
    evidencias: [
      { kind: "image", nombre: "miramar_panoramica.jpg", src: IMG.beachCrowd },
      { kind: "image", nombre: "modulo_salud.jpg", src: IMG.firstAidTent },
      { kind: "video", nombre: "recorrido_playa.mp4", src: "mock://monitoreo/madero/miramar_video_01.mp4" },
    ],
    conteos: { actividades: 3, evidencias: 3 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "13:10", mensaje: "Monitoreo iniciado — Semana Santa, Playa Miramar." },
      { actor: "Jorge P. Ramírez", tipo: "Actividad", hora: "13:25", mensaje: "Actividad registrada: Primeros Auxilios a 2 personas." },
      { actor: "Sistema Central", tipo: "Evidencia", hora: "13:50", mensaje: "Evidencias anexadas: 2 imágenes, 1 video." },
      { actor: "Jorge P. Ramírez", tipo: "Estatus", hora: "14:05", mensaje: "Estatus actualizado: Activo. Monitoreo continúa." },
    ],
  },

  // ── 8. R: Accidente Vial Múltiple ── 12:50
  {
    type: "reporte911", id: "911-2026-0145", isNew: false,
    relativeTime: "Hace 1 hr 38 min", timestamp: "05/03/2026, 12:50",
    autor: { nombre: "Pedro Sánchez Méndez", iniciales: "PS", rol: "Operador de Campo - 911", avatarColor: "bg-cyan-600" },
    folio: "911-2026-0145", titulo: "Accidente Vial Múltiple",
    descripcion: "Colisión de 3 vehículos en carretera federal. 2 personas lesionadas con traumatismos menores. Se solicita apoyo de grúa para retiro de vehículos.",
    ubicacion: "Carretera Federal 85, Km 14", municipio: "Ciudad Victoria",
    estatus: "Atendido",
    images: [IMG.carAccident, IMG.paramedicNew],
    kpis: { personal: 5, unidades: 2, atencionesPrehosp: 2, duracionMin: 90 },
    conteos: { actualizaciones: 7, actividades: 5, evidencias: 6 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "12:50", mensaje: "Reporte de accidente vial múltiple recibido vía 911." },
      { actor: "Pedro Sánchez Méndez", tipo: "Estatus", hora: "12:58", mensaje: "En camino con Unidad 05 y ambulancia." },
      { actor: "GPS Automático", tipo: "Ubicacion", hora: "13:08", mensaje: "Llegada confirmada. Km 14 de carretera federal 85." },
      { actor: "Pedro Sánchez Méndez", tipo: "Actividad", hora: "13:15", mensaje: "2 personas lesionadas. Atención prehospitalaria iniciada." },
      { actor: "Pedro Sánchez Méndez", tipo: "Actividad", hora: "13:30", mensaje: "Traslado de lesionados a Hospital General de Victoria." },
      { actor: "Pedro Sánchez Méndez", tipo: "Evidencia", hora: "13:45", mensaje: "Evidencia fotográfica del siniestro adjunta." },
      { actor: "Pedro Sánchez Méndez", tipo: "Estatus", hora: "14:20", mensaje: "Operativo cerrado. Vehículos retirados. Vialidad liberada." },
    ],
  },

  // ── 8b. NEW M: Simulacro Regional ── 12:42
  {
    type: "monitoreo", id: "MON-2026-0017", isNew: false,
    relativeTime: "Hace 1 hr 46 min", timestamp: "05/03/2026, 12:42",
    autor: { nombre: "Sandra Villarreal Treviño", iniciales: "SV", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-indigo-700" },
    folio: "PC-2026-0017", titulo: "Simulacro Regional",
    descripcion: "Simulacro de evacuación por sismo en edificios gubernamentales del centro de Tampico. Participaron 12 dependencias con 840 personas evacuadas en tiempo récord de 4 minutos 22 segundos.",
    ubicacion: "Centro Gubernamental, Av. Hidalgo", municipio: "Tampico",
    estatus: "Cerrado",
    images: [],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 12:42 p.m.",
      municipio: "Tampico",
      localidad: "Centro Gubernamental",
      tipoMonitoreo: "Evento Socio-Organizativo",
      subtipoMonitoreo: "Simulacro",
      datosMonitoreo: "12 dependencias participantes; 840 personas evacuadas; tiempo 4:22 min",
      tipoAfectaciones: "No localizados",
      descripcionMonitoreo: "Simulacro coordinado con éxito. Tiempo de evacuación dentro de parámetros aceptables. Se identificaron 3 áreas de mejora.",
    },
    detalles: {
      conteoPersonas: { hombres: 0, mujeres: 0, ninos: 0, ninas: 0, noIdentificados: 0 },
      totalPersonas: 0,
    },
    actividades: [
      { tipoActividad: "Simulacro", fechaHora: "05/03/2026 12:50", descripcion: "Activación de alarma sísmica y evacuación de 12 edificios." },
    ],
    evidencias: [
      { kind: "pdf", nombre: "reporte_simulacro.pdf", src: "mock://monitoreo/tampico/simulacro.pdf" },
    ],
    conteos: { actividades: 1, evidencias: 1 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "12:42", mensaje: "Monitoreo de simulacro registrado — Tampico." },
      { actor: "Sandra Villarreal T.", tipo: "Actividad", hora: "12:50", mensaje: "Simulacro ejecutado. Tiempo: 4:22 min." },
      { actor: "Sandra Villarreal T.", tipo: "Estatus", hora: "13:15", mensaje: "Simulacro cerrado. Reporte de mejoras enviado." },
    ],
  },

  // ── 9. M: Incendios Forestales — Jaumave ── 12:25
  {
    type: "monitoreo", id: "MON-2026-0015", isNew: false,
    relativeTime: "Hace 2 hr", timestamp: "05/03/2026, 12:25",
    autor: { nombre: "Ricardo Vega Gutiérrez", iniciales: "RV", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-orange-700" },
    folio: "PC-2026-0015", titulo: "Incendios Forestales — Sierra",
    descripcion: "Verificación de avance de incendio forestal. 38 hectáreas consumidas. Brigadas trabajando en línea de fuego. Se requiere apoyo aéreo.",
    ubicacion: "Sierra de Tamaulipas, Km 24", municipio: "Jaumave",
    estatus: "Activo",
    images: [IMG.wildfireAerial, IMG.forestFire],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 12:25 p.m.",
      municipio: "Jaumave",
      localidad: "Sierra de Tamaulipas, Km 24",
      tipoMonitoreo: "Incendios Forestales",
      subtipoMonitoreo: "Datos Generales",
      datosMonitoreo: "38 hectáreas consumidas; 4 brigadas en línea de fuego; viento del NE a 15 km/h",
      tipoAfectaciones: "Evacuados",
      descripcionMonitoreo: "Se mantiene monitoreo activo del frente de fuego. Brigadas de CONAFOR y PC trabajando en coordinación.",
    },
    detalles: {
      conteoPersonas: { hombres: 8, mujeres: 2, ninos: 0, ninas: 0, noIdentificados: 0 },
      totalPersonas: 10,
    },
    actividades: [
      { tipoActividad: "Recorrido Aéreo", fechaHora: "05/03/2026 12:40", descripcion: "Sobrevuelo de reconocimiento para delimitar perímetro del incendio." },
      { tipoActividad: "Coordinación", fechaHora: "05/03/2026 13:10", descripcion: "Coordinación con CONAFOR para apoyo de brigada adicional." },
      { tipoActividad: "Evacuación", fechaHora: "05/03/2026 13:40", descripcion: "Evacuación preventiva de 3 familias en ranchería cercana al frente." },
    ],
    evidencias: [
      { kind: "image", nombre: "incendio_aereo.jpg", src: IMG.wildfireAerial },
      { kind: "image", nombre: "linea_fuego.jpg", src: IMG.forestFire },
      { kind: "pdf", nombre: "mapa_perimetro.pdf", src: "mock://monitoreo/jaumave/mapa_perimetro.pdf" },
      { kind: "video", nombre: "sobrevuelo_01.mp4", src: "mock://monitoreo/jaumave/sobrevuelo.mp4" },
    ],
    conteos: { actividades: 3, evidencias: 4 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "12:25", mensaje: "Monitoreo de incendio forestal registrado." },
      { actor: "Ricardo Vega G.", tipo: "Actividad", hora: "12:40", mensaje: "Sobrevuelo completado. Perímetro delimitado." },
      { actor: "Ricardo Vega G.", tipo: "Actividad", hora: "13:10", mensaje: "CONAFOR confirma envío de brigada adicional." },
      { actor: "Ricardo Vega G.", tipo: "Actividad", hora: "13:40", mensaje: "3 familias evacuadas preventivamente." },
      { actor: "Sistema Central", tipo: "Evidencia", hora: "13:55", mensaje: "Evidencias anexadas: 2 imágenes, 1 PDF, 1 video." },
    ],
  },

  // ── 10. R: Incendio en Lote Baldío ── 12:00
  {
    type: "reporte911", id: "911-2026-0144", isNew: false,
    relativeTime: "Hace 2 hr 25 min", timestamp: "05/03/2026, 12:00",
    autor: { nombre: "Héctor Garza Villarreal", iniciales: "HG", rol: "Operador de Campo - 911", avatarColor: "bg-rose-600" },
    folio: "911-2026-0144", titulo: "Incendio en Lote Baldío",
    descripcion: "Quema de basura en lote baldío sin control. El fuego se extendió hacia terreno vecino. Se controló con apoyo de 2 unidades de bomberos.",
    ubicacion: "Col. Moderno, Calle Río Bravo s/n", municipio: "Nuevo Laredo",
    estatus: "Atendido",
    images: [IMG.firefighterHose],
    kpis: { personal: 4, unidades: 2, atencionesPrehosp: 0, duracionMin: 60 },
    conteos: { actualizaciones: 5, actividades: 3, evidencias: 3 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "12:00", mensaje: "Reporte de incendio en lote baldío recibido." },
      { actor: "Héctor Garza Villarreal", tipo: "Estatus", hora: "12:08", mensaje: "En ruta con Unidad 03 y Bomberos." },
      { actor: "Héctor Garza Villarreal", tipo: "Actividad", hora: "12:25", mensaje: "Fuego controlado. Área perimetral resguardada." },
      { actor: "Héctor Garza Villarreal", tipo: "Evidencia", hora: "12:40", mensaje: "Evidencia fotográfica adjunta." },
      { actor: "Héctor Garza Villarreal", tipo: "Estatus", hora: "13:00", mensaje: "Incendio extinguido. Cierre de operativo." },
    ],
  },

  // ── 10b. NEW R: Caída de Espectacular ── 11:50
  {
    type: "reporte911", id: "911-2026-0150", isNew: false,
    relativeTime: "Hace 2 hr 35 min", timestamp: "05/03/2026, 11:50",
    autor: { nombre: "Fernando Cárdenas Lira", iniciales: "FC", rol: "Operador de Campo - 911", avatarColor: "bg-red-800" },
    folio: "911-2026-0150", titulo: "Caída de Espectacular",
    descripcion: "Estructura metálica de anuncio espectacular se desprendió por vientos fuertes y cayó sobre la acera. No hay lesionados. Se acordonó la zona y se solicitó retiro con grúa especializada.",
    ubicacion: "Blvd. Independencia esq. Av. Monterrey", municipio: "Altamira",
    estatus: "Atendido",
    images: [],
    kpis: { personal: 3, unidades: 2, atencionesPrehosp: 0, duracionMin: 90 },
    conteos: { actualizaciones: 4, actividades: 2, evidencias: 0 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "11:50", mensaje: "Reporte de caída de espectacular recibido vía 911." },
      { actor: "Fernando Cárdenas Lira", tipo: "Estatus", hora: "11:55", mensaje: "En ruta con Unidad 15 y grúa." },
      { actor: "Fernando Cárdenas Lira", tipo: "Actividad", hora: "12:10", mensaje: "Zona acordonada. Sin lesionados." },
      { actor: "Fernando Cárdenas Lira", tipo: "Estatus", hora: "13:20", mensaje: "Estructura retirada. Vialidad liberada." },
    ],
  },

  // ── 10c. NEW M: Alerta por Oleaje ── 11:42
  {
    type: "monitoreo", id: "MON-2026-0018", isNew: false,
    relativeTime: "Hace 2 hr 43 min", timestamp: "05/03/2026, 11:42",
    autor: { nombre: "Diana Salazar Moreno", iniciales: "DS", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-teal-700" },
    folio: "PC-2026-0018", titulo: "Alerta por Oleaje Elevado",
    descripcion: "Oleaje superior a 2.5 metros registrado en costa de Ciudad Madero. Se colocaron banderas rojas en 4 playas y se restringió acceso al mar. Coordinación con Capitanía de Puerto para alerta a embarcaciones menores.",
    ubicacion: "Zona Costera, Playa Tesoro", municipio: "Ciudad Madero",
    estatus: "En seguimiento",
    images: [],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 11:42 a.m.",
      municipio: "Ciudad Madero",
      localidad: "Zona Costera, Playa Tesoro",
      tipoMonitoreo: "Temporada de Lluvias",
      subtipoMonitoreo: "Datos Generales",
      datosMonitoreo: "Oleaje 2.5m; viento del NE a 45 km/h; mar de fondo; 4 playas con bandera roja",
      tipoAfectaciones: "No localizados",
      descripcionMonitoreo: "Se restringió acceso al mar en 4 playas. Coordinación con Capitanía de Puerto activa.",
    },
    detalles: {
      conteoPersonas: { hombres: 0, mujeres: 0, ninos: 0, ninas: 0, noIdentificados: 0 },
      totalPersonas: 0,
    },
    actividades: [
      { tipoActividad: "Recorrido", fechaHora: "05/03/2026 11:55", descripcion: "Colocación de banderas rojas en 4 playas. Restricción de acceso al mar." },
      { tipoActividad: "Coordinación", fechaHora: "05/03/2026 12:10", descripcion: "Alerta a Capitanía de Puerto y pescadores ribereños." },
    ],
    evidencias: [
      { kind: "pdf", nombre: "alerta_oleaje.pdf", src: "mock://monitoreo/madero/alerta_oleaje.pdf" },
    ],
    conteos: { actividades: 2, evidencias: 1 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "11:42", mensaje: "Monitoreo de oleaje registrado — Ciudad Madero." },
      { actor: "Diana Salazar M.", tipo: "Actividad", hora: "11:55", mensaje: "Banderas rojas colocadas en 4 playas." },
      { actor: "Diana Salazar M.", tipo: "Actividad", hora: "12:10", mensaje: "Capitanía de Puerto notificada." },
    ],
  },

  // ── 11. M: Evacuación Tampico ── 11:35
  {
    type: "monitoreo", id: "MON-2026-0011", isNew: false,
    relativeTime: "Hace 2 hr 50 min", timestamp: "05/03/2026, 11:35",
    autor: { nombre: "Patricia Herrera Domínguez", iniciales: "PH", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-cyan-700" },
    folio: "PC-2026-0011", titulo: "Temporada de Lluvias — Evacuación",
    descripcion: "Evacuación preventiva en zona ribereña por incremento del nivel del Río Tamesí. 45 familias reubicadas en refugio temporal.",
    ubicacion: "Col. Morelos, margen del Río Tamesí", municipio: "Tampico",
    estatus: "En seguimiento",
    images: [IMG.floodBoat, IMG.floodStreet, IMG.shelter],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 11:35 a.m.",
      municipio: "Tampico",
      localidad: "Col. Morelos, margen del Río Tamesí",
      tipoMonitoreo: "Temporada de Lluvias",
      subtipoMonitoreo: "Refugios y Evacuados",
      datosMonitoreo: "Río Tamesí: nivel 2.8m (alerta amarilla); flujo ascendente; se prevé pico en 6 horas",
      tipoAfectaciones: "Evacuados",
      descripcionMonitoreo: "Se realizó evacuación preventiva de 45 familias. Refugio habilitado en Escuela Secundaria Federal #3. Se mantiene monitoreo del nivel del río.",
    },
    detalles: {
      conteoPersonas: { hombres: 52, mujeres: 61, ninos: 34, ninas: 28, noIdentificados: 7 },
      totalPersonas: 182,
    },
    actividades: [
      { tipoActividad: "Evacuación", fechaHora: "05/03/2026 11:50", descripcion: "Inicio de evacuación puerta a puerta. 45 familias notificadas." },
      { tipoActividad: "Traslado", fechaHora: "05/03/2026 12:30", descripcion: "Traslado de familias al refugio temporal con apoyo de 3 unidades." },
      { tipoActividad: "Verificación", fechaHora: "05/03/2026 13:00", descripcion: "Verificación de viviendas desalojadas. Zona asegurada." },
      { tipoActividad: "Monitoreo de Río", fechaHora: "05/03/2026 13:30", descripcion: "Nivel del río en 2.8m. Tendencia ascendente. Siguiente lectura a las 16:00." },
    ],
    evidencias: [
      { kind: "image", nombre: "evacuacion_01.jpg", src: IMG.floodBoat },
      { kind: "image", nombre: "nivel_rio.jpg", src: IMG.floodStreet },
      { kind: "image", nombre: "refugio_tampico.jpg", src: IMG.shelter },
      { kind: "video", nombre: "evacuacion_video.mp4", src: "mock://monitoreo/tampico/evacuacion.mp4" },
      { kind: "pdf", nombre: "censo_evacuados.pdf", src: "mock://monitoreo/tampico/censo.pdf" },
    ],
    conteos: { actividades: 4, evidencias: 5 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "11:35", mensaje: "Monitoreo de lluvias registrado — Tampico, Río Tamesí." },
      { actor: "Patricia Herrera D.", tipo: "Actividad", hora: "11:50", mensaje: "Evacuación puerta a puerta iniciada." },
      { actor: "Patricia Herrera D.", tipo: "Actividad", hora: "12:30", mensaje: "45 familias trasladadas al refugio temporal." },
      { actor: "Patricia Herrera D.", tipo: "Actividad", hora: "13:00", mensaje: "Zona desalojada verificada y asegurada." },
      { actor: "Sistema Central", tipo: "Evidencia", hora: "13:10", mensaje: "Evidencias anexadas: 3 imágenes, 1 video, 1 PDF." },
      { actor: "Patricia Herrera D.", tipo: "Actividad", hora: "13:30", mensaje: "Lectura de nivel: 2.8m. Tendencia ascendente." },
    ],
  },

  // ── 12. R: Fuga de Gas LP ── 11:10
  {
    type: "reporte911", id: "911-2026-0139", isNew: false,
    relativeTime: "Hace 3 hr 15 min", timestamp: "05/03/2026, 11:10",
    autor: { nombre: "Jorge Ruiz Domínguez", iniciales: "JR", rol: "Operador de Campo - 911", avatarColor: "bg-emerald-600" },
    folio: "911-2026-0139", titulo: "Fuga de Gas LP",
    descripcion: "Se atendió reporte de fuga de gas LP en domicilio particular. Válvula dañada identificada y sellada. Sin lesionados. Se ventilaron las áreas afectadas.",
    ubicacion: "Col. Jardines de Champayán, Calle Jazmín #208", municipio: "Tampico",
    estatus: "Atendido",
    images: [IMG.hazmat],
    kpis: { personal: 3, unidades: 1, atencionesPrehosp: 0, duracionMin: 45 },
    conteos: { actualizaciones: 4, actividades: 3, evidencias: 2 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "11:10", mensaje: "Reporte de fuga de gas recibido del 911." },
      { actor: "Jorge Ruiz Domínguez", tipo: "Estatus", hora: "11:18", mensaje: "En ruta con equipo especializado." },
      { actor: "Jorge Ruiz Domínguez", tipo: "Actividad", hora: "11:35", mensaje: "Válvula dañada identificada y sellada. Área ventilada." },
      { actor: "Jorge Ruiz Domínguez", tipo: "Estatus", hora: "11:55", mensaje: "Situación controlada. Cierre de operativo." },
    ],
  },

  // ── 12b. NEW M: Revisión de Infraestructura ── 11:02
  {
    type: "monitoreo", id: "MON-2026-0019", isNew: false,
    relativeTime: "Hace 3 hr 23 min", timestamp: "05/03/2026, 11:02",
    autor: { nombre: "Arturo Delgado Vásquez", iniciales: "AD", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-amber-600" },
    folio: "PC-2026-0019", titulo: "Revisión de Infraestructura",
    descripcion: "Inspección programada de puentes peatonales y vehiculares en zona urbana. Se detectó fisura en estribo norte del puente sobre Arroyo El Coyote. Se notificó a SCT para evaluación estructural.",
    ubicacion: "Puente Arroyo El Coyote, Av. Industrias", municipio: "Río Bravo",
    estatus: "En validación",
    images: [],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 11:02 a.m.",
      municipio: "Río Bravo",
      localidad: "Av. Industrias",
      tipoMonitoreo: "Monitoreo Diario",
      subtipoMonitoreo: "Datos Generales",
      datosMonitoreo: "3 puentes inspeccionados; 1 con fisura en estribo norte; SCT notificada",
      tipoAfectaciones: "No localizados",
      descripcionMonitoreo: "Se recomienda restricción de carga pesada en puente afectado mientras SCT realiza evaluación.",
    },
    detalles: {
      conteoPersonas: { hombres: 0, mujeres: 0, ninos: 0, ninas: 0, noIdentificados: 0 },
      totalPersonas: 0,
    },
    actividades: [
      { tipoActividad: "Inspección", fechaHora: "05/03/2026 11:15", descripcion: "Inspección visual de 3 puentes. Fisura detectada en estribo norte." },
      { tipoActividad: "Coordinación", fechaHora: "05/03/2026 11:30", descripcion: "Notificación a SCT y Obras Públicas municipales." },
    ],
    evidencias: [
      { kind: "pdf", nombre: "inspeccion_puentes.pdf", src: "mock://monitoreo/riobravo/inspeccion.pdf" },
    ],
    conteos: { actividades: 2, evidencias: 1 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "11:02", mensaje: "Monitoreo de infraestructura registrado — Río Bravo." },
      { actor: "Arturo Delgado V.", tipo: "Actividad", hora: "11:15", mensaje: "Inspección completada. Fisura detectada." },
      { actor: "Arturo Delgado V.", tipo: "Actividad", hora: "11:30", mensaje: "SCT y Obras Públicas notificados." },
    ],
  },

  // ── 13. M: Temporada Invernal — San Fernando ── 10:45
  {
    type: "monitoreo", id: "MON-2026-0010", isNew: false,
    relativeTime: "Hace 3 hr 40 min", timestamp: "05/03/2026, 10:45",
    autor: { nombre: "Gabriela Mendoza Luna", iniciales: "GM", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-blue-800" },
    folio: "PC-2026-0010", titulo: "Temporada Invernal — Frente Frío",
    descripcion: "Monitoreo de frente frío #42. Temperatura registrada de 4°C. Se activaron 2 refugios para personas en situación de calle.",
    ubicacion: "Col. Centro, DIF Municipal", municipio: "San Fernando",
    estatus: "En validación",
    images: [IMG.winterStorm],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 10:45 a.m.",
      municipio: "San Fernando",
      localidad: "Col. Centro",
      tipoMonitoreo: "Temporada Invernal",
      subtipoMonitoreo: "Refugios y Evacuados",
      datosMonitoreo: "Frente frío #42; temperatura 4°C; viento NW 25 km/h; sensación térmica -2°C",
      tipoAfectaciones: "Damnificados",
      descripcionMonitoreo: "Se activaron 2 refugios en coordinación con DIF Municipal. Se distribuyeron cobijas y alimentos calientes.",
    },
    detalles: {
      conteoPersonas: { hombres: 12, mujeres: 8, ninos: 3, ninas: 2, noIdentificados: 5 },
      totalPersonas: 30,
    },
    actividades: [
      { tipoActividad: "Activación de Refugio", fechaHora: "05/03/2026 10:55", descripcion: "Se activan 2 refugios temporales en DIF y Casa de Cultura." },
      { tipoActividad: "Distribución", fechaHora: "05/03/2026 11:20", descripcion: "Se distribuyeron 50 cobijas y 30 raciones de alimento caliente." },
      { tipoActividad: "Recorrido", fechaHora: "05/03/2026 12:00", descripcion: "Recorrido en colonias para identificar personas en situación de calle." },
    ],
    evidencias: [
      { kind: "image", nombre: "refugio_invernal.jpg", src: IMG.winterStorm },
      { kind: "pdf", nombre: "censo_invernal.pdf", src: "mock://monitoreo/sanfernando/censo.pdf" },
    ],
    conteos: { actividades: 3, evidencias: 2 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "10:45", mensaje: "Monitoreo invernal registrado — San Fernando." },
      { actor: "Gabriela Mendoza L.", tipo: "Actividad", hora: "10:55", mensaje: "Refugios activados." },
      { actor: "Gabriela Mendoza L.", tipo: "Actividad", hora: "11:20", mensaje: "Distribución de cobijas y alimentos completada." },
      { actor: "Gabriela Mendoza L.", tipo: "Actividad", hora: "12:00", mensaje: "Recorrido de identificación en colonias completado." },
    ],
  },

  // ── 14. R: Árbol Caído ── 10:15
  {
    type: "reporte911", id: "911-2026-0143", isNew: false,
    relativeTime: "Hace 4 hr 10 min", timestamp: "05/03/2026, 10:15",
    autor: { nombre: "Adriana Flores Castillo", iniciales: "AF", rol: "Operadora de Campo - 911", avatarColor: "bg-teal-600" },
    folio: "911-2026-0143", titulo: "Árbol Caído sobre Vialidad",
    descripcion: "Árbol de gran tamaño caído sobre la vialidad obstruyendo ambos carriles. Se requiere motosierra y equipo pesado para retiro. No hay lesionados.",
    ubicacion: "Blvd. López Mateos, frente a Parque Bicentenario", municipio: "Ciudad Madero",
    estatus: "Atendido",
    images: [IMG.stormTree, IMG.hurricaneDamage],
    kpis: { personal: 4, unidades: 2, atencionesPrehosp: 0, duracionMin: 120 },
    conteos: { actualizaciones: 4, actividades: 3, evidencias: 4 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "10:15", mensaje: "Reporte de árbol caído sobre vialidad." },
      { actor: "Adriana Flores Castillo", tipo: "Estatus", hora: "10:25", mensaje: "En ruta con equipo de corte." },
      { actor: "Adriana Flores Castillo", tipo: "Actividad", hora: "11:00", mensaje: "Corte parcial completado. Un carril liberado." },
      { actor: "Adriana Flores Castillo", tipo: "Estatus", hora: "12:15", mensaje: "Árbol retirado completamente. Vialidad liberada." },
    ],
  },

  // ── 14b. NEW R: Intoxicación por Humo ── 10:02
  {
    type: "reporte911", id: "911-2026-0151", isNew: false,
    relativeTime: "Hace 4 hr 23 min", timestamp: "05/03/2026, 10:02",
    autor: { nombre: "Verónica Treviño Salazar", iniciales: "VT", rol: "Operadora de Campo - 911", avatarColor: "bg-purple-600" },
    folio: "911-2026-0151", titulo: "Intoxicación por Humo",
    descripcion: "Tres trabajadores de taller mecánico presentaron síntomas de intoxicación por humo tras incendio controlado en bodega contigua. Se brindó atención prehospitalaria y traslado preventivo a clínica IMSS.",
    ubicacion: "Col. Petrolera, Calle Olmos #315", municipio: "Tampico",
    estatus: "Atendido",
    images: [],
    kpis: { personal: 3, unidades: 1, atencionesPrehosp: 3, duracionMin: 55 },
    conteos: { actualizaciones: 4, actividades: 2, evidencias: 0 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "10:02", mensaje: "Reporte de intoxicación por humo recibido vía 911." },
      { actor: "Verónica Treviño Salazar", tipo: "Estatus", hora: "10:08", mensaje: "En ruta con ambulancia y equipo de primeros auxilios." },
      { actor: "Verónica Treviño Salazar", tipo: "Actividad", hora: "10:22", mensaje: "3 personas con intoxicación leve. Oxigenoterapia administrada." },
      { actor: "Verónica Treviño Salazar", tipo: "Estatus", hora: "10:57", mensaje: "Traslado completado a IMSS. Cierre de operativo." },
    ],
  },

  // ── 15. M: Monitoreo Diario — Nuevo Laredo ── 9:50 (sin imágenes)
  {
    type: "monitoreo", id: "MON-2026-0016", isNew: false,
    relativeTime: "Hace 4 hr 35 min", timestamp: "05/03/2026, 09:50",
    autor: { nombre: "Miguel Ángel Soto Pérez", iniciales: "MA", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-slate-600" },
    folio: "PC-2026-0016", titulo: "Monitoreo Diario",
    descripcion: "Recorrido de rutina sin novedades relevantes. Infraestructura vial en condiciones normales. Se verificaron 5 puntos de riesgo catalogados.",
    ubicacion: "Zona Centro y Col. Guerrero", municipio: "Nuevo Laredo",
    estatus: "Cerrado",
    images: [],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 09:50 a.m.",
      municipio: "Nuevo Laredo",
      localidad: "Zona Centro y Col. Guerrero",
      tipoMonitoreo: "Monitoreo Diario",
      subtipoMonitoreo: "Datos Generales",
      datosMonitoreo: "Recorrido de rutina en 5 puntos de riesgo catalogados",
      tipoAfectaciones: "No localizados",
      descripcionMonitoreo: "Sin novedades relevantes. Infraestructura vial en condiciones normales. Puntos de riesgo sin cambio respecto a último reporte.",
    },
    detalles: {
      conteoPersonas: { hombres: 0, mujeres: 0, ninos: 0, ninas: 0, noIdentificados: 0 },
      totalPersonas: 0,
    },
    actividades: [
      { tipoActividad: "Recorrido", fechaHora: "05/03/2026 10:05", descripcion: "Recorrido en 5 puntos catalogados como zonas de riesgo. Sin novedades." },
    ],
    evidencias: [
      { kind: "pdf", nombre: "bitacora_diaria.pdf", src: "mock://monitoreo/nlaredo/bitacora.pdf" },
    ],
    conteos: { actividades: 1, evidencias: 1 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "09:50", mensaje: "Monitoreo diario registrado — Nuevo Laredo." },
      { actor: "Miguel Á. Soto", tipo: "Actividad", hora: "10:05", mensaje: "Recorrido completado. Sin novedades." },
      { actor: "Miguel Á. Soto", tipo: "Estatus", hora: "10:30", mensaje: "Monitoreo cerrado. Sin incidentes." },
    ],
  },

  // ── 16. R: Persona Lesionada ── 9:20
  {
    type: "reporte911", id: "911-2026-0142", isNew: false,
    relativeTime: "Hace 5 hr 5 min", timestamp: "05/03/2026, 09:20",
    autor: { nombre: "Luis Ramírez Torres", iniciales: "LR", rol: "Operador de Campo - 911", avatarColor: "bg-orange-600" },
    folio: "911-2026-0142", titulo: "Persona Lesionada — Caída",
    descripcion: "Persona de la tercera edad con caída en escaleras del mercado. Atención prehospitalaria brindada y traslado al Hospital General.",
    ubicacion: "Mercado Argüelles, Zona Centro", municipio: "Matamoros",
    estatus: "Atendido",
    images: [IMG.civilTeam, IMG.paramedic],
    kpis: { personal: 2, unidades: 1, atencionesPrehosp: 1, duracionMin: 35 },
    conteos: { actualizaciones: 3, actividades: 2, evidencias: 2 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "09:20", mensaje: "Reporte de persona lesionada en mercado." },
      { actor: "Luis Ramírez Torres", tipo: "Actividad", hora: "09:35", mensaje: "Atención prehospitalaria brindada. Fractura de muñeca derecha." },
      { actor: "Luis Ramírez Torres", tipo: "Estatus", hora: "09:55", mensaje: "Traslado completado. Paciente en urgencias del Hospital General." },
    ],
  },

  // ── 16b. NEW R: Cable de Alta Tensión Caído ── 09:08
  {
    type: "reporte911", id: "911-2026-0152", isNew: false,
    relativeTime: "Hace 5 hr 17 min", timestamp: "05/03/2026, 09:08",
    autor: { nombre: "Enrique Salinas Garza", iniciales: "ES", rol: "Operador de Campo - 911", avatarColor: "bg-sky-700" },
    folio: "911-2026-0152", titulo: "Cable de Alta Tensión Caído",
    descripcion: "Cable de alta tensión caído sobre vialidad tras impacto de vehículo contra poste. Se acordonó un perímetro de 50 metros y se notificó a CFE para desconexión de línea. Tránsito desviado por rutas alternas.",
    ubicacion: "Av. Prolongación Canales, frente a CBTIS 24", municipio: "Reynosa",
    estatus: "Atendido",
    images: [],
    kpis: { personal: 4, unidades: 2, atencionesPrehosp: 0, duracionMin: 120 },
    conteos: { actualizaciones: 5, actividades: 3, evidencias: 0 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "09:08", mensaje: "Reporte de cable caído recibido vía 911." },
      { actor: "Enrique Salinas Garza", tipo: "Estatus", hora: "09:12", mensaje: "En ruta. CFE notificada para corte de suministro." },
      { actor: "Enrique Salinas Garza", tipo: "Actividad", hora: "09:25", mensaje: "Perímetro de 50m acordonado. Tránsito desviado." },
      { actor: "Enrique Salinas Garza", tipo: "Actividad", hora: "10:10", mensaje: "CFE confirma línea desconectada. Retiro de cable iniciado." },
      { actor: "Enrique Salinas Garza", tipo: "Estatus", hora: "11:08", mensaje: "Cable retirado. Poste señalizado. Cierre de operativo." },
    ],
  },

  // ── 16c. NEW M: Fumigación Preventiva ── 09:00
  {
    type: "monitoreo", id: "MON-2026-0020", isNew: false,
    relativeTime: "Hace 5 hr 25 min", timestamp: "05/03/2026, 09:00",
    autor: { nombre: "Isabel Coronado Flores", iniciales: "IC", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-lime-700" },
    folio: "PC-2026-0020", titulo: "Fumigación Preventiva",
    descripcion: "Jornada de fumigación contra mosquito transmisor de dengue en colonias con mayor incidencia. Se cubrieron 12 manzanas y se distribuyeron 200 volantes informativos a la población.",
    ubicacion: "Col. Ampliación Rodríguez Cano", municipio: "González",
    estatus: "Cerrado",
    images: [],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 09:00 a.m.",
      municipio: "González",
      localidad: "Col. Ampliación Rodríguez Cano",
      tipoMonitoreo: "Monitoreo Diario",
      subtipoMonitoreo: "Datos Generales",
      datosMonitoreo: "12 manzanas fumigadas; 200 volantes distribuidos; 0 casos activos confirmados",
      tipoAfectaciones: "No localizados",
      descripcionMonitoreo: "Fumigación completada sin incidentes. Se recomienda segunda jornada en 15 días.",
    },
    detalles: {
      conteoPersonas: { hombres: 0, mujeres: 0, ninos: 0, ninas: 0, noIdentificados: 0 },
      totalPersonas: 0,
    },
    actividades: [
      { tipoActividad: "Fumigación", fechaHora: "05/03/2026 09:15", descripcion: "Inicio de fumigación en 12 manzanas de Col. Ampliación Rodríguez Cano." },
      { tipoActividad: "Difusión", fechaHora: "05/03/2026 10:30", descripcion: "Distribución de 200 volantes sobre prevención de dengue." },
    ],
    evidencias: [
      { kind: "pdf", nombre: "bitacora_fumigacion.pdf", src: "mock://monitoreo/gonzalez/fumigacion.pdf" },
    ],
    conteos: { actividades: 2, evidencias: 1 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "09:00", mensaje: "Monitoreo de fumigación registrado — González." },
      { actor: "Isabel Coronado F.", tipo: "Actividad", hora: "09:15", mensaje: "Fumigación iniciada en 12 manzanas." },
      { actor: "Isabel Coronado F.", tipo: "Actividad", hora: "10:30", mensaje: "Distribución de volantes completada." },
      { actor: "Isabel Coronado F.", tipo: "Estatus", hora: "11:00", mensaje: "Jornada cerrada sin incidentes." },
    ],
  },

  // ── 17. M: Evento Socio-Organizativo — Matamoros ── 8:50
  {
    type: "monitoreo", id: "MON-2026-0013", isNew: false,
    relativeTime: "Hace 5 hr 35 min", timestamp: "05/03/2026, 08:50",
    autor: { nombre: "Sergio Cantú Hernández", iniciales: "SC", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-purple-700" },
    folio: "PC-2026-0013", titulo: "Evento Socio-Organizativo",
    descripcion: "Monitoreo preventivo en evento masivo. Concierto al aire libre con afluencia estimada de 5,000 personas. Se verificaron salidas de emergencia y módulos de atención.",
    ubicacion: "Plaza Principal, Zona Centro", municipio: "Matamoros",
    estatus: "Archivado",
    images: [IMG.festivalCrowd],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 08:50 a.m.",
      municipio: "Matamoros",
      localidad: "Plaza Principal, Zona Centro",
      tipoMonitoreo: "Evento Socio-Organizativo",
      subtipoMonitoreo: "Datos Generales",
      datosMonitoreo: "Concierto al aire libre; afluencia estimada 5,000 personas; 4 salidas de emergencia",
      tipoAfectaciones: "Heridos",
      descripcionMonitoreo: "Se verificaron salidas de emergencia, módulos de atención y vialidades de acceso. Evento transcurrió sin incidentes mayores.",
    },
    detalles: {
      conteoPersonas: { hombres: 2, mujeres: 1, ninos: 0, ninas: 0, noIdentificados: 0 },
      totalPersonas: 3,
    },
    actividades: [
      { tipoActividad: "Verificación", fechaHora: "05/03/2026 09:05", descripcion: "Inspección de salidas de emergencia y módulos de primeros auxilios." },
      { tipoActividad: "Primeros Auxilios", fechaHora: "05/03/2026 10:30", descripcion: "Atención a 3 personas por desmayo y deshidratación leve." },
    ],
    evidencias: [
      { kind: "image", nombre: "evento_panoramica.jpg", src: IMG.festivalCrowd },
      { kind: "pdf", nombre: "protocolo_evento.pdf", src: "mock://monitoreo/matamoros/protocolo.pdf" },
    ],
    conteos: { actividades: 2, evidencias: 2 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "08:50", mensaje: "Monitoreo de evento masivo registrado — Matamoros." },
      { actor: "Sergio Cantú H.", tipo: "Actividad", hora: "09:05", mensaje: "Inspección pre-evento completada." },
      { actor: "Sergio Cantú H.", tipo: "Estatus", hora: "13:00", mensaje: "Evento finalizado sin incidentes mayores. Archivado." },
    ],
  },

  // ── 18. R: Supuesto Derrame Químico (Falso reporte) ── 8:20
  {
    type: "reporte911", id: "911-2026-0140", isNew: false,
    relativeTime: "Hace 6 hr 5 min", timestamp: "05/03/2026, 08:20",
    autor: { nombre: "Daniel Ochoa Rivera", iniciales: "DO", rol: "Operador de Campo - 911", avatarColor: "bg-gray-500" },
    folio: "911-2026-0140", titulo: "Supuesto Derrame Químico",
    descripcion: "Se reportó derrame de sustancia en vía pública. Al llegar al sitio se identificó como agua acumulada con coloración por tierra. No se detectó riesgo químico alguno.",
    ubicacion: "Col. Industrial, Calle 12 esq. Av. del Trabajo", municipio: "Altamira",
    estatus: "Falso reporte",
    images: [],
    kpis: { personal: 2, unidades: 1, atencionesPrehosp: 0, duracionMin: 20 },
    conteos: { actualizaciones: 3, actividades: 1, evidencias: 1 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "08:20", mensaje: "Reporte de posible derrame químico recibido." },
      { actor: "Daniel Ochoa Rivera", tipo: "Actividad", hora: "08:35", mensaje: "Llegada al sitio. Se verifica que es agua con sedimento de tierra. Sin riesgo." },
      { actor: "Daniel Ochoa Rivera", tipo: "Estatus", hora: "08:40", mensaje: "Clasificado como falso reporte. Cierre." },
    ],
  },

  // ── 18b. NEW R: Deslizamiento de Tierra ── 08:05
  {
    type: "reporte911", id: "911-2026-0153", isNew: false,
    relativeTime: "Hace 6 hr 20 min", timestamp: "05/03/2026, 08:05",
    autor: { nombre: "Óscar Cantú Ríos", iniciales: "OC", rol: "Operador de Campo - 911", avatarColor: "bg-stone-600" },
    folio: "911-2026-0153", titulo: "Deslizamiento de Tierra",
    descripcion: "Deslizamiento de tierra sobre carretera rural tras saturación de suelo por lluvias. Tramo bloqueado en ambos sentidos. Se coordinó con SCT para maquinaria pesada y desvío vehicular por camino alterno.",
    ubicacion: "Carretera El Mante-Ocampo, Km 18", municipio: "El Mante",
    estatus: "En Proceso",
    images: [],
    kpis: { personal: 5, unidades: 2, atencionesPrehosp: 0, duracionMin: 180 },
    conteos: { actualizaciones: 4, actividades: 2, evidencias: 0 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "08:05", mensaje: "Reporte de deslizamiento de tierra recibido vía 911." },
      { actor: "Óscar Cantú Ríos", tipo: "Estatus", hora: "08:12", mensaje: "En ruta. SCT notificada para maquinaria." },
      { actor: "Óscar Cantú Ríos", tipo: "Actividad", hora: "08:40", mensaje: "Tramo bloqueado. Desvío por camino alterno señalizado." },
      { actor: "Óscar Cantú Ríos", tipo: "Estatus", hora: "09:15", mensaje: "Maquinaria SCT en sitio. Remoción de tierra en curso." },
    ],
  },

  // ── 19. M: 1er Periodo Vacacional — Valle Hermoso ── 7:40 (sin imágenes)
  {
    type: "monitoreo", id: "MON-2026-0014", isNew: false,
    relativeTime: "Hace 6 hr 45 min", timestamp: "05/03/2026, 07:40",
    autor: { nombre: "Elena Martínez Cruz", iniciales: "EM", rol: "Operador de Campo - Monitoreo", avatarColor: "bg-pink-600" },
    folio: "PC-2026-0014", titulo: "1er Periodo Vacacional",
    descripcion: "Monitoreo preventivo en carreteras y zonas recreativas durante periodo vacacional. Flujo vehicular moderado. Sin incidentes reportados.",
    ubicacion: "Carretera Valle Hermoso-Matamoros, Km 8", municipio: "Valle Hermoso",
    estatus: "Cerrado",
    images: [],
    datosGenerales: {
      fechaHoraRegistro: "05/03/2026, 07:40 a.m.",
      municipio: "Valle Hermoso",
      localidad: "Carretera Valle Hermoso-Matamoros, Km 8",
      tipoMonitoreo: "1er Periodo Vacacional",
      subtipoMonitoreo: "Datos Generales",
      datosMonitoreo: "Flujo vehicular moderado; sin accidentes reportados; señalización revisada",
      tipoAfectaciones: "No localizados",
      descripcionMonitoreo: "Recorrido preventivo en tramo carretero. Señalización en buen estado. Se verificaron bahías de descanso.",
    },
    detalles: {
      conteoPersonas: { hombres: 0, mujeres: 0, ninos: 0, ninas: 0, noIdentificados: 0 },
      totalPersonas: 0,
    },
    actividades: [
      { tipoActividad: "Recorrido", fechaHora: "05/03/2026 07:55", descripcion: "Recorrido carretero de 40 km. Señalización OK. Bahías de descanso limpias." },
    ],
    evidencias: [
      { kind: "pdf", nombre: "bitacora_vacacional.pdf", src: "mock://monitoreo/vallehermoso/bitacora.pdf" },
    ],
    conteos: { actividades: 1, evidencias: 1 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "07:40", mensaje: "Monitoreo vacacional registrado — Valle Hermoso." },
      { actor: "Elena Martínez C.", tipo: "Actividad", hora: "07:55", mensaje: "Recorrido carretero completado sin novedades." },
      { actor: "Elena Martínez C.", tipo: "Estatus", hora: "08:30", mensaje: "Monitoreo cerrado. Sin incidentes." },
    ],
  },

  // ── 20. R: Búsqueda de Menor Extraviado ── 7:00
  {
    type: "reporte911", id: "911-2026-0141", isNew: false,
    relativeTime: "Hace 7 hr 25 min", timestamp: "05/03/2026, 07:00",
    autor: { nombre: "Ana Vázquez López", iniciales: "AV", rol: "Operadora de Campo - 911", avatarColor: "bg-violet-600" },
    folio: "911-2026-0141", titulo: "Búsqueda de Menor Extraviado",
    descripcion: "Se reportó menor de 8 años extraviado en zona de mercado. Tras 45 minutos de búsqueda coordinada, el menor fue localizado por familiares en área de juegos cercana.",
    ubicacion: "Mercado de la Zona Norte, Av. Hidalgo", municipio: "Reynosa",
    estatus: "Atendido",
    images: [IMG.rescueWorkers],
    kpis: { personal: 6, unidades: 2, atencionesPrehosp: 0, duracionMin: 50 },
    conteos: { actualizaciones: 6, actividades: 4, evidencias: 1 },
    trazabilidad: [
      { actor: "Sistema Central", tipo: "Sistema", hora: "07:00", mensaje: "Reporte de menor extraviado recibido." },
      { actor: "Ana Vázquez López", tipo: "Estatus", hora: "07:05", mensaje: "En camino. Se activa protocolo de búsqueda." },
      { actor: "Ana Vázquez López", tipo: "Actividad", hora: "07:15", mensaje: "Llegada al mercado. Inicio de búsqueda coordinada con seguridad del inmueble." },
      { actor: "Ana Vázquez López", tipo: "Actividad", hora: "07:30", mensaje: "Se amplía perímetro de búsqueda a 3 cuadras." },
      { actor: "Ana Vázquez López", tipo: "Actividad", hora: "07:45", mensaje: "Menor localizado por familiares en área de juegos. Se verifica estado de salud: sin lesiones." },
      { actor: "Ana Vázquez López", tipo: "Estatus", hora: "07:50", mensaje: "Menor entregado a tutores. Cierre de operativo." },
    ],
  },
];

/* ─── Helpers ─── */
export function getFeedItemById(id: string): FeedItem | undefined {
  // First check mock data
  const mock = feedItems.find((item) => item.id === id);
  if (mock) return mock;
  // Then check submitted reports from localStorage
  try {
    const raw = localStorage.getItem("pc-tamaulipas-reports");
    if (raw) {
      const submitted = JSON.parse(raw) as any[];
      const found = submitted.find((r: any) => r.id === id);
      if (found) {
        // Inline conversion to avoid circular imports
        const initials = (found.reportadoPor || "PC").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
        const COLORS = ["bg-red-600","bg-blue-600","bg-emerald-700","bg-amber-700","bg-indigo-600","bg-cyan-600","bg-rose-600","bg-primary"];
        const cIdx = found.id.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % COLORS.length;
        const diffMin = Math.floor((Date.now() - found.sentAt) / 60000);
        const relTime = diffMin < 1 ? "Hace un momento" : diffMin < 60 ? `Hace ${diffMin} min` : `Hace ${Math.floor(diffMin / 60)} hr`;
        const statusMap: Record<string, string> = { alta: "En Atención", media: "Registrado", baja: "Registrado" };
        const images = found.imageDataUrl ? [found.imageDataUrl] : [];
        const hora = (found.timestamp || "").split(", ")[1] || "00:00";
        const trazabilidad: TrazabilidadItem[] = [
          { actor: "Sistema Central", tipo: "Sistema", hora, mensaje: `Reporte de ${(found.tipoEmergencia || "emergencia").toLowerCase()} recibido desde app móvil de Personal de Campo.` },
          { actor: found.reportadoPor || "Personal de Campo", tipo: "Estatus", hora, mensaje: `Reporte enviado desde campo. Prioridad: ${(found.prioridad || "media").toUpperCase()}.` },
        ];
        if (found.imageDataUrl) {
          trazabilidad.push({ actor: found.reportadoPor || "Personal de Campo", tipo: "Evidencia", hora, mensaje: "Evidencia fotográfica adjunta desde dispositivo móvil." });
        }
        return {
          type: "reporte911", id: found.id, isNew: true,
          isPinned: found.prioridad === "alta",
          relativeTime: relTime, timestamp: found.timestamp,
          autor: { nombre: found.reportadoPor || "Personal de Campo (sin identificar)", iniciales: initials, rol: "Operador de Campo - 911", avatarColor: COLORS[cIdx] },
          folio: found.folio, titulo: found.tipoEmergencia || "Emergencia General",
          descripcion: found.descripcion || "Pendiente de captura — Lorem ipsum dolor sit amet.",
          ubicacion: found.ubicacion || "Ubicación pendiente de registro", municipio: found.municipio || "Ciudad Victoria",
          coords: found.lat != null && found.lng != null ? { lat: found.lat, lng: found.lng } : undefined,
          estatus: statusMap[found.prioridad] || "Registrado",
          images,
          kpis: { personal: found.prioridad === "alta" ? 4 : 2, unidades: found.prioridad === "alta" ? 2 : 1, atencionesPrehosp: 0, duracionMin: 0 },
          conteos: { actualizaciones: trazabilidad.length, actividades: 1, evidencias: found.imageDataUrl ? 1 : 0 },
          trazabilidad,
        } as Reporte911;
      }
    }
  } catch { /* ignore */ }
  return undefined;
}
