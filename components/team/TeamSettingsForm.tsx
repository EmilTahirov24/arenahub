"use client";

import { useActionState } from "react";
import { updateOwnTeam, type SaveTeamState } from "@/app/player/(dashboard)/team/actions";
import { primaryButtonClass } from "@/components/admin/formStyles";

/**
 * Gives the team settings save a voice — the same wrapper as
 * components/players/ProfileForm.tsx, for the same reason.
 *
 * The fields stay server-rendered and arrive as children, so the country list,
 * the current logo and the existing values are still built on the server.
 */
export default function TeamSettingsForm({ children }: { children: React.ReactNode }) {
  const [state, action, pending] = useActionState<SaveTeamState | undefined, FormData>(
    updateOwnTeam,
    undefined,
  );

  return (
    <form action={action} className="max-w-lg space-y-4">
      {children}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Yadda saxlanılır…" : "Yadda saxla"}
        </button>

        <span aria-live="polite" className="text-sm">
          {!pending && state?.ok && <span className="text-emerald-400">Yadda saxlanıldı ✓</span>}
          {!pending && state?.error && <span className="text-live">{state.error}</span>}
        </span>
      </div>
    </form>
  );
}
