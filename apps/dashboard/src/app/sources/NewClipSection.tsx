"use client";

import { useRouter } from "next/navigation";
import ClipEditorForm from "./ClipEditorForm";
import { createClip } from "./actions";

export default function NewClipSection({
  sourceAssetId,
  videoSrc,
  defaultEndMs,
}: {
  sourceAssetId: string;
  videoSrc: string;
  defaultEndMs: number;
}) {
  const router = useRouter();

  return (
    <ClipEditorForm
      videoSrc={videoSrc}
      initialEndMs={defaultEndMs}
      submitLabel="Create clip"
      onSubmit={async ({ title, startMs, endMs }) => {
        const clipId = await createClip(sourceAssetId, { title, startMs, endMs });
        router.push(`/sources/${sourceAssetId}/clips/${clipId}`);
      }}
    />
  );
}
