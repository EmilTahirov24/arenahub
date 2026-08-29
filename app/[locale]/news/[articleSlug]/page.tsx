import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import AdSlot from "@/components/ads/AdSlot";
import GameChip from "@/components/common/GameChip";
import TeamAvatar from "@/components/common/TeamAvatar";
import { localeAlternates } from "@/lib/localeAlternates";
import { siteFormat } from "@/lib/dates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; articleSlug: string }>;
}): Promise<Metadata> {
  const { locale, articleSlug } = await params;
  const article = await prisma.newsArticle.findUnique({
    where: { slug: articleSlug },
    include: { translations: true },
  });
  const tr = article?.translations.find((t) => t.locale === locale) ?? article?.translations[0];
  if (!tr) return {};

  return {
    alternates: localeAlternates(locale, `/news/${articleSlug}`),
    title: tr.title,
    description: tr.excerpt ?? undefined,
    openGraph: { title: tr.title, description: tr.excerpt ?? undefined, type: "article" },
    twitter: { card: "summary", title: tr.title, description: tr.excerpt ?? undefined },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ locale: string; articleSlug: string }>;
}) {
  "use cache";
  // İdxal saatda bir dəfə işləyir, admin dəyişiklikləri isə revalidatePath ilə
  // dərhal ləğv olunur — ona görə bir dəqiqəlik pəncərə datanı köhnəltmir.
  cacheLife("minutes");

  const { locale, articleSlug } = await params;
  setRequestLocale(locale);

  const article = await prisma.newsArticle.findUnique({
    where: { slug: articleSlug },
    include: { game: true, author: true, relatedTeam: true, translations: true },
  });
  if (!article || !article.publishedAt) notFound();

  const tr = article.translations.find((t) => t.locale === locale) ?? article.translations[0];
  if (!tr) notFound();

  const dateFmt = siteFormat(locale, { dateStyle: "long" });

  return (
    <PageShell showDefaultWidgets={false}>
      <article className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center gap-2">
          {article.game && <GameChip name={article.game.shortName} color={article.game.accentColor} />}
          <span className="text-xs text-foreground-muted">{dateFmt.format(article.publishedAt!)}</span>
          <span className="text-xs text-foreground-muted">· {article.author.name}</span>
        </div>
        <h1 className="font-display mb-4 text-3xl font-bold">{tr.title}</h1>

        {/* Üz şəkli admin paneldən yüklənir; indiyə qədər heç yerdə
            göstərilmirdi. Şəkil yoxdursa məqalə əvvəlki kimi başlıqdan
            mətnə keçir. */}
        {article.coverImageUrl && (
          <Image
            src={article.coverImageUrl}
            alt=""
            width={960}
            height={540}
            unoptimized
            priority
            className="mb-6 aspect-video w-full rounded-lg object-cover"
          />
        )}

        {article.relatedTeam && (
          <Link
            href={`/teams/${article.relatedTeam.slug}`}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 hover:bg-surface-raised"
          >
            <TeamAvatar name={article.relatedTeam.name} logoUrl={article.relatedTeam.logoUrl} color={article.relatedTeam.primaryColor} size={20} />
            <span className="text-sm">{article.relatedTeam.name}</span>
          </Link>
        )}

        <div
          className="prose prose-invert max-w-none text-foreground-muted [&_p]:mb-4 [&_p]:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: tr.bodyHtml }}
        />

        {article.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border-subtle px-2 py-0.5 text-xs text-foreground-muted">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="my-8 flex justify-center">
          <AdSlot placement="IN_CONTENT" />
        </div>
      </article>
    </PageShell>
  );
}
