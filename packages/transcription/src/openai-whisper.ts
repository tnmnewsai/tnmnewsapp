import fs from "node:fs";
import path from "node:path";
import type { TranscriptionResult, TranscriptWord } from "./types";

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Calls the Whisper endpoint directly with native fetch/FormData/Blob rather
 * than the OpenAI SDK's audio.transcriptions.create(). The SDK's Node runtime
 * shim uses the bundled node-fetch package, whose requests to OpenAI reliably
 * fail with ECONNRESET on this network for multipart uploads; switching to
 * native fetch inside the SDK instead hits undici's stricter streaming-body
 * requirements (duplex option, one-time-readable Request bodies) that the
 * SDK's own request construction doesn't account for. A FormData+Blob body
 * sidesteps all of that — it's not the kind of streaming body either issue
 * applies to.
 */
export async function transcribeWithWhisper(apiKey: string, audioPath: string): Promise<TranscriptionResult> {
  const audioBuffer = fs.readFileSync(audioPath);
  const form = new FormData();
  form.append("file", new Blob([audioBuffer]), path.basename(audioPath));
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`OpenAI Whisper request failed: ${res.status} ${res.statusText} — ${await res.text()}`);
  }

  const raw = (await res.json()) as { language?: string; words?: WhisperWord[] };

  const words: TranscriptWord[] = (raw.words ?? []).map((w) => ({
    word: w.word,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
  }));

  return {
    provider: "openai-whisper",
    language: raw.language ?? null,
    words,
  };
}
