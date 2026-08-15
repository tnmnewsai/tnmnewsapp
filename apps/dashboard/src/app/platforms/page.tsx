import Link from "next/link";
import { prisma } from "@svt/db";
import { decryptToken } from "@svt/publishing-core";
import { requireCurrentBrand } from "@/lib/current-brand";
import DisconnectButton from "./DisconnectButton";
import PlatformCredentialsSection from "./PlatformCredentialsSection";
import AiCredentialsSection from "./AiCredentialsSection";
import styles from "./platforms.module.css";

const CREDENTIAL_PLATFORMS = [
  { platform: "YOUTUBE" as const, label: "YouTube (Google Cloud OAuth client)" },
  { platform: "META" as const, label: "Meta (Facebook App)" },
  { platform: "TIKTOK" as const, label: "TikTok app" },
  { platform: "X" as const, label: "X app" },
];

const AI_PROVIDERS = [
  { provider: "OPENAI" as const, label: "OpenAI (transcription, narration voice)" },
  { provider: "ANTHROPIC" as const, label: "Anthropic (clip detection, post copy, video scripts)" },
];

export default async function PlatformsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const brand = await requireCurrentBrand();
  const { connected, error } = await searchParams;

  const [accounts, storedCredentials, storedAiCredentials] = await Promise.all([
    prisma.platformAccount.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.platformAppCredential.findMany({ where: { accountId: brand.accountId } }),
    prisma.aiProviderCredential.findMany({ where: { accountId: brand.accountId } }),
  ]);

  const credentialRows = CREDENTIAL_PLATFORMS.map(({ platform, label }) => {
    const stored = storedCredentials.find((c) => c.platform === platform);
    return {
      platform,
      label,
      configuredClientId: stored ? decryptToken(stored.clientIdEnc) : null,
    };
  });

  const aiCredentialRows = AI_PROVIDERS.map(({ provider, label }) => ({
    provider,
    label,
    configured: storedAiCredentials.some((c) => c.provider === provider),
  }));

  const hasConnectedYouTube = accounts.some((a) => a.platform === "YOUTUBE" && a.status === "CONNECTED");
  const hasConnectedMeta = accounts.some((a) => a.platform === "META" && a.status === "CONNECTED");
  const hasConnectedFacebook = accounts.some((a) => a.platform === "FACEBOOK" && a.status === "CONNECTED");
  const hasConnectedTikTok = accounts.some((a) => a.platform === "TIKTOK" && a.status === "CONNECTED");
  const hasConnectedX = accounts.some((a) => a.platform === "X" && a.status === "CONNECTED");

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Connected platforms</h1>
        <Link href="/sources">Back to sources</Link>
      </div>

      {connected && <p className={styles.success}>Connected {connected}.</p>}
      {error && <p className={styles.error}>{decodeURIComponent(error)}</p>}

      {accounts.length > 0 && (
        <ul className={styles.list}>
          {accounts.map((a) => (
            <li key={a.id}>
              <span className={styles.badge}>{a.platform}</span>
              <span className={styles.label}>{a.label}</span>
              <span className={styles.badge}>{a.status}</span>
              {a.status === "CONNECTED" && <DisconnectButton platformAccountId={a.id} />}
            </li>
          ))}
        </ul>
      )}

      <h2>Developer app credentials</h2>
      <p className={styles.help}>
        One Client ID/Secret per platform, shared by every brand under this account — register an app in
        each platform&apos;s developer console, then paste its credentials here so the Connect buttons below
        work without editing .env files. The Meta App credentials below back both the Instagram and
        Facebook connect buttons — no separate Facebook entry needed.
      </p>
      <PlatformCredentialsSection rows={credentialRows} />

      <h2>AI provider keys</h2>
      <p className={styles.help}>
        Required — there is no shared fallback. Add your own OpenAI and Anthropic API keys so
        transcription, clip detection, post copy, and blog-to-video generation run on your own usage and
        bill; until both are set, those features will fail with a clear error telling you which key is
        missing.
      </p>
      <AiCredentialsSection rows={aiCredentialRows} />

      <div className={styles.connectSection}>
        {!hasConnectedYouTube && (
          <a className={styles.connectButton} href="/api/platforms/youtube/connect">
            Connect YouTube
          </a>
        )}
        {!hasConnectedMeta && (
          <a className={styles.connectButton} href="/api/platforms/meta/connect">
            Connect Meta (Instagram)
          </a>
        )}
        {!hasConnectedFacebook && (
          <a className={styles.connectButton} href="/api/platforms/facebook/connect">
            Connect Facebook
          </a>
        )}
        {!hasConnectedTikTok && (
          <a className={styles.connectButton} href="/api/platforms/tiktok/connect">
            Connect TikTok
          </a>
        )}
        {!hasConnectedX && (
          <a className={styles.connectButton} href="/api/platforms/x/connect">
            Connect X
          </a>
        )}
        <p className={styles.help}>
          Meta publishes through Instagram&apos;s Content Publishing API; Facebook publishes to the first
          Page your account manages. Both require a publicly-reachable video URL — local filesystem
          storage can&apos;t provide one, so either needs STORAGE_DRIVER=s3 (R2/S3) configured. TikTok
          posts land as private (SELF_ONLY) drafts until your TikTok app passes their content-posting audit
          for public posting. X requires a paid developer tier (Basic or above) just to upload video media
          — connecting works with any tier, but publishing a post with video will fail on a Free-tier app.
        </p>
      </div>
    </main>
  );
}
