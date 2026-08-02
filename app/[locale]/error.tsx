"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-center px-4 py-24 text-center">
      <span className="text-6xl">⚠️</span>
      <h1 className="font-display mt-4 text-2xl font-bold">
        Xəta baş verdi <span className="text-foreground-muted">· Something went wrong</span>
      </h1>
      <p className="mt-2 max-w-md text-sm text-foreground-muted">
        Gözlənilməz bir problem yarandı. Yenidən cəhd edə bilərsiniz.
        <br />
        An unexpected error occurred. You can try again.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="brand-gradient-bg rounded-md px-5 py-2.5 text-sm font-semibold text-white"
        >
          Yenidən cəhd et · Try again
        </button>
        <a href="/" className="rounded-md border border-border-subtle px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface">
          Ana səhifə · Home
        </a>
      </div>
    </div>
  );
}
