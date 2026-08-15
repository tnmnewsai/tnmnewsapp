"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./sources.module.css";

export default function AddSourceForm({
  action,
  prepareVideoUpload,
  completeVideoUpload,
}: {
  action: (formData: FormData) => Promise<void>;
  prepareVideoUpload: (input: { filename: string; contentType: string; size: number }) => Promise<{ sourceAssetId: string; uploadUrl: string }>;
  completeVideoUpload: (sourceAssetId: string) => Promise<string>;
}) {
  const router = useRouter();
  const [type, setType] = useState("YOUTUBE_LINK");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (type !== "VIDEO_UPLOAD") {
      setPending(true);
      return;
    }

    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) throw new Error("Choose a video file to upload.");

      const { sourceAssetId, uploadUrl } = await prepareVideoUpload({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error(`Storage upload failed (${response.status}).`);

      const completedId = await completeVideoUpload(sourceAssetId);
      router.push(`/sources/${completedId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The video upload failed. Please try again.");
      setPending(false);
    }
  }

  return (
    <form
      className={styles.form}
      action={action}
      onSubmit={submit}
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
        {pending ? (type === "VIDEO_UPLOAD" ? "Uploading…" : "Adding…") : "Add source"}
      </button>
      {error && <p role="alert" className={styles.help}>{error}</p>}
    </form>
  );
}
