A continuación te dejo **solo lo extraído** de los apartados **6.1, 6.2 y 12** (listo para pegarlo tal cual en un prompt y que otra IA lo use como “datos duros”).

---

## 6.1 Requerimientos de la App Móvil (accesos rápidos, botones, validaciones)

### Autenticación / Acceso / Alcance por Centro Regional

* **RF01 Autenticación institucional:** inicio de sesión con credenciales institucionales validadas contra el sistema administrativo. 
* **RF02 Validación de acceso móvil:** solo usuarios con permiso habilitado para uso de app móvil pueden acceder. 
* **RF03 Identificación de Centro Regional:** al iniciar sesión identifica automáticamente el Centro Regional del usuario. 
* **RF04 Restricción por Centro Regional:** la app muestra únicamente información del Centro Regional del usuario autenticado. 

### Dashboard (accesos rápidos)

* **RF05 Dashboard operativo:** accesos rápidos a **Registro de Reporte, Seguimiento, Monitoreo y Notificaciones**. 

### Reportes 911 (listado / búsqueda / detalle / registro / seguimiento)

* **RF06 Listado de reportes 911:** muestra reportes asignados o correspondientes al Centro Regional. 
* **RF07 Búsqueda:** por folio 911, folio PC o descripción (parcial o completa). 
* **RF08 Filtros:** por estatus y municipio. 
* **RF09 Detalle de reporte:** info general en **modo solo lectura**. 
* **RF10 Registro de reporte nuevo:** captura tipo de incidente y descripción breve. 
* **RF11 Captura de ubicación:** municipio, localidad, referencia y ubicación geográfica (mapa/GPS). 
* **RF12 Folio automático:** genera folio único y fecha/hora de registro. 
* **RF13 Seguimiento operativo:** registrar actividades y evidencias **sin modificar** incidente original. 
* **RF14 Actividades:** catálogo + descripción breve. 
* **RF15 Listado cronológico de actividades:** con fecha/hora y usuario. 
* **RF16 Evidencias:** anexar fotos, documentos, audios, videos. 
* **RF17 Visualización de evidencias:** listado o vista previa. 
* **RF18 Cambio de estatus operativo:** a **En atención, Atendida, Falso reporte, No localizado**. 
* **RF19 Al iniciar “En atención”:** registra automáticamente fecha/hora y coordenadas (si GPS disponible). 
* **RF20 Bloqueo por estatus final:** si reporte está Resuelto/Cerrado/Archivado → **solo lectura** y sin acciones de captura. 

### Monitoreo

* **RF21 Listado de monitoreos:** del Centro Regional. 
* **RF22 Registro de monitoreo:** municipio, localidad y fecha/hora automática. 
* **RF23 Tipo/subtipo:** desde catálogos administrativos. 
* **RF24 Afectaciones:** desde catálogo. 
* **RF25 Descripción libre de monitoreo.** 
* **RF26 Conteo de personas:** hombres, mujeres, niños, niñas, no identificados; total automático. 
* **RF27 Actividades asociadas al monitoreo.** 
* **RF28 Validación mínima:** no guardar sin al menos 1 actividad registrada. 

### Notificaciones / Bitácora / Integración

* **RF29 Notificaciones operativas:** por asignación, actualización o cierre (reportes/monitoreos). 
* **RF30 Redirección por notificación:** abre reporte o monitoreo correspondiente. 
* **RF31 Marcar como leída:** automáticamente al abrir. 
* **RF32 Orden:** primero nuevas; orden por fecha descendente. 
* **RF33 Bitácora:** registra acciones relevantes (estatus, actividad, evidencia). 
* **RF34 Integración con sistema administrativo:** sincroniza para control y cierre formal. 

---

## 6.2 Modelado de módulos (flujo exacto de pantallas y reglas de navegación)

### Flujo base (Login → Dashboard → Reportes → Detalle/Seguimiento)

* **Login:** validar credenciales; si válidas permite acceso **solo si tiene permitido usar app móvil**; si inválidas mostrar error. 
* Tras login: identificar Centro Regional del usuario. 
* Mostrar únicamente reportes/monitoreos/notificaciones del Centro Regional. 
* Dashboard con accesos rápidos a módulos: **Registrar reporte nuevo**, **Seguimiento a reportes**, **Registro de monitoreo**, **Notificaciones**. 

### Módulo: Registro de Reportes 911 (captura completa)

* Al iniciar registro: generar folio único automático y mostrarlo **solo lectura** + fecha/hora. 
* Permitir registrar:

  * Datos generales: **Tipo de incidente (catálogo)** + **descripción breve**. 
  * Ubicación: **municipio, localidad (catálogos), dirección, referencia, ubicación geográfica**; **todo obligatorio excepto dirección**. 
  * Actividades: **tipo de actividad (catálogo)** + **descripción breve**. 
* Evidencias posteriores a actividades: cámara (fotos) + galería (documentos/audios/videos). 
* Guardado debe asociar y almacenar: folio, datos incidente, ubicación, actividades, evidencias (para seguimiento en administrativa). 

### Módulo: Seguimiento de Reportes 911 (listado → detalle informativo → acciones)

* Listado de reportes 911 asignados del Centro Regional. 
* Búsqueda: por folio 911, folio PC o descripción (parcial o completa) sobre el listado visible del Centro Regional. 
* Seleccionar un reporte: **sin modificar datos originales del incidente**. 
* Detalle informativo (solo lectura): folio, tipo incidente, fecha/hora, ubicación, estatus. 
* Desde detalle: entrar a Seguimiento para documentar atención en campo. 
* Actualización de estatus:

  * “En atención”: guardar automáticamente fecha/hora inicio. 
  * “Atendido / Falso reporte / No localizado”: puede añadir observaciones; **para estos cierres es obligatorio**: ≥1 actividad + ≥1 evidencia + comentario. 

### Módulo: Registro de Monitoreo

* Pantalla inicial: barra de búsqueda + listado + botón **“+ Nuevo”**. 
* Placeholder buscador: “Buscar por folio, tipo o municipio…”. 
* Listado mínimo: folio, tipo/nombre, municipio, fecha registro, usuario responsable, estatus. 
* Nuevo monitoreo (formulario por secciones):

  * Fecha/hora automática **solo lectura**. 
  * Ubicación obligatoria: municipio y localidad. 
  * Tipo/subtipo (dependiente) + datos del monitoreo desde catálogos + tipo de afectaciones (catálogo). 
  * Descripción libre. 
  * Conteo de personas (desglose) + total automático. 
  * Actividades (catálogo + descripción). 
  * Si no hay actividades: mostrar mensaje informativo y exigir al menos 1 antes de guardar. 

### Módulo: Notificaciones (listado y redirecciones)

* Acceso directo “Notificaciones” en Dashboard. 
* Cada notificación incluye mínimo: título, descripción (1–2 líneas), fecha/hora, indicador “Nueva” o antigüedad. 
* Casos mínimos: nuevo reporte asignado, actualización de reporte pendiente/en atención, actualización de monitoreo, reporte atendido. 
* Al seleccionar notificación: redirigir a pantalla correspondiente (reporte o monitoreo). 
* Si corresponde a “Reporte Atendido”: abrir detalle en **solo lectura** y ocultar/deshabilitar acciones de captura (agregar actividad, anexar evidencia, guardar). 
* Marcar como leída al abrir; ordenar nuevas primero y luego por fecha descendente; si no hay, mostrar “No tienes notificaciones”. 
* Consideración offline y control: guardar info sin conectividad; descargar reportes a seguir para capturar evidencias/actividades y luego sincronizar; registrar hora de llegada e inicio; bitácora automática por cambio de estatus. 

---

## 12 Ficha de datos de la App Móvil (campos exactos de formularios)

### A) Registro de Reportes del 911 → Sección INCIDENTES (campos)

**Campos informativos / sistema**

* **Folio 911:** autogenerado al guardar. 
* **Fecha y hora del registro:** se inicializa con fecha/hora actual; **se permite editar si fuera necesario**. 

**Campos capturados por el usuario**

* **Tipo de incidente:** catálogo (administrativa) con **autocompletado**. 
* **Descripción del incidente:** texto libre. 
* **Municipio:** obligatorio; catálogo filtrado a municipios del Centro Regional del usuario. 
* **Localidad:** obligatoria; filtrada al municipio seleccionado. 
* **Ubicación en mapa:** selección en mapa o captura automática del dispositivo; permitir selección manual. 
* **Dirección:** desglosada (calle, colonia, número) **opcional**. 
* **Referencia:** **opcional**. 

### B) Registro de Reportes del 911 → Sección ACTIVIDADES

* **Tipo de actividad:** catálogo (administrativa). 
* **Descripción de la actividad:** texto libre. 
* **Elemento mostrado:** listado de actividades registradas. 

### C) Registro de Reportes del 911 → Sección EVIDENCIAS

* Evidencias asociadas al reporte; mostrar **listado/vista previa**. 
* Permitir añadir evidencias con formatos: **fotografías, PDF, audios, videos**. 

### D) Seguimiento de Reportes 911 → Listado de reportes asignados (campos visibles y filtros)

* Acceso desde dashboard o notificación; solo reportes del Centro Regional. 
* Por reporte mostrar: folio 911, tipo incidente, descripción breve, municipio/localidad, fecha/hora registro, estatus (Registrado/En proceso/En atención). 
* Funcionalidades: búsqueda (folio 911, folio PC, descripción) + filtros por estatus y municipio. 
* Restricción: no modificar datos originales del incidente ni ubicación. 

### E) Seguimiento de Reportes 911 → Detalle / Registro de información (solo lectura + captura)

* Solo lectura: descripción, ubicación, fecha y hora del registro. 
* Confirmación de ubicación: ubicación actual con coordenadas o marcando en mapa. 
* Captura en seguimiento:

  * Actividades: tipo (catálogo) + descripción. 
  * Listado cronológico de actividades. 
  * Evidencias: fotos/documentos/audios/videos; captura por cámara o archivos del dispositivo; listado/vista previa. 
* Reglas: seguimiento sobre reporte ya registrado; incidente/ubicación en solo lectura; solo anexar evidencias y actividades; si estatus es Atendido → solo informativo sin agregar actividades/evidencias. 

### F) Registro de Monitoreo (listado + nuevo)

* En listado mostrar: folio (PC-AAAA-XXXX), título/tipo, municipio, fecha del monitoreo, responsable, fecha/hora registro, estatus (Activo/Cerrado). 
* Búsqueda placeholder: “Buscar por folio, tipo o municipio…” + filtros por estatus y municipio. 
* Nuevo monitoreo:

  * Fecha/hora automática solo lectura; municipio/localidad obligatorios. 
  * Detalles: tipo (catálogo), subtipo dependiente, datos del monitoreo, tipo de afectaciones (catálogo), descripción. 
  * Conteo de personas: hombres, mujeres, niñas, niños, no identificados. 
  * Actividades: listado con tipo/descr/fecha-hora; opción agregar actividad (validación ≥1); opción adjuntar evidencias. 
  * Al guardar: genera folio; queda en listado; asociado a Centro Regional y usuario. 

### G) Notificaciones (campos visibles y validaciones)

* Acceso en dashboard; puede llevar badge/contador. 
* Cada notificación muestra: título (ejemplos), descripción breve, fecha/hora, etiqueta (Nueva o antigüedad), ícono por tipo. 
* Tipos: nuevo reporte asignado, actualización de reporte pendiente/en proceso, actualización de monitoreo, reporte solucionado/Atendido. 
* Reglas: más recientes primero; nuevas se distinguen visualmente; **no permitir acciones de captura cuando el reporte esté Atendido**; consistencia entre tipo, estatus y acciones. 

---

Si quieres, con esto puedo armarte un **bloque “Datos del sistema” en formato JSON** (ideal para prompts de IA) sin inventar nada, únicamente transformando lo anterior a estructura.
