"use client";

import { useState, useTransition } from "react";
import { saveTranscriptCorrection } from "./actions";
import styles from "./sources.module.css";

interface Word {
  word: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export default function TranscriptEditor({
  sourceAssetId,
  initialWords,
}: {
  sourceAssetId: string;
  initialWords: Word[];
}) {
  const [words, setWords] = useState(initialWords);
  const [saved, setSaved] = useState(true);
  const [pending, startTransition] = useTransition();

  function updateWord(index: number, text: string) {
    setSaved(false);
    setWords((prev) => prev.map((w, i) => (i === index ? { ...w, word: text } : w)));
  }

  function deleteWord(index: number) {
    setSaved(false);
    setWords((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    startTransition(async () => {
      await saveTranscriptCorrection(sourceAssetId, words);
      setSaved(true);
    });
  }

  return (
    <div>
      <div className={styles.wordList}>
        {words.map((w, i) => (
          <span key={i} className={styles.wordChip}>
            <input
              value={w.word}
              onChange={(e) => updateWord(i, e.target.value)}
              size={Math.max(2, w.word.length)}
              aria-label={`Word ${i + 1}`}
            />
            <button type="button" onClick={() => deleteWord(i)} aria-label={`Delete "${w.word}"`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <button type="button" onClick={save} disabled={pending || saved}>
        {pending ? "Saving…" : saved ? "Saved" : "Save corrections"}
      </button>
    </div>
  );
}
