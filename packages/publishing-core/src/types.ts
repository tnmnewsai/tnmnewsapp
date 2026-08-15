/** Mirrors the Prisma `Platform` enum's string values — kept as a local type so this package has no hard dependency on @svt/db. */
export type Platform = "YOUTUBE" | "META" | "FACEBOOK" | "TIKTOK" | "X";

export interface PlatformCapabilities {
  platform: Platform;
  displayName: string;
  /** 0 means the platform has no separate title field — everything goes in the description/caption. */
  maxTitleLength: number;
  maxDescriptionLength: number;
  maxTags: number;
  supportsThumbnail: boolean;
}

export interface BuildPackageContentInput {
  clipTitle: string;
  postCopyText: string;
  hashtags: string[];
}

export interface BuiltPackageContent {
  title: string;
  description: string;
  tags: string[];
}

export interface ConnectedAccountTokens {
  externalAccountId: string;
  accessToken: string;
  refreshToken?: string;
}

export interface ExchangedTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  externalAccountId: string;
  label: string;
}

export interface RefreshedTokens {
  accessToken: string;
  /**
   * Set when the platform rotates the refresh token on every use (TikTok
   * does; YouTube/Meta don't and omit this) — the caller must persist it,
   * since the old refresh token stops working once a rotating one is used.
   */
  refreshToken?: string;
  expiresAt?: Date;
}

export interface PublishInput {
  account: ConnectedAccountTokens;
  videoLocalPath: string;
  /**
   * A URL the platform's own servers can fetch directly — required by
   * adapters that ingest video by reference rather than direct upload (e.g.
   * Instagram's Content Publishing API). Null/undefined when the configured
   * storage driver can't produce one (local filesystem storage isn't
   * internet-reachable); adapters that need it should fail with a clear
   * error rather than silently skipping the platform.
   */
  videoPublicUrl?: string;
  thumbnailLocalPath?: string;
  content: BuiltPackageContent;
}

export interface PublishResult {
  platformPostId: string;
  platformUrl: string;
}

export interface GetAnalyticsInput {
  account: ConnectedAccountTokens;
  platformPostId: string;
}

export interface AnalyticsMetrics {
  /** Normalized cross-platform metrics — not every platform returns every one (e.g. YouTube has no "shares"). */
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  /** The full raw API response, for anything not captured above. */
  raw: unknown;
}

export interface AuthUrlResult {
  url: string;
  /**
   * Set only by platforms whose OAuth flow requires PKCE (X does; YouTube/
   * Meta/TikTok don't). The caller must persist this (e.g. a short-lived
   * cookie, same as `state`) and pass it back to `exchangeCodeForTokens` —
   * without it, X's token exchange fails.
   */
  codeVerifier?: string;
}

/**
 * The registered OAuth app's Client ID/Secret (Google Cloud OAuth client,
 * Meta App, TikTok app, X app) — distinct from a connected account's
 * access/refresh tokens. Resolved per-Account (DB-configured on the
 * Platforms page, or an env-var fallback) by @svt/workflow's
 * resolvePlatformAppCredentials, then passed into these adapter methods
 * rather than each adapter reading process.env itself.
 */
export interface PlatformAppCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Every platform implements this the same way — getting the shape right
 * once (Milestone 8, YouTube) means Meta/TikTok/X (Milestones 9-11) are
 * additive, not a rework. OAuth methods are omitted for platforms whose
 * adapter doesn't exist yet; those platforms fall back to manual packaging
 * using just `PLATFORM_CAPABILITIES`, no adapter object required.
 */
export interface PlatformAdapter {
  platform: Platform;
  capabilities: PlatformCapabilities;
  getAuthUrl(credentials: PlatformAppCredentials, redirectUri: string, state: string): AuthUrlResult;
  exchangeCodeForTokens(
    credentials: PlatformAppCredentials,
    code: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<ExchangedTokens>;
  /**
   * `externalAccountId` is the already-connected PlatformAccount's id (e.g.
   * a specific Facebook Page or Instagram account) — required by adapters
   * where one OAuth token/refresh token can represent several sub-accounts
   * (Meta/Facebook), so a refresh re-targets the SAME sub-account rather
   * than silently drifting to whichever one an API happens to list first.
   * Ignored by adapters with a 1:1 token-to-account relationship.
   */
  refreshAccessToken(
    credentials: PlatformAppCredentials,
    refreshToken: string,
    externalAccountId: string,
  ): Promise<RefreshedTokens>;
  publish(input: PublishInput): Promise<PublishResult>;
  getAnalytics(input: GetAnalyticsInput): Promise<AnalyticsMetrics>;
}
