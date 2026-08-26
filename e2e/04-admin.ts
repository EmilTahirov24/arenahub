/**
 * Bir suala cavab verir: admin panelin qalan bölmələri — məzmun, reklam,
 * istifadəçi və fayl yükləmə — düzgün işləyirmi və icazələr həqiqətənmi tutur?
 *
 * 02-lifecycle matç axınını götürür; bu dəst onun toxunmadığı hər şeyi yoxlayır:
 * CRUD, xəbər sanitizasiyası, yükləmə limitləri, EDITOR rolunun sərhədləri və
 * panelin telefon görünüşü.
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
} from "./_lib";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

const GAME = "E2E Sınaq Oyunu";
const NEWS_AZ = "E2E Sınaq Xəbəri";
const AD = "E2E Sınaq Banneri";
const EDITOR_EMAIL = "e2e-editor@arenahub.invalid";
const EDITOR_PASSWORD = "editor12345";

/** 1×1 qırmızı PNG — yükləmə yoxlamaları üçün ən kiçik etibarlı fayl. */
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
  console.log(`(təmizləndi: ${news.length} xəbər, reklam/editor/oyun qalıqları)\n`);
}

async function main() {
  await cleanup();

  const browser = await launch();
  const { page, problems } = await newPage(browser);

  await loginAdmin(page);
  console.log("Admin girişi: ok\n");

  console.log("Oyunlar — yarat / redaktə et / sil\n");

  let gameId = "";
  await check("oyun yaradılır və siyahıda görünür", async () => {
    await gotoPage(page, `${BASE}/admin/games/new`);
    await page.fill('input[name="name"]', GAME);
    await page.fill('input[name="shortName"]', "E2E");
    await submitForm(page, 'form:has(input[name="shortName"])');
    assert(page.url().includes("/admin/games"), `siyahıya qayıtmadı: ${page.url()}`);
    const body = await visibleText(page);
    assert(body.includes(GAME), "yaradılan oyun siyahıda yoxdur");
    const row = await prisma.game.findFirstOrThrow({ where: { name: GAME } });
    gameId = row.id;
  });

  await check("oyunun adı redaktə olunur", async () => {
    await gotoPage(page, `${BASE}/admin/games/${gameId}`);
    await page.fill('input[name="name"]', `${GAME} (redaktə)`);
    await submitForm(page, 'form:has(input[name="shortName"])');
    const row = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
    assert(row.name === `${GAME} (redaktə)`, `ad dəyişmədi: ${row.name}`);
  });

  console.log("\nXəbər və sanitizasiya\n");

  let newsSlug = "";
  await check("xəbər yaradılır və dərc olunur", async () => {
    await gotoPage(page, `${BASE}/admin/news/new`);
    await page.fill('input[name="title_az"]', NEWS_AZ);
    await page.fill('input[name="title_en"]', "E2E Test Article");
    // Sanitizasiyanı yoxlamaq üçün qəsdən zərərli məzmun.
    const payload =
      "<p>Salam</p><script>window.__xss=1</script><img src=x onerror=\"window.__xss=2\">";
    await page.fill('textarea[name="bodyHtml_az"]', payload);
    await page.fill('textarea[name="bodyHtml_en"]', payload);
    await page.check('input[name="isPublished"]');
    await submitForm(page, 'form:has(input[name="title_az"])');
    const article = await prisma.newsArticle.findFirstOrThrow({
      where: { translations: { some: { title: NEWS_AZ } } },
    });
    assert(article.publishedAt, "məqalə dərc olunmadı");
    newsSlug = article.slug;
  });

  await check("məqalədəki script və onerror public səhifədə sağ qalmır", async () => {
    await gotoPage(page, `${BASE}/az/news/${newsSlug}`);
    const html = await page.content();
    assert(!/window\.__xss/.test(html), "zərərli kod HTML-də qalıb");
    assert(!/onerror=/i.test(html), "onerror atributu silinməyib");
    const executed = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss);
    assert(executed === undefined, "zərərli kod icra olunub");
    const body = await visibleText(page);
    assert(body.includes("Salam"), "təmiz məzmun da itib");
  });

  console.log("\nFayl yükləmə qaydaları\n");

  await check("düzgün PNG qəbul olunur", async () => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      multipart: { file: { name: "e2e.png", mimeType: "image/png", buffer: PNG } },
    });
    assert(res.ok(), `HTTP ${res.status()}`);
    const json = await res.json();
    assert(typeof json.url === "string" && json.url.length > 0, "cavabda url yoxdur");
  });

  await check("SVG rədd olunur", async () => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      multipart: {
        file: {
          name: "e2e.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
        },
      },
    });
    assert(!res.ok(), `SVG qəbul olundu: HTTP ${res.status()}`);
  });

  await check("PNG adı verilmiş mətn faylı magic-byte yoxlamasında tutulur", async () => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      multipart: { file: { name: "saxta.png", mimeType: "image/png", buffer: Buffer.from("bu PNG deyil") } },
    });
    assert(!res.ok(), `saxta PNG qəbul olundu: HTTP ${res.status()}`);
  });

  await check("5 MB-dan böyük fayl rədd olunur", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await page.request.post(`${BASE}/api/upload`, {
      multipart: { file: { name: "boyuk.png", mimeType: "image/png", buffer: big } },
    });
    assert(!res.ok(), `böyük fayl qəbul olundu: HTTP ${res.status()}`);
  });

  console.log("\nReklamın görünmə qaydası\n");

  await check("aktiv banner public saytda görünür", async () => {
    await prisma.adBanner.create({
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
    await gotoPage(page, `${BASE}/az`);
    const alts = await page.$$eval("img[alt]", (imgs) => imgs.map((i) => i.getAttribute("alt") ?? ""));
    assert(alts.includes("E2E banner alt"), "aktiv banner görünmür");
  });

  await check("gələcək tarixli banner gizlənir", async () => {
    await prisma.adBanner.updateMany({
      where: { name: AD },
      data: { startDate: new Date(Date.now() + 7 * 86_400_000) },
    });
    await gotoPage(page, `${BASE}/az`);
    const alts = await page.$$eval("img[alt]", (imgs) => imgs.map((i) => i.getAttribute("alt") ?? ""));
    assert(!alts.includes("E2E banner alt"), "gələcək tarixli banner hələ görünür");
  });

  console.log("\nEDITOR rolunun sərhədləri\n");

  await check("EDITOR admin yaradılır", async () => {
    await prisma.adminUser.create({
      data: {
        email: EDITOR_EMAIL,
        name: "E2E Editor",
        role: "EDITOR",
        passwordHash: await bcrypt.hash(EDITOR_PASSWORD, 10),
      },
    });
    const created = await prisma.adminUser.findUniqueOrThrow({ where: { email: EDITOR_EMAIL } });
    assert(created.role === "EDITOR", "rol EDITOR olmadı");
  });

  await check("EDITOR /admin/users səhifəsinə buraxılmır", async () => {
    await gotoPage(page, `${BASE}/admin/login`);
    await page.fill('input[name="email"]', EDITOR_EMAIL);
    await page.fill('input[name="password"]', EDITOR_PASSWORD);
    await submitForm(page, "form");
    await page.waitForURL((u) => !u.pathname.startsWith("/admin/login"), { timeout: 30_000 });

    await gotoPage(page, `${BASE}/admin/users`);
    assert(
      !new URL(page.url()).pathname.startsWith("/admin/users"),
      `EDITOR istifadəçilər səhifəsini açdı: ${page.url()}`,
    );
  });

  // Bu yoxlama qəsdən 500 və «Forbidden» konsol səhvi doğurur — sərhədin işlədiyini
  // məhz o sübut edir. Ona görə hesabatdan kənarda saxlanılır.
  const beforeForbidden = problems.length;
  await check("EDITOR silmə cəhdi xəta sərhəddinə düşür, çılpaq ekrana yox", async () => {
    await gotoPage(page, `${BASE}/admin/games/${gameId}`);
    await submitForm(page, 'form:has(button:has-text("Oyunu sil"))', "Oyunu sil");
    const body = await visibleText(page);
    assert(body.includes("Əməliyyat tamamlanmadı"), "admin error.tsx işə düşmədi");
    assert(body.includes("Panelə qayıt"), "geri qayıtmaq üçün link yoxdur");
    const still = await prisma.game.findUnique({ where: { id: gameId } });
    assert(still, "EDITOR oyunu silə bildi — icazə yoxlaması tutmur");
  });
  problems.length = beforeForbidden;

  console.log("\nTelefon görünüşü (390px)\n");

  await check("admin menyusu telefonda toggle arxasına yığılır", async () => {
    await loginAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPage(page, `${BASE}/admin`);
    const toggle = page.locator('button[aria-controls="admin-nav"]');
    assert(await toggle.count(), "menyu düyməsi yoxdur");
    assert(await toggle.isVisible(), "menyu düyməsi telefonda görünmür");
    assert((await toggle.getAttribute("aria-expanded")) === "false", "menyu əvvəlcədən açıqdır");
    await toggle.click();
    assert((await toggle.getAttribute("aria-expanded")) === "true", "menyu açılmadı");
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  console.log("\nTəmizlik\n");

  await check("SUPER_ADMIN oyunu silə bilir", async () => {
    await gotoPage(page, `${BASE}/admin/games/${gameId}`);
    await submitForm(page, 'form:has(button:has-text("Oyunu sil"))', "Oyunu sil");
    const gone = await prisma.game.findUnique({ where: { id: gameId } });
    assert(!gone, "oyun silinmədi");
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
