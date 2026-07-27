import type { AuthUrlResult, ExchangedTokens, PlatformAppCredentials, RefreshedTokens } from "@svt/publishing-core";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";

/** video.publish is the Content Posting API scope; user.info.basic is just for the display name label. */
const SCOPES = "user.info.basic,video.publish";

export function getTikTokAuthUrl(
  credentials: PlatformAppCredentials,
  redirectUri: string,
  state: string,
): AuthUrlResult {
  const params = new URLSearchParams({
    client_key: credentials.clientId,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return { url: `${AUTH_URL}?${params.toString()}` };
}

interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface TikTokUserInfoResponse {
  data?: { user?: { display_name?: string } };
  error?: { code: string; message: string };
}

async function fetchDisplayName(accessToken: string, openId: string): Promise<string> {
  const res = await fetch(`${USER_INFO_URL}?fields=display_name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return openId; // non-fatal — fall back to the opaque id as the label
  const data = (await res.json()) as TikTokUserInfoResponse;
  return data.data?.user?.display_name ?? openId;
}

export async function exchangeTikTokCode(
  credentials: PlatformAppCredentials,
  code: string,
  redirectUri: string,
): Promise<ExchangedTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`TikTok OAuth token exchange failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as TikTokTokenResponse;
  if (data.error) throw new Error(`TikTok OAuth token exchange failed: ${data.error} ${data.error_description ?? ""}`);

  const label = await fetchDisplayName(data.access_token, data.open_id);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    externalAccountId: data.open_id,
    label,
  };
}

export async function refreshTikTokAccessToken(
  credentials: PlatformAppCredentials,
  refreshToken: string,
): Promise<RefreshedTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`TikTok token refresh failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as TikTokTokenResponse;
  if (data.error) throw new Error(`TikTok token refresh failed: ${data.error} ${data.error_description ?? ""}`);

  // TikTok rotates the refresh token on every use — the old one stops working.
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
