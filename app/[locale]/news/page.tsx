import type { Metadata } from "next";
import { activeGames } from "@/lib/cachedQueries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import NewsCard from "@/components/news/NewsCard";
import { localeAlternates } from "@/lib/localeAlternates";

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

  // Filtr pili yalnız arxasında məqalə olan oyun üçün göstərilir.
  //
  // Əvvəl dördü də həmişə görünürdü və dördü də «Xəbər tapılmadı» verirdi:
  // həftəlik icmal bütün oyunları əhatə edir, ona görə `gameId`-si yoxdur.
  // Yəni səhifə dörd düymə vəd edir, dördü də adamı boş ekrana aparırdı. Boş
  // vəd verməkdənsə düyməni göstərməmək düzdür.
  const counts = await prisma.newsArticle.groupBy({
    by: ["gameId"],
    where: { publishedAt: { not: null }, gameId: { not: null } },
    _count: { _all: true },
  });
  const withArticles = new Set(counts.map((c) => c.gameId));
  const filterGames = games.filter((g) => withArticles.has(g.id));

  const articles = await prisma.newsArticle.findMany({
    where: {
      publishedAt: { not: null },
      ...(gameSlug ? { game: { slug: gameSlug } } : {}),
    },
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
            style={gameSlug === game.slug ? { backgroundColor: game.accentColor, borderColor: game.accentColor, color: "#0a0b10" } : undefined}
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
            <NewsCard article={article} lead={i === 0 && articles.length > 1} />
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
