import ImageUpload from "@/components/forms/ImageUpload";
import AdminForm from "@/components/admin/AdminForm";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { AdminSaveState } from "@/lib/adminFormState";
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
  action: (state: AdminSaveState, formData: FormData) => Promise<AdminSaveState>;
}) {
  return (
    <AdminForm action={action} submitClassName={primaryButtonClass}>
      <div>
        <label htmlFor="tournament-name" className={labelClass}>Ad</label>
        <input id="tournament-name" name="name" required defaultValue={tournament?.name} className={inputClass} />
      </div>
      <div>
        <label htmlFor="tournament-slug" className={labelClass}>Slug (boş buraxsanız addan yaradılır)</label>
        <input id="tournament-slug" name="slug" defaultValue={tournament?.slug} className={inputClass} />
      </div>
      <div>
        <label htmlFor="tournament-gameId" className={labelClass}>Oyun</label>
        <select id="tournament-gameId" name="gameId" required defaultValue={tournament?.gameId} className={inputClass}>
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
        <label htmlFor="tournament-tier" className={labelClass}>Səviyyə</label>
        <select id="tournament-tier" name="tier" defaultValue={tournament?.tier ?? "B"} className={inputClass}>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="tournament-startDate" className={labelClass}>Başlama tarixi</label>
          <input
            id="tournament-startDate"
            name="startDate"
            type="date"
            required
            defaultValue={toDateInputValue(tournament?.startDate)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="tournament-endDate" className={labelClass}>Bitmə tarixi</label>
          <input
            id="tournament-endDate"
            name="endDate"
            type="date"
            required
            defaultValue={toDateInputValue(tournament?.endDate)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="tournament-location" className={labelClass}>Məkan</label>
        <input id="tournament-location" name="location" defaultValue={tournament?.location ?? ""} className={inputClass} />
      </div>
      <div>
        <label htmlFor="tournament-prizePool" className={labelClass}>Mükafat fondu</label>
        <input id="tournament-prizePool" name="prizePool" defaultValue={tournament?.prizePool ?? ""} className={inputClass} placeholder="$100,000" />
      </div>
      <div>
        <label htmlFor="tournament-format" className={labelClass}>Format</label>
        <input id="tournament-format" name="format" defaultValue={tournament?.format ?? ""} className={inputClass} placeholder="Single elimination" />
      </div>
      <div>
        <label htmlFor="tournament-status" className={labelClass}>Status</label>
        <select id="tournament-status" name="status" defaultValue={tournament?.status ?? "UPCOMING"} className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </AdminForm>
  );
}
