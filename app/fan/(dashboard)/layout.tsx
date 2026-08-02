import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFanSession } from "@/lib/auth";
import { resendAvailableInSeconds } from "@/lib/emailVerification";
import VerifyEmailBanner from "@/components/auth/VerifyEmailBanner";
import { fanLogout, resendFanVerificationEmail } from "./actions";

export default async function FanDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getFanSession();
  if (!session) redirect("/fan/login");

  const fan = await prisma.fan.findUnique({ where: { id: session.id } });
  if (!fan) redirect("/fan/login");

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border-subtle bg-surface p-4">
        <Link href="/fan" className="font-display mb-6 block text-lg font-bold">
          <span className="brand-gradient-text">ArenaHub</span>
          <span className="ml-1 text-xs text-foreground-muted">izləyici</span>
        </Link>
        <p className="mb-4 truncate text-sm text-foreground-muted">{fan.username}</p>
        <nav className="space-y-1">
          <Link href="/fan" className="block rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground">
            Profil
          </Link>
          <Link href="/predictions" className="block rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground">
            Lider cədvəli
          </Link>
        </nav>
        <form action={fanLogout} className="mt-6">
          <button type="submit" className="w-full rounded-md border border-border-subtle px-3 py-2 text-left text-sm text-foreground-muted hover:bg-surface-raised">
            Çıxış
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">
        {!fan.emailVerified && (
          <VerifyEmailBanner action={resendFanVerificationEmail} initialWaitSeconds={resendAvailableInSeconds(fan)} />
        )}
        {children}
      </main>
    </div>
  );
}
