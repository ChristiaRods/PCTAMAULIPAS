# REPORTES 911 Y MONITOREO

Aplicación móvil operativa de Protección Civil Tamaulipas (React + Vite + Supabase Edge Functions).

## Qué incluye

- Flujo por roles:
  - Personal de Campo (911)
  - Personal de Campo (Monitoreo)
  - Coordinador Regional (Supervisión)
- Reportes 911 con guardado local + sincronización servidor.
- Monitoreo con guardado local + sincronización servidor.
- Feed del supervisor con datos mock + datos reales capturados.
- Notificaciones push (suscripción, envío test, envío personalizado, detalle y deep-link).
- Ajustes por rol (nombre visible y avatar).
- PWA lista para instalación.

## Requisitos

- Node.js 20+ (incluye npm)
- Proyecto Supabase activo
- Supabase CLI (para publicar las funciones Edge)

## Variables de entorno

1. Copia `.env.example` a `.env`.
2. Configura:

```bash
VITE_SUPABASE_PROJECT_ID=tu_project_id
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_SUPABASE_FUNCTION_NAME=make-server-aac1ff1a
```

## Correr local

```bash
npm install
npm run dev
```

## Build producción

```bash
npm run build
npm run preview
```

## Supabase (backend)

### 1) Login y link de proyecto

```bash
supabase login
supabase link --project-ref <TU_PROJECT_ID>
```

### 2) Secretos requeridos para Edge Functions

```bash
supabase secrets set SUPABASE_URL=https://<TU_PROJECT_ID>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<TU_SERVICE_ROLE_KEY>
```

### 3) Publicar función

```bash
supabase functions deploy server
```

### 4) Ejecutar SQL base (KV table)

En Supabase SQL Editor, ejecuta el archivo:

- [setup.sql](C:\Users\Christian\Downloads\REPORTES911YMONITOREO\supabase\setup.sql)

La app consume los endpoints bajo:
`https://<PROJECT_ID>.supabase.co/functions/v1/make-server-aac1ff1a`

## Despliegue en Vercel

1. Sube este repo a GitHub.
2. Importa el repo en Vercel.
3. En `Environment Variables` agrega:
   - `VITE_SUPABASE_PROJECT_ID`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_FUNCTION_NAME`
4. Deploy.

`vercel.json` ya está configurado para Vite + SPA rewrites.

## Checklist rápida post-deploy

1. Entrar con cada rol.
2. Crear reporte 911 y verificar aparición en Supervisor.
3. Crear monitoreo y verificar aparición en Supervisor.
4. Adjuntar evidencia en reporte/monitoreo y confirmar que queda en URL de Storage.
5. Suscribir push y enviar notificación de prueba.
6. Abrir notificación y validar deep-link a Alertas.
