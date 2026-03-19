import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  Bell,
  BellOff,
  BellRing,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Zap,
  X,
  Copy,
  Check,
  Terminal,
  MonitorSmartphone,
  Radio,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { API_BASE, apiHeaders } from "../lib/apiClient";

/* ─── Types ─── */
type PushStatus =
  | "unsupported" // Browser doesn't support push
  | "denied" // User denied permission
  | "prompt" // Permission not yet asked
  | "unsubscribed" // Permission granted but not subscribed
  | "subscribing" // In progress
  | "subscribed" // Active subscription
  | "demo" // Demo mode — SW unavailable, local notifications only
  | "error"; // Something went wrong

interface StatusInfo {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}

const STATUS_MAP: Record<PushStatus, StatusInfo> = {
  unsupported: {
    label: "No soportado",
    color: "#6B7280",
    bgColor: "rgba(107,114,128,0.1)",
    icon: WifiOff,
  },
  denied: {
    label: "Bloqueado",
    color: "#DC2626",
    bgColor: "rgba(220,38,38,0.1)",
    icon: BellOff,
  },
  prompt: {
    label: "Sin activar",
    color: "#F59E0B",
    bgColor: "rgba(245,158,11,0.1)",
    icon: Bell,
  },
  unsubscribed: {
    label: "Desconectado",
    color: "#F59E0B",
    bgColor: "rgba(245,158,11,0.1)",
    icon: BellOff,
  },
  subscribing: {
    label: "Conectando...",
    color: "#3B82F6",
    bgColor: "rgba(59,130,246,0.1)",
    icon: Loader2,
  },
  subscribed: {
    label: "Activo",
    color: "#059669",
    bgColor: "rgba(5,150,105,0.1)",
    icon: BellRing,
  },
  demo: {
    label: "Modo Demo",
    color: "#8B5CF6",
    bgColor: "rgba(139,92,246,0.1)",
    icon: MonitorSmartphone,
  },
  error: {
    label: "Error",
    color: "#DC2626",
    bgColor: "rgba(220,38,38,0.1)",
    icon: AlertCircle,
  },
};

/* ─── Push Notification Manager Component ─── */
export function PushNotificationManager() {
  const [status, setStatus] = useState<PushStatus>("prompt");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [subCount, setSubCount] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const demoModeRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) =>
      [`[${time}] ${msg}`, ...prev].slice(0, 50),
    );
  }, []);

  const copyLogs = useCallback(async () => {
    const text = logs.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [logs]);

  /* ─── Check initial status ─── */
  useEffect(() => {
    const notifSupported = "Notification" in window;
    const swSupported = "serviceWorker" in navigator;
    const pushSupported = "PushManager" in window;

    addLog(`📱 Dispositivo: ${getDeviceName()}`);
    addLog(`🌐 Host: ${window.location.hostname}`);
    addLog(
      `📋 Soporte: Notification=${notifSupported}, SW=${swSupported}, Push=${pushSupported}`,
    );

    if (!notifSupported) {
      setStatus("unsupported");
      addLog("❌ Notification API no disponible");
      return;
    }

    const perm = Notification.permission;
    addLog(`📋 Permiso actual: ${perm}`);

    if (perm === "denied") {
      setStatus("denied");
      addLog(
        "🚫 Permisos de notificación bloqueados por el usuario",
      );
      return;
    }

    if (!swSupported || !pushSupported) {
      // No SW/Push support but Notification API works → demo mode
      addLog("⚠️ Sin soporte SW/Push — activando Modo Demo");
      addLog(
        "📲 Modo Demo usa notificaciones locales (sin push del servidor)",
      );
      demoModeRef.current = true;
      if (perm === "granted") {
        setStatus("demo");
      } else {
        setStatus("prompt");
      }
      return;
    }

    // Full support — try to get SW
    ensurePushSW(addLog)
      .then((reg) => {
        if (!reg) {
          // SW failed → enter demo mode
          addLog(
            "📲 SW no disponible en este hosting — activando Modo Demo",
          );
          addLog(
            "ℹ️ Las notificaciones locales funcionan. Push real requiere hosting propio.",
          );
          demoModeRef.current = true;
          if (perm === "granted") {
            setStatus("demo");
          } else {
            setStatus("prompt");
          }
          return null;
        }
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        if (sub) {
          setStatus("subscribed");
          addLog("✅ Suscripción push activa encontrada");
        } else if (!demoModeRef.current) {
          if (perm === "granted") {
            setStatus("unsubscribed");
            addLog(
              "⚠️ Permiso concedido pero sin suscripción activa",
            );
          } else {
            setStatus("prompt");
            addLog("📋 Listo para solicitar permisos");
          }
        }
      })
      .catch((err) => {
        addLog(
          `⚠️ Error verificando SW: ${err?.message || err}`,
        );
        demoModeRef.current = true;
        if (perm === "granted") {
          setStatus("demo");
        } else {
          setStatus("prompt");
        }
      });
  }, [addLog]);

  /* ─── Fetch subscription count ─── */
  useEffect(() => {
          fetch(`${API_BASE}/push/subscriptions`, { headers: apiHeaders })
      .then((r) => r.json())
      .then((data) => {
        setSubCount(data.count ?? 0);
        addLog(
          `📊 Suscripciones en servidor: ${data.count ?? 0}`,
        );
      })
      .catch((err) =>
        addLog(`⚠️ No se pudo obtener conteo: ${err.message}`),
      );
  }, [status, addLog]);

  /* ─── Subscribe (full push or demo) ─── */
  const subscribe = useCallback(async () => {
    setStatus("subscribing");
    setErrorMsg("");
    setTestResult(null);

    try {
      // Step 1: Request notification permission
      addLog("📢 Solicitando permiso de notificaciones...");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(
          permission === "denied" ? "denied" : "prompt",
        );
        addLog(
          `🚫 Permiso ${permission === "denied" ? "denegado" : "no concedido"}`,
        );
        return;
      }
      addLog("✅ Permiso concedido");

      // Check if we're in demo mode
      if (demoModeRef.current) {
        addLog(
          "📲 Modo Demo activado — notificaciones locales listas",
        );
        addLog(
          "ℹ️ Push real requiere desplegar en hosting propio (Vercel, Netlify, etc.)",
        );
        setStatus("demo");
        return;
      }

      // Step 2: Ensure Service Worker is registered
      addLog("⚙️ Registrando Service Worker para push...");
      const reg = await withTimeout(
        ensurePushSW(addLog),
        15000,
        "Timeout registrando Service Worker (15s)",
      );
      if (!reg) {
        // Fall back to demo mode
        addLog("📲 SW no disponible — cambiando a Modo Demo");
        demoModeRef.current = true;
        setStatus("demo");
        return;
      }

      // Wait for SW to be active
      if (reg.installing || reg.waiting) {
        addLog("⏳ Esperando activación del Service Worker...");
        await withTimeout(
          waitForSWActive(reg),
          10000,
          "Timeout esperando activación del SW (10s)",
        );
      }
      addLog("✅ Service Worker activo");

      // Step 3: Get VAPID public key from server
      addLog("🔑 Obteniendo clave VAPID del servidor...");
      const vapidRes = await withTimeout(
              fetch(`${API_BASE}/push/vapid-public-key`, { headers: apiHeaders }),
        15000,
        "Timeout obteniendo clave VAPID (15s)",
      );
      if (!vapidRes.ok) {
        const errBody = await vapidRes.text().catch(() => "");
        throw new Error(
          `Server ${vapidRes.status} VAPID: ${errBody}`,
        );
      }
      const { publicKey: vapidPublicKey } =
        await vapidRes.json();
      addLog(
        `🔑 Clave VAPID: ${vapidPublicKey.slice(0, 20)}...`,
      );

      // Step 4: Subscribe via PushManager
      addLog("📡 Creando suscripción push...");
      const subscription = await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(vapidPublicKey),
        }),
        15000,
        "Timeout creando suscripción push (15s)",
      );
      addLog("📡 Suscripción creada exitosamente");
      addLog(
        `📡 Endpoint: ...${subscription.endpoint.slice(-40)}`,
      );

      // Step 5: Send subscription to server
      addLog("💾 Guardando suscripción en servidor...");
      const deviceName = getDeviceName();
      const saveRes = await withTimeout(
        fetch(`${API_BASE}/push/subscribe`, {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            deviceName,
          }),
        }),
        15000,
        "Timeout guardando suscripción (15s)",
      );

      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}));
        throw new Error(
          errData.error || `Server returned ${saveRes.status}`,
        );
      }

      addLog(`✅ Suscripción guardada para: ${deviceName}`);
      setStatus("subscribed");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err);
      setStatus("error");
      setErrorMsg(msg);
      addLog(`❌ Error: ${msg}`);
    }
  }, [addLog]);

  /* ─── Unsubscribe ─── */
  const unsubscribe = useCallback(async () => {
    try {
      if (demoModeRef.current) {
        addLog("🔄 Desactivando modo demo...");
        setStatus("unsubscribed");
        return;
      }

      addLog("🔄 Desuscribiendo...");
      const reg = await ensurePushSW(addLog);
      if (!reg) {
        setStatus("unsubscribed");
        return;
      }
      const subscription =
        await reg.pushManager.getSubscription();

      if (subscription) {
        await fetch(`${API_BASE}/push/unsubscribe`, {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        }).catch(() => {});
        await subscription.unsubscribe();
        addLog("✅ Suscripción eliminada");
      }

      setStatus("unsubscribed");
    } catch (err) {
      addLog(
        `❌ Error al desuscribir: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [addLog]);

  /* ─── Send local notification (demo mode) ─── */
  const sendLocalNotification = useCallback(
    (title: string, body: string) => {
      try {
        const notif = new Notification(title, {
          body,
          icon: "/icon.svg",
          badge: "/icon.svg",
          tag: "pc-tamaulipas-demo",
          vibrate: [200, 100, 200],
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
        return true;
      } catch (e) {
        // Some mobile browsers don't support new Notification() directly
        // Try the registration-based approach if available
        if (
          "serviceWorker" in navigator &&
          navigator.serviceWorker.controller
        ) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon: "/icon.svg",
              badge: "/icon.svg",
              tag: "pc-tamaulipas-demo",
            });
          });
          return true;
        }
        console.error("[Demo] Error creating notification:", e);
        return false;
      }
    },
    [],
  );

  /* ─── Send test notification ─── */
  const sendTest = useCallback(async () => {
    setSendingTest(true);
    setTestResult(null);

    if (demoModeRef.current) {
      addLog("🚀 Enviando notificación local de prueba...");
      // Small delay to feel more realistic
      await new Promise((r) => setTimeout(r, 500));
      const ok = sendLocalNotification(
        "🔔 Protección Civil Tamaulipas",
        "Notificación de prueba desde Modo Demo — el sistema funciona correctamente.",
      );
      if (ok) {
        setTestResult({
          success: true,
          message: "✅ Notificación local enviada",
        });
        addLog("✅ Notificación local mostrada exitosamente");
      } else {
        setTestResult({
          success: false,
          message: "❌ No se pudo mostrar la notificación",
        });
        addLog("❌ Error mostrando notificación local");
      }
      setSendingTest(false);
      return;
    }

    addLog("🚀 Enviando notificación push de prueba...");
    try {
      const res = await fetch(`${API_BASE}/push/send-test`, {
        method: "POST",
        headers: apiHeaders,
      });

      const data = await res.json();

      if (data.sent > 0) {
        setTestResult({
          success: true,
          message: `✅ Enviada a ${data.sent} dispositivo(s)`,
        });
        addLog(
          `✅ Push enviado: ${data.sent}/${data.total} exitosos`,
        );
      } else {
        setTestResult({
          success: false,
          message:
            data.error ||
            `Falló el envío. ${data.errors?.[0]?.error || ""}`,
        });
        addLog(
          `❌ Fallo: ${data.error || JSON.stringify(data.errors?.[0])}`,
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, message: msg });
      addLog(`❌ Error de red: ${msg}`);
    } finally {
      setSendingTest(false);
    }
  }, [addLog, sendLocalNotification]);

  /* ─── Send custom notification ─── */
  const [customTitle, setCustomTitle] = useState(
    "⚠️ Alerta Meteorológica",
  );
  const [customBody, setCustomBody] = useState(
    "Se prevén lluvias intensas en zona sur de Tamaulipas. Active protocolo preventivo.",
  );

  /* ─── File attachment state ─── */
  const [attachedFile, setAttachedFile] = useState<File | null>(
    null,
  );
  const [attachedPreview, setAttachedPreview] = useState<
    string | null
  >(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        addLog("❌ Archivo demasiado grande (máx 5MB)");
        return;
      }
      setAttachedFile(file);
      addLog(
        `📎 Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
      );
      // Generate preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) =>
          setAttachedPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setAttachedPreview(null);
      }
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [addLog],
  );

  const removeAttachedFile = useCallback(() => {
    setAttachedFile(null);
    setAttachedPreview(null);
    addLog("📎 Archivo adjunto eliminado");
  }, [addLog]);

  const sendCustom = useCallback(async () => {
    setSendingTest(true);
    setTestResult(null);
    addLog(
      `🚀 Enviando: "${customTitle}"${attachedFile ? ` + 📎 ${attachedFile.name}` : ""}`,
    );

    if (demoModeRef.current) {
      await new Promise((r) => setTimeout(r, 500));
      const ok = sendLocalNotification(customTitle, customBody);
      if (ok) {
        setTestResult({
          success: true,
          message: "✅ Notificación local enviada",
        });
        addLog("✅ Notificación local personalizada mostrada");
      } else {
        setTestResult({
          success: false,
          message: "❌ No se pudo mostrar",
        });
        addLog("❌ Error mostrando notificación local");
      }
      setSendingTest(false);
      return;
    }

    try {
      // Step 1: Upload file if attached
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      let attachmentType: string | undefined;

      if (attachedFile) {
        setUploading(true);
        addLog(`📤 Subiendo archivo: ${attachedFile.name}...`);

        const formData = new FormData();
        formData.append("file", attachedFile);

        const uploadRes = await fetch(
          `${API_BASE}/push/upload`,
          {
            method: "POST",
            headers: {
              Authorization: apiHeaders.Authorization,
            },
            body: formData,
          },
        );

        const uploadData = await uploadRes.json();
        setUploading(false);

        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(
            uploadData.error || "Error subiendo archivo",
          );
        }

        attachmentUrl = uploadData.url;
        attachmentName = uploadData.fileName;
        attachmentType = uploadData.fileType;
        addLog(`✅ Archivo subido: ${attachmentName}`);
      }

      // Step 2: Send notification with attachment info
      const res = await fetch(`${API_BASE}/push/send`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          title: customTitle,
          body: customBody,
          tag: "custom-alert",
          attachmentUrl,
          attachmentName,
          attachmentType,
        }),
      });

      const data = await res.json();

      if (data.sent > 0) {
        setTestResult({
          success: true,
          message: `✅ Enviada a ${data.sent} dispositivo(s)${attachmentUrl ? " con adjunto" : ""}`,
        });
        addLog(
          `✅ Custom push enviado: ${data.sent}/${data.total}`,
        );
        // Clear file after successful send
        setAttachedFile(null);
        setAttachedPreview(null);
      } else {
        setTestResult({
          success: false,
          message: data.error || "Falló el envío",
        });
        addLog(
          `❌ Fallo: ${data.error || JSON.stringify(data.errors)}`,
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, message: msg });
      addLog(`❌ Error: ${msg}`);
      setUploading(false);
    } finally {
      setSendingTest(false);
    }
  }, [
    addLog,
    customTitle,
    customBody,
    sendLocalNotification,
    attachedFile,
  ]);

  const isDemo = status === "demo";
  const statusInfo = STATUS_MAP[status];
  const StatusIcon = statusInfo.icon;
  const canSubscribe =
    status === "prompt" ||
    status === "unsubscribed" ||
    status === "error";
  const canTest = status === "subscribed" || isDemo;

  return (
    <div className="flex-1 min-h-0">
      {/* Header section */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-[20px] text-[#1C1C1E]"
            style={{ fontWeight: 700 }}
          >
            Push Notifications
          </h2>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-xl active:bg-[#E5E5EA] transition-colors"
          >
            {expanded ? (
              <ChevronUp size={20} color="#8E8E93" />
            ) : (
              <ChevronDown size={20} color="#8E8E93" />
            )}
          </button>
        </div>

        {/* Status card */}
        <div
          className="rounded-2xl p-4 mb-3"
          style={{
            background: "#FFFFFF",
            border: `1px solid ${isDemo ? "rgba(139,92,246,0.2)" : "#E5E5EA"}`,
            boxShadow: isDemo
              ? "0 1px 8px rgba(139,92,246,0.1)"
              : "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: statusInfo.bgColor }}
            >
              <StatusIcon
                size={24}
                style={{ color: statusInfo.color }}
                className={
                  status === "subscribing" ? "animate-spin" : ""
                }
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className="text-[16px] text-[#1C1C1E]"
                  style={{ fontWeight: 600 }}
                >
                  Estado: {statusInfo.label}
                </p>
                {isDemo && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] text-white"
                    style={{
                      background: "#8B5CF6",
                      fontWeight: 700,
                    }}
                  >
                    LOCAL
                  </span>
                )}
              </div>
              <p className="text-[13px] text-[#8E8E93]">
                {status === "subscribed" &&
                  "Las notificaciones llegarán a este dispositivo"}
                {status === "prompt" &&
                  "Toca el botón para activar notificaciones"}
                {status === "denied" &&
                  "Ve a ajustes del navegador para desbloquear"}
                {status === "unsupported" &&
                  "Tu navegador no soporta push notifications"}
                {status === "unsubscribed" &&
                  "Permiso concedido, falta activar la suscripción"}
                {status === "subscribing" &&
                  "Configurando la conexión push..."}
                {isDemo &&
                  "Notificaciones locales activas — push requiere hosting propio"}
                {status === "error" &&
                  (errorMsg || "Ocurrió un error inesperado")}
              </p>
            </div>
            {subCount !== null && (
              <div className="flex flex-col items-center">
                <span
                  className="text-[20px] text-[#1C1C1E] tabular-nums"
                  style={{ fontWeight: 700 }}
                >
                  {subCount}
                </span>
                <span className="text-[11px] text-[#8E8E93]">
                  dispositivos
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {canSubscribe && (
              <button
                onClick={subscribe}
                disabled={status === "subscribing"}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white active:opacity-80 transition-opacity disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, #AB1738, #8B1028)",
                  fontWeight: 600,
                  fontSize: "15px",
                }}
              >
                <Bell size={18} />
                Activar Notificaciones
              </button>
            )}
            {(status === "subscribed" || isDemo) && (
              <button
                onClick={unsubscribe}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl active:opacity-80 transition-opacity"
                style={{
                  background: isDemo
                    ? "rgba(139,92,246,0.08)"
                    : "rgba(220,38,38,0.08)",
                  color: isDemo ? "#8B5CF6" : "#DC2626",
                  fontWeight: 600,
                  fontSize: "15px",
                  border: `1px solid ${isDemo ? "rgba(139,92,246,0.15)" : "rgba(220,38,38,0.15)"}`,
                }}
              >
                <BellOff size={18} />
                Desactivar
              </button>
            )}
          </div>

          {/* Error message */}
          {errorMsg && status === "error" && (
            <div
              className="mt-3 p-3 rounded-xl"
              style={{
                background: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.12)",
              }}
            >
              <p
                className="text-[13px] text-[#DC2626]"
                style={{ lineHeight: 1.4 }}
              >
                {errorMsg}
              </p>
            </div>
          )}
        </div>

        {/* Demo mode info banner */}
        {isDemo && (
          <div
            className="rounded-2xl p-3.5 mb-3 flex items-start gap-3"
            style={{
              background:
                "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))",
              border: "1px solid rgba(139,92,246,0.15)",
            }}
          >
            <Radio
              size={18}
              className="shrink-0 mt-0.5"
              style={{ color: "#8B5CF6" }}
            />
            <div>
              <p
                className="text-[13px] text-[#1C1C1E]"
                style={{ fontWeight: 600, lineHeight: 1.4 }}
              >
                Modo Demo — Service Worker no detectado
              </p>
              <p
                className="text-[12px] text-[#8E8E93] mt-1"
                style={{ lineHeight: 1.5 }}
              >
                No se pudo registrar el Service Worker. Verifica
                que{" "}
                <span style={{ fontWeight: 600 }}>
                  /push-handler.js
                </span>{" "}
                esté accesible en tu dominio. Las notificaciones
                de prueba se muestran localmente con{" "}
                <span style={{ fontWeight: 600 }}>
                  new Notification()
                </span>
                .
              </p>
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <>
          {/* ─── Test Section ─── */}
          {canTest && (
            <div className="px-4 pb-3">
              {/* Quick test */}
              <div
                className="rounded-2xl p-4 mb-3"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E5EA",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <p
                    className="text-[15px] text-[#1C1C1E]"
                    style={{ fontWeight: 600 }}
                  >
                    Prueba Rápida
                  </p>
                  {isDemo && (
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(139,92,246,0.1)",
                        color: "#8B5CF6",
                        fontWeight: 600,
                      }}
                    >
                      Local
                    </span>
                  )}
                </div>
                <button
                  onClick={sendTest}
                  disabled={sendingTest}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white active:opacity-80 transition-opacity disabled:opacity-50"
                  style={{
                    background: isDemo
                      ? "linear-gradient(135deg, #8B5CF6, #7C3AED)"
                      : "linear-gradient(135deg, #3B82F6, #2563EB)",
                    fontWeight: 600,
                    fontSize: "15px",
                  }}
                >
                  {sendingTest ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Zap size={18} />
                  )}
                  {sendingTest
                    ? "Enviando..."
                    : isDemo
                      ? "Enviar Notificación Local"
                      : "Enviar Notificación de Prueba"}
                </button>

                {testResult && (
                  <div
                    className="mt-3 p-3 rounded-xl flex items-start gap-2"
                    style={{
                      background: testResult.success
                        ? "rgba(5,150,105,0.06)"
                        : "rgba(220,38,38,0.06)",
                      border: `1px solid ${testResult.success ? "rgba(5,150,105,0.12)" : "rgba(220,38,38,0.12)"}`,
                    }}
                  >
                    {testResult.success ? (
                      <CheckCircle2
                        size={16}
                        className="shrink-0 mt-0.5"
                        style={{ color: "#059669" }}
                      />
                    ) : (
                      <AlertCircle
                        size={16}
                        className="shrink-0 mt-0.5"
                        style={{ color: "#DC2626" }}
                      />
                    )}
                    <p
                      className="text-[13px]"
                      style={{
                        color: testResult.success
                          ? "#059669"
                          : "#DC2626",
                        lineHeight: 1.4,
                      }}
                    >
                      {testResult.message}
                    </p>
                  </div>
                )}
              </div>

              {/* Custom notification */}
              <div
                className="rounded-2xl p-4 mb-3"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E5EA",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <p
                    className="text-[15px] text-[#1C1C1E]"
                    style={{ fontWeight: 600 }}
                  >
                    Notificación Personalizada
                  </p>
                  {isDemo && (
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(139,92,246,0.1)",
                        color: "#8B5CF6",
                        fontWeight: 600,
                      }}
                    >
                      Local
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 mb-3">
                  <input
                    value={customTitle}
                    onChange={(e) =>
                      setCustomTitle(e.target.value)
                    }
                    placeholder="Título"
                    className="w-full px-3 py-2.5 rounded-xl text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none"
                    style={{
                      background: "#F2F2F7",
                      border: "1px solid #E5E5EA",
                    }}
                  />
                  <textarea
                    value={customBody}
                    onChange={(e) =>
                      setCustomBody(e.target.value)
                    }
                    placeholder="Mensaje"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl text-[15px] text-[#1C1C1E] placeholder:text-[#C7C7CC] outline-none resize-none"
                    style={{
                      background: "#F2F2F7",
                      border: "1px solid #E5E5EA",
                    }}
                  />
                </div>

                {/* ─── Attachment area ─── */}
                <div className="mb-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  />

                  {!attachedFile ? (
                    /* No file — show attach button */
                    <button
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl active:opacity-80 transition-opacity"
                      style={{
                        background: "#F2F2F7",
                        border: "1px dashed #C7C7CC",
                      }}
                    >
                      <Paperclip size={16} color="#8E8E93" />
                      <span
                        className="text-[14px] text-[#8E8E93]"
                        style={{ fontWeight: 500 }}
                      >
                        Adjuntar archivo (max 5MB)
                      </span>
                    </button>
                  ) : (
                    /* File attached — show preview card */
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{
                        border: "1px solid #E5E5EA",
                        background: "#F9F9FB",
                      }}
                    >
                      {/* Image preview */}
                      {attachedPreview && (
                        <div className="relative">
                          <img
                            src={attachedPreview}
                            alt="Preview"
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}

                      {/* File info bar */}
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background:
                              attachedFile.type.startsWith(
                                "image/",
                              )
                                ? "rgba(59,130,246,0.1)"
                                : "rgba(188,149,91,0.1)",
                          }}
                        >
                          {attachedFile.type.startsWith(
                            "image/",
                          ) ? (
                            <ImageIcon
                              size={16}
                              style={{ color: "#3B82F6" }}
                            />
                          ) : (
                            <FileText
                              size={16}
                              style={{ color: "#BC955B" }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-[13px] text-[#1C1C1E] truncate"
                            style={{ fontWeight: 500 }}
                          >
                            {attachedFile.name}
                          </p>
                          <p className="text-[11px] text-[#8E8E93]">
                            {(attachedFile.size / 1024).toFixed(
                              1,
                            )}{" "}
                            KB
                          </p>
                        </div>
                        <button
                          onClick={removeAttachedFile}
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 active:opacity-60 transition-opacity"
                          style={{
                            background: "rgba(220,38,38,0.08)",
                          }}
                        >
                          <Trash2
                            size={15}
                            style={{ color: "#DC2626" }}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Upload progress indicator */}
                  {uploading && (
                    <div className="flex items-center gap-2 mt-2 px-1">
                      <Loader2
                        size={14}
                        className="animate-spin"
                        style={{ color: "#BC955B" }}
                      />
                      <span
                        className="text-[13px] text-[#BC955B]"
                        style={{ fontWeight: 500 }}
                      >
                        Subiendo archivo...
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={sendCustom}
                  disabled={sendingTest || !customTitle.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white active:opacity-80 transition-opacity disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(135deg, #BC955B, #A07C48)",
                    fontWeight: 600,
                    fontSize: "15px",
                  }}
                >
                  {sendingTest ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Send size={18} />
                  )}
                  Enviar Personalizada
                </button>
              </div>
            </div>
          )}

          {/* ─── Debug Log ─── */}
          <div className="px-4 pb-3">
            <button
              onClick={() => setLogModalOpen(true)}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl active:opacity-80 transition-opacity"
              style={{
                background: "#1C1C1E",
                border: "1px solid #38383A",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              <Terminal size={18} color="#8E8E93" />
              <span
                className="text-[15px] text-[#AEAEB2]"
                style={{ fontWeight: 600 }}
              >
                Ver Log Completo
              </span>
              {logs.length > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] text-white"
                  style={{
                    background: "#AB1738",
                    fontWeight: 700,
                  }}
                >
                  {logs.length}
                </span>
              )}
            </button>
          </div>
        </>
      )}

      {/* ═══ FULLSCREEN LOG MODAL ═══ */}
      {logModalOpen && (
        <div
          className="fixed inset-0 flex flex-col"
          style={{ background: "#000000", zIndex: 99999 }}
        >
          {/* Modal Header */}
          <div
            className="flex items-center justify-between px-4 shrink-0"
            style={{
              paddingTop:
                "max(env(safe-area-inset-top, 12px), 12px)",
              borderBottom: "1px solid #2C2C2E",
              background: "#1C1C1E",
            }}
          >
            <div className="flex items-center gap-2 py-3">
              <Terminal size={18} color="#AB1738" />
              <span
                className="text-[16px] text-white"
                style={{ fontWeight: 700 }}
              >
                Debug Log
              </span>
              <span className="text-[13px] text-[#636366]">
                ({logs.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyLogs}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg active:opacity-60 transition-opacity"
                style={{ background: "#2C2C2E" }}
              >
                {copied ? (
                  <Check size={14} color="#34C759" />
                ) : (
                  <Copy size={14} color="#AEAEB2" />
                )}
                <span
                  className="text-[13px]"
                  style={{
                    color: copied ? "#34C759" : "#AEAEB2",
                    fontWeight: 600,
                  }}
                >
                  {copied ? "Copiado!" : "Copiar"}
                </span>
              </button>
              <button
                onClick={() => setLogModalOpen(false)}
                className="flex items-center justify-center w-9 h-9 rounded-full active:opacity-60 transition-opacity"
                style={{ background: "#2C2C2E" }}
              >
                <X size={18} color="#AEAEB2" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                <Terminal size={40} color="#636366" />
                <p className="text-[14px] text-[#636366] font-mono">
                  Sin actividad...
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {logs.map((log, i) => (
                  <p
                    key={i}
                    className="text-[13px] font-mono leading-relaxed"
                    style={{
                      color: log.includes("\u274C")
                        ? "#FF453A"
                        : log.includes("\u26A0\uFE0F")
                          ? "#FFD60A"
                          : log.includes("\u2705")
                            ? "#30D158"
                            : log.includes("\uD83D\uDCE1")
                              ? "#64D2FF"
                              : log.includes("\uD83D\uDD11")
                                ? "#BF5AF2"
                                : log.includes("\uD83D\uDCF2")
                                  ? "#A78BFA"
                                  : "#AEAEB2",
                      wordBreak: "break-all",
                    }}
                  >
                    {log}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div
            className="shrink-0 flex gap-2 px-4 py-3"
            style={{
              paddingBottom:
                "calc(max(env(safe-area-inset-bottom, 12px), 12px) + 8px)",
              borderTop: "1px solid #2C2C2E",
              background: "#1C1C1E",
            }}
          >
            <button
              onClick={() => setLogs([])}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl active:opacity-80 transition-opacity"
              style={{
                background: "rgba(255,69,58,0.15)",
                color: "#FF453A",
                fontWeight: 600,
                fontSize: "15px",
              }}
            >
              Limpiar Log
            </button>
            <button
              onClick={() => setLogModalOpen(false)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl active:opacity-80 transition-opacity"
              style={{
                background: "rgba(171,23,56,0.15)",
                color: "#AB1738",
                fontWeight: 600,
                fontSize: "15px",
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─── */
function urlBase64ToUint8Array(
  base64String: string,
): Uint8Array {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4,
  );
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
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
  return "Dispositivo desconocido";
}

async function ensurePushSW(
  addLog: (msg: string) => void,
): Promise<ServiceWorkerRegistration | null> {
  try {
    addLog("🔍 Buscando Service Workers existentes...");
    const existingRegs =
      await navigator.serviceWorker.getRegistrations();
    addLog(
      `🔍 Encontrados: ${existingRegs.length} registros SW`,
    );

    // If there's already an active SW, use it immediately
    for (const reg of existingRegs) {
      if (reg.active) {
        addLog(
          `✅ SW activo encontrado: ${reg.active.scriptURL.split("/").pop()}`,
        );
        return reg;
      }
    }

    // Use navigator.serviceWorker.ready — resolves when VitePWA's SW activates
    addLog(
      "⏳ Esperando SW activo (navigator.serviceWorker.ready)...",
    );

    const readyPromise = navigator.serviceWorker.ready.then(
      (reg) => {
        addLog(
          `✅ SW ready: ${reg.active?.scriptURL.split("/").pop() || "unknown"}`,
        );
        return reg;
      },
    );

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 4000);
    });

    const readyResult = await Promise.race([
      readyPromise,
      timeoutPromise,
    ]);
    if (readyResult) return readyResult;

    // Timeout — try manual registration with /push-handler.js
    addLog(
      "⏳ Timeout, intentando registro manual /push-handler.js...",
    );
    try {
      const reg = await navigator.serviceWorker.register(
        "/push-handler.js",
        { scope: "/" },
      );
      addLog(
        `📥 Registro push-handler.js (state: ${reg.installing?.state || reg.waiting?.state || reg.active?.state || "unknown"})`,
      );

      if (reg.active) return reg;

      // Wait briefly for activation
      await new Promise<void>((resolve) => {
        const sw = reg.installing || reg.waiting;
        if (!sw) {
          resolve();
          return;
        }
        const timeout = setTimeout(resolve, 5000);
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated") {
            clearTimeout(timeout);
            resolve();
          }
          if (sw.state === "redundant") {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      if (reg.active) {
        addLog("✅ Service Worker registrado y activo");
        return reg;
      }
    } catch (swErr) {
      addLog(
        `❌ Error registrando /push-handler.js: ${swErr instanceof Error ? swErr.message : String(swErr)}`,
      );
    }

    return null;
  } catch (err) {
    console.error("[Push] Error ensuring SW:", err);
    addLog(
      `❌ Error SW: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

async function waitForSWActive(
  reg: ServiceWorkerRegistration,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const current = reg.active;
    if (current) {
      if (current.state === "activated") {
        resolve();
      } else {
        current.addEventListener("statechange", () => {
          if (current.state === "activated") resolve();
        });
      }
    } else {
      const sw = reg.installing || reg.waiting;
      if (sw) {
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated") resolve();
          if (sw.state === "redundant")
            reject(new Error("SW became redundant"));
        });
      } else {
        reject(new Error("No active service worker found"));
      }
    }
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeout),
    ),
  ]);
}
