Actúa como un Senior UX/UI Designer especializado en Aplicaciones Móviles de Misión Crítica (Field Service Management). Necesito que diseñes un prototipo de alta fidelidad para la "App Móvil Operativa de Protección Civil".
Te he adjuntado documentos de referencia (PDFs y resúmenes) que contienen las reglas de negocio exactas, los campos de los formularios y el flujo (Puntos 6.2 y 12 del Análisis, y Datos de Monitoreo). Por favor, extrae de ahí los nombres exactos de los campos y menús.
1. REGLAS DE DISEÑO UI/UX (Misión Crítica en Campo):
Colores Institucionales: Usa Guinda (Color Primario), Dorado (Secundario) y Blanco/Gris claro (Fondos).
High-Glare UX (Para exteriores): Alto contraste. Evita fondos blanco puro (#FFFFFF) para reducir el deslumbramiento bajo el sol; usa grises muy claros. Textos pesados (bold/semi-bold) e iconos rellenos (solid-fill).
One-Handed Use (Zona del Pulgar): Todo el personal usará la app con una sola mano. La navegación y los botones de acción principales ("Guardar", "Agregar Evidencia", "Cambiar Estatus") DEBEN estar fijados en la parte inferior de la pantalla (Bottom Bar o Floating Action Buttons gigantes).
Indicador Offline: Todas las pantallas operativas deben tener un pequeño icono en la cabecera indicando el estado de conectividad (Online / Trabajando Offline).
2. ESTRUCTURA DEL PROTOTIPO Y ROLES: Como esto es un prototipo para demostrar la arquitectura del sistema, la primera pantalla debe permitir al usuario elegir qué experiencia quiere ver.
Por favor, diseña las siguientes pantallas organizadas en 4 flujos:
PANTALLA 0: Login / Selector de Rol (Punto de partida del prototipo)
Diseño: Una pantalla limpia con espacio para el Logo Institucional de Protección Civil.
Funcionalidad: En lugar de un usuario y contraseña tradicional, diseña 3 botones o tarjetas grandes y visuales que actúen como selector de perfil para la demostración.
Opciones:
Entrar como "Personal de Campo (911)"
Entrar como "Personal de Campo (Monitoreo)"
Entrar como "Coordinador Regional (Supervisor)" (Dependiendo de lo que se elija aquí, la app enrutará a uno de los siguientes 3 flujos).
FLUJO 1: Personal de Campo (Reacción y Reportes 911)
Pantalla 1.1 - Feed de Tareas: Un listado de tarjetas (Cards) con los reportes 911 asignados. Cada tarjeta muestra Folio único, Tipo de Incidente, Ubicación y Estatus (Ej: "En Proceso").
Pantalla 1.2 - Detalle y Seguimiento del Reporte: Al abrir una tarjeta, la información original del 911 aparece bloqueada (Solo Lectura). En la parte inferior, diseña un área de acción que permita: Cambiar Estatus (Ej. a "En atención" o "Atendido"), un botón para seleccionar "Agregar Actividad" y botones grandes de Cámara/Galería para "Subir Evidencia multimedia". Nota: Revisa el documento adjunto (Punto 12) para ver los campos exactos del reporte.
FLUJO 2: Personal de Campo (Prevención y Monitoreo)
Pantalla 2.1 - Dashboard de Monitoreo: Historial de monitoreos recientes y un botón flotante (FAB) gigante "+ Nuevo Monitoreo".
Pantalla 2.2 - Formulario de Monitoreo (Wizard por pasos):
Paso 1: Ubicación y Clasificación (Tipo y Subtipo de monitoreo desde dropdowns).
Paso 2: Censo Poblacional. Diseña contadores rápidos visuales (+ / -) para Hombres, Mujeres, Niños, Niñas y No identificados. (Revisa el PDF "DATOS MONITOREO" adjunto para inspirarte en los campos).
Paso 3: Obligatorio registrar una actividad y subir fotos antes de mostrar el botón "Guardar".
FLUJO 3: Coordinador Regional (Supervisión "Ojo de Dios")
Restricción Crítica: Este perfil es estrictamente de SOLO LECTURA. No dibujes ningún botón de "Editar", "Agregar Actividad" o "Subir Evidencia" en estas pantallas.
Pantalla 3.1 - Centro de Notificaciones en Tiempo Real: Su pantalla principal. Un feed tipo línea de tiempo con tarjetas de alerta (Ej: "Nuevo reporte 911 asignado", "El operativo actualizó el Folio X a 'Atendido'").
Pantalla 3.2 - Vista de Auditoría y Trazabilidad: Al tocar una notificación, entra al detalle. Muestra un mapa de ubicación, una bitácora silenciosa (timeline cronológico de a qué hora llegó el personal) y una galería para abrir las fotos/evidencias subidas por el equipo de campo.
Instrucción Final: Genera las pantallas con un diseño moderno, espacioso y enfocado en la usabilidad en campo. Asegúrate de que la "Pantalla 0" sea el ancla que conecta con los otros tres flujos.