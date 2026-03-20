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
    allowHeaders: ["Content-Type", "Authorization"],
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PUSH NOTIFICATIONS â€” Send
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/** POST /push/send â€” Send push notification to all subscribers */
routePost("/push/send", async (c) => {
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
      title: "ðŸš¨ ProtecciÃ³n Civil Tamaulipas",
      body: "Prueba de notificaciÃ³n push â€” Si ves esto, Â¡el sistema funciona correctamente!",
      icon: "/icon.svg",
      tag: "test-notification",
      createdAt: new Date().toISOString(),
    };
    await kv.set(`push:notif:${notifId}`, notifRecord);
    console.log(`Test notification stored: push:notif:${notifId}`);

    const payload: PushPayload = {
      title: "ðŸš¨ ProtecciÃ³n Civil Tamaulipas",
      body: "Prueba de notificaciÃ³n push â€” Si ves esto, Â¡el sistema funciona correctamente!",
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

/** POST /reports â€” Save a report and optionally send push to all devices */
routePost("/reports", async (c) => {
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
        const clip = (text: string, max = 150) => {
          const normalized = text.trim().replace(/\s+/g, " ");
          if (!normalized) return "";
          return normalized.length > max
            ? `${normalized.slice(0, max).trimEnd()}...`
            : normalized;
        };
        const transcripts = Array.isArray(report.audioNotes)
          ? report.audioNotes
              .map((note: { transcript?: string }) =>
                typeof note?.transcript === "string" ? note.transcript.trim() : "",
              )
              .filter((text: string) => text.length > 0)
          : [];
        if (
          transcripts.length === 0 &&
          typeof report.audioTranscript === "string" &&
          report.audioTranscript.trim().length > 0
        ) {
          transcripts.push(report.audioTranscript.trim());
        }
        const description =
          typeof report.descripcion === "string" ? report.descripcion.trim() : "";
        let primaryText = description;
        if (!primaryText && transcripts.length > 0) {
          primaryText = transcripts[0];
        } else if (primaryText.length < 100 && transcripts.length > 0 && !primaryText.includes(transcripts[0])) {
          primaryText = `${primaryText} ${transcripts[0]}`.trim();
        }
        if (primaryText.length < 100 && transcripts.length > 1 && !primaryText.includes(transcripts[1])) {
          primaryText = `${primaryText} ${transcripts[1]}`.trim();
        }
        const snippet = clip(primaryText);
        const bodyText = snippet || `Nuevo reporte de ${report.tipoEmergencia || "emergencia"}.`;

        const notifRecord = {
          id: notifId,
          title: "ProtecciÃ³n Civil Tamaulipas",
          body: bodyText,
          icon: "/icon.svg",
          tag: `report-${report.id}`,
          createdAt: new Date().toISOString(),
          linkedReportId: report.id,
        };
        await kv.set(`push:notif:${notifId}`, notifRecord);

        const payload: PushPayload = {
          title: "ProtecciÃ³n Civil Tamaulipas",
          body: bodyText,
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
