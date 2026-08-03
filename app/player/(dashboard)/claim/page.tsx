import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import ClaimProfileSearch from "@/components/player/ClaimProfileSearch";
import CountryFlag from "@/components/common/CountryFlag";
import { withdrawProfileClaim } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  PENDING: "Baxılır",
  APPROVED: "Təsdiqləndi",
  REJECTED: "Rədd edildi",
} as const;

export default async function ClaimProfilePage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");

  const claims = await prisma.profileClaim.findMany({
    where: { claimantId: session.id },
    orderBy: { createdAt: "desc" },
    include: { player: true },
  });

  return (
    <div className="max-w-lg">
      <h1 className="font-display mb-1 text-2xl font-bold">Profilimi tap</h1>
      <p className="mb-6 text-sm text-foreground-muted">
        Əgər siz qeydiyyatdan keçməzdən əvvəl sizin adınıza profil yaradılıbsa (admin, turnir və ya komanda tərəfindən),
        onu öz hesabınıza keçirə bilərsiniz. Həmin profilin matç statistikası, komanda tarixçəsi və linki sizə keçir.
      </p>

      {claims.length > 0 && (
        <div className="mb-8 space-y-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground-muted">
            Müraciətlərim
          </h2>
          {claims.map((claim) => (
            <div key={claim.id} className="rounded-lg border border-border-subtle bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <CountryFlag code={claim.player.country} />
                  {claim.player.nickname}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    claim.status === "APPROVED"
                      ? "text-emerald-400"
                      : claim.status === "REJECTED"
                        ? "text-live"
                        : "text-foreground-muted"
                  }`}
                >
                  {STATUS_LABEL[claim.status]}
                </span>
              </div>
              {claim.reviewNote && <p className="mt-1 text-xs text-foreground-muted">Admin: {claim.reviewNote}</p>}
              {claim.status === "PENDING" && (
                <form action={withdrawProfileClaim.bind(null, claim.id)} className="mt-2">
                  <button type="submit" className="text-xs text-live hover:underline">
                    müraciəti geri götür
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="font-display mb-3 text-sm font-bold uppercase tracking-wide text-foreground-muted">
        Sahibsiz profil axtar
      </h2>
      <ClaimProfileSearch />

      <p className="mt-6 rounded-md border border-border-subtle bg-surface p-3 text-xs text-foreground-muted">
        Müraciət təsdiqlənəndən sonra sistemdən çıxarılacaqsınız. Eyni email və şifrə ilə yenidən daxil olun — artıq
        həmin profildə olacaqsınız.
      </p>
    </div>
  );
}
