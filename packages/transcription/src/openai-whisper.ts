import fs from "node:fs";
import OpenAI from "openai";
import type { TranscriptionResult, TranscriptWord } from "./types";

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export async function transcribeWithWhisper(apiKey: string, audioPath: string): Promise<TranscriptionResult> {
  const client = new OpenAI({ apiKey });

  const response = await client.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  // The SDK's verbose_json type doesn't declare `words` yet even though the API returns it.
  const raw = response as unknown as { language?: string; words?: WhisperWord[] };

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
