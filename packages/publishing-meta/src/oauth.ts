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

export interface LongLivedUserToken {
  accessToken: string;
  expiresAt?: Date;
}

/**
 * Walks an OAuth `code` all the way to a long-lived user token, without
 * picking any specific Page/Instagram account yet — shared by the two
 * auto-pick-first exchange functions below, and by the Facebook connect
 * flow's Page-picker (which needs the raw user token to list all of the
 * user's Pages before the caller chooses one).
 */
export async function exchangeCodeForUserToken(
  credentials: PlatformAppCredentials,
  code: string,
  redirectUri: string,
): Promise<LongLivedUserToken> {
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
  return {
    accessToken: longLived.access_token,
    expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : undefined,
  };
}

async function listPagesWithTokens(
  longLivedUserToken: string,
): Promise<{ id: string; name: string; access_token: string }[]> {
  const pagesRes = await fetch(`${GRAPH_BASE_URL}/me/accounts?access_token=${longLivedUserToken}`);
  if (!pagesRes.ok) throw new Error(`Failed to list Facebook Pages: ${pagesRes.status} ${await pagesRes.text()}`);
  const pages = (await pagesRes.json()) as FacebookPagesResponse;
  return pages.data;
}

/** For the Facebook connect flow's Page-picker — no access tokens exposed to the caller, just what's needed to display a choice. */
export async function listFacebookPages(longLivedUserToken: string): Promise<{ id: string; name: string }[]> {
  const pages = await listPagesWithTokens(longLivedUserToken);
  return pages.map((p) => ({ id: p.id, name: p.name }));
}

async function instagramAccountForPage(
  page: { id: string; name: string; access_token: string },
): Promise<{ pageAccessToken: string; instagramAccountId: string; label: string } | null> {
  const igRes = await fetch(
    `${GRAPH_BASE_URL}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`,
  );
  if (!igRes.ok) throw new Error(`Failed to look up the Page's Instagram account: ${igRes.status} ${await igRes.text()}`);
  const igData = (await igRes.json()) as FacebookPageInstagramResponse;

  const ig = igData.instagram_business_account;
  if (!ig) return null;
  return { pageAccessToken: page.access_token, instagramAccountId: ig.id, label: `${page.name} (@${ig.username})` };
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
  const pages = await listPagesWithTokens(longLivedUserToken);
  const page = pages[0];
  if (!page) throw new Error("No Facebook Page found for this account — connect a Page you manage first.");

  const found = await instagramAccountForPage(page);
  if (!found) {
    throw new Error(
      `Facebook Page "${page.name}" has no linked Instagram Business/Creator account. Link one in Meta ` +
        `Business Suite, then reconnect.`,
    );
  }
  return found;
}

/**
 * Used on refresh, once an Instagram account is already connected — re-finds
 * that SAME account by id rather than re-picking "the first Page's IG
 * account", which could silently drift to a different account if the user
 * manages more than one Page (see PlatformAdapter.refreshAccessToken).
 */
async function findInstagramAccountById(
  longLivedUserToken: string,
  instagramAccountId: string,
): Promise<{ pageAccessToken: string; instagramAccountId: string; label: string }> {
  const pages = await listPagesWithTokens(longLivedUserToken);
  for (const page of pages) {
    const found = await instagramAccountForPage(page);
    if (found?.instagramAccountId === instagramAccountId) return found;
  }
  throw new Error(
    "This Instagram account is no longer linked to any Facebook Page you manage — reconnect on the Platforms page.",
  );
}

/**
 * Publishing goes straight to a Facebook Page the user manages — no linked
 * Instagram account required, unlike `findFirstInstagramAccount` above.
 */
async function findFirstFacebookPage(
  longLivedUserToken: string,
): Promise<{ pageAccessToken: string; pageId: string; label: string }> {
  const pages = await listPagesWithTokens(longLivedUserToken);
  const page = pages[0];
  if (!page) throw new Error("No Facebook Page found for this account — connect a Page you manage first.");

  return { pageAccessToken: page.access_token, pageId: page.id, label: page.name };
}

/**
 * Used both by the Page-picker's "confirm selection" step (initial connect)
 * and by refresh (re-targeting the already-connected Page) — looks up one
 * specific Page by id instead of assuming "the first one".
 */
export async function findFacebookPageById(
  longLivedUserToken: string,
  pageId: string,
): Promise<{ pageAccessToken: string; pageId: string; label: string }> {
  const pages = await listPagesWithTokens(longLivedUserToken);
  const page = pages.find((p) => p.id === pageId);
  if (!page) {
    throw new Error("This Facebook Page is no longer available to this account — reconnect on the Platforms page.");
  }
  return { pageAccessToken: page.access_token, pageId: page.id, label: page.name };
}

export async function exchangeMetaCode(
  credentials: PlatformAppCredentials,
  code: string,
  redirectUri: string,
): Promise<ExchangedTokens> {
  const longLived = await exchangeCodeForUserToken(credentials, code, redirectUri);
  const { pageAccessToken, instagramAccountId, label } = await findFirstInstagramAccount(longLived.accessToken);

  return {
    accessToken: pageAccessToken,
    // Meta has no separate refresh-token grant — re-exchanging the current
    // long-lived token via fb_exchange_token is how you get a fresh one, so
    // the "refresh token" here is just the long-lived user token itself.
    refreshToken: longLived.accessToken,
    expiresAt: longLived.expiresAt,
    externalAccountId: instagramAccountId,
    label,
  };
}

export async function refreshMetaAccessToken(
  credentials: PlatformAppCredentials,
  refreshToken: string,
  externalAccountId: string,
): Promise<RefreshedTokens> {
  const longLived = await exchangeForLongLivedToken(credentials, refreshToken);
  const { pageAccessToken } = await findInstagramAccountById(longLived.access_token, externalAccountId);
  return {
    accessToken: pageAccessToken,
    expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : undefined,
  };
}

/**
 * Same OAuth dialog/scopes as Instagram (`getMetaAuthUrl` is reused directly
 * for the Facebook connect flow too) — this only differs in what it walks
 * the resulting user token into: a Page directly, not that Page's linked
 * Instagram account. Auto-picks the first Page; the dashboard's actual
 * Facebook connect flow uses `exchangeCodeForUserToken` + `listFacebookPages`
 * + `findFacebookPageById` instead so the user can choose — this is kept for
 * PlatformAdapter interface completeness (and reused by tests/tools that
 * want a one-call connect with no picker).
 */
export async function exchangeFacebookCode(
  credentials: PlatformAppCredentials,
  code: string,
  redirectUri: string,
): Promise<ExchangedTokens> {
  const longLived = await exchangeCodeForUserToken(credentials, code, redirectUri);
  const { pageAccessToken, pageId, label } = await findFirstFacebookPage(longLived.accessToken);

  return {
    accessToken: pageAccessToken,
    refreshToken: longLived.accessToken,
    expiresAt: longLived.expiresAt,
    externalAccountId: pageId,
    label,
  };
}

export async function refreshFacebookAccessToken(
  credentials: PlatformAppCredentials,
  refreshToken: string,
  externalAccountId: string,
): Promise<RefreshedTokens> {
  const longLived = await exchangeForLongLivedToken(credentials, refreshToken);
  const { pageAccessToken } = await findFacebookPageById(longLived.access_token, externalAccountId);
  return {
    accessToken: pageAccessToken,
    expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : undefined,
  };
}
