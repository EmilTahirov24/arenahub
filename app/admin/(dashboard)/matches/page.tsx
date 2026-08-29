import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/formStyles";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminPagination from "@/components/admin/AdminPagination";
import type { Prisma } from "@/app/generated/prisma/client";

const STATUS_COLOR: Record<string, string> = {
  LIVE: "text-live",
  UPCOMING: "text-foreground-muted",
  FINISHED: "text-brand-via",
  POSTPONED: "text-warning",
  CANCELLED: "text-foreground-muted",
};

const PER_PAGE = 50;

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const search = (q ?? "").trim();

  // Əvvəl burada yalnız `take: 100` vardı və səhifələmə yox idi — yəni ən təzə
  // 100 matçdan başqa heç birinə çatmaq mümkün deyildi. Production-da 2349 matç
  // var, yəni 2249-u admin üçün əlçatmaz idi. Bu, limitsiz sorğudan da pisdir:
  // orada heç olmasa data görünürdü.
  const where: Prisma.MatchWhereInput = search
    ? {
        OR: [
          { teamA: { name: { contains: search, mode: "insensitive" } } },
          { teamB: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

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

  // Saat da göstərilir, təkcə gün yox: eyni gün ərzində bir neçə matç olur və
  // admin onları məhz vaxta görə ayırd edir.
  const whenFmt = new Intl.DateTimeFormat("az", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Matçlar</h1>
        <Link href="/admin/matches/new" className={primaryButtonClass}>
          + Yeni matç
        </Link>
      </div>

      <AdminSearch action="/admin/matches" defaultValue={search} placeholder="Komanda adı ilə axtar..." />

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
            {search ? `«${search}» üçün matç tapılmadı.` : "Matç yoxdur."}
          </p>
        )}
      </div>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pathname="/admin/matches"
        query={{ q: search || undefined }}
      />
    </div>
  );
}
