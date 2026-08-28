import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass } from "@/components/admin/formStyles";
import AdminPagination from "@/components/admin/AdminPagination";

const PER_PAGE = 50;

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;

  // Xəbərlər əl ilə yazılır, yəni say heç vaxt idxal olunan cədvəllər qədər
  // böyüməyəcək. Səhifələmə yenə də var: burada limitsiz sorğu saxlamaq həmin
  // qüsuru layihədə yaşadır və növbəti oxuyan onu nümunə kimi götürür.
  // Axtarış qoyulmadı — başlıq ayrı cədvəldədir (NewsArticleTranslation) və
  // bir neçə onluq sətir arasında gözlə tapmaq daha sürətlidir.
  const total = await prisma.newsArticle.count();
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const articles = await prisma.newsArticle.findMany({
    orderBy: { createdAt: "desc" },
    include: { game: true, translations: true },
    take: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Xəbərlər</h1>
        <Link href="/admin/news/new" className={primaryButtonClass}>
          + Yeni xəbər
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {articles.map((article) => {
          const title =
            article.translations.find((t) => t.locale === "az")?.title ??
            article.translations.find((t) => t.locale === "en")?.title ??
            "(başlıqsız)";
          return (
            <Link
              key={article.id}
              href={`/admin/news/${article.id}`}
              className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
            >
              <span className="flex-1 font-medium">{title}</span>
              <span className="text-xs text-foreground-muted">{article.game?.shortName ?? "— hamısı —"}</span>
              {article.publishedAt ? (
                <span className="text-xs text-foreground-muted">dərc edilib</span>
              ) : (
                <span className="text-xs text-live">qaralama</span>
              )}
            </Link>
          );
        })}
        {articles.length === 0 && <p className="p-6 text-center text-sm text-foreground-muted">Xəbər yoxdur.</p>}
      </div>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pathname="/admin/news"
      />
    </div>
  );
}
