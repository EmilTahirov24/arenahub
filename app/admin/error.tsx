"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Admin panelinin öz xəta sərhəddi.
 *
 * Bu paneldəki əməliyyatların çoxu səhv gedəndə `throw` edir — sahibi qeydiyyatlı
 * olmayan komanda, şəkilsiz reklam, öz hesabını silmək cəhdi, bitmiş sessiya.
 * Ayrıca sərhəd olmayanda bunların hamısı kökdəki çılpaq ekrana düşürdü: nə
 * panelə qayıtmaq üçün link vardı, nə də nə baş verdiyinə dair işarə.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <span className="text-5xl">⚠️</span>
      <h1 className="font-display mt-4 text-xl font-bold">Əməliyyat tamamlanmadı</h1>
      <p className="mt-2 max-w-md text-sm text-foreground-muted">
        Bu əməliyyat yerinə yetirilmədi. Yenidən cəhd edə, ya da panelə qayıdıb başqa
        yoldan davam edə bilərsiniz.
      </p>
      <p className="mt-2 max-w-md text-xs text-foreground-muted">
        Təkrarlanırsa, çox güman sessiyanız bitib — yenidən daxil olun.
      </p>

      {error.digest && <p className="mt-3 font-mono text-xs text-foreground-muted">kod: {error.digest}</p>}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="brand-gradient-bg rounded-md px-5 py-2.5 text-sm font-semibold text-white"
        >
          Yenidən cəhd et
        </button>
        <Link
          href="/admin"
          className="rounded-md border border-border-subtle px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface"
        >
          Panelə qayıt
        </Link>
        <Link
          href="/admin/login"
          className="rounded-md border border-border-subtle px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface"
        >
          Yenidən daxil ol
        </Link>
      </div>
    </div>
  );
}
