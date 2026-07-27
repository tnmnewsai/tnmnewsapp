import { PLATFORM_CAPABILITIES } from "@svt/publishing-core";
import type { PlatformAdapter } from "@svt/publishing-core";
import { exchangeTikTokCode, getTikTokAuthUrl, refreshTikTokAccessToken } from "./oauth";
import { publishToTikTok } from "./upload";
import { getTikTokAnalytics } from "./analytics";

export const tiktokAdapter: PlatformAdapter = {
  platform: "TIKTOK",
  capabilities: PLATFORM_CAPABILITIES.TIKTOK,
  getAuthUrl: getTikTokAuthUrl,
  exchangeCodeForTokens: exchangeTikTokCode,
  refreshAccessToken: refreshTikTokAccessToken,
  publish: publishToTikTok,
  getAnalytics: getTikTokAnalytics,
};
