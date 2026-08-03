import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth";
import { pendingClaimCount } from "@/lib/profileClaims";
import { adminLogout } from "./actions";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/games", label: "Oyunlar" },
  { href: "/admin/teams", label: "Komandalar" },
  { href: "/admin/players", label: "Oyunçular" },
  { href: "/admin/tournaments", label: "Turnirlər" },
  { href: "/admin/matches", label: "Matçlar" },
  { href: "/admin/news", label: "Xəbərlər" },
  { href: "/admin/claims", label: "Profil müraciətləri", badge: "claims" as const },
  { href: "/admin/ads", label: "Reklamlar" },
  { href: "/admin/users", label: "İstifadəçilər" },
];

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const pendingClaims = await pendingClaimCount();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border-subtle bg-surface p-4">
        <Link href="/admin" className="font-display mb-6 block text-lg font-bold">
          <span className="brand-gradient-text">ArenaHub</span>
          <span className="ml-1 text-xs text-foreground-muted">admin</span>
        </Link>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground"
            >
              {item.label}
              {item.badge === "claims" && pendingClaims > 0 && (
                <span className="brand-gradient-bg rounded-full px-1.5 text-[10px] font-bold text-white">
                  {pendingClaims}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <form action={adminLogout} className="mt-6">
          <button type="submit" className="w-full rounded-md border border-border-subtle px-3 py-2 text-left text-sm text-foreground-muted hover:bg-surface-raised">
            Çıxış
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
