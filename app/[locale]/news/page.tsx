import type { Metadata } from "next";
import { activeGames } from "@/lib/cachedQueries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import NewsCard from "@/components/news/NewsCard";
import { localeAlternates } from "@/lib/localeAlternates";
import { bestTextOn } from "@/lib/contrast";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    alternates: localeAlternates(locale, "/news"),
    title: t("nav.news"),
  };
}

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ game?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { game: gameSlug } = await searchParams;
  const t = await getTranslations();

  const games = await activeGames();

  // Oyun filtri iki mənbədən işləyir.
  //
  // Əl ilə yazılan xəbərin `gameId`-si olur. Həftəlik icmalın isə yoxdur, çünki
  // o, bütün oyunları əhatə edir — və məhz buna görə filtr əvvəl HƏMİŞƏ boş
  // nəticə verirdi: dörd düymə vəd edirdi, dördü də adamı boş ekrana aparırdı.
  //
  // İcmal artıq həftədə matçı olan oyunların slug-larını `tags`-a yazır. Ona
  // görə filtr «bu oyunun məqaləsi VƏ YA bu oyunu əhatə edən icmal» deməkdir.
  // Uydurma deyil: etiket həmin həftədə həqiqətən oynanılmış oyunlardır.
  const matchesGame = (slug: string) => ({
    OR: [{ game: { slug } }, { tags: { has: slug } }],
  });

  const where = {
    publishedAt: { not: null },
    ...(gameSlug && games.some((g) => g.slug === gameSlug) ? matchesGame(gameSlug) : {}),
  };

  // Pil yalnız arxasında məqalə olan oyun üçün göstərilir. Sayğac filtrin ÖZ
  // qaydası ilə hesablanır, yoxsa düymə görünüb boş nəticə verə bilər.
  const perGame = await Promise.all(
    games.map(async (g) => ({
      game: g,
      n: await prisma.newsArticle.count({ where: { publishedAt: { not: null }, ...matchesGame(g.slug) } }),
    })),
  );
  const filterGames = perGame.filter((x) => x.n > 0).map((x) => x.game);

  const articles = await prisma.newsArticle.findMany({
    where,
    // Ana səhifə ilə eyni sıra: seçilmiş xəbər əvvəldə.
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: 24,
    include: { game: true, translations: true },
  });

  return (
    <PageShell showDefaultWidgets={false}>
      <h1 className="font-display mb-4 text-2xl font-bold">{t("nav.news")}</h1>

      {filterGames.length > 0 && (
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/news"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${!gameSlug ? "brand-gradient-bg border-transparent text-white" : "border-border-subtle text-foreground-muted hover:text-foreground"}`}
        >
          {locale === "az" ? "Hamısı" : "All"}
        </Link>
        {filterGames.map((game) => (
          <Link
            key={game.id}
            href={{ pathname: "/news", query: { game: game.slug } }}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={gameSlug === game.slug ? { backgroundColor: game.accentColor, borderColor: game.accentColor, color: bestTextOn(game.accentColor) } : undefined}
          >
            <span className={gameSlug === game.slug ? "" : "text-foreground-muted hover:text-foreground"}>{game.shortName}</span>
          </Link>
        ))}
      </div>
      )}

      {/* Ən təzə xəbər iki sütun tutur. İki eyni ölçülü qutu yan-yana duranda
          səhifənin harada başladığı bilinmirdi; genişlik oxucuya haradan
          başlayacağını göstərir və altdakı boşluğu da azaldır. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {articles.map((article, i) => (
          <div key={article.id} className={i === 0 && articles.length > 1 ? "sm:col-span-2" : undefined}>
            <NewsCard article={article} games={games} lead={i === 0 && articles.length > 1} />
          </div>
        ))}
      </div>

      {articles.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface p-8 text-center">
          <p className="mb-1 text-sm text-foreground-muted">
            {gameSlug
              ? locale === "az"
                ? "Bu oyun üzrə hələ xəbər yoxdur."
                : "No news for this game yet."
              : locale === "az"
                ? "Hələ xəbər yoxdur."
                : "No news yet."}
          </p>
          {/* Boş ekranda adamı saxlamaq olmaz: nəticələr onsuz da doludur. */}
          <Link href="/results" className="text-sm font-medium text-brand-via-fg hover:underline">
            {locale === "az" ? "Nəticələrə bax →" : "Browse results →"}
          </Link>
        </div>
      )}
    </PageShell>
  );
}
