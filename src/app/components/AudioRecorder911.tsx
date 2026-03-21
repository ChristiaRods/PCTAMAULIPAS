import { useState, useRef, useCallback, useEffect, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Mic, Square, Trash2, AlertTriangle } from "lucide-react";

const GUINDO = "#AB1738";
const GUINDO_DARK = "#8B1028";

export interface AudioValue {
  id: string;
  blob: Blob;
  mimeType: string;
  transcript: string;
  durationSec: number;
  transcriptionStatus?: "pending" | "processing" | "done" | "error";
  transcriptionError?: string | null;
  transcribedAt?: string | null;
}

interface Props {
  values: AudioValue[];
  onChange: (vals: AudioValue[]) => void;
  maxNotes?: number;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const getSR = (): (new () => SpeechRecognition) | null => {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognition })
      .SpeechRecognition ||
    (
      window as unknown as {
        webkitSpeechRecognition?: new () => SpeechRecognition;
      }
    ).webkitSpeechRecognition ||
    null
  );
};

function makeAudioId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `audio-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function isIOSLikeDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isIPadOSDesktopUA =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIOS || isIPadOSDesktopUA;
}

function selectRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;

  const candidates = isIOSLikeDevice()
    ? ["audio/mp4", "audio/mpeg", "audio/aac", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function composeTranscript(segments: string[]): string {
  const cleaned: string[] = [];
  for (const raw of segments) {
    const current = raw.trim();
    if (!current) continue;
    if (cleaned.length === 0) {
      cleaned.push(current);
      continue;
    }

    const last = cleaned[cleaned.length - 1];
    const currentNorm = normalizeText(current);
    const lastNorm = normalizeText(last);

    if (currentNorm === lastNorm) continue;
    if (currentNorm.startsWith(lastNorm)) {
      cleaned[cleaned.length - 1] = current;
      continue;
    }
    if (lastNorm.startsWith(currentNorm)) continue;

    cleaned.push(current);
  }

  return cleaned.join(" ").replace(/\s+/g, " ").trim();
}

export function AudioRecorder911({
  values,
  onChange,
  maxNotes = 5,
}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordButtonPressed, setIsRecordButtonPressed] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [micPermission, setMicPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [interimText, setInterimText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptRef = useRef<string>("");
  const interimRef = useRef<string>("");
  const shouldRestartRecognitionRef = useRef<boolean>(false);
  const isPressingRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioUrlsRef = useRef<Record<string, string>>({});

  const isMicSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";
  const isSpeechRecognitionSupported = Boolean(getSR());
  const canAddMore = values.length < maxNotes;
  const hasMicPermission = micPermission === "granted";

  const releaseStream = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const requestMicPermission = useCallback(async () => {
    if (!isMicSupported || isRequestingPermission) return false;
    setIsRequestingPermission(true);
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      testStream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
      return true;
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicPermission("denied");
        alert(
          "Necesitamos permiso de microfono para grabar notas de voz. Puedes activarlo en configuracion del navegador.",
        );
      } else {
        alert("No se pudo activar el microfono. Intentalo de nuevo.");
      }
      return false;
    } finally {
      setIsRequestingPermission(false);
    }
  }, [isMicSupported, isRequestingPermission]);

  useEffect(() => {
    if (!isMicSupported) return;
    if (!("permissions" in navigator) || !navigator.permissions?.query) return;
    let disposed = false;
    let permissionStatus: PermissionStatus | null = null;

    const syncPermission = (state: PermissionState) => {
      if (disposed) return;
      if (state === "granted") setMicPermission("granted");
      else if (state === "denied") setMicPermission("denied");
      else setMicPermission((prev) => (prev === "granted" ? "granted" : "unknown"));
    };

    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (disposed) return;
        permissionStatus = status;
        syncPermission(status.state);
        status.onchange = () => syncPermission(status.state);
      })
      .catch(() => {
        // Some browsers do not expose microphone permission state.
      });

    return () => {
      disposed = true;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [isMicSupported]);

  useEffect(() => {
    setAudioUrls((prev) => {
      const activeIds = new Set(values.map((v) => v.id));
      let next = prev;
      let changed = false;

      for (const note of values) {
        if (!next[note.id]) {
          if (!changed) next = { ...prev };
          next[note.id] = URL.createObjectURL(note.blob);
          changed = true;
        }
      }

      for (const id of Object.keys(next)) {
        if (!activeIds.has(id)) {
          if (!changed) next = { ...prev };
          URL.revokeObjectURL(next[id]);
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [values]);

  useEffect(() => {
    audioUrlsRef.current = audioUrls;
  }, [audioUrls]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      releaseStream();
      for (const id of Object.keys(audioUrlsRef.current)) {
        URL.revokeObjectURL(audioUrlsRef.current[id]);
      }
      audioUrlsRef.current = {};
    };
  }, [releaseStream]);

  useEffect(() => {
    if (!isModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isModalOpen]);

  const stopRecording = useCallback(() => {
    shouldRestartRecognitionRef.current = false;
    if (!transcriptRef.current.trim() && interimRef.current.trim()) {
      transcriptRef.current = interimRef.current.trim();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    } else {
      releaseStream();
    }
    setIsRecording(false);
    setInterimText("");
    setLiveTranscript("");
  }, [releaseStream]);

  const startRecording = useCallback(async () => {
    if (!isMicSupported || !canAddMore) return;
    if (!hasMicPermission) {
      const granted = await requestMicPermission();
      if (!granted) return;
    }

    try {
      transcriptRef.current = "";
      interimRef.current = "";
      shouldRestartRecognitionRef.current = true;
      setLiveTranscript("");
      setInterimText("");
      setElapsed(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setMicPermission("granted");

      const selectedMimeType = selectRecorderMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = selectedMimeType
          ? new MediaRecorder(stream, { mimeType: selectedMimeType })
          : new MediaRecorder(stream);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      const mimeType = recorder.mimeType || selectedMimeType || "audio/mp4";
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        shouldRestartRecognitionRef.current = false;
        releaseStream();

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          alert("No se pudo guardar el audio de esta nota. Intenta grabar nuevamente.");
          return;
        }

        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startTimeRef.current) / 1000),
        );
        const transcript = transcriptRef.current.trim() || interimRef.current.trim();

        const newNote: AudioValue = {
          id: makeAudioId(),
          blob,
          mimeType,
          transcript,
          durationSec,
          transcriptionStatus: transcript.trim().length > 0 ? "done" : "pending",
          transcriptionError: null,
          transcribedAt: transcript.trim().length > 0 ? new Date().toISOString() : null,
        };

        onChange([...values, newNote]);
      };

      recorder.start(250);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 500);

      const SRConstructor = getSR();
      if (SRConstructor) {
        const recognition = new SRConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "es-MX";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const finalSegments: string[] = [];
          const previewSegments: string[] = [];
          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            const text = result[0]?.transcript?.trim() || "";
            if (!text) continue;
            previewSegments.push(text);
            if (result.isFinal) {
              finalSegments.push(text);
            }
          }
          const finalText = composeTranscript(finalSegments);
          const previewText = composeTranscript(previewSegments);
          transcriptRef.current = finalText;
          interimRef.current = previewText;
          setLiveTranscript(previewText);
          setInterimText("");
        };

        recognition.onerror = (event: Event) => {
          const maybeError = event as Event & { error?: string; message?: string };
          const errName = String(maybeError.error || "");
          if (errName && errName !== "no-speech" && errName !== "aborted") {
            console.warn("[AudioRecorder911] speech error:", errName);
          }
          if (errName === "not-allowed" || errName === "service-not-allowed") {
            shouldRestartRecognitionRef.current = false;
          }
        };

        recognition.onend = () => {
          if (
            shouldRestartRecognitionRef.current &&
            mediaRecorderRef.current?.state === "recording" &&
            recognitionRef.current
          ) {
            setTimeout(() => {
              if (
                shouldRestartRecognitionRef.current &&
                mediaRecorderRef.current?.state === "recording"
              ) {
                try {
                  recognition.start();
                } catch {
                  // ignore
                }
              }
            }, 120);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      setIsRecording(true);
      if (!isPressingRef.current) stopRecording();
    } catch (err: unknown) {
      isPressingRef.current = false;
      releaseStream();
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicPermission("denied");
        alert("Permiso de microfono denegado. Habilitalo en configuracion.");
      } else {
        alert("No se pudo acceder al microfono. Verifica permisos.");
      }
    }
  }, [
    canAddMore,
    hasMicPermission,
    isMicSupported,
    onChange,
    releaseStream,
    requestMicPermission,
    stopRecording,
    values,
  ]);

  const startPressRecording = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (
        !isMicSupported ||
        !canAddMore ||
        isRecording ||
        isPressingRef.current ||
        isRequestingPermission
      ) {
        setIsRecordButtonPressed(false);
        return;
      }
      if (!hasMicPermission) {
        setIsRecordButtonPressed(false);
        void requestMicPermission();
        return;
      }
      setIsRecordButtonPressed(true);
      isPressingRef.current = true;
      void startRecording();
    },
    [
      canAddMore,
      hasMicPermission,
      isMicSupported,
      isRecording,
      isRequestingPermission,
      requestMicPermission,
      startRecording,
    ],
  );

  const stopPressRecording = useCallback(() => {
    setIsRecordButtonPressed(false);
    const wasPressing = isPressingRef.current;
    isPressingRef.current = false;
    if (isRecording || wasPressing) stopRecording();
  }, [isRecording, stopRecording]);

  useEffect(() => {
    const handleRelease = () => {
      stopPressRecording();
    };

    window.addEventListener("pointerup", handleRelease);
    window.addEventListener("pointercancel", handleRelease);
    window.addEventListener("mouseup", handleRelease);
    window.addEventListener("touchend", handleRelease);
    window.addEventListener("touchcancel", handleRelease);

    return () => {
      window.removeEventListener("pointerup", handleRelease);
      window.removeEventListener("pointercancel", handleRelease);
      window.removeEventListener("mouseup", handleRelease);
      window.removeEventListener("touchend", handleRelease);
      window.removeEventListener("touchcancel", handleRelease);
    };
  }, [stopPressRecording]);

  useEffect(() => {
    if (!isRecording) {
      isPressingRef.current = false;
      setIsRecordButtonPressed(false);
    }
  }, [isRecording]);

  useEffect(() => {
    const forceStop = () => {
      if (!isRecording && !isPressingRef.current) return;
      isPressingRef.current = false;
      stopRecording();
      setIsRecordButtonPressed(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") forceStop();
    };

    window.addEventListener("blur", forceStop);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("blur", forceStop);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isRecording, stopRecording]);

  const openComposer = useCallback(() => {
    setIsModalOpen(true);
    if (isMicSupported && !hasMicPermission && !isRequestingPermission) {
      void requestMicPermission();
    }
  }, [hasMicPermission, isMicSupported, isRequestingPermission, requestMicPermission]);

  const closeComposer = useCallback(() => {
    isPressingRef.current = false;
    if (isRecording) stopRecording();
    setIsRecordButtonPressed(false);
    setIsModalOpen(false);
  }, [isRecording, stopRecording]);

  const deleteNote = useCallback(
    (id: string) => {
      const confirmed = window.confirm(
        "Eliminar esta nota de voz y su transcripcion? Esta accion no se puede deshacer.",
      );
      if (!confirmed) return;
      onChange(values.filter((v) => v.id !== id));
    },
    [onChange, values],
  );

  const displayTranscript = liveTranscript.trim() || interimText.trim();
  const statusCopy = !isMicSupported
    ? "Grabacion no disponible en este navegador"
    : isRequestingPermission
      ? "Confirma el permiso para usar el microfono"
      : !hasMicPermission
        ? "Activa microfono para iniciar"
        : isRecording
          ? `Grabando... ${formatTime(elapsed)}. Suelta para guardar`
          : canAddMore
            ? "Manten presionado para dictar"
            : `Limite alcanzado (${maxNotes})`;

  return (
    <div className="mt-2 space-y-2">
      <button
        onClick={openComposer}
        type="button"
        className="w-full rounded-xl px-4 py-3 text-left"
        style={{
          background: "linear-gradient(135deg, rgba(171,23,56,0.1), rgba(139,16,40,0.08))",
          border: "1px solid rgba(171,23,56,0.18)",
        }}
      >
        <p className="text-[15px] text-[#AB1738]" style={{ fontWeight: 700 }}>
          Dictar evidencias del reporte
        </p>
        <p className="text-[12px] text-[#8E8E93] mt-0.5">
          Abre la modal de voz para grabar, transcribir y revisar notas.
        </p>
      </button>

      <div
        className="rounded-xl border bg-white px-3 py-2.5 space-y-2"
        style={{ borderColor: "#E5E5EA" }}
      >
        <p className="text-[12px] text-[#6E6E73]" style={{ fontWeight: 700 }}>
          Notas de voz cargadas ({values.length})
        </p>
        {values.length === 0 ? (
          <p className="text-[12px] text-[#8E8E93]">Aún no hay notas guardadas.</p>
        ) : (
          values.map((note, idx) => (
            <div
              key={note.id}
              className="rounded-lg border px-2.5 py-2"
              style={{ borderColor: "#ECECEF", background: "#FCFCFD" }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] text-[#1C1C1E]" style={{ fontWeight: 700 }}>
                  {values.length > 1 ? `Descripción del reporte ${idx + 1}` : "Descripción del reporte"}
                </p>
                <button
                  type="button"
                  onClick={() => deleteNote(note.id)}
                  className="text-[12px] text-[#DC2626] px-2 py-1 rounded-md"
                  style={{ background: "rgba(220,38,38,0.08)", fontWeight: 700 }}
                >
                  Eliminar
                </button>
              </div>
              <p className="text-[12px] text-[#8E8E93] mt-1">Duración: {formatTime(note.durationSec)}</p>
              <p className="text-[12px] text-[#3A3A3C] mt-1.5 line-clamp-2">
                {note.transcript?.trim()
                  ? note.transcript.trim()
                  : note.transcriptionStatus === "pending" || note.transcriptionStatus === "processing"
                    ? "Audio guardado. Transcripción en proceso."
                    : "Audio guardado sin transcripción."}
              </p>
            </div>
          ))
        )}
      </div>

      {isModalOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[2147483000]" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/72 backdrop-blur-[4px]" />

            <div className="absolute inset-0 flex flex-col" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
              <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+10px)]">
                <p className="text-white text-[14px]" style={{ fontWeight: 700 }}>
                  Evidencias por voz
                </p>
                <button
                  onClick={closeComposer}
                  type="button"
                  className="px-3 py-1.5 rounded-full text-[13px] text-white"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.28)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  Guardar
                </button>
              </div>

              <div className="px-5 pt-4">
                <div className="min-h-[72px]">
                  <p className="text-white text-[18px] leading-[1.25]" style={{ fontWeight: 700 }}>
                    {displayTranscript ||
                      (isRecording
                        ? "Escuchando tu dictado..."
                        : "Manten presionado el boton central para dictar evidencias")}
                  </p>
                </div>
              </div>

              <div className="px-4 pt-1 pb-2 flex justify-center">
                <div className="w-full max-w-[460px] flex flex-col items-center">
                  <button
                    type="button"
                    onPointerDown={startPressRecording}
                    onPointerUp={stopPressRecording}
                    onPointerCancel={stopPressRecording}
                    onContextMenu={(event) => event.preventDefault()}
                    onDragStart={(event) => event.preventDefault()}
                    disabled={!isMicSupported || !canAddMore || isRequestingPermission}
                    className="rounded-full flex items-center justify-center shadow-2xl"
                    style={{
                      width: 108,
                      height: 108,
                      border: "1px solid rgba(255,255,255,0.45)",
                      background:
                        isRecording || isRecordButtonPressed
                          ? `linear-gradient(150deg, ${GUINDO_DARK}, ${GUINDO})`
                          : `linear-gradient(150deg, ${GUINDO}, ${GUINDO_DARK})`,
                      transform: isRecordButtonPressed ? "scale(0.94) translateY(2px)" : "scale(1)",
                      transition: "transform 120ms ease, filter 180ms ease",
                      filter: isRecording ? "saturate(1.15) brightness(1.05)" : "none",
                      touchAction: "none",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      WebkitTouchCallout: "none",
                    }}
                    aria-label={isRecording ? "Suelta para detener grabacion" : "Manten presionado para grabar"}
                  >
                    {isRecording ? (
                      <Square className="w-8 h-8 text-white" strokeWidth={0} fill="white" />
                    ) : (
                      <Mic className="w-9 h-9 text-white" strokeWidth={2} />
                    )}
                  </button>

                  <p className="mt-2.5 text-center text-white/90 text-[12px]" style={{ fontWeight: 600 }}>
                    {statusCopy}
                  </p>
                </div>
              </div>

              <div className="flex-1 min-h-0 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                <div
                  className="rounded-[28px] border h-full overflow-y-auto"
                  style={{
                    background: "rgba(245,245,247,0.96)",
                    borderColor: "rgba(255,255,255,0.5)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                  }}
                >
                  <div className="px-4 pt-4 pb-3">
                    <p className="text-[13px] text-[#6E6E73]" style={{ fontWeight: 600 }}>
                      Notas guardadas: {values.length}
                    </p>
                  </div>

                  <div className="px-3 pb-3 space-y-2.5">
                    {values.length === 0 ? (
                      <div className="rounded-xl bg-white px-3 py-3 border border-[#E5E5EA]">
                        <p className="text-[13px] text-[#8E8E93]">
                          Aun no hay notas. Mantener presionado el boton central para empezar.
                        </p>
                      </div>
                    ) : (
                      values.map((note, idx) => {
                        const audioUrl = audioUrls[note.id];
                        return (
                          <div
                            key={note.id}
                            className="rounded-xl p-3 bg-white border border-[#E5E5EA]"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center"
                                style={{ background: "rgba(171,23,56,0.1)" }}
                              >
                                <Mic className="w-3.5 h-3.5 text-[#AB1738]" strokeWidth={2} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] text-[#1C1C1E]" style={{ fontWeight: 700 }}>
                                  {values.length > 1
                                    ? `Descripcion del reporte ${idx + 1}`
                                    : "Descripcion del reporte"}
                                </p>
                                <p className="text-[12px] text-[#8E8E93]">Duracion: {formatTime(note.durationSec)}</p>
                              </div>
                              <button
                                onClick={() => deleteNote(note.id)}
                                type="button"
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:opacity-60"
                                style={{ background: "rgba(220,38,38,0.08)", minHeight: 38 }}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" strokeWidth={1.8} />
                                <span className="text-[12px] text-[#DC2626]" style={{ fontWeight: 700 }}>
                                  Eliminar
                                </span>
                              </button>
                            </div>

                            {audioUrl && (
                              <audio controls preload="metadata" src={audioUrl} className="w-full h-9 mb-2" />
                            )}

                            <div className="rounded-lg px-2.5 py-2 border border-[#E5E5EA] bg-[#FCFCFD]">
                              <p
                                className="text-[11px] text-[#8E8E93] mb-1 uppercase tracking-wider"
                                style={{ fontWeight: 700 }}
                              >
                                Transcripcion
                              </p>

                              {note.transcript ? (
                                <p className="text-[13px] text-[#1C1C1E]" style={{ lineHeight: 1.5 }}>
                                  {note.transcript}
                                </p>
                              ) : note.transcriptionStatus === "pending" ||
                                note.transcriptionStatus === "processing" ? (
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-3.5 h-3.5 text-[#A16207] shrink-0 mt-0.5" strokeWidth={2} />
                                  <p className="text-[12px] text-[#8E8E93] italic">
                                    Transcripcion en proceso. El audio ya quedo guardado.
                                  </p>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" strokeWidth={2} />
                                  <p className="text-[12px] text-[#8E8E93] italic">
                                    Sin transcripcion. El audio se enviara igualmente.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
