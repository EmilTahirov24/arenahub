/**
 * Shared harness for the browser checks.
 *
 * The repository had no automated tests: after every change the same pages had
 * to be walked by hand. This file makes that walk repeatable.
 *
 * `playwright` is already a devDependency and Chromium is installed, so no
 * extra setup is needed. `@playwright/test` is deliberately NOT used — hence
 * the small reporting mechanism below and no `expect()`.
 *
 *   npx tsx e2e/01-smoke.ts       # public pages
 *   npx tsx e2e/02-lifecycle.ts   # the admin match lifecycle
 *
 * A server has to be running first, and which one matters:
 *
 *   npm run dev                          # fast, but can mislead
 *   npm run build && npm run start       # the REAL answer
 *
 * Two things produce false failures in dev, both measured:
 *
 * With `cacheComponents`, Next 16 writes a "blocking-prerender-dynamic"
 * warning to the console. The /admin/* and /player/* branches are deliberately
 * blocking — their parent layouts call `connection()` and set
 * `instant = false`, explained there — but dev still checks navigations INSIDE
 * those branches. That is a warning about a decision, not a defect, and it does
 * not exist in production.
 *
 * Routes compile on first visit, and a 20-second wait expires while they do.
 * So MORE tests fail right after `.next` is cleared, which is counterintuitive
 * enough to be worth writing down.
 *
 * Both causes disappear under `next start`: all 6 suites go green. When a
 * result looks doubtful, the production build is what decides it.
 *
 * `E2E_BASE_URL` points the run at any address.
 */
import "dotenv/config";
import { chromium, type Browser, type Locator, type Page, type Response } from "playwright";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Next dev talking to itself. These are not errors, so they should not fill
 * the report. The list is deliberately short: every filter added is another
 * chance to swallow a real error.
 */
const CONSOLE_NOISE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /react-devtools/i,
];

export type Problem = { kind: "console" | "pageerror" | "response"; text: string; url: string };

/** A page that collects console errors and 4xx/5xx responses. */
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
    // Favicon and source-map requests say nothing about the content.
    if (/\.(map|ico)(\?|$)/.test(res.url())) return;
    problems.push({ kind: "response", text: `HTTP ${res.status()}`, url: res.url() });
  });

  return { page, problems };
}

export async function launch(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

// --- a small reporting mechanism -------------------------------------------

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

/** One check. A thrown error counts as a failure and does not stop the run. */
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

/** Prints the report and sets exit code 1 if anything failed. */
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

/** Groups and prints the console and network problems collected. */
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

// --- signing in -------------------------------------------------------------

export async function loginAdmin(page: Page): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  assert(email && password, "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD .env-də yoxdur");

  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // The redirect happens on the client after the server action, so wait for
  // the panel itself rather than for the URL.
  await page.waitForURL((u) => !u.pathname.startsWith("/admin/login"), { timeout: 30_000 });
  await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
  assert(
    !new URL(page.url()).pathname.startsWith("/admin/login"),
    `admin girişi alınmadı, indi: ${page.url()}`,
  );
}

/**
 * Submits a form and waits for the server action to finish.
 *
 * There are two traps here.
 *
 * The first: a page always has more than one submit button. The admin layout's
 * "sign out" button comes before every page form in the DOM, so an unscoped
 * `button[type="submit"]` signs the user out. Every submit must be bound to
 * its own form.
 *
 * The second: a server action causes no navigation, so no `load` event fires;
 * and `networkidle` never arrives under Partial Prerendering, because the
 * dynamic part streams over an open connection. The reliable signal is the
 * action's own POST response.
 */
export async function submitForm(page: Page, formSelector: string, buttonText?: string): Promise<void> {
  const form = page.locator(formSelector).first();
  assert(await form.count(), `forma tapılmadı: ${formSelector}`);
  const button = buttonText
    ? form.locator(`button:has-text("${buttonText}")`).first()
    : form.locator('button[type="submit"]').first();

  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST", { timeout: 30_000 }).catch(() => null),
    button.click(),
  ]);
  // The POST came back; a short pause for React to render the result.
  await page.waitForTimeout(300);
  await waitForContent(page);
}

/**
 * Clicks a button and waits for the server action's POST response.
 *
 * `submitForm` is for when the whole form is selected; this is for a locator
 * already in hand. The reason is the same: the action causes no navigation, so
 * `load` never fires, and `networkidle` never happens with a streamed
 * response.
 */
export async function clickAndSettle(page: Page, locator: Locator): Promise<void> {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST", { timeout: 30_000 }).catch(() => null),
    locator.click(),
  ]);
  await page.waitForTimeout(300);
  await waitForContent(page);
}

/**
 * The text a reader can actually SEE.
 *
 * `textContent` also returns the contents of <script> tags, and that is where
 * Next puts the RSC payload — so searching it produces both false "found" and
 * false "not found". `innerText` sees only rendered text.
 */
export async function visibleText(page: Page): Promise<string> {
  return page.locator("body").innerText();
}

/**
 * Counts only the matching elements that are VISIBLE.
 *
 * While streaming, React writes a completed Suspense boundary into a hidden
 * container first and then moves it into place. For that moment the DOM holds
 * TWO copies of the same list, and a plain `locator.count()` counts both — the
 * hidden one is in the DOM too.
 *
 * This broke the `/results` pagination check for no real reason: the 50-row
 * limit was being applied, but the counter saw 90. Run on its own the suite hit
 * a warm cache and never caught it; in a full run the server is busy, the
 * stream takes longer, and the measurement lands in the middle of it. A varying
 * test result, not a defect in the application.
 *
 * EVERY counter that asserts an upper bound has to go through this. Existence
 * ("at least one") and absence ("none at all") are safe: the hidden copy
 * produces neither a false positive nor a false negative for those.
 */
export function visibleCount(page: Page, selector: string): Promise<number> {
  return page.locator(`${selector}:visible`).count();
}

/**
 * Waits until the page's content has actually rendered.
 *
 * `domcontentloaded` gives only the shell; the rest arrives by stream. And
 * `networkidle` is no use AT ALL here — Partial Prerendering sends the shell
 * immediately and streams the dynamic part over an open connection, so the
 * network is never "idle". The measure used instead is the main region having
 * both a height and some text, which becomes true when the stream finishes.
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

/** Navigates to a page and waits for its content to render. */
export async function gotoPage(page: Page, url: string): Promise<Response | null> {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await waitForContent(page);
  return res;
}

/** Asserts the page did not fall into a Next error boundary. */
export async function assertNotErrorPage(page: Page): Promise<void> {
  const body = await visibleText(page);
  assert(!body.includes("Xəta baş verdi"), "səhifə xəta sərhəddinə düşdü");
  assert(!body.includes("Əməliyyat tamamlanmadı"), "səhifə panel xəta sərhəddinə düşdü");
  assert(!/Application error: a (client|server)-side exception/i.test(body), "Next tətbiq xətası");
}
