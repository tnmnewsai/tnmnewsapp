"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAiProviderCredential, deleteAiProviderCredential } from "./actions";
import styles from "./platforms.module.css";

type AiProvider = "OPENAI" | "ANTHROPIC";

interface AiCredentialRow {
  provider: AiProvider;
  label: string;
  /** True if a key is stored — the key itself is write-only from here, never echoed back. */
  configured: boolean;
}

function CredentialRow({ provider, label, configured }: AiCredentialRow) {
  const [apiKey, setApiKey] = useState("");
  const [editing, setEditing] = useState(!configured);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveAiProviderCredential(provider, apiKey);
        setApiKey("");
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
      await deleteAiProviderCredential(provider);
      router.refresh();
    });
  }

  return (
    <div className={styles.credentialRow}>
      <div className={styles.credentialHeader}>
        <span className={styles.label}>{label}</span>
        <span className={styles.badge}>{configured ? "configured" : "not configured"}</span>
        {!editing && (
          <button type="button" className={styles.disconnectButton} onClick={() => setEditing(true)}>
            {configured ? "Change" : "Add"}
          </button>
        )}
        {configured && (
          <button type="button" className={styles.disconnectButton} onClick={clear} disabled={pending}>
            Clear
          </button>
        )}
      </div>

      {editing && (
        <div className={styles.credentialForm}>
          <label>
            API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API key"
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.credentialFormActions}>
            <button type="button" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            {configured && (
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

export default function AiCredentialsSection({ rows }: { rows: AiCredentialRow[] }) {
  return (
    <div className={styles.credentialsSection}>
      {rows.map((row) => (
        <CredentialRow key={row.provider} {...row} />
      ))}
    </div>
  );
}
