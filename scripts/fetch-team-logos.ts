/**
 * Downloads team logos from Liquipedia into the repository.
 *
 *   npx tsx scripts/fetch-team-logos.ts            # dry run, shows what it found
 *   npx tsx scripts/fetch-team-logos.ts --apply    # writes public/teams/*.png
 *   npx tsx scripts/fetch-team-logos.ts --missing  # only teams with no file yet
 *
 * Why this touches no database. Setting Team.logoUrl needs the production
 * connection string, which is stored as a Vercel "Secret" and cannot be read
 * back out — not even by the owner. So the work is split in two: this half has
 * network access and writes files, and scripts/apply-team-logos.ts has database
 * access and writes rows. They meet at data/team-logos.json.
 *
 * Why the input list is a committed file rather than a query. The same reason:
 * picking "the top 20" requires the ratings, which live in that database. The
 * list in data/logo-teams.json was read off the live ranking page — our own
 * numbers, not a guess — and committing it means the choice is auditable
 * instead of being re-derived differently on every run.
 *
 * Which image. Liquipedia infoboxes carry `image` and `imagedark`. The site is
 * dark, so `imagedark` wins where it exists; many orgs only ship one file, and
 * `allmode` in the name means it works on either background.
 *
 * Rate. Page content is fetched with `action=query&prop=revisions`, which sits
 * in Liquipedia's 2s bucket, not the 30s bucket that `action=parse` uses. That
 * is a twelvefold difference and the reason this finishes in a minute rather
 * than ten. File URLs are resolved in one batched `imageinfo` call.
 *
 * Licensing, stated plainly: Liquipedia *text* is CC BY-SA and the footer
 * credits it. Team logos are trademarks and are not CC — they are used here to
 * identify the team they belong to, which is what every esports site does. The
 * files are copied to our own server rather than hotlinked, which is also what
 * Liquipedia's terms require.
 *
 * sharp comes in through Next rather than being a direct dependency. That is
 * fine for a tool that only ever runs on a developer machine, but it is the
 * reason for the explicit error below instead of a bare module-not-found.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { wikiForGame } from "../lib/wikis";

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";

/**
 * Their documented floor for ordinary queries is one per 2s; 2.6s leaves room.
 * Global rather than per wiki: the limit is on the client, not the subdomain,
 * so four wikis in one run must still share one queue.
 */
const GAP_MS = 2600;
/** 32px avatars on lists, larger on team pages; 256 covers both on retina. */
const SIZE = 256;

const OUT_DIR = path.join(process.cwd(), "public", "teams");
const MANIFEST = path.join(process.cwd(), "data", "team-logos.json");
const INPUT = path.join(process.cwd(), "data", "logo-teams.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(wiki: string, params: Record<string, string>) {
  await sleep(GAP_MS);
  const base = `https://liquipedia.net/${wiki}/api.php`;
  const url = `${base}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Encoding": "gzip" } });
  if (!res.ok) throw new Error(`Liquipedia ${res.status} — ${url}`);
  return res.json();
}

/**
 * Logos only. Liquipedia uploads org logos as transparent PNG (or SVG); the
 * JPEGs on a team page are photographs — `Spirit at LanDaLan 3.jpg` is a shot
 * of five people at an event, not a mark. Accepting them put a crowd photo on
 * the second-ranked team in the first run of this script.
 */
const IMAGE_EXT = [".png", ".svg", ".webp"];

/**
 * Infobox image field, preferring the dark-background variant.
 *
 * Read line by line rather than with a regex. Infobox parameters are already
 * one per line, so this is the shape the data actually has — and it keeps the
 * whole function free of escapes, which is what broke the first attempt.
 */
function logoFileFrom(wikitext: string): { dark: string; light: string } | null {
  const values = new Map<string, string>();
  for (const line of wikitext.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(1, eq).trim().toLowerCase();
    // The first value wins: fields of the same name can recur further down the page.
    if (!values.has(key)) values.set(key, trimmed.slice(eq + 1).trim());
  }

  // In MediaWiki titles an underscore is the same as a space, and the response
  // always comes back with a space. Without normalising here,
  // `PARIVISION_allmode.png` is found by the query but never matches the result
  // key, and the logo is lost.
  const usable = (value: string | undefined) =>
    value && IMAGE_EXT.some((ext) => value.toLowerCase().endsWith(ext))
      ? value.split("_").join(" ")
      : null;

  // TWO variants come back, not one.
  //
  // Only `imagedark` was taken at first - "the site is dark". The result was
  // measured in the light theme (2026-08-31): 58 of 127 logos are ENTIRELY
  // WHITE, invisible on a white card, and another 31 are borderline. So in the
  // light theme roughly half the teams simply had no logo.
  //
  // The Liquipedia infobox holds both: `image` for a light background,
  // `imagedark` for a dark one. Checked against Spirit, Paper Rex, Tundra,
  // Dplus and BRUTE: all five have a distinct light variant. Where there is
  // only one file (`allmode`) the two come back identical, which is correct -
  // that logo works on any background anyway.
  const dark = usable(values.get("imagedark")) ?? usable(values.get("image"));
  const light = usable(values.get("image")) ?? usable(values.get("imagedark"));
  return dark && light ? { dark, light } : null;
}

const MODES = ["allmode", "darkmode", "lightmode"];

/**
 * Other filenames that plausibly hold the same logo in a squarer crop.
 *
 * Two rewrites, and the boundary between them is the whole point.
 *
 * Dropping "full" is safe. Liquipedia uses it for the full lockup — icon plus
 * wordmark — and the file without it is the same artwork's icon, from the same
 * upload. Swapping the mode suffix is safe for the same reason.
 *
 * Dropping the *year* is not, and this was measured rather than assumed. The
 * infobox gives `Team Vitality 2026 full darkmode.png`; `Team Vitality
 * allmode.png` also exists, is nicely square, and is their previous crest with
 * the crossed swords. Same for `G2 Esports allmode.png`. A stale logo is worse
 * than a wide one, so the year stays.
 *
 * `alternates` keeps to the mode family. When the dark variant is being looked
 * for, a light file must not be a candidate, and the other way round -
 * otherwise the "closest to square" choice drops a dark logo into a light slot
 * and the problem we fixed comes back. `allmode` is in both lists, because by
 * definition it works on any background.
 */
function variantsOf(file: string, alternates: string[] = ["allmode", "darkmode"]): string[] {
  const dot = file.lastIndexOf(".");
  const stem = dot < 0 ? file : file.slice(0, dot);
  const ext = dot < 0 ? ".png" : file.slice(dot);

  const stems = new Set([stem]);
  if (stem.includes(" full ")) stems.add(stem.replace(" full ", " "));
  if (stem.endsWith(" full")) stems.add(stem.slice(0, -" full".length));

  const out = new Set<string>();
  for (const s of stems) {
    out.add(s + ext);
    const mode = MODES.find((m) => s.endsWith(` ${m}`));
    if (!mode) continue;
    const head = s.slice(0, s.length - mode.length);
    for (const other of alternates) out.add(head + other + ext);
  }
  return [...out];
}

/**
 * `wikiTitle` is set only where our name is not the Liquipedia title, and each
 * one was checked by hand. Guessing is not an option here: "Spirit" and
 * "Aurora" are both real pages for *other* organisations, so a near-miss does
 * not fail — it silently fits a rival's logo to the team.
 */
type Team = { slug: string; name: string; game: string; wikiTitle?: string };

async function main() {
  const apply = process.argv.includes("--apply");
  const only = process.argv.indexOf("--game") >= 0 ? process.argv[process.argv.indexOf("--game") + 1] : null;
  const all: Team[] = JSON.parse(readFileSync(INPUT, "utf8"));
  const byGame = only ? all.filter((t) => t.game === only) : all;

  // `--missing`: skips a team whose file is already there.
  //
  // As the list grows a full run takes minutes, thanks to Liquipedia's 2.6
  // second throttle, while what is actually being looked for each time is a few
  // new names. Without this flag, adding one team to the list meant fetching
  // the whole list again - which in practice discouraged growing it.
  //
  // The default does not change: without the flag everything is refreshed,
  // because that is the only way to catch a team whose logo has changed.
  const missingOnly = process.argv.includes("--missing");
  const teams = missingOnly
    ? byGame.filter((t) => !existsSync(path.join(OUT_DIR, `${t.slug}.png`)))
    : byGame;

  console.log(`teams: ${teams.length}${only ? ` (${only})` : ""}${apply ? "" : "  (DRY RUN)"}\n`);

  // 1. The file name out of each team's infobox.
  const found: {
    slug: string;
    name: string;
    wiki: string;
    file: string;
    fileLight: string;
    title: string;
  }[] = [];
  for (const team of teams) {
    const wiki = wikiForGame(team.game);
    if (!wiki) {
      console.log(`!  ${team.name.padEnd(20)} unrecognised game: ${team.game}`);
      continue;
    }
    let data;
    try {
      data = await api(wiki, {
        action: "query",
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        titles: team.wikiTitle ?? team.name,
        redirects: "1",
      });
    } catch (e) {
      console.log(`!  ${team.name.padEnd(20)} ${(e as Error).message}`);
      continue;
    }
    const page = data?.query?.pages?.[0];
    const text: string | undefined = page?.revisions?.[0]?.slots?.main?.content;
    if (!text) {
      console.log(`-  ${team.name.padEnd(20)} no page`);
      continue;
    }
    const file = logoFileFrom(text);
    if (!file) {
      console.log(`-  ${team.name.padEnd(20)} no image in the infobox`);
      continue;
    }
    const sameFile = file.dark === file.light;
    console.log(`+  ${team.name.padEnd(20)} ${file.dark}${sameFile ? "" : `  |  light: ${file.light}`}`);
    found.push({
      slug: team.slug,
      name: team.name,
      wiki,
      file: file.dark,
      fileLight: file.light,
      title: page?.title ?? "",
    });
  }

  if (found.length === 0) {
    console.log("\nNo logos were found.");
    return;
  }

  /**
   * Report, but do not act on, two teams landing on one Liquipedia page.
   *
   * The first version dropped both, on the reasoning that one of them must be
   * wrong. Running it over four wikis showed that reasoning was too narrow.
   * There are two quite different causes and only one is a fault:
   *
   *   G2 Gozen and G2 Esports both resolve to G2's page, as do Gentle Mates GC
   *   and Gentle Mates. These are separate rosters of one organisation, and one
   *   logo is the correct answer for both.
   *
   *   TEAM VISION resolves to PARIVISION because it is that organisation's
   *   former name. The logo is still right; what is wrong is that our database
   *   holds the same team twice.
   *
   * Neither is fixed by withholding a logo, and in the first case withholding
   * one would be a regression. So this prints what it saw and leaves the rows
   * alone — a duplicate team is a separate job with rating consequences.
   */
  const perTitle = new Map<string, string[]>();
  for (const f of found) {
    const key = `${f.wiki}/${f.title}`;
    if (!perTitle.has(key)) perTitle.set(key, []);
    perTitle.get(key)!.push(f.slug);
  }
  for (const [key, slugs] of perTitle) {
    if (slugs.length < 2) continue;
    console.log(`\n?  "${key}" -> ${slugs.join(", ")}`);
    console.log(`   Either two line-ups of one organisation, or a duplicate team in the database. Worth checking.`);
  }

  // 2. The real URL from the file names.
  //
  // The request is grouped by wiki: each wiki has its own api.php and only the
  // wiki referring to a file knows it. The files themselves live on the shared
  // commons, so the title is enough as a result key.
  const perWiki = new Map<string, Set<string>>();
  for (const f of found) {
    if (!perWiki.has(f.wiki)) perWiki.set(f.wiki, new Set());
    for (const c of variantsOf(f.file)) perWiki.get(f.wiki)!.add(`File:${c}`);
    for (const c of variantsOf(f.fileLight, ["allmode", "lightmode"])) {
      perWiki.get(f.wiki)!.add(`File:${c}`);
    }
  }

  const byTitle = new Map<string, { url: string; size: number; width: number; height: number }>();
  for (const [wiki, titles] of perWiki) {
    const list = [...titles];
    // 50 titles is the limit for one request.
    for (let i = 0; i < list.length; i += 50) {
      const info = await api(wiki, {
        action: "query",
        prop: "imageinfo",
        iiprop: "url|size|mime|dimensions",
        titles: list.slice(i, i + 50).join("|"),
      });
      for (const p of info?.query?.pages ?? []) {
        const ii = p?.imageinfo?.[0];
        if (ii?.url) byTitle.set(p.title, { url: ii.url, size: ii.size, width: ii.width, height: ii.height });
      }
    }
  }

  /**
   * The variant closest to square is chosen by its dimensions, not its name.
   * The avatar is a 32px square: a 4259x1659 wordmark is unreadable there,
   * because fitting it to the height leaves the letters a few pixels tall.
   */
  const urlByTitle = new Map<string, { url: string; size: number }>();
  const resolve = (file: string, alternates?: string[]) => {
    const options = variantsOf(file, alternates)
      .map((c) => ({ title: `File:${c}`, hit: byTitle.get(`File:${c}`) }))
      .filter((o): o is { title: string; hit: NonNullable<ReturnType<typeof byTitle.get>> } => Boolean(o.hit));
    if (options.length === 0) return;
    const best = options.sort(
      (a, b) =>
        Math.abs(Math.log(a.hit.width / a.hit.height)) - Math.abs(Math.log(b.hit.width / b.hit.height)),
    )[0];
    urlByTitle.set(`File:${file}`, { url: best.hit.url, size: best.hit.size });
    return best.title;
  };

  for (const f of found) {
    const bestDark = resolve(f.file);
    if (bestDark && bestDark !== `File:${f.file}`) {
      console.log(`   ${f.slug}: the squarer variant was chosen - ${bestDark.replace("File:", "")}`);
    }
    if (f.fileLight !== f.file) resolve(f.fileLight, ["allmode", "lightmode"]);
  }

  console.log("");
  if (!apply) {
    for (const f of found) {
      const hit = urlByTitle.get(`File:${f.file}`);
      console.log(`${f.slug.padEnd(24)} ${hit ? `${(hit.size / 1024).toFixed(0)} KB  ${hit.url}` : "NO URL FOUND"}`);
    }
    console.log(`\n${found.length} logos are ready. Add --apply to write.`);
    return;
  }

  // 3. Download, resize, write.
  let sharp: (typeof import("sharp"))["default"];
  try {
    sharp = (await import("sharp")).default;
  } catch {
    throw new Error("sharp was not found. Run `npm i -D sharp` and try again.");
  }

  await mkdir(OUT_DIR, { recursive: true });
  // The existing manifest is merged into, not replaced: a run with
  // `--game dota2` must not delete the CS2 rows.
  const manifest: Record<string, string> = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, "utf8"))
    : {};
  let written = 0;
  let bytes = 0;

  /**
   * NOT padded to a square. Every logo used to be placed on a 256x256
   * transparent canvas; a wide wordmark (Vitality at a ratio of 3.46, LOUD at
   * 5.4) then filled a third of that canvas and became an 8-pixel strip in a
   * 28-pixel box. The aspect ratio is kept now and the long edge becomes SIZE;
   * the width of the box comes from components/common/TeamAvatar.tsx.
   */
  const shrink = (raw: Buffer) =>
    sharp(raw).trim({ threshold: 1 }).resize(SIZE, SIZE, { fit: "inside" }).png({ compressionLevel: 9 }).toBuffer();

  /** Downloads one file and normalises it. */
  const grab = async (title: string) => {
    const hit = urlByTitle.get(`File:${title}`);
    if (!hit) return null;
    const res = await fetch(hit.url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    return { rawSize: raw.length, png: await shrink(raw) };
  };

  for (const f of found) {
    const dark = await grab(f.file);
    if (!dark) {
      console.log(`!  ${f.slug.padEnd(24)} did not download`);
      continue;
    }

    await writeFile(path.join(OUT_DIR, `${f.slug}.png`), dark.png);
    manifest[f.slug] = `/teams/${f.slug}.png`;
    bytes += dark.png.length;

    // The light variant is ALWAYS written - the same image where there is no
    // separate file. The reason is simplicity: the component does not check
    // whether `<slug>-light.png` exists, it just derives the address. Where no
    // distinct file came back the two copies are identical, and that is the
    // right outcome - an `allmode` logo works on any background.
    const light = f.fileLight === f.file ? dark : ((await grab(f.fileLight)) ?? dark);
    await writeFile(path.join(OUT_DIR, `${f.slug}-light.png`), light.png);
    bytes += light.png.length;

    written++;
    const note = light === dark ? "" : `  + light ${(light.png.length / 1024).toFixed(0)} KB`;
    console.log(`+  ${f.slug.padEnd(24)} ${(dark.rawSize / 1024).toFixed(0)} KB -> ${(dark.png.length / 1024).toFixed(0)} KB${note}`);
  }

  const ordered = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, JSON.stringify(ordered, null, 2) + "\n");
  console.log(`\nthis run: ${written} logos, ${(bytes / 1024).toFixed(0)} KB`);
  console.log(`in the manifest: ${Object.keys(ordered).length}`);
  console.log(`Manifest: data/team-logos.json`);
  console.log(`To write to the database: scripts/apply-team-logos.ts (in GitHub Actions)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
