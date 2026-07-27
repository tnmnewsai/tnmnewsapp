import { PLATFORM_CAPABILITIES } from "@svt/publishing-core";
import type { PlatformAdapter } from "@svt/publishing-core";
import { exchangeXCode, getXAuthUrl, refreshXAccessToken } from "./oauth";
import { publishToX } from "./upload";
import { getXAnalytics } from "./analytics";

export const xAdapter: PlatformAdapter = {
  platform: "X",
  capabilities: PLATFORM_CAPABILITIES.X,
  getAuthUrl: getXAuthUrl,
  exchangeCodeForTokens: exchangeXCode,
  refreshAccessToken: refreshXAccessToken,
  publish: publishToX,
  getAnalytics: getXAnalytics,
};
