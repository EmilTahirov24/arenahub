import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { C, Frame, Wordmark, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogTheme";

/**
 * The share image for an article: the headline is the image.
 *
 * When a news link is shared, the headline is the only thing that will be
 * read, so it is set as large as it can be and shrinks with length -
 * showing all of it beats cutting it off with "...".
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
      // The headline is in its own table (NewsArticleTranslation), because an
      // article's language does not follow the interface language. Both are
      // fetched: if the requested one is missing, whatever exists is used -
      // a headline in the other language beats an image with no headline.
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
