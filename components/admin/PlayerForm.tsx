import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import { parseSocials } from "@/lib/socials";
import type { Player, Team, Game } from "@/app/generated/prisma/client";

const STATUSES = ["ACTIVE", "BENCHED", "RETIRED"] as const;

export default function PlayerForm({
  player,
  teams,
  games,
  currentTeamId,
  action,
}: {
  player?: Player;
  teams: Team[];
  games: Game[];
  currentTeamId?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const socials = parseSocials(player?.socials);

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
        <label className={labelClass}>Komanda</label>
        <select name="teamId" defaultValue={currentTeamId ?? ""} className={inputClass}>
          <option value="">— komandasız —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Oyun (komandasız oyunçu üçün)</label>
        <select name="gameId" defaultValue={player?.gameId ?? ""} className={inputClass}>
          <option value="">Seçin</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Rol</label>
        <input name="role" defaultValue={player?.role ?? ""} className={inputClass} placeholder="IGL, AWPer..." />
      </div>
      <div>
        <label className={labelClass}>Ölkə</label>
        <CountrySelect defaultValue={player?.country} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select name="status" defaultValue={player?.status ?? "ACTIVE"} className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <ImageUpload name="photoUrl" label="Şəkil" defaultValue={player?.photoUrl} />

      <div>
        <p className={labelClass}>Sosial linklər</p>
        <div className="space-y-2">
          <input name="social_instagram" defaultValue={socials.instagram ?? ""} placeholder="Instagram URL" className={inputClass} />
          <input name="social_twitter" defaultValue={socials.twitter ?? ""} placeholder="X / Twitter URL" className={inputClass} />
          <input name="social_faceit" defaultValue={socials.faceit ?? ""} placeholder="Faceit URL" className={inputClass} />
          <input name="social_twitch" defaultValue={socials.twitch ?? ""} placeholder="Twitch URL" className={inputClass} />
        </div>
      </div>

      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
