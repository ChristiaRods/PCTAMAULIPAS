import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import {
  generateVAPIDKeys,
  sendPushNotification,
  type VAPIDKeys,
  type PushPayload,
} from "./web-push.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

/* ════════════════════════════════════════════════════════
   SUPABASE STORAGE — Notification attachments bucket
   ════════════════════════════════════════════════════════ */

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
app.get("/make-server-aac1ff1a/health", (c) => {
  return c.json({ status: "ok" });
});

/* ════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS — VAPID Keys
   ════════════════════════════════════════════════════════ */

const VAPID_KV_KEY = "push:vapid_keys";
const VAPID_SUBJECT = "mailto:proteccioncivil@tamaulipas.gob.mx";

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

/** GET /push/vapid-public-key — Returns the VAPID public key for client subscription */
app.get("/make-server-aac1ff1a/push/vapid-public-key", async (c) => {
  try {
    const keys = await getOrCreateVAPIDKeys();
    return c.json({ publicKey: keys.publicKey });
  } catch (err) {
    const msg = `Error getting VAPID public key: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* ════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS — Subscriptions
   ════════════════════════════════════════════════════════ */

/** POST /push/subscribe — Save a push subscription */
app.post("/make-server-aac1ff1a/push/subscribe", async (c) => {
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

/** DELETE /push/unsubscribe — Remove a push subscription */
app.post("/make-server-aac1ff1a/push/unsubscribe", async (c) => {
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

/** GET /push/subscriptions — List all subscriptions (for debug) */
app.get("/make-server-aac1ff1a/push/subscriptions", async (c) => {
  try {
    const subs = await kv.getByPrefix("push:sub:");
    return c.json({ count: subs.length, subscriptions: subs });
  } catch (err) {
    const msg = `Error listing subscriptions: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* ════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS — File Attachments
   ════════════════════════════════════════════════════════ */

/** POST /push/upload — Upload a file attachment for a notification */
app.post("/make-server-aac1ff1a/push/upload", async (c) => {
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

/** POST /files/upload-evidence — Upload report/monitoring evidence and return public URL */
app.post("/make-server-aac1ff1a/files/upload-evidence", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const folder = String(formData.get("folder") || "misc").replace(/[^a-zA-Z0-9_-]/g, "");

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }
    if (file.size > 8 * 1024 * 1024) {
      return c.json({ error: "File too large (max 8MB)" }, 400);
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

/* ════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS — Send
   ════════════════════════════════════════════════════════ */

/** POST /push/send — Send push notification to all subscribers */
app.post("/make-server-aac1ff1a/push/send", async (c) => {
  try {
    const body = await c.req.json();
    const { title, body: notifBody, icon, tag, url, attachmentUrl, attachmentName, attachmentType } = body as PushPayload & { url?: string; attachmentUrl?: string; attachmentName?: string; attachmentType?: string };

    if (!title) {
      return c.json({ error: "Missing notification title" }, 400);
    }

    // Generate a unique notification ID and store full content in KV
    const notifId = crypto.randomUUID();
    const notifRecord: Record<string, unknown> = {
      id: notifId,
      title,
      body: notifBody || "",
      icon: icon || "/icon.svg",
      tag: tag || "pc-tamaulipas",
      createdAt: new Date().toISOString(),
    };

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
      title,
      body: notifBody || "",
      icon: icon || "/icon.svg",
      badge: "/icon.svg",
      tag: tag || "pc-tamaulipas",
      url: `/?notification=${notifId}`,
      data: { notificationId: notifId },
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

/** POST /push/send-test — Quick test notification */
app.post("/make-server-aac1ff1a/push/send-test", async (c) => {
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
      title: "🚨 Protección Civil Tamaulipas",
      body: "Prueba de notificación push — Si ves esto, ¡el sistema funciona correctamente!",
      icon: "/icon.svg",
      tag: "test-notification",
      createdAt: new Date().toISOString(),
    };
    await kv.set(`push:notif:${notifId}`, notifRecord);
    console.log(`Test notification stored: push:notif:${notifId}`);

    const payload: PushPayload = {
      title: "🚨 Protección Civil Tamaulipas",
      body: "Prueba de notificación push — Si ves esto, ¡el sistema funciona correctamente!",
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

/* ════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS — Notification Detail
   ════════════════════════════════════════════════════════ */

/** GET /push/notification/:id — Get full notification content by ID */
app.get("/make-server-aac1ff1a/push/notification/:id", async (c) => {
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

/** GET /push/notifications — List all sent push notifications (for Alertas tab) */
app.get("/make-server-aac1ff1a/push/notifications", async (c) => {
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

/* ════════════════════════════════════════════════════════
   REPORTS 911 — Server-synced reports across devices
   ════════════════════════════════════════════════════════ */

/** POST /reports — Save a report and optionally send push to all devices */
app.post("/make-server-aac1ff1a/reports", async (c) => {
  try {
    const body = await c.req.json();
    const report = body.report;

    if (!report || !report.id) {
      return c.json({ error: "Missing report or report.id" }, 400);
    }

    // Store report in KV with prefix
    const kvKey = `report:${report.id}`;
    const record = {
      ...report,
      serverReceivedAt: new Date().toISOString(),
    };
    await kv.set(kvKey, record);
    console.log(`Report saved: ${kvKey} (${report.tipoEmergencia} - ${report.municipio})`);

    // Send push notification to all subscribed devices about the new report
    let pushResult = { sent: 0, failed: 0, total: 0 };
    try {
      const vapidKeys = await getOrCreateVAPIDKeys();
      const subscriptions = await kv.getByPrefix("push:sub:");

      if (subscriptions.length > 0) {
        // Create a notification record for deep-link support
        const notifId = crypto.randomUUID();
        const normalizedDescription = typeof report.descripcion === "string"
          ? report.descripcion.trim().replace(/\s+/g, " ")
          : "";
        const snippet = normalizedDescription.length > 140
          ? `${normalizedDescription.slice(0, 140).trimEnd()}...`
          : normalizedDescription;
        const detailPart = snippet ? `${snippet}. ` : "";

        const notifRecord = {
          id: notifId,
          title: `🚨 ${report.tipoEmergencia}`,
          body: `${report.ubicacion}, ${report.municipio}. ${detailPart}Prioridad: ${(report.prioridad || "media").toUpperCase()}. Reportado por: ${report.reportadoPor}`,
          icon: "/icon.svg",
          tag: `report-${report.id}`,
          createdAt: new Date().toISOString(),
          linkedReportId: report.id,
        };
        await kv.set(`push:notif:${notifId}`, notifRecord);

        const payload: PushPayload = {
          title: `🚨 ${report.tipoEmergencia}`,
          body: `${report.ubicacion}, ${report.municipio}. ${detailPart}Prioridad: ${(report.prioridad || "media").toUpperCase()}.`,
          icon: "/icon.svg",
          badge: "/icon.svg",
          tag: `report-${report.id}`,
          url: `/?notification=${notifId}`,
          data: { notificationId: notifId, reportId: report.id },
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
      reportId: report.id,
      push: pushResult,
    });
  } catch (err) {
    const msg = `Error saving report: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/** GET /reports — Get all submitted reports */
app.get("/make-server-aac1ff1a/reports", async (c) => {
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

/** DELETE /reports/:id — Delete a specific report */
app.delete("/make-server-aac1ff1a/reports/:id", async (c) => {
  try {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Missing report ID" }, 400);
    }
    await kv.del(`report:${id}`);
    console.log(`Report deleted: report:${id}`);
    return c.json({ success: true });
  } catch (err) {
    const msg = `Error deleting report: ${err instanceof Error ? err.message : String(err)}`;
    console.log(msg);
    return c.json({ error: msg }, 500);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   MONITORING — Server-synced monitoring entries across devices
   ══════════════════════════════════════════════════════════════════════════ */

/** POST /monitoring — Save a monitoring entry */
app.post("/make-server-aac1ff1a/monitoring", async (c) => {
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

/** GET /monitoring — Get all submitted monitoring entries */
app.get("/make-server-aac1ff1a/monitoring", async (c) => {
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

/* ════════════════════════════════════════════════════════
   SETTINGS — Avatar per role
   ════════════════════════════════════════════════════════ */

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

/** GET /settings/avatar/:roleId — Get avatar URL for a role */
app.get("/make-server-aac1ff1a/settings/avatar/:roleId", async (c) => {
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

/** POST /settings/avatar/:roleId — Upload avatar for a role */
app.post("/make-server-aac1ff1a/settings/avatar/:roleId", async (c) => {
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

/* ════════════════════════════════════════════════════════
   SETTINGS — Display name per role
   ════════════════════════════════════════════════════════ */

/** GET /settings/name/:roleId — Get display name for a role */
app.get("/make-server-aac1ff1a/settings/name/:roleId", async (c) => {
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

/** POST /settings/name/:roleId — Save display name for a role */
app.post("/make-server-aac1ff1a/settings/name/:roleId", async (c) => {
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
