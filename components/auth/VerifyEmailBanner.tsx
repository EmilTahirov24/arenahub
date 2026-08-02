"use client";

import { useActionState, useEffect, useState } from "react";

type ResendState = { waitSeconds: number };
type ResendAction = (prevState: ResendState | undefined, formData: FormData) => Promise<ResendState>;

function formatWait(seconds: number) {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} dəq`;
  }
  return `${seconds} san`;
}

export default function VerifyEmailBanner({ action, initialWaitSeconds }: { action: ResendAction; initialWaitSeconds: number }) {
  const [state, formAction, pending] = useActionState(action, { waitSeconds: initialWaitSeconds });
  const [secondsLeft, setSecondsLeft] = useState(state.waitSeconds);

  useEffect(() => {
    setSecondsLeft(state.waitSeconds);
  }, [state.waitSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const disabled = pending || secondsLeft > 0;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
      <span>Emailiniz hələ təsdiqlənməyib. Poçt qutunuzu yoxlayın.</span>
      <form action={formAction}>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md border border-amber-500/40 px-3 py-1 text-xs font-semibold hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Göndərilir..."
            : secondsLeft > 0
              ? `Yenidən göndər (${formatWait(secondsLeft)})`
              : "Təsdiq linkini yenidən göndər"}
        </button>
      </form>
    </div>
  );
}
