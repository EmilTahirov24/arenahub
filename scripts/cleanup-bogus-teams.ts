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
    console.log("No teams to clean up.");
    return;
  }

  console.log(`${teams.length} bogus teams` + (apply ? "" : "  (DRY RUN)"));
  console.log("");

  const ids = teams.map((t) => t.id);

  // What will be deleted is printed FIRST: nothing should vanish unread.
  let withRoster = 0;
  for (const t of teams) {
    const n = t._count.homeMatches + t._count.awayMatches;
    if (t._count.memberships > 0) withRoster++;
    console.log(`  ${String(n).padStart(3)} matches  ${t.game.slug.padEnd(9)} ${t.name.slice(0, 60)}`);
  }

  const matches = await prisma.match.findMany({
    where: { OR: [{ teamAId: { in: ids } }, { teamBId: { in: ids } }] },
    select: { id: true, status: true },
  });
  const finished = matches.filter((m) => m.status === "FINISHED").length;

  console.log("");
  console.log(`matches to delete: ${matches.length}`);
  console.log(`  finished:        ${finished}`);
  console.log(`teams with a roster: ${withRoster}`);

  // An unexpected case: a finished match has already gone into the Elo. The
  // script must not delete that on its own - the ratings would need replaying,
  // and that is a separate decision.
  if (finished > 0) {
    console.log("");
    console.log("STOPPED: there is a finished match, so it has gone into the ratings.");
    console.log("After deleting, `npx tsx scripts/recompute-ratings.ts` is needed.");
    console.log("This script does not do that itself - look at the result first.");
    return;
  }

  if (!apply) {
    console.log("");
    console.log("Nothing was deleted. Add --apply to delete.");
    return;
  }

  const matchIds = matches.map((m) => m.id);
  if (matchIds.length) {
    // The rows tied to the match go first: a foreign key is holding them.
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
  console.log(`${teams.length} teams and ${matchIds.length} matches deleted.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
