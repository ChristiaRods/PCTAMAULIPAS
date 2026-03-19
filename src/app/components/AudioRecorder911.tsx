/* ═══════════════════════════════════════════════════════════════
   AudioRecorder911.tsx
   Graba audio con MediaRecorder y transcribe en tiempo real con
   SpeechRecognition. Funciona en iOS Safari (webkit) y Android Chrome.
   ═══════════════════════════════════════════════════════════════ */

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2, Play, Pause } from "lucide-react";

const GUINDO = "#AB1738";
const GUINDO_DARK = "#8B1028";

/* ─── Types ─── */
export interface AudioValue {
  blob: Blob;
  mimeType: string;
  transcript: string;
  durationSec: number;
}

interface Props {
  value: AudioValue | null;
  onChange: (val: AudioValue | null) => void;
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

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function AudioRecorder911({ value, onChange }: Props) {
  /* ─── Internal UI state ─── */
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  /* ─── Refs ─── */
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const transcriptRef = useRef<string>(""); // accumulated final transcript

  /* ─── Create/revoke object URL when blob changes ─── */
  useEffect(() => {
    if (value?.blob) {
      const url = URL.createObjectURL(value.blob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [value?.blob]);

  /* ─── Support check ─── */
  const isMicSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

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
        /* ignore */
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
    try {
      /* Reset accumulated state */
      transcriptRef.current = "";
      setLiveTranscript("");
      setInterimText("");
      setElapsed(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      /* Pick best supported MIME type */
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
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startTimeRef.current) / 1000),
        );
        onChange({
          blob,
          mimeType,
          transcript: transcriptRef.current.trim(),
          durationSec,
        });
      };

      recorder.start(1000); // chunk every 1 s
      startTimeRef.current = Date.now();

      /* Elapsed timer */
      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 500);

      /* SpeechRecognition (optional — may be absent on Firefox/Android) */
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
          /* silence non-critical errors */
        };

        recognition.onend = () => {
          /* iOS Safari cierra recognition cada ~60 s — la reiniciamos */
          if (
            mediaRecorderRef.current?.state === "recording" &&
            recognitionRef.current
          ) {
            try {
              recognition.start();
            } catch {
              /* ignore */
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
  }, [isMicSupported, onChange]);

  /* ─── Delete recording ─── */
  const handleDelete = useCallback(() => {
    if (isRecording) stopRecording();
    transcriptRef.current = "";
    setLiveTranscript("");
    setInterimText("");
    setElapsed(0);
    if (audioElRef.current) audioElRef.current.pause();
    setIsPlaying(false);
    onChange(null);
  }, [isRecording, stopRecording, onChange]);

  /* ─── Playback toggle ─── */
  const togglePlayback = useCallback(() => {
    if (!audioElRef.current || !audioUrl) return;
    if (isPlaying) {
      audioElRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying, audioUrl]);

  const displayTranscript = liveTranscript + interimText;
  const hasLiveTranscript = displayTranscript.trim().length > 0;

  /* ══════════════════════════
     STATE: RECORDING
     ══════════════════════════ */
  if (isRecording) {
    return (
      <div
        className="mt-2 rounded-xl overflow-hidden"
        style={{
          background: "#FFF5F7",
          border: "1.5px solid rgba(171,23,56,0.2)",
        }}
      >
        {/* Header row */}
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
            Grabando… {formatTime(elapsed)}
          </span>
          <button
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg active:opacity-60 transition-opacity"
            style={{ background: GUINDO }}
          >
            <Square
              className="w-3 h-3 text-white"
              strokeWidth={0}
              fill="white"
            />
            <span className="text-[13px] text-white" style={{ fontWeight: 600 }}>
              Detener
            </span>
          </button>
        </div>

        {/* Live transcription */}
        {hasLiveTranscript ? (
          <div className="px-3 pb-2.5">
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
          <div className="px-3 pb-2.5">
            <p className="text-[12px] text-[#8E8E93] italic">
              Hable claramente para ver la transcripción en tiempo real…
            </p>
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════
     STATE: HAS RECORDING
     ══════════════════════════ */
  if (value) {
    return (
      <div
        className="mt-2 rounded-xl overflow-hidden"
        style={{ background: "#F9F9FB", border: "1px solid #E5E5EA" }}
      >
        {/* Player row */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <button
            onClick={togglePlayback}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:opacity-60 transition-opacity"
            style={{
              background: `linear-gradient(135deg, ${GUINDO}, ${GUINDO_DARK})`,
            }}
          >
            {isPlaying ? (
              <Pause
                className="w-4 h-4 text-white"
                strokeWidth={0}
                fill="white"
              />
            ) : (
              <Play
                className="w-4 h-4 text-white ml-0.5"
                strokeWidth={0}
                fill="white"
              />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] text-[#1C1C1E]"
              style={{ fontWeight: 600 }}
            >
              Audio grabado
            </p>
            <p className="text-[11px] text-[#8E8E93]">
              {formatTime(value.durationSec)} · Se enviará con el reporte
            </p>
          </div>

          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-2 py-1 rounded-lg active:opacity-60"
            style={{ background: "rgba(220,38,38,0.08)" }}
          >
            <Trash2
              className="w-3.5 h-3.5 text-[#DC2626]"
              strokeWidth={1.8}
            />
            <span
              className="text-[12px] text-[#DC2626]"
              style={{ fontWeight: 600 }}
            >
              Eliminar
            </span>
          </button>
        </div>

        {/* Hidden audio element for playback */}
        {audioUrl && (
          <audio
            ref={audioElRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}

        {/* Divider */}
        <div className="h-px mx-3" style={{ background: "#E5E5EA" }} />

        {/* Transcription — always visible */}
        <div className="px-3 py-2.5">
          <p
            className="text-[11px] text-[#8E8E93] mb-1.5 uppercase tracking-wider"
            style={{ fontWeight: 700 }}
          >
            Transcripción
          </p>
          {value.transcript ? (
            <p
              className="text-[13px] text-[#1C1C1E]"
              style={{ lineHeight: 1.55 }}
            >
              {value.transcript}
            </p>
          ) : (
            <p className="text-[12px] text-[#8E8E93] italic">
              Sin transcripción — el audio se enviará igualmente
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════
     STATE: IDLE
     ══════════════════════════ */
  return (
    <button
      onClick={isMicSupported ? startRecording : undefined}
      disabled={!isMicSupported}
      className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]"
      style={{
        background: isMicSupported ? "rgba(171,23,56,0.04)" : "#F2F2F7",
        border: `1.5px dashed ${isMicSupported ? "rgba(171,23,56,0.25)" : "#C7C7CC"}`,
        opacity: isMicSupported ? 1 : 0.5,
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: isMicSupported
            ? `linear-gradient(135deg, ${GUINDO}, ${GUINDO_DARK})`
            : "#C7C7CC",
        }}
      >
        <Mic className="w-4 h-4 text-white" strokeWidth={1.8} />
      </div>
      <div className="text-left">
        <p
          className="text-[14px] text-[#AB1738]"
          style={{ fontWeight: 600 }}
        >
          {isMicSupported
            ? "Grabar descripción por voz"
            : "Grabación no disponible"}
        </p>
        <p className="text-[11px] text-[#8E8E93]">
          {isMicSupported
            ? "Toca para iniciar · Transcripción automática"
            : "Usa el campo de texto para describir"}
        </p>
      </div>
    </button>
  );
}
