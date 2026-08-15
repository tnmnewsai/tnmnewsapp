import type { BuildPackageContentInput, BuiltPackageContent, Platform, PlatformCapabilities } from "./types";

/**
 * Defined for all four platforms from day one — capability descriptors are
 * what makes the framework additive, per the locked architecture decision.
 * An adapter (OAuth + real publish) is a separate, later concern; a platform
 * with no adapter yet still gets correctly-packaged manual-fallback content.
 */
export const PLATFORM_CAPABILITIES: Record<Platform, PlatformCapabilities> = {
  YOUTUBE: {
    platform: "YOUTUBE",
    displayName: "YouTube",
    maxTitleLength: 100,
    maxDescriptionLength: 5000,
    maxTags: 15,
    supportsThumbnail: true,
  },
  META: {
    platform: "META",
    displayName: "Instagram",
    maxTitleLength: 0,
    maxDescriptionLength: 2200,
    maxTags: 30,
    supportsThumbnail: true,
  },
  FACEBOOK: {
    platform: "FACEBOOK",
    displayName: "Facebook",
    maxTitleLength: 0,
    maxDescriptionLength: 5000,
    maxTags: 30,
    supportsThumbnail: false,
  },
  TIKTOK: {
    platform: "TIKTOK",
    displayName: "TikTok",
    maxTitleLength: 0,
    maxDescriptionLength: 2200,
    maxTags: 30,
    supportsThumbnail: false,
  },
  X: {
    platform: "X",
    displayName: "X",
    maxTitleLength: 0,
    maxDescriptionLength: 280,
    maxTags: 0,
    supportsThumbnail: false,
  },
};

/**
 * Deterministic, non-creative packaging — truncation/hashtag-placement/
 * title-derivation only, per the locked "no platform-unique creative
 * rewrites" decision. The canonical PostCopy text and hashtags are the same
 * everywhere; this just fits them into each platform's constraints.
 */
export function buildPackageContent(
  platform: Platform,
  input: BuildPackageContentInput,
): BuiltPackageContent {
  const caps = PLATFORM_CAPABILITIES[platform];
  const tags = input.hashtags.slice(0, caps.maxTags);
  const hashtagsText = tags.map((h) => `#${h}`).join(" ");

  const title = caps.maxTitleLength > 0 ? input.clipTitle.slice(0, caps.maxTitleLength) : "";
  const withHashtags = hashtagsText ? `${input.postCopyText}\n\n${hashtagsText}` : input.postCopyText;
  const description = withHashtags.slice(0, caps.maxDescriptionLength);

  return { title, description, tags };
}
