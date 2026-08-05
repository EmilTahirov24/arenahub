import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { parseSocials } from "@/lib/socials";
import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import SocialInputs from "@/components/players/SocialInputs";
import ProfileForm from "@/components/players/ProfileForm";
import { inputClass, labelClass } from "@/components/admin/formStyles";

export const dynamic = "force-dynamic";

const STATUSES = ["ACTIVE", "BENCHED", "RETIRED"] as const;

/**
 * The profile editor, which used to be the whole of /player.
 *
 * Landing on your own profile and finding a form is disorienting: you go to
 * look at yourself and are handed a page of inputs instead. /player now shows
 * the profile the way anyone else sees it, and this is one click away from it.
 */
export default async function EditProfilePage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");
  const player = await prisma.player.findUnique({ where: { id: session.id }, include: { game: true } });
  if (!player) redirect("/player/login");
  const socials = parseSocials(player.socials);

  return (
    <div>
      <Link href="/player" className="mb-4 inline-block text-sm text-foreground-muted hover:text-foreground">
        ← Profilə qayıt
      </Link>
      <h1 className="font-display mb-1 text-2xl font-bold">Profili redaktə et</h1>
      <p className="mb-6 text-sm text-foreground-muted">{player.game.name}</p>

      <ProfileForm>
        {/* Side by side only once there is room: two columns of a 390px screen
            gave each name field 165px, which is narrower than most surnames. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Ad</label>
            <input name="firstName" defaultValue={player.firstName ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Soyad</label>
            <input name="lastName" defaultValue={player.lastName ?? ""} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Rol</label>
          <input name="role" defaultValue={player.role ?? ""} className={inputClass} placeholder="IGL, AWPer..." />
        </div>
        <div>
          <label className={labelClass}>Ölkə</label>
          <CountrySelect defaultValue={player.country} className={inputClass} />
        </div>
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
        <ImageUpload name="photoUrl" label="Şəkil" defaultValue={player.photoUrl} />

        <SocialInputs socials={socials} />
      </ProfileForm>
    </div>
  );
}
