/**
 * NotificationDeepLink — Manages notification deep linking
 * 
 * Handles two scenarios:
 * 1. App opened from notification tap (URL has ?notification=ID)
 * 2. App already open when notification is tapped (SW sends postMessage)
 * 
 * Uses a module-level variable to communicate the pending notification ID
 * to SupervisorNotifications without needing a global context.
 */

/* ─── Module-level state ─── */
let _pendingNotificationId: string | null = null;
let _listeners: Array<(id: string) => void> = [];

/** Check URL params on module load */
if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const notifId = params.get("notification");
  if (notifId) {
    _pendingNotificationId = notifId;
    console.log("[DeepLink] Notification ID from URL:", notifId);
    // Clean the URL without reloading
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
  }
}

/** Get and consume the pending notification ID (returns null after first read) */
export function consumePendingNotificationId(): string | null {
  const id = _pendingNotificationId;
  _pendingNotificationId = null;
  return id;
}

/** Peek at the pending ID without consuming it */
export function peekPendingNotificationId(): string | null {
  return _pendingNotificationId;
}

/** Subscribe to notification click events from SW postMessage */
export function onNotificationClick(callback: (notificationId: string) => void): () => void {
  _listeners.push(callback);
  return () => {
    _listeners = _listeners.filter((l) => l !== callback);
  };
}

/** Fire all listeners */
function notifyListeners(notificationId: string) {
  _listeners.forEach((fn) => fn(notificationId));
}

/** Initialize the SW message listener — call once from App.tsx */
export function initSWMessageListener() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "NOTIFICATION_CLICK" && event.data?.notificationId) {
      console.log("[DeepLink] SW postMessage received:", event.data.notificationId);
      notifyListeners(event.data.notificationId);
    }
  });

  console.log("[DeepLink] SW message listener initialized");
}
