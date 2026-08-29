import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass } from "@/components/admin/formStyles";
import CountryFlag from "@/components/common/CountryFlag";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminPagination from "@/components/admin/AdminPagination";
import type { Prisma } from "@/app/generated/prisma/client";

const PER_PAGE = 50;

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const search = (q ?? "").trim();

  // Əvvəl bu sorğu BÜTÜN komandaları çəkirdi — production-da 814 sətir, səhifə
  // ~3 saniyə. İdxal işlədikcə say artır, yəni limitsiz variant vaxt keçdikcə
  // yalnız pisləşir. Eyni dərs public /results səhifəsində artıq öyrənilmişdi.
  const where: Prisma.TeamWhereInput = search
    ? { name: { contains: search, mode: "insensitive" } }
    : {};

  const total = await prisma.team.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  // Diapazondan kənar səhifə sonuncuya sıxılır, xəta vermir.
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const teams = await prisma.team.findMany({
    where,
    orderBy: { name: "asc" },
    include: { game: true, owner: true },
    take: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Komandalar</h1>
        <Link href="/admin/teams/new" className={primaryButtonClass}>
          + Yeni komanda
        </Link>
      </div>

      <AdminSearch action="/admin/teams" defaultValue={search} placeholder="Komanda adı ilə axtar..." />

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/admin/teams/${team.id}`}
            className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
          >
            <CountryFlag code={team.country} />
            <span className="flex-1 font-medium">{team.name}</span>
            <span className="text-xs text-foreground-muted">{team.game.shortName}</span>
            {team.owner && <span className="text-xs text-brand-via-fg">sahib: {team.owner.nickname}</span>}
            {!team.isActive && <span className="text-xs text-live">deaktiv</span>}
          </Link>
        ))}
        {teams.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-muted">
            {search ? `«${search}» üçün komanda tapılmadı.` : "Komanda yoxdur."}
          </p>
        )}
      </div>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pathname="/admin/teams"
        query={{ q: search || undefined }}
      />
    </div>
  );
}
