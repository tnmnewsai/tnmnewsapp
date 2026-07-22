"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Polls the server every few seconds while a source is still being fetched/transcribed. */
export default function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
