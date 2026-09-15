import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { C, Frame, Wordmark, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogTheme";
import { siteFormat } from "@/lib/dates";

/**
 * The share image behind a match link.
 *
 * This is the most shared page on the site - it is the link somebody drops in
 * Discord or Telegram when they say "look at this match". Without an image
 * that message appeared as a bare URL; now the fixture, the score and the
 * tournament read straight from the conversation.
 *
 * Note: satori's default font has only one weight, so `fontWeight` changes
 * nothing here. The hierarchy is built from size and colour instead.
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

  // A missing match must not return an empty image - a social network would
  // render it as broken. The brand image is the right fallback.
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
        // Date and time are formatted SEPARATELY. Asked for together, Intl cuts
        // them as "4 August/09:00" - the slash looks careless.
        // `Asia/Baku` was once written out by hand here, and this was the ONLY
        // correct time on the site: the page itself rendered in the server's
        // zone (UTC), so the same match read 13:00 in the image and 09:00 on
        // the page. Both now come from `SITE_TIME_ZONE`.
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
                // A long team name must not spill out of the image.
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
