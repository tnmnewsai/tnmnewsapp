import { PLATFORM_CAPABILITIES } from "@svt/publishing-core";
import type { PlatformAdapter } from "@svt/publishing-core";
import { exchangeMetaCode, getMetaAuthUrl, refreshMetaAccessToken } from "./oauth";
import { publishToInstagram } from "./upload";
import { getMetaAnalytics } from "./analytics";

export const metaAdapter: PlatformAdapter = {
  platform: "META",
  capabilities: PLATFORM_CAPABILITIES.META,
  getAuthUrl: getMetaAuthUrl,
  exchangeCodeForTokens: exchangeMetaCode,
  refreshAccessToken: refreshMetaAccessToken,
  publish: publishToInstagram,
  getAnalytics: getMetaAnalytics,
};
