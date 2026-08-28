/**
 * Fills in rosters for teams that are actually playing right now.
 *
 *   npx tsx scripts/import-active-rosters.ts                 # dry run
 *   npx tsx scripts/import-active-rosters.ts --days 30       # window (default 30)
 *   npx tsx scripts/import-active-rosters.ts --limit 40      # first N teams
 *   npx tsx scripts/import-active-rosters.ts --apply
 *
 * Why this exists. `import-teams.ts` reads rosters too, but only for a
 * hand-written list of famous organisations. Everything else is created by
 * `import-live.ts` straight from the match ticker, with no players attached.
 * Measured in production: rosters exist for 26% of CS2 teams, 25% of Valorant,
 * 11% of Dota 2 and just 7% of League of Legends — the largest game on the site.
 * A team page without players is the most visible hole a visitor hits.
 *
 * The window is the point. Of the 798 teams that played in the last 30 days,
 * 690 had no roster. Walking all 863 teams would spend most of its time on
 * qualifier squads nobody opens; walking the recent ones fills the pages people
 * actually reach. Older teams keep whatever they have.
 *
 * Rate: Liquipedia allows one parse per 30s, and the VALORANT and League wikis
 * need a second rendered request when the wikitext has no squad. Budget roughly
 * a minute per team on those two, half that on the others — so run it with
 * `--limit` rather than expecting one pass to finish.
 *
 * Liquipedia content is CC-BY-SA and the site credits it in the footer.
 *
 * Builds its own PrismaClient, like the other scripts — lib/* is "server-only"
 * and throws outside Next.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  fetchWikitext,
  fetchRenderedHtml,
  parseActiveSquad,
  parseSquadHtml,
  splitName,
  type LiquipediaOptions,
  type SquadMember,
} from "../lib/liquipedia";
import { COUNTRIES } from "../lib/countries";
import { WIKIS } from "../lib/wikis";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";
const VALID_CODE = new Set(COUNTRIES.map((c) => c.code));

/** Per-wiki roster shape, mirroring scripts/import-teams.ts. */
const ROSTER: Record<string, { rendered: boolean; size: number }> = {
  counterstrike: { rendered: false, size: 5 },
  dota2: { rendered: false, size: 5 },
  valorant: { rendered: true, size: 6 },
  leagueoflegends: { rendered: true, size: 5 },
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);
}

async function freeSlug(base: string) {
  const root = slugify(base) || "player";
  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? root : `${root}-${Math.random().toString(36).slice(2, 6)}`;
    const hit = await prisma.player.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!hit) return candidate;
  }
  throw new Error(`Slug tapılmadı: ${base}`);
}

function arg(name: string, fallback: number) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) || fallback : fallback;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const days = arg("days", 30);
  const limit = arg("limit", Infinity);

  const since = new Date(Date.now() - days * 86_400_000);
  const recent = await prisma.match.findMany({
    where: { scheduledAt: { gte: since } },
    select: { teamAId: true, teamBId: true },
  });
  const activeIds = [...new Set(recent.flatMap((m) => [m.teamAId, m.teamBId]))];

  const withRoster = new Set(
    (await prisma.teamMembership.groupBy({ by: ["teamId"], where: { leftAt: null } })).map(
      (r) => r.teamId,
    ),
  );

  const targets = await prisma.team.findMany({
    where: { id: { in: activeIds.filter((id) => !withRoster.has(id)) } },
    select: { id: true, name: true, game: { select: { slug: true } } },
    orderBy: { rating: "desc" },
  });

  console.log(
    `son ${days} gündə oynayan komanda: ${activeIds.length}, tərkibi olmayan: ${targets.length}` +
      (apply ? "" : "  (QURU İŞLƏTMƏ)"),
  );
  console.log("");

  let filled = 0;
  let noPage = 0;
  let noSquad = 0;
  let playersCreated = 0;
  let seen = 0;

  for (const team of targets) {
    if (seen >= limit) break;
    seen++;

    const wiki = WIKIS.find((w) => w.slug === team.game.slug)?.wiki;
    const shape = wiki ? ROSTER[wiki] : undefined;
    if (!wiki || !shape) continue;

    const opts: LiquipediaOptions = { wiki, userAgent: USER_AGENT };
    // Komanda başına bir dəfə: əvvəl hər oyunçu üçün ayrıca sorğu gedirdi.
    const gameId = (
      await prisma.game.findFirstOrThrow({ where: { slug: team.game.slug }, select: { id: true } })
    ).id;

    // Exact title only. Searching would eventually file one organisation's
    // players under another — the same rule import-rosters.ts states.
    let wikitext: string | null = null;
    try {
      wikitext = await fetchWikitext(opts, team.name);
    } catch (e) {
      console.log(`!  ${team.name.padEnd(28)} ${(e as Error).message}`);
      continue;
    }
    if (!wikitext) {
      noPage++;
      continue;
    }

    let squad: SquadMember[] = parseActiveSquad(wikitext);
    if (squad.length === 0 && shape.rendered) {
      const html = await fetchRenderedHtml(opts, team.name).catch(() => null);
      if (html) squad = parseSquadHtml(html, wiki);
    }
    squad = squad.slice(0, shape.size);

    if (squad.length === 0) {
      noSquad++;
      continue;
    }

    filled++;
    console.log(
      `+  ${team.name.padEnd(28)} ${team.game.slug.padEnd(9)} ${squad.length} oyunçu: ` +
        squad.map((m) => m.nickname).join(", "),
    );
    if (!apply) continue;

    for (const member of squad) {
      // Ad üzrə uyğunlaşma yalnız EYNİ oyun daxilində aparılır: fərqli
      // oyunlarda eyni ləqəb fərqli insanlardır.
      const existing = await prisma.player.findFirst({
        where: { gameId, nickname: { equals: member.nickname, mode: "insensitive" } },
        select: { id: true },
      });

      const { firstName, lastName } = splitName(member.realName);
      const country = member.country && VALID_CODE.has(member.country) ? member.country : null;

      const player =
        existing ??
        (await prisma.player.create({
          data: {
            slug: await freeSlug(member.nickname),
            nickname: member.nickname,
            country,
            firstName,
            lastName,
            role: member.role,
            gameId,
          },
          select: { id: true },
        }));
      if (!existing) playersCreated++;

      // Bir oyunçunun bir aktiv tərkibi olur: başqasında varsa bağlanır.
      await prisma.teamMembership.updateMany({
        where: { playerId: player.id, leftAt: null, teamId: { not: team.id } },
        data: { leftAt: new Date() },
      });
      const already = await prisma.teamMembership.findFirst({
        where: { playerId: player.id, teamId: team.id, leftAt: null },
        select: { id: true },
      });
      if (!already) {
        await prisma.teamMembership.create({ data: { teamId: team.id, playerId: player.id } });
      }
    }
  }

  const tried = seen;
  console.log("");
  console.log(`baxılan:            ${tried}`);
  console.log(`tərkib tapıldı:     ${filled}  (${tried ? ((filled / tried) * 100).toFixed(1) : 0}%)`);
  console.log(`səhifə tapılmadı:   ${noPage}`);
  console.log(`tərkib oxunmadı:    ${noSquad}`);
  if (apply) console.log(`yeni oyunçu:        ${playersCreated}`);
  if (!apply) console.log("\nHeç nə yazılmadı. Yazmaq üçün --apply əlavə et.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
