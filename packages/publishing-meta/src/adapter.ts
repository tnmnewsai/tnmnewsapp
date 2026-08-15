import { PLATFORM_CAPABILITIES } from "@svt/publishing-core";
import type { PlatformAdapter } from "@svt/publishing-core";
import {
  exchangeFacebookCode,
  exchangeMetaCode,
  getMetaAuthUrl,
  refreshFacebookAccessToken,
  refreshMetaAccessToken,
} from "./oauth";
import { publishToFacebookPage, publishToInstagram } from "./upload";
import { getFacebookPageAnalytics, getMetaAnalytics } from "./analytics";

export const metaAdapter: PlatformAdapter = {
  platform: "META",
  capabilities: PLATFORM_CAPABILITIES.META,
  getAuthUrl: getMetaAuthUrl,
  exchangeCodeForTokens: exchangeMetaCode,
  refreshAccessToken: refreshMetaAccessToken,
  publish: publishToInstagram,
  getAnalytics: getMetaAnalytics,
};

/**
 * Distinct from `metaAdapter` (which publishes to a Page's linked Instagram
 * account) — this posts to the Facebook Page itself. Reuses the same Meta
 * App OAuth dialog/scopes (`getMetaAuthUrl`), just walks the resulting token
 * differently (see `exchangeFacebookCode`).
 */
export const facebookAdapter: PlatformAdapter = {
  platform: "FACEBOOK",
  capabilities: PLATFORM_CAPABILITIES.FACEBOOK,
  getAuthUrl: getMetaAuthUrl,
  exchangeCodeForTokens: exchangeFacebookCode,
  refreshAccessToken: refreshFacebookAccessToken,
  publish: publishToFacebookPage,
  getAnalytics: getFacebookPageAnalytics,
};
