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

async function fetchChannelInfo(accessToken: string): Promise<{ externalAccountId: string; label: string }> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch YouTube channel info: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as YouTubeChannelListResponse;
  const channel = data.items?.[0];
  if (!channel) throw new Error("No YouTube channel found for this Google account.");
  return { externalAccountId: channel.id, label: channel.snippet.title };
}

export async function exchangeYouTubeCode(
  credentials: PlatformAppCredentials,
  code: string,
  redirectUri: string,
): Promise<ExchangedTokens> {
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
  const { externalAccountId, label } = await fetchChannelInfo(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    externalAccountId,
    label,
  };
}

export async function refreshYouTubeAccessToken(
  credentials: PlatformAppCredentials,
  refreshToken: string,
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
