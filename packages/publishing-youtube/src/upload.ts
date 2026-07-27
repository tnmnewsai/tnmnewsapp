import fs from "node:fs";
import type { PublishInput, PublishResult } from "@svt/publishing-core";

interface YouTubeVideoInsertResponse {
  id: string;
}

/**
 * Short-form clips (15-90s) encode to a few MB at most, so a single-shot PUT
 * against the resumable session URL is simpler and sufficient — no need for
 * chunked upload/resume logic a longer-form uploader would require.
 */
export async function publishToYouTube(input: PublishInput): Promise<PublishResult> {
  const metadata = {
    snippet: {
      title: input.content.title || "Untitled",
      description: input.content.description,
      tags: input.content.tags,
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.account.accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify(metadata),
    },
  );
  if (!initRes.ok) {
    throw new Error(`YouTube upload session init failed: ${initRes.status} ${await initRes.text()}`);
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return a resumable upload URL.");

  const videoBuffer = fs.readFileSync(input.videoLocalPath);
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(videoBuffer.length) },
    body: videoBuffer,
  });
  if (!uploadRes.ok) {
    throw new Error(`YouTube video upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }
  const video = (await uploadRes.json()) as YouTubeVideoInsertResponse;

  if (input.thumbnailLocalPath) {
    const thumbBuffer = fs.readFileSync(input.thumbnailLocalPath);
    const thumbRes = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${video.id}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${input.account.accessToken}`, "Content-Type": "image/png" },
        body: thumbBuffer,
      },
    );
    if (!thumbRes.ok) {
      // The video itself is already live — a thumbnail failure shouldn't fail the whole publish.
      console.error(`YouTube thumbnail upload failed: ${thumbRes.status} ${await thumbRes.text()}`);
    }
  }

  return { platformPostId: video.id, platformUrl: `https://youtu.be/${video.id}` };
}
