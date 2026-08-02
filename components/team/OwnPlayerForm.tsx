import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { Player } from "@/app/generated/prisma/client";

const STATUSES = ["ACTIVE", "BENCHED", "RETIRED"] as const;

export default function OwnPlayerForm({
  player,
  action,
}: {
  player?: Player;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      <div>
        <label className={labelClass}>Nickname</label>
        <input name="nickname" required defaultValue={player?.nickname} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Ad</label>
          <input name="firstName" defaultValue={player?.firstName ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Soyad</label>
          <input name="lastName" defaultValue={player?.lastName ?? ""} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Rol</label>
        <input name="role" defaultValue={player?.role ?? ""} className={inputClass} placeholder="IGL, AWPer..." />
      </div>
      <div>
        <label className={labelClass}>Ölkə</label>
        <CountrySelect defaultValue={player?.country} className={inputClass} />
      </div>
      {player && (
        <div>
          <label className={labelClass}>Status</label>
          <select name="status" defaultValue={player.status} className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
      <ImageUpload name="photoUrl" label="Şəkil" defaultValue={player?.photoUrl} />
      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
