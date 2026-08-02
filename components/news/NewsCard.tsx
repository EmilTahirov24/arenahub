import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import GameChip from "@/components/common/GameChip";
import type { NewsArticle, Game, NewsArticleTranslation } from "@/app/generated/prisma/client";

type NewsCardArticle = NewsArticle & { game: Game | null; translations: NewsArticleTranslation[] };

export default async function NewsCard({ article }: { article: NewsCardArticle }) {
  const locale = await getLocale();
  const tr = article.translations.find((t) => t.locale === locale) ?? article.translations[0];
  if (!tr) return null;

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Link
      href={`/news/${article.slug}`}
      className="flex flex-col rounded-lg border border-border-subtle bg-surface p-4 transition-colors hover:bg-surface-raised"
    >
      <div className="mb-2 flex items-center gap-2">
        {article.game && <GameChip name={article.game.shortName} color={article.game.accentColor} />}
        {article.publishedAt && (
          <span className="text-xs text-foreground-muted">{dateFmt.format(article.publishedAt)}</span>
        )}
      </div>
      <h3 className="font-display font-semibold leading-snug">{tr.title}</h3>
      {tr.excerpt && <p className="mt-1 line-clamp-2 text-sm text-foreground-muted">{tr.excerpt}</p>}
    </Link>
  );
}
