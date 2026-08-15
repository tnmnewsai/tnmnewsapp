"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrand } from "./actions";
import styles from "./admin.module.css";

/**
 * Adds another Brand (property) under this account — e.g. a second entity
 * like BecomingTKO alongside TNMN, each with fully separate platform
 * connections, content, and scheduling. Shows up in the brand switcher
 * immediately after creation.
 */
export default function CreateBrandForm({ accountId }: { accountId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className={styles.securityForm}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const form = event.currentTarget;
        const data = new FormData(form);
        const name = String(data.get("name") ?? "");
        startTransition(async () => {
          try {
            await createBrand(accountId, name);
            form.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create brand.");
          }
        });
      }}
    >
      <label>
        New brand name
        <input name="name" type="text" placeholder="e.g. BecomingTKO" required />
      </label>
      {error && <p role="alert" className={styles.formError}>{error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Creating…" : "Create brand"}</button>
    </form>
  );
}
