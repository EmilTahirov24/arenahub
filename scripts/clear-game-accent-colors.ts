/**
 * Removes the game's accent colour from teams that were given it as their own.
 *
 *   npx tsx scripts/clear-game-accent-colors.ts             # dry run
 *   npx tsx scripts/clear-game-accent-colors.ts --apply
 *
 * `Team.primaryColor` means "this organisation's colour". An early seed wrote
 * the GAME's accent into it instead, so every CS2 team ended up holding
 * #f5a524 — Spirit, Astralis, G2 and MOUZ included, none of which are gold.
 *
 * The seed stopped doing this (see the note above REAL_CS2_TEAMS in
 * prisma/seed.ts, which states that production is empty) but nothing ever
 * cleaned the rows already written, so production was not empty: 27 teams still
 * carried it on 2026-08-31. The visible effect was on the players table, where
 * the avatar colour comes from the player's team — a whole page of identical
 * gold circles, because `avatarColor` prefers a stored colour over the hue it
 * derives from the name.
 *
 * Only values that exactly match a game's own accent are cleared. A colour an
 * admin typed by hand is left alone: this removes a known-wrong claim, it does
 * not decide what a team's colour should be. With the field empty,
 * `lib/avatarColor.ts` derives a stable hue from the name again.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "REJIM: yazma (--apply)\n" : "REJIM: quru işlətmə — heç nə dəyişmir\n");

  const games = await prisma.game.findMany({ select: { id: true, slug: true, accentColor: true } });
  const accents = new Map(games.map((g) => [g.id, g.accentColor.toLowerCase()]));

  const teams = await prisma.team.findMany({
    where: { NOT: { primaryColor: null } },
    select: { id: true, name: true, primaryColor: true, gameId: true, game: { select: { slug: true } } },
    orderBy: { rating: "desc" },
  });

  const stale = teams.filter((t) => t.primaryColor?.toLowerCase() === accents.get(t.gameId));
  const kept = teams.filter((t) => !stale.includes(t));

  console.log(`${teams.length} komandada rəng var; ${stale.length}-i oyunun vurğu rəngidir.\n`);
  for (const t of stale) {
    console.log(`  silinir  ${t.primaryColor}  ${t.name}  [${t.game.slug}]`);
  }
  if (kept.length) {
    console.log(`\nToxunulmayan (əl ilə yazılmış kimi görünür):`);
    for (const t of kept) console.log(`  saxlanır ${t.primaryColor}  ${t.name}  [${t.game.slug}]`);
  }

  if (!apply) {
    console.log("\nTətbiq etmək üçün: --apply");
    return;
  }
  if (stale.length === 0) {
    console.log("\nTəmizlənəcək sətir yoxdur.");
    return;
  }

  const { count } = await prisma.team.updateMany({
    where: { id: { in: stale.map((t) => t.id) } },
    data: { primaryColor: null },
  });
  console.log(`\n${count} komandanın rəngi silindi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
