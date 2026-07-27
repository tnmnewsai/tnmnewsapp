import type { AnalyticsMetrics, GetAnalyticsInput } from "@svt/publishing-core";

const TWEETS_URL = "https://api.twitter.com/2/tweets";

interface XPublicMetrics {
  retweet_count?: number;
  reply_count?: number;
  like_count?: number;
  quote_count?: number;
  impression_count?: number;
}

interface XTweetResponse {
  data?: { public_metrics?: XPublicMetrics };
}

export async function getXAnalytics(input: GetAnalyticsInput): Promise<AnalyticsMetrics> {
  const res = await fetch(`${TWEETS_URL}/${input.platformPostId}?tweet.fields=public_metrics`, {
    headers: { Authorization: `Bearer ${input.account.accessToken}` },
  });
  if (!res.ok) throw new Error(`X analytics fetch failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as XTweetResponse;
  const metrics = data.data?.public_metrics;
  if (!metrics) throw new Error("X did not return metrics for this post.");

  return {
    views: metrics.impression_count,
    likes: metrics.like_count,
    comments: metrics.reply_count,
    // X splits reposts into retweets and quote-tweets — "shares" here is both combined.
    shares: (metrics.retweet_count ?? 0) + (metrics.quote_count ?? 0),
    raw: metrics,
  };
}
