import { useState, useEffect } from "react";
import {
  X,
  Bell,
  Clock,
  Tag,
  AlertTriangle,
  Loader2,
  AlertCircle,
  ChevronRight,
  Download,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { PCShieldIcon } from "./PCShieldIcon";
import { API_BASE, apiHeaders } from "../lib/apiClient";

interface NotificationData {
  id: string;
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  createdAt: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
}

interface Props {
  notificationId: string;
  onClose: () => void;
}

export function NotificationDetail({
  notificationId,
  onClose,
}: Props) {
  const [notification, setNotification] =
    useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchNotification() {
      try {
        setLoading(true);
        setError(null);
        console.log(
          `[NotifDetail] Fetching notification: ${notificationId}`,
        );

        const res = await fetch(
          `${API_BASE}/push/notification/${notificationId}`,
          { headers: apiHeaders },
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error || `Error ${res.status}`,
          );
        }

        const data = await res.json();
        if (!cancelled) {
          setNotification(data.notification);
          console.log(
            "[NotifDetail] Notification loaded:",
            data.notification.title,
          );
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : String(err);
          setError(msg);
          console.error("[NotifDetail] Error:", msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNotification();
    return () => {
      cancelled = true;
    };
  }, [notificationId]);

  // Format date
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  // Tag display
  const getTagStyle = (tag?: string) => {
    if (!tag)
      return {
        bg: "#F2F2F7",
        color: "#636366",
        label: "General",
      };
    switch (tag) {
      case "test-notification":
        return {
          bg: "rgba(59,130,246,0.1)",
          color: "#3B82F6",
          label: "Prueba",
        };
      case "custom-alert":
        return {
          bg: "rgba(171,23,56,0.1)",
          color: "#AB1738",
          label: "Alerta",
        };
      case "incident-update":
        return {
          bg: "rgba(245,158,11,0.1)",
          color: "#D97706",
          label: "Actualización",
        };
      case "system-notice":
        return {
          bg: "rgba(107,114,128,0.12)",
          color: "#4B5563",
          label: "Comunicado",
        };
      case "pc-tamaulipas":
        return {
          bg: "rgba(188,149,91,0.1)",
          color: "#BC955B",
          label: "General",
        };
      default:
        if (tag.startsWith("report-")) {
          return {
            bg: "rgba(220,38,38,0.1)",
            color: "#DC2626",
            label: "Reporte 911",
          };
        }
        return { bg: "#F2F2F7", color: "#636366", label: tag };
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      style={{
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      {/* Panel — slides up from bottom */}
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{
          background: "#FFFFFF",
          maxHeight: "85dvh",
          animation:
            "slideUpPanel 0.35s cubic-bezier(0.2, 0.9, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-[#D1D1D6]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <h2
            className="text-[18px] text-[#1C1C1E]"
            style={{ fontWeight: 700 }}
          >
            Detalle de Notificación
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center active:bg-[#E5E5EA] transition-colors"
            style={{ background: "#F2F2F7" }}
          >
            <X size={18} color="#636366" />
          </button>
        </div>

        <div className="h-px bg-[#E5E5EA]" />

        {/* Content */}
        <div
          className="px-5 py-5 overflow-y-auto"
          style={{ maxHeight: "calc(85dvh - 100px)" }}
        >
          {loading && (
            <div className="flex flex-col items-center py-12">
              <Loader2
                size={32}
                className="animate-spin mb-3"
                style={{ color: "#AB1738" }}
              />
              <p className="text-[15px] text-[#636366]">
                Cargando notificación...
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center py-12">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(220,38,38,0.1)" }}
              >
                <AlertCircle
                  size={28}
                  style={{ color: "#DC2626" }}
                />
              </div>
              <p
                className="text-[16px] text-[#1C1C1E] mb-1"
                style={{ fontWeight: 600 }}
              >
                No se pudo cargar
              </p>
              <p className="text-[14px] text-[#636366] text-center mb-4">
                {error}
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-[15px] active:opacity-80 transition-opacity"
                style={{
                  background: "rgba(171,23,56,0.08)",
                  color: "#AB1738",
                  fontWeight: 600,
                }}
              >
                Cerrar
              </button>
            </div>
          )}

          {notification && !loading && (
            <div>
              {/* Icon + Title */}
              <div className="flex items-start gap-4 mb-5">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{
                    boxShadow:
                      "0 4px 16px rgba(171,23,56,0.25)",
                  }}
                >
                  <PCShieldIcon size={56} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-[20px] text-[#1C1C1E] mb-1"
                    style={{ fontWeight: 700, lineHeight: 1.3 }}
                  >
                    {notification.title}
                  </h3>
                  {/* Tag badge */}
                  {(() => {
                    const tagStyle = getTagStyle(
                      notification.tag,
                    );
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                        style={{
                          background: tagStyle.bg,
                          color: tagStyle.color,
                          fontWeight: 600,
                        }}
                      >
                        <Tag size={10} strokeWidth={2.5} />
                        {tagStyle.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Body — full expanded text */}
              <div
                className="rounded-2xl p-4 mb-5"
                style={{
                  background: "#F9F9FB",
                  border: "1px solid #E5E5EA",
                }}
              >
                <p
                  className="text-[16px] text-[#1C1C1E]"
                  style={{
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {notification.body}
                </p>
              </div>

              {/* ═══ Attachment preview ═══ */}
              {notification.attachmentUrl && (
                <div
                  className="rounded-2xl overflow-hidden mb-5"
                  style={{ border: "1px solid #E5E5EA" }}
                >
                  {/* Image preview if image type */}
                  {notification.attachmentType?.startsWith(
                    "image/",
                  ) && (
                    <img
                      src={notification.attachmentUrl}
                      alt={
                        notification.attachmentName || "Adjunto"
                      }
                      className="w-full max-h-64 object-contain"
                      style={{ background: "#F2F2F7" }}
                    />
                  )}

                  {/* File info + download */}
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ background: "#F9F9FB" }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background:
                          notification.attachmentType?.startsWith(
                            "image/",
                          )
                            ? "rgba(59,130,246,0.1)"
                            : "rgba(188,149,91,0.1)",
                      }}
                    >
                      {notification.attachmentType?.startsWith(
                        "image/",
                      ) ? (
                        <ImageIcon
                          size={20}
                          style={{ color: "#3B82F6" }}
                        />
                      ) : (
                        <FileText
                          size={20}
                          style={{ color: "#BC955B" }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[14px] text-[#1C1C1E] truncate"
                        style={{ fontWeight: 500 }}
                      >
                        {notification.attachmentName ||
                          "Archivo adjunto"}
                      </p>
                      <p className="text-[12px] text-[#8E8E93]">
                        Toca para descargar
                      </p>
                    </div>
                    <a
                      href={notification.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={notification.attachmentName}
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:opacity-60 transition-opacity"
                      style={{
                        background:
                          "linear-gradient(135deg, #3B82F6, #2563EB)",
                        boxShadow:
                          "0 2px 8px rgba(59,130,246,0.3)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download size={18} color="#FFFFFF" />
                    </a>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="flex flex-col gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: "rgba(188,149,91,0.1)",
                    }}
                  >
                    <Clock
                      size={18}
                      style={{ color: "#BC955B" }}
                      strokeWidth={2}
                    />
                  </div>
                  <div>
                    <p
                      className="text-[12px] text-[#8E8E93]"
                      style={{ fontWeight: 500 }}
                    >
                      Fecha y hora
                    </p>
                    <p
                      className="text-[14px] text-[#1C1C1E]"
                      style={{ fontWeight: 500 }}
                    >
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: "rgba(245,158,11,0.1)",
                    }}
                  >
                    <AlertTriangle
                      size={18}
                      style={{ color: "#F59E0B" }}
                      strokeWidth={2}
                    />
                  </div>
                  <div>
                    <p
                      className="text-[12px] text-[#8E8E93]"
                      style={{ fontWeight: 500 }}
                    >
                      ID de notificación
                    </p>
                    <p
                      className="text-[13px] text-[#636366] font-mono"
                      style={{ wordBreak: "break-all" }}
                    >
                      {notification.id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl active:opacity-80 transition-opacity"
                style={{
                  background:
                    "linear-gradient(135deg, #AB1738, #8B1028)",
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "#FFFFFF",
                  boxShadow: "0 4px 16px rgba(171,23,56,0.25)",
                }}
              >
                Cerrar
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes slideUpPanel {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
