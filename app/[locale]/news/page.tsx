import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import NewsCard from "@/components/news/NewsCard";

export const dynamic = "force-dynamic";

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

  const games = await prisma.game.findMany({ where: { isActive: true } });

  const articles = await prisma.newsArticle.findMany({
    where: {
      publishedAt: { not: null },
      ...(gameSlug ? { game: { slug: gameSlug } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: 24,
    include: { game: true, translations: true },
  });

  return (
    <PageShell showDefaultWidgets={false}>
      <h1 className="font-display mb-4 text-2xl font-bold">{t("nav.news")}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/news"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${!gameSlug ? "brand-gradient-bg border-transparent text-white" : "border-border-subtle text-foreground-muted hover:text-foreground"}`}
        >
          {locale === "az" ? "Hamısı" : "All"}
        </Link>
        {games.map((game) => (
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {articles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
        {articles.length === 0 && (
          <p className="text-sm text-foreground-muted">{locale === "az" ? "Xəbər tapılmadı." : "No news found."}</p>
        )}
      </div>
    </PageShell>
  );
}
