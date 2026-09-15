import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/formStyles";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminPagination from "@/components/admin/AdminPagination";
import { MatchStatus } from "@/app/generated/prisma/client";
import type { Prisma } from "@/app/generated/prisma/client";
import { siteFormat } from "@/lib/dates";

const STATUS_COLOR: Record<string, string> = {
  LIVE: "text-live",
  UPCOMING: "text-foreground-muted",
  FINISHED: "text-brand-via-fg",
  POSTPONED: "text-warning",
  CANCELLED: "text-foreground-muted",
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  UPCOMING: "Gözlənilir",
  LIVE: "Canlı",
  FINISHED: "Bitib",
  POSTPONED: "Təxirə salınıb",
  CANCELLED: "Ləğv edilib",
};

const PER_PAGE = 50;

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; game?: string }>;
}) {
  const { q, page: pageParam, status: statusParam, game: gameParam } = await searchParams;
  const search = (q ?? "").trim();

  // The status comes from the address, so it can be any text at all. Passed to
  // Prisma unchecked, `?status=xxx` returns a 500 from an enum error - a filter
  // must not punish a mistyped link by breaking the page.
  const status =
    statusParam && (Object.values(MatchStatus) as string[]).includes(statusParam)
      ? (statusParam as MatchStatus)
      : undefined;

  const games = await prisma.game.findMany({ orderBy: { name: "asc" }, select: { slug: true, shortName: true } });
  const gameSlug = games.some((g) => g.slug === gameParam) ? gameParam : undefined;

  // This carried only `take: 100` and no pagination - so nothing beyond the
  // 100 newest matches could be reached at all. Production holds 2,349, which
  // put 2,249 of them out of an admin's reach. That is worse than an unbounded
  // query: there, at least, the data was visible.
  const where: Prisma.MatchWhereInput = {
    ...(search
      ? {
          OR: [
            { teamA: { name: { contains: search, mode: "insensitive" } } },
            { teamB: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(gameSlug ? { game: { slug: gameSlug } } : {}),
  };

  const total = await prisma.match.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const matches = await prisma.match.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
    include: { teamA: true, teamB: true, game: true },
    take: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
  });

  // The time is shown as well as the day: several matches fall on one day, and
  // the time is how an admin tells them apart.
  const whenFmt = siteFormat("az", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const filtered = Boolean(search || status || gameSlug);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Matçlar</h1>
        <Link href="/admin/matches/new" className={primaryButtonClass}>
          + Yeni matç
        </Link>
      </div>

      {/*
        Komanda adı ilə axtarış tək başına bəs etmirdi: 2315 matçda «canlı olan
        nə var» və ya «yalnız CS2» sualının cavabı üçün adam 47 səhifəni əl ilə
        gəzməli idi. Hər ikisi sorğuda onsuz da indeksli sahədir.
      */}
      <AdminSearch
        action="/admin/matches"
        defaultValue={search}
        placeholder="Komanda adı ilə axtar..."
        filters={[
          {
            name: "status",
            value: status,
            allLabel: "Bütün statuslar",
            options: Object.values(MatchStatus).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
          },
          {
            name: "game",
            value: gameSlug,
            allLabel: "Bütün oyunlar",
            options: games.map((g) => ({ value: g.slug, label: g.shortName })),
          },
        ]}
      />

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {matches.map((m) => (
          <div key={m.id} className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0">
            <Link href={`/admin/matches/${m.id}`} className="flex-1 hover:underline">
              {m.teamA.name} vs {m.teamB.name}
            </Link>
            {/*
              Siyahı `scheduledAt` üzrə sıralanır, amma tarixi göstərmirdi — yəni
              admin görmədiyi dəyərə görə düzülmüş sətirlərə baxırdı. Eyni cütlük
              fərqli oyunlarda və fərqli günlərdə təkrarlanır, tarix isə onları
              ayırd edən yeganə sütundur. Turnir və xəbər siyahıları bunu onsuz
              da edir; matçlar tək istisna idi.
            */}
            <span className="whitespace-nowrap text-xs tabular-nums text-foreground-muted">
              {whenFmt.format(m.scheduledAt)}
            </span>
            <span className="text-xs text-foreground-muted">{m.game.shortName}</span>
            <span className={`text-xs font-semibold ${STATUS_COLOR[m.status]}`}>{m.status}</span>
            <span className="font-display text-sm font-semibold">{m.teamAScore}:{m.teamBScore}</span>
            <Link href={`/admin/matches/${m.id}/live`} className={secondaryButtonClass}>
              Canlı idarə
            </Link>
          </div>
        ))}
        {matches.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-muted">
            {filtered ? "Bu şərtlərə uyğun matç tapılmadı." : "Matç yoxdur."}
          </p>
        )}
      </div>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pathname="/admin/matches"
        query={{ q: search || undefined, status, game: gameSlug }}
      />
    </div>
  );
}
