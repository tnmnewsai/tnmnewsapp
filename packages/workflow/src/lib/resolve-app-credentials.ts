import { prisma } from "@svt/db";
import { decryptToken } from "@svt/publishing-core";
import type { Platform, PlatformAppCredentials } from "@svt/publishing-core";

/** Legacy fallback so an env-var-configured deployment keeps working unchanged. */
const ENV_FALLBACK: Record<Platform, { id: string; secret: string }> = {
  YOUTUBE: { id: "GOOGLE_OAUTH_CLIENT_ID", secret: "GOOGLE_OAUTH_CLIENT_SECRET" },
  META: { id: "META_APP_ID", secret: "META_APP_SECRET" },
  TIKTOK: { id: "TIKTOK_CLIENT_KEY", secret: "TIKTOK_CLIENT_SECRET" },
  X: { id: "X_CLIENT_ID", secret: "X_CLIENT_SECRET" },
};

const PLATFORM_LABEL: Record<Platform, string> = {
  YOUTUBE: "YouTube (Google Cloud OAuth client)",
  META: "Meta",
  TIKTOK: "TikTok",
  X: "X",
};

/**
 * DB-stored credentials (entered on the Platforms page) take priority over
 * env vars — the env vars remain a valid fallback for anyone who configured
 * this app before the Platforms-page UI existed, or prefers env-based config.
 */
export async function resolvePlatformAppCredentials(
  accountId: string,
  platform: Platform,
): Promise<PlatformAppCredentials> {
  const stored = await prisma.platformAppCredential.findUnique({
    where: { accountId_platform: { accountId, platform } },
  });
  if (stored) {
    return { clientId: decryptToken(stored.clientIdEnc), clientSecret: decryptToken(stored.clientSecretEnc) };
  }

  const envNames = ENV_FALLBACK[platform];
  const clientId = process.env[envNames.id];
  const clientSecret = process.env[envNames.secret];
  if (!clientId || !clientSecret) {
    throw new Error(
      `No ${PLATFORM_LABEL[platform]} app credentials configured. Add them on the Platforms page, ` +
        `or set ${envNames.id}/${envNames.secret} in .env.`,
    );
  }
  return { clientId, clientSecret };
}
