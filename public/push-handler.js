/**
 * Push Notification Service Worker
 * Works both as standalone SW and as importScript in VitePWA's workbox SW
 */

/* ─── Install — Activate immediately ─── */
self.addEventListener("install", (event) => {
  console.log("[Push SW] Installing...");
  self.skipWaiting();
});

/* ─── Activate — Claim all clients immediately ─── */
self.addEventListener("activate", (event) => {
  console.log("[Push SW] Activating...");
  event.waitUntil(self.clients.claim());
});

/* ─── Push Event — Received push from server ─── */
self.addEventListener("push", (event) => {
  console.log("[Push SW] Push received:", event);

  let data = {
    title: "Protección Civil Tamaulipas",
    body: "Nueva notificación",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: "pc-tamaulipas",
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch (e) {
      console.log("[Push SW] Error parsing push data, using text:", e);
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icon.svg",
    badge: data.badge || "/icon.svg",
    tag: data.tag || "pc-tamaulipas",
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || "/",
      ...data.data,
    },
    actions: [
      { action: "open", title: "Abrir" },
      { action: "dismiss", title: "Cerrar" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/* ─── Notification Click — Open the app ─── */
self.addEventListener("notificationclick", (event) => {
  console.log("[Push SW] Notification click:", event.action);
  event.notification.close();

  if (event.action === "dismiss") return;

  const urlToOpen = event.notification.data?.url || "/";
  const notificationId = event.notification.data?.notificationId;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, send postMessage and focus
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          // Send the notification ID via postMessage so the app switches to Alertas tab
          if (notificationId) {
            client.postMessage({
              type: "NOTIFICATION_CLICK",
              notificationId: notificationId,
            });
          }
          return client.focus();
        }
      }
      // App not open — open with deep link URL
      return self.clients.openWindow(urlToOpen);
    })
  );
});

/* ─── Push Subscription Change ─── */
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[Push SW] Push subscription changed");
});

console.log("[Push SW] Push handler loaded ✓");