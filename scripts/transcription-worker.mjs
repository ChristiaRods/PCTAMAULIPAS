/**
 * Transcription worker (Whisper-compatible API).
 *
 * Usage:
 *   node scripts/transcription-worker.mjs
 *
 * Required env vars:
 *   SUPABASE_FUNCTION_BASE=https://<project>.supabase.co/functions/v1/server
 *   SUPABASE_ANON_KEY=<project anon key>
 *   TRANSCRIPTION_WORKER_SECRET=<same secret configured in Supabase Edge Function>
 *
 * Optional env vars:
 *   WHISPER_API_BASE=http://127.0.0.1:8080
 *   WHISPER_API_KEY=<token if your whisper endpoint requires auth>
 *   WHISPER_MODEL=whisper-1
 *   TRANSCRIPTION_LANGUAGE=es
 *   WORKER_ID=whispercpp-worker-1
 *   POLL_INTERVAL_MS=3000
 */

const required = ["SUPABASE_FUNCTION_BASE", "SUPABASE_ANON_KEY", "TRANSCRIPTION_WORKER_SECRET"];
for (const key of required) {
  if (!process.env[key] || process.env[key].trim().length === 0) {
    console.error(`[worker] Missing required env var: ${key}`);
    process.exit(1);
  }
}

const SUPABASE_FUNCTION_BASE = process.env.SUPABASE_FUNCTION_BASE.replace(/\/+$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TRANSCRIPTION_WORKER_SECRET = process.env.TRANSCRIPTION_WORKER_SECRET;
const WHISPER_API_BASE = (process.env.WHISPER_API_BASE || "http://127.0.0.1:8080").replace(/\/+$/, "");
const WHISPER_API_KEY = process.env.WHISPER_API_KEY || "";
const WHISPER_MODEL = process.env.WHISPER_MODEL || "whisper-1";
const TRANSCRIPTION_LANGUAGE = process.env.TRANSCRIPTION_LANGUAGE || "es";
const WORKER_ID = process.env.WORKER_ID || "whisper-worker-1";
const POLL_INTERVAL_MS = Math.max(500, Number(process.env.POLL_INTERVAL_MS || "3000"));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function supabaseHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    "x-transcription-secret": TRANSCRIPTION_WORKER_SECRET,
    ...extra,
  };
}

async function claimJob() {
  const res = await fetch(`${SUPABASE_FUNCTION_BASE}/transcription/jobs/claim`, {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ workerId: WORKER_ID }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`claim failed ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data?.job || null;
}

async function completeJob(jobId, transcript, provider = "whisper-compatible") {
  const res = await fetch(`${SUPABASE_FUNCTION_BASE}/transcription/jobs/${jobId}/complete`, {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      transcript,
      provider,
      model: WHISPER_MODEL,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`complete failed ${res.status}: ${text}`);
  }
}

async function failJob(jobId, error, retryable = true) {
  const res = await fetch(`${SUPABASE_FUNCTION_BASE}/transcription/jobs/${jobId}/error`, {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      error: String(error || "transcription-failed"),
      retryable,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[worker] failJob request error ${res.status}: ${text}`);
  }
}

async function transcribeAudioUrl(audioUrl) {
  const sourceRes = await fetch(audioUrl);
  if (!sourceRes.ok) {
    throw new Error(`audio download failed ${sourceRes.status}`);
  }
  const audioBuffer = await sourceRes.arrayBuffer();
  const contentType = sourceRes.headers.get("content-type") || "application/octet-stream";
  const ext = contentType.includes("mp4")
    ? "m4a"
    : contentType.includes("mpeg")
      ? "mp3"
      : contentType.includes("wav")
        ? "wav"
        : "webm";

  const form = new FormData();
  form.append("model", WHISPER_MODEL);
  form.append("language", TRANSCRIPTION_LANGUAGE);
  form.append(
    "file",
    new Blob([audioBuffer], { type: contentType }),
    `audio.${ext}`,
  );

  const headers = {};
  if (WHISPER_API_KEY) {
    headers.Authorization = `Bearer ${WHISPER_API_KEY}`;
  }

  const whisperRes = await fetch(`${WHISPER_API_BASE}/v1/audio/transcriptions`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!whisperRes.ok) {
    const text = await whisperRes.text().catch(() => "");
    throw new Error(`whisper failed ${whisperRes.status}: ${text}`);
  }

  const data = await whisperRes.json().catch(() => ({}));
  const transcript =
    typeof data?.text === "string"
      ? data.text.trim()
      : typeof data?.transcript === "string"
        ? data.transcript.trim()
        : "";

  if (!transcript) {
    throw new Error("empty transcript");
  }

  return transcript;
}

async function processOne() {
  const job = await claimJob();
  if (!job) return false;

  console.log(`[worker] claimed ${job.id} report=${job.reportId} note=${job.noteId}`);
  try {
    const transcript = await transcribeAudioUrl(job.audioUrl);
    await completeJob(job.id, transcript);
    console.log(`[worker] completed ${job.id} (${transcript.length} chars)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] failed ${job.id}: ${message}`);
    const retryable = !message.includes("401") && !message.includes("403");
    await failJob(job.id, message, retryable);
  }

  return true;
}

async function main() {
  console.log("[worker] started");
  console.log(`[worker] supabase=${SUPABASE_FUNCTION_BASE}`);
  console.log(`[worker] whisper=${WHISPER_API_BASE}`);

  while (true) {
    try {
      const didWork = await processOne();
      if (!didWork) {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[worker] loop error: ${message}`);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
