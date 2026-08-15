import type { AuthUrlResult, ExchangedTokens, PlatformAppCredentials, RefreshedTokens } from "@svt/publishing-core";
import { generateCodeChallenge, generateCodeVerifier } from "./pkce";

const AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const USER_INFO_URL = "https://api.twitter.com/2/users/me";

const SCOPES = "tweet.read tweet.write users.read offline.access";

function basicAuthHeader(credentials: PlatformAppCredentials): string {
  return `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`;
}

export function getXAuthUrl(credentials: PlatformAppCredentials, redirectUri: string, state: string): AuthUrlResult {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return { url: `${AUTH_URL}?${params.toString()}`, codeVerifier };
}

interface XTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  scope: string;
  refresh_token?: string;
}

interface XUserResponse {
  data?: { id: string; username: string; name: string };
}

async function fetchLabel(accessToken: string): Promise<{ externalAccountId: string; label: string }> {
  const res = await fetch(USER_INFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Failed to fetch X user info: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as XUserResponse;
  if (!data.data) throw new Error("X did not return user info.");
  return { externalAccountId: data.data.id, label: `@${data.data.username}` };
}

export async function exchangeXCode(
  credentials: PlatformAppCredentials,
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<ExchangedTokens> {
  if (!codeVerifier) {
    throw new Error("Missing PKCE code_verifier — the OAuth state cookie may have expired, try connecting again.");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(credentials),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      client_id: credentials.clientId,
    }),
  });
  if (!res.ok) throw new Error(`X OAuth token exchange failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as XTokenResponse;
  const { externalAccountId, label } = await fetchLabel(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    externalAccountId,
    label,
  };
}

export async function refreshXAccessToken(
  credentials: PlatformAppCredentials,
  refreshToken: string,
  _externalAccountId: string,
): Promise<RefreshedTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(credentials),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`X token refresh failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as XTokenResponse;
  // X rotates the refresh token on every use, same as TikTok.
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
