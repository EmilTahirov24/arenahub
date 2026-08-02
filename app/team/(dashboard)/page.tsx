import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import { updateOwnTeam } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamHomePage() {
  const session = await getTeamSession();
  if (!session) redirect("/team/login");
  const team = await prisma.team.findUnique({ where: { id: session.id }, include: { game: true } });
  if (!team) redirect("/team/login");

  return (
    <div>
      <h1 className="font-display mb-1 text-2xl font-bold">Komanda məlumatı</h1>
      <p className="mb-6 text-sm text-foreground-muted">{team.game.name}</p>

      <form action={updateOwnTeam} className="max-w-lg space-y-4">
        <div>
          <label className={labelClass}>Ad</label>
          <input name="name" required defaultValue={team.name} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Ölkə</label>
          <CountrySelect defaultValue={team.country} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Əsas rəng</label>
            <input name="primaryColor" type="color" defaultValue={team.primaryColor ?? "#7c3aed"} className="h-10 w-full rounded-md border border-border-subtle bg-background" />
          </div>
          <div>
            <label className={labelClass}>İkinci rəng</label>
            <input name="secondaryColor" type="color" defaultValue={team.secondaryColor ?? "#0a0b10"} className="h-10 w-full rounded-md border border-border-subtle bg-background" />
          </div>
        </div>
        <ImageUpload name="logoUrl" label="Loqo" defaultValue={team.logoUrl} />
        <div>
          <label className={labelClass}>Təsvir</label>
          <textarea name="description" defaultValue={team.description ?? ""} rows={4} className={inputClass} />
        </div>
        <button type="submit" className={primaryButtonClass}>
          Yadda saxla
        </button>
      </form>
    </div>
  );
}
