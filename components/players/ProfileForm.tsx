"use client";

import { useActionState } from "react";
import { updateOwnPlayer, type SaveProfileState } from "@/app/player/(dashboard)/actions";
import { primaryButtonClass } from "@/components/admin/formStyles";

/**
 * Wraps the profile fields so the save has something to say for itself.
 *
 * The fields stay on the server — they are passed straight through as children,
 * so the country list, the current photo and the existing values are still
 * rendered there and none of that ships to the browser. All this adds is the
 * action wiring and the line of feedback underneath.
 */
export default function ProfileForm({ children }: { children: React.ReactNode }) {
  const [state, action, pending] = useActionState<SaveProfileState | undefined, FormData>(
    updateOwnPlayer,
    undefined,
  );

  return (
    <form action={action} className="max-w-lg space-y-4">
      {children}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Yadda saxlanılır…" : "Yadda saxla"}
        </button>

        {/* aria-live so the confirmation is announced, not just painted: the
            button gives no other sign that anything happened. */}
        <span aria-live="polite" className="text-sm">
          {!pending && state?.ok && <span className="text-positive">Yadda saxlanıldı ✓</span>}
          {!pending && state?.error && <span className="text-live">{state.error}</span>}
        </span>
      </div>

      {!pending && state?.warning && (
        <p className="rounded-md border border-live/40 bg-live/10 px-3 py-2 text-sm text-live-fg">
          {state.warning}
        </p>
      )}
    </form>
  );
}
