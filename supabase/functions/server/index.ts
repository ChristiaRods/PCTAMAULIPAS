import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";
import {
  generateVAPIDKeys,
  sendPushNotification,
  type VAPIDKeys,
  type PushPayload,
} from "./web-push.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();
const ROUTE_PREFIXES = ["", "/server", "/make-server-aac1ff1a"] as const;

function prefixedPaths(path: string): string[] {
  return ROUTE_PREFIXES.map((prefix) => {
    const normalized = `${prefix}${path}`.replace(/\/+/g, "/");
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  });
}

function routeGet(path: string, handler: Parameters<typeof app.get>[1]) {
  for (const p of prefixedPaths(path)) app.get(p, handler);
}

function routePost(path: string, handler: Parameters<typeof app.post>[1]) {
  for (const p of prefixedPaths(path)) app.post(p, handler);
}

function routeDelete(path: string, handler: Parameters<typeof app.delete>[1]) {
  for (const p of prefixedPaths(path)) app.delete(p, handler);
}

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "x-transcription-secret"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SUPABASE STORAGE â€” Notification attachments bucket
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const ATTACHMENT_BUCKET = "make-aac1ff1a-notif-attachments";
const EVIDENCE_BUCKET = "make-aac1ff1a-evidence";

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Idempotently create storage buckets on startup
(async () => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: buckets } = await supabase.storage.listBuckets();
    const attachmentBucketExists = buckets?.some((b: any) => b.name === ATTACHMENT_BUCKET);
    const evidenceBucketExists = buckets?.some((b: any) => b.name === EVIDENCE_BUCKET);
    if (!attachmentBucketExists) {
      await supabase.storage.createBucket(ATTACHMENT_BUCKET, { public: false });
      console.log(`Storage bucket created: ${ATTACHMENT_BUCKET}`);
    } else {
      console.log(`Storage bucket exists: ${ATTACHMENT_BUCKET}`);
    }
    if (!evidenceBucketExists) {
      await supabase.storage.createBucket(EVIDENCE_BUCKET, { public: true });
      console.log(`Storage bucket created: ${EVIDENCE_BUCKET}`);
    } else {
      console.log(`Storage bucket exists: ${EVIDENCE_BUCKET}`);
    }
  } catch (err) {
    console.log(`Warning: Could not initialize storage buckets: ${err}`);
  }
})();

// Health check endpoint
routeGet("/health", (c) => {
  return c.json({ status: "ok" });
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PUSH NOTIFICATIONS â€” VAPID Keys
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const VAPID_KV_KEY = "push:vapid_keys";
const VAPID_SUBJECT = "mailto:proteccioncivil@tamaulipas.gob.mx";

type PushTemplateType =
  | "new_report"
  | "report_update"
  | "new_monitoring"
  | "monitoring_update"
  | "system_notice";

type PushSendBody = PushPayload & {
  templateType?: PushTemplateType | string;
  tipoEmergencia?: string;
  tipoMonitoreo?: string;
  prioridad?: string;
  ubicacion?: string;
  municipio?: string;
  localidad?: string;
  extracto?: string;
  cambio?: string;
  changeKind?: string;
  message?: string;
  reportId?: string;
  linkedReportId?: string;
  url?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
};

function compactText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function clipText(value: string, max: number): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max).trimEnd()}...` : value;
}

function toPushSafeText(value: string): string {
  return compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[·•]/g, "-")
    .replace(/[“”«»]/g, "\"")
    .replace(/[’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[¡]/g, "!")
    .replace(/[¿]/g, "?")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTemplateType(value: unknown): PushTemplateType | null {
  const normalized = compactText(value).toLowerCase();
  if (normalized === "new_report") return "new_report";
  if (
    normalized === "report_update" ||
    normalized === "incident_update" ||
    normalized === "update_report"
  ) {
    return "report_update";
  }
  if (normalized === "new_monitoring" || normalized === "monitoring_new") {
    return "new_monitoring";
  }
  if (
    normalized === "monitoring_update" ||
    normalized === "update_monitoring"
  ) {
    return "monitoring_update";
  }
  if (normalized === "system_notice") return "system_notice";
  return null;
}

function normalizePriorityLabel(value: unknown): "Alta" | "Media" | "Baja" {
  const raw = compactText(value).toLowerCase();
  if (raw === "alta") return "Alta";
  if (raw === "baja") return "Baja";
  return "Media";
}

function composeLocationShort(input: PushSendBody): string {
  const municipio = compactText(input.municipio);
  const ubicacion = compactText(input.ubicacion) || compactText(input.localidad);
  if (ubicacion && municipio) {
    return ubicacion.toLowerCase().includes(municipio.toLowerCase())
      ? clipText(ubicacion, 70)
      : clipText(`${municipio}, ${ubicacion}`, 70);
  }
  return clipText(ubicacion || municipio, 70);
}

function mergeLeadAndSnippet(lead: string, snippet: string, max = 118): string {
  const leadText = compactText(lead);
  const snippetText = compactText(snippet);
  if (!leadText && !snippetText) return "";
  if (!leadText) return clipText(snippetText, max);
  if (!snippetText) return clipText(leadText, max);
  return clipText(`${leadText}. ${snippetText}`, max);
}

function buildTemplateContent(input: PushSendBody & { templateType: PushTemplateType }): {
  title: string;
  body: string;
  tag: string;
} {
  const tipoEmergencia = clipText(
    compactText(input.tipoEmergencia) ||
      clipText(compactText(input.title), 45) ||
      "Emergencia",
    45,
  );
  const tipoMonitoreo = clipText(
    compactText(input.tipoMonitoreo) ||
      compactText(input.tipoEmergencia) ||
      clipText(compactText(input.title), 45) ||
      "Monitoreo",
    45,
  );
  const prioridadLabel = normalizePriorityLabel(input.prioridad);
  const ubicacion = composeLocationShort(input);
  const extracto = clipText(
    compactText(input.extracto) ||
      compactText(input.message) ||
      compactText(input.body),
    120,
  );
  const cambio = clipText(compactText(input.cambio), 105);
  const hasEvidence =
    !!compactText(input.attachmentUrl) ||
    compactText(input.changeKind).toLowerCase().includes("evidencia") ||
    cambio.toLowerCase().includes("evidencia");
  const updateKind = hasEvidence ? "(Nueva evidencia)" : "(Mas informacion)";

  if (input.templateType === "new_report") {
    const title = "Nuevo Reporte 911";
    const lead = ubicacion
      ? `${tipoEmergencia} - ${ubicacion}`
      : `${tipoEmergencia} - Prioridad ${prioridadLabel}`;
    const body = mergeLeadAndSnippet(lead, extracto, 118) || "Nuevo reporte recibido.";
    return { title, body, tag: compactText(input.tag) || "report-new" };
  }

  if (input.templateType === "report_update") {
    const title = "Actualizacion Reporte 911";
    const lead = `${tipoEmergencia} - ${updateKind}${ubicacion ? ` ${ubicacion}` : ""}`;
    const detail = cambio || extracto;
    const body =
      mergeLeadAndSnippet(lead, detail, 118) || `${tipoEmergencia} - ${updateKind}`;
    return { title, body, tag: compactText(input.tag) || "report-update" };
  }

  if (input.templateType === "new_monitoring") {
    const title = "Nuevo Monitoreo";
    const lead = ubicacion ? `${tipoMonitoreo} - ${ubicacion}` : tipoMonitoreo;
    const body = mergeLeadAndSnippet(lead, extracto, 118) || "Nuevo monitoreo registrado.";
    return { title, body, tag: compactText(input.tag) || "monitoring-new" };
  }

  if (input.templateType === "monitoring_update") {
    const title = "Actualizacion Monitoreo";
    const lead = `${tipoMonitoreo} - ${updateKind}${ubicacion ? ` ${ubicacion}` : ""}`;
    const detail = cambio || extracto;
    const body =
      mergeLeadAndSnippet(lead, detail, 118) || `${tipoMonitoreo} - ${updateKind}`;
    return { title, body, tag: compactText(input.tag) || "monitoring-update" };
  }

  const title = clipText(compactText(input.title) || "Comunicado operativo", 65);
  const body = extracto || "Hay una actualizacion del sistema.";
  return { title, body, tag: compactText(input.tag) || "system-notice" };
}

/** Get or generate VAPID keys (idempotent) */
async function getOrCreateVAPIDKeys(): Promise<VAPIDKeys> {
  try {
    const existing = await kv.get(VAPID_KV_KEY);
    if (existing && existing.publicKey && existing.privateKeyJwk) {
      console.log("VAPID keys loaded from KV store");
      return existing as VAPIDKeys;
    }
  } catch (e) {
    console.log("Error reading VAPID keys from KV, will generate new ones:", e);
  }

  console.log("Generating new VAPID keys...");
  const keys = await generateVAPIDKeys();
  await kv.set(VAPID_KV_KEY, keys);
  console.log("VAPID keys generated and stored");
  return keys;
}

/** GET /push/vapid-public-key â€” Returns the VAPID public key for client subscription */
routeGet("/push/vapid-public-key", async (c) => {
  try {
    const keys = await getOrCreateVAPIDKeys();
    return c.json({ publicKey: keys.publicKey });
  } catch (err) {
    const msg = `Error getting VAPID public key: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PUSH NOTIFICATIONS â€” Subscriptions
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/** POST /push/subscribe â€” Save a push subscription */
routePost("/push/subscribe", async (c) => {
  try {
    const body = await c.req.json();
    const { subscription, deviceName } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return c.json({ error: "Invalid subscription: missing endpoint or keys" }, 400);
    }

    // Create a unique key from the endpoint hash
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(subscription.endpoint));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    const kvKey = `push:sub:${hashHex}`;

    const record = {
      subscription,
      deviceName: deviceName || "Dispositivo desconocido",
      subscribedAt: new Date().toISOString(),
    };

    await kv.set(kvKey, record);

    console.log(`Push subscription saved: ${kvKey} (${deviceName})`);
    return c.json({ success: true, id: hashHex });
  } catch (err) {
    const msg = `Error saving push subscription: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** DELETE /push/unsubscribe â€” Remove a push subscription */
routePost("/push/unsubscribe", async (c) => {
  try {
    const body = await c.req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return c.json({ error: "Missing endpoint" }, 400);
    }

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(endpoint));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    const kvKey = `push:sub:${hashHex}`;

    await kv.del(kvKey);
    console.log(`Push subscription removed: ${kvKey}`);
    return c.json({ success: true });
  } catch (err) {
    const msg = `Error removing push subscription: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** GET /push/subscriptions â€” List all subscriptions (for debug) */
routeGet("/push/subscriptions", async (c) => {
  try {
    const subs = await kv.getByPrefix("push:sub:");
    return c.json({ count: subs.length, subscriptions: subs });
  } catch (err) {
    const msg = `Error listing subscriptions: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PUSH NOTIFICATIONS â€” File Attachments
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/** POST /push/upload â€” Upload a file attachment for a notification */
routePost("/push/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: "File too large (max 5MB)" }, 400);
    }

    const supabase = getSupabaseAdmin();
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const filePath = `attachments/${fileName}`;

    const arrayBuf = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(filePath, arrayBuf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Generate a signed URL (valid for 7 days)
    const { data: signedData, error: signError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    if (signError || !signedData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signError?.message || "unknown"}`);
    }

    console.log(`File uploaded: ${filePath} (${file.name}, ${(file.size / 1024).toFixed(1)}KB)`);

    return c.json({
      success: true,
      url: signedData.signedUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      storagePath: filePath,
    });
  } catch (err) {
    const msg = `Error uploading attachment: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** POST /files/upload-evidence â€” Upload report/monitoring evidence and return public URL */
routePost("/files/upload-evidence", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const folder = String(formData.get("folder") || "misc").replace(/[^a-zA-Z0-9_-]/g, "");

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }
    const isVideo = (file.type || "").toLowerCase().startsWith("video/");
    const maxSizeBytes = isVideo ? 40 * 1024 * 1024 : 8 * 1024 * 1024;
    const maxSizeMb = isVideo ? 40 : 8;
    if (file.size > maxSizeBytes) {
      return c.json({ error: `File too large (max ${maxSizeMb}MB)` }, 400);
    }

    const supabase = getSupabaseAdmin();
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const filePath = `${folder}/${fileName}`;
    const arrayBuf = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(filePath, arrayBuf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: publicData } = supabase.storage
      .from(EVIDENCE_BUCKET)
      .getPublicUrl(filePath);

    return c.json({
      success: true,
      url: publicData.publicUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storagePath: filePath,
    });
  } catch (err) {
    const msg = `Error uploading evidence: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PUSH NOTIFICATIONS â€” Send
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/** POST /push/send â€” Send push notification to all subscribers */
routePost("/push/send", async (c) => {
  try {
    const reqBody = (await c.req.json()) as PushSendBody;
    const templateType = parseTemplateType(reqBody.templateType);
    const { icon, url, attachmentUrl, attachmentName, attachmentType } = reqBody;
    const resolved = templateType
      ? buildTemplateContent({ ...reqBody, templateType })
      : {
          title: clipText(compactText(reqBody.title), 65),
          body: clipText(compactText(reqBody.body), 180),
          tag: clipText(compactText(reqBody.tag), 64) || "pc-tamaulipas",
        };
    const safeTitle = toPushSafeText(resolved.title);
    const safeBody = toPushSafeText(resolved.body);

    if (!safeTitle) {
      return c.json({ error: "Missing notification title" }, 400);
    }

    // Generate a unique notification ID and store full content in KV
    const notifId = crypto.randomUUID();
    const notifRecord: Record<string, unknown> = {
      id: notifId,
      title: safeTitle,
      body: safeBody || "",
      icon: icon || "/icon.svg",
      tag: resolved.tag,
      createdAt: new Date().toISOString(),
    };

    const linkedReportId =
      compactText(reqBody.linkedReportId) || compactText(reqBody.reportId);
    if (linkedReportId) {
      notifRecord.linkedReportId = linkedReportId;
    }

    // Include attachment info if provided
    if (attachmentUrl) {
      notifRecord.attachmentUrl = attachmentUrl;
      notifRecord.attachmentName = attachmentName || "Archivo adjunto";
      notifRecord.attachmentType = attachmentType || "application/octet-stream";
    }

    await kv.set(`push:notif:${notifId}`, notifRecord);
    console.log(`Notification stored: push:notif:${notifId}${attachmentUrl ? " (with attachment)" : ""}`);

    const vapidKeys = await getOrCreateVAPIDKeys();
    const subscriptions = await kv.getByPrefix("push:sub:");

    if (subscriptions.length === 0) {
      return c.json({ error: "No push subscriptions registered", sent: 0, notificationId: notifId }, 404);
    }

    const payload: PushPayload = {
      title: safeTitle,
      body: safeBody || "",
      icon: icon || "/icon.svg",
      badge: "/icon.svg",
      tag: resolved.tag,
      url: compactText(url) || `/?notification=${notifId}`,
      data: {
        notificationId: notifId,
        ...(linkedReportId ? { reportId: linkedReportId, linkedReportId } : {}),
      },
    };

    console.log(`Sending push to ${subscriptions.length} subscriber(s)...`);

    const results = await Promise.all(
      subscriptions.map((sub: any) =>
        sendPushNotification(sub.subscription, payload, vapidKeys, VAPID_SUBJECT)
      )
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    // Clean up expired/invalid subscriptions (410 Gone)
    for (const fail of failed) {
      if (fail.status === 410 || fail.status === 404) {
        console.log(`Removing expired subscription: ${fail.endpoint}`);
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(fail.endpoint));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
        await kv.del(`push:sub:${hashHex}`).catch(() => {});
      }
    }

    console.log(`Push results: ${succeeded} sent, ${failed.length} failed`);

    return c.json({
      sent: succeeded,
      failed: failed.length,
      total: subscriptions.length,
      notificationId: notifId,
      errors: failed.map((f) => ({ endpoint: f.endpoint?.slice(-30), status: f.status, error: f.error })),
    });
  } catch (err) {
    const msg = `Error sending push notifications: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** POST /push/send-test â€” Quick test notification */
routePost("/push/send-test", async (c) => {
  try {
    const vapidKeys = await getOrCreateVAPIDKeys();
    const subscriptions = await kv.getByPrefix("push:sub:");

    if (subscriptions.length === 0) {
      return c.json({ error: "No hay dispositivos suscritos. Activa las notificaciones primero.", sent: 0 }, 404);
    }

    // Generate a unique notification ID and store full content in KV
    const notifId = crypto.randomUUID();
    const notifRecord = {
      id: notifId,
      title: "Prueba de notificaciones",
      body: "Si ves este mensaje, el canal push esta activo.",
      icon: "/icon.svg",
      tag: "test-notification",
      createdAt: new Date().toISOString(),
    };
    await kv.set(`push:notif:${notifId}`, notifRecord);
    console.log(`Test notification stored: push:notif:${notifId}`);

    const payload: PushPayload = {
      title: "Prueba de notificaciones",
      body: "Si ves este mensaje, el canal push esta activo.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "test-notification",
      url: `/?notification=${notifId}`,
      data: { notificationId: notifId, test: true, timestamp: Date.now() },
    };

    const results = await Promise.all(
      subscriptions.map((sub: any) =>
        sendPushNotification(sub.subscription, payload, vapidKeys, VAPID_SUBJECT)
      )
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    return c.json({
      sent: succeeded,
      failed: failed.length,
      total: subscriptions.length,
      notificationId: notifId,
      errors: failed.map((f) => ({ status: f.status, error: f.error })),
    });
  } catch (err) {
    const msg = `Error sending test push: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PUSH NOTIFICATIONS â€” Notification Detail
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/** GET /push/notification/:id â€” Get full notification content by ID */
routeGet("/push/notification/:id", async (c) => {
  try {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Missing notification ID" }, 400);
    }

    const notif = await kv.get(`push:notif:${id}`);
    if (!notif) {
      return c.json({ error: "Notification not found" }, 404);
    }

    return c.json({ notification: notif });
  } catch (err) {
    const msg = `Error fetching notification detail: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** GET /push/notifications â€” List all sent push notifications (for Alertas tab) */
routeGet("/push/notifications", async (c) => {
  try {
    const notifications = await kv.getByPrefix("push:notif:");
    // Sort by createdAt descending (newest first)
    const sorted = (notifications as any[]).sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    return c.json({ notifications: sorted });
  } catch (err) {
    const msg = `Error listing notifications: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   REPORTS 911 â€” Server-synced reports across devices
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */


type TranscriptionStatus = "pending" | "processing" | "done" | "error";
type TranscriptionJobStatus = "pending" | "processing" | "done" | "error";

type ReportAudioNote = {
  id: string;
  src: string;
  mimeType: string;
  transcript: string;
  durationSec: number;
  transcriptionStatus: TranscriptionStatus;
  transcriptionError: string | null;
  transcribedAt: string | null;
};

type TranscriptionJob = {
  id: string;
  reportId: string;
  noteId: string;
  audioUrl: string;
  language: string;
  status: TranscriptionJobStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  processingStartedAt?: string;
  completedAt?: string;
  workerId?: string;
  provider?: string;
  model?: string;
  transcript?: string;
  lastError?: string | null;
  reportFolio?: string;
};

const TRANSCRIPTION_WORKER_SECRET =
  Deno.env.get("TRANSCRIPTION_WORKER_SECRET")?.trim() || "";
const TRANSCRIPTION_MAX_ATTEMPTS = Math.max(
  1,
  Number(Deno.env.get("TRANSCRIPTION_MAX_ATTEMPTS") || "3"),
);
const TRANSCRIPTION_RETRY_STALE_MS = Math.max(
  30000,
  Number(Deno.env.get("TRANSCRIPTION_RETRY_STALE_MS") || "300000"),
);

function parseTranscriptionStatus(value: unknown): TranscriptionStatus | null {
  return value === "pending" ||
    value === "processing" ||
    value === "done" ||
    value === "error"
    ? value
    : null;
}

function normalizeReportAudioNotes(rawReport: Record<string, unknown>): ReportAudioNote[] {
  const rawNotes = Array.isArray(rawReport.audioNotes) ? rawReport.audioNotes : [];
  return rawNotes.map((item, idx) => {
    const note = (item || {}) as Record<string, unknown>;
    const transcript = typeof note.transcript === "string" ? note.transcript.trim() : "";
    const src = typeof note.src === "string" ? note.src : "";
    const statusFromPayload = parseTranscriptionStatus(note.transcriptionStatus);
    const transcriptionStatus: TranscriptionStatus = statusFromPayload ||
      (transcript.length > 0 ? "done" : src.length > 0 ? "pending" : "error");
    const nowIso = new Date().toISOString();
    return {
      id: typeof note.id === "string" && note.id.trim().length > 0
        ? note.id.trim()
        : `audio-${idx + 1}`,
      src,
      mimeType: typeof note.mimeType === "string" && note.mimeType.trim().length > 0
        ? note.mimeType.trim()
        : "audio/webm",
      transcript,
      durationSec: typeof note.durationSec === "number" && Number.isFinite(note.durationSec)
        ? Math.max(0, Math.round(note.durationSec))
        : 0,
      transcriptionStatus,
      transcriptionError: typeof note.transcriptionError === "string"
        ? note.transcriptionError
        : null,
      transcribedAt: typeof note.transcribedAt === "string"
        ? note.transcribedAt
        : transcript.length > 0
        ? nowIso
        : null,
    };
  }).filter((note) => note.src.length > 0 || note.transcript.length > 0);
}

function firstTranscriptFromNotes(notes: ReportAudioNote[]): string | null {
  for (const note of notes) {
    if (note.transcript.trim().length > 0) return note.transcript.trim();
  }
  return null;
}

function toSafeJobId(reportId: string, noteId: string): string {
  const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${sanitize(reportId)}__${sanitize(noteId)}`;
}

async function updateReportAudioNote(
  reportId: string,
  noteId: string,
  patch: Partial<ReportAudioNote>,
): Promise<boolean> {
  const reportKey = `report:${reportId}`;
  const report = await kv.get(reportKey) as Record<string, unknown> | null;
  if (!report) return false;

  const notes = normalizeReportAudioNotes(report);
  let changed = false;
  const updatedNotes = notes.map((note) => {
    if (note.id !== noteId) return note;
    changed = true;
    const next: ReportAudioNote = {
      ...note,
      ...patch,
      transcript: typeof patch.transcript === "string" ? patch.transcript : note.transcript,
      transcriptionStatus: parseTranscriptionStatus(patch.transcriptionStatus) || note.transcriptionStatus,
      transcriptionError:
        typeof patch.transcriptionError === "string" || patch.transcriptionError === null
          ? patch.transcriptionError
          : note.transcriptionError,
      transcribedAt:
        typeof patch.transcribedAt === "string" || patch.transcribedAt === null
          ? patch.transcribedAt
          : note.transcribedAt,
    };
    if (next.transcript.trim().length > 0) {
      next.transcriptionStatus = "done";
      next.transcriptionError = null;
      if (!next.transcribedAt) next.transcribedAt = new Date().toISOString();
    }
    return next;
  });

  if (!changed) return false;
  const audioTranscript =
    typeof report.audioTranscript === "string" && report.audioTranscript.trim().length > 0
      ? report.audioTranscript
      : firstTranscriptFromNotes(updatedNotes);

  await kv.set(reportKey, {
    ...report,
    audioNotes: updatedNotes,
    audioTranscript: audioTranscript || null,
    updatedAt: new Date().toISOString(),
  });

  return true;
}

async function queueTranscriptionJobsForReport(report: Record<string, unknown> & { id: string }) {
  const notes = normalizeReportAudioNotes(report);
  let queued = 0;
  const jobIds: string[] = [];
  const now = new Date().toISOString();
  let notesChanged = false;

  for (const note of notes) {
    if (!note.src) {
      if (note.transcriptionStatus !== "error") {
        note.transcriptionStatus = "error";
        note.transcriptionError = note.transcriptionError || "missing-audio-src";
        notesChanged = true;
      }
      continue;
    }

    if (note.transcript.trim().length > 0) {
      if (note.transcriptionStatus !== "done") {
        note.transcriptionStatus = "done";
        note.transcriptionError = null;
        note.transcribedAt = note.transcribedAt || now;
        notesChanged = true;
      }
      continue;
    }

    const jobId = toSafeJobId(report.id, note.id);
    const jobKey = `transcription:job:${jobId}`;
    const existing = await kv.get(jobKey) as TranscriptionJob | null;

    if (existing?.status === "processing") {
      note.transcriptionStatus = "processing";
      note.transcriptionError = null;
      continue;
    }

    if (existing?.status === "done" && existing.transcript && existing.transcript.trim().length > 0) {
      note.transcript = existing.transcript.trim();
      note.transcriptionStatus = "done";
      note.transcribedAt = existing.completedAt || now;
      note.transcriptionError = null;
      notesChanged = true;
      continue;
    }

    const nextAttempts = typeof existing?.attempts === "number" ? existing.attempts : 0;
    const job: TranscriptionJob = {
      id: jobId,
      reportId: report.id,
      noteId: note.id,
      audioUrl: note.src,
      language: "es",
      status: "pending",
      attempts: nextAttempts,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      reportFolio: typeof report.folio === "string" ? report.folio : undefined,
      lastError: null,
    };
    await kv.set(jobKey, job);
    queued += 1;
    jobIds.push(jobId);
    if (note.transcriptionStatus !== "pending" || note.transcriptionError) {
      note.transcriptionStatus = "pending";
      note.transcriptionError = null;
      notesChanged = true;
    }
  }

  if (notesChanged) {
    const reportKey = `report:${report.id}`;
    const latest = await kv.get(reportKey) as Record<string, unknown> | null;
    if (latest) {
      await kv.set(reportKey, {
        ...latest,
        audioNotes: notes,
        audioTranscript:
          (typeof latest.audioTranscript === "string" && latest.audioTranscript.trim().length > 0)
            ? latest.audioTranscript
            : firstTranscriptFromNotes(notes),
        updatedAt: now,
      });
    }
  }

  return {
    queued,
    jobIds,
    pending: notes.filter((n) => n.transcriptionStatus === "pending" || n.transcriptionStatus === "processing").length,
  };
}

function getTranscriptionToken(c: any): string {
  const headerToken = c.req.header("x-transcription-secret");
  if (headerToken && headerToken.trim().length > 0) return headerToken.trim();

  const auth = c.req.header("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function isTranscriptionAuthorized(c: any): boolean {
  if (!TRANSCRIPTION_WORKER_SECRET) return false;
  return getTranscriptionToken(c) === TRANSCRIPTION_WORKER_SECRET;
}
/** POST /reports â€” Save a report and optionally send push to all devices */
routePost("/reports", async (c) => {
  try {
    const body = await c.req.json();
    const report = body.report as Record<string, unknown>;

    if (!report || !report.id) {
      return c.json({ error: "Missing report or report.id" }, 400);
    }

    const normalizedAudioNotes = normalizeReportAudioNotes(report);
    const providedTranscript =
      typeof report.audioTranscript === "string" ? report.audioTranscript.trim() : "";
    const resolvedAudioTranscript =
      providedTranscript || firstTranscriptFromNotes(normalizedAudioNotes) || null;

    // Store report in KV with prefix
    const kvKey = `report:${String(report.id)}`;
    const record = {
      ...report,
      id: String(report.id),
      audioNotes: normalizedAudioNotes,
      audioTranscript: resolvedAudioTranscript,
      serverReceivedAt: new Date().toISOString(),
    };
    await kv.set(kvKey, record);
    const transcription = await queueTranscriptionJobsForReport(record);
    console.log(`Report saved: ${kvKey} (${record.tipoEmergencia} - ${record.municipio})`);

    // Send push notification to all subscribed devices about the new report
    let pushResult = { sent: 0, failed: 0, total: 0 };
    try {
      const vapidKeys = await getOrCreateVAPIDKeys();
      const subscriptions = await kv.getByPrefix("push:sub:");

      if (subscriptions.length > 0) {
        // Create a notification record for deep-link support
        const notifId = crypto.randomUUID();
        const clip = (text: string, max = 150) => {
          const normalized = text.trim().replace(/\s+/g, " ");
          if (!normalized) return "";
          return normalized.length > max
            ? `${normalized.slice(0, max).trimEnd()}...`
            : normalized;
        };
        const transcripts = Array.isArray(record.audioNotes)
          ? record.audioNotes
              .map((note: { transcript?: string }) =>
                typeof note?.transcript === "string" ? note.transcript.trim() : "",
              )
              .filter((text: string) => text.length > 0)
          : [];
        if (
          transcripts.length === 0 &&
          typeof record.audioTranscript === "string" &&
          record.audioTranscript.trim().length > 0
        ) {
          transcripts.push(record.audioTranscript.trim());
        }
        const description =
          typeof record.descripcion === "string" ? record.descripcion.trim() : "";
        let primaryText = description;
        if (!primaryText && transcripts.length > 0) {
          primaryText = transcripts[0];
        } else if (primaryText.length < 100 && transcripts.length > 0 && !primaryText.includes(transcripts[0])) {
          primaryText = `${primaryText} ${transcripts[0]}`.trim();
        }
        if (primaryText.length < 100 && transcripts.length > 1 && !primaryText.includes(transcripts[1])) {
          primaryText = `${primaryText} ${transcripts[1]}`.trim();
        }
        const tipoEmergencia =
          typeof record.tipoEmergencia === "string" && record.tipoEmergencia.trim().length > 0
            ? clip(record.tipoEmergencia, 45)
            : "Emergencia";

        const ubicacion =
          typeof record.ubicacion === "string" ? record.ubicacion.trim() : "";
        const municipio =
          typeof record.municipio === "string" ? record.municipio.trim() : "";
        const locationBase = ubicacion && municipio
          ? ubicacion.toLowerCase().includes(municipio.toLowerCase())
            ? ubicacion
            : `${ubicacion}, ${municipio}`
          : (ubicacion || municipio);
        const locationText = clip(locationBase, 95);
        const snippet = clip(primaryText, 120);
        const { title: titleText, body: bodyText } = buildTemplateContent({
          templateType: "new_report",
          tipoEmergencia,
          prioridad: typeof record.prioridad === "string" ? record.prioridad : "media",
          ubicacion: locationText,
          extracto: snippet,
        });
        const pushTitleText = toPushSafeText(titleText);
        const pushBodyText = toPushSafeText(bodyText);

        const notifRecord = {
          id: notifId,
          title: pushTitleText,
          body: pushBodyText,
          icon: "/icon.svg",
          tag: `report-${record.id}`,
          createdAt: new Date().toISOString(),
          linkedReportId: record.id,
        };
        await kv.set(`push:notif:${notifId}`, notifRecord);

        const payload: PushPayload = {
          title: pushTitleText,
          body: pushBodyText,
          icon: "/icon.svg",
          badge: "/icon.svg",
          tag: `report-${record.id}`,
          url: `/?notification=${notifId}`,
          data: { notificationId: notifId, reportId: record.id },
        };

        console.log(`Sending report push to ${subscriptions.length} subscriber(s)...`);

        const results = await Promise.all(
          subscriptions.map((sub: any) =>
            sendPushNotification(sub.subscription, payload, vapidKeys, VAPID_SUBJECT)
          )
        );

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success);

        // Clean up expired subscriptions
        for (const fail of failed) {
          if (fail.status === 410 || fail.status === 404) {
            console.log(`Removing expired subscription: ${fail.endpoint}`);
            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(fail.endpoint));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
            await kv.del(`push:sub:${hashHex}`).catch(() => {});
          }
        }

        pushResult = { sent: succeeded, failed: failed.length, total: subscriptions.length };
        console.log(`Report push results: ${succeeded} sent, ${failed.length} failed`);
      } else {
        console.log("No push subscriptions for report notification");
      }
    } catch (pushErr) {
      console.log(`Warning: Push failed for report but report was saved: ${pushErr}`);
    }

    return c.json({
      success: true,
      reportId: record.id,
      push: pushResult,
      transcription,
    });
  } catch (err) {
    const msg = `Error saving report: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** GET /reports â€” Get all submitted reports */
routeGet("/reports", async (c) => {
  try {
    const reports = await kv.getByPrefix("report:");
    // Sort by sentAt descending (newest first)
    reports.sort((a: any, b: any) => (b.sentAt || 0) - (a.sentAt || 0));
    console.log(`Reports fetched: ${reports.length} total`);
    return c.json({ reports });
  } catch (err) {
    const msg = `Error fetching reports: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** DELETE /reports/:id â€” Delete a specific report */
routeDelete("/reports/:id", async (c) => {
  try {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Missing report ID" }, 400);
    }
    await kv.del(`report:${id}`);
    const jobs = (await kv.getByPrefix("transcription:job:")) as TranscriptionJob[];
    for (const job of jobs) {
      if (job?.reportId === id && job?.id) {
        await kv.del(`transcription:job:${job.id}`);
      }
    }
    console.log(`Report deleted: report:${id}`);
    return c.json({ success: true });
  } catch (err) {
    const msg = `Error deleting report: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MONITORING â€” Server-synced monitoring entries across devices
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */


/** POST /transcription/jobs/claim - Worker claims next pending transcription job */
routePost("/transcription/jobs/claim", async (c) => {
  try {
    if (!TRANSCRIPTION_WORKER_SECRET) {
      return c.json({ error: "Transcription worker secret is not configured" }, 503);
    }
    if (!isTranscriptionAuthorized(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
    const workerId = typeof body.workerId === "string" ? body.workerId : "worker";

    const jobs = (await kv.getByPrefix("transcription:job:")) as TranscriptionJob[];
    const nowMs = Date.now();
    const candidates = jobs
      .filter((job) => {
        if (!job || !job.id || !job.reportId || !job.noteId || !job.audioUrl) return false;
        if (job.status === "pending") return (job.attempts || 0) < TRANSCRIPTION_MAX_ATTEMPTS;
        if (job.status !== "processing") return false;
        const started = Date.parse(job.processingStartedAt || job.updatedAt || "");
        if (!Number.isFinite(started)) return true;
        return (nowMs - started) >= TRANSCRIPTION_RETRY_STALE_MS;
      })
      .sort((a, b) => Date.parse(a.createdAt || "") - Date.parse(b.createdAt || ""));

    if (candidates.length === 0) {
      return c.json({ job: null });
    }

    const selected = candidates[0];
    const now = new Date().toISOString();
    const claimed: TranscriptionJob = {
      ...selected,
      status: "processing",
      attempts: (selected.attempts || 0) + 1,
      workerId,
      processingStartedAt: now,
      updatedAt: now,
      lastError: null,
    };
    await kv.set(`transcription:job:${claimed.id}`, claimed);
    await updateReportAudioNote(claimed.reportId, claimed.noteId, {
      transcriptionStatus: "processing",
      transcriptionError: null,
    });

    return c.json({ job: claimed });
  } catch (err) {
    const msg = `Error claiming transcription job: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** POST /transcription/jobs/:jobId/complete - Worker submits transcript */
routePost("/transcription/jobs/:jobId/complete", async (c) => {
  try {
    if (!TRANSCRIPTION_WORKER_SECRET) {
      return c.json({ error: "Transcription worker secret is not configured" }, 503);
    }
    if (!isTranscriptionAuthorized(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const jobId = c.req.param("jobId");
    if (!jobId) return c.json({ error: "Missing jobId" }, 400);

    const body = await c.req.json();
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) return c.json({ error: "Missing transcript" }, 400);

    const jobKey = `transcription:job:${jobId}`;
    const job = await kv.get(jobKey) as TranscriptionJob | null;
    if (!job) return c.json({ error: "Job not found" }, 404);

    const now = new Date().toISOString();
    const doneJob: TranscriptionJob = {
      ...job,
      transcript,
      status: "done",
      completedAt: now,
      updatedAt: now,
      lastError: null,
      provider: typeof body.provider === "string" ? body.provider : job.provider,
      model: typeof body.model === "string" ? body.model : job.model,
    };
    await kv.set(jobKey, doneJob);
    const reportUpdated = await updateReportAudioNote(doneJob.reportId, doneJob.noteId, {
      transcript,
      transcriptionStatus: "done",
      transcriptionError: null,
      transcribedAt: now,
    });

    return c.json({ success: true, reportUpdated, job: doneJob });
  } catch (err) {
    const msg = `Error completing transcription job: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** POST /transcription/jobs/:jobId/error - Worker reports transcription error */
routePost("/transcription/jobs/:jobId/error", async (c) => {
  try {
    if (!TRANSCRIPTION_WORKER_SECRET) {
      return c.json({ error: "Transcription worker secret is not configured" }, 503);
    }
    if (!isTranscriptionAuthorized(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const jobId = c.req.param("jobId");
    if (!jobId) return c.json({ error: "Missing jobId" }, 400);

    const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
    const errorText = typeof body.error === "string" && body.error.trim().length > 0
      ? body.error.trim()
      : "transcription-failed";
    const retryable = body.retryable !== false;

    const jobKey = `transcription:job:${jobId}`;
    const job = await kv.get(jobKey) as TranscriptionJob | null;
    if (!job) return c.json({ error: "Job not found" }, 404);

    const canRetry = retryable && (job.attempts || 0) < TRANSCRIPTION_MAX_ATTEMPTS;
    const now = new Date().toISOString();
    const status: TranscriptionJobStatus = canRetry ? "pending" : "error";
    const nextJob: TranscriptionJob = {
      ...job,
      status,
      updatedAt: now,
      lastError: errorText,
    };
    await kv.set(jobKey, nextJob);
    await updateReportAudioNote(nextJob.reportId, nextJob.noteId, {
      transcriptionStatus: status,
      transcriptionError: status === "error" ? errorText : null,
    });

    return c.json({ success: true, status, job: nextJob });
  } catch (err) {
    const msg = `Error updating transcription job failure: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** GET /transcription/jobs/report/:reportId - Debug list of transcription jobs by report */
routeGet("/transcription/jobs/report/:reportId", async (c) => {
  try {
    const reportId = c.req.param("reportId");
    if (!reportId) return c.json({ error: "Missing reportId" }, 400);
    const jobs = (await kv.getByPrefix("transcription:job:")) as TranscriptionJob[];
    const filtered = jobs
      .filter((job) => job?.reportId === reportId)
      .sort((a, b) => Date.parse(a.createdAt || "") - Date.parse(b.createdAt || ""));
    return c.json({ jobs: filtered });
  } catch (err) {
    const msg = `Error listing report transcription jobs: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});
/** POST /monitoring â€” Save a monitoring entry */
routePost("/monitoring", async (c) => {
  try {
    const body = await c.req.json();
    const monitoring = body.monitoring;

    if (!monitoring || !monitoring.id) {
      return c.json({ error: "Missing monitoring or monitoring.id" }, 400);
    }

    const kvKey = `monitoring:${monitoring.id}`;
    const record = {
      ...monitoring,
      serverReceivedAt: new Date().toISOString(),
    };
    await kv.set(kvKey, record);
    console.log(`Monitoring saved: ${kvKey} (${monitoring.tipoMonitoreo} - ${monitoring.municipio})`);

    return c.json({
      success: true,
      monitoringId: monitoring.id,
    });
  } catch (err) {
    const msg = `Error saving monitoring: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** GET /monitoring â€” Get all submitted monitoring entries */
routeGet("/monitoring", async (c) => {
  try {
    const monitoring = await kv.getByPrefix("monitoring:");
    monitoring.sort((a: any, b: any) => (b.sentAt || 0) - (a.sentAt || 0));
    return c.json({ monitoring });
  } catch (err) {
    const msg = `Error fetching monitoring: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SETTINGS â€” Avatar per role
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const AVATAR_BUCKET = "make-aac1ff1a-avatars";

// Idempotently create the avatar bucket on startup
(async () => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b: any) => b.name === AVATAR_BUCKET);
    if (!bucketExists) {
      await supabase.storage.createBucket(AVATAR_BUCKET, { public: false });
      console.log(`Avatar bucket created: ${AVATAR_BUCKET}`);
    }
  } catch (err) {
    console.log(`Warning: Could not initialize avatar bucket: ${err}`);
  }
})();

/** GET /settings/avatar/:roleId â€” Get avatar URL for a role */
routeGet("/settings/avatar/:roleId", async (c) => {
  try {
    const roleId = c.req.param("roleId");
    if (!roleId) return c.json({ error: "Missing roleId" }, 400);

    const record = await kv.get(`settings:avatar:${roleId}`);
    if (!record || !(record as any).storagePath) {
      return c.json({ url: null });
    }

    // Generate a fresh signed URL (valid 7 days)
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl((record as any).storagePath, 60 * 60 * 24 * 7);

    if (error || !data?.signedUrl) {
      console.log(`Error creating avatar signed URL: ${error?.message}`);
      return c.json({ url: null });
    }

    return c.json({ url: data.signedUrl });
  } catch (err) {
    const msg = `Error fetching avatar: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** POST /settings/avatar/:roleId â€” Upload avatar for a role */
routePost("/settings/avatar/:roleId", async (c) => {
  try {
    const roleId = c.req.param("roleId");
    if (!roleId) return c.json({ error: "Missing roleId" }, 400);

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return c.json({ error: "No file provided" }, 400);
    if (file.size > 3 * 1024 * 1024) return c.json({ error: "File too large (max 3MB)" }, 400);

    const supabase = getSupabaseAdmin();
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `avatars/${roleId}.${ext}`;

    const arrayBuf = await file.arrayBuffer();

    // Upsert: overwrite existing avatar
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, arrayBuf, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw new Error(`Avatar upload failed: ${uploadError.message}`);

    // Save storage path in KV
    await kv.set(`settings:avatar:${roleId}`, {
      storagePath: filePath,
      updatedAt: new Date().toISOString(),
    });

    // Return signed URL
    const { data: signedData, error: signError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    if (signError || !signedData?.signedUrl) {
      throw new Error(`Failed to create avatar signed URL: ${signError?.message}`);
    }

    console.log(`Avatar uploaded for role ${roleId}: ${filePath}`);
    return c.json({ success: true, url: signedData.signedUrl });
  } catch (err) {
    const msg = `Error uploading avatar: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SETTINGS â€” Display name per role
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/** GET /settings/name/:roleId â€” Get display name for a role */
routeGet("/settings/name/:roleId", async (c) => {
  try {
    const roleId = c.req.param("roleId");
    if (!roleId) return c.json({ error: "Missing roleId" }, 400);

    const record = await kv.get(`settings:name:${roleId}`);
    if (!record || !(record as any).name) {
      return c.json({ name: null });
    }
    return c.json({ name: (record as any).name });
  } catch (err) {
    const msg = `Error fetching display name: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** POST /settings/name/:roleId â€” Save display name for a role */
routePost("/settings/name/:roleId", async (c) => {
  try {
    const roleId = c.req.param("roleId");
    if (!roleId) return c.json({ error: "Missing roleId" }, 400);

    const body = await c.req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return c.json({ error: "Missing or empty name" }, 400);
    }

    const trimmed = name.trim().slice(0, 60);
    await kv.set(`settings:name:${roleId}`, {
      name: trimmed,
      updatedAt: new Date().toISOString(),
    });

    console.log(`Display name saved for role ${roleId}: ${trimmed}`);
    return c.json({ success: true, name: trimmed });
  } catch (err) {
    const msg = `Error saving display name: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

Deno.serve(app.fetch);
