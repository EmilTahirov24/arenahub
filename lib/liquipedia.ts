/**
 * Liquipedia MediaWiki client and wikitext parsing.
 *
 * Liquipedia content is CC-BY-SA, which permits reuse **with attribution** — the
 * site credits it in the footer. Their API terms require a descriptive
 * User-Agent with contact details and a minimum gap between requests; both are
 * enforced here rather than left to each caller, because a violation gets the
 * whole IP banned.
 *
 * Their structured LPDB API is Enterprise-only (403 without a key), so team data
 * comes from page wikitext instead.
 *
 * No database and no framework imports, so scripts can use it directly.
 */
import { normaliseStage } from "./stages";

export const LIQUIPEDIA_URL = "https://liquipedia.net";

/**
 * Their documented floors: one request per 2s for ordinary queries, and one per
 * 30s for `action=parse`, which is far more expensive for them to serve. The two
 * are throttled separately so cheap calls are not slowed to the parse rate.
 */
const MIN_GAP_QUERY_MS = 2500;
const MIN_GAP_PARSE_MS = 31_000;

const lastCall = { query: 0, parse: 0 };

async function throttle(kind: "query" | "parse") {
  const gap = kind === "parse" ? MIN_GAP_PARSE_MS : MIN_GAP_QUERY_MS;
  const wait = lastCall[kind] + gap - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall[kind] = Date.now();
}

export type LiquipediaOptions = {
  /** Wiki subdomain: counterstrike, dota2, leagueoflegends, valorant. */
  wiki: string;
  /** Must identify the project and carry contact details, per their terms. */
  userAgent: string;
};

async function api(opts: LiquipediaOptions, params: Record<string, string>, kind: "query" | "parse" = "query") {
  await throttle(kind);
  const url = `${LIQUIPEDIA_URL}/${opts.wiki}/api.php?${new URLSearchParams({ format: "json", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": opts.userAgent, "Accept-Encoding": "gzip" } });
  if (!res.ok) throw new Error(`Liquipedia ${res.status} — ${url}`);
  return res.json();
}

/** Raw wikitext of a page, or null when the page does not exist. */
export async function fetchWikitext(opts: LiquipediaOptions, title: string): Promise<string | null> {
  const json = await api(opts, {
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    redirects: "1",
  });
  const page = Object.values(json?.query?.pages ?? {})[0] as
    | { missing?: string; revisions?: [{ slots: { main: { "*": string } } }] }
    | undefined;
  if (!page || page.missing !== undefined) return null;
  return page.revisions?.[0]?.slots?.main?.["*"] ?? null;
}

/**
 * Fully rendered HTML of a page.
 *
 * Needed for the VALORANT and League wikis, whose team pages use
 * `{{ActiveSquadAuto}}` — the roster is generated from Liquipedia's own database
 * at render time and simply is not present in the wikitext.
 */
export async function fetchRenderedHtml(opts: LiquipediaOptions, title: string): Promise<string | null> {
  const json = await api(opts, { action: "parse", page: title, prop: "text", redirects: "1" }, "parse");
  return json?.parse?.text?.["*"] ?? null;
}

/**
 * The wiki's own list of upcoming, live and just-finished matches.
 *
 * A tournament page only carries a schedule once the organiser has published
 * one — which can be days before the event, and never for the smaller ones. All
 * four wikis maintain this page from their match database instead, so it always
 * has the near future in it. It is the page worth polling.
 */
export async function fetchMatchTicker(opts: LiquipediaOptions): Promise<ParsedMatch[]> {
  const html = await fetchRenderedHtml(opts, "Liquipedia:Matches");
  return html ? parseRenderedMatches(html, opts.wiki) : [];
}

/** The team's home country, as written in the page infobox ("France"). */
export function parseTeamLocation(wikitext: string): string | null {
  const box = wikitext.match(/\{\{Infobox team[\s\S]{0,1500}/i);
  const loc = (box?.[0] ?? wikitext).match(/^\|\s*location\s*=\s*(.+)$/im);
  const value = cleanValue(loc?.[1]);
  return value || null;
}

/**
 * Squad members from rendered HTML, for the wikis that generate their rosters.
 *
 * Reads the roster table rows rather than the whole page: each row links to the
 * player's page, carries a flag image whose filename holds the country, and
 * usually a real name cell.
 */
export function parseSquadHtml(html: string, wiki: string): SquadMember[] {
  const members: SquadMember[] = [];
  const seen = new Set<string>();

  // The page renders "Active" and "Former" sections one after another, and a
  // second pair for staff. Only the first Active block is the current playing
  // roster — reading the whole page pulls in ex-players and coaches.
  const active = sliceActiveSection(html);

  for (const row of active.matchAll(/<tr[^>]*>[\s\S]{0,1200}?<\/tr>/g)) {
    const block = row[0];
    if (/former|inactive/i.test(block)) continue;
    // Team badges link to the same wiki; skip them so a squad row is required.
    if (/team-template-(image-icon|text)/.test(block) && !/flag/i.test(block)) continue;

    const link = block.match(new RegExp(`<a href="/${wiki}/([^"#]+)"[^>]*>([^<]{1,32})</a>`));
    if (!link) continue;
    const nickname = decodeEntities(link[2]).trim();
    if (!nickname || seen.has(nickname.toLowerCase())) continue;

    // Flags render as an image whose file name is the country, e.g. .../Fr_hd.png
    const flag = block.match(/\/([A-Za-z]{2})_hd\.png/) ?? block.match(/Flag\/([a-z]{2})\b/i);
    const real = block.match(/<td[^>]*>\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.\- ]{2,48})\s*<\/td>/);
    const realName = real ? decodeEntities(real[1]).trim() : null;

    if (STAFF_ROLE.test(realName ?? "")) continue;

    seen.add(nickname.toLowerCase());
    members.push({
      nickname,
      country: normaliseFlag(flag?.[1]),
      realName: realName && realName.toLowerCase() !== nickname.toLowerCase() ? realName : null,
      role: null,
      joinDate: null,
    });
  }

  return members;
}

/**
 * Everything between the first "Active" heading and the next heading — i.e. the
 * current playing roster, without the "Former" list or the staff tables that
 * follow it.
 */
function sliceActiveSection(html: string): string {
  const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]{0,300}?)<\/h[23]>/g)];
  for (let i = 0; i < headings.length; i++) {
    const text = headings[i][1].replace(/<[^>]+>/g, " ").trim();
    if (!/^active\b/i.test(text)) continue;
    const start = headings[i].index! + headings[i][0].length;
    const end = headings[i + 1]?.index ?? html.length;
    return html.slice(start, end);
  }
  return html;
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Page titles matching a search term, best match first. */
export async function searchPages(opts: LiquipediaOptions, term: string, limit = 5): Promise<string[]> {
  const json = await api(opts, { action: "query", list: "search", srsearch: term, srlimit: String(limit) });
  return (json?.query?.search ?? []).map((r: { title: string }) => r.title);
}

/**
 * Titles beneath a page, e.g. ".../Group Stage" and ".../Playoffs".
 *
 * Large events split their brackets across subpages and leave only the infobox
 * on the parent, so an importer that reads just the given title finds no
 * matches at all. Listing beats scraping the tab markup, which varies by wiki.
 */
export async function listSubpages(opts: LiquipediaOptions, title: string, limit = 30): Promise<string[]> {
  const json = await api(opts, {
    action: "query",
    list: "allpages",
    apprefix: `${title}/`,
    aplimit: String(limit),
  });
  return (json?.query?.allpages ?? []).map((p: { title: string }) => p.title);
}

/**
 * Pages filed under a category, e.g. "S-Tier Tournaments".
 *
 * Tournament page titles are hierarchical and inconsistent across wikis —
 * "Intel Extreme Masters/2026/Cologne" on one, "2025 Season World
 * Championship" on another — so they cannot be constructed from the event
 * name. The wiki's own categories list the real titles, which beats guessing
 * and then silently importing nothing.
 */
export async function categoryMembers(
  opts: LiquipediaOptions,
  category: string,
  limit = 200,
): Promise<string[]> {
  const titles: string[] = [];
  let cont: string | undefined;

  do {
    const json = await api(opts, {
      action: "query",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmlimit: "500",
      cmnamespace: "0",
      ...(cont ? { cmcontinue: cont } : {}),
    });
    for (const page of json?.query?.categorymembers ?? []) {
      titles.push((page as { title: string }).title);
    }
    cont = json?.continue?.cmcontinue;
  } while (cont && titles.length < limit);

  return titles.slice(0, limit);
}

export type TeamNames = {
  /** Wiki page title, e.g. "Team Vitality". */
  page: string;
  /** Display abbreviation, e.g. "Vitality". */
  short: string;
};

/**
 * Turns the short codes used in match templates into real team names:
 * `vit` into "Team Vitality" / "Vitality".
 *
 * Matches name teams by code (`{{TeamOpponent|vit}}`), and those codes are not
 * wiki pages — they live in Liquipedia's team-template database, so neither a
 * page lookup nor a redirect finds them. `action=expandtemplates` asks the wiki
 * to render `{{TeamShort|vit}}` and hands back the markup it would show,
 * carrying both spellings:
 *
 *   <span data-highlightingclass="Team Vitality" ...>
 *     <span class="team-template-text">[[Team Vitality|Vitality]]</span>
 *
 * Both are returned because organisations are known by either, and a database
 * may hold one or the other. Deriving a name from the letters of the code
 * instead would eventually credit a real result to the wrong organisation.
 *
 * Codes are expanded in batches behind literal markers, since one request per
 * code would take minutes at the required rate. Unknown codes render nothing
 * recognisable and are simply absent from the result.
 */
export async function resolveTeamCodes(
  opts: LiquipediaOptions,
  codes: string[],
): Promise<Map<string, TeamNames>> {
  const out = new Map<string, TeamNames>();
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  const BATCH = 40;

  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    // A marker rather than a separator regex: codes contain dots and digits
    // ("bounty.br", "legion.pk"), and this keeps the split purely literal.
    const marker = (code: string) => `@@${code}@@`;
    const text = batch.map((c) => `${marker(c)}{{TeamShort|${c}}}`).join("");
    const json = await api(opts, { action: "expandtemplates", prop: "wikitext", text });
    const rendered: string = json?.expandtemplates?.wikitext ?? "";

    for (const [n, code] of batch.entries()) {
      const from = rendered.indexOf(marker(code));
      if (from === -1) continue;
      const next = n + 1 < batch.length ? rendered.indexOf(marker(batch[n + 1]), from) : -1;
      const segment = rendered.slice(from, next === -1 ? undefined : next);

      const page = segment.match(/data-highlightingclass="([^"]+)"/)?.[1];
      if (!page) continue;
      const short = segment.match(/team-template-text"[^>]*>\s*\[\[[^\]|]+\|([^\]]+)\]\]/)?.[1];
      out.set(code, { page: decodeEntities(page).trim(), short: decodeEntities(short ?? page).trim() });
    }
  }

  return out;
}

export type SquadMember = {
  nickname: string;
  /** ISO-3166 alpha-2, uppercased. Liquipedia writes it lowercase. */
  country: string | null;
  realName: string | null;
  role: string | null;
  joinDate: string | null;
};

/**
 * Members of the active squad on a team page.
 *
 * The wikitext looks like:
 *   {{Squad|status=active
 *    |{{Person|flag=hu|id=torzsi|name=Ádám Torzsás|joindate=2022-01-03}}
 *    |{{Person|flag=il|id=xertioN|igl=y|name=Dorian Berman|...}}
 *   }}
 *
 * Only `status=active` blocks are read — a team page also lists former players
 * and inactive squads, and importing those would put people on rosters they
 * left. Entries carrying a `leavedate` are skipped for the same reason.
 *
 * `type=staff` blocks are excluded too: a team page lists coaches, managers and
 * even the org's founder in the same `status=active` shape, and they are not
 * players.
 */
export function parseActiveSquad(wikitext: string): SquadMember[] {
  const members: SquadMember[] = [];
  const seen = new Set<string>();

  // Squad blocks are nested, so match from the header to the next Squad header
  // (or end) rather than trying to balance braces.
  const blocks = wikitext.split(/\{\{Squad\b/i).slice(1);

  for (const block of blocks) {
    const header = block.slice(0, 200);
    if (!/status\s*=\s*active/i.test(header)) continue;
    if (/type\s*=\s*staff/i.test(header)) continue;

    for (const m of block.matchAll(/\{\{Person\s*\|([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}/gi)) {
      const fields = parseFields(m[1]);
      const nickname = fields.id?.trim();
      if (!nickname || seen.has(nickname.toLowerCase())) continue;
      if (fields.leavedate) continue;
      if (fields.manager === "y" || STAFF_ROLE.test(cleanValue(fields.role))) continue;
      seen.add(nickname.toLowerCase());

      members.push({
        nickname,
        country: normaliseFlag(fields.flag),
        realName: cleanValue(fields.name) || null,
        role: fields.igl === "y" ? "IGL" : (cleanValue(fields.role) || null),
        joinDate: fields.joindate?.trim().slice(0, 10) || null,
      });
    }
  }

  return members;
}

/**
 * Liquipedia's flag codes are mostly ISO 3166-1 alpha-2 but not entirely — it
 * writes `uk` for the United Kingdom, where the ISO code is `gb`, and uses a few
 * non-country labels. Anything unrecognised is dropped rather than guessed,
 * since a wrong flag misstates a real person's nationality.
 */
/**
 * Non-playing roles. Excluding `type=staff` blocks is not enough on its own —
 * coaches and analysts also appear inside ordinary active squad blocks carrying
 * a `role`, and importing them would list staff as players.
 */
const STAFF_ROLE = /coach|manager|analyst|founder|ceo|owner|director|scout|psycholog|content|streamer/i;

const FLAG_ALIASES: Record<string, string> = { UK: "GB", EN: "GB", SCO: "GB", WAL: "GB", NIR: "GB" };
const NON_COUNTRY = new Set(["EUROPE", "WORLD", "ASIA", "AMERICA", "CIS", "OCEANIA", "AFRICA"]);

function normaliseFlag(raw?: string): string | null {
  if (!raw) return null;
  const value = raw.trim().toUpperCase();
  if (!value || NON_COUNTRY.has(value)) return null;
  const code = FLAG_ALIASES[value] ?? value.slice(0, 2);
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** `|a=1|b=2` into `{ a: "1", b: "2" }`, tolerating whitespace and refs. */
function parseFields(inner: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of inner.split("|")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    if (key) out[key] = part.slice(eq + 1);
  }
  return out;
}

/**
 * Strip citation markup and wiki links that ride along inside field values.
 *
 * Entities are decoded last: editors write `&nbsp;` to keep an event name from
 * wrapping, and left alone it reaches the page as the literal text
 * "VALORANT Masters Santiago&nbsp;2026".
 */
function cleanValue(value?: string): string {
  if (!value) return "";
  return decodeEntities(
    value
      .replace(/<ref[^>]*\/>/gi, "")
      .replace(/<ref[\s\S]*?<\/ref>/gi, "")
      .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
      .replace(/'{2,}/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ *
 * Tournaments and matches
 * ------------------------------------------------------------------ */

/**
 * Bodies of every `{{Name|...}}` template in the page, brace-balanced.
 *
 * Regex cannot do this: a match template contains map templates, which contain
 * their own templates, so `\{\{Match[\s\S]*?\}\}` stops at the first inner
 * closer and truncates the match. This walks the string counting `{{` and `}}`
 * instead, and returns everything between the template name and its own closer.
 */
function templateBodies(text: string, name: string): string[] {
  return templateSpans(text, name).map((s) => s.inner);
}

/**
 * The same walk, keeping where each template sat in the page.
 *
 * A match's round is not written inside the match — it is a comment above the
 * group of matches that share it, or the title of the list they are in. Placing
 * a match therefore needs its offset, not just its contents.
 */
type TemplateSpan = { inner: string; start: number; end: number };

function templateSpans(text: string, name: string): TemplateSpan[] {
  const out: TemplateSpan[] = [];
  const opener = new RegExp(`\\{\\{\\s*${name}\\s*(?=[|}\\n])`, "gi");

  for (const m of text.matchAll(opener)) {
    const start = m.index!;
    let depth = 0;
    let i = start;
    while (i < text.length) {
      if (text.startsWith("{{", i)) {
        depth++;
        i += 2;
      } else if (text.startsWith("}}", i)) {
        depth--;
        i += 2;
        if (depth === 0) {
          out.push({ inner: text.slice(start + m[0].length, i - 2), start, end: i });
          break;
        }
      } else {
        i++;
      }
    }
  }
  return out;
}

/**
 * Template parameters, split on the pipes that belong to *this* template.
 *
 * `parseFields` splits on every `|`, which is right for a flat `{{Person}}` but
 * wrong here — `|opponent1={{TeamOpponent|MOUZ|score=2}}` would be torn into
 * three fields. Nesting depth is tracked so only top-level pipes separate.
 */
function splitParams(inner: string): { positional: string[]; named: Record<string, string> } {
  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  let i = 0;

  while (i < inner.length) {
    const pair = inner.slice(i, i + 2);
    if (pair === "{{" || pair === "[[") {
      depth++;
      buf += pair;
      i += 2;
    } else if (pair === "}}" || pair === "]]") {
      depth--;
      buf += pair;
      i += 2;
    } else if (inner[i] === "|" && depth <= 0) {
      parts.push(buf);
      buf = "";
      i++;
    } else {
      buf += inner[i];
      i++;
    }
  }
  parts.push(buf);

  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (const part of parts) {
    // Only a `=` outside any nested template names a parameter.
    const eq = topLevelEquals(part);
    if (eq === -1) {
      const value = part.trim();
      if (value) positional.push(value);
    } else {
      named[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
    }
  }
  return { positional, named };
}

function topLevelEquals(part: string): number {
  let depth = 0;
  for (let i = 0; i < part.length; i++) {
    const pair = part.slice(i, i + 2);
    if (pair === "{{" || pair === "[[") {
      depth++;
      i++;
    } else if (pair === "}}" || pair === "]]") {
      depth--;
      i++;
    } else if (part[i] === "=" && depth <= 0) {
      return i;
    }
  }
  return -1;
}

export type TournamentInfo = {
  name: string | null;
  series: string | null;
  organizer: string | null;
  startDate: string | null;
  endDate: string | null;
  prizePool: string | null;
  currency: string | null;
  city: string | null;
  country: string | null;
  /** Liquipedia tier: "1" is a major, "2" a large event, and so on. */
  tier: string | null;
};

/** Header facts of a tournament page, from its `{{Infobox league}}`. */
export function parseTournamentInfo(wikitext: string): TournamentInfo {
  const body = templateBodies(wikitext, "Infobox league")[0];
  if (!body) {
    return {
      name: null, series: null, organizer: null, startDate: null, endDate: null,
      prizePool: null, currency: null, city: null, country: null, tier: null,
    };
  }
  const { named } = splitParams(body);
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const value = cleanValue(named[k]);
      if (value) return value;
    }
    return null;
  };
  return {
    name: get("name"),
    series: get("series"),
    organizer: get("organizer", "organizer1"),
    startDate: normaliseDate(get("sdate", "startdate", "date")),
    endDate: normaliseDate(get("edate", "enddate", "date")),
    prizePool: get("prizepool", "prizepoolusd"),
    currency: get("localcurrency"),
    city: get("city"),
    country: get("country"),
    tier: get("liquipediatier"),
  };
}

export type ParsedMap = {
  order: number;
  name: string;
  teamAScore: number;
  teamBScore: number;
  winner: 1 | 2 | null;
};

export type ParsedMatch = {
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  /** ISO date-time, or null when the page gives no date. */
  date: string | null;
  winner: 1 | 2 | null;
  maps: ParsedMap[];
  /** True once a side has a score; brackets pre-declare empty future matches. */
  played: boolean;
  /** Series format when the page states it — a fixture has no score to infer it from. */
  bestOf: number | null;
  /** Canonical round name, or null when the page does not say. See `lib/stages`. */
  stage: string | null;
  /**
   * Liquipedia's id for the bracket this match sits in, and the heading above
   * it. One page holds several brackets and their rounds share names, so the
   * round alone cannot say which tree a match belongs to.
   */
  bracket: { id: string; label: string | null } | null;
  /** Tournament page title, when the block names it (the wiki-wide list does). */
  tournament?: string | null;
};

/**
 * Which round each match on a page belongs to.
 *
 * Liquipedia does not put the round inside `{{Match}}`. It writes it once above
 * the group of matches that share it, as an ordinary HTML comment:
 *
 *   {{Bracket|Bracket/8|id=U9J2NxNQ87
 *   <!-- Quarterfinals -->
 *   |R1M1={{Match ...}}
 *   |R1M2={{Match ...}}
 *   <!-- Semifinals -->
 *   |R2M1={{Match ...}}
 *
 * So a match's round is the last such comment above it, inside the same
 * bracket. The bracket boundary matters: a page holds several brackets and the
 * last comment of one must not leak onto the first match of the next.
 *
 * The round is NOT derived from the `R1M1` key, tempting as that looks. In a
 * double-elimination bracket `R1M1` is an upper-bracket quarterfinal while
 * `R1M5` is lower-bracket round one — the same round number, two different
 * rounds — so arithmetic on the key would confidently mislabel half the page.
 *
 * Comments are also where editors leave notes to each other ("Don't add
 * unofficial stream, thank you", "Server issues: 8647024943"). `normaliseStage`
 * accepts only names from a closed vocabulary, so those are simply not rounds.
 */
type MatchContext = {
  stage: string | null;
  bracket: { id: string; label: string | null } | null;
};

function stageResolver(wikitext: string): (at: number) => MatchContext {
  const matchSpans = templateSpans(wikitext, "Match");

  // A comment inside a match body belongs to that match's own contents and
  // says nothing about the round of the matches that follow it.
  const inSomeMatch = (at: number) => matchSpans.some((s) => at > s.start && at < s.end);

  const comments: { at: number; label: string }[] = [];
  for (const m of wikitext.matchAll(/<!--([\s\S]{0,60}?)-->/g)) {
    const label = normaliseStage(m[1]);
    if (label && !inSomeMatch(m.index!)) comments.push({ at: m.index!, label });
  }

  // Section headings, so each bracket can be named. The wikis wrap the title of
  // a stage in a template — `=== {{Stage|Playoffs}} ===` — which is unwrapped
  // here so the heading reads as it does on the rendered page.
  const headings: { at: number; text: string }[] = [];
  for (const m of wikitext.matchAll(/^(={2,4})\s*(.+?)\s*\1\s*$/gm)) {
    const text = m[2]
      .replace(/\{\{\s*Stage\s*\|\s*([^|}]+)[^}]*\}\}/gi, "$1")
      .replace(/\[\[[^\]|]*\|?([^\]]*)\]\]/g, "$1")
      .replace(/['"=]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) headings.push({ at: m.index!, text });
  }

  const brackets = templateSpans(wikitext, "Bracket").map((span) => {
    let label: string | null = null;
    for (const h of headings) {
      if (h.at < span.start) label = h.text;
      else break;
    }
    return {
      start: span.start,
      end: span.end,
      // The id is Liquipedia's own and survives edits to the page, so a
      // re-import files the same match under the same bracket. Only the
      // fallback is positional, and only when a page omits the id.
      //
      // The comment on the next line is part of the parameter's value — the
      // pipe that ends it comes after it — so it is stripped here. Left in, the
      // key read "l39GRuAus7 <!-- Quarterfinals -->".
      id: cleanValue(splitParams(span.inner).named.id?.replace(/<!--[\s\S]*?-->/g, "")) || `pos-${span.start}`,
      label,
    };
  });

  // A match list carries its round in a `title=` parameter instead — that is
  // how group stages and single rounds outside a bracket are written.
  const lists: { start: number; end: number; label: string }[] = [];
  for (const span of templateSpans(wikitext, "Matchlist")) {
    const label = normaliseStage(cleanValue(splitParams(span.inner).named.title));
    if (label) lists.push({ start: span.start, end: span.end, label });
  }

  return (at: number) => {
    const list = lists.find((l) => at > l.start && at < l.end);
    if (list) return { stage: list.label, bracket: null };

    const bracket = brackets.find((b) => at > b.start && at < b.end);
    if (!bracket) return { stage: null, bracket: null };

    let stage: string | null = null;
    for (const c of comments) {
      if (c.at > bracket.start && c.at < at) stage = c.label;
      else if (c.at >= at) break;
    }
    return { stage, bracket: { id: bracket.id, label: bracket.label } };
  };
}

/**
 * Every match on a tournament page.
 *
 * They are written the same way wherever they appear — inside `{{Bracket}}` as
 * `R1M2={{Match|...}}`, inside `{{Matchlist}}` as `M1={{Match|...}}` — so the
 * containers are ignored and all `{{Match}}` templates are read directly:
 *
 *   {{Match
 *    |opponent1={{TeamOpponent|MOUZ|score=2}}
 *    |opponent2={{TeamOpponent|Vitality|score=1}}
 *    |date=2026-01-20 - 18:00 {{Abbr/CET}}
 *    |map1={{Map|map=Mirage|score1=13|score2=8|winner=1}}
 *   }}
 *
 * Matches with an unnamed opponent are dropped: a bracket declares its later
 * rounds before anyone has qualified, and those placeholder slots are empty.
 */
export function parseMatches(wikitext: string): ParsedMatch[] {
  const out: ParsedMatch[] = [];
  const stageAt = stageResolver(wikitext);

  for (const span of templateSpans(wikitext, "Match")) {
    const { named } = splitParams(span.inner);
    const a = parseOpponent(named.opponent1);
    const b = parseOpponent(named.opponent2);
    if (!a?.name || !b?.name) continue;

    const maps: ParsedMap[] = [];
    for (let n = 1; n <= 9; n++) {
      const raw = named[`map${n}`];
      if (!raw) continue;
      const map = parseMap(raw, maps.length + 1);
      if (map) maps.push(map);
    }

    // Prefer the opponents' own scores; fall back to counting won maps, which
    // is how series with per-map results but no series score are written.
    const fromMaps = {
      a: maps.filter((m) => m.winner === 1).length,
      b: maps.filter((m) => m.winner === 2).length,
    };
    const scoreA = a.score ?? fromMaps.a;
    const scoreB = b.score ?? fromMaps.b;

    const declared = cleanValue(named.winner);
    const winner: 1 | 2 | null =
      declared === "1" ? 1 : declared === "2" ? 2 : scoreA > scoreB ? 1 : scoreB > scoreA ? 2 : null;

    out.push({
      teamA: a.name,
      teamB: b.name,
      scoreA,
      scoreB,
      date: normaliseDateTime(cleanValue(named.date)),
      winner,
      maps,
      played: /^(true|y|yes|1)$/i.test(cleanValue(named.finished)) || scoreA > 0 || scoreB > 0 || maps.length > 0,
      bestOf: intOrNull(named.bestof),
      ...stageAt(span.start),
    });
  }

  return out;
}

/**
 * Matches from a rendered tournament page.
 *
 * The VALORANT and League wikis keep no match data in their wikitext at all —
 * a page holds `|M1={{Match}}` and nothing else, because the results live in
 * Liquipedia's own match database and are filled in at render time. Reading
 * those wikis therefore means reading the HTML they produce.
 *
 * Every match, in a bracket or a match list alike, renders one info popup that
 * carries the whole result in a single uniform shape:
 *
 *   <span class="timer-object" data-timestamp="1757682000" data-finished="finished">
 *   <div class="match-info-header-opponent match-info-header-opponent-left ...">
 *       <a href="/valorant/Paper_Rex" title="Paper Rex">
 *   <span class="match-info-header-scoreholder-score match-info-header-winner">2</span>
 *   <span class="match-info-header-scoreholder-lower">(Bo3)</span>
 *
 * Team names come back as page titles, the same form `resolveTeamCodes`
 * returns, so both routes feed the caller identical names.
 */
/* ------------------------------------------------------------------ *
 * Rounds on a rendered page
 * ------------------------------------------------------------------ */

/** From `<div` at `start`, the index just past its matching `</div>`. */
function divEnd(html: string, start: number): number {
  const re = /<div[\s>]|<\/div>/g;
  re.lastIndex = start;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0] === "</div>") {
      depth--;
      if (depth === 0) return re.lastIndex;
    } else depth++;
  }
  return html.length;
}

/** Class list membership. `\b` is useless here: `-` is a word boundary, so
 *  `\bbrkts-match\b` also matches `brkts-match-info-popup`. */
function hasClass(attrs: string, token: string): boolean {
  const cls = /class="([^"]*)"/.exec(attrs)?.[1];
  return cls ? cls.split(/\s+/).includes(token) : false;
}

/**
 * The round names in one header row, left to right.
 *
 * Each name is written three times over — full, short, abbreviated — for the
 * three widths the bracket renders at, and the full form is repeated once as
 * the div's own text before the options begin. Only the first is wanted.
 */
function roundHeaderNames(row: string): string[] {
  const out: string[] = [];
  for (const m of row.matchAll(
    /<div class="brkts-header brkts-header-div"[^>]*>([\s\S]*?)<div class="brkts-header-option"/g,
  )) {
    let text = decodeEntities(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    const half = text.length / 2;
    if (text.length % 2 === 0 && text.slice(0, half) === text.slice(half)) text = text.slice(0, half);
    if (text) out.push(text);
  }
  return out;
}

type RenderedMatch = { key: string; winner: string | null; teams: string[]; bracketId: string | null };

/**
 * Section heading above a point in the page, so a bracket can be named.
 *
 * The rendered page keeps the same headings the wikitext has — "Playoffs",
 * "Group Stage", "Main Event" — which is what the event page groups by.
 */
function headingBefore(html: string, at: number): string | null {
  let text: string | null = null;
  for (const m of html.matchAll(/<h[234][^>]*>([\s\S]{0,120}?)<\/h[234]>/g)) {
    if (m.index! >= at) break;
    const cleaned = decodeEntities(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (cleaned) text = cleaned;
  }
  return text;
}

/** Identity shared with `parseRenderedMatches`, so the two can be joined. */
function renderedKey(teamA: string, teamB: string, timestamp: string): string {
  return `${teamA}|${teamB}|${timestamp}`;
}

/** Teams, winner and identity of one `brkts-match` block. */
function readMatchBlock(block: string, wiki: string): RenderedMatch | null {
  const sides = splitOn(block, '<div class="match-info-header-opponent');
  if (sides.length < 2) return null;
  const left = sides.find((s) => s.startsWith(" match-info-header-opponent-left")) ?? sides[0];
  const right = sides.find((s) => s !== left) ?? sides[1];
  const teamA = teamNameFrom(left, wiki);
  const teamB = teamNameFrom(right, wiki);
  if (!teamA || !teamB) return null;

  const scores = [...block.matchAll(/scoreholder-score[^"]*"[^>]*>\s*([\dWLF-]+)\s*</g)].map((m) => m[1]);
  const a = Number.parseInt(scores[0] ?? "", 10) || 0;
  const b = Number.parseInt(scores[1] ?? "", 10) || 0;
  const timestamp = block.match(/data-timestamp="(\d+)"/)?.[1] ?? "";

  return {
    key: renderedKey(teamA, teamB, timestamp),
    winner: a > b ? teamA : b > a ? teamB : null,
    teams: [teamA, teamB],
    // Every match links to its own page in Liquipedia's match database, and the
    // id there is prefixed with the bracket's own — "Match:ID CHAMP25GrA 0001".
    // That prefix is stable across edits to the page, which a byte offset into
    // the HTML is not: a paragraph added above would renumber every bracket and
    // split each one in two on the next import.
    bracketId: block.match(/title="Match:ID ([^ "]+)/)?.[1] ?? null,
  };
}

/**
 * Which round each match on a RENDERED page belongs to.
 *
 * These wikis publish no match data in wikitext, so the round is not written
 * anywhere as text. It is in the shape of the markup: Liquipedia renders a
 * bracket as a recursive tree, where the container of a match also contains the
 * whole sub-bracket that feeds it —
 *
 *   brkts-round-body                 <- the final
 *     brkts-round-lower
 *       brkts-round-body             <- a semifinal
 *         brkts-round-lower
 *           brkts-round-body  ...    <- its two quarterfinals
 *         brkts-round-center  match  <- the semifinal itself
 *     brkts-round-center  match      <- the final itself
 *
 * so **how deeply a match is nested is its round**, counted from the right. The
 * header row above lists the round names left to right, and the two line up.
 *
 * An earlier pass through this file concluded the mapping could not be read and
 * left these wikis without rounds. That was wrong, and wrong in a specific way:
 * it looked for one container per column and found a single `brkts-round-body`
 * holding everything, without noticing that the columns were nested inside it.
 *
 * Nothing here is trusted on structure alone. `verifyChain` re-derives the
 * bracket from the results — the winner of a match must appear in the next
 * round — and a bracket that fails is returned with no rounds at all rather
 * than with guessed ones.
 */
function renderedStages(
  html: string,
  wiki: string,
): Map<string, { stage: string; bracketId: string; bracketLabel: string | null }> {
  const out = new Map<string, { stage: string; bracketId: string; bracketLabel: string | null }>();
  const headerRows = [...html.matchAll(/<div class="brkts-round-header"/g)].map((m) => m.index!);
  const rows: ParsedRow[] = [];

  for (let i = 0; i < headerRows.length; i++) {
    const names = roundHeaderNames(html.slice(headerRows[i], divEnd(html, headerRows[i])));
    if (names.length === 0) continue;

    // A double-elimination bracket nests its lower half inside the upper one and
    // gives it its own header row, so each row owns only the markup up to the
    // next row. Reading past it would file lower-bracket matches under upper
    // rounds — the two halves reach identical depths.
    const from = divEnd(html, headerRows[i]);
    const stopAt = headerRows[i + 1] ?? html.length;

    const byDepth = new Map<number, RenderedMatch[]>();
    const re = /<div([^>]*)>|<\/div>/g;
    re.lastIndex = from;
    const isBodyStack: boolean[] = [];
    let open = 0;
    let bodyDepth = 0;
    let m: RegExpExecArray | null;

    while ((m = re.exec(html))) {
      if (m.index >= stopAt) break;
      if (m[0] === "</div>") {
        open--;
        if (open < 0) break;
        if (isBodyStack.pop()) bodyDepth--;
        continue;
      }
      const attrs = m[1] ?? "";
      open++;
      const isBody = hasClass(attrs, "brkts-round-body");
      isBodyStack.push(isBody);
      if (isBody) bodyDepth++;
      if (hasClass(attrs, "brkts-match")) {
        const parsed = readMatchBlock(html.slice(m.index, divEnd(html, m.index)), wiki);
        if (parsed) (byDepth.get(bodyDepth) ?? byDepth.set(bodyDepth, []).get(bodyDepth)!).push(parsed);
      }
    }

    // Deepest first: that is the leftmost column, the one the header row names
    // first. A trailing header with no matches ("Qualified" is a column of
    // qualified-team boxes, not games) simply goes unused.
    const columns = [...byDepth.keys()].sort((a, b) => b - a).map((d) => byDepth.get(d)!);
    if (columns.length === 0 || columns.length > names.length) continue;
    if (!verifyChain(columns)) continue;

    // The bracket's own id, taken from the matches in it. A double-elimination
    // bracket writes two header rows but is ONE bracket, and its two halves
    // share this id — which is what keeps the upper and lower rounds of the
    // same event in one tree on the site.
    const bracketId =
      columns.flat().map((m) => m.bracketId).find(Boolean) ?? `r${headerRows[i]}`;
    const bracketLabel = headingBefore(html, headerRows[i]);

    for (let c = 0; c < columns.length; c++) {
      const stage = normaliseStage(names[c]);
      if (!stage) continue;
      for (const match of columns[c]) {
        out.set(match.key, { stage, bracketId, bracketLabel });
      }
    }

    rows.push({ names, columns, bracketId, bracketLabel });
  }

  attachGrandFinal(html, wiki, rows, out);
  return out;
}

type ParsedRow = {
  names: string[];
  columns: RenderedMatch[][];
  bracketId: string;
  bracketLabel: string | null;
};

/**
 * The grand final, which no header row's own region contains.
 *
 * A double-elimination bracket is one tree with the lower half nested inside
 * the upper, and Liquipedia puts the lower half's header row *inside* that
 * tree. Each row therefore owns the markup up to the next row — and the grand
 * final sits at the very outside, after the nested row, so it falls outside
 * every region. It is left with no round, and the most-watched match of the
 * event ends up in the "other matches" list.
 *
 * It is recovered by who is in it rather than by where it sits: the grand final
 * is the match between the winner of the upper bracket and the winner of the
 * lower one. Both are already known here, so the claim is checked rather than
 * guessed — no pair, no round.
 */
function attachGrandFinal(
  html: string,
  wiki: string,
  rows: ParsedRow[],
  out: Map<string, { stage: string; bracketId: string; bracketLabel: string | null }>,
): void {
  const winnerOfLastColumn = (row: ParsedRow): string | null => {
    const last = row.columns[row.columns.length - 1];
    return last?.length === 1 ? last[0].winner : null;
  };

  const blocks = allMatchBlocks(html, wiki);
  const done = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (done.has(row.bracketId)) continue;

    // The two halves of one bracket. A single-elimination bracket has only one
    // row and therefore no grand final to find.
    const other = rows.find((r, j) => j !== i && r.bracketId === row.bracketId);
    if (!other) continue;

    const upper = winnerOfLastColumn(row);
    const lower = winnerOfLastColumn(other);
    if (!upper || !lower || upper === lower) continue;

    // Exactly one, or none. Two teams that met twice outside the bracket give
    // no way to tell which meeting was the final, and a coin toss between them
    // is precisely the kind of guess this file refuses to make.
    const candidates = blocks
      .map(([, match]) => match)
      .filter((m) => !out.has(m.key) && m.teams.includes(upper) && m.teams.includes(lower));
    if (candidates.length !== 1) continue;

    out.set(candidates[0].key, {
      stage: "Grand Final",
      bracketId: row.bracketId,
      bracketLabel: row.bracketLabel,
    });
    done.add(row.bracketId);
  }
}

/**
 * Every match block on the page, in document order.
 *
 * Match lists are included as well as brackets, because the grand final is
 * often not drawn inside the bracket at all — the VCT league pages put it in a
 * list of its own below, and searching only the bracket would never find it.
 */
function allMatchBlocks(html: string, wiki: string): [number, RenderedMatch][] {
  const out: [number, RenderedMatch][] = [];
  for (const m of html.matchAll(/<div([^>]*)>/g)) {
    const attrs = m[1] ?? "";
    if (!hasClass(attrs, "brkts-match") && !hasClass(attrs, "brkts-matchlist-match")) continue;
    const parsed = readMatchBlock(html.slice(m.index!, divEnd(html, m.index!)), wiki);
    if (parsed) out.push([m.index!, parsed]);
  }
  return out;
}

/**
 * Does the parsed shape agree with who actually won?
 *
 * A bracket narrows, and a team reaches a round by winning the previous one.
 * Both are checked against the results, so a misread of the markup is caught
 * before it becomes a claim about a real team's run.
 *
 * Unplayed rounds are skipped rather than failed: a bracket that has only begun
 * has nothing to contradict yet.
 */
function verifyChain(columns: RenderedMatch[][]): boolean {
  for (let i = 0; i + 1 < columns.length; i++) {
    if (columns[i].length < columns[i + 1].length) return false;

    const winners = new Set(columns[i].map((m) => m.winner).filter(Boolean) as string[]);
    if (winners.size === 0) continue;

    const nextTeams = new Set(columns[i + 1].flatMap((m) => m.teams));
    if (![...winners].some((w) => nextTeams.has(w))) return false;
  }
  return true;
}

export function parseRenderedMatches(html: string, wiki: string): ParsedMatch[] {
  const out: ParsedMatch[] = [];

  // Rounds come from the shape of the bracket markup rather than from any text
  // in the popups, so they are worked out once for the page and joined on by
  // the same identity the deduplication below uses.
  const stages = renderedStages(html, wiki);

  // Two containers, one shape. A tournament page wraps each match in a popup
  // attached to its bracket; the wiki-wide match list on `Liquipedia:Matches`
  // uses a plain `match-info` block. The header inside is identical, so both
  // are split on and read the same way.
  const blocks = [
    ...splitOn(html, 'class="brkts-popup brkts-popup-container brkts-match-info-popup'),
    ...splitOn(html, '<div class="match-info">'),
  ];

  for (const popup of blocks) {
    const sides = splitOn(popup, '<div class="match-info-header-opponent');
    if (sides.length < 2) continue;

    // The left-hand block is opponent 1; on some layouts it is not first in
    // document order, so it is identified by its class rather than position.
    const left = sides.find((s) => s.startsWith(" match-info-header-opponent-left")) ?? sides[0];
    const right = sides.find((s) => s !== left) ?? sides[1];
    const teamA = teamNameFrom(left, wiki);
    const teamB = teamNameFrom(right, wiki);
    if (!teamA || !teamB) continue;

    // A fixture that has not been played yet renders a dash instead of a
    // score, so a missing number is read as nothing played rather than as a
    // reason to drop the match — the schedule is worth having too.
    const scores = [...popup.matchAll(/scoreholder-score[^"]*"[^>]*>\s*([\dWLF-]+)\s*</g)].map((m) => m[1]);
    const scoreA = Number.parseInt(scores[0] ?? "", 10) || 0;
    const scoreB = Number.parseInt(scores[1] ?? "", 10) || 0;

    const timestamp = Number.parseInt(popup.match(/data-timestamp="(\d+)"/)?.[1] ?? "", 10);
    const finished = /data-finished="finished"/.test(popup);

    const round = stages.get(renderedKey(teamA, teamB, popup.match(/data-timestamp="(\d+)"/)?.[1] ?? ""));

    out.push({
      teamA,
      teamB,
      scoreA,
      scoreB,
      bestOf: intOrNull(popup.match(/scoreholder-lower"[^>]*>\s*\(Bo(\d)\)/)?.[1]),
      // Liquipedia renders the timestamp in seconds; a placeholder future match
      // uses a sentinel far in the past, which `finished` already filters out.
      date: Number.isFinite(timestamp) ? new Date(timestamp * 1000).toISOString() : null,
      winner: scoreA > scoreB ? 1 : scoreB > scoreA ? 2 : null,
      maps: parseRenderedMaps(popup, wiki),
      played: finished && (scoreA > 0 || scoreB > 0),
      // Null unless the bracket both parsed and agreed with the results — see
      // `renderedStages`. A match outside any bracket (a group table, the
      // wiki-wide match list) has no round to have.
      stage: round?.stage ?? null,
      bracket: round ? { id: round.bracketId, label: round.bracketLabel } : null,
      tournament: tournamentNameFrom(popup),
    });
  }

  // A rendered page can show one fixture twice — a group table and the bracket
  // beside it both list the same game — and each copy would otherwise become
  // its own row. Two teams meeting twice at the same minute is not a thing, so
  // the trio identifies a match safely.
  const seen = new Set<string>();
  return out.filter((m) => {
    const key = `${m.teamA}|${m.teamB}|${m.date ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Individual maps or games inside a match popup. */
function parseRenderedMaps(popup: string, wiki: string): ParsedMap[] {
  const maps: ParsedMap[] = [];

  for (const row of splitOn(popup, 'class="brkts-popup-body-grid-row"')) {
    // Agent and champion portraits are links too, so the map is taken only
    // from a link sitting directly inside the spacer — the picks are nested a
    // further two elements deep and cannot match here.
    const link = row.match(new RegExp(`brkts-popup-spaced"[^>]*>\\s*<a href="/${wiki}/[^"]+" title="([^"]+)"`));
    const scores = [...row.matchAll(/detailed-scores-main-score[^"]*"[^>]*>\s*(\d+)\s*</g)].map((m) => Number(m[1]));

    // A League game has neither a map name nor a score, only a winner marker.
    const winnerSide = row.indexOf('data-label-type="result-win"');
    const loserSide = row.indexOf('data-label-type="result-loss"');
    if (!link && scores.length < 2 && winnerSide === -1) continue;

    const order = maps.length + 1;
    const a = scores[0] ?? 0;
    const b = scores[1] ?? 0;
    maps.push({
      order,
      name: decodeEntities(link?.[1] ?? `Game ${order}`),
      teamAScore: a,
      teamBScore: b,
      winner:
        a > b ? 1 : b > a ? 2 : winnerSide === -1 ? null : loserSide === -1 || winnerSide < loserSide ? 1 : 2,
    });
  }

  return maps;
}

/**
 * The event a match belongs to, as named in the wiki-wide match list.
 *
 * Only that list carries it — on a tournament page every match obviously
 * belongs to the page you are already on, so the field is absent there.
 */
function tournamentNameFrom(block: string): string | null {
  const at = block.indexOf("match-info-tournament-name");
  if (at === -1) return null;
  const title = block.slice(at).match(/title="([^"]+)"/)?.[1];
  if (!title) return null;

  // The link often points at a section — "VCT/2026/China League/Stage 2#Play-Ins".
  // The fragment is where on the page the match sits, not part of the event's
  // name, and it looks like a bug when it reaches the site.
  const name = decodeEntities(title).split("#")[0].trim();
  return name || null;
}

/**
 * The team's page title from an opponent block, e.g. "Paper Rex".
 *
 * Links pointing at a section are skipped. An opponent block sometimes also
 * carries a link back to the event page — ".../Open_Qualifier_2#Round_1" — and
 * taking its title filed the tournament itself as a team: 49 such rows had been
 * created and were showing on the site as opponents before this was noticed.
 *
 * `tournamentNameFrom` above trims the fragment for the same reason. Here
 * trimming would not help: the whole link is the wrong page, not just its tail,
 * so it is rejected instead. Skipping it lets a real team link later in the
 * block win.
 *
 * When nothing names the opponent, null is returned and the caller drops the
 * match — a fixture whose opponent we cannot identify is not worth importing.
 */
function teamNameFrom(block: string, wiki: string): string | null {
  const link = block.match(new RegExp(`<a href="/${wiki}/[^"#]+" title="([^"]+)"`));
  const dynamic = block.match(/data-team-name="([^"]+)"/);
  const name = decodeEntities(link?.[1] ?? dynamic?.[1] ?? "").trim();
  if (!name || /^(tbd|bye)$/i.test(name)) return null;
  // Some layouts carry the fragment in the title only, so the name is checked too.
  return name.includes("#") ? null : name;
}

/** Segments of `html` starting at each occurrence of `needle`. */
function splitOn(html: string, needle: string): string[] {
  const out: string[] = [];
  let from = html.indexOf(needle);
  while (from !== -1) {
    const next = html.indexOf(needle, from + needle.length);
    out.push(html.slice(from + needle.length, next === -1 ? undefined : next));
    from = next;
  }
  return out;
}

/** `{{TeamOpponent|MOUZ|score=2}}` — the name is positional, the score named. */
function parseOpponent(raw?: string): { name: string; score: number | null } | null {
  if (!raw) return null;
  const body = templateBodies(raw, "\\w*Opponent")[0];
  if (body === undefined) return null;
  const { positional, named } = splitParams(body);
  const name = cleanValue(positional[0] ?? named.name ?? named.team);
  if (!name || /^(tbd|bye)$/i.test(name)) return null;
  return { name, score: intOrNull(named.score) };
}

/**
 * `{{Map|map=Mirage|score1=13|score2=8|winner=1}}`, or the Counter-Strike form
 * that records rounds per half instead of a total.
 *
 * Returns null for the empty map slots a best-of series always declares — a
 * 2-0 Bo3 still writes `map3={{Map|map=Dust II}}`, and importing that as a
 * 0-0 map would invent a map that was never played.
 */
function parseMap(raw: string, order: number): ParsedMap | null {
  const body = templateBodies(raw, "Map")[0];
  if (body === undefined) return null;
  const { named } = splitParams(body);

  const declared = cleanValue(named.winner);
  const a = intOrNull(named.score1) ?? roundsWon(named, "1");
  const b = intOrNull(named.score2) ?? roundsWon(named, "2");
  if (a === null && b === null && !declared) return null;

  const name = cleanValue(named.map);
  return {
    order,
    // Dota and League record games without a map name; number them instead of
    // dropping them, since the game itself was played.
    name: !name || /^(tbd|unknown)$/i.test(name) ? `Game ${order}` : name,
    teamAScore: a ?? 0,
    teamBScore: b ?? 0,
    winner:
      declared === "1" ? 1 : declared === "2" ? 2 : (a ?? 0) > (b ?? 0) ? 1 : (b ?? 0) > (a ?? 0) ? 2 : null,
  };
}

/**
 * Rounds won on a Counter-Strike map, regulation plus every overtime.
 *
 * A map is written as halves — `t1t=8|t1ct=4` is team 1's T and CT halves — and
 * each overtime period repeats the pattern behind an `o<n>` prefix:
 *
 *   |t1firstside=ct|t1t=8|t1ct=4|t2t=8|t2ct=4      regulation, 12-12
 *   |o1t1t=2|o1t1ct=1|o1t2t=2|o1t2ct=1             first overtime, 3-3
 *   |o2t1t=1|o2t1ct=2|o2t2t=1|o2t2ct=2             second, 3-3
 *
 * Summing only the regulation halves would report every overtime map as a
 * 12-12 draw and hand the series to the wrong team, so all periods are added.
 * Null — not zero — when the map records no rounds at all, so callers can tell
 * "not played" from "lost every round".
 */
function roundsWon(named: Record<string, string>, side: "1" | "2"): number | null {
  const key = new RegExp(`^(?:o\\d+)?t${side}(?:t|ct)$`);
  let total = 0;
  let found = false;
  for (const [name, value] of Object.entries(named)) {
    if (!key.test(name)) continue;
    const rounds = intOrNull(value);
    if (rounds !== null) {
      total += rounds;
      found = true;
    }
  }
  return found ? total : null;
}

function intOrNull(value?: string): number | null {
  const n = Number.parseInt(cleanValue(value), 10);
  return Number.isFinite(n) ? n : null;
}

export type PrizeSlot = {
  placeFrom: number;
  placeTo: number;
  amount: number;
  /** Teams placed here, when the page records them. */
  teams: string[];
};

/**
 * Prize distribution from `{{Slot}}` rows in the prize-pool section.
 *
 * `place` is either a single position or a shared range ("3-4"). Non-numeric
 * places ("q" for qualified) are skipped — they carry no placement.
 */
export function parsePrizePool(wikitext: string): PrizeSlot[] {
  const out: PrizeSlot[] = [];

  // Two spellings are in use across the wikis and across page ages.
  const bodies = [...templateBodies(wikitext, "prize pool slot"), ...templateBodies(wikitext, "Slot")];

  for (const body of bodies) {
    const { named } = splitParams(body);
    const place = cleanValue(named.place);
    const range = place.match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
    if (!range) continue;

    const amount = parseMoney(cleanValue(named.usdprize) || cleanValue(named.localprize));
    if (amount === null) continue;

    const teams: string[] = [];
    for (const opponent of templateBodies(body, "\\w*Opponent")) {
      const name = cleanValue(splitParams(opponent).positional[0]);
      if (name && !/^(tbd|bye)$/i.test(name)) teams.push(name);
    }

    out.push({
      placeFrom: Number(range[1]),
      placeTo: Number(range[2] ?? range[1]),
      amount,
      teams,
    });
  }

  return out;
}

/**
 * A prize amount, or null when the field does not hold a plain number.
 *
 * A crowdfunded prize is written as a wiki expression rather than a figure, and
 * stripping the non-digits out of one splices its numbers together: The
 * International's slot came out as 424,989,738,330,480, which overflows the
 * column and brought the whole import down. So a value has to look like an
 * amount before it is read, and an implausible one is refused — showing no
 * prize is better than showing an invented one.
 */
export function parseMoney(raw: string): number | null {
  const value = raw.trim();
  if (!/^[\d\s,.]+$/.test(value) || !/\d/.test(value)) return null;
  const amount = Math.round(Number.parseFloat(value.replace(/[\s,]/g, "")));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return null;
  return amount;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * "2026-01-20" from the shapes a Liquipedia date takes.
 *
 * Infoboxes are written ISO, but match templates spell the month out
 * ("June 21, 2026"), so both are accepted. `Date.parse` is deliberately not
 * used: it reads a bare "2026-06-21" as UTC but "June 21, 2026" as local time,
 * which would shift dates by a day depending on where the import runs.
 */
function normaliseDate(value: string | null): string | null {
  if (!value) return null;

  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  const written = value.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (written) {
    const month = MONTHS.findIndex((m) => m.startsWith(written[1].toLowerCase().slice(0, 3)));
    if (month >= 0) {
      return `${written[3]}-${String(month + 1).padStart(2, "0")}-${written[2].padStart(2, "0")}`;
    }
  }
  return null;
}

/** "2026-01-20 - 18:00 {{Abbr/CET}}" into an ISO instant. */
function normaliseDateTime(value: string): string | null {
  const day = normaliseDate(value);
  if (!day) return null;
  const time = value.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!time) return `${day}T12:00:00Z`;
  const hh = time[1].padStart(2, "0");
  return `${day}T${hh}:${time[2]}:00Z`;
}

/** "Ádám Torzsás" into first and last name for our Player fields. */
export function splitName(realName: string | null): { firstName: string | null; lastName: string | null } {
  if (!realName) return { firstName: null, lastName: null };
  const parts = realName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
