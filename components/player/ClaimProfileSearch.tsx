"use client";

import { useActionState, useState } from "react";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin/formStyles";
import {
  searchClaimableProfiles,
  submitProfileClaim,
  type ClaimSearchState,
  type ClaimSubmitState,
} from "@/app/player/(dashboard)/claim/actions";

/**
 * Bir profil üçün müraciət forması.
 *
 * Ayrıca komponentdir, çünki `useActionState` nəticələr döngüsünün içində
 * çağırıla bilməz — hər sətrin öz vəziyyəti olmalıdır.
 */
function ClaimForm({ playerId }: { playerId: string }) {
  const [state, action, pending] = useActionState<ClaimSubmitState, FormData>(
    submitProfileClaim.bind(null, playerId),
    undefined,
  );

  return (
    <form action={action} className="mt-3 space-y-2">
      <label className="block text-xs text-foreground-muted">
        Bunun sizin profiliniz olduğunu necə təsdiqləyə bilərik? Sosial hesab linki, komanda yoldaşının adı,
        turnir səhifəsi — admin buna baxıb qərar verəcək.
      </label>
      <textarea name="message" required minLength={10} rows={3} className={inputClass} />
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Göndərilir…" : "Müraciət göndər"}
      </button>
      <div aria-live="polite">
        {!pending && state?.error && (
          <p className="rounded-md border border-live/40 bg-live/10 px-3 py-2 text-sm text-live">{state.error}</p>
        )}
        {!pending && state?.ok && (
          <p className="rounded-md border border-positive/40 bg-positive/10 px-3 py-2 text-sm text-positive">
            Müraciət göndərildi ✓ — yuxarıdakı «Müraciətlərim» siyahısında izləyə bilərsiniz.
          </p>
        )}
      </div>
    </form>
  );
}

export default function ClaimProfileSearch() {
  const [state, formAction, pending] = useActionState<ClaimSearchState | undefined, FormData>(
    searchClaimableProfiles,
    undefined,
  );
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <form action={formAction} className="flex gap-2">
        <input name="query" required autoComplete="off" placeholder="nickname" className={inputClass} />
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {pending ? "Axtarılır…" : "Axtar"}
        </button>
      </form>

      {state?.error && (
        <p className="mt-3 rounded-md border border-live/40 bg-live/10 px-3 py-2 text-sm text-live">{state.error}</p>
      )}

      <div className="mt-3 space-y-2">
        {state?.results?.map((p) => (
          <div key={p.id} className="rounded-md border border-border-subtle bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PlayerAvatar name={p.nickname} photoUrl={p.photoUrl} size={32} />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <CountryFlag code={p.country} />
                    {p.nickname}
                  </div>
                  <div className="text-xs text-foreground-muted">{p.team ?? "komandasız"}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(selected === p.id ? null : p.id)}
                className={secondaryButtonClass}
              >
                {selected === p.id ? "Bağla" : "Bu mənəm"}
              </button>
            </div>

            {selected === p.id && <ClaimForm playerId={p.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
