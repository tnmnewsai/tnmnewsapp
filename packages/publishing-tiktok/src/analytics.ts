import type { AnalyticsMetrics, GetAnalyticsInput } from "@svt/publishing-core";

const VIDEO_QUERY_URL = "https://open.tiktokapis.com/v2/video/query/";

interface TikTokVideoStats {
  id: string;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
}

interface TikTokVideoQueryResponse {
  data?: { videos?: TikTokVideoStats[] };
  error?: { code: string; message: string };
}

export async function getTikTokAnalytics(input: GetAnalyticsInput): Promise<AnalyticsMetrics> {
  const res = await fetch(`${VIDEO_QUERY_URL}?fields=id,like_count,comment_count,share_count,view_count`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.account.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filters: { video_ids: [input.platformPostId] } }),
  });
  if (!res.ok) throw new Error(`TikTok analytics fetch failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as TikTokVideoQueryResponse;
  if (data.error && data.error.code !== "ok") {
    throw new Error(`TikTok analytics fetch failed: ${data.error.code} ${data.error.message}`);
  }

  const video = data.data?.videos?.[0];
  if (!video) throw new Error("TikTok did not return stats for this video.");

  return {
    views: video.view_count,
    likes: video.like_count,
    comments: video.comment_count,
    shares: video.share_count,
    raw: video,
  };
}
