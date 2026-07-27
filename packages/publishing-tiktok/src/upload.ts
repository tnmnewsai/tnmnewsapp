import fs from "node:fs";
import type { PublishInput, PublishResult } from "@svt/publishing-core";

const INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

interface TikTokInitResponse {
  data?: { publish_id: string; upload_url: string };
  error?: { code: string; message: string };
}

interface TikTokStatusResponse {
  data?: {
    status: "PROCESSING_UPLOAD" | "PUBLISH_COMPLETE" | "FAILED" | "SEND_TO_USER_INBOX";
    fail_reason?: string;
    // TikTok's own API response field name — not a typo introduced here.
    publicaly_available_post_id?: string[];
  };
  error?: { code: string; message: string };
}

async function waitForPublishComplete(publishId: string, accessToken: string): Promise<string | undefined> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(STATUS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ publish_id: publishId }),
    });
    if (!res.ok) throw new Error(`TikTok publish status check failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as TikTokStatusResponse;
    if (data.error && data.error.code !== "ok") {
      throw new Error(`TikTok publish status check failed: ${data.error.code} ${data.error.message}`);
    }

    const status = data.data?.status;
    if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") {
      return data.data?.publicaly_available_post_id?.[0];
    }
    if (status === "FAILED") {
      throw new Error(`TikTok failed to publish the video: ${data.data?.fail_reason ?? "unknown reason"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for TikTok to finish publishing.");
}

/**
 * Content Posting API, FILE_UPLOAD source — works from a local file (unlike
 * Meta, which needs a public URL), single-chunk since short-form clips are
 * small. Unaudited apps can only post as SELF_ONLY (private, visible only to
 * the connected account) — TikTok's audit for public posting is the
 * "slowest review" the plan calls out, mirrored here as a fixed default
 * rather than something this milestone can toggle.
 */
export async function publishToTikTok(input: PublishInput): Promise<PublishResult> {
  const { accessToken, externalAccountId: openId } = input.account;
  const videoBuffer = fs.readFileSync(input.videoLocalPath);
  const videoSize = videoBuffer.length;

  const initRes = await fetch(INIT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      post_info: {
        title: input.content.description,
        privacy_level: "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  });
  if (!initRes.ok) throw new Error(`TikTok publish init failed: ${initRes.status} ${await initRes.text()}`);

  const initData = (await initRes.json()) as TikTokInitResponse;
  if (initData.error && initData.error.code !== "ok") {
    throw new Error(`TikTok publish init failed: ${initData.error.code} ${initData.error.message}`);
  }
  if (!initData.data) throw new Error("TikTok publish init did not return an upload session.");
  const { publish_id: publishId, upload_url: uploadUrl } = initData.data;

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: videoBuffer,
  });
  if (!uploadRes.ok) throw new Error(`TikTok video upload failed: ${uploadRes.status} ${await uploadRes.text()}`);

  const postId = await waitForPublishComplete(publishId, accessToken);

  return {
    platformPostId: postId ?? publishId,
    platformUrl: postId ? `https://www.tiktok.com/share/video/${postId}` : `https://www.tiktok.com/@${openId}`,
  };
}
