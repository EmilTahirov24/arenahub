/**
 * Fills in the map breakdown of finished matches.
 *
 *   npx tsx scripts/import-maps.ts              # dry run
 *   npx tsx scripts/import-maps.ts --apply
 *   npx tsx scripts/import-maps.ts --limit 10   # first N tournaments only
 *
 * scripts/import-live.ts reads each wiki's own match list, and that list carries
 * a series score and nothing else — so every finished match on the site sat
 * under a 2-1 with an empty map section. The per-map results live on the
 * tournament pages, written as
 * `map1={{Map|map=Mirage|score1=13|score2=8|winner=1}}`, which lib/liquipedia.ts
 * already knows how to read.
 *
 * So the work is one page fetch per tournament that still has a match missing
 * its maps — `action=query`, the cheap endpoint, one every 2.5s. The set shrinks
 * as it succeeds, which is what makes this safe to leave in the schedule.
 *
 * A parsed series is accepted only when the two team names AND the series score
 * both agree with the row already held. Two teams can meet twice in one event,
 * and writing the other meeting's maps would be inventing a result.
 *
 * Content is CC-BY-SA; the site credits Liquipedia in the footer.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  fetchRenderedHtml,
  fetchWikitext,
  parseMatches,
  parseRenderedMatches,
  type ParsedMap,
  type ParsedMatch,
} from "../lib/liquipedia";
import { orgKey } from "../lib/orgNames";
import { syncMaps } from "../lib/matchMaps";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";

/** The same mapping scripts/import-live.ts uses; both run against these wikis. */
const WIKI_OF: Record<string, string> = {
  cs2: "counterstrike",
  dota2: "dota2",
  valorant: "valorant",
  lol: "leagueoflegends",
};

/** Both orders, so a page listing the teams the other way up still matches. */
function pairKeys(a: string, b: string) {
  const x = orgKey(a);
  const y = orgKey(b);
  return { forward: x + "|" + y, reverse: y + "|" + x };
}

/** Groups a page's parsed series by the two teams that played them. */
function indexByPair(parsed: ParsedMatch[]): Map<string, ParsedMatch[]> {
  const byPair = new Map<string, ParsedMatch[]>();
  for (const p of parsed) {
    const { forward } = pairKeys(p.teamA, p.teamB);
    const list = byPair.get(forward) ?? [];
    list.push(p);
    byPair.set(forward, list);
  }
  return byPair;
}

function hasCandidate(byPair: Map<string, ParsedMatch[]>, a: string, b: string): boolean {
  const { forward, reverse } = pairKeys(a, b);
  return byPair.has(forward) || byPair.has(reverse);
}

/** Turns the maps round when the page lists the two teams the other way up. */
function orient(maps: ParsedMap[], reversed: boolean): ParsedMap[] {
  if (!reversed) return maps;
  return maps.map((m) => ({
    ...m,
    teamAScore: m.teamBScore,
    teamBScore: m.teamAScore,
    winner: m.winner === 1 ? 2 : m.winner === 2 ? 1 : null,
  }));
}

async function main() {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  console.log(apply ? "REJIM: yazma (--apply)\n" : "REJIM: quru işlətmə — heç nə yazılmır\n");

  const pending = await prisma.match.findMany({
    where: { status: "FINISHED", maps: { none: {} }, tournament: { isNot: null } },
    select: {
      id: true,
      scheduledAt: true,
      teamAScore: true,
      teamBScore: true,
      teamAId: true,
      teamBId: true,
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
      tournament: { select: { name: true } },
      game: { select: { slug: true } },
    },
    orderBy: { scheduledAt: "desc" },
  });

  // One page fetch serves every match in the same event, so the work is grouped
  // by event rather than walked match by match.
  const groups = new Map<string, typeof pending>();
  for (const m of pending) {
    const wiki = WIKI_OF[m.game.slug];
    if (!wiki) continue;
    const key = wiki + " " + m.tournament!.name;
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }

  console.log(pending.length + " xəritəsiz matç, " + groups.size + " turnir səhifəsi\n");

  let pagesRead = 0;
  let matched = 0;
  let mapRows = 0;
  let noPage = 0;
  let noSeries = 0;
  let noMaps = 0;
  let mismatched = 0;

  for (const matches of groups.values()) {
    if (pagesRead >= limit) break;

    // Read off the rows rather than unpacked from the key: event titles hold
    // spaces and slashes ("Games of the Future/2026"), so any separator a key
    // could be split on is a guess.
    const wiki = WIKI_OF[matches[0].game.slug];
    const title = matches[0].tournament!.name;

    const opts = { wiki, userAgent: USER_AGENT };

    let wikitext: string | null = null;
    try {
      wikitext = await fetchWikitext(opts, title);
    } catch (e) {
      console.log("  XƏTA  " + title + " — " + (e as Error).message);
      continue;
    }
    pagesRead++;

    if (!wikitext) {
      noPage += matches.length;
      console.log("  yox   " + title + " — səhifə tapılmadı (" + matches.length + " matç)");
      continue;
    }

    // Two routes, cheap one first.
    //
    // An event whose page writes its matches out as `{{Match}}` templates is
    // readable straight from the wikitext, one request every 2.5s. Most current
    // events do not: they write `{{Matchlist|id=...}}` and keep the games in
    // Liquipedia's own match database, so the wikitext holds an id and nothing
    // else. For those the rendered page is the only source, and rendering is
    // their expensive endpoint — one request every 31s.
    //
    // Asking for the rendered page only once the cheap route has fallen short
    // keeps the slow request for the events that actually need it, and the whole
    // job shrinks as events fill in.
    //
    // "Fallen short" means any match still unaccounted for, not zero matches
    // found. A CS2 event usually writes its playoff bracket out as `{{Match}}`
    // and leaves the group stage in the match database, so the first pass at one
    // answered for four series out of eight and the other four were written off
    // as missing. The two sources are merged rather than swapped for the same
    // reason — each holds part of the event.
    let byPair = indexByPair(parseMatches(wikitext));
    let route = "wikitext";
    const covered = () => matches.filter((m) => hasCandidate(byPair, m.teamA.name, m.teamB.name)).length;

    if (covered() < matches.length) {
      let html: string | null = null;
      try {
        html = await fetchRenderedHtml(opts, title);
      } catch (e) {
        console.log("  XƏTA  " + title + " — " + (e as Error).message);
        continue;
      }
      if (html) {
        const fromHtml = indexByPair(parseRenderedMatches(html, wiki));
        if (!byPair.size) {
          byPair = fromHtml;
          route = "html";
        } else {
          for (const [pair, list] of fromHtml) byPair.set(pair, [...(byPair.get(pair) ?? []), ...list]);
          route = "ikisi";
        }
      }
    }

    let hit = 0;
    let wrote = 0;

    for (const m of matches) {
      const { forward, reverse } = pairKeys(m.teamA.name, m.teamB.name);
      const candidates = [
        ...(byPair.get(forward) ?? []).map((p) => ({ p, reversed: false })),
        ...(byPair.get(reverse) ?? []).map((p) => ({ p, reversed: true })),
      ];

      if (candidates.length === 0) {
        noSeries++;
        continue;
      }

      // The series score is the tie-breaker: two teams can meet more than once
      // in one event, and the maps of the wrong meeting are a fabricated result.
      const agrees = candidates.filter(({ p, reversed }) => {
        const a = reversed ? p.scoreB : p.scoreA;
        const b = reversed ? p.scoreA : p.scoreB;
        return a === m.teamAScore && b === m.teamBScore;
      });

      if (agrees.length === 0) {
        mismatched++;
        continue;
      }

      // Still ambiguous after the score check — same teams, same result, twice.
      // The date decides; where it cannot, the match is left alone.
      let chosen = agrees[0];
      if (agrees.length > 1) {
        const day = m.scheduledAt.toISOString().slice(0, 10);
        const sameTime = agrees.find(
          ({ p }) => p.date && new Date(p.date).getTime() === m.scheduledAt.getTime(),
        );
        const sameDay = agrees.find(({ p }) => p.date && p.date.slice(0, 10) === day);
        if (!sameTime && !sameDay) {
          mismatched++;
          continue;
        }
        chosen = sameTime ?? sameDay!;
      }

      const maps = orient(chosen.p.maps, chosen.reversed);
      if (maps.length === 0) {
        noMaps++;
        continue;
      }

      hit++;
      matched++;
      wrote += apply ? await syncMaps(prisma, m.id, maps, m.teamAId, m.teamBId) : maps.length;
    }

    mapRows += wrote;
    console.log(
      "  " + String(hit).padStart(3) + "/" + String(matches.length).padEnd(3) +
        " " + route.padEnd(8) + " " + title +
        (wrote ? "  — " + wrote + " xəritə" : ""),
    );
  }

  console.log(
    "\n" + pagesRead + " səhifə oxundu, " + matched + " matç uyğunlaşdı, " +
      mapRows + " xəritə " + (apply ? "yazıldı" : "yazılacaq") + ".",
  );
  const skipped = [
    noPage ? noPage + " səhifəsiz" : "",
    noSeries ? noSeries + " seriya tapılmadı" : "",
    mismatched ? mismatched + " hesab uyğun gəlmədi" : "",
    noMaps ? noMaps + " xəritəsiz seriya" : "",
  ].filter(Boolean);
  if (skipped.length) console.log("Buraxıldı: " + skipped.join(", ") + ".");
  if (!apply) console.log("\nTətbiq etmək üçün: --apply");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
