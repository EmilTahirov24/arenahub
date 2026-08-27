import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { recentTransfers } from "@/lib/cachedQueries";
import TeamAvatar from "@/components/common/TeamAvatar";

export default async function TopTransfers() {
  const locale = await getLocale();

  const memberships = await recentTransfers();

  if (memberships.length === 0) return null;

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3">
      <h3 className="font-display mb-2 text-sm font-semibold">
        {locale === "az" ? "Son Transferlər" : "Latest Transfers"}
      </h3>
      <ul className="space-y-2">
        {memberships.map((m) => (
          <li key={m.id}>
            <Link href={`/teams/${m.team.slug}`} className="group flex items-center gap-2">
              <TeamAvatar name={m.team.name} logoUrl={m.team.logoUrl} color={m.team.primaryColor} size={22} />
              <span className="flex-1 truncate text-xs text-foreground-muted group-hover:text-foreground">
                <span className="font-medium text-foreground">{m.player.nickname}</span>
                <span className="mx-1 text-brand-via">→</span>
                {m.team.name}
              </span>
              <span className="shrink-0 text-[10px] text-foreground-muted">{dateFmt.format(m.joinedAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
