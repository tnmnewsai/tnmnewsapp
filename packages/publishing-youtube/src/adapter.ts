import { PLATFORM_CAPABILITIES } from "@svt/publishing-core";
import type { PlatformAdapter } from "@svt/publishing-core";
import { exchangeYouTubeCode, getYouTubeAuthUrl, refreshYouTubeAccessToken } from "./oauth";
import { publishToYouTube } from "./upload";
import { getYouTubeAnalytics } from "./analytics";

export const youtubeAdapter: PlatformAdapter = {
  platform: "YOUTUBE",
  capabilities: PLATFORM_CAPABILITIES.YOUTUBE,
  getAuthUrl: getYouTubeAuthUrl,
  exchangeCodeForTokens: exchangeYouTubeCode,
  refreshAccessToken: refreshYouTubeAccessToken,
  publish: publishToYouTube,
  getAnalytics: getYouTubeAnalytics,
};
