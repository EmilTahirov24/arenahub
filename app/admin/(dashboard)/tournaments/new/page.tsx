import { prisma } from "@/lib/prisma";
import TournamentForm from "@/components/admin/TournamentForm";
import { createTournament } from "../actions";


/**
 * Admin panelində ani naviqasiya məqsəd deyil.
 *
 * Bu səhifələr hər açılışda bazadan TƏZƏ data oxuyur — admin dünənki siyahını
 * görməməlidir. Next isə keşlənməmiş oxunu ani naviqasiyanın qarşısını alan
 * hal kimi bildirir və dev konsolunu bu xəbərdarlıqla doldurur; e2e onları
 * problem kimi yığır və REAL konsol səhvləri həmin siyahıda itir.
 *
 * `instant = false` seçimi sənədin təklif etdiyi «Allow blocking route»
 * variantıdır: production davranışı dəyişmir, sadəcə niyyət yazılır.
 */
export const instant = false;

export default async function NewTournamentPage() {
  const games = await prisma.game.findMany({ orderBy: { name: "asc" } });
  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni turnir</h1>
      <TournamentForm games={games} action={createTournament} />
    </div>
  );
}
