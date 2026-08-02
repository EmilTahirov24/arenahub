import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { resendAvailableInSeconds } from "@/lib/emailVerification";
import VerifyEmailBanner from "@/components/auth/VerifyEmailBanner";
import { playerLogout, resendPlayerVerificationEmail } from "./actions";

export default async function PlayerDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");

  const player = await prisma.player.findUnique({ where: { id: session.id } });
  if (!player) redirect("/player/login");

  const needsVerification = !!player.email && !player.emailVerified;

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border-subtle bg-surface p-4">
        <Link href="/player" className="font-display mb-6 block text-lg font-bold">
          <span className="brand-gradient-text">ArenaHub</span>
          <span className="ml-1 text-xs text-foreground-muted">oyunçu</span>
        </Link>
        <p className="mb-4 truncate text-sm text-foreground-muted">{player.nickname}</p>
        <nav className="space-y-1">
          <Link href="/player" className="block rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground">
            Profil
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
