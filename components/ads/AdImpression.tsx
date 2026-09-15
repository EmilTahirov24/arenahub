"use client";

import { useEffect, useRef } from "react";

/**
 * Sends one "seen" signal when a banner actually appears on screen.
 *
 * The measure is the advertising industry's ordinary definition: at least half
 * the area, visible for at least one unbroken second. Merely being on the page
 * is not enough - if the visitor never scrolled down, the banner was not shown
 * and must not be counted. That is the number an advertiser should be given.
 *
 * `sendBeacon` was chosen because somebody can leave the moment the second is
 * up: a plain `fetch` gets cut off half way, while a beacon is delivered by
 * the browser in the background. The response is not awaited - a counter must
 * not slow the visitor down.
 */
export default function AdImpression({ adId }: { adId: string }) {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = anchor.current?.parentElement;
    if (!el || typeof IntersectionObserver === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let sent = false;

    const send = () => {
      if (sent) return;
      sent = true;
      observer.disconnect();
      const url = `/api/ads/${adId}/impression`;
      // Beacon can return false in some browsers (or under counter-blocking
      // extensions); then it falls back to a plain request, still unawaited.
      const ok = navigator.sendBeacon?.(url);
      if (!ok) void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer ??= setTimeout(send, 1000);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [adId]);

  return <span ref={anchor} hidden />;
}
