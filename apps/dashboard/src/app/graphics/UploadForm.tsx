"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadGraphicAsset } from "./actions";
import styles from "../library.module.css";

export default function UploadForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await uploadGraphicAsset(formData);
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
        <input name="name" required placeholder="Channel logo" />
      </label>
      <label>
        Image file
        <input type="file" name="file" accept="image/*" required />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload graphic"}
      </button>
    </form>
  );
}
