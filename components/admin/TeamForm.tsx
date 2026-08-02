import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { Team, Game } from "@/app/generated/prisma/client";

export default function TeamForm({
  team,
  games,
  action,
}: {
  team?: Team;
  games: Game[];
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      <div>
        <label className={labelClass}>Ad</label>
        <input name="name" required defaultValue={team?.name} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Slug (boş buraxsanız addan yaradılır)</label>
        <input name="slug" defaultValue={team?.slug} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Oyun</label>
        <select name="gameId" required defaultValue={team?.gameId} className={inputClass}>
          <option value="">Seçin</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Ölkə</label>
        <CountrySelect defaultValue={team?.country} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Dünya reytinqi</label>
        <input name="worldRanking" type="number" defaultValue={team?.worldRanking ?? ""} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Əsas rəng</label>
          <input name="primaryColor" type="color" defaultValue={team?.primaryColor ?? "#7c3aed"} className="h-10 w-full rounded-md border border-border-subtle bg-background" />
        </div>
        <div>
          <label className={labelClass}>İkinci rəng</label>
          <input name="secondaryColor" type="color" defaultValue={team?.secondaryColor ?? "#0a0b10"} className="h-10 w-full rounded-md border border-border-subtle bg-background" />
        </div>
      </div>
      <ImageUpload name="logoUrl" label="Loqo" defaultValue={team?.logoUrl} />
      <div>
        <label className={labelClass}>Təsvir</label>
        <textarea name="description" defaultValue={team?.description ?? ""} rows={3} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={team?.isActive ?? true} />
        Aktiv
      </label>
      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
