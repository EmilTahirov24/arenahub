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

  await check("dashboard menyudakı hər bölmə üçün sayğac göstərir", async () => {
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
      assert(body.includes(label), `dashboard-da «${label}» sayğacı yoxdur`);
    }
  });

  // İdxal saytın yeganə data mənbəyidir və GitHub Actions-da qaçır. Sınsa və ya
  // söndürülsə, sayt səssizcə köhnəlir — bu panel həmin sükutu görünən edir.
  await check("dashboard təzə idxalı sağlam göstərir", async () => {
    await prisma.importRun.deleteMany({ where: { script: "import-live" } });
    await prisma.importRun.create({
      data: { script: "import-live", ok: true, written: 12, note: "12 matç, 3 xəritə", finishedAt: new Date() },
    });
    await gotoPage(page, `${BASE}/admin`);
    const body = await visibleText(page);
    assert(body.includes("Matç idxalı"), "idxal paneli yoxdur");
    assert(/son uğurlu qaçış/.test(body), "sağlam vəziyyət göstərilmir");
    assert(body.includes("12 matç"), "sonuncu qaçışın xülasəsi göstərilmir");
    assert(!/dayanmış ola bilər/.test(body), "təzə idxal köhnə kimi işarələnib");
  });

  await check("dashboard dayanmış idxalı xəbərdarlıqla göstərir", async () => {
    // Həddin özündən hesablayırıq. Əvvəl sabit 6 saat yazılmışdı; hədd 3 saatdan
    // 6-ya qalxanda fikstur tam sərhədə düşdü, yəni test bir dəqiqəlik fərqlə
    // yalan yaşıl verə bilərdi. Bir saat ehtiyat qoyuruq ki, hədd yenə dəyişsə
    // sınaq özü uyğunlaşsın.
    const old = new Date(Date.now() - (IMPORT_STALE_AFTER_MINUTES + 60) * 60_000);
    await prisma.importRun.deleteMany({ where: { script: "import-live" } });
    await prisma.importRun.create({
      data: { script: "import-live", ok: true, written: 4, startedAt: old, finishedAt: old },
    });
    await gotoPage(page, `${BASE}/admin`);
    const body = await visibleText(page);
    assert(/dayanmış ola bilər/.test(body), "dayanmış idxal üçün xəbərdarlıq yoxdur");
    assert(/GitHub Actions/.test(body), "hara baxmaq lazım olduğu yazılmayıb");
    await prisma.importRun.deleteMany({ where: { script: "import-live" } });
  });

  console.log("\nOyunlar — yarat / redaktə et / sil\n");

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

  // «Seçilmiş» qutusu matçdan silindi (starRating onsuz da var və göstərilir),
  // xəbərdə isə işə salındı. Bu iki yoxlama hər ikisini yerində saxlayır.
  await check("matç formasında artıq «Seçilmiş» qutusu yoxdur", async () => {
    await gotoPage(page, `${BASE}/admin/matches/new`);
    const box = page.locator('input[name="isFeatured"]');
    assert((await box.count()) === 0, "matç formasında hələ isFeatured qutusu var");
    const stars = page.locator('select[name="starRating"]');
    assert(await stars.count(), "starRating seçimi itib — matçın vaciblik idarəedicisi qalmalıdır");
  });

  await check("seçilmiş xəbər siyahıda birinci gəlir və nişanı görünür", async () => {
    const game = await prisma.game.findFirstOrThrow({ where: { slug: "cs2" } });
    const admin = await prisma.adminUser.findFirstOrThrow();
    // Köhnə tarixli, amma seçilmiş xəbər: sıralama tarixə görə olsaydı sonda qalardı.
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
    // Təzə, amma seçilməmiş xəbər.
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
      // Yoxlama /news-də aparılır, ana səhifədə yox. Ana səhifə ISR ilə 60 saniyə
      // keşlənir və bu fikstürlər bazaya BİRBAŞA yazılır, yəni admin
      // əməliyyatlarının çağırdığı revalidatePath işə düşmür. Ana səhifədə
      // yoxlasaydıq, sıralamanı deyil, keşin vaxtını sınamış olardıq.
      // /news isə searchParams oxuduğu üçün dinamikdir və həmişə təzədir.
      await gotoPage(page, `${BASE}/az/news`);
      const body = await visibleText(page);
      const posFeatured = body.indexOf("E2E Seçilmiş Xəbər");
      const posPlain = body.indexOf("E2E Adi Xəbər");
      assert(posFeatured >= 0, "seçilmiş xəbər siyahıda görünmür");
      assert(posPlain >= 0, "adi xəbər siyahıda görünmür — müqayisə mümkün deyil");
      assert(
        posFeatured < posPlain,
        "seçilmiş xəbər daha təzə xəbərdən sonra gəlir — sıralama işləmir",
      );
      assert(/Seçilmiş/.test(body), "kartda «Seçilmiş» nişanı yoxdur");
    } finally {
      await prisma.newsArticleTranslation.deleteMany({ where: { articleId: { in: [featured.id, recent.id] } } });
      await prisma.newsArticle.deleteMany({ where: { id: { in: [featured.id, recent.id] } } });
    }
  });


  console.log("\nFayl yükləmə qaydaları\n");

  await check("düzgün PNG qəbul olunur", async () => {
    const res = await page.request.post(`${BASE}/api/upload`, {
      multipart: { file: { name: "e2e.png", mimeType: "image/png", buffer: PNG } },
    });
    // Yükləmə saatda 20 ilə məhduddur (lib/rateLimit.ts) və sayğac server
    // prosesinin yaddaşındadır. Dəst arda-arda qaçırılanda dolur — bu, tətbiqin
    // səhvi deyil, ona görə səbəbi açıq yazırıq.
    assert(res.status() !== 429, "yükləmə limiti dolub (saatda 20). Serveri yenidən başladın.");
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

  // Banner Prisma ilə yaradılır, amma public tərəfə çıxması üçün admin
  // formasından saxlanılır. Səbəb: public səhifələr indi keşlənir və keşi ləğv
  // edən `revalidatePath` məhz admin əməliyyatının içindədir. Yandan yazıb
  // birbaşa yoxlasaq, reklamın görünmə qaydasını deyil, keşin vaxtını sınamış
  // olardıq. Şəkil yükləməsi bu axına salınmır — o, saatda 20 ilə məhduddur və
  // dəstin başqa yerində onsuz da yoxlanılır.
  await check("aktiv banner public saytda görünür", async () => {
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
    // Formanı olduğu kimi saxlamaq updateAd-i işə salır, o da keşi ləğv edir.
    await gotoPage(page, `${BASE}/admin/ads/${ad.id}`);
    await submitForm(page, 'form:has(input[name="linkUrl"])');

    await gotoPage(page, `${BASE}/az`);
    const alts = await page.$$eval("img[alt]", (imgs) => imgs.map((i) => i.getAttribute("alt") ?? ""));
    assert(alts.includes("E2E banner alt"), "aktiv banner görünmür");
  });

  // Sayğaclar olmadan reklam yeri satıla bilmir: "bu banner nə qədər
  // göstərildi?" sualına cavab yoxdursa, danışacaq rəqəm də yoxdur.
  await check("ekranda görünən banner göstərilmə kimi sayılır", async () => {
    const ad = await prisma.adBanner.findFirstOrThrow({ where: { name: AD } });
    await prisma.adBanner.update({ where: { id: ad.id }, data: { impressions: 0 } });

    await gotoPage(page, `${BASE}/az`);
    // Müşahidəçi sahənin yarısının bir saniyə görünməsini tələb edir, ona görə
    // banner əvvəlcə görünən sahəyə gətirilir, sonra gözlənilir.
    await page.locator('img[alt="E2E banner alt"]').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1600);

    // Beacon arxa planda göndərilir, yəni yazının gəlməsi bir az çəkə bilər.
    let count = 0;
    for (let i = 0; i < 20 && count === 0; i++) {
      count = (await prisma.adBanner.findUniqueOrThrow({ where: { id: ad.id } })).impressions;
      if (count === 0) await page.waitForTimeout(400);
    }
    assert(count >= 1, "banner ekranda göründü, amma göstərilmə sayılmadı");
  });

  await check("klik sayılır və reklamçının ünvanına yönləndirir", async () => {
    const ad = await prisma.adBanner.findFirstOrThrow({ where: { name: AD } });
    await prisma.adBanner.update({ where: { id: ad.id }, data: { clicks: 0 } });

    const res = await page.request.get(`${BASE}/api/ads/${ad.id}/click`, { maxRedirects: 0 });
    assert(res.status() === 307 || res.status() === 308 || res.status() === 302,
      `yönləndirmə gözlənilirdi, HTTP ${res.status()}`);
    const location = res.headers()["location"];
    assert(location === "https://example.com/", `yanlış hədəf: ${location}`);

    let clicks = 0;
    for (let i = 0; i < 20 && clicks === 0; i++) {
      clicks = (await prisma.adBanner.findUniqueOrThrow({ where: { id: ad.id } })).clicks;
      if (clicks === 0) await page.waitForTimeout(300);
    }
    assert(clicks === 1, `klik sayılmadı (${clicks})`);
  });

  // Panel rəqəmləri göstərməlidir, yoxsa saymağın mənası yoxdur.
  await check("reklam siyahısı göstərilmə, klik və CTR göstərir", async () => {
    await gotoPage(page, `${BASE}/admin/ads`);
    const body = await visibleText(page);
    assert(/göstərilmə/.test(body), "göstərilmə sütunu yoxdur");
    assert(/klik/.test(body), "klik sütunu yoxdur");
    assert(/%|—/.test(body), "CTR sütunu yoxdur");
  });

  await check("gələcək tarixli banner gizlənir", async () => {
    const ad = await prisma.adBanner.findFirstOrThrow({ where: { name: AD } });
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    await gotoPage(page, `${BASE}/admin/ads/${ad.id}`);
    await page.fill('input[name="startDate"]', future);
    await submitForm(page, 'form:has(input[name="linkUrl"])');

    await gotoPage(page, `${BASE}/az`);
    const alts = await page.$$eval("img[alt]", (imgs) => imgs.map((i) => i.getAttribute("alt") ?? ""));
    assert(!alts.includes("E2E banner alt"), "gələcək tarixli banner hələ görünür");
  });


  console.log("\nAdmin siyahıları\n");

  // Bu səhifələr əvvəl BÜTÜN sətirləri bir dəfəyə çəkirdi — 814 komanda,
  // 600 oyunçu — və hər açılış 3 saniyəyə qədər çəkirdi. Matçlarda isə
  // `take: 100` vardı, səhifələmə yox: yəni 2349 matçın 2249-u ümumiyyətlə
  // əlçatmaz idi. Say idxal ilə artdığı üçün bu, öz-özünə pisləşən qüsurdur.
  await check("siyahılar səhifələnir və axtarış işləyir", async () => {
    const total = await prisma.team.count();

    await gotoPage(page, `${BASE}/admin/teams`);
    const rows = await page.locator('a[href^="/admin/teams/"]').count();
    // + Yeni komanda linki də bu seçiciyə düşür, ona görə bir ehtiyat.
    assert(rows <= 52, `bir səhifədə ${rows} sətir — səhifələmə işləmir`);

    if (total > 50) {
      const pager = await page.locator('nav[aria-label="Səhifələr"]').count();
      assert(pager > 0, "50-dən çox komanda var, amma səhifələmə görünmür");
    }
  });

  await check("axtarış nəticəni daraldır", async () => {
    const team = await prisma.team.findFirstOrThrow({ select: { name: true } });
    await gotoPage(page, `${BASE}/admin/teams?q=${encodeURIComponent(team.name)}`);
    const body = await visibleText(page);
    assert(body.includes(team.name), `axtarılan komanda tapılmadı: ${team.name}`);
  });

  // Diapazondan kənar səhifə xəta verməməlidir.
  await check("olmayan səhifə nömrəsi sonuncuya sıxılır", async () => {
    const res = await gotoPage(page, `${BASE}/admin/players?page=9999`);
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    await assertNotErrorPage(page);
  });

  console.log("\nƏlçatanlıq\n");

  // Admin paneli hər gün işlədilən alətdir. Sahə etiketsiz olanda ekran
  // oxuyucusu onu adsız oxuyur və parol menecerləri tanımır. Bu formalar
  // giriş tələb etdiyi üçün yoxlama burada, public dəstdə deyil.
  await check("admin formalarının sahələri etiketlidir", async () => {
    const pages = [
      "/admin/games/new",
      "/admin/teams/new",
      "/admin/players/new",
      "/admin/tournaments/new",
      "/admin/news/new",
      "/admin/ads/new",
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

    assert(problems.length === 0, `etiketsiz sahə — ${problems.join(" | ")}`);
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
