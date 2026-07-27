"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectPlatformAccount } from "./actions";
import styles from "./platforms.module.css";

export default function DisconnectButton({ platformAccountId }: { platformAccountId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function disconnect() {
    startTransition(async () => {
      await disconnectPlatformAccount(platformAccountId);
      router.refresh();
    });
  }

  return (
    <button type="button" className={styles.disconnectButton} onClick={disconnect} disabled={pending}>
      {pending ? "…" : "Disconnect"}
    </button>
  );
}
