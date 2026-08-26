/**
 * Bir suala cavab verir: public saytın interaktiv hissələri həqiqətən işləyirmi?
 *
 * 01-smoke səhifələrin açıldığını yoxlayır, bu dəst isə onların DAVRANIŞINI —
 * klaviatura, fokus, URL vəziyyəti və avtomatik yenilənmə. Bunlar məhz gözlə
 * baxanda düzgün görünən, amma klaviatura ilə və ya paylaşılan linkdə sınan
 * yerlərdir.
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
  gotoPage,
} from "./_lib";
import { prisma } from "../lib/prisma";

async function main() {
  const browser = await launch();
  const { page, problems } = await newPage(browser);

  console.log("Komanda paleti (Ctrl+K)\n");

  await check("Ctrl+K paleti açır, Escape bağlayır", async () => {
    await gotoPage(page, `${BASE}/az`);
    const input = page.locator('input[placeholder*="axtar"]');
    assert((await input.count()) === 0, "palet əvvəlcədən açıqdır");

    await page.keyboard.press("Control+k");
    await input.first().waitFor({ state: "visible", timeout: 10_000 });

    await page.keyboard.press("Escape");
    await input.first().waitFor({ state: "detached", timeout: 10_000 });
  });

  // Paletin nəticələri <a> deyil, <button>-dur (go() router ilə keçid edir), və
  // panelin `role` atributu yoxdur — ona görə sayğac inputu saxlayan panelə
  // bağlanır, yoxsa səhifədəki bütün komanda linkləri sayılır.
  const panel = () => page.locator('div:has(> input[placeholder*="axtar"])').first();

  async function openPalette() {
    await page.locator('button[aria-label="Search"]').first().click();
    await page.locator('input[placeholder*="axtar"]').first().waitFor({ state: "visible", timeout: 10_000 });
  }

  await check("iki simvoldan qısa sorğu nəticə göstərmir", async () => {
    await gotoPage(page, `${BASE}/az`);
    await openPalette();
    await page.locator('input[placeholder*="axtar"]').first().fill("a");
    await page.waitForTimeout(1200);
    const results = await panel().locator("button").count();
    assert(results === 0, `bir simvolluq sorğu ${results} nəticə verdi`);
  });

  await check("real sorğu nəticə verir və nəticəyə keçid işləyir", async () => {
    const team = await prisma.team.findFirstOrThrow({ where: { isActive: true }, orderBy: { name: "asc" } });
    await gotoPage(page, `${BASE}/az`);
    await openPalette();
    await page.locator('input[placeholder*="axtar"]').first().fill(team.name);
    const result = panel().locator("button", { hasText: team.name }).first();
    await result.waitFor({ state: "visible", timeout: 15_000 });
    await result.click();
    await page.waitForURL((u) => u.pathname.includes(`/teams/${team.slug}`), { timeout: 20_000 });
  });

  console.log("\nTema və dil\n");

  await check("işıqlı tema yenidən yükləyəndə sayrışmadan qalır", async () => {
    await gotoPage(page, `${BASE}/az`);
    await page.locator('button[aria-label="Toggle theme"]').first().click();
    await page.waitForTimeout(400);
    const chosen = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    assert(chosen, "data-theme təyin olunmadı");

    await page.reload({ waitUntil: "domcontentloaded" });
    // Boyanmadan əvvəl işləyən inline skript sayəsində dəyər elə DOM hazır olanda
    // yerində olmalıdır — əks halda qaranlıqdan işıqlıya sıçrayış görünür.
    const afterReload = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    assert(afterReload === chosen, `tema itdi: ${chosen} → ${afterReload}`);

    const stored = await page.evaluate(() => localStorage.getItem("theme"));
    assert(stored === chosen, `localStorage uyğun deyil: ${stored}`);
  });

  await check("dil keçidi dərin ünvanı saxlayır", async () => {
    const team = await prisma.team.findFirstOrThrow({ where: { isActive: true } });
    await gotoPage(page, `${BASE}/az/teams/${team.slug}`);
    await page.locator('button:has-text("EN")').first().click();
    await page.waitForURL((u) => u.pathname.startsWith("/en/"), { timeout: 20_000 });
    assert(
      page.url().includes(`/en/teams/${team.slug}`),
      `dərin ünvan itdi: ${page.url()}`,
    );
  });

  // Dil düyməsi client tərəfdə keçid edir. Komponent içindəki <script> belə
  // keçidlərdə işləmədiyi üçün sənəd özünü hələ də «az» elan edirdi.
  await check("dil keçidindən sonra <html lang> də dəyişir", async () => {
    await gotoPage(page, `${BASE}/az`);
    assert(
      (await page.evaluate(() => document.documentElement.lang)) === "az",
      "ilk yüklənmədə lang səhvdir",
    );
    await page.locator('button:has-text("EN")').first().click();
    await page.waitForURL((u) => u.pathname.startsWith("/en"), { timeout: 20_000 });
    await page.waitForFunction(() => document.documentElement.lang === "en", undefined, { timeout: 10_000 });
  });

  console.log("\n/players: axtarış, sıralama, səhifələmə\n");

  await check("sütuna klik URL-ə sort və dir yazır, aria-sort dəyişir", async () => {
    await gotoPage(page, `${BASE}/az/players`);
    const header = page.locator('th a[href*="sort=kills"]').first();
    assert(await header.count(), "kills sütunu sıralana bilmir");
    await header.click();
    await page.waitForURL((u) => u.searchParams.get("sort") === "kills", { timeout: 20_000 });
    const th = page.locator("th", { has: page.locator('a[href*="sort=kills"]') }).first();
    const sorted = await th.getAttribute("aria-sort");
    assert(sorted && sorted !== "none", `aria-sort qurulmadı: ${sorted}`);
  });

  await check("axtarış nəticəni daraldır və «Təmizlə» geri qaytarır", async () => {
    const player = await prisma.player.findFirstOrThrow({
      where: { isClaimed: false },
      orderBy: { nickname: "asc" },
    });
    await gotoPage(page, `${BASE}/az/players`);
    await page.fill('input[name="q"]', player.nickname);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => (u.searchParams.get("q") ?? "") === player.nickname, { timeout: 20_000 });
    const body = await visibleText(page);
    assert(body.includes(player.nickname), "axtarılan oyunçu nəticədə yoxdur");
    assert(/Təmizlə/i.test(body), "«Təmizlə» düyməsi görünmür");
  });

  await check("diapazondan kənar səhifə sonuncuya sıxılır, 404 vermir", async () => {
    const res = await gotoPage(page, `${BASE}/az/players?page=99`);
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    const current = page.locator('[aria-current="page"]').first();
    if (await current.count()) {
      const shown = Number((await current.innerText()).trim());
      assert(shown > 0 && shown < 99, `səhifə nömrəsi sıxılmadı: ${shown}`);
    }
    const body = await visibleText(page);
    assert(!/tapılmadı/i.test(body), "sonuncu səhifə boş göründü");
  });

  // /results əvvəl bütün bitmiş matçları bir sorğuda çəkirdi. Bu yoxlama həm
  // səhifələmənin işlədiyini, həm də filtrin səhifə nömrəsi ilə birlikdə
  // qaldığını təsdiqləyir.
  await check("/results səhifələnir və filtri saxlayır", async () => {
    await gotoPage(page, `${BASE}/az/results`);

    // Əsas invariant budur: bir səhifə nə qədər data olsa da 50 matçdan çox
    // göstərməməlidir. Səhifələmə linklərinin özü yalnız 50-dən çox nəticə
    // olanda görünür, ona görə ona bağlanmaq lokal bazada yalan siqnal verərdi.
    const shown = await page.locator('a[href^="/az/matches/"]').count();
    assert(shown <= 50, `bir səhifədə ${shown} matç — sorğu limitsizdir`);

    await page.locator('a[href*="game="]').first().click();
    await page.waitForURL((u) => u.searchParams.has("game"), { timeout: 20_000 });
    const game = new URL(page.url()).searchParams.get("game");

    const next = page.locator('a[href*="page=2"]').first();
    if (await next.count()) {
      await next.click();
      await page.waitForURL((u) => u.searchParams.get("page") === "2", { timeout: 20_000 });
      assert(
        new URL(page.url()).searchParams.get("game") === game,
        `səhifə keçidi oyun filtrini sildi: ${page.url()}`,
      );
    }
  });

  await check("/results-da diapazondan kənar səhifə sonuncuya sıxılır", async () => {
    const res = await gotoPage(page, `${BASE}/az/results?page=999`);
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    const body = await visibleText(page);
    assert(!/tapılmadı/i.test(body), "sonuncu səhifə boş göründü");
  });

  console.log("\nMatç filtrləri\n");

  await check("oyun və tarix filtrləri bir-birini silmir", async () => {
    await gotoPage(page, `${BASE}/az/matches`);
    const gamePill = page.locator('a[href*="game="]').first();
    assert(await gamePill.count(), "oyun filtri yoxdur");
    await gamePill.click();
    await page.waitForURL((u) => u.searchParams.has("game"), { timeout: 20_000 });
    const game = new URL(page.url()).searchParams.get("game");

    const datePill = page.locator('a[href*="date="]').first();
    assert(await datePill.count(), "tarix filtri yoxdur");
    await datePill.click();
    await page.waitForURL((u) => u.searchParams.has("date"), { timeout: 20_000 });

    const params = new URL(page.url()).searchParams;
    assert(params.get("game") === game, `tarix seçimi oyun filtrini sildi: ${params.toString()}`);
  });

  console.log("\nCanlı matçın avtomatik yenilənməsi\n");

  await check("canlı matç səhifəsi əl ilə yenilənmədən hesabı yeniləyir", async () => {
    const live = await prisma.match.findFirst({
      where: { status: "LIVE" },
      include: { maps: { orderBy: { mapOrder: "asc" } } },
    });
    assert(live, "LIVE matç yoxdur — bu yoxlama üçün lazımdır");
    assert(live.maps.length > 0, `canlı matçın xəritəsi yoxdur: ${live.slug}`);

    const map = live.maps[0];
    const before = map.teamAScore;
    const after = before + 1;

    await gotoPage(page, `${BASE}/az/matches/${live.slug}`);
    try {
      await prisma.matchMap.update({ where: { id: map.id }, data: { teamAScore: after } });
      // AutoRefresh canlı matç səhifəsində 8 saniyəlik intervalla router.refresh() edir.
      await page
        .locator(`text=/\\b${after}\\b/`)
        .first()
        .waitFor({ timeout: 25_000 });
    } finally {
      await prisma.matchMap.update({ where: { id: map.id }, data: { teamAScore: before } });
    }
  });

  console.log("\nMobil menyu (390px)\n");

  await check("menyu açılır, Escape bağlayır və fokus düyməyə qayıdır", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPage(page, `${BASE}/az`);

    const opener = page.locator('button[aria-label*="menu" i], header button:has(svg)').last();
    assert(await opener.count(), "menyu düyməsi tapılmadı");
    await opener.click();

    const drawer = page.locator('a[href="/az/matches"]').last();
    await drawer.waitFor({ state: "visible", timeout: 10_000 });

    const locked = await page.evaluate(() => document.body.style.overflow);
    assert(locked === "hidden", `arxa fon sürüşməsi bağlanmadı: "${locked}"`);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const stillLocked = await page.evaluate(() => document.body.style.overflow);
    assert(stillLocked !== "hidden", "Escape-dən sonra sürüşmə hələ bağlıdır");

    const focusReturned = await page.evaluate(() => document.activeElement?.tagName);
    assert(focusReturned === "BUTTON", `fokus düyməyə qayıtmadı: ${focusReturned}`);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  reportProblems(problems);
  report("Public vidcetlər");
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
