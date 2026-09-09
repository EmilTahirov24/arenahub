/**
 * Answers one question: do the rest of the admin panel — content, adverts,
 * users and file uploads — work, and do the permissions actually hold?
 *
 * 02-lifecycle takes the match flow; this suite covers everything it does not:
 * CRUD, news sanitisation, upload limits, the boundaries of the EDITOR role,
 * and the panel on a phone.
 *
 *   npm run dev
 *   npx tsx e2e/04-admin.ts
 */
import {
  BASE,
  launch,
  newPage,
  check,
  assert,
  report,
  reportProblems,
  loginAdmin,
  submitForm,
  visibleText,
  gotoPage,
  assertNotErrorPage,
} from "./_lib";
import { prisma } from "../lib/prisma";
import { IMPORT_STALE_AFTER_MINUTES } from "../lib/importRun";
import bcrypt from "bcryptjs";

const GAME = "E2E Sınaq Oyunu";
const NEWS_AZ = "E2E Sınaq Xəbəri";
const AD = "E2E Sınaq Banneri";
const EDITOR_EMAIL = "e2e-editor@arenahub.invalid";
const EDITOR_PASSWORD = "editor12345";

/** A 1x1 red PNG — the smallest valid file for the upload checks. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function cleanup() {
  const news = await prisma.newsArticle.findMany({
    where: { translations: { some: { title: { startsWith: "E2E" } } } },
    select: { id: true },
  });
  if (news.length) {
    const ids = news.map((n) => n.id);
    await prisma.newsArticleTranslation.deleteMany({ where: { articleId: { in: ids } } });
    await prisma.newsArticle.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.adBanner.deleteMany({ where: { name: { startsWith: "E2E" } } });
  await prisma.adminUser.deleteMany({ where: { email: EDITOR_EMAIL } });
  await prisma.game.deleteMany({ where: { name: { startsWith: "E2E" } } });
  console.log(`(cleaned up: ${news.length} articles, plus advert/editor/game leftovers)\n`);
}

async function main() {
  await cleanup();

  const browser = await launch();
  const { page, problems } = await newPage(browser);

  await loginAdmin(page);
  console.log("Admin signed in: ok\n");

  await check("the dashboard shows a counter for every section in the menu", async () => {
    await gotoPage(page, `${BASE}/admin`);
    const body = await visibleText(page);
    for (const label of [
      "Komandalar",
      "Oyunçular",
      "Matçlar",
      "Turnirlər",
      "Xəbərlər",
      "Aktiv reklamlar",
      "Gözləyən müraciətlər",
    ]) {
      assert(body.includes(label), `no "${label}" counter on the dashboard`);
    }
  });

  // The importer is the site's only data source and runs in GitHub Actions. If
  // it breaks or is disabled the site goes stale in silence — this panel makes
  // that silence visible.
  await check("the dashboard shows a recent import as healthy", async () => {
    await prisma.importRun.deleteMany({ where: { script: "import-live" } });
    await prisma.importRun.create({
      data: { script: "import-live", ok: true, written: 12, note: "12 matç, 3 xəritə", finishedAt: new Date() },
    });
    await gotoPage(page, `${BASE}/admin`);
    const body = await visibleText(page);
    assert(body.includes("Matç idxalı"), "no import panel");
    assert(/son uğurlu qaçış/.test(body), "the healthy state is not shown");
    assert(body.includes("12 matç"), "the last run's summary is not shown");
    assert(!/dayanmış ola bilər/.test(body), "a recent import is marked as stale");
  });

  await check("the dashboard warns about a stalled import", async () => {
    // Derived from the threshold itself. It used to be a hard-coded 6 hours;
    // when the threshold moved from 3 to 6 the fixture landed exactly on the
    // boundary, so a minute either way could have made the test falsely green.
    // An hour of margin keeps it correct if the threshold moves again.
    const old = new Date(Date.now() - (IMPORT_STALE_AFTER_MINUTES + 60) * 60_000);
    await prisma.importRun.deleteMany({ where: { script: "import-live" } });
    await prisma.importRun.create({
      data: { script: "import-live", ok: true, written: 4, startedAt: old, finishedAt: old },
    });
    await gotoPage(page, `${BASE}/admin`);
    const body = await visibleText(page);
    assert(/dayanmış ola bilər/.test(body), "no warning for a stalled import");
    assert(/GitHub Actions/.test(body), "it does not say where to look");
    await prisma.importRun.deleteMany({ where: { script: "import-live" } });
  });

  console.log("\nGames — create / edit / delete\n");

  let gameId = "";
  await check("a game is created and appears in the list", async () => {
    await gotoPage(page, `${BASE}/admin/games/new`);
    await page.fill('input[name="name"]', GAME);
    await page.fill('input[name="shortName"]', "E2E");
    await submitForm(page, 'form:has(input[name="shortName"])');
    assert(page.url().includes("/admin/games"), `did not return to the list: ${page.url()}`);
    const body = await visibleText(page);
    assert(body.includes(GAME), "the new game is not in the list");
    const row = await prisma.game.findFirstOrThrow({ where: { name: GAME } });
    gameId = row.id;
  });

  await check("a game's name can be edited", async () => {
    await gotoPage(page, `${BASE}/admin/games/${gameId}`);
    await page.fill('input[name="name"]', `${GAME} (redaktə)`);
    await submitForm(page, 'form:has(input[name="shortName"])');
    const row = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
    assert(row.name === `${GAME} (redaktə)`, `the name did not change: ${row.name}`);
  });

  console.log("\nNews and sanitisation\n");

  let newsSlug = "";
  await check("an article is created and published", async () => {
    await gotoPage(page, `${BASE}/admin/news/new`);
    await page.fill('input[name="title_az"]', NEWS_AZ);
    await page.fill('input[name="title_en"]', "E2E Test Article");
    // Deliberately hostile content, to exercise the sanitiser.
    const payload =
      "<p>Salam</p><script>window.__xss=1</script><img src=x onerror=\"window.__xss=2\">";
    await page.fill('textarea[name="bodyHtml_az"]', payload);
    await page.fill('textarea[name="bodyHtml_en"]', payload);
    await page.check('input[name="isPublished"]');
    await submitForm(page, 'form:has(input[name="title_az"])');
    const article = await prisma.newsArticle.findFirstOrThrow({
      where: { translations: { some: { title: NEWS_AZ } } },
    });
    assert(article.publishedAt, "the article was not published");
    newsSlug = article.slug;
  });

  await check("script and onerror in an article do not survive onto the public page", async () => {
    await gotoPage(page, `${BASE}/az/news/${newsSlug}`);
    const html = await page.content();
    assert(!/window\.__xss/.test(html), "the hostile code is still in the HTML");
    assert(!/onerror=/i.test(html), "the onerror attribute was not removed");
    const executed = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss);
    assert(executed === undefined, "the hostile code executed");
    const body = await visibleText(page);
    assert(body.includes("Salam"), "the safe content was stripped too");
  });

  // The "featured" checkbox was removed from matches (starRating already exists
  // and is shown) and switched on for news. These two checks hold both in place.
  await check("the match form no longer has a featured checkbox", async () => {
    await gotoPage(page, `${BASE}/admin/matches/new`);
    const box = page.locator('input[name="isFeatured"]');
    assert((await box.count()) === 0, "the match form still has an isFeatured checkbox");
    const stars = page.locator('select[name="starRating"]');
    assert(await stars.count(), "the starRating control is gone — a match still needs its importance control");
  });

  await check("a featured article comes first in the list and shows its badge", async () => {
    const game = await prisma.game.findFirstOrThrow({ where: { slug: "cs2" } });
    const admin = await prisma.adminUser.findFirstOrThrow();
    // Old but featured: sorted by date alone it would come last.
    const featured = await prisma.newsArticle.create({
      data: {
        slug: "e2e-secilmis-" + Date.now(),
        authorId: admin.id,
        gameId: game.id,
        tags: [],
        isFeatured: true,
        publishedAt: new Date(Date.now() - 30 * 86_400_000),
        translations: {
          create: [
            { locale: "az", title: "E2E Seçilmiş Xəbər", bodyHtml: "<p>mətn</p>" },
            { locale: "en", title: "E2E Featured Article", bodyHtml: "<p>text</p>" },
          ],
        },
      },
    });
    // Recent but not featured.
    const recent = await prisma.newsArticle.create({
      data: {
        slug: "e2e-adi-" + Date.now(),
        authorId: admin.id,
        gameId: game.id,
        tags: [],
        isFeatured: false,
        publishedAt: new Date(),
        translations: {
          create: [
            { locale: "az", title: "E2E Adi Xəbər", bodyHtml: "<p>mətn</p>" },
            { locale: "en", title: "E2E Plain Article", bodyHtml: "<p>text</p>" },
          ],
        },
      },
    });

    try {
      // Checked on /news rather than the home page. The home page is cached for
      // 60 seconds by ISR, and these fixtures are written DIRECTLY to the
      // database, so the revalidatePath that admin actions call never runs.
      // Checking the home page would have tested the cache window, not the
      // order. /news reads searchParams, so it is dynamic and always fresh.
      await gotoPage(page, `${BASE}/az/news`);
      const body = await visibleText(page);
      const posFeatured = body.indexOf("E2E Seçilmiş Xəbər");
      const posPlain = body.indexOf("E2E Adi Xəbər");
      assert(posFeatured >= 0, "the featured article is not in the list");
      assert(posPlain >= 0, "the plain article is not in the list — nothing to compare against");
      assert(
        posFeatured < posPlain,
        "the featured article comes after a newer one — the ordering is not working",
      );
      assert(/Seçilmiş/.test(body), "the card has no featured badge");
    } finally {
      await prisma.newsArticleTranslation.deleteMany({ where: { articleId: { in: [featured.id, recent.id] } } });
      await prisma.newsArticle.deleteMany({ where: { id: { in: [featured.id, recent.id] } } });
    }
  });


  console.log("\nFile upload rules\n");

  await check("a valid PNG is accepted", async () => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      multipart: { file: { name: "e2e.png", mimeType: "image/png", buffer: PNG } },
    });
    // Uploads are capped at 20 an hour (lib/rateLimit.ts) and the counter lives
    // in the server process's memory. Running the suite repeatedly exhausts it —
    // not a defect in the application, so the reason is stated plainly.
    assert(res.status() !== 429, "upload limit reached (20 an hour). Restart the server.");
    assert(res.ok(), `HTTP ${res.status()}`);
    const json = await res.json();
    assert(typeof json.url === "string" && json.url.length > 0, "the response has no url");
  });

  await check("an SVG is rejected", async () => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      multipart: {
        file: {
          name: "e2e.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
        },
      },
    });
    assert(!res.ok(), `the SVG was accepted: HTTP ${res.status()}`);
  });

  await check("a text file named .png is caught by the magic-byte check", async () => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      multipart: { file: { name: "saxta.png", mimeType: "image/png", buffer: Buffer.from("bu PNG deyil") } },
    });
    assert(!res.ok(), `the fake PNG was accepted: HTTP ${res.status()}`);
  });

  await check("a file larger than 5 MB is rejected", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await page.request.post(`${BASE}/api/upload`, {
      multipart: { file: { name: "boyuk.png", mimeType: "image/png", buffer: big } },
    });
    assert(!res.ok(), `the oversized file was accepted: HTTP ${res.status()}`);
  });

  console.log("\nWhen an advert is shown\n");

  // The banner is created with Prisma but saved through the admin form so that
  // it reaches the public side. The reason: public pages are cached now, and
  // the `revalidatePath` that clears the cache lives inside the admin action.
  // Writing it from the side and checking directly would have tested the cache
  // window rather than when an advert appears. Image upload is kept out of this
  // flow — it is capped at 20 an hour and is checked elsewhere in the suite.
  await check("an active banner appears on the public site", async () => {
    const ad = await prisma.adBanner.create({
      data: {
        name: AD,
        placement: "SIDEBAR_RIGHT_TOP",
        imageUrl: `data:image/png;base64,${PNG.toString("base64")}`,
        linkUrl: "https://example.com",
        altText: "E2E banner alt",
        startDate: new Date(Date.now() - 86_400_000),
        isActive: true,
        weight: 1000,
      },
    });
    // Saving the form unchanged still runs updateAd, which clears the cache.
    await gotoPage(page, `${BASE}/admin/ads/${ad.id}`);
    await submitForm(page, 'form:has(input[name="linkUrl"])');

    await gotoPage(page, `${BASE}/az`);
    const alts = await page.$$eval("img[alt]", (imgs) => imgs.map((i) => i.getAttribute("alt") ?? ""));
    assert(alts.includes("E2E banner alt"), "the active banner is not visible");
  });

  // Without counters ad space cannot be sold: with no answer to "how many times
  // was this shown?", there is no number to negotiate with.
  await check("a banner on screen counts as an impression", async () => {
    const ad = await prisma.adBanner.findFirstOrThrow({ where: { name: AD } });
    await prisma.adBanner.update({ where: { id: ad.id }, data: { impressions: 0 } });

    await gotoPage(page, `${BASE}/az`);
    // The observer requires half the area to be visible for a second, so the
    // banner is scrolled into view first and then waited on.
    await page.locator('img[alt="E2E banner alt"]').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1600);

    // The beacon is sent in the background, so the write can lag a little.
    let count = 0;
    for (let i = 0; i < 20 && count === 0; i++) {
      count = (await prisma.adBanner.findUniqueOrThrow({ where: { id: ad.id } })).impressions;
      if (count === 0) await page.waitForTimeout(400);
    }
    assert(count >= 1, "the banner was on screen but no impression was counted");
  });

  await check("a click is counted and redirects to the advertiser", async () => {
    const ad = await prisma.adBanner.findFirstOrThrow({ where: { name: AD } });
    await prisma.adBanner.update({ where: { id: ad.id }, data: { clicks: 0 } });

    const res = await page.request.get(`${BASE}/api/ads/${ad.id}/click`, { maxRedirects: 0 });
    assert(res.status() === 307 || res.status() === 308 || res.status() === 302,
      `expected a redirect, got HTTP ${res.status()}`);
    const location = res.headers()["location"];
    assert(location === "https://example.com/", `wrong destination: ${location}`);

    let clicks = 0;
    for (let i = 0; i < 20 && clicks === 0; i++) {
      clicks = (await prisma.adBanner.findUniqueOrThrow({ where: { id: ad.id } })).clicks;
      if (clicks === 0) await page.waitForTimeout(300);
    }
    assert(clicks === 1, `the click was not counted (${clicks})`);
  });

  // The panel has to show the numbers, or counting them means nothing.
  await check("the advert list shows impressions, clicks and CTR", async () => {
    await gotoPage(page, `${BASE}/admin/ads`);
    const body = await visibleText(page);
    assert(/göstərilmə/.test(body), "no impressions column");
    assert(/klik/.test(body), "no clicks column");
    assert(/%|—/.test(body), "no CTR column");
  });

  await check("a banner dated in the future stays hidden", async () => {
    const ad = await prisma.adBanner.findFirstOrThrow({ where: { name: AD } });
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    await gotoPage(page, `${BASE}/admin/ads/${ad.id}`);
    await page.fill('input[name="startDate"]', future);
    await submitForm(page, 'form:has(input[name="linkUrl"])');

    await gotoPage(page, `${BASE}/az`);
    const alts = await page.$$eval("img[alt]", (imgs) => imgs.map((i) => i.getAttribute("alt") ?? ""));
    assert(!alts.includes("E2E banner alt"), "the future-dated banner is still visible");
  });


  console.log("\nAdmin lists\n");

  // These pages used to fetch EVERY row at once — 814 teams, 600 players — and
  // took up to 3 seconds to open. Matches had `take: 100` and no pagination, so
  // 2,249 of 2,349 matches were simply unreachable. The count grows with every
  // import, which makes this a defect that gets worse on its own.
  await check("lists paginate and search works", async () => {
    const total = await prisma.team.count();

    await gotoPage(page, `${BASE}/admin/teams`);
    const rows = await page.locator('a[href^="/admin/teams/"]').count();
    // The "new team" link matches this selector too, hence one of margin.
    assert(rows <= 52, `${rows} rows on one page — pagination is not working`);

    if (total > 50) {
      const pager = await page.locator('nav[aria-label="Səhifələr"]').count();
      assert(pager > 0, "more than 50 teams exist but no pagination is shown");
    }
  });

  await check("search narrows the results", async () => {
    const team = await prisma.team.findFirstOrThrow({ select: { name: true } });
    await gotoPage(page, `${BASE}/admin/teams?q=${encodeURIComponent(team.name)}`);
    const body = await visibleText(page);
    assert(body.includes(team.name), `the searched team was not found: ${team.name}`);
  });

  // The match list could only be searched by team name. Across 2,315 rows,
  // answering "what is live" or "only CS2" meant paging through 47 screens by
  // hand.
  await check("the match status filter narrows the query", async () => {
    // The status with the most rows is chosen so the check works against both a
    // seeded and a full database.
    const groups = await prisma.match.groupBy({ by: ["status"], _count: { _all: true } });
    assert(groups.length > 0, "no matches in the database");
    const biggest = [...groups].sort((a, b) => b._count._all - a._count._all)[0];

    await gotoPage(page, `${BASE}/admin/matches?status=${biggest.status}`);
    await assertNotErrorPage(page);
    const body = await visibleText(page);
    assert(body.includes(biggest.status), `no ${biggest.status} row is visible`);
    // The filter has to be in the query, not applied as a screen-level sieve:
    // if another status survived, both the row count and the total would lie.
    for (const other of groups.map((g) => g.status).filter((s) => s !== biggest.status)) {
      assert(!body.includes(other), `a ${other} match survived the ${biggest.status} filter`);
    }
  });

  await check("the match game filter narrows the query", async () => {
    const game = await prisma.game.findFirstOrThrow({
      where: { matches: { some: {} } },
      select: { slug: true, shortName: true },
    });
    const expected = await prisma.match.count({ where: { game: { slug: game.slug } } });

    await gotoPage(page, `${BASE}/admin/matches?game=${encodeURIComponent(game.slug)}`);
    await assertNotErrorPage(page);
    const body = await visibleText(page);
    // The total only appears past one page; below that the row count is the
    // proof by itself.
    if (expected > 50) {
      assert(body.includes(`cəmi ${expected}`), `the total for ${expected} is not shown — the filter does not reach the counter`);
    } else {
      assert(body.includes(game.shortName), `no ${game.shortName} row is visible`);
    }
  });

  // The filter arrives in the URL, so it can be any text at all. Unvalidated,
  // `status` goes straight to Prisma and returns a 500 on an enum error — a
  // mistyped link must not break the page.
  await check("a junk filter value does not break the panel", async () => {
    const res = await gotoPage(page, `${BASE}/admin/matches?status=YOXDUR&game=yoxdur`);
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    await assertNotErrorPage(page);
  });

  // The news list had no search: the title lives in a separate table
  // (NewsArticleTranslation), so it had been skipped.
  await check("news search works on the title", async () => {
    await gotoPage(page, `${BASE}/admin/news?q=${encodeURIComponent(NEWS_AZ)}`);
    await assertNotErrorPage(page);
    const found = await visibleText(page);
    assert(found.includes(NEWS_AZ), `the searched article was not found: ${NEWS_AZ}`);

    await gotoPage(page, `${BASE}/admin/news?q=zzz-belke-de-yoxdur-12345`);
    const empty = await visibleText(page);
    assert(empty.includes("tapılmadı"), "no message for an empty result");
  });

  // An out-of-range page must not error.
  await check("a page number that does not exist clamps to the last one", async () => {
    const res = await gotoPage(page, `${BASE}/admin/players?page=9999`);
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    await assertNotErrorPage(page);
  });

  console.log("\nAccessibility\n");

  // The admin panel is a tool someone uses daily. An unlabelled field is
  // announced without a name by a screen reader and is not recognised by
  // password managers. These forms need a session, so the check lives here
  // rather than in the public suite.
  await check("the admin form fields are labelled", async () => {
    // Only the `/new` pages were checked, and that is where the gap came from:
    // the live-control page had 7 unlabelled fields (found on the live site,
    // 2026-08-30). That page is made of row forms, which is exactly the kind
    // most easily forgotten — it is on the list now.
    //
    // The edit pages were added too: they use the same component as `/new`, but
    // checking is cheaper than TRUSTING that they still do.
    const liveMatch = await prisma.match.findFirst({ select: { id: true }, orderBy: { scheduledAt: "desc" } });
    const pages = [
      "/admin/games/new",
      "/admin/teams/new",
      "/admin/players/new",
      "/admin/tournaments/new",
      "/admin/news/new",
      "/admin/ads/new",
      "/admin/users/new",
      ...(liveMatch ? [`/admin/matches/${liveMatch.id}`, `/admin/matches/${liveMatch.id}/live`] : []),
    ];
    const problems: string[] = [];

    for (const path of pages) {
      await gotoPage(page, `${BASE}${path}`);
      const bare = await page.evaluate(() =>
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
      if (bare.length) problems.push(`${path}: ${bare.join(", ")}`);
    }

    assert(problems.length === 0, `unlabelled fields — ${problems.join(" | ")}`);
  });

  console.log("\nBoundaries of the EDITOR role\n");

  await check("an EDITOR admin is created", async () => {
    await prisma.adminUser.create({
      data: {
        email: EDITOR_EMAIL,
        name: "E2E Editor",
        role: "EDITOR",
        passwordHash: await bcrypt.hash(EDITOR_PASSWORD, 10),
      },
    });
    const created = await prisma.adminUser.findUniqueOrThrow({ where: { email: EDITOR_EMAIL } });
    assert(created.role === "EDITOR", "the role did not become EDITOR");
  });

  await check("an EDITOR is kept out of /admin/users", async () => {
    await gotoPage(page, `${BASE}/admin/login`);
    await page.fill('input[name="email"]', EDITOR_EMAIL);
    await page.fill('input[name="password"]', EDITOR_PASSWORD);
    await submitForm(page, "form");
    await page.waitForURL((u) => !u.pathname.startsWith("/admin/login"), { timeout: 30_000 });

    await gotoPage(page, `${BASE}/admin/users`);
    assert(
      !new URL(page.url()).pathname.startsWith("/admin/users"),
      `the EDITOR opened the users page: ${page.url()}`,
    );
  });

  // This check deliberately produces a 500 and a "Forbidden" console error —
  // that is precisely the proof the boundary holds, so it is kept out of the
  // problem report.
  const beforeForbidden = problems.length;
  await check("an EDITOR delete lands in the error boundary, not on a bare screen", async () => {
    await gotoPage(page, `${BASE}/admin/games/${gameId}`);
    await submitForm(page, 'form:has(button:has-text("Oyunu sil"))', "Oyunu sil");
    const body = await visibleText(page);
    assert(body.includes("Əməliyyat tamamlanmadı"), "the admin error boundary did not run");
    assert(body.includes("Panelə qayıt"), "no link back");
    const still = await prisma.game.findUnique({ where: { id: gameId } });
    assert(still, "the EDITOR managed to delete the game — the permission check does not hold");
  });
  problems.length = beforeForbidden;

  console.log("\nOn a phone (390px)\n");

  await check("the admin menu collapses behind a toggle on a phone", async () => {
    await loginAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPage(page, `${BASE}/admin`);
    const toggle = page.locator('button[aria-controls="admin-nav"]');
    assert(await toggle.count(), "no menu button");
    assert(await toggle.isVisible(), "the menu button is not visible on a phone");
    assert((await toggle.getAttribute("aria-expanded")) === "false", "the menu is already open");
    await toggle.click();
    assert((await toggle.getAttribute("aria-expanded")) === "true", "the menu did not open");
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  console.log("\nCleanup\n");

  await check("a SUPER_ADMIN can delete the game", async () => {
    await gotoPage(page, `${BASE}/admin/games/${gameId}`);
    await submitForm(page, 'form:has(button:has-text("Oyunu sil"))', "Oyunu sil");
    const gone = await prisma.game.findUnique({ where: { id: gameId } });
    assert(!gone, "the game was not deleted");
  });

  reportProblems(problems);
  report("Admin panel");
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
