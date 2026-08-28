/**
 * Rebuilds every team rating from match history and prints the top of each
 * game's table.
 *
 * The app already calls recomputeTeamRatings() whenever a result changes, so
 * this is only needed after seeding, after importing matches straight into the
 * database, or to check the table by hand.
 *
 *   npx tsx scripts/recompute-ratings.ts
 *
 * Builds its own PrismaClient rather than importing lib/prisma, the same way
 * prisma/seed.ts does: lib/* is marked "server-only", which throws outside the
 * Next runtime. The rating maths itself is imported, not copied — see lib/elo.ts.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { BASE_RATING, replayRatings, roundRating, ratingDelta } from "../lib/elo";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const matches = await prisma.match.findMany({
    where: { status: "FINISHED", winnerId: { not: null } },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    select: { teamAId: true, teamBId: true, winnerId: true, tournament: { select: { tier: true } } },
  });
  console.log(`${matches.length} bitmiş matç oxundu.`);

  const { rating, previous } = replayRatings(matches);

  // Cari dəyərlər də oxunur ki, fərq YADDAŞDA hesablansın.
  //
  // Əvvəl burada hər komanda üçün ayrıca `updateMany` gedirdi — 863 komanda,
  // biri digərini gözləyərək. Riyaziyyat yaddaşdadır və millisaniyələr çəkir;
  // vaxtın hamısı uzaq bazaya gedən növbəti-növbəti sorğulara gedirdi. CI-də
  // ölçüldü: 108 və 278 saniyə, yəni bütün idxal işinin dörddə biri ilə yarısı,
  // və komanda sayı artdıqca uzanırdı.
  //
  // İndi yalnız HƏQİQƏTƏN dəyişən sətirlər yazılır. Adi qaçışda bir matç nəticəsi
  // dəyişir, yəni bir neçə komanda tərpənir — 863 sorğu əvəzinə bir neçəsi.
  const teams = await prisma.team.findMany({ select: { id: true, rating: true, previousRating: true } });

  const updates = [];
  for (const team of teams) {
    const next = roundRating(rating.get(team.id) ?? BASE_RATING);
    const prev = roundRating(previous.get(team.id) ?? BASE_RATING);
    if (roundRating(team.rating) === next && roundRating(team.previousRating) === prev) continue;
    updates.push(
      prisma.team.update({ where: { id: team.id }, data: { rating: next, previousRating: prev } }),
    );
  }

  // Hissə-hissə: seed və ya kütləvi idxaldan sonra bütün cədvəl tərpənə bilər və
  // min ifadəlik tək tranzaksiya göndərmək lazımsız risqdir.
  const CHUNK = 200;
  for (let i = 0; i < updates.length; i += CHUNK) {
    await prisma.$transaction(updates.slice(i, i + CHUNK));
  }
  console.log(`${updates.length} komandanın reytinqi yeniləndi.\n`);

  const games = await prisma.game.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  for (const game of games) {
    const top = await prisma.team.findMany({
      where: { gameId: game.id, isActive: true },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      take: 5,
    });
    if (top.length === 0) continue;
    console.log(`${game.shortName}:`);
    top.forEach((t, i) => {
      const d = ratingDelta(t);
      const move = d === 0 ? "" : d > 0 ? ` (+${d})` : ` (${d})`;
      console.log(`  #${i + 1} ${t.name.padEnd(22)} ${Math.round(t.rating)}${move}`);
    });
    console.log("");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
