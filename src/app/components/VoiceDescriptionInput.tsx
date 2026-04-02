/* ═══════════════════════════════════════════════════════════════
   VoiceDescriptionInput.tsx
   Sección de descripción dual: teclado + notas de voz (1-5)
   Transcripción automática via Web Speech API (es-MX)
   UX optimizado para uso en campo severo
   ═══════════════════════════════════════════════════════════════ */

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2, Play, Pause, Volume2 } from "lucide-react";

/* ── Tipos exportados ─────────────────────────────────────────── */
export interface VoiceNote {
  id: string;
  audioUrl: string;      // base64 data URL
  transcription: string; // texto transcrito por SpeechRecognition
  durationSec: number;
}

interface Props {
  writtenText: string;
  onWrittenTextChange: (text: string) => void;
  voiceNotes: VoiceNote[];
  onVoiceNotesChange: (notes: VoiceNote[]) => void;
}

const MAX_NOTES = 5;
const SHORT_THRESHOLD = 60; // caracteres mínimos antes de concatenar

/* ─── Helper: formato mm:ss ─────────────────────────────────── */
function fmtSec(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════════════
   VoiceNoteCard — tarjeta de nota grabada
   ═══════════════════════════════════════════════════════════════ */
function VoiceNoteCard({
  note,
  index,
  onDelete,
}: {
  note: VoiceNote;
  index: number;
  onDelete: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    playing ? audioRef.current.pause() : audioRef.current.play();
  };

  return (
    <div
      className="rounded-2xl p-4 mb-3"
      style={{
        background: "#FAFAFA",
        border: "1.5px solid #E5E5EA",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Fila superior: play + info + borrar ── */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={toggle}
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          style={{ background: "linear-gradient(135deg, #AB1738, #7C1028)", boxShadow: "0 3px 12px rgba(171,23,56,0.30)" }}
        >
          {playing ? (
            <Pause className="w-5 h-5 text-white" strokeWidth={2.5} />
          ) : (
            <Play className="w-5 h-5 text-white" style={{ marginLeft: 2 }} strokeWidth={2.5} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 16, fontWeight: 700, color: "#1C1C1E" }}>
            Nota {index + 1}
          </p>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#8E8E93" }}>
            {fmtSec(note.durationSec)} · {note.transcription ? "Transcripción lista" : "Sin transcripción"}
          </p>
        </div>

        <button
          onClick={onDelete}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: "#F2F2F7", border: "1px solid #E5E5EA" }}
        >
          <Trash2 className="w-4.5 h-4.5 text-[#636366]" strokeWidth={2} />
        </button>
      </div>

      {/* ── Audio player nativo (fallback visible) ── */}
      <audio
        ref={audioRef}
        src={note.audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        controls
        className="w-full"
        style={{ height: 40, borderRadius: 12 }}
      />

      {/* ── Transcripción ── */}
      {note.transcription ? (
        <div
          className="mt-3 rounded-xl px-3 py-3"
          style={{ background: "rgba(171,23,56,0.04)", border: "1px solid rgba(171,23,56,0.12)" }}
        >
          <p style={{ fontSize: 14, color: "#3A3A3C", lineHeight: 1.6, fontStyle: "italic" }}>
            "{note.transcription}"
          </p>
        </div>
      ) : (
        <div
          className="mt-3 rounded-xl px-3 py-2.5"
          style={{ background: "#F2F2F7", border: "1px dashed #D1D1D6" }}
        >
          <p style={{ fontSize: 13, color: "#AEAEB2" }}>
            No se detectó transcripción — el audio se guarda igual.
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
export function VoiceDescriptionInput({
  writtenText,
  onWrittenTextChange,
  voiceNotes,
  onVoiceNotesChange,
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [micError, setMicError] = useState("");

  /* ── Refs para evitar stale closures en callbacks async ── */
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechRef = useRef<SpeechRecognition | null>(null);
  const fullTranscriptRef = useRef("");
  const recordingSecRef = useRef(0);
  const voiceNotesRef = useRef(voiceNotes); // siempre apunta al array actual

  useEffect(() => {
    voiceNotesRef.current = voiceNotes;
  }, [voiceNotes]);

  /* ── Detener grabación ── */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (speechRef.current) {
      try { speechRef.current.stop(); } catch { /* ignore */ }
      speechRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /* ── Iniciar grabación ── */
  const startRecording = useCallback(async () => {
    setMicError("");
    setLiveTranscript("");
    fullTranscriptRef.current = "";
    recordingSecRef.current = 0;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError("No se pudo acceder al micrófono. Verifica los permisos.");
      return;
    }

    /* ── MediaRecorder ── */
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/ogg";

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunksRef.current = [];
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;
        const note: VoiceNote = {
          id: `voice-${Date.now()}`,
          audioUrl: dataUrl,
          transcription: fullTranscriptRef.current.trim(),
          durationSec: recordingSecRef.current,
        };
        onVoiceNotesChange([...voiceNotesRef.current, note]);
      };
      reader.readAsDataURL(blob);
      setIsRecording(false);
      setRecordingSec(0);
      setLiveTranscript("");
    };

    mediaRecorder.start(200);
    setIsRecording(true);

    /* ── Timer ── */
    timerRef.current = setInterval(() => {
      recordingSecRef.current++;
      setRecordingSec(recordingSecRef.current);
    }, 1000);

    /* ── SpeechRecognition ── */
    const SpeechAPI =
      (window as unknown as Record<string, unknown>).SpeechRecognition as
        | (new () => SpeechRecognition)
        | undefined ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition as
        | (new () => SpeechRecognition)
        | undefined;

    if (SpeechAPI) {
      const sr = new SpeechAPI();
      sr.continuous = true;
      sr.interimResults = true;
      sr.lang = "es-MX";

      sr.onresult = (event: SpeechRecognitionEvent) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript + " ";
          } else {
            interimChunk += event.results[i][0].transcript;
          }
        }
        if (finalChunk) fullTranscriptRef.current += finalChunk;
        setLiveTranscript(fullTranscriptRef.current + interimChunk);
      };

      sr.onerror = () => { /* ignorar errores de red o sin audio */ };

      try { sr.start(); speechRef.current = sr; } catch { /* ignore */ }
    }
  }, [onVoiceNotesChange]);

  /* ── Borrar nota ── */
  const deleteNote = useCallback(
    (id: string) => {
      onVoiceNotesChange(voiceNotes.filter((n) => n.id !== id));
    },
    [voiceNotes, onVoiceNotesChange]
  );

  /* ── Cleanup al desmontar ── */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (speechRef.current) {
        try { speechRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  const hasVoiceSlot = voiceNotes.length < MAX_NOTES && !isRecording;

  return (
    <div>
      {/* ══════════════════════════════
          SECCIÓN 1 — TECLADO
          ══════════════════════════════ */}
      <div className="mb-5">
        <p className="text-[#1C1C1E] mb-2.5" style={{ fontSize: 17, fontWeight: 700 }}>
          Descripción
        </p>
        <textarea
          value={writtenText}
          onChange={(e) => onWrittenTextChange(e.target.value)}
          placeholder="¿Qué ocurrió en campo?"
          rows={3}
          data-no-swipe=""
          className="w-full rounded-2xl px-4 py-4 resize-none outline-none"
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: "#1C1C1E",
            background: "#F2F2F7",
            border: writtenText.trim() ? "2px solid #AB1738" : "2px solid transparent",
            transition: "border-color 0.15s",
          }}
        />
      </div>

      {/* ══════════════════════════════
          SECCIÓN 2 — NOTAS DE VOZ
          ══════════════════════════════ */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "#F9F9FB", border: "1.5px solid #E5E5EA" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: voiceNotes.length > 0 ? "linear-gradient(135deg,#AB1738,#7C1028)" : "#E5E5EA" }}
            >
              <Volume2
                className="w-4 h-4"
                style={{ color: voiceNotes.length > 0 ? "white" : "#8E8E93" }}
                strokeWidth={2.5}
              />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1C1C1E" }}>
              Notas de voz
            </span>
          </div>
          <span
            className="px-2.5 py-1 rounded-full"
            style={{
              fontSize: 13,
              fontWeight: 700,
              background: voiceNotes.length > 0 ? "rgba(171,23,56,0.10)" : "#E5E5EA",
              color: voiceNotes.length > 0 ? "#AB1738" : "#8E8E93",
            }}
          >
            {voiceNotes.length}/{MAX_NOTES}
          </span>
        </div>

        {/* ── Notas grabadas ── */}
        {voiceNotes.map((note, i) => (
          <VoiceNoteCard
            key={note.id}
            note={note}
            index={i}
            onDelete={() => deleteNote(note.id)}
          />
        ))}

        {/* ── Error de micrófono ── */}
        {micError && (
          <div
            className="rounded-xl px-4 py-3 mb-3"
            style={{ background: "#FFF1F4", border: "1.5px solid rgba(171,23,56,0.25)" }}
          >
            <p style={{ fontSize: 15, color: "#AB1738", fontWeight: 600 }}>{micError}</p>
          </div>
        )}

        {/* ── Indicador de grabación activa ── */}
        {isRecording && (
          <div
            className="rounded-2xl p-4 mb-3"
            style={{ background: "#FFF1F4", border: "2px solid #AB1738" }}
          >
            {/* Fila superior: badge pulsante + botón detener */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full bg-[#AB1738] inline-block"
                  style={{ animation: "pulse 1s ease-in-out infinite" }}
                />
                <span style={{ fontSize: 17, fontWeight: 800, color: "#AB1738" }}>
                  Grabando · {fmtSec(recordingSec)}
                </span>
              </div>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
                style={{
                  background: "linear-gradient(135deg, #AB1738, #7C1028)",
                  boxShadow: "0 4px 14px rgba(171,23,56,0.30)",
                }}
              >
                <Square className="w-4 h-4 text-white" fill="white" strokeWidth={0} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "white" }}>
                  Detener
                </span>
              </button>
            </div>

            {/* Transcripción en vivo */}
            <div
              className="rounded-xl px-3 py-3 min-h-[48px]"
              style={{ background: "rgba(171,23,56,0.06)", border: "1px solid rgba(171,23,56,0.15)" }}
            >
              {liveTranscript ? (
                <p style={{ fontSize: 16, color: "#3A3A3C", lineHeight: 1.55 }}>
                  {liveTranscript}
                </p>
              ) : (
                <p style={{ fontSize: 15, color: "#AEAEB2" }}>
                  Escuchando… habla claramente
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Botón grabar nueva nota ── */}
        {hasVoiceSlot && (
          <button
            onClick={startRecording}
            className="w-full flex items-center justify-center gap-3 rounded-2xl active:scale-[0.97] transition-transform"
            style={{
              height: 60,
              background:
                voiceNotes.length === 0
                  ? "rgba(171,23,56,0.06)"
                  : "rgba(171,23,56,0.04)",
              border:
                voiceNotes.length === 0
                  ? "2px dashed rgba(171,23,56,0.40)"
                  : "2px dashed rgba(171,23,56,0.25)",
            }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #AB1738, #7C1028)", boxShadow: "0 3px 10px rgba(171,23,56,0.30)" }}
            >
              <Mic className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#AB1738" }}>
              {voiceNotes.length === 0
                ? "Grabar nota de voz"
                : `Agregar nota ${voiceNotes.length + 1} de ${MAX_NOTES}`}
            </span>
          </button>
        )}

        {/* ── Hint de jerarquía ── */}
        {(writtenText.trim() || voiceNotes.length > 0) && (
          <p
            className="mt-3 text-center"
            style={{ fontSize: 12, color: "#AEAEB2", lineHeight: 1.5 }}
          >
            {writtenText.trim() && voiceNotes.length > 0
              ? "Texto + transcripciones de voz se guardan en el hilo"
              : writtenText.trim()
              ? "Descripción escrita como texto principal"
              : "Transcripción de voz como texto principal"}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Utilidad exportada: construir mensaje con jerarquía ──────── */
export function buildActivityMessage(
  writtenText: string,
  voiceNotes: VoiceNote[],
  tipo: string
): string {
  const written = writtenText.trim();
  const transcriptions = voiceNotes
    .map((n) => n.transcription.trim())
    .filter(Boolean);

  const parts: string[] = [];

  if (written) {
    parts.push(written);
    // Agregar transcripciones como contexto adicional
    transcriptions.forEach((t) => parts.push(t));
  } else if (transcriptions.length > 0) {
    // Sin texto → transcripciones son el contenido principal
    // Si la primera es corta, concatenar hasta tener suficiente
    let combined = "";
    for (const t of transcriptions) {
      combined = combined ? `${combined} • ${t}` : t;
      if (combined.length >= SHORT_THRESHOLD) break;
    }
    // Si aún hay más transcripciones que no alcanzaron el threshold, agregar todas
    if (transcriptions.length > 1) {
      combined = transcriptions.join(" • ");
    }
    parts.push(combined);
  }

  const body = parts.join(" • ");
  return tipo ? `${tipo}: ${body}` : body;
}
