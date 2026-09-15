"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * The player panel's own error boundary.
 *
 * The invite, roster and ownership operations `throw` when a rule is broken -
 * an expired invite, already being on another team's roster, an owner trying
 * to leave their own team. These are ordinary mistakes people make, so there
 * has to be a way back from here at the very least.
 */
export default function PlayerError({
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
        Bu addım yerinə yetirilmədi — ola bilsin şərtlərdən biri artıq dəyişib
        (məsələn dəvətin vaxtı keçib, ya da artıq başqa komandadasınız).
      </p>
      <p className="mt-2 max-w-md text-xs text-foreground-muted">
        Təkrarlanırsa, sessiyanız bitmiş ola bilər — yenidən daxil olun.
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
          href="/player"
          className="rounded-md border border-border-subtle px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface"
        >
          Panelə qayıt
        </Link>
        <Link
          href="/"
          className="rounded-md border border-border-subtle px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface"
        >
          Sayta qayıt
        </Link>
      </div>
    </div>
  );
}
