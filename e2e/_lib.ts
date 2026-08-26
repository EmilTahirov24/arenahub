/**
 * Brauzer yoxlamaları üçün ortaq hissə.
 *
 * Repoda avtomatik test yox idi — düzəlişlərdən sonra hər dəfə eyni səhifələri
 * əl ilə gəzmək lazım gəlirdi. Bu fayl həmin gəzintini təkrarlana bilən edir.
 *
 * `playwright` artıq devDependency-dir və Chromium yüklüdür, ona görə əlavə
 * quraşdırma tələb olunmur. `@playwright/test` YOXDUR — ona görə burada öz
 * kiçik report mexanizmimiz var, `expect()` işlətmirik.
 *
 *   npx tsx e2e/01-smoke.ts       # public səhifələr
 *   npx tsx e2e/02-lifecycle.ts   # admin matç həyat dövrü
 *
 * Server əvvəlcədən qaldırılmalıdır: `npm run dev`.
 */
import "dotenv/config";
import { chromium, type Browser, type Page, type Response } from "playwright";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Next dev-in öz danışığı. Bunlar səhv deyil, ona görə hesabatı doldurmasınlar.
 * Siyahı qəsdən qısadır: nə qədər çox filtr olsa, əsl səhvi udmaq riski o qədər artır.
 */
const CONSOLE_NOISE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /react-devtools/i,
];

export type Problem = { kind: "console" | "pageerror" | "response"; text: string; url: string };

/** Konsol səhvləri və 4xx/5xx cavabları toplayan səhifə. */
export async function newPage(browser: Browser): Promise<{ page: Page; problems: Problem[] }> {
  const problems: Problem[] = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (CONSOLE_NOISE.some((r) => r.test(text))) return;
    problems.push({ kind: "console", text, url: page.url() });
  });

  page.on("pageerror", (err) => {
    problems.push({ kind: "pageerror", text: err.message, url: page.url() });
  });

  page.on("response", (res) => {
    if (res.status() < 400) return;
    // Favicon və source-map sorğuları məzmunla bağlı deyil.
    if (/\.(map|ico)(\?|$)/.test(res.url())) return;
    problems.push({ kind: "response", text: `HTTP ${res.status()}`, url: res.url() });
  });

  return { page, problems };
}

export async function launch(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

// --- kiçik hesabat mexanizmi ------------------------------------------------

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

/** Bir yoxlama. Atılan istisna "uğursuz" sayılır, prosesi dayandırmır. */
export async function check(name: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok    ${name}`);
    return true;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    results.push({ name, ok: false, detail });
    console.log(`  SƏHV  ${name}\n        ${detail.split("\n")[0]}`);
    return false;
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Hesabatı çap edir və uğursuzluq varsa exit kodunu 1 edir. */
export function report(title: string): void {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${"─".repeat(60)}`);
  console.log(`${title}: ${results.length - failed.length}/${results.length} keçdi`);
  if (failed.length) {
    console.log(`\nKeçməyənlər:`);
    for (const f of failed) console.log(`  · ${f.name}\n    ${f.detail}`);
    process.exitCode = 1;
  }
}

/** Toplanmış konsol/şəbəkə problemlərini qruplaşdırıb çap edir. */
export function reportProblems(problems: Problem[]): void {
  if (!problems.length) {
    console.log("\nKonsol səhvi və 4xx/5xx cavab yoxdur.");
    return;
  }
  console.log(`\nBrauzer səviyyəsində ${problems.length} problem:`);
  const seen = new Set<string>();
  for (const p of problems) {
    const key = `${p.kind}|${p.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  [${p.kind}] ${p.text}`);
    console.log(`           ${p.url}`);
  }
}

// --- giriş ------------------------------------------------------------------

export async function loginAdmin(page: Page): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  assert(email && password, "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD .env-də yoxdur");

  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Yönləndirmə server action-dan sonra client tərəfdə baş verir, ona görə
  // URL-i deyil, panelin özünü gözləyirik.
  await page.waitForURL((u) => !u.pathname.startsWith("/admin/login"), { timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
  assert(
    !new URL(page.url()).pathname.startsWith("/admin/login"),
    `admin girişi alınmadı, indi: ${page.url()}`,
  );
}

/**
 * Formanı göndərir.
 *
 * Səhifədə həmişə birdən çox submit düyməsi olur — admin layout-un «Çıxış»
 * düyməsi DOM-da hər səhifə formasından əvvəl gəlir, ona görə seçilməmiş
 * `button[type="submit"]` istifadəçini sistemdən çıxarır. Hər göndəriş öz
 * formasına bağlanmalıdır.
 */
export async function submitForm(page: Page, formSelector: string, buttonText?: string): Promise<void> {
  const form = page.locator(formSelector).first();
  assert(await form.count(), `forma tapılmadı: ${formSelector}`);
  const button = buttonText
    ? form.locator(`button:has-text("${buttonText}")`).first()
    : form.locator('button[type="submit"]').first();
  await button.click();
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
  await waitForContent(page);
}

/**
 * Səhifədə GÖRÜNƏN mətn.
 *
 * `textContent` <script> teqlərinin içini də qaytarır — Next səhifəyə RSC yükünü
 * elə oradan yerləşdirir, ona görə orada axtarış aparmaq həm yalan «tapıldı»,
 * həm də yalan «tapılmadı» verir. `innerText` yalnız çəkilən mətni görür.
 */
export async function visibleText(page: Page): Promise<string> {
  return page.locator("body").innerText();
}

/**
 * Səhifənin məzmununun həqiqətən çəkilməsini gözləyir.
 *
 * `domcontentloaded` yalnız header və footer-i verir: qalanı stream ilə gəlir.
 * `networkidle` də bəs etmir — dev serverin HMR soketi fasilələr yaradır və
 * gözləmə məzmun oturmamış qayıdır. Ölçü kimi əsas sahənin həm hündürlüyünün,
 * həm də mətninin olması götürülür.
 */
export async function waitForContent(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const mains = Array.from(document.querySelectorAll("main"));
      if (!mains.length) return document.body.innerText.trim().length > 0;
      return mains.some(
        (m) => m.getBoundingClientRect().height > 0 && (m.textContent ?? "").trim().length > 0,
      );
    },
    undefined,
    { timeout },
  );
}

/** Səhifəyə keçir və məzmunun çəkilməsini gözləyir. */
export async function gotoPage(page: Page, url: string): Promise<Response | null> {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await waitForContent(page);
  return res;
}

/** Səhifənin Next xəta sərhəddinə düşmədiyini yoxlayır. */
export async function assertNotErrorPage(page: Page): Promise<void> {
  const body = await visibleText(page);
  assert(!body.includes("Xəta baş verdi"), "səhifə xəta sərhəddinə düşdü");
  assert(!body.includes("Əməliyyat tamamlanmadı"), "səhifə panel xəta sərhəddinə düşdü");
  assert(!/Application error: a (client|server)-side exception/i.test(body), "Next tətbiq xətası");
}
