"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePlatformAppCredentials, deletePlatformAppCredentials } from "./actions";
import styles from "./platforms.module.css";

type Platform = "YOUTUBE" | "META" | "TIKTOK" | "X";

interface PlatformCredentialRow {
  platform: Platform;
  label: string;
  /** Decrypted Client ID if one is configured — never the secret, that's write-only from here. */
  configuredClientId: string | null;
}

function CredentialRow({ platform, label, configuredClientId }: PlatformCredentialRow) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [editing, setEditing] = useState(!configuredClientId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await savePlatformAppCredentials(platform, clientId, clientSecret);
        setClientId("");
        setClientSecret("");
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function clear() {
    setError(null);
    startTransition(async () => {
      await deletePlatformAppCredentials(platform);
      router.refresh();
    });
  }

  return (
    <div className={styles.credentialRow}>
      <div className={styles.credentialHeader}>
        <span className={styles.label}>{label}</span>
        {configuredClientId ? (
          <span className={styles.badge}>configured ({configuredClientId})</span>
        ) : (
          <span className={styles.badge}>not configured</span>
        )}
        {!editing && (
          <button type="button" className={styles.disconnectButton} onClick={() => setEditing(true)}>
            {configuredClientId ? "Change" : "Add"}
          </button>
        )}
        {configuredClientId && (
          <button type="button" className={styles.disconnectButton} onClick={clear} disabled={pending}>
            Clear
          </button>
        )}
      </div>

      {editing && (
        <div className={styles.credentialForm}>
          <label>
            Client ID
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Client ID / App ID / Client Key"
            />
          </label>
          <label>
            Client Secret
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Client Secret / App Secret"
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.credentialFormActions}>
            <button type="button" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            {configuredClientId && (
              <button type="button" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlatformCredentialsSection({ rows }: { rows: PlatformCredentialRow[] }) {
  return (
    <div className={styles.credentialsSection}>
      {rows.map((row) => (
        <CredentialRow key={row.platform} {...row} />
      ))}
    </div>
  );
}
