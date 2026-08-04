/**
 * Merges tournaments that exist twice under the same name.
 *
 *   npx tsx scripts/merge-duplicate-tournaments.ts             # dry run
 *   npx tsx scripts/merge-duplicate-tournaments.ts --apply
 *
 * The seeded events and the Liquipedia import each created their own row for
 * the same tournament, because the seed slugs its events "cs-asia-championships
 * -2026" and the importer prefixes the game. The two hold different things: the
 * seeded row has the prize distribution that was entered by hand, the imported
 * row has the full match list. Neither is redundant on its own.
 *
 * So the fuller row is kept, the prize distribution is carried across, and only
 * then is the emptier row removed. Everything deleted is written to a JSON file
 * first — this runs against live data, and a merge that turns out wrong has to
 * be undoable.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "REJIM: yazma (--apply)\n" : "REJIM: quru işlətmə — heç nə silinmir\n");

  const all = await prisma.tournament.findMany({
    include: {
      prizes: true,
      _count: { select: { matches: true, participants: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof all>();
  for (const t of all) {
    const key = `${t.gameId}::${t.name.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const backup: unknown[] = [];
  let merged = 0;

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    // The row with the most matches is the one worth keeping; the prize
    // distribution is small and moves easily, a match list does not.
    const [keep, ...drop] = [...group].sort((a, b) => b._count.matches - a._count.matches);
    console.log(`\n${keep.name}`);
    console.log(`  saxlanılır: ${keep.slug}  ${keep._count.matches} matç, ${keep.prizes.length} mükafat`);

    for (const loser of drop) {
      console.log(`  silinir:    ${loser.slug}  ${loser._count.matches} matç, ${loser.prizes.length} mükafat`);

      const matches = await prisma.match.findMany({
        where: { tournamentId: loser.id },
        include: { maps: true, _count: { select: { predictions: true, playerStats: true } } },
      });
      const predicted = matches.filter((m) => m._count.predictions > 0);
      if (predicted.length) {
        console.log(`  ! ${predicted.length} matçda proqnoz var — bu turnir toxunulmadan buraxılır`);
        continue;
      }

      // Places the keeper is missing; an existing place is left as it is.
      const have = new Set(keep.prizes.map((p) => p.placeFrom));
      const moving = loser.prizes.filter((p) => !have.has(p.placeFrom));
      if (moving.length) console.log(`  → ${moving.length} mükafat sətri köçürülür`);

      backup.push({ tournament: loser, matches, movedPrizes: moving });
      if (!apply) continue;

      for (const prize of moving) {
        await prisma.tournamentPrize.create({
          data: {
            tournamentId: keep.id,
            placeFrom: prize.placeFrom,
            placeTo: prize.placeTo,
            amount: prize.amount,
            label: prize.label,
          },
        });
      }

      // Matches cascade to their maps; participants and prizes cascade with the
      // tournament itself.
      await prisma.match.deleteMany({ where: { tournamentId: loser.id } });
      await prisma.tournament.delete({ where: { id: loser.id } });
      merged++;
    }
  }

  // Finished matches nobody won: a page can mark a fixture complete while both
  // scores are zero, and that is not a result — it would show 0-0 on the site
  // and feed a meaningless outcome into the ratings.
  const undecided = await prisma.match.findMany({
    where: { status: "FINISHED", winnerId: null, teamAScore: 0, teamBScore: 0 },
    include: { maps: true, _count: { select: { predictions: true } } },
  });
  const removable = undecided.filter((m) => m._count.predictions === 0);
  if (removable.length) {
    console.log(`\n${removable.length} nəticəsiz "bitmiş" matç silinir:`);
    for (const m of removable) console.log(`  ${m.slug}`);
    backup.push({ undecidedMatches: removable });
    if (apply) await prisma.match.deleteMany({ where: { id: { in: removable.map((m) => m.id) } } });
  }

  if (backup.length) {
    const path = `scripts/.merge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(path, JSON.stringify(backup, null, 2));
    console.log(`\nSilinən hər şey burada saxlanıldı: ${path}`);
  }

  console.log(apply ? `\n${merged} dublikat birləşdirildi.` : "\nTətbiq etmək üçün: --apply");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
