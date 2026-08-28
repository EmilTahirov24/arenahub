import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { Team, Game, Player } from "@/app/generated/prisma/client";

export default function TeamForm({
  team,
  games,
  owners,
  action,
}: {
  team?: Team;
  games: Game[];
  /** Registered accounts eligible to own a team — see loadTeamOwnerOptions. */
  owners: Pick<Player, "id" | "nickname" | "email">[];
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="team-name" className={labelClass}>Ad</label>
        <input id="team-name" name="name" required defaultValue={team?.name} className={inputClass} />
      </div>
      <div>
        <label htmlFor="team-slug" className={labelClass}>Slug (boş buraxsanız addan yaradılır)</label>
        <input id="team-slug" name="slug" defaultValue={team?.slug} className={inputClass} />
      </div>
      <div>
        <label htmlFor="team-gameId" className={labelClass}>Oyun</label>
        <select id="team-gameId" name="gameId" required defaultValue={team?.gameId} className={inputClass}>
          <option value="">Seçin</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="team-country" className={labelClass}>Ölkə</label>
        <CountrySelect id="team-country" defaultValue={team?.country} className={inputClass} />
      </div>
      <div>
        <label htmlFor="team-earnings" className={labelClass}>Qazanc ($, tam ədəd)</label>
        <input id="team-earnings" name="earnings" type="number" min="0" defaultValue={team?.earnings ?? ""} className={inputClass} />
        <p className="mt-1 text-xs text-foreground-muted">Ümumi karyera mükafat qazancı. Boş buraxsanız cədvəldə “—” görünür.</p>
      </div>
      <div>
        <label htmlFor="team-ownerId" className={labelClass}>Sahib (qeydiyyatlı oyunçu)</label>
        <select id="team-ownerId" name="ownerId" defaultValue={team?.ownerId ?? ""} className={inputClass}>
          <option value="">Sahibsiz</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nickname} — {o.email}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-foreground-muted">
          Sahib komandanı öz panelindən idarə edə bilir. Siyahıda yalnız başqa komandası olmayan hesablar var.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="team-primaryColor" className={labelClass}>Əsas rəng</label>
          <input id="team-primaryColor" name="primaryColor" type="color" defaultValue={team?.primaryColor ?? "#7c3aed"} className="h-10 w-full rounded-md border border-border-subtle bg-background" />
        </div>
        <div>
          <label htmlFor="team-secondaryColor" className={labelClass}>İkinci rəng</label>
          <input id="team-secondaryColor" name="secondaryColor" type="color" defaultValue={team?.secondaryColor ?? "#0a0b10"} className="h-10 w-full rounded-md border border-border-subtle bg-background" />
        </div>
      </div>
      <ImageUpload name="logoUrl" label="Loqo" defaultValue={team?.logoUrl} />
      <div>
        <label htmlFor="team-description" className={labelClass}>Təsvir</label>
        <textarea id="team-description" name="description" defaultValue={team?.description ?? ""} rows={3} className={inputClass} />
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
