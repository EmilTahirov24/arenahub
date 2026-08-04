"use client";

import { useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ResendState = { waitSeconds: number; failed?: boolean };
type ResendAction = (prevState: ResendState | undefined, formData: FormData) => Promise<ResendState>;

function formatWait(seconds: number) {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} dəq`;
  }
  return `${seconds} san`;
}

export default function VerifyEmailBanner({ action, initialWaitSeconds }: { action: ResendAction; initialWaitSeconds: number }) {
  // Registration redirects to /player?mail=failed when the verification email
  // was rejected. A layout cannot read searchParams, but this banner is a
  // client component and already sits inside one, so it reads the flag itself.
  const sendFailed = useSearchParams().get("mail") === "failed";
  const [state, formAction, pending] = useActionState(action, { waitSeconds: initialWaitSeconds });
  const [secondsLeft, setSecondsLeft] = useState(state.waitSeconds);

  // Restart the countdown whenever the action reports a new wait window.
  // Adjusting state during render is React's documented alternative to a
  // sync-me effect: https://react.dev/learn/you-might-not-need-an-effect
  const [lastWaitSeconds, setLastWaitSeconds] = useState(state.waitSeconds);
  if (lastWaitSeconds !== state.waitSeconds) {
    setLastWaitSeconds(state.waitSeconds);
    setSecondsLeft(state.waitSeconds);
  }

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const disabled = pending || secondsLeft > 0;
  // Either the signup send failed, or the last resend did.
  const failed = sendFailed || state.failed === true;

  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-3 text-sm ${
        failed ? "border-live/30 bg-live/10 text-live" : "border-warning/30 bg-warning/10 text-warning"
      }`}
    >
      <span>
        {failed
          ? "Təsdiq məktubu göndərilə bilmədi. Bir az sonra yenidən cəhd edin — problem davam edərsə bizə yazın."
          : "Emailiniz hələ təsdiqlənməyib. Poçt qutunuzu yoxlayın."}
      </span>
      <form action={formAction}>
        <button
          type="submit"
          disabled={disabled}
          className={`rounded-md border px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
            // The button sits inside a banner that is already a 10% wash of the
            // same colour, so a hover wash stacks on top of it and pushes the
            // text below 4.5:1. The border carries the hover instead.
            failed
              ? "border-live/40 hover:border-live/90"
              : "border-warning/40 hover:border-warning/90"
          }`}
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
