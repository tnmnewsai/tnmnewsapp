"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadMusicTrack } from "./actions";
import styles from "../library.module.css";

export default function UploadForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await uploadMusicTrack(formData);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <form className={styles.form} action={submit}>
      <label>
        Name
        <input name="name" required placeholder="Upbeat intro loop" />
      </label>
      <label>
        Audio file
        <input type="file" name="file" accept="audio/*" required />
      </label>
      <div className={styles.row}>
        <label>
          License source
          <input name="licenseSource" required placeholder="Epidemic Sound" />
        </label>
        <label>
          License type
          <input name="licenseType" required placeholder="Commercial subscription" />
        </label>
      </div>
      <div className={styles.row}>
        <label>
          Attribution text (if required)
          <input name="licenseAttribution" placeholder="Music by ..." />
        </label>
        <label>
          License expires (if any)
          <input type="date" name="licenseExpiresAt" />
        </label>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload track"}
      </button>
    </form>
  );
}
