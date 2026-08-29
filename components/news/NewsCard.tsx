import { getLocale } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import GameChip from "@/components/common/GameChip";
import type { NewsArticle, Game, NewsArticleTranslation } from "@/app/generated/prisma/client";
import { siteFormat } from "@/lib/dates";

type NewsCardArticle = NewsArticle & { game: Game | null; translations: NewsArticleTranslation[] };

export default async function NewsCard({
  article,
  // Siyahının ən təzə yazısı üçün: eyni kart, bir ölçü böyük başlıq və üç sətir
  // xülasə. Ayrı komponent yazmaq iki yerdə eyni məntiqi saxlamaq demək olardı.
  lead = false,
}: {
  article: NewsCardArticle;
  lead?: boolean;
}) {
  const locale = await getLocale();
  const tr = article.translations.find((t) => t.locale === locale) ?? article.translations[0];
  if (!tr) return null;

  const dateFmt = siteFormat(locale, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Link
      href={`/news/${article.slug}`}
      className={`flex h-full flex-col rounded-lg border bg-surface transition-colors hover:bg-surface-raised ${
        lead ? "border-brand-via/30 p-5" : "border-border-subtle p-4"
      }`}
    >
      {/* Üz şəkli admin paneldən yüklənirdi və heç yerdə göstərilmirdi — redaktor
          şəkil seçirdi, qarşılığında heç nə almırdı. Şəkil yoxdursa kart əvvəlki
          kimi qalır: production-da hazırda bir dənə də üz şəkli yoxdur və bu
          dəyişiklik heç nəyi pisləşdirməməlidir. */}
      {article.coverImageUrl && (
        <Image
          src={article.coverImageUrl}
          alt=""
          width={480}
          height={270}
          unoptimized
          className="mb-3 aspect-video w-full rounded-md object-cover"
        />
      )}

      <div className="mb-2 flex items-center gap-2">
        {article.game && <GameChip name={article.game.shortName} color={article.game.accentColor} />}
        {/* Sahib «seçilmiş» qutusunu işarələyəndə nəticəsini görməlidir — yoxsa
            qutu yenə səssiz qalır, sadəcə bu dəfə sıralamanın içində. */}
        {article.isFeatured && (
          <span className="rounded-full border border-brand-via/40 bg-brand-via/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-via-fg">
            {locale === "az" ? "Seçilmiş" : "Featured"}
          </span>
        )}
        {article.publishedAt && (
          <span className="text-xs text-foreground-muted">{dateFmt.format(article.publishedAt)}</span>
        )}
      </div>
      <h3 className={`font-display font-semibold leading-snug ${lead ? "text-lg" : ""}`}>{tr.title}</h3>
      {tr.excerpt && (
        <p className={`mt-1 text-sm text-foreground-muted ${lead ? "line-clamp-3" : "line-clamp-2"}`}>
          {tr.excerpt}
        </p>
      )}
    </Link>
  );
}
