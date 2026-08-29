import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { primaryButtonClass } from "@/components/admin/formStyles";
import { siteFormat } from "@/lib/dates";

export default async function AdminUsersPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin");

  const users = await prisma.adminUser.findMany({ orderBy: { email: "asc" } });
  const dateFmt = siteFormat("az", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">İstifadəçilər</h1>
        <Link href="/admin/users/new" className={primaryButtonClass}>
          + Yeni istifadəçi
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/admin/users/${user.id}`}
            className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
          >
            <span className="flex-1 font-medium">{user.email}</span>
            <span className="text-xs text-foreground-muted">{user.name}</span>
            <span className="text-xs text-foreground-muted">{user.role}</span>
            <span className="text-xs text-foreground-muted">
              {user.lastLoginAt ? dateFmt.format(user.lastLoginAt) : "—"}
            </span>
          </Link>
        ))}
        {users.length === 0 && <p className="p-6 text-center text-sm text-foreground-muted">İstifadəçi yoxdur.</p>}
      </div>
    </div>
  );
}
