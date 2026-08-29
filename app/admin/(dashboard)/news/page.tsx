import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass } from "@/components/admin/formStyles";
import AdminSearch from "@/components/admin/AdminSearch";
import AdminPagination from "@/components/admin/AdminPagination";
import type { Prisma } from "@/app/generated/prisma/client";

const PER_PAGE = 50;

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const search = (q ?? "").trim();

  // Xəbərlər əl ilə yazılır, yəni say heç vaxt idxal olunan cədvəllər qədər
  // böyüməyəcək. Səhifələmə yenə də var: burada limitsiz sorğu saxlamaq həmin
  // qüsuru layihədə yaşadır və növbəti oxuyan onu nümunə kimi götürür.
  //
  // Başlıq ayrı cədvəldədir (NewsArticleTranslation) və hər məqalənin iki dili
  // var, ona görə axtarış `some` ilə gedir: azərbaycanca VƏ YA ingiliscə başlıq
  // uyğun gəlsə, sətir tapılır. Slug da daxildir — həftəlik icmal skripti
  // məqalələri slug ilə yaradır və qaytardığı ad odur.
  const where: Prisma.NewsArticleWhereInput = search
    ? {
        OR: [
          { translations: { some: { title: { contains: search, mode: "insensitive" } } } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const total = await prisma.newsArticle.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const articles = await prisma.newsArticle.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { game: true, translations: true },
    take: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
  });

  const dateFmt = new Intl.DateTimeFormat("az", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Xəbərlər</h1>
        <Link href="/admin/news/new" className={primaryButtonClass}>
          + Yeni xəbər
        </Link>
      </div>

      <AdminSearch action="/admin/news" defaultValue={search} placeholder="Başlıq ilə axtar..." />

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
              <span className="whitespace-nowrap text-xs tabular-nums text-foreground-muted">
                {dateFmt.format(article.createdAt)}
              </span>
              <span className="text-xs text-foreground-muted">{article.game?.shortName ?? "— hamısı —"}</span>
              {article.publishedAt ? (
                <span className="text-xs text-foreground-muted">dərc edilib</span>
              ) : (
                <span className="text-xs text-live">qaralama</span>
              )}
            </Link>
          );
        })}
        {articles.length === 0 && (
          <p className="p-6 text-center text-sm text-foreground-muted">
            {search ? `«${search}» üçün xəbər tapılmadı.` : "Xəbər yoxdur."}
          </p>
        )}
      </div>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pathname="/admin/news"
        query={{ q: search || undefined }}
      />
    </div>
  );
}
