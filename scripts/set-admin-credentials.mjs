/**
 * Changes the admin account's email and password on the live site, through the
 * panel's OWN form.
 *
 *   node scripts/set-admin-credentials.mjs \
 *     --url https://arenahub-wheat.vercel.app \
 *     --current-email admin@example.com --current-password changeme \
 *     --email new@address.com --password newPassword
 *
 * Why through the panel: the live `DATABASE_URL` is a `Secret` on Vercel and
 * cannot be read from this machine, so writing to the database directly is not
 * possible. The panel's own form (`updateAdminUser`) does the same job and
 * already exists.
 *
 * The order is deliberate: after the change it signs in again in a FRESH browser
 * context. With the old session still open, the feeling that "it worked" can be
 * false - only a clean sign-in proves it. It also checks that the old
 * credentials have stopped working.
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
  console.error("A missing argument. See the example at the top of this file.");
  process.exit(1);
}

async function login(browser, email, password) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${URL_}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  // The sidebar's "sign out" is a submit button too, and it comes first on the
  // page; without scoping the search to the form, that is what gets clicked and
  // nothing happens.
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/admin/login"), { timeout: 30_000 }).catch(() => {});
  const ok = !new URL(page.url()).pathname.startsWith("/admin/login");
  return { ctx, page, ok };
}

const browser = await chromium.launch({ headless: true });
try {
  const a = await login(browser, CUR_EMAIL, CUR_PASS);
  if (!a.ok) {
    console.error("1. signing in with the old credentials FAILED - nothing was changed.");
    process.exit(1);
  }
  console.log("1. signed in with the old credentials: OK");

  await a.page.goto(`${URL_}/admin/users`, { waitUntil: "domcontentloaded" });
  // `/admin/users/new` also matches this selector - that is the "new admin" button.
  const hrefs = await a.page.$$eval('a[href^="/admin/users/"]', (els) =>
    els.map((e) => e.getAttribute("href") ?? "").filter((h) => h && !h.endsWith("/new")),
  );
  if (hrefs.length === 0) {
    console.error("2. no admin row was found - stopping.");
    process.exit(1);
  }
  if (hrefs.length > 1) console.log(`   (there are ${hrefs.length} admin accounts; the first is used)`);

  await a.page.goto(`${URL_}${hrefs[0]}`, { waitUntil: "domcontentloaded" });
  const role = await a.page.locator('select[name="role"]').inputValue();
  console.log(`2. account opened, role: ${role}`);
  if (role !== "SUPER_ADMIN") {
    console.error("   That account is not a SUPER_ADMIN - stopping.");
    process.exit(1);
  }

  await a.page.fill('input[name="email"]', NEW_EMAIL);
  await a.page.fill('input[name="password"]', NEW_PASS);
  await a.page.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
  await a.page.waitForURL((u) => u.pathname === "/admin/users", { timeout: 30_000 }).catch(() => {});
  console.log(`3. the form was submitted, address: ${new URL(a.page.url()).pathname}`);
  await a.ctx.close();

  const b = await login(browser, NEW_EMAIL, NEW_PASS);
  console.log(`4. fresh session with the NEW credentials: ${b.ok ? "OK" : "FAILED"}`);
  await b.ctx.close();

  const c = await login(browser, CUR_EMAIL, CUR_PASS);
  console.log(`5. old credentials: ${c.ok ? "STILL WORK - TAKE NOTE!" : "no longer work (good)"}`);
  await c.ctx.close();

  if (!b.ok) {
    console.error("\nThe new credentials do not work. Sign in with the old ones and check by hand.");
    process.exit(1);
  }
  console.log("\nDone.");
  if (NEW_PASS.length < 12) {
    console.log(`WARNING: the password is ${NEW_PASS.length} characters and the panel is at a public address.`);
  }
} finally {
  await browser.close();
}
