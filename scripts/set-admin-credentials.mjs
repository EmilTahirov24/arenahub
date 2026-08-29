/**
 * Canlı saytda admin hesabının e-poçt və şifrəsini panelin ÖZ formasından
 * dəyişir.
 *
 *   node scripts/set-admin-credentials.mjs \
 *     --url https://arenahub-wheat.vercel.app \
 *     --current-email admin@example.com --current-password changeme \
 *     --email yeni@unvan.com --password yeniSifre
 *
 * Niyə panel vasitəsilə: canlı `DATABASE_URL` Vercel-də `Secret`-dir və bu
 * maşından oxunmur, yəni bazaya birbaşa yazmaq mümkün deyil. Panelin öz forması
 * (`updateAdminUser`) eyni işi görür və onsuz da mövcuddur.
 *
 * Sıra qəsdən belədir: dəyişiklikdən sonra TƏZƏ brauzer konteksti ilə yenidən
 * girilir. Köhnə sessiya hələ açıq olduğu üçün "işlədi" hissi yalan ola bilər —
 * yalnız təmiz giriş sübutdur. Köhnə açarın artıq işləmədiyi də yoxlanılır.
 */
import { chromium } from "playwright";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const URL_ = arg("url");
const CUR_EMAIL = arg("current-email");
const CUR_PASS = arg("current-password");
const NEW_EMAIL = arg("email");
const NEW_PASS = arg("password");

if (!URL_ || !CUR_EMAIL || !CUR_PASS || !NEW_EMAIL || !NEW_PASS) {
  console.error("Çatışmayan arqument. Faylın başındakı nümunəyə bax.");
  process.exit(1);
}

async function login(browser, email, password) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${URL_}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  // Yan menyudakı «Çıxış» da submit düyməsidir və səhifədə birinci gəlir;
  // forma daxilində axtarmasan, o basılır və heç nə baş vermir.
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/admin/login"), { timeout: 30_000 }).catch(() => {});
  const ok = !new URL(page.url()).pathname.startsWith("/admin/login");
  return { ctx, page, ok };
}

const browser = await chromium.launch({ headless: true });
try {
  const a = await login(browser, CUR_EMAIL, CUR_PASS);
  if (!a.ok) {
    console.error("1. köhnə açarla giriş ALINMADI — heç nə dəyişdirilmədi.");
    process.exit(1);
  }
  console.log("1. köhnə açarla giriş: OK");

  await a.page.goto(`${URL_}/admin/users`, { waitUntil: "domcontentloaded" });
  // `/admin/users/new` da bu seçiciyə düşür — o, "+ Yeni admin" düyməsidir.
  const hrefs = await a.page.$$eval('a[href^="/admin/users/"]', (els) =>
    els.map((e) => e.getAttribute("href") ?? "").filter((h) => h && !h.endsWith("/new")),
  );
  if (hrefs.length === 0) {
    console.error("2. admin sətri tapılmadı — dayanıram.");
    process.exit(1);
  }
  if (hrefs.length > 1) console.log(`   (${hrefs.length} admin hesabı var, birincisi götürülür)`);

  await a.page.goto(`${URL_}${hrefs[0]}`, { waitUntil: "domcontentloaded" });
  const role = await a.page.locator('select[name="role"]').inputValue();
  console.log(`2. hesab açıldı, rol: ${role}`);
  if (role !== "SUPER_ADMIN") {
    console.error("   Bu hesab SUPER_ADMIN deyil — dayanıram.");
    process.exit(1);
  }

  await a.page.fill('input[name="email"]', NEW_EMAIL);
  await a.page.fill('input[name="password"]', NEW_PASS);
  await a.page.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
  await a.page.waitForURL((u) => u.pathname === "/admin/users", { timeout: 30_000 }).catch(() => {});
  console.log(`3. forma göndərildi, ünvan: ${new URL(a.page.url()).pathname}`);
  await a.ctx.close();

  const b = await login(browser, NEW_EMAIL, NEW_PASS);
  console.log(`4. YENİ açarla təzə sessiya: ${b.ok ? "OK" : "ALINMADI"}`);
  await b.ctx.close();

  const c = await login(browser, CUR_EMAIL, CUR_PASS);
  console.log(`5. köhnə açar: ${c.ok ? "HƏLƏ İŞLƏYİR — DİQQƏT!" : "artıq işləmir (yaxşı)"}`);
  await c.ctx.close();

  if (!b.ok) {
    console.error("\nYeni açar işləmir. Köhnəsi ilə panelə girib əl ilə yoxla.");
    process.exit(1);
  }
  console.log("\nHazırdır.");
  if (NEW_PASS.length < 12) {
    console.log(`XƏBƏRDARLIQ: şifrə ${NEW_PASS.length} simvoldur və panel ictimai ünvandadır.`);
  }
} finally {
  await browser.close();
}
