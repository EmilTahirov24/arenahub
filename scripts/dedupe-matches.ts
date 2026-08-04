/**
 * Removes match rows that two earlier importer bugs left behind.
 *
 *   npx tsx scripts/dedupe-matches.ts             # dry run
 *   npx tsx scripts/dedupe-matches.ts --apply
 *
 * Two problems, both fixed at the source:
 *
 *  - **Duplicates.** A rendered tournament page can list one fixture twice — a
 *    group table and the bracket beside it show the same game — and the old
 *    position-based slug turned each copy into its own row. `parseRenderedMatches`
 *    now drops repeats, but the rows it already created are still here.
 *
 *  - **Stale fixtures.** A match whose start time had passed but which nobody
 *    had marked finished was written as UPCOMING, putting last week's date in
 *    the fixtures list. `statusOf` now leaves those out.
 *
 * The copy with maps and player statistics attached is the one kept; matches
 * carrying predictions are never touched.
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

  const backup: unknown[] = [];
  const doomed: string[] = [];

  const all = await prisma.match.findMany({
    include: {
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
      _count: { select: { maps: true, playerStats: true, predictions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof all>();
  for (const m of all) {
    const key = `${m.gameId}|${m.teamAId}|${m.teamBId}|${m.scheduledAt.toISOString()}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    // Richest first: the copy someone has already attached maps or stats to is
    // the one worth keeping.
    const [keep, ...rest] = [...group].sort(
      (a, b) => b._count.maps + b._count.playerStats - (a._count.maps + a._count.playerStats),
    );
    console.log(`${keep.teamA.name} vs ${keep.teamB.name} — ${group.length} nüsxə, ${rest.length} silinir`);

    for (const dup of rest) {
      if (dup._count.predictions > 0) {
        console.log(`  ! ${dup.slug} proqnoz daşıyır, toxunulmur`);
        continue;
      }
      backup.push(dup);
      doomed.push(dup.id);
    }
  }

  const stale = await prisma.match.findMany({
    where: { status: "UPCOMING", scheduledAt: { lt: new Date() } },
    include: { teamA: { select: { name: true } }, teamB: { select: { name: true } }, _count: { select: { predictions: true } } },
  });
  const staleRemovable = stale.filter((m) => m._count.predictions === 0 && !doomed.includes(m.id));
  if (staleRemovable.length) {
    console.log(`\n${staleRemovable.length} keçmiş tarixli "qarşıdakı" matç silinir:`);
    for (const m of staleRemovable) {
      console.log(`  ${m.teamA.name} vs ${m.teamB.name} — ${m.scheduledAt.toISOString().slice(0, 16)}`);
      backup.push(m);
      doomed.push(m.id);
    }
  }

  if (!doomed.length) {
    console.log("\nTəmizlənəcək sətir yoxdur.");
    return;
  }

  if (backup.length) {
    const path = `scripts/.match-cleanup-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(path, JSON.stringify(backup, null, 2));
    console.log(`\nSilinənlər burada saxlanıldı: ${path}`);
  }

  if (apply) {
    // Maps cascade with the match; nothing else references it.
    const { count } = await prisma.match.deleteMany({ where: { id: { in: doomed } } });
    console.log(`${count} matç silindi.`);
  } else {
    console.log(`\n${doomed.length} matç silinəcək. Tətbiq etmək üçün: --apply`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
