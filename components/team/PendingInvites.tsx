import TeamAvatar from "@/components/common/TeamAvatar";
import CountryFlag from "@/components/common/CountryFlag";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/formStyles";
import { pendingInvitesFor } from "@/lib/teamInvites";
import { acceptTeamInvite, declineTeamInvite } from "@/app/player/(dashboard)/invites/actions";

export default async function PendingInvites({ playerId }: { playerId: string }) {
  const invites = await pendingInvitesFor(playerId);
  if (invites.length === 0) return null;

  return (
    <section className="mb-8 max-w-lg rounded-lg border border-brand-via/40 bg-brand-via/5 p-4">
      <h2 className="font-display mb-1 text-lg font-bold">Komanda dəvətləri</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Dəvəti qəbul etsəniz komandanın tərkibinə düşəcək və profiliniz oyunçular siyahısında görünəcək.
      </p>

      <div className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <TeamAvatar
                name={invite.team.name}
                logoUrl={invite.team.logoUrl}
                color={invite.team.primaryColor}
                size={32}
              />
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <CountryFlag code={invite.team.country} />
                  {invite.team.name}
                </div>
                <div className="text-xs text-foreground-muted">
                  {invite.team.game.shortName} · {invite.invitedBy.nickname} dəvət etdi
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <form action={acceptTeamInvite.bind(null, invite.id)}>
                <button type="submit" className={primaryButtonClass}>
                  Qəbul et
                </button>
              </form>
              <form action={declineTeamInvite.bind(null, invite.id)}>
                <button type="submit" className={secondaryButtonClass}>
                  Rədd et
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
