import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { resendAvailableInSeconds } from "@/lib/emailVerification";
import VerifyEmailBanner from "@/components/auth/VerifyEmailBanner";
import { teamLogout, resendTeamVerificationEmail } from "./actions";

export default async function TeamDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getTeamSession();
  if (!session) redirect("/team/login");

  const team = await prisma.team.findUnique({ where: { id: session.id } });
  if (!team) redirect("/team/login");

  const needsVerification = !!team.email && !team.emailVerified;

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border-subtle bg-surface p-4">
        <Link href="/team" className="font-display mb-6 block text-lg font-bold">
          <span className="brand-gradient-text">ArenaHub</span>
          <span className="ml-1 text-xs text-foreground-muted">komanda</span>
        </Link>
        <p className="mb-4 truncate text-sm text-foreground-muted">{team.name}</p>
        <nav className="space-y-1">
          <Link href="/team" className="block rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground">
            Komanda məlumatı
          </Link>
          <Link href="/team/roster" className="block rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground">
            Tərkib
          </Link>
        </nav>
        <form action={teamLogout} className="mt-6">
          <button type="submit" className="w-full rounded-md border border-border-subtle px-3 py-2 text-left text-sm text-foreground-muted hover:bg-surface-raised">
            Çıxış
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">
        {needsVerification && (
          <VerifyEmailBanner action={resendTeamVerificationEmail} initialWaitSeconds={resendAvailableInSeconds(team)} />
        )}
        {children}
      </main>
    </div>
  );
}
