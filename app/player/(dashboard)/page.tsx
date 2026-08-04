import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { parseSocials } from "@/lib/socials";
import ImageUpload from "@/components/forms/ImageUpload";
import CountrySelect from "@/components/forms/CountrySelect";
import CountryFlag from "@/components/common/CountryFlag";
import SocialInputs from "@/components/players/SocialInputs";
import PendingInvites from "@/components/team/PendingInvites";
import ProfileForm from "@/components/players/ProfileForm";
import { inputClass, labelClass } from "@/components/admin/formStyles";

export const dynamic = "force-dynamic";

const STATUSES = ["ACTIVE", "BENCHED", "RETIRED"] as const;

export default async function PlayerHomePage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");
  const player = await prisma.player.findUnique({ where: { id: session.id }, include: { game: true } });
  if (!player) redirect("/player/login");
  const socials = parseSocials(player.socials);

  const [aheadCount, predictions] = await Promise.all([
    prisma.player.count({ where: { points: { gt: player.points } } }),
    prisma.matchPrediction.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { predictedWinner: true, match: { include: { teamA: true, teamB: true } } },
    }),
  ]);
  const rank = aheadCount + 1;

  return (
    <div>
      <h1 className="font-display mb-1 text-2xl font-bold">{player.nickname}</h1>
      <p className="mb-6 text-sm text-foreground-muted">{player.game.name}</p>

      <PendingInvites playerId={player.id} />

      <ProfileForm>
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

        <SocialInputs socials={socials} />
      </ProfileForm>

      <h2 className="font-display mb-3 mt-10 text-lg font-bold">Proqnozlarım</h2>
      <div className="mb-6 grid max-w-lg grid-cols-2 gap-3">
        <div className="rounded-lg border border-border-subtle bg-surface p-4 text-center">
          <div className="font-display text-3xl font-bold text-brand-via">{player.points}</div>
          <div className="text-xs text-foreground-muted">Xal</div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface p-4 text-center">
          <div className="font-display text-3xl font-bold text-brand-via">#{rank}</div>
          <div className="text-xs text-foreground-muted">Sıralama (oyunçular arası)</div>
        </div>
      </div>

      {predictions.length === 0 ? (
        <p className="max-w-lg text-sm text-foreground-muted">Hələ heç bir proqnoz verməmisiniz.</p>
      ) : (
        <div className="max-w-lg space-y-2">
          {predictions.map((p) => {
            const isFinished = p.match.status === "FINISHED";
            const isCorrect = isFinished && p.match.winnerId === p.predictedWinnerId;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-4 py-3"
              >
                <div className="text-sm">
                  {p.match.teamA.name} <span className="text-foreground-muted">vs</span> {p.match.teamB.name}
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground-muted">
                    Seçim: <CountryFlag code={p.predictedWinner.country} size={12} />
                    {p.predictedWinner.name}
                  </div>
                </div>
                {isFinished ? (
                  <span className={`text-xs font-bold ${isCorrect ? "text-emerald-400" : "text-live"}`}>
                    {isCorrect ? "Düz ✓" : "Səhv ✗"}
                  </span>
                ) : (
                  <span className="text-xs text-foreground-muted">Gözlənilir</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
