"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMusicTrack } from "./actions";
import styles from "../library.module.css";

export default function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    if (!confirm("Delete this track?")) return;
    startTransition(async () => {
      await deleteMusicTrack(id);
      router.refresh();
    });
  }

  return (
    <button type="button" className={styles.deleteButton} onClick={remove} disabled={pending}>
      Delete
    </button>
  );
}
