"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrandTemplateVersion } from "./actions";
import styles from "../library.module.css";

export default function CreateVersionForm({
  graphicAssets,
}: {
  graphicAssets: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createBrandTemplateVersion(formData);
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
        <input name="name" required placeholder="Default vertical template" />
      </label>

      <div className={styles.row}>
        <label>
          Caption font size
          <input type="number" name="captionFontSize" defaultValue={56} min={20} max={120} />
        </label>
        <label>
          Caption position
          <select name="captionPosition" defaultValue="bottom">
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
      </div>

      <div className={styles.row}>
        <label>
          Caption text color
          <input type="color" name="captionColor" defaultValue="#ffffff" />
        </label>
        <label>
          Caption background
          <input type="text" name="captionBackgroundColor" defaultValue="#000000cc" />
        </label>
        <label>
          Accent color
          <input type="color" name="accentColor" defaultValue="#b8791f" />
        </label>
      </div>

      <div className={styles.row}>
        <label>
          Logo
          <select name="logoGraphicAssetId" defaultValue="">
            <option value="">No logo</option>
            {graphicAssets.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Logo position
          <select name="logoPosition" defaultValue="top-right">
            <option value="top-left">Top left</option>
            <option value="top-right">Top right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="bottom-right">Bottom right</option>
          </select>
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create new version"}
      </button>
    </form>
  );
}
