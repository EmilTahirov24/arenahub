/**
 * Fills in the country of teams that were created without one.
 *
 *   npx tsx scripts/import-team-countries.ts               # dry run
 *   npx tsx scripts/import-team-countries.ts --limit 25    # first N teams
 *   npx tsx scripts/import-team-countries.ts --apply
 *
 * Why this exists. The team list shows a flag and a country name, and the team
 * profile shows a flag next to the name. Measured in production: 719 of 855
 * teams had no country at all, so most of that column read "—".
 *
 * The cause is not a broken parser. `import-teams.ts` sets the country
 * correctly, but it only walks a hand-picked list. Most teams are created by
 * `import-live.ts`, which opens a team the moment an unknown name shows up in a
 * match ticker — and it has no country to give it. The gap therefore grows on
 * its own as the importer keeps running, which is why this is a repeatable
 * script rather than a one-off fix.
 *
 * It is safe to re-run: only teams with no country are touched.
 *
 * Not on a schedule, deliberately. GitHub queues scheduled jobs on the free
 * plan — the existing importer's real gaps were measured at 45 minutes to 5
 * hours — and a second scheduled job would lengthen that queue. Run it by hand
 * after a large import instead.
 *
 * Known limitation, found while running this. Some organisations list more than
 * one location — "Team Liquid Brazil" carries both Netherlands and Brazil — and
 * `parseTeamLocation` takes the first, which is the organisation's primary
 * country rather than the regional squad's. That is left as is on purpose: the
 * same parser produced every country already stored by `import-teams.ts`, so
 * changing the rule here alone would make the column inconsistent with itself.
 *
 * Liquipedia content is CC-BY-SA and the site credits it in the footer. Their
 * rate limit means roughly 2.5s per team, so all 719 take about half an hour.
 *
 * Builds its own PrismaClient rather than importing lib/prisma, the same way the
 * other import scripts do — lib/* is "server-only" and throws outside Next.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchWikitext, parseTeamLocation, type LiquipediaOptions } from "../lib/liquipedia";
import { countryCode } from "../lib/countries";
import { wikiForGame } from "../lib/wikis";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";

async function main() {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const teams = await prisma.team.findMany({
    where: { country: null },
    select: { id: true, name: true, game: { select: { slug: true } } },
    // Reytinqə görə: ən çox baxılan komandalar əvvəl düzəlsin, çünki --limit ilə
    // yarımçıq qaçış da faydalı olmalıdır.
    orderBy: { rating: "desc" },
  });

  console.log(`${teams.length} komandanın ölkəsi yoxdur` + (apply ? "" : "  (QURU İŞLƏTMƏ)"));
  console.log("");

  let filled = 0;
  let noLocation = 0;
  let noPage = 0;
  let unknownName = 0;
  let skippedWiki = 0;
  let seen = 0;

  // Tanınmayan ölkə adları toplanır: bir neçəsi təkrarlanırsa, onları
  // lib/countries.ts-ə əlavə etmək bir dəfəyə onlarla komandanı düzəldir.
  const unknownNames = new Map<string, number>();

  for (const team of teams) {
    if (seen >= limit) break;
    seen++;

    const wiki = wikiForGame(team.game.slug);
    if (!wiki) {
      skippedWiki++;
      continue;
    }

    const opts: LiquipediaOptions = { wiki, userAgent: USER_AGENT };

    // Yalnız DƏQİQ başlıq. Axtarışla təxmin etmək yanlış təşkilatın məlumatını
    // gətirmək riskidir — import-rosters.ts-də eyni qərar eyni səbəblə verilib.
    // Tapılmayan komanda sadəcə ötürülür.
    let wikitext: string | null = null;
    try {
      wikitext = await fetchWikitext(opts, team.name);
    } catch (e) {
      console.log(`!  ${team.name.padEnd(30)} ${(e as Error).message}`);
      continue;
    }

    if (!wikitext) {
      noPage++;
      continue;
    }

    const location = parseTeamLocation(wikitext);
    if (!location) {
      noLocation++;
      continue;
    }

    const code = countryCode(location);
    if (!code) {
      unknownName++;
      unknownNames.set(location, (unknownNames.get(location) ?? 0) + 1);
      console.log(`?  ${team.name.padEnd(30)} tanınmayan ölkə: ${location}`);
      continue;
    }

    filled++;
    console.log(`+  ${team.name.padEnd(30)} ${code}  (${location})`);
    if (apply) {
      // `country: null` şərti sorğuda da təkrarlanır: uzun qaçış zamanı admin
      // eyni komandaya ölkə yazsa, onun dəyəri üstündən yazılmamalıdır.
      await prisma.team.updateMany({ where: { id: team.id, country: null }, data: { country: code } });
    }
  }

  const tried = seen - skippedWiki;
  const pct = tried > 0 ? ((filled / tried) * 100).toFixed(1) : "0";

  console.log("");
  console.log(`baxılan:            ${seen}`);
  console.log(`ölkə tapıldı:       ${filled}  (${pct}%)`);
  console.log(`səhifə tapılmadı:   ${noPage}`);
  console.log(`location sahəsi yox: ${noLocation}`);
  console.log(`tanınmayan ölkə adı: ${unknownName}`);
  if (skippedWiki) console.log(`wiki uyğunluğu yox: ${skippedWiki}`);

  if (unknownNames.size) {
    console.log("\ntanınmayan adlar (təkrarına görə):");
    for (const [name, n] of [...unknownNames].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${String(n).padStart(3)}  ${name}`);
    }
  }

  if (!apply) console.log("\nHeç nə yazılmadı. Yazmaq üçün --apply əlavə et.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
