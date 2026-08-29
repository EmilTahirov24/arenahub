/**
 * Creates teams and rosters from Liquipedia for every game on the site.
 *
 *   npx tsx scripts/import-teams.ts              # dry run
 *   npx tsx scripts/import-teams.ts --apply
 *   npx tsx scripts/import-teams.ts --game dota2 --apply
 *   npx tsx scripts/import-teams.ts --apply --refresh   # re-read full rosters too
 *
 * Two roster sources, because the wikis differ: Counter-Strike and Dota 2 keep
 * the squad in the page wikitext, while VALORANT and League generate it with
 * `{{ActiveSquadAuto}}` and only expose it in rendered HTML. The rendered route
 * is rate-limited to one request per 30s by Liquipedia, so those two games take
 * a few minutes.
 *
 * Content is CC-BY-SA; the site credits Liquipedia in the footer.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  fetchWikitext,
  fetchRenderedHtml,
  parseActiveSquad,
  parseSquadHtml,
  parseTeamLocation,
  splitName,
  type LiquipediaOptions,
  type SquadMember,
} from "../lib/liquipedia";
import { COUNTRIES, countryCode } from "../lib/countries";
import { indexByOrg, orgKey } from "../lib/orgNames";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";

/**
 * Well-known active organisations per game. A fixed list rather than scraping a
 * portal page: portals change layout often, and a wrong guess would invent a
 * team that does not exist.
 *
 * `rosterSize` caps how many players are taken. The rendered "Active" section
 * lists the starting line-up first and then academy and substitute players, so
 * the cap keeps the displayed roster to the team people actually field.
 */
const GAMES: { slug: string; wiki: string; renderedRoster: boolean; rosterSize: number; teams: string[] }[] = [
  {
    // The CS2 roster came from the user's own list; these are the further
    // organisations that appear in the imported tournaments, added so their
    // real results are not dropped for want of a team to attach them to.
    slug: "cs2",
    wiki: "counterstrike",
    renderedRoster: false,
    rosterSize: 5,
    teams: [
      "BIG", "Heroic", "NRG", "Complexity", "Ninjas in Pyjamas", "ENCE", "Virtus.pro",
      "Imperial Esports", "SAW", "Rare Atom", "Fluxo", "Wildcard Gaming", "EYEBALLERS",
      "TSM", "Passion UA", "Nemiga Gaming", "Betera Esports", "OG", "Sharks Esports",
      "SINNERS Esports", "FlyQuest", "Chinggis Warriors", "Metizport", "Fnatic",
    ],
  },
  {
    slug: "dota2",
    wiki: "dota2",
    renderedRoster: false,
    rosterSize: 5,
    teams: [
      "Team Liquid", "Team Spirit", "Gaimin Gladiators", "Tundra Esports", "BetBoom Team",
      "Xtreme Gaming", "Team Falcons", "PARIVISION", "Aurora Gaming", "Nigma Galaxy",
      "Team Secret", "Virtus.pro", "Yakult Brothers", "Azure Ray", "Talon Esports",
      "BOOM Esports", "HEROIC", "Natus Vincere", "Nouns Esports", "Shopify Rebellion",
      "Wildcard", "Team Tidebound", "L1ga Team", "Chimera Esports", "Cloud9", "Palianytsia",
    ],
  },
  {
    slug: "valorant",
    wiki: "valorant",
    renderedRoster: true,
    rosterSize: 6,
    teams: [
      "Sentinels", "Fnatic", "Paper Rex", "DRX", "LOUD", "Team Liquid",
      "NRG", "G2 Esports", "Team Heretics", "EDward Gaming",
      "100 Thieves", "Cloud9", "Evil Geniuses", "FURIA", "KRÜ Esports", "Leviatán", "MIBR",
      "Team Vitality", "Karmine Corp", "FUT Esports", "BBL Esports", "Natus Vincere", "GIANTX",
      "T1", "Gen.G", "Rex Regum Qeon", "Global Esports", "Talon Esports", "ZETA DIVISION",
      "Bilibili Gaming", "Trace Esports", "XLG Esports", "Wolves Esports", "Nova Esports",
      "Nongshim RedForce", "All Gamers", "Dragon Ranger Gaming", "Gentle Mates", "FULL SENSE",
      "Eternal Fire", "JD Gaming", "Titan Esports Club", "DetonatioN FocusMe", "TYLOO",
      "Apeks", "2Game Esports",
    ],
  },
  {
    slug: "lol",
    wiki: "leagueoflegends",
    renderedRoster: true,
    rosterSize: 5,
    teams: [
      "T1", "Gen.G", "JD Gaming", "Bilibili Gaming", "G2 Esports",
      "Fnatic", "Cloud9", "Team Liquid", "Hanwha Life Esports", "Top Esports",
      "KT Rolster", "Dplus KIA", "BNK FearX", "DRX", "Nongshim RedForce",
      "Weibo Gaming", "LNG Esports", "Anyone's Legend", "Invictus Gaming", "FunPlus Phoenix",
      "Karmine Corp", "Movistar KOI", "Team Heretics", "Team BDS", "SK Gaming", "GIANTX",
      "Rogue", "FlyQuest", "100 Thieves", "Dignitas", "Shopify Rebellion",
    ],
  },
];

const VALID_CODE = new Set(COUNTRIES.map((c) => c.code));

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function freeSlug(table: "team" | "player", base: string) {
  const root = slugify(base) || table;
  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? root : `${root}-${Math.random().toString(36).slice(2, 6)}`;
    const hit =
      table === "team"
        ? await prisma.team.findUnique({ where: { slug: candidate }, select: { id: true } })
        : await prisma.player.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!hit) return candidate;
  }
  throw new Error(`Slug tapılmadı: ${base}`);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const refresh = process.argv.includes("--refresh");
  const only = process.argv.includes("--game") ? process.argv[process.argv.indexOf("--game") + 1] : null;
  console.log(apply ? "REJIM: yazma (--apply)\n" : "REJIM: quru işlətmə — heç nə yazılmır\n");

  let teamsCreated = 0;
  let playersCreated = 0;
  const problems: string[] = [];

  for (const def of GAMES) {
    if (only && only !== def.slug) continue;
    const game = await prisma.game.findUnique({ where: { slug: def.slug } });
    if (!game) {
      problems.push(`Oyun tapılmadı: ${def.slug}`);
      continue;
    }

    console.log(`\n===== ${def.slug.toUpperCase()} =====`);
    const opts: LiquipediaOptions = { wiki: def.wiki, userAgent: USER_AGENT };

    // Teams already on the site may be stored under the short name people use
    // ("Vitality") while the wiki page is titled "Team Vitality". Matching on
    // the normalised name stops the import creating a second copy of a team
    // that is already here, which would split its matches across two pages.
    const existingTeams = await prisma.team.findMany({
      where: { gameId: game.id },
      select: {
        id: true,
        name: true,
        country: true,
        _count: { select: { memberships: { where: { leftAt: null } } } },
      },
      // Ən köhnə əvvəl — səbəbi lib/orgNames.ts-də izah olunub.
      orderBy: { createdAt: "asc" },
    });
    const { index: byOrg, ambiguous } = indexByOrg(existingTeams);
    if (ambiguous.length) problems.push(`${def.slug}: eyni adlı komandalar: ${ambiguous.join(", ")}`);

    for (const title of def.teams) {
      const name = title.replace(/\s*\(.*\)$/, "");
      let team: { id: string; name: string; country: string | null } | null =
        byOrg.get(orgKey(name)) ?? null;

      // A team that already has a full roster is left alone. On the wikis whose
      // squads only exist in rendered HTML, re-reading one costs 30 seconds, so
      // skipping the settled ones is the difference between a few minutes and
      // most of an hour. Use --refresh to read them all again.
      const complete = byOrg.get(orgKey(name))?._count.memberships ?? 0;
      if (team && complete >= def.rosterSize && !refresh) {
        console.log(`. ${name.padEnd(22)} ${team.country ?? "—"}   ${complete} oyunçu (dəyişmir)`);
        continue;
      }

      const wikitext = await fetchWikitext(opts, title);
      if (!wikitext) {
        problems.push(`${def.slug}: "${title}" səhifəsi yoxdur`);
        continue;
      }

      let squad: SquadMember[] = parseActiveSquad(wikitext);
      if (squad.length === 0 && def.renderedRoster) {
        const html = await fetchRenderedHtml(opts, title);
        if (html) squad = parseSquadHtml(html, def.wiki);
      }

      squad = squad.slice(0, def.rosterSize);
      const country = countryCode(parseTeamLocation(wikitext));

      if (!team) {
        console.log(`+ ${name.padEnd(22)} ${country ?? "—"}   ${squad.length} oyunçu`);
        teamsCreated++;
        if (apply) {
          team = await prisma.team.create({
            data: {
              slug: await freeSlug("team", `${def.slug}-${name}`),
              name,
              country: country && VALID_CODE.has(country) ? country : null,
              gameId: game.id,
            },
          });
          // Two wiki titles can name one organisation, so remember it now
          // rather than creating it twice within a single run.
          byOrg.set(orgKey(name), { ...team, _count: { memberships: squad.length } });
        }
      } else {
        console.log(`= ${name.padEnd(22)} ${country ?? "—"}   ${squad.length} oyunçu`);
        if (apply && country && !team.country) {
          await prisma.team.update({ where: { id: team.id }, data: { country } });
        }
      }

      if (squad.length === 0) problems.push(`${def.slug}: "${title}" tərkibi oxunmadı`);
      if (!apply || !team) continue;

      for (const member of squad) {
        const existing = await prisma.player.findFirst({
          where: { gameId: game.id, nickname: { equals: member.nickname, mode: "insensitive" } },
        });
        const { firstName, lastName } = splitName(member.realName);
        const memberCountry = member.country && VALID_CODE.has(member.country) ? member.country : null;

        const player =
          existing ??
          (await prisma.player.create({
            data: {
              slug: await freeSlug("player", member.nickname),
              nickname: member.nickname,
              country: memberCountry,
              firstName,
              lastName,
              role: member.role,
              gameId: game.id,
            },
          }));
        if (!existing) playersCreated++;

        // One active roster per player: close any other before adding this one.
        await prisma.teamMembership.updateMany({
          where: { playerId: player.id, leftAt: null, teamId: { not: team.id } },
          data: { leftAt: new Date() },
        });
        const already = await prisma.teamMembership.findFirst({
          where: { playerId: player.id, teamId: team.id, leftAt: null },
        });
        if (!already) {
          await prisma.teamMembership.create({ data: { teamId: team.id, playerId: player.id } });
        }
      }
    }
  }

  console.log(`\n${teamsCreated} komanda, ${playersCreated} oyunçu yaradılacaq.`);
  if (problems.length) console.log(`\nProblemlər (${problems.length}):\n  ` + problems.join("\n  "));
  if (!apply) console.log("\nTətbiq etmək üçün: --apply");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
