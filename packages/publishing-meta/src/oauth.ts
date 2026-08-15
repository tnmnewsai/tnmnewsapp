import type { AuthUrlResult, ExchangedTokens, PlatformAppCredentials, RefreshedTokens } from "@svt/publishing-core";

const GRAPH_VERSION = "v21.0";
const FACEBOOK_AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
].join(",");

export function getMetaAuthUrl(credentials: PlatformAppCredentials, redirectUri: string, state: string): AuthUrlResult {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return { url: `${FACEBOOK_AUTH_URL}?${params.toString()}` };
}

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookPagesResponse {
  data: { id: string; name: string; access_token: string }[];
}

interface FacebookPageInstagramResponse {
  instagram_business_account?: { id: string; username: string };
}

async function exchangeForLongLivedToken(
  credentials: PlatformAppCredentials,
  shortLivedToken: string,
): Promise<FacebookTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`);
  if (!res.ok) throw new Error(`Meta long-lived token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as FacebookTokenResponse;
}

/**
 * Publishing goes through a Facebook Page's linked Instagram Business/Creator
 * account, not the user directly — this walks user token → first managed
 * Page → that Page's linked Instagram account, exactly what Instagram's
 * Content Publishing API requires as the target id.
 */
async function findFirstInstagramAccount(
  longLivedUserToken: string,
): Promise<{ pageAccessToken: string; instagramAccountId: string; label: string }> {
  const pagesRes = await fetch(`${GRAPH_BASE_URL}/me/accounts?access_token=${longLivedUserToken}`);
  if (!pagesRes.ok) throw new Error(`Failed to list Facebook Pages: ${pagesRes.status} ${await pagesRes.text()}`);
  const pages = (await pagesRes.json()) as FacebookPagesResponse;

  const page = pages.data[0];
  if (!page) throw new Error("No Facebook Page found for this account — connect a Page you manage first.");

  const igRes = await fetch(
    `${GRAPH_BASE_URL}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`,
  );
  if (!igRes.ok) throw new Error(`Failed to look up the Page's Instagram account: ${igRes.status} ${await igRes.text()}`);
  const igData = (await igRes.json()) as FacebookPageInstagramResponse;

  const ig = igData.instagram_business_account;
  if (!ig) {
    throw new Error(
      `Facebook Page "${page.name}" has no linked Instagram Business/Creator account. Link one in Meta ` +
        `Business Suite, then reconnect.`,
    );
  }

  return { pageAccessToken: page.access_token, instagramAccountId: ig.id, label: `${page.name} (@${ig.username})` };
}

/**
 * Publishing goes straight to a Facebook Page the user manages — no linked
 * Instagram account required, unlike `findFirstInstagramAccount` above.
 */
async function findFirstFacebookPage(
  longLivedUserToken: string,
): Promise<{ pageAccessToken: string; pageId: string; label: string }> {
  const pagesRes = await fetch(`${GRAPH_BASE_URL}/me/accounts?access_token=${longLivedUserToken}`);
  if (!pagesRes.ok) throw new Error(`Failed to list Facebook Pages: ${pagesRes.status} ${await pagesRes.text()}`);
  const pages = (await pagesRes.json()) as FacebookPagesResponse;

  const page = pages.data[0];
  if (!page) throw new Error("No Facebook Page found for this account — connect a Page you manage first.");

  return { pageAccessToken: page.access_token, pageId: page.id, label: page.name };
}

export async function exchangeMetaCode(
  credentials: PlatformAppCredentials,
  code: string,
  redirectUri: string,
): Promise<ExchangedTokens> {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    client_secret: credentials.clientSecret,
    code,
  });
  const shortLivedRes = await fetch(`${GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`);
  if (!shortLivedRes.ok) {
    throw new Error(`Meta OAuth token exchange failed: ${shortLivedRes.status} ${await shortLivedRes.text()}`);
  }
  const shortLived = (await shortLivedRes.json()) as FacebookTokenResponse;

  const longLived = await exchangeForLongLivedToken(credentials, shortLived.access_token);
  const { pageAccessToken, instagramAccountId, label } = await findFirstInstagramAccount(longLived.access_token);

  return {
    accessToken: pageAccessToken,
    // Meta has no separate refresh-token grant — re-exchanging the current
    // long-lived token via fb_exchange_token is how you get a fresh one, so
    // the "refresh token" here is just the long-lived user token itself.
    refreshToken: longLived.access_token,
    expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : undefined,
    externalAccountId: instagramAccountId,
    label,
  };
}

export async function refreshMetaAccessToken(
  credentials: PlatformAppCredentials,
  refreshToken: string,
): Promise<RefreshedTokens> {
  const longLived = await exchangeForLongLivedToken(credentials, refreshToken);
  const { pageAccessToken } = await findFirstInstagramAccount(longLived.access_token);
  return {
    accessToken: pageAccessToken,
    expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : undefined,
  };
}

/**
 * Same OAuth dialog/scopes as Instagram (`getMetaAuthUrl` is reused directly
 * for the Facebook connect flow too) — this only differs in what it walks
 * the resulting user token into: a Page directly, not that Page's linked
 * Instagram account.
 */
export async function exchangeFacebookCode(
  credentials: PlatformAppCredentials,
  code: string,
  redirectUri: string,
): Promise<ExchangedTokens> {
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    client_secret: credentials.clientSecret,
    code,
  });
  const shortLivedRes = await fetch(`${GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`);
  if (!shortLivedRes.ok) {
    throw new Error(`Facebook OAuth token exchange failed: ${shortLivedRes.status} ${await shortLivedRes.text()}`);
  }
  const shortLived = (await shortLivedRes.json()) as FacebookTokenResponse;

  const longLived = await exchangeForLongLivedToken(credentials, shortLived.access_token);
  const { pageAccessToken, pageId, label } = await findFirstFacebookPage(longLived.access_token);

  return {
    accessToken: pageAccessToken,
    refreshToken: longLived.access_token,
    expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : undefined,
    externalAccountId: pageId,
    label,
  };
}

export async function refreshFacebookAccessToken(
  credentials: PlatformAppCredentials,
  refreshToken: string,
): Promise<RefreshedTokens> {
  const longLived = await exchangeForLongLivedToken(credentials, refreshToken);
  const { pageAccessToken } = await findFirstFacebookPage(longLived.access_token);
  return {
    accessToken: pageAccessToken,
    expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : undefined,
  };
}
