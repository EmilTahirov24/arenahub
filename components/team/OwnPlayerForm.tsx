"use client";

import { useActionState } from "react";
import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import MembershipFields from "@/components/team/MembershipFields";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { CreatePlayerState } from "@/app/player/(dashboard)/team/roster/actions";
import type { Player, TeamMembership } from "@/app/generated/prisma/client";

const STATUSES = ["ACTIVE", "BENCHED", "RETIRED"] as const;

export default function OwnPlayerForm({
  player,
  membership,
  action,
}: {
  player?: Player;
  membership?: TeamMembership;
  action: (prevState: CreatePlayerState, formData: FormData) => Promise<CreatePlayerState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      {state?.error && (
        <p className="rounded-md border border-live/40 bg-live/10 px-3 py-2 text-sm text-live">{state.error}</p>
      )}
      <div>
        <label htmlFor="own-player-nickname" className={labelClass}>Nickname</label>
        <input id="own-player-nickname" name="nickname" required defaultValue={player?.nickname} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="own-player-firstName" className={labelClass}>Ad</label>
          <input id="own-player-firstName" name="firstName" defaultValue={player?.firstName ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="own-player-lastName" className={labelClass}>Soyad</label>
          <input id="own-player-lastName" name="lastName" defaultValue={player?.lastName ?? ""} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="own-player-role" className={labelClass}>Rol</label>
        <input id="own-player-role" name="role" defaultValue={player?.role ?? ""} className={inputClass} placeholder="IGL, AWPer..." />
      </div>
      <div>
        <label htmlFor="own-player-country" className={labelClass}>Ölkə</label>
        <CountrySelect id="own-player-country" defaultValue={player?.country} className={inputClass} />
      </div>
      {player && (
        <div>
          <label htmlFor="own-player-status" className={labelClass}>Status</label>
          <select id="own-player-status" name="status" defaultValue={player.status} className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
      <ImageUpload name="photoUrl" label="Şəkil" defaultValue={player?.photoUrl} />
      {membership && <MembershipFields membership={membership} />}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Yadda saxlanılır…" : "Yadda saxla"}
      </button>
    </form>
  );
}
