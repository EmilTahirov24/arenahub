/**
 * Bir suala cavab verir: public saytın hər səhifəsi açılırmı, yoxsa hansısa
 * biri xəta sərhəddinə düşür?
 *
 * Statik marşrutları hər iki dildə gəzir, sonra siyahı səhifələrindən əsl slug
 * götürüb dinamik səhifələri də açır — belədə həm səhifənin özü, həm də ona
 * aparan linkin düzgünlüyü yoxlanılmış olur.
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
import azMessages from "../messages/az.json";
import enMessages from "../messages/en.json";

/** İç-içə açarları "footer.terms" şəklinə salır. */
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

  console.log("Statik marşrutlar\n");
  for (const locale of ["az", "en"]) {
    for (const path of STATIC_PATHS) {
      const url = `${BASE}/${locale}${path}`;
      await check(`${locale}${path || "/"}`, async () => {
        const res = await gotoPage(page, url);
        assert(res, "cavab yoxdur");
        assert(res.status() === 200, `HTTP ${res.status()}`);
        await assertNotErrorPage(page);
      });
    }
  }

  console.log("\nDinamik səhifələr (siyahıdan götürülmüş əsl slug ilə)\n");
  const dynamic: { name: string; from: string; linkPattern: RegExp }[] = [
    { name: "matç detalı", from: "/az/results", linkPattern: /^\/az\/matches\/[^/]+$/ },
    { name: "komanda detalı", from: "/az/teams", linkPattern: /^\/az\/teams\/[^/]+$/ },
    { name: "oyunçu detalı", from: "/az/players", linkPattern: /^\/az\/players\/[^/]+$/ },
    { name: "turnir detalı", from: "/az/events", linkPattern: /^\/az\/events\/[^/]+$/ },
    { name: "xəbər detalı", from: "/az/news", linkPattern: /^\/az\/news\/[^/]+$/ },
  ];

  for (const d of dynamic) {
    await check(d.name, async () => {
      await gotoPage(page, `${BASE}${d.from}`);
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
      const target = hrefs.find((h) => d.linkPattern.test(h));
      assert(target, `${d.from} səhifəsində uyğun link tapılmadı`);
      const res = await gotoPage(page, `${BASE}${target}`);
      assert(res && res.status() === 200, `HTTP ${res?.status()} — ${target}`);
      await assertNotErrorPage(page);
    });
  }

  console.log("\nİngilis səhifələrinə azərbaycanca mətn sızmır\n");

  // Hərf üzrə axtarış yalan siqnal verir: real komanda adlarında da «ə» var
  // (yerli səhnə komandaları). Ona görə ölçü kimi tərcümə faylının özü götürülür
  // — az.json-dakı hər dəyər /en-də görünürsə, deməli tərcümə sızır.
  const azOnly = Object.entries(flatten(azMessages))
    .filter(([key, value]) => flatten(enMessages)[key] !== value)
    .map(([, value]) => value);

  for (const path of ["", "/matches", "/teams", "/players", "/news", "/terms", "/privacy"]) {
    await check(`en${path || "/"} azərbaycanca sətir saxlamır`, async () => {
      await gotoPage(page, `${BASE}/en${path}`);
      const body = await visibleText(page);
      const leaked = azOnly.filter((s) => s.length > 3 && body.includes(s));
      assert(leaked.length === 0, `tərcümə olunmamış: ${leaked.join(" · ")}`);
    });
  }

  console.log("\nMaşın üçün marşrutlar\n");

  await check("/sitemap.xml", async () => {
    const res = await page.goto(`${BASE}/sitemap.xml`, { timeout: 45_000 });
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    const body = await res.text();
    assert(body.includes("<urlset"), "urlset yoxdur");
    assert(body.includes("/az/") && body.includes("/en/"), "hər iki dil sitemap-da olmalıdır");
  });

  await check("/robots.txt admin və player-i bağlayır", async () => {
    const res = await page.goto(`${BASE}/robots.txt`, { timeout: 45_000 });
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    const body = await res.text();
    for (const p of ["/admin", "/api", "/player"]) {
      assert(body.includes(p), `${p} disallow siyahısında yoxdur`);
    }
  });

  await check("/manifest.webmanifest", async () => {
    const res = await page.goto(`${BASE}/manifest.webmanifest`, { timeout: 45_000 });
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
  });

  await check("/api/search 2 simvoldan qısa sorğunu rədd edir", async () => {
    const res = await page.request.get(`${BASE}/api/search?q=a&locale=az`);
    const json = await res.json();
    assert(Array.isArray(json.results) && json.results.length === 0, "qısa sorğu nəticə qaytarmamalıdır");
  });

  await check("/api/search real sorğuya nəticə verir", async () => {
    const res = await page.request.get(`${BASE}/api/search?q=vi&locale=az`);
    assert(res.status() === 200, `HTTP ${res.status()}`);
    const json = await res.json();
    assert(Array.isArray(json.results), "cavabda results massivi yoxdur");
    assert(json.results.length > 0, "heç nə tapılmadı — axtarış işləmir");
    for (const r of json.results) {
      assert(r.href?.startsWith("/az/"), `href dil prefiksi olmadan: ${r.href}`);
      assert(r.label && r.type, "nəticədə label və ya type yoxdur");
    }
  });

  // Bu qəsdən 404-dür, ona görə problem toplayıcısından kənarda saxlanılır.
  const before = problems.length;
  await check("olmayan ünvan 404 verir", async () => {
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
