"use client";

import { useRouter } from "next/navigation";
import ClipEditorForm from "./ClipEditorForm";
import { deleteClip, updateClip } from "./actions";

export default function EditClipSection({
  clipId,
  sourceAssetId,
  videoSrc,
  initialTitle,
  initialStartMs,
  initialEndMs,
}: {
  clipId: string;
  sourceAssetId: string;
  videoSrc: string;
  initialTitle: string;
  initialStartMs: number;
  initialEndMs: number;
}) {
  const router = useRouter();

  return (
    <ClipEditorForm
      videoSrc={videoSrc}
      initialTitle={initialTitle}
      initialStartMs={initialStartMs}
      initialEndMs={initialEndMs}
      submitLabel="Save changes"
      onSubmit={async ({ title, startMs, endMs }) => {
        await updateClip(clipId, { title, startMs, endMs });
        router.refresh();
      }}
      onDelete={async () => {
        await deleteClip(clipId);
        router.push(`/sources/${sourceAssetId}`);
      }}
    />
  );
}
