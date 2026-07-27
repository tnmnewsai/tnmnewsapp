"use client";

import { useState } from "react";
import styles from "./sources.module.css";

export default function AddSourceForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [type, setType] = useState("YOUTUBE_LINK");
  const [pending, setPending] = useState(false);

  return (
    <form
      className={styles.form}
      action={action}
      onSubmit={() => setPending(true)}
    >
      <label>
        Source type
        <select name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="YOUTUBE_LINK">YouTube link</option>
          <option value="DRIVE_LINK">Google Drive link</option>
          <option value="VIDEO_UPLOAD">Upload a file</option>
          <option value="BLOG_URL">Blog URL</option>
        </select>
      </label>

      {type === "VIDEO_UPLOAD" ? (
        <label>
          Video file
          <input type="file" name="file" accept="video/*" required />
        </label>
      ) : (
        <label>
          {type === "YOUTUBE_LINK"
            ? "YouTube URL"
            : type === "DRIVE_LINK"
              ? "Google Drive share link"
              : "Blog article URL"}
          <input
            type="url"
            name="url"
            required
            placeholder={
              type === "YOUTUBE_LINK"
                ? "https://www.youtube.com/watch?v=..."
                : type === "DRIVE_LINK"
                  ? "https://drive.google.com/file/d/.../view"
                  : "https://example.com/some-article"
            }
          />
        </label>
      )}

      {type === "BLOG_URL" && (
        <p className={styles.help}>
          The article gets narrated and turned into a video automatically (script, voice, and
          AI-generated visuals) — this can take a couple of minutes.
        </p>
      )}

      <label className={styles.checkboxLabel}>
        <input type="checkbox" name="rightsAttestation" required />I have the rights to use
        this content
      </label>

      <button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add source"}
      </button>
    </form>
  );
}
