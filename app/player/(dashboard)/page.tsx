import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { parseSocials } from "@/lib/socials";
import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import { updateOwnPlayer } from "./actions";

export const dynamic = "force-dynamic";

const STATUSES = ["ACTIVE", "BENCHED", "RETIRED"] as const;

export default async function PlayerHomePage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");
  const player = await prisma.player.findUnique({ where: { id: session.id }, include: { game: true } });
  if (!player) redirect("/player/login");
  const socials = parseSocials(player.socials);

  return (
    <div>
      <h1 className="font-display mb-1 text-2xl font-bold">{player.nickname}</h1>
      <p className="mb-6 text-sm text-foreground-muted">{player.game.name}</p>

      <form action={updateOwnPlayer} className="max-w-lg space-y-4">
        <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
}
