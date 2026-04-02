import { API_BASE, apiHeaders } from "./apiClient";

type PushEnrollState =
  | "subscribed"
  | "already-subscribed"
  | "permission-denied"
  | "permission-dismissed"
  | "unsupported"
  | "failed";

export type PushEnrollResult = {
  ok: boolean;
  state: PushEnrollState;
  error?: string;
};

const SW_READY_TIMEOUT_MS = 4000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    const match = ua.match(/;\s*([^;)]+)\s*Build/);
    return match ? match[1].trim() : "Android";
  }
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux";
  return "Dispositivo";
}

function supportsPushStack(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const active = regs.find((reg) => !!reg.active);
    if (active) return active;
  } catch {
    // no-op
  }

  try {
    const ready = await Promise.race<ServiceWorkerRegistration | null>([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS),
      ),
    ]);
    if (ready) return ready;
  } catch {
    // no-op
  }

  try {
    const reg = await navigator.serviceWorker.register("/push-handler.js", {
      scope: "/",
    });
    if (reg.active) return reg;

    const waiting = reg.installing || reg.waiting;
    if (waiting) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 5000);
        waiting.addEventListener("statechange", () => {
          if (waiting.state === "activated" || waiting.state === "redundant") {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }

    return reg.active ?? null;
  } catch {
    return null;
  }
}

async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch(`${API_BASE}/push/vapid-public-key`, {
    headers: apiHeaders,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`VAPID ${res.status}: ${detail}`);
  }
  const data = (await res.json()) as { publicKey?: string };
  if (!data.publicKey) throw new Error("VAPID key missing");
  return data.publicKey;
}

async function persistSubscription(subscription: PushSubscription): Promise<void> {
  const res = await fetch(`${API_BASE}/push/subscribe`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      deviceName: getDeviceName(),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Subscribe ${res.status}: ${detail}`);
  }
}

async function ensurePushSubscriptionWithGrantedPermission(): Promise<PushEnrollResult> {
  if (!supportsPushStack()) return { ok: false, state: "unsupported" };

  const reg = await getPushRegistration();
  if (!reg) return { ok: false, state: "unsupported" };

  const current = await reg.pushManager.getSubscription();
  if (current) {
    try {
      await persistSubscription(current);
      return { ok: true, state: "already-subscribed" };
    } catch (err) {
      return {
        ok: false,
        state: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  try {
    const publicKey = await fetchVapidPublicKey();
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await persistSubscription(subscription);
    return { ok: true, state: "subscribed" };
  } catch (err) {
    return {
      ok: false,
      state: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function requestAndSubscribePush(): Promise<PushEnrollResult> {
  if (!supportsPushStack()) return { ok: false, state: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission === "denied") {
    return { ok: false, state: "permission-denied" };
  }
  if (permission !== "granted") {
    return { ok: false, state: "permission-dismissed" };
  }

  return ensurePushSubscriptionWithGrantedPermission();
}

export async function ensurePushSubscriptionInBackground(): Promise<boolean> {
  if (!supportsPushStack()) return false;
  if (Notification.permission !== "granted") return false;
  const result = await ensurePushSubscriptionWithGrantedPermission();
  return result.ok;
}
