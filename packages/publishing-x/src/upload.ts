import fs from "node:fs";
import type { PublishInput, PublishResult } from "@svt/publishing-core";

const MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
const TWEETS_URL = "https://api.twitter.com/2/tweets";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

interface InitResponse {
  media_id_string: string;
}

interface StatusResponse {
  processing_info?: {
    state: "pending" | "in_progress" | "succeeded" | "failed";
    check_after_secs?: number;
    error?: { message: string };
  };
}

async function waitForMediaReady(mediaId: string, accessToken: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(`${MEDIA_UPLOAD_URL}?command=STATUS&media_id=${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`X media status check failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as StatusResponse;

    const state = data.processing_info?.state;
    if (!state || state === "succeeded") return;
    if (state === "failed") {
      throw new Error(
        `X failed to process the uploaded video: ${data.processing_info?.error?.message ?? "unknown reason"}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for X to finish processing the video.");
}

/**
 * X still uses the v1.1 chunked media/upload endpoint for video (v2 has no
 * full media-upload API yet), then attaches the resulting media_id to a v2
 * tweet. Single APPEND chunk — short-form clips are comfortably under X's
 * per-chunk size limit, same reasoning as the YouTube/TikTok adapters.
 */
export async function publishToX(input: PublishInput): Promise<PublishResult> {
  const { accessToken } = input.account;
  const videoBuffer = fs.readFileSync(input.videoLocalPath);
  const videoSize = videoBuffer.length;

  const initRes = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      command: "INIT",
      media_type: "video/mp4",
      media_category: "tweet_video",
      total_bytes: String(videoSize),
    }),
  });
  if (!initRes.ok) throw new Error(`X media upload init failed: ${initRes.status} ${await initRes.text()}`);
  const { media_id_string: mediaId } = (await initRes.json()) as InitResponse;

  const appendForm = new FormData();
  appendForm.append("command", "APPEND");
  appendForm.append("media_id", mediaId);
  appendForm.append("segment_index", "0");
  appendForm.append("media", new Blob([videoBuffer], { type: "video/mp4" }), "video.mp4");

  const appendRes = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: appendForm,
  });
  if (!appendRes.ok) throw new Error(`X media upload append failed: ${appendRes.status} ${await appendRes.text()}`);

  const finalizeRes = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "FINALIZE", media_id: mediaId }),
  });
  if (!finalizeRes.ok) {
    throw new Error(`X media upload finalize failed: ${finalizeRes.status} ${await finalizeRes.text()}`);
  }

  await waitForMediaReady(mediaId, accessToken);

  const tweetRes = await fetch(TWEETS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.content.description, media: { media_ids: [mediaId] } }),
  });
  if (!tweetRes.ok) throw new Error(`X post creation failed: ${tweetRes.status} ${await tweetRes.text()}`);

  const tweetData = (await tweetRes.json()) as { data?: { id: string } };
  if (!tweetData.data) throw new Error("X did not return a post id.");

  return {
    platformPostId: tweetData.data.id,
    // The generic "i/web/status" permalink resolves without needing the account's real handle.
    platformUrl: `https://twitter.com/i/web/status/${tweetData.data.id}`,
  };
}
