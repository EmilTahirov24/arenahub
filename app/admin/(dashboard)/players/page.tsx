import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass } from "@/components/admin/formStyles";
import CountryFlag from "@/components/common/CountryFlag";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminPagination from "@/components/admin/AdminPagination";
import type { Prisma } from "@/app/generated/prisma/client";

const PER_PAGE = 50;

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const search = (q ?? "").trim();

  // Ləqəb, ad və soyad üzrə: admin oyunçunu həm nickname, həm real adı ilə
  // axtara bilər, çünki hansının yadında qaldığı əvvəlcədən bilinmir.
  const where: Prisma.PlayerWhereInput = search
    ? {
        OR: [
          { nickname: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const total = await prisma.player.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const players = await prisma.player.findMany({
    where,
    orderBy: { nickname: "asc" },
    include: { game: true, memberships: { where: { leftAt: null }, include: { team: true }, take: 1 } },
    take: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Oyunçular</h1>
        <Link href="/admin/players/new" className={primaryButtonClass}>
          + Yeni oyunçu
        </Link>
      </div>

      <AdminSearch action="/admin/players" defaultValue={search} placeholder="Ləqəb və ya ad ilə axtar..." />

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {players.map((player) => (
          <Link
            key={player.id}
            href={`/admin/players/${player.id}`}
            className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
          >
            <CountryFlag code={player.country} />
            <span className="flex-1 font-medium">{player.nickname}</span>
            <span className="text-xs text-foreground-muted">{player.memberships[0]?.team.name ?? "—"}</span>
            <span className="text-xs text-foreground-muted">{player.game.shortName}</span>
          </Link>
        ))}
        {players.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-muted">
            {search ? `«${search}» üçün oyunçu tapılmadı.` : "Oyunçu yoxdur."}
          </p>
        )}
      </div>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pathname="/admin/players"
        query={{ q: search || undefined }}
      />
    </div>
  );
}
