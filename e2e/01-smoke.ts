/**
 * Answers one question: does every page of the public site open, or does one
 * of them fall into an error boundary?
 *
 * It walks the static routes in both languages, then takes real slugs off the
 * list pages and opens the dynamic ones too — which checks both the page itself
 * and the correctness of the link that leads to it.
 *
 *   npx tsx e2e/01-smoke.ts
 */
import {
  BASE,
  launch,
  newPage,
  check,
  assert,
  report,
  reportProblems,
  assertNotErrorPage,
  gotoPage,
  visibleText,
} from "./_lib";
import { prisma } from "../lib/prisma";
import azMessages from "../messages/az.json";
import enMessages from "../messages/en.json";

/** Flattens nested keys into the "footer.terms" form. */
function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, `${prefix}${k}.`));
    else out[`${prefix}${k}`] = String(v);
  }
  return out;
}

const STATIC_PATHS = [
  "",
  "/matches",
  "/results",
  "/live",
  "/teams",
  "/players",
  "/stats",
  "/events",
  "/news",
  "/local",
  "/predictions",
  "/privacy",
  "/terms",
];

async function main() {
  const browser = await launch();
  const { page, problems } = await newPage(browser);

  console.log("Static routes\n");
  for (const locale of ["az", "en"]) {
    for (const path of STATIC_PATHS) {
      const url = `${BASE}/${locale}${path}`;
      await check(`${locale}${path || "/"}`, async () => {
        const res = await gotoPage(page, url);
        assert(res, "no response");
        assert(res.status() === 200, `HTTP ${res.status()}`);
        await assertNotErrorPage(page);
      });
    }
  }

  console.log("\nDynamic pages (with real slugs taken from the lists)\n");
  const dynamic: { name: string; from: string; linkPattern: RegExp }[] = [
    { name: "match detail", from: "/az/results", linkPattern: /^\/az\/matches\/[^/]+$/ },
    { name: "team detail", from: "/az/teams", linkPattern: /^\/az\/teams\/[^/]+$/ },
    { name: "player detail", from: "/az/players", linkPattern: /^\/az\/players\/[^/]+$/ },
    { name: "tournament detail", from: "/az/events", linkPattern: /^\/az\/events\/[^/]+$/ },
    { name: "news detail", from: "/az/news", linkPattern: /^\/az\/news\/[^/]+$/ },
  ];

  for (const d of dynamic) {
    await check(d.name, async () => {
      await gotoPage(page, `${BASE}${d.from}`);
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
      const target = hrefs.find((h) => d.linkPattern.test(h));
      assert(target, `no matching link found on ${d.from}`);
      const res = await gotoPage(page, `${BASE}${target}`);
      assert(res && res.status() === 200, `HTTP ${res?.status()} — ${target}`);
      await assertNotErrorPage(page);
    });
  }

  console.log("\nNo Azerbaijani text leaks into the English pages\n");

  // Searching by letter gives a false signal: real team names contain "ə" too
  // (local-scene teams). So the measure is the translation file itself — if a
  // value from az.json shows up under /en, a translation has leaked.
  const azOnly = Object.entries(flatten(azMessages))
    .filter(([key, value]) => flatten(enMessages)[key] !== value)
    .map(([, value]) => value);

  for (const path of ["", "/matches", "/teams", "/players", "/news", "/terms", "/privacy"]) {
    await check(`en${path || "/"} carries no Azerbaijani string`, async () => {
      await gotoPage(page, `${BASE}/en${path}`);
      const body = await visibleText(page);
      const leaked = azOnly.filter((s) => s.length > 3 && body.includes(s));
      assert(leaked.length === 0, `untranslated: ${leaked.join(" · ")}`);
    });
  }

  console.log("\nRoutes for machines\n");

  await check("/sitemap.xml", async () => {
    const res = await page.goto(`${BASE}/sitemap.xml`, { timeout: 45_000 });
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    const body = await res.text();
    assert(body.includes("<urlset"), "no urlset");
    assert(body.includes("/az/") && body.includes("/en/"), "both languages should be in the sitemap");
  });

  await check("/robots.txt disallows admin and player", async () => {
    const res = await page.goto(`${BASE}/robots.txt`, { timeout: 45_000 });
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    const body = await res.text();
    for (const p of ["/admin", "/api", "/player"]) {
      assert(body.includes(p), `${p} is not in the disallow list`);
    }
  });

  await check("/manifest.webmanifest", async () => {
    const res = await page.goto(`${BASE}/manifest.webmanifest`, { timeout: 45_000 });
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
  });

  await check("/api/search rejects a query shorter than 2 characters", async () => {
    const res = await page.request.get(`${BASE}/api/search?q=a&locale=az`);
    const json = await res.json();
    assert(Array.isArray(json.results) && json.results.length === 0, "a short query should return nothing");
  });

  await check("/api/search returns results for a real query", async () => {
    const res = await page.request.get(`${BASE}/api/search?q=vi&locale=az`);
    assert(res.status() === 200, `HTTP ${res.status()}`);
    const json = await res.json();
    assert(Array.isArray(json.results), "the response has no results array");
    assert(json.results.length > 0, "nothing found — search is not working");
    for (const r of json.results) {
      assert(r.href?.startsWith("/az/"), `href without a language prefix: ${r.href}`);
      assert(r.label && r.type, "the result is missing label or type");
    }
  });

  console.log("\nTournament participants\n");

  // Most tournaments have an empty participant table while their matches are
  // being played. The page used to say participants had not been announced,
  // with those very teams' matches listed just below it. The list is now
  // derived from the matches.
  await check("a tournament with no participant rows lists teams from its matches", async () => {
    // The fixture is created here rather than trusting whatever data exists.
    // The earlier version skipped when no suitable tournament was found, and
    // since the local database had none, the check went green without testing
    // anything.
    const game = await prisma.game.findFirstOrThrow({ where: { isActive: true } });
    const teams = await prisma.team.findMany({ where: { gameId: game.id }, take: 2, select: { id: true, name: true } });
    assert(teams.length === 2, "the fixture needs two teams");

    const stamp = Date.now();
    const tournament = await prisma.tournament.create({
      data: {
        name: `E2E Iştirakçı Testi ${stamp}`,
        slug: `e2e-istirakci-testi-${stamp}`,
        gameId: game.id,
        tier: "C",
        status: "ONGOING",
        startDate: new Date(Date.now() - 86_400_000),
        endDate: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.match.create({
      data: {
        slug: `e2e-istirakci-mac-${stamp}`,
        scheduledAt: new Date(Date.now() - 3_600_000),
        status: "FINISHED",
        bestOf: 3,
        gameId: game.id,
        tournamentId: tournament.id,
        teamAId: teams[0].id,
        teamBId: teams[1].id,
      },
    });

    try {
      await gotoPage(page, `${BASE}/az/events/${tournament.slug}`);
      const body = await visibleText(page);
      assert(!/açıqlanmayıb/.test(body), "a tournament with matches still says participants are unannounced");
      for (const t of teams) {
        assert(body.includes(t.name), `a team that played is missing from the list: ${t.name}`);
      }
    } finally {
      await prisma.match.deleteMany({ where: { tournamentId: tournament.id } });
      await prisma.tournament.delete({ where: { id: tournament.id } });
    }
  });

  // The opposite case: with no matches the message is TRUE and must stay.
  await check("the message stays on a tournament with no matches", async () => {
    const withMatch = new Set(
      (await prisma.match.groupBy({ by: ["tournamentId"] })).map((r) => r.tournamentId),
    );
    const withPart = new Set(
      (await prisma.tournamentParticipant.groupBy({ by: ["tournamentId"] })).map((r) => r.tournamentId),
    );
    const all = await prisma.tournament.findMany({ select: { id: true, slug: true } });
    const target = all.find((t) => !withMatch.has(t.id) && !withPart.has(t.id));
    if (!target) return;

    await gotoPage(page, `${BASE}/az/events/${target.slug}`);
    const body = await visibleText(page);
    assert(/açıqlanmayıb/.test(body), "the message disappeared from an empty tournament");
  });
  console.log("\nStructured data (JSON-LD)\n");

  // The site holds more than 2,000 matches that machines could not read. If
  // these tags break nothing changes on the page — only search engines lose,
  // which is exactly why they have a test.
  async function jsonLd(url: string) {
    await gotoPage(page, url);
    const raw = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent();
    assert(raw, "no JSON-LD tag");
    try {
      return JSON.parse(raw!) as Record<string, unknown>;
    } catch {
      throw new Error(`JSON-LD parse olunmur: ${raw!.slice(0, 120)}`);
    }
  }

  await check("a match page is described as a SportsEvent", async () => {
    const m = await prisma.match.findFirstOrThrow({
      select: { slug: true },
      orderBy: { scheduledAt: "desc" },
    });
    const d = await jsonLd(`${BASE}/az/matches/${m.slug}`);
    assert(d["@type"] === "SportsEvent", `wrong type: ${d["@type"]}`);
    assert(typeof d.name === "string" && d.name.includes("vs"), "the name does not show the fixture");
    assert(typeof d.startDate === "string", "no start time");
    const c = d.competitor as unknown[];
    assert(Array.isArray(c) && c.length === 2, "the two teams are not listed");
  });

  // The rule against inventing data applies here too: an unknown field should
  // be left out entirely, not written as an empty string.
  await check("unknown fields do not reach JSON-LD as empty values", async () => {
    const m = await prisma.match.findFirstOrThrow({
      select: { slug: true },
      orderBy: { scheduledAt: "desc" },
    });
    const d = await jsonLd(`${BASE}/az/matches/${m.slug}`);
    for (const [k, v] of Object.entries(d)) {
      assert(v !== null && v !== "" && v !== undefined, `${k} was written with an empty value`);
    }
  });

  await check("a team is a SportsTeam and a player is a Person", async () => {
    const t = await prisma.team.findFirstOrThrow({ select: { slug: true } });
    const td = await jsonLd(`${BASE}/az/teams/${t.slug}`);
    assert(td["@type"] === "SportsTeam", `wrong team type: ${td["@type"]}`);

    const p = await prisma.player.findFirstOrThrow({ select: { slug: true } });
    const pd = await jsonLd(`${BASE}/az/players/${p.slug}`);
    assert(pd["@type"] === "Person", `wrong player type: ${pd["@type"]}`);
  });
  console.log("\nCanonical URLs and language alternates\n");

  // The site serves the same content in two languages and its lists work
  // through query parameters. Without these tags a search engine sees every
  // filter combination as a separate page and the two languages as duplicates.
  async function links(url: string) {
    await gotoPage(page, url);
    const canonical = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href");
    const alts = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((ns) =>
        ns.map((n) => [n.getAttribute("hreflang"), n.getAttribute("href")] as const),
      );
    return { canonical, alts: Object.fromEntries(alts) as Record<string, string> };
  }

  await check("a list page has a canonical URL and both languages", async () => {
    const { canonical, alts } = await links(`${BASE}/az/matches`);
    assert(canonical?.endsWith("/az/matches"), `wrong canonical: ${canonical}`);
    assert(alts["az"]?.endsWith("/az/matches"), "no az alternate");
    assert(alts["en"]?.endsWith("/en/matches"), "no en alternate");
    assert(alts["x-default"]?.endsWith("/az/matches"), "no x-default");
  });

  // The point of this: filter and page variants must collapse onto one URL, or
  // the same content is indexed in dozens of copies.
  await check("a filtered, paginated URL collapses to the bare path", async () => {
    const { canonical } = await links(`${BASE}/az/results?game=cs2&page=3`);
    assert(canonical?.endsWith("/az/results"), `parameters survived into the canonical: ${canonical}`);
  });

  await check("the English side is symmetrical", async () => {
    const { canonical, alts } = await links(`${BASE}/en/teams`);
    assert(canonical?.endsWith("/en/teams"), `wrong canonical: ${canonical}`);
    assert(alts["az"]?.endsWith("/az/teams"), "no az alternate");
    assert(alts["en"]?.endsWith("/en/teams"), "no en alternate");
  });

  await check("a detail page keeps its slug in the canonical URL", async () => {
    const m = await prisma.match.findFirstOrThrow({
      select: { slug: true },
      orderBy: { scheduledAt: "desc" },
    });
    const { canonical, alts } = await links(`${BASE}/az/matches/${m.slug}`);
    assert(canonical?.endsWith(`/az/matches/${m.slug}`), `wrong canonical: ${canonical}`);
    assert(alts["en"]?.endsWith(`/en/matches/${m.slug}`), "the en alternate does not keep the slug");
  });
  console.log("\nData integrity\n");

  // The match-ticker parser took the first link in an opponent block, and in
  // some blocks that link pointed at a section of the tournament itself. The
  // tournament was then stored as a team — 49 such rows had accumulated in
  // production and appeared on the site as opponents. The parser was fixed;
  // this check guards against it coming back.
  await check("a team name must not be a tournament section", async () => {
    const bogus = await prisma.team.findMany({
      where: { name: { contains: "#" } },
      select: { name: true },
      take: 5,
    });
    assert(
      bogus.length === 0,
      `teams with # in the name: ${bogus.map((t) => t.name).join(", ")}`,
    );
  });

  console.log("\nAccessibility: form fields\n");

  // This came from a real finding: htmlFor was used ZERO times in the codebase,
  // so no field was tied to its label. Nothing about that is visible on screen,
  // but a screen reader announces the field unnamed, a password manager does not
  // recognise it, and clicking the label does not focus it. A defect nobody can
  // see is exactly the kind that needs a test.
  async function unlabelledFields(url: string) {
    await gotoPage(page, url);
    return page.evaluate(() =>
      [...document.querySelectorAll("input, select, textarea")]
        .filter((el) => {
          const input = el as HTMLInputElement;
          if (input.type === "hidden") return false;
          const id = el.getAttribute("id");
          const linked = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
          const wrapped = el.closest("label");
          const aria = el.getAttribute("aria-label") ?? el.getAttribute("aria-labelledby");
          return !linked && !wrapped && !aria;
        })
        .map((el) => el.getAttribute("name") ?? (el as HTMLInputElement).type),
    );
  }

  await check("the sign-in and registration fields have labels", async () => {
    for (const path of ["/player/login", "/player/register"]) {
      const bare = await unlabelledFields(`${BASE}${path}`);
      assert(bare.length === 0, `${path}: unlabelled fields — ${bare.join(", ")}`);
    }
  });

  await check("the password reset field has a label", async () => {
    const bare = await unlabelledFields(`${BASE}/player/forgot-password`);
    assert(bare.length === 0, `unlabelled fields — ${bare.join(", ")}`);
  });

  // A screen reader needs a landmark to skip navigation and jump to the
  // content. The public site gets one from its layout; the auth pages sit
  // outside [locale] and that layout never reaches them.
  await check("the auth pages have a main-content landmark", async () => {
    for (const path of ["/player/login", "/player/register", "/player/forgot-password"]) {
      await gotoPage(page, `${BASE}${path}`);
      const n = await page.locator("main").count();
      assert(n > 0, `${path}: no <main>`);
    }
  });

  console.log("\nShare images (Open Graph)\n");

  // The picture that appears when a link is dropped into Telegram, Discord or
  // X. There were none, so every shared URL came out as bare text. If the image
  // breaks, nobody on the site sees it — only the person sharing does, which is
  // why it has a test.
  async function assertOgImage(path: string, label: string) {
    const res = await page.request.get(`${BASE}${path}`);
    assert(res.status() === 200, `${label}: HTTP ${res.status()}`);
    const type = res.headers()["content-type"] ?? "";
    assert(type.includes("image/png"), `${label}: content-type ${type}`);
    // A blank or torn PNG is caught by size: when satori fails it returns a small file.
    const bytes = (await res.body()).length;
    assert(bytes > 5000, `${label}: the image is too small (${bytes} bytes)`);
  }

  await check("the site's default share image renders", async () => {
    await assertOgImage("/az/opengraph-image", "standart");
    await assertOgImage("/en/opengraph-image", "standart (en)");
  });

  await check("a match page has its own share image", async () => {
    const m = await prisma.match.findFirstOrThrow({
      where: { status: "FINISHED" },
      select: { slug: true },
      orderBy: { scheduledAt: "desc" },
    });
    await assertOgImage(`/az/matches/${m.slug}/opengraph-image`, "match");
  });

  await check("a news article has its own share image", async () => {
    const a = await prisma.newsArticle.findFirst({
      where: { publishedAt: { not: null } },
      select: { slug: true },
    });
    if (!a) return; // with no article there is nothing to check
    await assertOgImage(`/az/news/${a.slug}/opengraph-image`, "news");
  });

  await check("teams and players have their own share images", async () => {
    const t = await prisma.team.findFirstOrThrow({ select: { slug: true } });
    await assertOgImage(`/az/teams/${t.slug}/opengraph-image`, "team");

    const p = await prisma.player.findFirstOrThrow({ select: { slug: true } });
    await assertOgImage(`/az/players/${p.slug}/opengraph-image`, "player");
  });

  // Logos and photographs are deliberately not fetched (one team in 855 has a
  // logo), so the image must not depend on a remote request. A team with no
  // logo has to work too.
  await check("a team with no logo still renders an image", async () => {
    const t = await prisma.team.findFirst({
      where: { logoUrl: null },
      select: { slug: true },
    });
    if (!t) return;
    await assertOgImage(`/az/teams/${t.slug}/opengraph-image`, "team with no logo");
  });
  await check("a missing match does not break the image, it falls back to the brand one", async () => {
    await assertOgImage("/az/matches/belke-de-yoxdur-12345/opengraph-image", "missing match");
  });

  await check("og:image in the page HEAD is an absolute URL", async () => {
    await gotoPage(page, `${BASE}/az`);
    const content = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    assert(content, "no og:image meta tag");
    assert(content!.startsWith("http"), `og:image is a relative URL: ${content}`);
  });

  console.log("\nTime zone\n");

  // Every `Intl.DateTimeFormat` call ran in the server's zone — UTC on Vercel.
  // A match starting at 13:00 in Baku was published as 09:00. The clearest
  // proof was this: the same match showed 13:00 in its OWN share image and
  // 09:00 on its page, because `opengraph-image.tsx` had written `Asia/Baku`
  // by hand. Measured and confirmed on the live site (2026-08-29).
  await check("match times are shown in the Baku zone", async () => {
    const m = await prisma.match.findFirstOrThrow({
      where: { status: "UPCOMING" },
      select: { slug: true, scheduledAt: true },
      orderBy: { scheduledAt: "asc" },
    });
    const gozlenilen = new Intl.DateTimeFormat("az", {
      timeZone: "Asia/Baku",
      hour: "2-digit",
      minute: "2-digit",
    }).format(m.scheduledAt);

    await gotoPage(page, `${BASE}/az/matches/${m.slug}`);
    const body = await visibleText(page);
    assert(body.includes(gozlenilen), `"${gozlenilen}" is not on the page — the time is in the server zone again`);
    assert(body.includes("Bakı vaxtı"), "the zone label is missing — the number alone is misleading");
  });

  // A match between 00:00 and 04:00 Baku time is still the previous day in UTC.
  // With day boundaries taken from UTC, such a match never appeared in the
  // "today" strip.
  await check("a late-night match falls on its own Baku day", async () => {
    const { toDateKey, dayRange } = await import("../lib/dates");
    const gece = new Date("2026-08-29T22:30:00.000Z"); // = 30 August, 02:30 in Baku
    assert(toDateKey(gece) === "2026-08-30", `wrong day: ${toDateKey(gece)}`);
    const r = dayRange("2026-08-30");
    assert(gece >= r.start && gece <= r.end, "the match falls outside its own day range");
  });

  console.log("\nFilters that arrive in the URL\n");

  // `?date=abc` produced `new Date("abcT00:00:00.000Z")` — an Invalid Date —
  // and Prisma threw a RangeError converting it to ISO. Because the page shell
  // still returned 200, this was INVISIBLE in the status code: the error came
  // through the stream and the list section was replaced by an error boundary.
  // A page breakable from a public URL, which is why the check runs in a real
  // browser.
  for (const path of ["/results", "/matches"]) {
    await check(`${path} survives a junk date filter`, async () => {
      const res = await gotoPage(page, `${BASE}/az${path}?date=abc`);
      assert(res && res.status() === 200, `HTTP ${res?.status()}`);
      await assertNotErrorPage(page);
    });
  }

  // `2026-02-31` does not throw in Node, it slides silently to 3 March — so a
  // visitor saw results for a day they had not asked for, and never knew.
  await check("a date that does not exist is not accepted as a filter", async () => {
    await gotoPage(page, `${BASE}/az/results?date=2026-02-31`);
    await assertNotErrorPage(page);
    const body = await visibleText(page);
    assert(body.includes("Bütün tarixlər"), "the date strip is not visible");
  });

  // This 404 is deliberate, so it is kept out of the problem collector.
  const before = problems.length;
  await check("a missing URL returns 404", async () => {
    const res = await page.goto(`${BASE}/az/belke-de-yoxdur-12345`, { timeout: 45_000 });
    assert(res && res.status() === 404, `HTTP ${res?.status()} — 404 gözlənilirdi`);
    await assertNotErrorPage(page);
  });
  problems.length = before;

  reportProblems(problems);
  report("Public smoke");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
