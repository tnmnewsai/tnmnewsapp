export interface TranscriptWordInput {
  word: string;
  startMs: number;
  endMs: number;
}

export interface ClipCandidateProposal {
  startMs: number;
  endMs: number;
  title: string;
  rationale: string;
  /** Self-reported by the model, 0-1 — a heuristic for sorting, not a calibrated probability. */
  confidence: number;
}

export interface VideoScriptSegmentProposal {
  narrationText: string;
  visualPrompt: string;
}
