import Link from "next/link";
import { cookies } from "next/headers";
import { decryptToken } from "@svt/publishing-core";
import { listYouTubeChannels } from "@svt/publishing-youtube";
import { requireCurrentBrand } from "@/lib/current-brand";
import { chooseYouTubeChannel } from "./actions";
import styles from "../../platforms.module.css";

interface PendingGoogleToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export default async function ChooseYouTubeChannelPage() {
  await requireCurrentBrand();

  const cookieStore = await cookies();
  const raw = cookieStore.get("youtube_pending_token")?.value;

  let pending: PendingGoogleToken | null = null;
  if (raw) {
    try {
      pending = JSON.parse(decryptToken(raw)) as PendingGoogleToken;
    } catch {
      pending = null;
    }
  }

  if (!pending) {
    return (
      <main className={styles.page}>
        <div className={styles.header}>
          <h1>Choose a YouTube channel</h1>
          <Link href="/platforms">Back to platforms</Link>
        </div>
        <p className={styles.error}>
          Your Google connection session expired. Reconnect to pick a channel again.
        </p>
        <a className={styles.connectButton} href="/api/platforms/youtube/connect">
          Reconnect YouTube
        </a>
      </main>
    );
  }

  const channels = await listYouTubeChannels(pending.accessToken);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Choose a YouTube channel</h1>
        <Link href="/platforms">Back to platforms</Link>
      </div>

      {channels.length === 0 ? (
        <p className={styles.error}>
          No YouTube channel found for this Google login — create one first, then try again.
        </p>
      ) : (
        <>
          <p className={styles.help}>
            This Google login has access to {channels.length} channel{channels.length === 1 ? "" : "s"} (owned or
            managed as a Brand Account). Pick the one this brand should publish to — you can reconnect later to
            switch it.
          </p>
          <ul className={styles.list}>
            {channels.map((channel) => (
              <li key={channel.id}>
                <span className={styles.label}>{channel.title}</span>
                <form action={chooseYouTubeChannel.bind(null, channel.id)}>
                  <button type="submit" className={styles.connectButton}>
                    Connect this channel
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
