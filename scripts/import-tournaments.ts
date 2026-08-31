/**
 * Creates tournaments, matches and map results from Liquipedia.
 *
 *   npx tsx scripts/import-tournaments.ts                    # dry run
 *   npx tsx scripts/import-tournaments.ts --apply
 *   npx tsx scripts/import-tournaments.ts --game cs2 --apply
 *
 * Only matches between two teams already in our database are written. A result
 * belongs to a real organisation, so an unrecognised opponent is reported and
 * skipped rather than resolved to the nearest-looking team or invented.
 *
 * Re-running is safe: tournaments and matches are matched on their slug and
 * updated in place, so a page that has since finished overwrites the scheduled
 * version rather than creating a second copy.
 *
 * Content is CC-BY-SA; the site credits Liquipedia in the footer.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  fetchRenderedHtml,
  fetchWikitext,
  listSubpages,
  parseMatches,
  parseRenderedMatches,
  parsePrizePool,
  parseMoney,
  parseTournamentInfo,
  resolveTeamCodes,
  type LiquipediaOptions,
  type ParsedMatch,
} from "../lib/liquipedia";
import { indexByOrg, orgKey } from "../lib/orgNames";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";

/**
 * Tournament pages to import, by game. Page titles are hierarchical on
 * Liquipedia — the series, then the year, then the event — and each one's
 * stages live on subpages, which the importer discovers on its own.
 */
const GAMES: { slug: string; wiki: string; rendered: boolean; pages: string[] }[] = [
  {
    slug: "cs2",
    wiki: "counterstrike",
    rendered: false,
    pages: [
      "Intel Extreme Masters/2026/Cologne",
      "Intel Extreme Masters/2026/Atlanta",
      "Intel Extreme Masters/2026/Kraków",
      "Intel Extreme Masters/2026/Rio",
      "Intel Extreme Masters/2026/Beijing",
      "Intel Extreme Masters/2025/Cologne",
      "BLAST/Bounty/2026/Winter",
      "BLAST/Bounty/2026/Summer",
      "BLAST/Open/2026/Spring",
      "BLAST/Rivals/2026/Spring",
      "BLAST/Premier/2026/Frequent Flyers",
      "BLAST/Major/2025/Austin",
      "PGL/2026/Bucharest",
      "CS Asia Championships/2026",
      "Esports World Cup/2026",
    ],
  },
  {
    slug: "dota2",
    wiki: "dota2",
    rendered: false,
    pages: [
      "The International/2025",
      "The International/2026",
      "ESL One/Raleigh/2025",
      "ESL One/Birmingham/2026",
      "Esports World Cup/2026",
    ],
  },
  {
    slug: "valorant",
    wiki: "valorant",
    rendered: true,
    pages: [
      "VCT/2025/Champions",
      "VCT/2026/Champions",
      "VCT/2026/Stage 1/Masters",
      "VCT/2026/Stage 2/Masters",
      "VCT/2026/EMEA League/Stage 1",
      "VCT/2026/Americas League/Stage 1",
      "VCT/2026/Pacific League/Stage 1",
      "VCT/2026/China League/Stage 1",
      "Esports World Cup/2026",
    ],
  },
  {
    slug: "lol",
    wiki: "leagueoflegends",
    rendered: true,
    pages: [
      "World Championship/2026",
      "Mid-Season Invitational/2026",
      "First Stand Tournament/2026",
      "LCK/2026",
      "LEC/2026/Spring",
      "LEC/2026/Summer",
      "LPL/2026/Split 1",
      "LCS/2026/Spring",
      "Esports World Cup/2026",
    ],
  },
];

/**
 * Headings that name no bracket in particular — checked only on SUBPAGES.
 *
 * Every stage subpage puts its bracket under "Results", so using the heading
 * would label four different brackets identically and leave the reader unable
 * to tell the qualifier from the playoffs.
 *
 * "Playoffs" is in the list for the same reason: a qualifier subpage has its
 * own playoff round, and at event level that heading collides with the event's
 * real playoffs — the Esports World Cup page showed two brackets called
 * "Playoffs", one of them a qualifier that finished ten days before the groups.
 * The subpage's own title separates them. On the MAIN page the heading is kept,
 * because there "Playoffs" means the event's playoffs and nothing else.
 */
const GENERIC_HEADING = /^(results?|matches|brackets?|playoffs?|playoff bracket|main event|finals?)$/i;

/** Subpages that never hold match results, so they are not worth fetching. */
const NOT_A_STAGE = /\/(Statistics|Additional Content|Broadcast\w*|prizepool|Player\w*|Qualification)$/i;

/** Below this many usable matches, a page is re-read as rendered HTML. */
const MIN_BEFORE_RENDERING = 4;

/** Liquipedia tier strings onto our own enum. */
function tierOf(raw: string | null): "S" | "A" | "B" | "C" {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("s-tier") || value === "1") return "S";
  if (value.includes("a-tier") || value === "2") return "A";
  if (value.includes("b-tier") || value === "3") return "B";
  return "C";
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);
}


/**
 * "1,250,000" into a display string.
 *
 * Anything under five figures is discarded rather than shown: a crowdfunded
 * prize pool is written as a template the infobox cannot resolve, and the
 * digits left behind are usually the year — "The International 2025" came
 * through as a $2,025 prize pool. No figure is better than a wrong one.
 */
function prizePoolOf(raw: string | null): string | null {
  const amount = raw ? parseMoney(raw) : null;
  return amount !== null && amount >= 10_000 ? `$${amount.toLocaleString("en-US")}` : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const only = process.argv.includes("--game") ? process.argv[process.argv.indexOf("--game") + 1] : null;
  console.log(apply ? "REJIM: yazma (--apply)\n" : "REJIM: quru işlətmə — heç nə yazılmır\n");

  let tournaments = 0;
  let matchesWritten = 0;
  const unresolved = new Map<string, number>();
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
    const gameId = game.id;

    // Our teams for this game, looked up by name and by slug so either spelling
    // of a Liquipedia title finds them.
    const teams = await prisma.team.findMany({
      where: { gameId },
      select: { id: true, name: true, slug: true },
      // Ən köhnə əvvəl — səbəbi lib/orgNames.ts-də izah olunub.
      orderBy: { createdAt: "asc" },
    });
    const byKey = new Map<string, { id: string; name: string }>();
    for (const team of teams) {
      byKey.set(team.name.toLowerCase(), team);
      byKey.set(slugify(team.name), team);
      byKey.set(team.slug.replace(`${def.slug}-`, ""), team);
    }

    const { index: byOrg, ambiguous } = indexByOrg(teams);
    if (ambiguous.length) problems.push(`${def.slug}: eyni adlı komandalar var, atlandı: ${ambiguous.join(", ")}`);

    for (const page of def.pages) {
      // One malformed page must not cost the whole run: an import takes the
      // better part of an hour, and losing everything after it to a single bad
      // field would mean starting over. The failure is reported, not hidden.
      try {
        await importPage(page);
      } catch (e) {
        problems.push(`${def.slug}: "${page}" alınmadı — ${(e as Error).message}`);
      }
    }

    async function importPage(page: string) {
      const wikitext = await fetchWikitext(opts, page);
      if (!wikitext) {
        problems.push(`${def.slug}: "${page}" səhifəsi yoxdur`);
        return;
      }

      const info = parseTournamentInfo(wikitext);
      const name = info.name ?? page.split("/").join(" ");
      if (!info.startDate) {
        problems.push(`${def.slug}: "${page}" tarixi oxunmadı`);
        return;
      }

      const collected: ParsedMatch[] = [];
      let subpages: string[] = [];

      if (def.rendered) {
        // These wikis publish no match data in wikitext, so the page has to be
        // rendered. That costs one request per 30 seconds, which is why only
        // the event page itself is read and its subpages are left alone.
        const html = await fetchRenderedHtml(opts, page);
        if (html) collected.push(...parseRenderedMatches(html, def.wiki));
      } else {
        // Stages and playoffs sit on subpages; the parent usually holds only
        // the infobox and the prize pool.
        collected.push(...parseMatches(wikitext));
        subpages = (await listSubpages(opts, page)).filter((s) => !NOT_A_STAGE.test(s)).slice(0, 12);
        for (const sub of subpages) {
          const text = await fetchWikitext(opts, sub);
          if (!text) continue;
          const found = parseMatches(text);
          // A subpage names its own bracket better than its heading does: the
          // heading is almost always the word "Results", which is the same on
          // every subpage and so tells a reader nothing, while the title
          // ("…/Rio/Europe/Open 1") says exactly which bracket this is.
          const fallback = sub.split("/").slice(-2).join(" ") || null;
          for (const m of found) {
            if (m.bracket && (!m.bracket.label || GENERIC_HEADING.test(m.bracket.label))) {
              m.bracket.label = fallback;
            }
          }
          collected.push(...found);
        }
      }

      const startDate = new Date(`${info.startDate}T00:00:00Z`);
      const endDate = new Date(`${info.endDate ?? info.startDate}T23:59:59Z`);
      const now = new Date();
      const status = now < startDate ? "UPCOMING" : now > endDate ? "FINISHED" : "ONGOING";

      console.log(
        `\n${name}\n  ${info.startDate} → ${info.endDate ?? "?"}  ${info.city ?? "—"}, ${info.country ?? "—"}  ` +
          `${prizePoolOf(info.prizePool) ?? "—"}  ${tierOf(info.tier)}-tier  ` +
          `${collected.length} matç, ${subpages.length} alt səhifə`,
      );

      // Wikitext names teams by short code; rendered pages already give the
      // page title, so that lookup is only needed for the wikitext route.
      const codes = [...new Set(collected.flatMap((m) => [m.teamA, m.teamB]))];
      const canonical = def.rendered ? new Map() : await resolveTeamCodes(opts, codes);

      const resolve = (code: string) => {
        const names = canonical.get(code);
        // Page title first, then the abbreviation, then the raw code: an
        // organisation may be stored under either spelling.
        const candidates = [names?.page, names?.short, code].filter(Boolean) as string[];
        for (const candidate of candidates) {
          const hit = byKey.get(candidate.toLowerCase()) ?? byKey.get(slugify(candidate));
          if (hit) return hit;
        }
        for (const candidate of candidates) {
          const hit = byOrg.get(orgKey(candidate));
          if (hit) return hit;
        }
        return null;
      };

      // A decided result is required, not merely a played flag: a page can mark
      // a match finished while both scores are still zero — a walkover or a
      // cancelled fixture — and writing that would show a 0-0 on the site and
      // feed a meaningless result into the ratings.
      const decided = (m: ParsedMatch) =>
        m.played && m.winner !== null && !!resolve(m.teamA) && !!resolve(m.teamB);
      let usable = collected.filter(decided);

      // A big event whose wikitext yields almost nothing has moved to
      // Liquipedia's match database, exactly as the VALORANT wiki has: the page
      // still declares its matches but leaves them empty, and what little the
      // parser finds comes from the qualifier subpages. Dota's Internationals
      // read that way — 111 matches parsed, one of them between teams anyone
      // has heard of. Rendering the page is the only way to see the rest, so it
      // is worth the 30-second request when the cheap route came up short.
      if (!def.rendered && usable.length < MIN_BEFORE_RENDERING) {
        const html = await fetchRenderedHtml(opts, page);
        if (html) {
          collected.push(...parseRenderedMatches(html, def.wiki));
          usable = collected.filter(decided);
          console.log(`  (mətndə matç yox idi — səhifə render edildi)`);
        }
      }
      for (const m of collected) {
        for (const alias of [m.teamA, m.teamB]) {
          if (!resolve(alias)) unresolved.set(alias, (unresolved.get(alias) ?? 0) + 1);
        }
      }
      // Fixtures that have not been played. A bracket names both sides only
      // once they have qualified, so a dated match between two known teams is
      // a real scheduled game rather than an empty placeholder. Anything
      // without a date is skipped — there is nothing to put in the calendar.
      const scheduled = collected.filter(
        (m) =>
          !m.played &&
          m.date !== null &&
          new Date(m.date) > new Date() &&
          resolve(m.teamA) &&
          resolve(m.teamB),
      );

      const staged = [...usable, ...scheduled].filter((m) => m.stage).length;
      console.log(
        `  bazadakı komandalarla: ${usable.length} nəticə, ${scheduled.length} qarşıdakı matç` +
          `, ${staged} mərhələli`,
      );
      tournaments++;
      if (!apply) {
        matchesWritten += usable.length + scheduled.length;
        return;
      }

      const slug = slugify(`${def.slug}-${name}`);
      const tournament = await prisma.tournament.upsert({
        where: { slug },
        update: {
          name,
          startDate,
          endDate,
          status,
          tier: tierOf(info.tier),
          location: [info.city, info.country].filter(Boolean).join(", ") || null,
          prizePool: prizePoolOf(info.prizePool),
        },
        create: {
          slug,
          name,
          startDate,
          endDate,
          status,
          tier: tierOf(info.tier),
          location: [info.city, info.country].filter(Boolean).join(", ") || null,
          prizePool: prizePoolOf(info.prizePool),
          gameId,
        },
      });

      matchesWritten += await writeMatches(tournament.id, gameId, slug, usable, resolve);
      matchesWritten += await writeMatches(tournament.id, gameId, `${slug}-upcoming`, scheduled, resolve);
      await writePrizes(tournament.id, parsePrizePool(wikitext));
      await writeParticipants(tournament.id, [...usable, ...scheduled], resolve);
    }
  }

  console.log(`\n${tournaments} turnir, ${matchesWritten} matç.`);


  if (unresolved.size) {
    const top = [...unresolved].sort((a, b) => b[1] - a[1]).slice(0, 30);
    console.log(`\nBazada olmayan komandalar (${unresolved.size}) — bu matçlar buraxıldı:`);
    console.log("  " + top.map(([alias, n]) => `${alias}×${n}`).join("  "));
  }
  if (problems.length) console.log(`\nProblemlər (${problems.length}):\n  ` + problems.join("\n  "));
  if (!apply) console.log("\nTətbiq etmək üçün: --apply");
}

/** An unused match slug built from the given base. */
async function freeSlug(base: string): Promise<string> {
  const root = slugify(base) || "match";
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const taken = await prisma.match.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${root}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Writes matches and their maps, replacing any earlier import of the same match. */
async function writeMatches(
  tournamentId: string,
  gameId: string,
  prefix: string,
  matches: ParsedMatch[],
  resolve: (alias: string) => { id: string; name: string } | null,
): Promise<number> {
  let written = 0;

  for (const m of matches) {
    const a = resolve(m.teamA)!;
    const b = resolve(m.teamB)!;
    const scheduledAt = m.date ? new Date(m.date) : new Date();
    const winnerId = m.winner === 1 ? a.id : m.winner === 2 ? b.id : null;

    // A match is identified by who played it, in which event, and when —
    // never by its position in the list. An index-based key looked fine until
    // a filter changed: dropping two undecided matches renumbered everything
    // after them, so the next import would have written the whole tail a
    // second time under new slugs instead of updating what was already there.
    const existing = await prisma.match.findFirst({
      where: { tournamentId, teamAId: a.id, teamBId: b.id, scheduledAt },
      select: { id: true, stage: true, bracketKey: true, bracketLabel: true },
    });

    const data = {
      scheduledAt,
      status: m.played ? ("FINISHED" as const) : ("UPCOMING" as const),
      // What the page says, when it says anything. Otherwise from the series
      // score, not the number of maps: a Bo3 that ended 2-0 has only two maps,
      // and counting them would file it as a Bo1 — the winner needs
      // (bestOf + 1) / 2 map wins, so the format follows from the score.
      // A fixture has neither, and best-of-three is the common default.
      bestOf: m.bestOf ?? (m.played ? Math.max(1, Math.max(m.scoreA, m.scoreB) * 2 - 1) : 3),
      teamAScore: m.scoreA,
      teamBScore: m.scoreB,
      teamAId: a.id,
      teamBId: b.id,
      winnerId,
      // A known round is never overwritten with nothing. The same fixture can
      // reach here twice — once from a group table that names no round, once
      // from the bracket that does — and whichever arrives second would
      // otherwise decide. Only a real round replaces a real round.
      stage: m.stage ?? existing?.stage ?? null,
      bracketKey: m.bracket?.id ?? existing?.bracketKey ?? null,
      bracketLabel: m.bracket?.label ?? existing?.bracketLabel ?? null,
      tournamentId,
      gameId,
    };

    const match = existing
      ? await prisma.match.update({ where: { id: existing.id }, data })
      : await prisma.match.create({
          data: { slug: await freeSlug(`${prefix}-${a.name}-vs-${b.name}`), ...data },
        });

    // Maps are replaced wholesale: a re-import of a page whose result changed
    // must not leave the earlier maps behind alongside the new ones.
    await prisma.matchMap.deleteMany({ where: { matchId: match.id } });
    for (const map of m.maps) {
      await prisma.matchMap.create({
        data: {
          matchId: match.id,
          mapOrder: map.order,
          mapName: map.name,
          teamAScore: map.teamAScore,
          teamBScore: map.teamBScore,
          status: "FINISHED",
          winnerId: map.winner === 1 ? a.id : map.winner === 2 ? b.id : null,
        },
      });
    }
    written++;
  }

  return written;
}

/**
 * Records who took part, taken from the matches themselves.
 *
 * The participant list on a tournament page is written with team codes in a
 * separate section that is missing or incomplete on plenty of pages, whereas a
 * team that played a match in the event demonstrably attended it. Placement is
 * left null: it is not derivable from a match list without reconstructing the
 * bracket, and a guessed finish would be a claim about a real result.
 */
async function writeParticipants(
  tournamentId: string,
  matches: ParsedMatch[],
  resolve: (code: string) => { id: string; name: string } | null,
) {
  const teamIds = new Set<string>();
  for (const m of matches) {
    for (const code of [m.teamA, m.teamB]) {
      const team = resolve(code);
      if (team) teamIds.add(team.id);
    }
  }

  for (const teamId of teamIds) {
    await prisma.tournamentParticipant.upsert({
      where: { tournamentId_teamId: { tournamentId, teamId } },
      update: {},
      create: { tournamentId, teamId },
    });
  }
}

/** Prize distribution, keyed on place so a re-import updates rather than duplicates. */
async function writePrizes(tournamentId: string, slots: { placeFrom: number; placeTo: number; amount: number }[]) {
  for (const slot of slots) {
    await prisma.tournamentPrize.upsert({
      where: { tournamentId_placeFrom: { tournamentId, placeFrom: slot.placeFrom } },
      update: { placeTo: slot.placeTo, amount: slot.amount },
      create: { tournamentId, placeFrom: slot.placeFrom, placeTo: slot.placeTo, amount: slot.amount },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
