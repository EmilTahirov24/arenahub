import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import SocialInputs from "@/components/players/SocialInputs";
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
        <label htmlFor="player-nickname" className={labelClass}>Nickname</label>
        <input id="player-nickname" name="nickname" required defaultValue={player?.nickname} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="player-firstName" className={labelClass}>Ad</label>
          <input id="player-firstName" name="firstName" defaultValue={player?.firstName ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="player-lastName" className={labelClass}>Soyad</label>
          <input id="player-lastName" name="lastName" defaultValue={player?.lastName ?? ""} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="player-teamId" className={labelClass}>Komanda</label>
        <select id="player-teamId" name="teamId" defaultValue={currentTeamId ?? ""} className={inputClass}>
          <option value="">— komandasız —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="player-gameId" className={labelClass}>Oyun (komandasız oyunçu üçün)</label>
        <select id="player-gameId" name="gameId" defaultValue={player?.gameId ?? ""} className={inputClass}>
          <option value="">Seçin</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="player-role" className={labelClass}>Rol</label>
        <input id="player-role" name="role" defaultValue={player?.role ?? ""} className={inputClass} placeholder="IGL, AWPer..." />
      </div>
      <div>
        <label htmlFor="player-country" className={labelClass}>Ölkə</label>
        <CountrySelect id="player-country" defaultValue={player?.country} className={inputClass} />
      </div>
      <div>
        <label htmlFor="player-status" className={labelClass}>Status</label>
        <select id="player-status" name="status" defaultValue={player?.status ?? "ACTIVE"} className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="rounded-md border border-border-subtle p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Dövr üzrə statistika
        </legend>
        <p className="mb-2 text-xs text-foreground-muted">
          Matçları ayrıca yazılmayan oyunçular üçün. Bilmirsinizsə boş buraxın — cədvəldə “—” görünür.
          Uydurma rəqəm yazmayın, bu göstəricilər real şəxsə aiddir.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="player-statMaps" className={labelClass}>Xəritə sayı</label>
            <input id="player-statMaps" name="statMaps" type="number" min="0" defaultValue={player?.statMaps ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="player-statKillsPerRound" className={labelClass}>Öldürmə / raund</label>
            <input id="player-statKillsPerRound" name="statKillsPerRound" type="number" step="0.01" min="0" defaultValue={player?.statKillsPerRound ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="player-statDeathsPerRound" className={labelClass}>Ölüm / raund</label>
            <input id="player-statDeathsPerRound" name="statDeathsPerRound" type="number" step="0.01" min="0" defaultValue={player?.statDeathsPerRound ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="player-statDamagePerRound" className={labelClass}>Zərər / raund (ADR)</label>
            <input id="player-statDamagePerRound" name="statDamagePerRound" type="number" step="0.01" min="0" defaultValue={player?.statDamagePerRound ?? ""} className={inputClass} />
          </div>
        </div>
      </fieldset>

      <ImageUpload name="photoUrl" label="Şəkil" defaultValue={player?.photoUrl} />

      <SocialInputs socials={socials} />

      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
