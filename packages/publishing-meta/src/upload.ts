import type { PublishInput, PublishResult } from "@svt/publishing-core";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

interface CreateContainerResponse {
  id: string;
}

interface ContainerStatusResponse {
  status_code: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";
}

interface MediaPermalinkResponse {
  permalink?: string;
}

async function waitForContainerReady(containerId: string, accessToken: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(
      `${GRAPH_BASE_URL}/${containerId}?fields=status_code&access_token=${accessToken}`,
    );
    if (!res.ok) throw new Error(`Instagram container status check failed: ${res.status} ${await res.text()}`);
    const { status_code } = (await res.json()) as ContainerStatusResponse;

    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Instagram failed to process the uploaded video (${status_code}).`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for Instagram to finish processing the video.");
}

/**
 * Instagram's Content Publishing API ingests video by reference — it fetches
 * `video_url` itself rather than accepting a direct upload — so this needs a
 * publicly-reachable URL (see PublishInput.videoPublicUrl), unlike YouTube's
 * resumable-upload adapter which works from a local file.
 */
export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  if (!input.videoPublicUrl) {
    throw new Error(
      "Meta/Instagram requires a publicly-reachable video URL to publish, which local filesystem " +
        "storage can't provide. Set STORAGE_DRIVER=s3 (R2/S3) to enable Meta publishing.",
    );
  }

  const { accessToken, externalAccountId: igUserId } = input.account;

  const createRes = await fetch(`${GRAPH_BASE_URL}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: input.videoPublicUrl,
      caption: input.content.description,
      access_token: accessToken,
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Instagram media container creation failed: ${createRes.status} ${await createRes.text()}`);
  }
  const { id: containerId } = (await createRes.json()) as CreateContainerResponse;

  await waitForContainerReady(containerId, accessToken);

  const publishRes = await fetch(`${GRAPH_BASE_URL}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
  if (!publishRes.ok) {
    throw new Error(`Instagram publish failed: ${publishRes.status} ${await publishRes.text()}`);
  }
  const { id: mediaId } = (await publishRes.json()) as CreateContainerResponse;

  const permalinkRes = await fetch(`${GRAPH_BASE_URL}/${mediaId}?fields=permalink&access_token=${accessToken}`);
  const permalink = permalinkRes.ok ? ((await permalinkRes.json()) as MediaPermalinkResponse).permalink : undefined;

  return { platformPostId: mediaId, platformUrl: permalink ?? `https://www.instagram.com/reel/${mediaId}/` };
}

interface FacebookVideoUploadResponse {
  id: string;
}

interface FacebookVideoStatusResponse {
  status?: { video_status: "processing" | "ready" | "error" };
}

async function waitForFacebookVideoReady(videoId: string, accessToken: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(`${GRAPH_BASE_URL}/${videoId}?fields=status&access_token=${accessToken}`);
    if (!res.ok) throw new Error(`Facebook video status check failed: ${res.status} ${await res.text()}`);
    const { status } = (await res.json()) as FacebookVideoStatusResponse;

    if (!status || status.video_status === "ready") return;
    if (status.video_status === "error") throw new Error("Facebook failed to process the uploaded video.");

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for Facebook to finish processing the video.");
}

/**
 * Unlike Instagram's two-phase container-then-publish flow, a Page video
 * post via `file_url` is created and live in one call — the returned id is
 * immediately usable, so polling here is only to know when it's finished
 * processing, not a precondition for the post to exist.
 */
export async function publishToFacebookPage(input: PublishInput): Promise<PublishResult> {
  if (!input.videoPublicUrl) {
    throw new Error(
      "Facebook requires a publicly-reachable video URL to publish, which local filesystem storage " +
        "can't provide. Set STORAGE_DRIVER=s3 (R2/S3) to enable Facebook publishing.",
    );
  }

  const { accessToken, externalAccountId: pageId } = input.account;

  const createRes = await fetch(`${GRAPH_BASE_URL}/${pageId}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_url: input.videoPublicUrl,
      description: input.content.description,
      access_token: accessToken,
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Facebook Page video upload failed: ${createRes.status} ${await createRes.text()}`);
  }
  const { id: videoId } = (await createRes.json()) as FacebookVideoUploadResponse;

  await waitForFacebookVideoReady(videoId, accessToken);

  return { platformPostId: videoId, platformUrl: `https://www.facebook.com/${pageId}/videos/${videoId}/` };
}
