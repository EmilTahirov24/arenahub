/**
 * Removes "teams" that are really Liquipedia page sections.
 *
 *   npx tsx scripts/cleanup-bogus-teams.ts           # dry run
 *   npx tsx scripts/cleanup-bogus-teams.ts --apply
 *
 * The match ticker parser used to take the first link inside an opponent block
 * as the opponent. Some blocks also link back to the event page with a section
 * fragment — ".../Open_Qualifier_2#Round_1" — and that title became a team.
 * They then showed up on the site as an opponent, which reads as nonsense.
 *
 * The parser no longer does this (see `teamNameFrom` in lib/liquipedia.ts), so
 * no new rows appear; this clears the ones already stored.
 *
 * The `#` test is precise rather than clever. Every one of the 49 rows found in
 * production contained it and no real organisation does — a team name simply
 * never carries a section anchor.
 *
 * Matches referencing these rows are deleted too, since a fixture against a
 * tournament section is not a real fixture. Ratings are not affected and are
 * not recomputed: every such match was UPCOMING, so none ever entered the Elo
 * replay, which only walks finished results.
 *
 * Builds its own PrismaClient, like the other scripts — lib/* is "server-only"
 * and throws outside Next.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const apply = process.argv.includes("--apply");

  const teams = await prisma.team.findMany({
    where: { name: { contains: "#" } },
    select: {
      id: true,
      name: true,
      game: { select: { slug: true } },
      _count: { select: { homeMatches: true, awayMatches: true, memberships: true } },
    },
    orderBy: { name: "asc" },
  });

  if (teams.length === 0) {
    console.log("Təmizlənəcək komanda yoxdur.");
    return;
  }

  console.log(`${teams.length} saxta komanda` + (apply ? "" : "  (QURU İŞLƏTMƏ)"));
  console.log("");

  const ids = teams.map((t) => t.id);

  // Nə silinəcəyi ƏVVƏLCƏ yazılır: nəticə oxunmadan heç nə itməməlidir.
  let withRoster = 0;
  for (const t of teams) {
    const n = t._count.homeMatches + t._count.awayMatches;
    if (t._count.memberships > 0) withRoster++;
    console.log(`  ${String(n).padStart(3)} matç  ${t.game.slug.padEnd(9)} ${t.name.slice(0, 60)}`);
  }

  const matches = await prisma.match.findMany({
    where: { OR: [{ teamAId: { in: ids } }, { teamBId: { in: ids } }] },
    select: { id: true, status: true },
  });
  const finished = matches.filter((m) => m.status === "FINISHED").length;

  console.log("");
  console.log(`silinəcək matç:  ${matches.length}`);
  console.log(`  bitmiş:        ${finished}`);
  console.log(`tərkibi olan komanda: ${withRoster}`);

  // Gözlənilməz hal: bitmiş matç varsa, o, Elo-ya düşüb. Skript onu özbaşına
  // silməməlidir — reytinq yenidən hesablanmalıdır və bu, ayrıca qərardır.
  if (finished > 0) {
    console.log("");
    console.log("DAYANDIRILDI: bitmiş matç var, yəni reytinqə düşüb.");
    console.log("Silmədən sonra `npx tsx scripts/recompute-ratings.ts` lazımdır.");
    console.log("Bu skript onu özü etmir — əvvəlcə nəticəyə bax.");
    return;
  }

  if (!apply) {
    console.log("");
    console.log("Heç nə silinmədi. Silmək üçün --apply əlavə et.");
    return;
  }

  const matchIds = matches.map((m) => m.id);
  if (matchIds.length) {
    // Matça bağlı sətirlər əvvəlcə: xarici açar onları saxlayır.
    await prisma.matchPrediction.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.matchVetoStep.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.matchMap.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.playerMatchStat.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
  }
  await prisma.tournamentParticipant.deleteMany({ where: { teamId: { in: ids } } });
  await prisma.teamMembership.deleteMany({ where: { teamId: { in: ids } } });
  await prisma.team.deleteMany({ where: { id: { in: ids } } });

  console.log("");
  console.log(`${teams.length} komanda və ${matchIds.length} matç silindi.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
