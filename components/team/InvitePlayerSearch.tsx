"use client";

import { useActionState } from "react";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin/formStyles";
import { searchPlayerToInvite, sendTeamInvite, type InviteSearchState } from "@/app/player/(dashboard)/team/roster/actions";

export default function InvitePlayerSearch() {
  const [state, formAction, pending] = useActionState<InviteSearchState | undefined, FormData>(
    searchPlayerToInvite,
    undefined,
  );

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <h2 className="font-display mb-1 text-lg font-bold">Qeydiyyatlı oyunçunu dəvət et</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Oyunçunun nickname-ni və ya emailini <strong>tam</strong> yazın. Dəvəti qəbul edəndə tərkibə əlavə olunacaq.
      </p>

      <form action={formAction} className="flex gap-2">
        <input
          name="query"
          required
          autoComplete="off"
          placeholder="nickname və ya email"
          className={inputClass}
          defaultValue=""
        />
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {pending ? "Axtarılır…" : "Axtar"}
        </button>
      </form>

      {state?.error && (
        <p className="mt-3 rounded-md border border-live/40 bg-live/10 px-3 py-2 text-sm text-live-fg">{state.error}</p>
      )}

      {state?.found && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-background px-3 py-2">
          <div className="flex items-center gap-2">
            <PlayerAvatar name={state.found.nickname} photoUrl={state.found.photoUrl} size={32} />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <CountryFlag code={state.found.country} />
                {state.found.nickname}
              </div>
              {state.found.role && <div className="text-xs text-foreground-muted">{state.found.role}</div>}
            </div>
          </div>
          <form action={sendTeamInvite.bind(null, state.found.id)}>
            <button type="submit" className={primaryButtonClass}>
              Dəvət göndər
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
