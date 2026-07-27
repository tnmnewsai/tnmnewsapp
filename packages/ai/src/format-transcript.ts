import type { TranscriptWordInput } from "./types";

const WORDS_PER_LINE = 15;

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Chunks words into timestamped lines so the model has temporal anchors to
 * ground startMs/endMs against, without the noise of a per-word timestamp on
 * every token. Precision is inherently coarse (~line-level) — fine, since a
 * human fine-tunes the exact trim in the Milestone 2 editor afterward.
 */
export function formatTranscript(words: TranscriptWordInput[]): string {
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
    const chunk = words.slice(i, i + WORDS_PER_LINE);
    const first = chunk[0];
    if (!first) continue;
    lines.push(`[${formatTimestamp(first.startMs)}] ${chunk.map((w) => w.word).join(" ")}`);
  }
  return lines.join("\n");
}
