import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2, Plus, AlertTriangle } from "lucide-react";

const GUINDO = "#AB1738";
const GUINDO_DARK = "#8B1028";

/* ─── Types ─── */
export interface AudioValue {
  id: string;
  blob: Blob;
  mimeType: string;
  transcript: string;
  durationSec: number;
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

/* ─── SpeechRecognition shim para TypeScript ─── */
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

/* ═════════════════════════════════════════════════════════════════
   COMPONENT
   ═════════════════════════════════════════════════════════════════ */
export function AudioRecorder911({
  values,
  onChange,
  maxNotes = 5,
}: Props) {
  /* ─── Internal UI state ─── */
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);

  /* ─── Refs ─── */
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptRef = useRef<string>(""); // accumulated final transcript
  const streamRef = useRef<MediaStream | null>(null);
  const audioUrlMapRef = useRef<Record<string, string>>({});

  const isMicSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";
  const isSpeechRecognitionSupported = Boolean(getSR());

  const canAddMore = values.length < maxNotes;

  /* ─── Object URLs cleanup ─── */
  useEffect(() => {
    const activeIds = new Set(values.map((v) => v.id));

    for (const note of values) {
      if (!audioUrlMapRef.current[note.id]) {
        audioUrlMapRef.current[note.id] = URL.createObjectURL(note.blob);
      }
    }

    for (const id of Object.keys(audioUrlMapRef.current)) {
      if (!activeIds.has(id)) {
        URL.revokeObjectURL(audioUrlMapRef.current[id]);
        delete audioUrlMapRef.current[id];
      }
    }
  }, [values]);

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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      for (const id of Object.keys(audioUrlMapRef.current)) {
        URL.revokeObjectURL(audioUrlMapRef.current[id]);
      }
      audioUrlMapRef.current = {};
    };
  }, []);

  /* ─── Stop recording ─── */
  const stopRecording = useCallback(() => {
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
    }
    setIsRecording(false);
    setInterimText("");
  }, []);

  /* ─── Start recording ─── */
  const startRecording = useCallback(async () => {
    if (!isMicSupported) {
      alert("Tu navegador no soporta grabación de audio.");
      return;
    }
    if (!canAddMore) return;

    try {
      transcriptRef.current = "";
      setLiveTranscript("");
      setInterimText("");
      setElapsed(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startTimeRef.current) / 1000),
        );
        const newNote: AudioValue = {
          id: makeAudioId(),
          blob,
          mimeType,
          transcript: transcriptRef.current.trim(),
          durationSec,
        };
        onChange([...values, newNote]);
      };

      recorder.start(1000);
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
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              transcriptRef.current += result[0].transcript + " ";
            } else {
              interim += result[0].transcript;
            }
          }
          setLiveTranscript(transcriptRef.current);
          setInterimText(interim);
        };

        recognition.onerror = () => {
          // silence non-critical errors
        };

        recognition.onend = () => {
          if (
            mediaRecorderRef.current?.state === "recording" &&
            recognitionRef.current
          ) {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      setIsRecording(true);
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        alert(
          "Permiso de micrófono denegado. Ve a Configuración > Safari/Chrome para habilitarlo.",
        );
      } else {
        alert("No se pudo acceder al micrófono. Verifica los permisos.");
      }
    }
  }, [canAddMore, isMicSupported, onChange, values]);

  const deleteNote = useCallback(
    (id: string) => {
      const confirmed = window.confirm(
        "¿Eliminar esta nota de voz y su transcripción? Esta acción no se puede deshacer.",
      );
      if (!confirmed) return;
      onChange(values.filter((v) => v.id !== id));
    },
    [onChange, values],
  );

  const displayTranscript = liveTranscript + interimText;
  const hasLiveTranscript = displayTranscript.trim().length > 0;

  return (
    <div className="mt-2 space-y-2.5">
      {/* Record card */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: isRecording ? "#FFF5F7" : "#F9F9FB",
          border: isRecording
            ? "1.5px solid rgba(171,23,56,0.2)"
            : "1px solid #E5E5EA",
        }}
      >
        {isRecording ? (
          <>
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: GUINDO,
                  display: "inline-block",
                  animation: "pulse 1s ease-in-out infinite",
                }}
              />
              <span
                className="text-[13px] text-[#AB1738] flex-1 tabular-nums"
                style={{ fontWeight: 600 }}
              >
                Grabando... {formatTime(elapsed)}
              </span>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-3 py-2 rounded-lg active:opacity-60 transition-opacity"
                style={{
                  background: GUINDO,
                  minHeight: 44,
                }}
                aria-label="Detener grabación"
              >
                <Square
                  className="w-3.5 h-3.5 text-white"
                  strokeWidth={0}
                  fill="white"
                />
                <span
                  className="text-[14px] text-white"
                  style={{ fontWeight: 700 }}
                >
                  Detener
                </span>
              </button>
            </div>

            {hasLiveTranscript ? (
              <div className="px-3 pb-3">
                <div
                  className="rounded-lg px-2.5 py-2"
                  style={{
                    background: "rgba(171,23,56,0.04)",
                    border: "1px solid rgba(171,23,56,0.1)",
                  }}
                >
                  <p
                    className="text-[13px] text-[#1C1C1E]"
                    style={{ lineHeight: 1.55 }}
                  >
                    <span>{liveTranscript}</span>
                    {interimText && (
                      <span className="text-[#8E8E93]">{interimText}</span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-3 pb-3">
                <p className="text-[12px] text-[#8E8E93] italic">
                  {isSpeechRecognitionSupported
                    ? "Hable claramente para ver la transcripcion en tiempo real..."
                    : "Tu dispositivo grabara el audio, pero no soporta transcripcion automatica en tiempo real."}
                </p>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={isMicSupported && canAddMore ? startRecording : undefined}
            disabled={!isMicSupported || !canAddMore}
            className="w-full flex items-center gap-3 px-3 py-3 transition-all active:scale-[0.99]"
            style={{
              opacity: !isMicSupported || !canAddMore ? 0.55 : 1,
            }}
            aria-label="Agregar nota de voz"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{
                background:
                  isMicSupported && canAddMore
                    ? `linear-gradient(135deg, ${GUINDO}, ${GUINDO_DARK})`
                    : "#C7C7CC",
              }}
            >
              <Mic className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p
                className="text-[15px] text-[#AB1738]"
                style={{ fontWeight: 700 }}
              >
                {canAddMore
                  ? "Agregar nota de voz"
                  : `Límite alcanzado (${maxNotes})`}
              </p>
              <p className="text-[12px] text-[#8E8E93]">
                {!isMicSupported
                  ? "Grabacion no disponible en este navegador"
                  : isSpeechRecognitionSupported
                    ? "Asegurate de acercarte lo suficiente al microfono para tener una buena transcripcion."
                    : "Este dispositivo grabara la nota de voz, pero la transcripcion automatica puede no estar disponible."}
              </p>
            </div>
            <Plus className="w-4 h-4 text-[#AB1738]" strokeWidth={2.2} />
          </button>
        )}
      </div>

      {values.length > 0 && (
        <div className="space-y-2">
          {values.map((note, idx) => {
            const audioUrl = audioUrlMapRef.current[note.id];
            return (
              <div
                key={note.id}
                className="rounded-xl p-3"
                style={{
                  background: "#F9F9FB",
                  border: "1px solid #E5E5EA",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(171,23,56,0.1)" }}
                  >
                    <Mic className="w-3.5 h-3.5 text-[#AB1738]" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[14px] text-[#1C1C1E]"
                      style={{ fontWeight: 700 }}
                    >
                      {values.length > 1
                        ? `Descripción del reporte ${idx + 1}`
                        : "Descripción del reporte"}
                    </p>
                    <p className="text-[12px] text-[#8E8E93]">
                      Duración: {formatTime(note.durationSec)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:opacity-60"
                    style={{
                      background: "rgba(220,38,38,0.08)",
                      minHeight: 40,
                    }}
                    aria-label={`Eliminar nota de voz ${idx + 1}`}
                  >
                    <Trash2
                      className="w-3.5 h-3.5 text-[#DC2626]"
                      strokeWidth={1.8}
                    />
                    <span
                      className="text-[12px] text-[#DC2626]"
                      style={{ fontWeight: 700 }}
                    >
                      Eliminar
                    </span>
                  </button>
                </div>

                {audioUrl && (
                  <audio
                    controls
                    preload="metadata"
                    src={audioUrl}
                    className="w-full h-10 mb-2"
                  />
                )}

                <div
                  className="rounded-lg px-2.5 py-2"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E5EA",
                  }}
                >
                  <p
                    className="text-[11px] text-[#8E8E93] mb-1 uppercase tracking-wider"
                    style={{ fontWeight: 700 }}
                  >
                    Transcripción
                  </p>
                  {note.transcript ? (
                    <p
                      className="text-[13px] text-[#1C1C1E]"
                      style={{ lineHeight: 1.55 }}
                    >
                      {note.transcript}
                    </p>
                  ) : (
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5"
                        strokeWidth={2}
                      />
                      <p className="text-[12px] text-[#8E8E93] italic">
                        Sin transcripción. El audio se enviará igualmente.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
