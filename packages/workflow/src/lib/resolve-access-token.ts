import { prisma } from "@svt/db";
import { decryptToken, encryptToken } from "@svt/publishing-core";
import type { PlatformAdapter } from "@svt/publishing-core";
import { resolvePlatformAppCredentials } from "./resolve-app-credentials";

interface AccountForToken {
  id: string;
  externalAccountId: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | string | null;
}

/**
 * Decrypts the current access token, refreshing (and persisting the
 * refresh) first if it's expiring soon. Shared by the publish and
 * analytics-pull workflows — both need a live, valid token for the same
 * PlatformAccount, and both must persist a rotated refresh token the same
 * way (TikTok/X rotate theirs on every use; YouTube/Meta don't). Credentials
 * are only fetched when actually refreshing — a still-valid access token
 * never needs them.
 */
export async function resolveAccessToken(
  adapter: PlatformAdapter,
  account: AccountForToken,
  accountId: string,
): Promise<string> {
  let accessToken = decryptToken(account.accessTokenEnc);

  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : null;
  const expiringSoon = expiresAt !== null && expiresAt < Date.now() + 60_000;
  if (expiringSoon && account.refreshTokenEnc) {
    const credentials = await resolvePlatformAppCredentials(accountId, adapter.platform);
    const refreshed = await adapter.refreshAccessToken(
      credentials,
      decryptToken(account.refreshTokenEnc),
      account.externalAccountId,
    );
    accessToken = refreshed.accessToken;
    await prisma.platformAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEnc: encryptToken(refreshed.accessToken),
        refreshTokenEnc: refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : undefined,
        tokenExpiresAt: refreshed.expiresAt,
      },
    });
  }

  return accessToken;
}
