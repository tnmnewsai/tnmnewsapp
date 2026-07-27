import type { AnalyticsMetrics, GetAnalyticsInput } from "@svt/publishing-core";

interface YouTubeVideoStatistics {
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
}

interface YouTubeVideoListResponse {
  items?: { statistics?: YouTubeVideoStatistics }[];
}

/** Data API v3's simple statistics endpoint — the fuller YouTube Analytics API needs extra scopes this app doesn't request. */
export async function getYouTubeAnalytics(input: GetAnalyticsInput): Promise<AnalyticsMetrics> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${input.platformPostId}`,
    { headers: { Authorization: `Bearer ${input.account.accessToken}` } },
  );
  if (!res.ok) throw new Error(`YouTube analytics fetch failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as YouTubeVideoListResponse;
  const stats = data.items?.[0]?.statistics;
  if (!stats) throw new Error("YouTube did not return statistics for this video.");

  return {
    views: stats.viewCount ? Number(stats.viewCount) : undefined,
    likes: stats.likeCount ? Number(stats.likeCount) : undefined,
    comments: stats.commentCount ? Number(stats.commentCount) : undefined,
    raw: stats,
  };
}
