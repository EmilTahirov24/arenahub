import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import { inputClass, primaryButtonClass, dangerButtonClass } from "@/components/admin/formStyles";
import { approveClaim, rejectClaim } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminClaimsPage() {
  await requireAdmin();

  const claims = await prisma.profileClaim.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      player: { include: { memberships: { where: { leftAt: null }, include: { team: true }, take: 1 } } },
      claimant: true,
      reviewedBy: { select: { name: true } },
    },
  });

  const pending = claims.filter((c) => c.status === "PENDING");
  const reviewed = claims.filter((c) => c.status !== "PENDING");

  return (
    <div className="max-w-3xl">
      <h1 className="font-display mb-1 text-2xl font-bold">Profil müraciətləri</h1>
      <p className="mb-6 text-sm text-foreground-muted">
        Qeydiyyatlı istifadəçi öz adına əvvəlcədən yaradılmış profili istəyir. Təsdiqləsəniz hesab həmin profilə
        köçürülür: statistika, komanda tarixçəsi və profil linki saxlanılır, istifadəçinin xalları və proqnozları oraya
        keçir, köhnə hesab silinir. <strong>Geri qaytarılmır</strong> — sübutu diqqətlə yoxlayın.
      </p>

      {pending.length === 0 && <p className="text-sm text-foreground-muted">Gözləyən müraciət yoxdur.</p>}

      <div className="space-y-4">
        {pending.map((claim) => (
          <div key={claim.id} className="rounded-lg border border-brand-via/40 bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <PlayerAvatar name={claim.player.nickname} photoUrl={claim.player.photoUrl} size={36} />
                <div>
                  <Link href={`/admin/players/${claim.player.id}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
                    <CountryFlag code={claim.player.country} />
                    {claim.player.nickname}
                  </Link>
                  <div className="text-xs text-foreground-muted">
                    hədəf profil · {claim.player.memberships[0]?.team.name ?? "komandasız"}
                  </div>
                </div>
              </div>
              <span className="text-foreground-muted">←</span>
              <div>
                <div className="text-sm font-medium">{claim.claimant.nickname}</div>
                <div className="text-xs text-foreground-muted">{claim.claimant.email}</div>
              </div>
            </div>

            <p className="mb-3 whitespace-pre-wrap rounded-md border border-border-subtle bg-background p-3 text-sm">
              {claim.message}
            </p>

            <div className="flex flex-wrap items-end gap-2">
              <input name="note" form={`approve-${claim.id}`} placeholder="Qeyd (istəyə bağlı)" className={inputClass} />
              <form id={`approve-${claim.id}`} action={approveClaim.bind(null, claim.id)}>
                <button type="submit" className={primaryButtonClass}>
                  Təsdiqlə və birləşdir
                </button>
              </form>
              <form action={rejectClaim.bind(null, claim.id)}>
                <button type="submit" className={dangerButtonClass}>
                  Rədd et
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {reviewed.length > 0 && (
        <>
          <h2 className="font-display mb-3 mt-10 text-lg font-bold">Baxılmış müraciətlər</h2>
          <div className="space-y-2">
            {reviewed.map((claim) => (
              <div
                key={claim.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface px-4 py-2 text-sm"
              >
                <span>
                  {claim.player.nickname} ← {claim.claimant.nickname}
                </span>
                <span className={claim.status === "APPROVED" ? "text-xs text-positive" : "text-xs text-live"}>
                  {claim.status === "APPROVED" ? "təsdiqləndi" : "rədd edildi"}
                  {claim.reviewedBy && ` · ${claim.reviewedBy.name}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
