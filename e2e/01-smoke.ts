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
import { prisma } from "../lib/prisma";
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

  console.log("\nStrukturlaşdırılmış data (JSON-LD)\n");

  // Saytda 2000-dən çox matç var, amma onlar maşın üçün oxunmurdu. Bu
  // etiketlər sınsa səhifədə heç nə dəyişmir — yalnız axtarış sistemi itirir,
  // ona görə testi var.
  async function jsonLd(url: string) {
    await gotoPage(page, url);
    const raw = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent();
    assert(raw, "JSON-LD etiketi yoxdur");
    try {
      return JSON.parse(raw!) as Record<string, unknown>;
    } catch {
      throw new Error(`JSON-LD parse olunmur: ${raw!.slice(0, 120)}`);
    }
  }

  await check("matç səhifəsi SportsEvent kimi təsvir olunur", async () => {
    const m = await prisma.match.findFirstOrThrow({
      select: { slug: true },
      orderBy: { scheduledAt: "desc" },
    });
    const d = await jsonLd(`${BASE}/az/matches/${m.slug}`);
    assert(d["@type"] === "SportsEvent", `yanlış tip: ${d["@type"]}`);
    assert(typeof d.name === "string" && d.name.includes("vs"), "ad qarşıdurmanı göstərmir");
    assert(typeof d.startDate === "string", "başlama vaxtı yoxdur");
    const c = d.competitor as unknown[];
    assert(Array.isArray(c) && c.length === 2, "iki komanda göstərilməyib");
  });

  // Uydurma məlumat verməmək qaydası buraya da aiddir: naməlum sahə
  // ümumiyyətlə yazılmamalıdır, boş sətir kimi yox.
  await check("naməlum sahələr JSON-LD-ə boş dəyərlə düşmür", async () => {
    const m = await prisma.match.findFirstOrThrow({
      select: { slug: true },
      orderBy: { scheduledAt: "desc" },
    });
    const d = await jsonLd(`${BASE}/az/matches/${m.slug}`);
    for (const [k, v] of Object.entries(d)) {
      assert(v !== null && v !== "" && v !== undefined, `${k} boş dəyərlə yazılıb`);
    }
  });

  await check("komanda SportsTeam, oyunçu Person kimi təsvir olunur", async () => {
    const t = await prisma.team.findFirstOrThrow({ select: { slug: true } });
    const td = await jsonLd(`${BASE}/az/teams/${t.slug}`);
    assert(td["@type"] === "SportsTeam", `komanda tipi yanlışdır: ${td["@type"]}`);

    const p = await prisma.player.findFirstOrThrow({ select: { slug: true } });
    const pd = await jsonLd(`${BASE}/az/players/${p.slug}`);
    assert(pd["@type"] === "Person", `oyunçu tipi yanlışdır: ${pd["@type"]}`);
  });
  console.log("\nKanonik ünvan və dil qarşılıqları\n");

  // Sayt eyni məzmunu iki dildə verir və siyahılar sorğu parametrləri ilə
  // işləyir. Bu etiketlər olmasa axtarış sistemi hər filtr kombinasiyasını
  // ayrı səhifə, iki dili isə təkrar məzmun kimi görür.
  async function links(url: string) {
    await gotoPage(page, url);
    const canonical = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href");
    const alts = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((ns) =>
        ns.map((n) => [n.getAttribute("hreflang"), n.getAttribute("href")] as const),
      );
    return { canonical, alts: Object.fromEntries(alts) as Record<string, string> };
  }

  await check("siyahı səhifəsinin kanonik ünvanı və hər iki dili var", async () => {
    const { canonical, alts } = await links(`${BASE}/az/matches`);
    assert(canonical?.endsWith("/az/matches"), `kanonik yanlışdır: ${canonical}`);
    assert(alts["az"]?.endsWith("/az/matches"), "az qarşılığı yoxdur");
    assert(alts["en"]?.endsWith("/en/matches"), "en qarşılığı yoxdur");
    assert(alts["x-default"]?.endsWith("/az/matches"), "x-default yoxdur");
  });

  // Əsas məqsəd budur: filtr və səhifə variantları bir ünvanda toplanmalıdır,
  // yoxsa eyni məzmun onlarla nüsxədə indekslənir.
  await check("filtrli və səhifələnmiş ünvan parametrsiz yola yığılır", async () => {
    const { canonical } = await links(`${BASE}/az/results?game=cs2&page=3`);
    assert(canonical?.endsWith("/az/results"), `parametrlər kanonikdə qalıb: ${canonical}`);
  });

  await check("ingilis tərəf qarşılıqlıdır", async () => {
    const { canonical, alts } = await links(`${BASE}/en/teams`);
    assert(canonical?.endsWith("/en/teams"), `kanonik yanlışdır: ${canonical}`);
    assert(alts["az"]?.endsWith("/az/teams"), "az qarşılığı yoxdur");
    assert(alts["en"]?.endsWith("/en/teams"), "en qarşılığı yoxdur");
  });

  await check("detal səhifəsinin kanonik ünvanı öz slug-ını saxlayır", async () => {
    const m = await prisma.match.findFirstOrThrow({
      select: { slug: true },
      orderBy: { scheduledAt: "desc" },
    });
    const { canonical, alts } = await links(`${BASE}/az/matches/${m.slug}`);
    assert(canonical?.endsWith(`/az/matches/${m.slug}`), `kanonik yanlışdır: ${canonical}`);
    assert(alts["en"]?.endsWith(`/en/matches/${m.slug}`), "en qarşılığı slug saxlamır");
  });
  console.log("\nPaylaşım şəkilləri (Open Graph)\n");

  // Link Telegram, Discord və ya X-ə atılanda görünən şəkil. Əvvəl heç biri yox
  // idi və paylaşılan hər ünvan çılpaq mətn kimi çıxırdı. Şəkil sınsa bunu heç
  // kim saytda görmür — yalnız paylaşan adam görür, ona görə testi var.
  async function assertOgImage(path: string, label: string) {
    const res = await page.request.get(`${BASE}${path}`);
    assert(res.status() === 200, `${label}: HTTP ${res.status()}`);
    const type = res.headers()["content-type"] ?? "";
    assert(type.includes("image/png"), `${label}: content-type ${type}`);
    // Boş və ya cırıq PNG-ni ölçü ilə tuturuq: satori sınanda kiçik fayl qaytarır.
    const bytes = (await res.body()).length;
    assert(bytes > 5000, `${label}: şəkil çox kiçikdir (${bytes} bayt)`);
  }

  await check("saytın standart paylaşım şəkli çəkilir", async () => {
    await assertOgImage("/az/opengraph-image", "standart");
    await assertOgImage("/en/opengraph-image", "standart (en)");
  });

  await check("matç səhifəsinin öz paylaşım şəkli var", async () => {
    const m = await prisma.match.findFirstOrThrow({
      where: { status: "FINISHED" },
      select: { slug: true },
      orderBy: { scheduledAt: "desc" },
    });
    await assertOgImage(`/az/matches/${m.slug}/opengraph-image`, "matç");
  });

  await check("xəbərin öz paylaşım şəkli var", async () => {
    const a = await prisma.newsArticle.findFirst({
      where: { publishedAt: { not: null } },
      select: { slug: true },
    });
    if (!a) return; // xəbər yoxdursa yoxlanacaq bir şey də yoxdur
    await assertOgImage(`/az/news/${a.slug}/opengraph-image`, "xəbər");
  });

  await check("olmayan matç üçün şəkil sınmır, brend şəkli qaytarır", async () => {
    await assertOgImage("/az/matches/belke-de-yoxdur-12345/opengraph-image", "olmayan matç");
  });

  await check("səhifənin HEAD-ində og:image mütləq ünvanla göstərilir", async () => {
    await gotoPage(page, `${BASE}/az`);
    const content = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    assert(content, "og:image meta etiketi yoxdur");
    assert(content!.startsWith("http"), `og:image nisbi ünvandır: ${content}`);
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
