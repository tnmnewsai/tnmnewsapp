import type { AuthUrlResult, ExchangedTokens, PlatformAppCredentials, RefreshedTokens } from "@svt/publishing-core";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Upload to publish, readonly to look up the channel id/title for labeling the connected account. */
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export function getYouTubeAuthUrl(
  credentials: PlatformAppCredentials,
  redirectUri: string,
  state: string,
): AuthUrlResult {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    // offline + consent: without both, Google only issues a refresh_token on
    // the very first authorization ever — every later reconnect silently
    // omits it, leaving long-lived publishing broken.
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return { url: `${GOOGLE_AUTH_URL}?${params.toString()}` };
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface YouTubeChannelListResponse {
  items?: { id: string; snippet: { title: string } }[];
}

export interface GoogleUserTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

/**
 * Walks an OAuth `code` to a Google access/refresh token pair without
 * picking a channel yet — a Google account can own several YouTube
 * channels (a personal one plus one or more Brand Channels), so the
 * dashboard's connect flow lists them via `listYouTubeChannels` and lets
 * the user choose, rather than defaulting to whichever channel the API
 * happens to return first.
 */
export async function exchangeCodeForGoogleTokens(
  credentials: PlatformAppCredentials,
  code: string,
  redirectUri: string,
): Promise<GoogleUserTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`YouTube OAuth token exchange failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as GoogleTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** For the YouTube connect flow's channel-picker. */
export async function listYouTubeChannels(accessToken: string): Promise<{ id: string; title: string }[]> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch YouTube channels: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as YouTubeChannelListResponse;
  return (data.items ?? []).map((c) => ({ id: c.id, title: c.snippet.title }));
}

/** Used both by the picker's "confirm selection" step and could be reused for future re-verification — looks up one specific channel by id. */
export async function findYouTubeChannelById(
  accessToken: string,
  channelId: string,
): Promise<{ externalAccountId: string; label: string }> {
  const channels = await listYouTubeChannels(accessToken);
  const channel = channels.find((c) => c.id === channelId);
  if (!channel) {
    throw new Error("This YouTube channel is no longer available for this Google account — reconnect on the Platforms page.");
  }
  return { externalAccountId: channel.id, label: channel.title };
}

/**
 * Auto-picks the first channel. The dashboard's actual YouTube connect flow
 * uses `exchangeCodeForGoogleTokens` + `listYouTubeChannels` +
 * `findYouTubeChannelById` instead so the user can choose — this is kept
 * for PlatformAdapter interface completeness.
 */
export async function exchangeYouTubeCode(
  credentials: PlatformAppCredentials,
  code: string,
  redirectUri: string,
): Promise<ExchangedTokens> {
  const tokens = await exchangeCodeForGoogleTokens(credentials, code, redirectUri);
  const channels = await listYouTubeChannels(tokens.accessToken);
  const channel = channels[0];
  if (!channel) throw new Error("No YouTube channel found for this Google account.");

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    externalAccountId: channel.id,
    label: channel.title,
  };
}

export async function refreshYouTubeAccessToken(
  credentials: PlatformAppCredentials,
  refreshToken: string,
  _externalAccountId: string,
): Promise<RefreshedTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`YouTube token refresh failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as GoogleTokenResponse;
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}
