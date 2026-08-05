import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { resendAvailableInSeconds } from "@/lib/emailVerification";
import { countPendingInvitesFor } from "@/lib/teamInvites";
import VerifyEmailBanner from "@/components/auth/VerifyEmailBanner";
import BackToSite from "@/components/layout/BackToSite";
import { playerLogout, resendPlayerVerificationEmail } from "./actions";

export default async function PlayerDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");

  const player = await prisma.player.findUnique({ where: { id: session.id } });
  if (!player) redirect("/player/login");

  const needsVerification = !!player.email && !player.emailVerified;
  const pendingInvites = await countPendingInvitesFor(player.id);

  return (
    // Stacks on a phone: at 390px a 224px sidebar left about 118px for the
    // form beside it, which is not a width anything can be filled in at.
    <div className="flex min-h-screen flex-col sm:flex-row">
      <aside className="w-full shrink-0 border-b border-border-subtle bg-surface p-4 sm:w-56 sm:border-r sm:border-b-0">
        {/* The logo goes to the site, as a logo does everywhere else. It used to
            point at /player — the page you are already on — so the one control
            that reads as "way out" led nowhere, and logging out was the only
            way back to ArenaHub. The dashboard root is still one click away
            under "Profil" below. */}
        <Link href="/" className="font-display mb-3 block text-lg font-bold">
          <span className="brand-gradient-text">ArenaHub</span>
          <span className="ml-1 text-xs text-foreground-muted">oyunçu</span>
        </Link>
        <BackToSite />
        <p className="mb-4 truncate text-sm text-foreground-muted">{player.nickname}</p>
        <nav className="space-y-1">
          <Link href="/player" className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground">
            Profil
            {pendingInvites > 0 && (
              <span className="brand-gradient-bg rounded-full px-1.5 text-[10px] font-bold text-white">
                {pendingInvites}
              </span>
            )}
          </Link>
          <Link href="/player/team" className="block rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground">
            Komandam
          </Link>
          <Link href="/player/claim" className="block rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground">
            Profilimi tap
          </Link>
        </nav>
        <form action={playerLogout} className="mt-6">
          <button type="submit" className="w-full rounded-md border border-border-subtle px-3 py-2 text-left text-sm text-foreground-muted hover:bg-surface-raised">
            Çıxış
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">
        {needsVerification && (
          <VerifyEmailBanner action={resendPlayerVerificationEmail} initialWaitSeconds={resendAvailableInSeconds(player)} />
        )}
        {children}
      </main>
    </div>
  );
}
