/**
 * Fills in the location of tournaments that were created without one.
 *
 *   npx tsx scripts/import-tournament-locations.ts             # dry run
 *   npx tsx scripts/import-tournament-locations.ts --limit 40
 *   npx tsx scripts/import-tournament-locations.ts --apply
 *
 * Why this exists, and why it is the same shape as import-team-countries.ts.
 * The event pages show a location and most of them have none, for exactly the
 * cause described there: `import-live.ts` opens a tournament the moment an
 * unknown event name appears in a match ticker, and the ticker carries a name
 * and nothing else. The full tournament importer fills the rest in later, for
 * the events it walks — which is not most of them.
 *
 * The page title is the tournament's own name. That is not an assumption:
 * Liquipedia's ticker names events by their page path, which is why a bad parse
 * once produced team names like "BLAST/SLAM/8/China/Open Qualifier 2#Round 1".
 * `import-maps.ts` already relies on the same thing.
 *
 * Only tournaments with no location are touched, so it is safe to re-run.
 *
 * Online events are the interesting case. Liquipedia writes `country=Online` or
 * leaves both fields empty for them, and an event with no venue genuinely has
 * no location — writing "Online" into the column would be inventing a place.
 * Those are counted and skipped, not filled.
 *
 * Not on a schedule, for the reason import-team-countries.ts gives: scheduled
 * jobs queue on the free plan and the importer already loses that queue.
 *
 * Liquipedia content is CC-BY-SA and the site credits it in the footer. Their
 * rate limit means roughly 2.5s per tournament.
 *
 * Builds its own PrismaClient, like the other scripts: lib/* is "server-only"
 * and throws outside Next.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchWikitext, parseTournamentInfo, type LiquipediaOptions } from "../lib/liquipedia";
import { wikiForGame } from "../lib/wikis";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";

/** Liquipedia writes these where a venue would go; none of them is a place. */
const NOT_A_PLACE = new Set(["online", "n/a", "tbd", "tba", "worldwide"]);

function placeFrom(city: string | null, country: string | null): string | null {
  const clean = (v: string | null) => {
    const t = (v ?? "").trim();
    return t && !NOT_A_PLACE.has(t.toLowerCase()) ? t : null;
  };
  const c = clean(city);
  const k = clean(country);
  if (c && k) return `${c}, ${k}`;
  return c ?? k;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const tournaments = await prisma.tournament.findMany({
    where: { location: null },
    select: { id: true, name: true, game: { select: { slug: true } } },
    // Ən yaxın hadisələr əvvəl: --limit ilə yarımçıq qaçış da faydalı olmalıdır.
    orderBy: { startDate: "desc" },
  });

  console.log(`${tournaments.length} turnirin yeri yoxdur` + (apply ? "" : "  (QURU İŞLƏTMƏ)"));
  console.log("");

  let filled = 0;
  let online = 0;
  let noPage = 0;
  let skippedWiki = 0;
  let seen = 0;

  for (const t of tournaments) {
    if (seen >= limit) break;
    seen++;

    const wiki = wikiForGame(t.game.slug);
    if (!wiki) {
      skippedWiki++;
      continue;
    }
    const opts: LiquipediaOptions = { wiki, userAgent: USER_AGENT };

    // Yalnız dəqiq başlıq — axtarışla təxmin etmək başqa turnirin yerini
    // gətirmək riskidir.
    let wikitext: string | null = null;
    try {
      wikitext = await fetchWikitext(opts, t.name);
    } catch (e) {
      console.log(`!  ${t.name.slice(0, 44).padEnd(46)} ${(e as Error).message}`);
      continue;
    }
    if (!wikitext) {
      noPage++;
      continue;
    }

    const info = parseTournamentInfo(wikitext);
    const place = placeFrom(info.city, info.country);
    if (!place) {
      online++;
      continue;
    }

    filled++;
    console.log(`+  ${t.name.slice(0, 44).padEnd(46)} ${place}`);
    if (apply) {
      await prisma.tournament.update({ where: { id: t.id }, data: { location: place } });
    }
  }

  console.log("");
  console.log(`baxılan:           ${seen}`);
  console.log(`yer tapıldı:       ${filled}  (${seen ? ((filled / seen) * 100).toFixed(1) : 0}%)`);
  console.log(`onlayn / yersiz:   ${online}`);
  console.log(`səhifə tapılmadı:  ${noPage}`);
  if (skippedWiki > 0) console.log(`wiki yoxdur:       ${skippedWiki}`);
  if (!apply && filled > 0) console.log("\nHeç nə yazılmadı. Yazmaq üçün --apply əlavə et.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
