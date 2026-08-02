import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import GameChip from "@/components/common/GameChip";

export default async function RecentNews() {
  const t = await getTranslations();
  const locale = await getLocale();

  const articles = await prisma.newsArticle.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 6,
    include: { game: true, translations: { where: { locale } } },
  });

  if (articles.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3">
      <h3 className="font-display mb-2 text-sm font-semibold">{t("nav.news")}</h3>
      <ul className="space-y-2">
        {articles.map((article) => {
          const tr = article.translations[0];
          if (!tr) return null;
          return (
            <li key={article.id}>
              <Link href={`/news/${article.slug}`} className="group flex items-start gap-2">
                {article.game && (
                  <GameChip name={article.game.shortName} color={article.game.accentColor} className="mt-0.5 shrink-0" />
                )}
                <span className="text-xs leading-snug text-foreground-muted group-hover:text-foreground">
                  {tr.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
