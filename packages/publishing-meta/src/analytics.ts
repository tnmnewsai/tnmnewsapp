import type { AnalyticsMetrics, GetAnalyticsInput } from "@svt/publishing-core";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

interface InstagramMediaResponse {
  like_count?: number;
  comments_count?: number;
}

interface InstagramInsightsResponse {
  data?: { name: string; values: { value: number }[] }[];
}

/**
 * Likes/comments come from the media object itself; plays/shares need the
 * separate Insights endpoint, which not every media type supports — treated
 * as a best-effort enhancement, not fatal if it fails.
 */
export async function getMetaAnalytics(input: GetAnalyticsInput): Promise<AnalyticsMetrics> {
  const { accessToken } = input.account;

  const mediaRes = await fetch(
    `${GRAPH_BASE_URL}/${input.platformPostId}?fields=like_count,comments_count&access_token=${accessToken}`,
  );
  if (!mediaRes.ok) throw new Error(`Instagram analytics fetch failed: ${mediaRes.status} ${await mediaRes.text()}`);
  const media = (await mediaRes.json()) as InstagramMediaResponse;

  let plays: number | undefined;
  let shares: number | undefined;
  const insightsRes = await fetch(
    `${GRAPH_BASE_URL}/${input.platformPostId}/insights?metric=plays,shares&access_token=${accessToken}`,
  );
  if (insightsRes.ok) {
    const insights = (await insightsRes.json()) as InstagramInsightsResponse;
    for (const metric of insights.data ?? []) {
      if (metric.name === "plays") plays = metric.values[0]?.value;
      if (metric.name === "shares") shares = metric.values[0]?.value;
    }
  }

  return {
    views: plays,
    likes: media.like_count,
    comments: media.comments_count,
    shares,
    raw: { media, plays, shares },
  };
}

interface FacebookVideoResponse {
  reactions?: { summary?: { total_count: number } };
  comments?: { summary?: { total_count: number } };
}

interface FacebookVideoInsightsResponse {
  data?: { name: string; values: { value: number }[] }[];
}

/**
 * Reactions/comments come from the video object itself; views/shares need
 * the separate video_insights endpoint — same best-effort shape as
 * `getMetaAnalytics` above.
 */
export async function getFacebookPageAnalytics(input: GetAnalyticsInput): Promise<AnalyticsMetrics> {
  const { accessToken } = input.account;

  const videoRes = await fetch(
    `${GRAPH_BASE_URL}/${input.platformPostId}?fields=reactions.summary(true).limit(0),comments.summary(true).limit(0)&access_token=${accessToken}`,
  );
  if (!videoRes.ok) throw new Error(`Facebook analytics fetch failed: ${videoRes.status} ${await videoRes.text()}`);
  const video = (await videoRes.json()) as FacebookVideoResponse;

  let views: number | undefined;
  let shares: number | undefined;
  const insightsRes = await fetch(
    `${GRAPH_BASE_URL}/${input.platformPostId}/video_insights?metric=total_video_views,total_video_shares&access_token=${accessToken}`,
  );
  if (insightsRes.ok) {
    const insights = (await insightsRes.json()) as FacebookVideoInsightsResponse;
    for (const metric of insights.data ?? []) {
      if (metric.name === "total_video_views") views = metric.values[0]?.value;
      if (metric.name === "total_video_shares") shares = metric.values[0]?.value;
    }
  }

  return {
    views,
    likes: video.reactions?.summary?.total_count,
    comments: video.comments?.summary?.total_count,
    shares,
    raw: { video, views, shares },
  };
}
