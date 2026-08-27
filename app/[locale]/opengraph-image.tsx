import { ImageResponse } from "next/og";
import { C, Frame, Wordmark, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogTheme";

/**
 * Saytın standart paylaşım şəkli.
 *
 * `[locale]` seqmentində durur, yəni ondan aşağıdakı BÜTÜN səhifələr — komanda,
 * oyunçu, turnir, siyahılar — öz şəkli yoxdursa bunu miras alır. Əvvəl heç bir
 * şəkil yox idi: Telegram, Discord və ya X-ə atılan hər link çılpaq mətn kimi
 * görünürdü.
 */
export const alt = "ArenaHub — esports matçları, nəticələr və statistika";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const az = locale !== "en";

  return new ImageResponse(
    (
      <Frame>
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 18 }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: C.foreground, lineHeight: 1.05, letterSpacing: -2 }}>
            {az ? "Matçlar, nəticələr, statistika" : "Matches, results, statistics"}
          </div>
          <div style={{ fontSize: 32, color: C.muted }}>
            CS2 · Dota 2 · Valorant · League of Legends
          </div>
        </div>
      </Frame>
    ),
    size,
  );
}
