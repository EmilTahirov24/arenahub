import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import TeamSettingsForm from "@/components/team/TeamSettingsForm";
import { inputClass, labelClass } from "@/components/admin/formStyles";

/**
 * Team settings, which used to be the whole of /player/team for an owner.
 *
 * A player who merely belonged to a team already saw the team; only the person
 * who founded it was dropped into a form instead. Both now see the team first.
 */
export default async function EditTeamPage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");

  const team = await prisma.team.findFirst({ where: { ownerId: session.id } });
  // Only an owner has settings to change; anyone else belongs on the team page.
  if (!team) redirect("/player/team");

  return (
    <div>
      <Link href="/player/team" className="mb-4 inline-block text-sm text-foreground-muted hover:text-foreground">
        ← Komandaya qayıt
      </Link>
      <h1 className="font-display mb-6 text-2xl font-bold">Komandanı redaktə et</h1>

      <TeamSettingsForm>
        <div>
          <label className={labelClass}>Ad</label>
          <input name="name" required defaultValue={team.name} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Ölkə</label>
          <CountrySelect defaultValue={team.country} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Əsas rəng</label>
            <input
              name="primaryColor"
              type="color"
              defaultValue={team.primaryColor ?? "#7c3aed"}
              className="h-10 w-full rounded-md border border-border-subtle bg-background"
            />
          </div>
          <div>
            <label className={labelClass}>İkinci rəng</label>
            <input
              name="secondaryColor"
              type="color"
              defaultValue={team.secondaryColor ?? "#0a0b10"}
              className="h-10 w-full rounded-md border border-border-subtle bg-background"
            />
          </div>
        </div>
        <ImageUpload name="logoUrl" label="Loqo" defaultValue={team.logoUrl} />
        <div>
          <label className={labelClass}>Təsvir</label>
          <textarea name="description" defaultValue={team.description ?? ""} rows={4} className={inputClass} />
        </div>
      </TeamSettingsForm>
    </div>
  );
}
