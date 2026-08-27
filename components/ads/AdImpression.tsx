"use client";

import { useEffect, useRef } from "react";

/**
 * Banner ekranda görünəndə bir dəfə "göründü" siqnalı göndərir.
 *
 * Ölçü reklam sənayesinin adi tərifidir: sahənin ən azı yarısı, ən azı bir
 * saniyə fasiləsiz görünməlidir. Sadəcə səhifəyə düşməsi kifayət deyil —
 * ziyarətçi aşağı sürüşdürməyibsə, o banner göstərilməyib və sayılmamalıdır.
 * Reklamçıya təqdim ediləcək rəqəm məhz bu olmalıdır.
 *
 * `sendBeacon` seçildi, çünki adam saniyə dolan kimi başqa səhifəyə keçə bilər:
 * adi `fetch` belə halda yarımçıq kəsilir, beacon isə brauzer tərəfindən
 * arxa planda çatdırılır. Cavabı gözləmirik — sayğac istifadəçini
 * ləngitməməlidir.
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
      // Beacon bəzi brauzerlərdə (və ya sayğac genişlənmələri altında) false
      // qaytara bilər; belə halda adi sorğuya düşürük, yenə də gözləmədən.
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
