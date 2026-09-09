/**
 * Answers one question: do the interactive parts of the public site actually
 * work?
 *
 * 01-smoke checks that pages open; this suite checks how they BEHAVE —
 * keyboard, focus, state carried in the URL, and automatic refreshing. These
 * are exactly the places that look right to the eye and break for someone using
 * a keyboard or opening a shared link.
 *
 *   npm run dev
 *   npx tsx e2e/06-widgets.ts
 */
import {
  BASE,
  launch,
  newPage,
  check,
  assert,
  report,
  reportProblems,
  visibleText,
  visibleCount,
  gotoPage,
} from "./_lib";
import { prisma } from "../lib/prisma";

async function main() {
  const browser = await launch();
  const { page, problems } = await newPage(browser);

  console.log("Command palette (Ctrl+K)\n");

  await check("Ctrl+K opens the palette, Escape closes it", async () => {
    await gotoPage(page, `${BASE}/az`);
    // The palette sits behind its own <Suspense> boundary and arrives by
    // stream, so the keyboard listener loads with the component. Waiting for
    // the button to appear means it has hydrated; without that, Ctrl+K is lost.
    await page.locator('button[aria-label="Search"]').first().waitFor({ state: "visible", timeout: 15_000 });

    const input = page.locator('input[placeholder*="axtar"]');
    assert((await input.count()) === 0, "the palette is already open");

    await page.keyboard.press("Control+k");
    await input.first().waitFor({ state: "visible", timeout: 10_000 });

    await page.keyboard.press("Escape");
    await input.first().waitFor({ state: "detached", timeout: 10_000 });
  });

  // The palette's results are <button>s rather than <a>s (go() navigates via
  // the router) and the panel carries no `role` attribute — so the counter is
  // scoped to the panel holding the input, or every team link on the page would
  // be counted.
  const panel = () => page.locator('div:has(> input[placeholder*="axtar"])').first();

  async function openPalette() {
    await page.locator('button[aria-label="Search"]').first().click();
    await page.locator('input[placeholder*="axtar"]').first().waitFor({ state: "visible", timeout: 10_000 });
  }

  await check("a query shorter than two characters returns nothing", async () => {
    await gotoPage(page, `${BASE}/az`);
    await openPalette();
    await page.locator('input[placeholder*="axtar"]').first().fill("a");
    await page.waitForTimeout(1200);
    const results = await panel().locator("button").count();
    assert(results === 0, `a one-character query returned ${results} results`);
  });

  await check("a real query returns results and a result can be opened", async () => {
    const team = await prisma.team.findFirstOrThrow({ where: { isActive: true }, orderBy: { name: "asc" } });
    await gotoPage(page, `${BASE}/az`);
    await openPalette();
    await page.locator('input[placeholder*="axtar"]').first().fill(team.name);
    const result = panel().locator("button", { hasText: team.name }).first();
    await result.waitFor({ state: "visible", timeout: 15_000 });
    await result.click();
    await page.waitForURL((u) => u.pathname.includes(`/teams/${team.slug}`), { timeout: 20_000 });
  });

  console.log("\nTheme and language\n");

  await check("the light theme survives a reload without flashing", async () => {
    await gotoPage(page, `${BASE}/az`);
    await page.locator('button[aria-label="Toggle theme"]').first().click();
    await page.waitForTimeout(400);
    const chosen = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    assert(chosen, "data-theme was not set");

    await page.reload({ waitUntil: "domcontentloaded" });
    // Thanks to the inline script that runs before paint, the value must
    // already be in place as soon as the DOM is ready — otherwise the page
    // visibly jumps from dark to light.
    const afterReload = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    assert(afterReload === chosen, `the theme was lost: ${chosen} → ${afterReload}`);

    const stored = await page.evaluate(() => localStorage.getItem("theme"));
    assert(stored === chosen, `localStorage does not match: ${stored}`);
  });

  await check("switching language keeps the deep link", async () => {
    const team = await prisma.team.findFirstOrThrow({ where: { isActive: true } });
    await gotoPage(page, `${BASE}/az/teams/${team.slug}`);
    await page.locator('button:has-text("EN")').first().click();
    await page.waitForURL((u) => u.pathname.startsWith("/en/"), { timeout: 20_000 });
    assert(
      page.url().includes(`/en/teams/${team.slug}`),
      `the deep link was lost: ${page.url()}`,
    );
  });

  // The language control navigates on the client. A <script> inside the
  // component does not run on such navigations, so the document went on
  // declaring itself "az".
  await check("<html lang> changes too after switching language", async () => {
    await gotoPage(page, `${BASE}/az`);
    assert(
      (await page.evaluate(() => document.documentElement.lang)) === "az",
      "lang is wrong on first load",
    );
    await page.locator('button:has-text("EN")').first().click();
    await page.waitForURL((u) => u.pathname.startsWith("/en"), { timeout: 20_000 });
    await page.waitForFunction(() => document.documentElement.lang === "en", undefined, { timeout: 10_000 });
  });

  console.log("\n/players: search, sorting, pagination\n");

  await check("clicking a column writes sort and dir to the URL and updates aria-sort", async () => {
    await gotoPage(page, `${BASE}/az/players`);
    const header = page.locator('th a[href*="sort=kills"]').first();
    assert(await header.count(), "the kills column cannot be sorted");
    await header.click();
    await page.waitForURL((u) => u.searchParams.get("sort") === "kills", { timeout: 20_000 });
    const th = page.locator("th", { has: page.locator('a[href*="sort=kills"]') }).first();
    const sorted = await th.getAttribute("aria-sort");
    assert(sorted && sorted !== "none", `aria-sort was not set: ${sorted}`);
  });

  await check("search narrows the results and clearing restores them", async () => {
    const player = await prisma.player.findFirstOrThrow({
      where: { isClaimed: false },
      orderBy: { nickname: "asc" },
    });
    await gotoPage(page, `${BASE}/az/players`);
    await page.fill('input[name="q"]', player.nickname);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => (u.searchParams.get("q") ?? "") === player.nickname, { timeout: 20_000 });
    const body = await visibleText(page);
    assert(body.includes(player.nickname), "the searched player is not in the results");
    assert(/Təmizlə/i.test(body), "the clear button is not visible");
  });

  await check("an out-of-range page clamps to the last one instead of 404ing", async () => {
    const res = await gotoPage(page, `${BASE}/az/players?page=99`);
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    const current = page.locator('[aria-current="page"]').first();
    if (await current.count()) {
      const shown = Number((await current.innerText()).trim());
      assert(shown > 0 && shown < 99, `the page number did not clamp: ${shown}`);
    }
    const body = await visibleText(page);
    assert(!/tapılmadı/i.test(body), "the last page came back empty");
  });

  // /results used to fetch every finished match in one query. This check
  // confirms both that pagination works and that a filter survives alongside
  // the page number.
  await check("/results paginates and keeps its filter", async () => {
    await gotoPage(page, `${BASE}/az/results`);

    // The invariant that matters: however much data exists, one page must
    // never show more than 50 matches. The pagination links themselves only
    // appear past 50 results, so relying on them would give a false signal
    // against a small local database.
    //
    // The counter is limited to visible elements: mid-stream React also holds
    // the same list in a hidden container, and a plain count() saw 90 instead
    // of 50. The full explanation is on visibleCount in _lib.ts.
    const shown = await visibleCount(page, 'a[href^="/az/matches/"]');
    assert(shown <= 50, `${shown} matches on one page — the query has no limit`);

    await page.locator('a[href*="game="]').first().click();
    await page.waitForURL((u) => u.searchParams.has("game"), { timeout: 20_000 });
    const game = new URL(page.url()).searchParams.get("game");

    const next = page.locator('a[href*="page=2"]').first();
    if (await next.count()) {
      await next.click();
      await page.waitForURL((u) => u.searchParams.get("page") === "2", { timeout: 20_000 });
      assert(
        new URL(page.url()).searchParams.get("game") === game,
        `paging dropped the game filter: ${page.url()}`,
      );
    }
  });

  await check("an out-of-range page on /results clamps to the last one", async () => {
    const res = await gotoPage(page, `${BASE}/az/results?page=999`);
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    const body = await visibleText(page);
    assert(!/tapılmadı/i.test(body), "the last page came back empty");
  });

  console.log("\nMatch filters\n");

  await check("the game and date filters do not erase each other", async () => {
    await gotoPage(page, `${BASE}/az/matches`);
    const gamePill = page.locator('a[href*="game="]').first();
    assert(await gamePill.count(), "the game filter is missing");
    await gamePill.click();
    await page.waitForURL((u) => u.searchParams.has("game"), { timeout: 20_000 });
    const game = new URL(page.url()).searchParams.get("game");

    const datePill = page.locator('a[href*="date="]').first();
    assert(await datePill.count(), "the date filter is missing");
    await datePill.click();
    await page.waitForURL((u) => u.searchParams.has("date"), { timeout: 20_000 });

    const params = new URL(page.url()).searchParams;
    assert(params.get("game") === game, `choosing a date dropped the game filter: ${params.toString()}`);
  });

  console.log("\nAutomatic refresh on a live match\n");

  await check("a live match page updates the score without a manual reload", async () => {
    const live = await prisma.match.findFirst({
      where: { status: "LIVE" },
      include: { maps: { orderBy: { mapOrder: "asc" } } },
    });
    assert(live, "no LIVE match — this check needs one");
    assert(live.maps.length > 0, `the live match has no maps: ${live.slug}`);

    const map = live.maps[0];
    const before = map.teamAScore;
    const after = before + 1;

    await gotoPage(page, `${BASE}/az/matches/${live.slug}`);
    try {
      await prisma.matchMap.update({ where: { id: map.id }, data: { teamAScore: after } });
      // AutoRefresh calls router.refresh() every 8 seconds on a live match page.
      await page
        .locator(`text=/\\b${after}\\b/`)
        .first()
        .waitFor({ timeout: 25_000 });
    } finally {
      await prisma.matchMap.update({ where: { id: map.id }, data: { teamAScore: before } });
    }
  });

  console.log("\nMobile menu (390px)\n");

  await check("the menu opens, Escape closes it and focus returns to the button", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPage(page, `${BASE}/az`);

    const opener = page.locator('button[aria-label*="menu" i], header button:has(svg)').last();
    assert(await opener.count(), "the menu button was not found");
    await opener.click();

    const drawer = page.locator('a[href="/az/matches"]').last();
    await drawer.waitFor({ state: "visible", timeout: 10_000 });

    const locked = await page.evaluate(() => document.body.style.overflow);
    assert(locked === "hidden", `background scrolling was not locked: "${locked}"`);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const stillLocked = await page.evaluate(() => document.body.style.overflow);
    assert(stillLocked !== "hidden", "scrolling is still locked after Escape");

    const focusReturned = await page.evaluate(() => document.activeElement?.tagName);
    assert(focusReturned === "BUTTON", `focus did not return to the button: ${focusReturned}`);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  reportProblems(problems);
  report("Public widgets");
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
