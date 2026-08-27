import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { C, Frame, Wordmark, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogTheme";

/**
 * Xəbər üçün paylaşım şəkli: başlıq özü şəklin içindədir.
 *
 * Xəbər linki paylaşılanda oxunacaq yeganə şey başlıqdır, ona görə o, mümkün
 * qədər böyük verilir və uzunluğa görə kiçilir — kəsib "..." qoymaqdansa
 * bütövünü göstərmək daha yaxşıdır.
 */
export const alt = "ArenaHub — xəbər";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; articleSlug: string }>;
}) {
  const { locale, articleSlug } = await params;
  const az = locale !== "en";

  const article = await prisma.newsArticle.findUnique({
    where: { slug: articleSlug },
    select: {
      // Başlıq ayrı cədvəldədir (NewsArticleTranslation), çünki məqalənin dili
      // interfeysin dilindən asılı deyil. İkisini də çəkirik: istənilən dil
      // yoxdursa, mövcud olan istifadə edilir — başlıqsız şəkil çıxarmaqdansa
      // başqa dildə başlıq göstərmək daha faydalıdır.
      translations: { select: { locale: true, title: true } },
      game: { select: { name: true, accentColor: true } },
    },
  });

  if (!article) {
    return new ImageResponse(
      (
        <Frame>
          <Wordmark />
          <div style={{ display: "flex", marginTop: "auto", fontSize: 64, color: C.foreground }}>
            ArenaHub
          </div>
        </Frame>
      ),
      size,
    );
  }

  const wanted = az ? "az" : "en";
  const title =
    article.translations.find((t) => t.locale === wanted)?.title ??
    article.translations[0]?.title ??
    "ArenaHub";
  const fontSize = title.length > 90 ? 44 : title.length > 55 ? 54 : 66;

  return new ImageResponse(
    (
      <Frame accent={article.game?.accentColor}>
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 22 }}>
          {/* Tək sətir kimi qurulur: satori fraqmenti bir uşaq saydığı üçün
              `gap` "XƏBƏR ·Dota 2" kimi yalnız bir tərəfə düşürdü. */}
          <div style={{ display: "flex", fontSize: 26, color: C.muted }}>
            {[az ? "XƏBƏR" : "NEWS", article.game?.name].filter(Boolean).join(" · ")}
          </div>
          <div style={{ display: "flex", fontSize, color: C.foreground, lineHeight: 1.15 }}>
            {title}
          </div>
        </div>
      </Frame>
    ),
    size,
  );
}
