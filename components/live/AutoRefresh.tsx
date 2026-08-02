"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Periodically re-runs the current route's server components so LIVE data (scores, status) stays fresh without a manual reload. */
export default function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
