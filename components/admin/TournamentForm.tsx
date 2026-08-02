import ImageUpload from "@/components/forms/ImageUpload";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { Tournament, Game } from "@/app/generated/prisma/client";

const TIERS = ["S", "A", "B", "C"] as const;
const STATUSES = ["UPCOMING", "ONGOING", "FINISHED"] as const;

function toDateInputValue(date?: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export default function TournamentForm({
  tournament,
  games,
  action,
}: {
  tournament?: Tournament;
  games: Game[];
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      <div>
        <label className={labelClass}>Ad</label>
        <input name="name" required defaultValue={tournament?.name} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Slug (boş buraxsanız addan yaradılır)</label>
        <input name="slug" defaultValue={tournament?.slug} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Oyun</label>
        <select name="gameId" required defaultValue={tournament?.gameId} className={inputClass}>
          <option value="">Seçin</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <ImageUpload name="logoUrl" label="Loqo" defaultValue={tournament?.logoUrl} />
      <div>
        <label className={labelClass}>Səviyyə</label>
        <select name="tier" defaultValue={tournament?.tier ?? "B"} className={inputClass}>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Başlama tarixi</label>
          <input
            name="startDate"
            type="date"
            required
            defaultValue={toDateInputValue(tournament?.startDate)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Bitmə tarixi</label>
          <input
            name="endDate"
            type="date"
            required
            defaultValue={toDateInputValue(tournament?.endDate)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Məkan</label>
        <input name="location" defaultValue={tournament?.location ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Mükafat fondu</label>
        <input name="prizePool" defaultValue={tournament?.prizePool ?? ""} className={inputClass} placeholder="$100,000" />
      </div>
      <div>
        <label className={labelClass}>Format</label>
        <input name="format" defaultValue={tournament?.format ?? ""} className={inputClass} placeholder="Single elimination" />
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select name="status" defaultValue={tournament?.status ?? "UPCOMING"} className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
