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

export const LIQUIPEDIA_ATTRIBUTION = "Liquipedia (CC BY-SA 3.0)";
export const LIQUIPEDIA_URL = "https://liquipedia.net";

/** Their documented floor is one request per 2s; a little margin costs nothing. */
const MIN_GAP_MS = 2500;

let lastCall = 0;

async function throttle() {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

export type LiquipediaOptions = {
  /** Wiki subdomain: counterstrike, dota2, leagueoflegends, valorant. */
  wiki: string;
  /** Must identify the project and carry contact details, per their terms. */
  userAgent: string;
};

async function api(opts: LiquipediaOptions, params: Record<string, string>) {
  await throttle();
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

/** Page titles matching a search term, best match first. */
export async function searchPages(opts: LiquipediaOptions, term: string, limit = 5): Promise<string[]> {
  const json = await api(opts, { action: "query", list: "search", srsearch: term, srlimit: String(limit) });
  return (json?.query?.search ?? []).map((r: { title: string }) => r.title);
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

/** Strip citation markup and wiki links that ride along inside field values. */
function cleanValue(value?: string): string {
  if (!value) return "";
  return value
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/'{2,}/g, "")
    .trim();
}

/** "Ádám Torzsás" into first and last name for our Player fields. */
export function splitName(realName: string | null): { firstName: string | null; lastName: string | null } {
  if (!realName) return { firstName: null, lastName: null };
  const parts = realName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
