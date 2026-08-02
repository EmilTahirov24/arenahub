import ImageUpload from "@/components/forms/ImageUpload";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { Game } from "@/app/generated/prisma/client";

export default function GameForm({
  game,
  action,
}: {
  game?: Game;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      <div>
        <label className={labelClass}>Ad</label>
        <input name="name" required defaultValue={game?.name} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Qısa ad</label>
        <input name="shortName" required defaultValue={game?.shortName} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Slug (boş buraxsanız addan yaradılır)</label>
        <input name="slug" defaultValue={game?.slug} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Aksent rəngi</label>
        <input name="accentColor" type="color" defaultValue={game?.accentColor ?? "#7c3aed"} className="h-10 w-20 rounded-md border border-border-subtle bg-background" />
      </div>
      <ImageUpload name="logoUrl" label="Loqo" defaultValue={game?.logoUrl} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={game?.isActive ?? true} />
        Aktiv
      </label>
      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
