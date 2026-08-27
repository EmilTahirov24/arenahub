import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth";
import { pendingClaimCount } from "@/lib/profileClaims";
import BackToSite from "@/components/layout/BackToSite";
import AdminNav from "@/components/admin/AdminNav";
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
    // Stacks on a phone — same reason as the player dashboard: a fixed 224px
    // sidebar leaves the tables and forms beside it unusably narrow.
    <div className="flex min-h-screen flex-col sm:flex-row">
      <aside className="w-full shrink-0 border-b border-border-subtle bg-surface p-4 sm:w-56 sm:border-r sm:border-b-0">
        {/* To the site, not to /admin — the logo pointed at the page it was
            already on, leaving logout as the only way back out. "Dashboard"
            below still goes to the admin root. */}
        <Link href="/" className="font-display mb-3 block text-lg font-bold">
          <span className="brand-gradient-text">ArenaHub</span>
          <span className="ml-1 text-xs text-foreground-muted">admin</span>
        </Link>
        <BackToSite />
        <AdminNav
          items={NAV.map((item) => ({
            href: item.href,
            label: item.label,
            badge: item.badge === "claims" ? pendingClaims : undefined,
          }))}
        />
        <form action={adminLogout} className="mt-3 sm:mt-6">
          <button type="submit" className="w-full rounded-md border border-border-subtle px-3 py-2 text-left text-sm text-foreground-muted hover:bg-surface-raised">
            Çıxış
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
