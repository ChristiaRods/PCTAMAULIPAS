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
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

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
  const isPressWaveActive = isRecordButtonPressed || (isRecording && isPressingRef.current);
  const notesCounter = `${values.length}/${maxNotes}`;

  useEffect(() => {
    if (!isModalOpen) return;
    const transcriptBox = transcriptScrollRef.current;
    if (!transcriptBox) return;
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
  }, [displayTranscript, isModalOpen]);

  const liquidShell = {
    background: "linear-gradient(150deg, rgba(255,255,255,0.34), rgba(255,255,255,0.14))",
    border: "1px solid rgba(255,255,255,0.42)",
    boxShadow: "0 24px 60px rgba(15,23,42,0.28), inset 0 1px 0 rgba(255,255,255,0.5)",
    backdropFilter: "blur(22px) saturate(1.5)",
    WebkitBackdropFilter: "blur(22px) saturate(1.5)",
  } as const;

  const liquidInner = {
    background: "linear-gradient(160deg, rgba(255,255,255,0.68), rgba(244,244,248,0.54))",
    border: "1px solid rgba(255,255,255,0.72)",
    boxShadow: "0 18px 45px rgba(15,23,42,0.2), inset 0 1px 0 rgba(255,255,255,0.8)",
    backdropFilter: "blur(18px) saturate(1.35)",
    WebkitBackdropFilter: "blur(18px) saturate(1.35)",
  } as const;

  return (
    <div className="mt-2 space-y-2">
      <button
        onClick={openComposer}
        type="button"
        className="relative w-full rounded-2xl px-4 py-3 text-left overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.86), rgba(244,244,248,0.72))",
          border: "1px solid rgba(255,255,255,0.76)",
          boxShadow: "0 14px 32px rgba(15,23,42,0.1), inset 0 1px 0 rgba(255,255,255,0.92)",
          backdropFilter: "blur(14px) saturate(1.28)",
          WebkitBackdropFilter: "blur(14px) saturate(1.28)",
        }}
      >
        <div
          className="pointer-events-none absolute left-3 right-3 top-0 h-7 rounded-b-2xl"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.84), rgba(255,255,255,0))",
          }}
        />
        <p className="text-[15px] text-[#AB1738]" style={{ fontWeight: 700 }}>
          Dictar evidencias del reporte
        </p>
        <p className="text-[12px] text-[#636366] mt-0.5">
          Abre la modal de voz para grabar, transcribir y revisar notas.
        </p>
      </button>

      <div
        className="relative rounded-2xl px-3 py-2.5 space-y-2 overflow-hidden"
        style={liquidInner}
      >
        <div
          className="pointer-events-none absolute left-3 right-3 top-0 h-7 rounded-b-2xl"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.84), rgba(255,255,255,0))",
          }}
        />
        <p className="text-[12px] text-[#3A3A3C]" style={{ fontWeight: 700 }}>
          Notas de voz cargadas ({values.length})
        </p>
        {values.length === 0 ? (
          <p className="text-[12px] text-[#8E8E93]">Aún no hay notas guardadas.</p>
        ) : (
          values.map((note, idx) => {
            const audioUrl = audioUrls[note.id];
            return (
              <div
                key={note.id}
                className="rounded-lg border px-2.5 py-2"
                style={{
                  borderColor: "rgba(255,255,255,0.85)",
                  background: "linear-gradient(150deg, rgba(255,255,255,0.9), rgba(248,248,250,0.78))",
                }}
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

                {audioUrl && (
                  <audio
                    controls
                    preload="metadata"
                    src={audioUrl}
                    className="w-full h-9 mt-2"
                  />
                )}

                <p className="text-[12px] text-[#3A3A3C] mt-1.5 whitespace-pre-wrap break-words">
                  {note.transcript?.trim()
                    ? note.transcript.trim()
                    : note.transcriptionStatus === "pending" || note.transcriptionStatus === "processing"
                      ? "Audio guardado. Transcripción en proceso."
                      : "Audio guardado sin transcripción."}
                </p>
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[2147483000] overflow-hidden" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 100% at 20% 10%, rgba(171,23,56,0.38), rgba(14,16,25,0.94) 58%), radial-gradient(90% 70% at 85% 18%, rgba(188,149,91,0.18), rgba(7,10,18,0) 62%)",
              }}
            />
            <div
              className="pointer-events-none absolute -left-20 top-[16%] w-72 h-72 rounded-full blur-3xl"
              style={{ background: "rgba(171,23,56,0.22)" }}
            />
            <div
              className="pointer-events-none absolute -right-14 top-[6%] w-64 h-64 rounded-full blur-3xl"
              style={{ background: "rgba(255,255,255,0.16)" }}
            />
            <div className="absolute inset-0 bg-black/42 backdrop-blur-[6px]" />

            <div className="absolute inset-0 flex flex-col" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
              <style>{`
                @keyframes voice-wave {
                  0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.8; }
                  70% { opacity: 0.25; }
                  100% { transform: translate(-50%, -50%) scale(1.32); opacity: 0; }
                }
              `}</style>

              <div className="px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-1 flex justify-center">
                <div className="w-full max-w-[560px] flex justify-end">
                  <button
                    onClick={closeComposer}
                    type="button"
                    className="px-3 py-1.5 rounded-full text-[13px] text-white"
                    style={{
                      background: "rgba(255,255,255,0.16)",
                      border: "1px solid rgba(255,255,255,0.36)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      fontWeight: 700,
                    }}
                  >
                    Guardar
                  </button>
                </div>
              </div>

              <div className="px-4 pt-1">
                <div
                  className="relative mx-auto w-full max-w-[560px] h-[112px] rounded-[24px] px-4 py-3 overflow-hidden"
                  style={liquidInner}
                >
                  <div
                    className="pointer-events-none absolute left-3 right-3 top-0 h-7 rounded-b-[16px]"
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0))",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute left-0 right-0 top-0 h-9 z-[2]"
                    style={{
                      background: "linear-gradient(180deg, rgba(246,246,249,0.98), rgba(246,246,249,0))",
                    }}
                  />
                  <div
                    ref={transcriptScrollRef}
                    className="relative z-[1] h-full overflow-y-auto pr-1"
                    style={{
                      maskImage: "linear-gradient(to bottom, transparent 0%, black 24%, black 100%)",
                      WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 24%, black 100%)",
                      scrollbarWidth: "none",
                    }}
                  >
                    <p className="text-[#1C1C1E] text-[18px] leading-[1.25] whitespace-pre-wrap break-words" style={{ fontWeight: 700 }}>
                      {displayTranscript ||
                        (isRecording
                          ? "Escuchando tu dictado..."
                          : "Manten presionado el boton central para dictar evidencias")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-4 pt-3 pb-2 flex justify-center">
                <div
                  className="relative w-full max-w-[560px] rounded-[30px] p-4 flex flex-col items-center overflow-hidden"
                  style={liquidShell}
                >
                  <div
                    className="pointer-events-none absolute left-4 right-4 top-0 h-8 rounded-b-[18px]"
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0))",
                    }}
                  />
                  <div className="relative z-[1] w-[210px] h-[150px] overflow-hidden flex items-center justify-center">
                    {isPressWaveActive && (
                      <>
                        <span
                          className="absolute left-1/2 top-1/2 rounded-full border-2 border-white/80"
                          style={{ width: 84, height: 84, animation: "voice-wave 1.35s linear infinite" }}
                        />
                        <span
                          className="absolute left-1/2 top-1/2 rounded-full border-2 border-white/65"
                          style={{ width: 84, height: 84, animation: "voice-wave 1.35s linear infinite", animationDelay: "220ms" }}
                        />
                        <span
                          className="absolute left-1/2 top-1/2 rounded-full border-2 border-white/50"
                          style={{ width: 84, height: 84, animation: "voice-wave 1.35s linear infinite", animationDelay: "440ms" }}
                        />
                      </>
                    )}
                    <button
                      type="button"
                      onPointerDown={startPressRecording}
                      onPointerUp={stopPressRecording}
                      onPointerCancel={stopPressRecording}
                      onContextMenu={(event) => event.preventDefault()}
                      onDragStart={(event) => event.preventDefault()}
                      disabled={!isMicSupported || !canAddMore || isRequestingPermission}
                      className="relative z-[2] rounded-full flex items-center justify-center shadow-2xl"
                      style={{
                        width: 112,
                        height: 112,
                        border: "1px solid rgba(255,255,255,0.5)",
                        background: isPressWaveActive
                          ? "linear-gradient(155deg, #FFFFFF, #ECECF0)"
                          : `linear-gradient(155deg, ${GUINDO}, ${GUINDO_DARK})`,
                        transform: isRecordButtonPressed ? "scale(0.93) translateY(2px)" : "scale(1)",
                        transition: "transform 120ms ease, filter 180ms ease, box-shadow 180ms ease, background 180ms ease",
                        filter: isRecording ? "saturate(1.15) brightness(1.07)" : "none",
                        boxShadow: isPressWaveActive
                          ? "0 16px 34px rgba(255,255,255,0.32), inset 0 1px 0 rgba(255,255,255,0.85)"
                          : isRecording
                            ? "0 18px 38px rgba(171,23,56,0.45), inset 0 1px 0 rgba(255,255,255,0.35)"
                            : "0 14px 30px rgba(17,24,39,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
                        touchAction: "none",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        WebkitTouchCallout: "none",
                      }}
                      aria-label={isRecording ? "Suelta para detener grabacion" : "Manten presionado para grabar"}
                    >
                      {isRecording ? (
                        <Square
                          className="w-8 h-8"
                          strokeWidth={0}
                          fill={isPressWaveActive ? GUINDO : "white"}
                          style={{ color: isPressWaveActive ? GUINDO : "white" }}
                        />
                      ) : (
                        <Mic
                          className="w-9 h-9"
                          strokeWidth={2}
                          style={{ color: isPressWaveActive ? GUINDO : "white" }}
                        />
                      )}
                    </button>
                  </div>

                  <p className="relative z-[1] mt-1 text-center text-white/92 text-[12px]" style={{ fontWeight: 600 }}>
                    {statusCopy}
                  </p>
                </div>
              </div>

              <div className="flex-1 min-h-0 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                <div
                  className="relative mx-auto w-full max-w-[560px] rounded-[30px] h-full overflow-hidden flex flex-col"
                  style={liquidShell}
                >
                  <div
                    className="pointer-events-none absolute left-4 right-4 top-0 h-9 rounded-b-[20px]"
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0))",
                    }}
                  />
                  <div className="relative z-[1] px-4 pt-4 pb-3 border-b border-white/35 flex items-center justify-between gap-2">
                    <p className="text-[13px] text-white/88" style={{ fontWeight: 700 }}>
                      Notas guardadas
                    </p>
                    <span className="text-[11px] text-white/85" style={{ fontWeight: 700 }}>
                      {notesCounter}
                    </span>
                  </div>

                  <div className="relative z-[1] px-3 pb-3 pt-3 space-y-2.5 flex-1 min-h-0 overflow-y-auto">
                    {values.length === 0 ? (
                      <div
                        className="rounded-xl px-3 py-3 border"
                        style={{
                          background: "linear-gradient(150deg, rgba(255,255,255,0.8), rgba(246,246,249,0.66))",
                          borderColor: "rgba(255,255,255,0.7)",
                        }}
                      >
                        <p className="text-[13px] text-[#636366]">
                          Aun no hay notas. Mantener presionado el boton central para empezar.
                        </p>
                      </div>
                    ) : (
                      values.map((note, idx) => {
                        const audioUrl = audioUrls[note.id];
                        return (
                          <div
                            key={note.id}
                            className="rounded-xl p-3 border"
                            style={{
                              background: "linear-gradient(150deg, rgba(255,255,255,0.88), rgba(247,247,250,0.72))",
                              borderColor: "rgba(255,255,255,0.78)",
                              boxShadow: "0 10px 22px rgba(15,23,42,0.12)",
                            }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center"
                                style={{ background: "rgba(171,23,56,0.12)" }}
                              >
                                <Mic className="w-3.5 h-3.5 text-[#AB1738]" strokeWidth={2} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] text-[#1C1C1E]" style={{ fontWeight: 700 }}>
                                  {values.length > 1
                                    ? `Descripcion del reporte ${idx + 1}`
                                    : "Descripcion del reporte"}
                                </p>
                                <p className="text-[12px] text-[#6E6E73]">Duracion: {formatTime(note.durationSec)}</p>
                              </div>
                              <button
                                onClick={() => deleteNote(note.id)}
                                type="button"
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:opacity-60"
                                style={{ background: "rgba(220,38,38,0.09)", minHeight: 38 }}
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

                            <div
                              className="rounded-lg px-2.5 py-2 border"
                              style={{
                                borderColor: "rgba(209,209,214,0.84)",
                                background: "linear-gradient(150deg, rgba(252,252,253,0.95), rgba(248,248,251,0.8))",
                              }}
                            >
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
                                  <p className="text-[12px] text-[#6E6E73] italic">
                                    Transcripcion en proceso. El audio ya quedo guardado.
                                  </p>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" strokeWidth={2} />
                                  <p className="text-[12px] text-[#6E6E73] italic">
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
