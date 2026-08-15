import Link from "next/link";
import { cookies } from "next/headers";
import { decryptToken } from "@svt/publishing-core";
import { listFacebookPages } from "@svt/publishing-meta";
import { requireCurrentBrand } from "@/lib/current-brand";
import { chooseFacebookPage } from "./actions";
import styles from "../../platforms.module.css";

interface PendingFacebookToken {
  accessToken: string;
  expiresAt: string | null;
}

export default async function ChooseFacebookPagePage() {
  await requireCurrentBrand();

  const cookieStore = await cookies();
  const raw = cookieStore.get("facebook_pending_token")?.value;

  let pending: PendingFacebookToken | null = null;
  if (raw) {
    try {
      pending = JSON.parse(decryptToken(raw)) as PendingFacebookToken;
    } catch {
      pending = null;
    }
  }

  if (!pending) {
    return (
      <main className={styles.page}>
        <div className={styles.header}>
          <h1>Choose a Facebook Page</h1>
          <Link href="/platforms">Back to platforms</Link>
        </div>
        <p className={styles.error}>
          Your Facebook connection session expired. Reconnect to pick a Page again.
        </p>
        <a className={styles.connectButton} href="/api/platforms/facebook/connect">
          Reconnect Facebook
        </a>
      </main>
    );
  }

  const pages = await listFacebookPages(pending.accessToken);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Choose a Facebook Page</h1>
        <Link href="/platforms">Back to platforms</Link>
      </div>

      {pages.length === 0 ? (
        <p className={styles.error}>
          No Facebook Pages found for this login — connect a Page you manage first, then try again.
        </p>
      ) : (
        <>
          <p className={styles.help}>
            This account manages {pages.length} Facebook Page{pages.length === 1 ? "" : "s"}. Pick the one this
            brand should publish to — you can reconnect later to switch it.
          </p>
          <ul className={styles.list}>
            {pages.map((page) => (
              <li key={page.id}>
                <span className={styles.label}>{page.name}</span>
                <form action={chooseFacebookPage.bind(null, page.id)}>
                  <button type="submit" className={styles.connectButton}>
                    Connect this Page
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
