export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface TranscriptionResult {
  provider: string;
  language: string | null;
  words: TranscriptWord[];
}
