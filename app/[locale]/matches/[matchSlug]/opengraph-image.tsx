import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { C, Frame, Wordmark, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogTheme";
import { siteFormat } from "@/lib/dates";

/**
 * Matç linki üçün paylaşım şəkli.
 *
 * Bu, saytda ən çox paylaşılan səhifədir — adam Discord və ya Telegram-da
 * "bu matça bax" deyəndə məhz bu linki atır. Şəkilsiz o mesaj çılpaq ünvan kimi
 * görünürdü; indi qarşıdurma, hesab və turnir birbaşa söhbətdə oxunur.
 *
 * Qeyd: satori-nin standart şriftində yalnız bir çəki var, ona görə `fontWeight`
 * görünüşü dəyişmir. Ölçü və rəng fərqi ilə iyerarxiya qurulub.
 */
export const alt = "ArenaHub — matç";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; matchSlug: string }>;
}) {
  const { locale, matchSlug } = await params;
  const az = locale !== "en";

  const match = await prisma.match.findUnique({
    where: { slug: matchSlug },
    select: {
      status: true,
      scheduledAt: true,
      teamAScore: true,
      teamBScore: true,
      bestOf: true,
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
      tournament: { select: { name: true } },
      game: { select: { name: true, accentColor: true } },
    },
  });

  // Matç tapılmasa boş şəkil qaytarmaq olmaz — sosial şəbəkə onu sınıq kimi
  // göstərər. Brend şəkli düzgün ehtiyatdır.
  if (!match) {
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

  const finished = match.status === "FINISHED";
  const live = match.status === "LIVE";
  const label = live
    ? az ? "CANLI" : "LIVE"
    : finished
      ? az ? "BİTDİ" : "FINISHED"
      // Tarix və saat AYRI formatlanır. Birlikdə istənəndə Intl onları
        // "4 avqust/09:00" kimi kəsir — əyri xətt səliqəsiz görünür.
        // `Asia/Baku` əvvəl burada əl ilə yazılmışdı və saytda YEGANƏ düzgün
        // vaxt bu idi: səhifənin özü serverin zonasında (UTC) göstərirdi, yəni
        // eyni matç şəkildə 13:00, səhifədə 09:00 idi. İndi hər ikisi
        // `SITE_TIME_ZONE`-dan gəlir.
        : `${siteFormat(az ? "az-AZ" : "en-GB", {
            day: "numeric", month: "long",
          }).format(match.scheduledAt)} · ${siteFormat(az ? "az-AZ" : "en-GB", {
            hour: "2-digit", minute: "2-digit",
          }).format(match.scheduledAt)}`;

  return new ImageResponse(
    (
      <Frame accent={match.game.accentColor}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Wordmark />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 18px",
              borderRadius: 999,
              border: `1px solid ${live ? C.live : C.border}`,
              color: live ? C.live : C.muted,
              fontSize: 24,
            }}
          >
            {live && <div style={{ width: 12, height: 12, borderRadius: 999, background: C.live }} />}
            {label}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 26 }}>
          {match.tournament && (
            <div style={{ fontSize: 28, color: C.muted }}>{match.tournament.name}</div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <div
              style={{
                display: "flex",
                flex: 1,
                fontSize: 58,
                color: C.foreground,
                lineHeight: 1.1,
                // Uzun komanda adı şəkildən daşmamalıdır.
                overflow: "hidden",
              }}
            >
              {match.teamA.name}
            </div>

            {/* Hesab tək mətn kimi verilir. Rəqəmləri ayrı div-lərə bölüb
                aralarına `gap` qoymaq işləmir: satori `<>` fraqmentini bir
                uşaq sayır, ona görə boşluq yalnız bir tərəfə düşür. */}
            <div style={{ display: "flex", alignItems: "center", fontSize: 62, color: C.foreground }}>
              {finished || live ? (
                `${match.teamAScore} : ${match.teamBScore}`
              ) : (
                <div style={{ display: "flex", color: C.muted, fontSize: 40 }}>vs</div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flex: 1,
                justifyContent: "flex-end",
                textAlign: "right",
                fontSize: 58,
                color: C.foreground,
                lineHeight: 1.1,
                overflow: "hidden",
              }}
            >
              {match.teamB.name}
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 26, color: C.muted }}>
            {`${match.game.name} · Bo${match.bestOf}`}
          </div>
        </div>
      </Frame>
    ),
    size,
  );
}
