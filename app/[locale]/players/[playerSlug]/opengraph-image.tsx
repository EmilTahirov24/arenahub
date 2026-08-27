import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { C, Frame, Wordmark, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogTheme";

/**
 * Oyunçu səhifəsi üçün paylaşım şəkli.
 *
 * Şəkil QƏSDƏN çəkilmir — 600 oyunçudan yalnız birinin şəkli var. Səbəb və
 * mülahizə komanda variantındakı ilə eynidir.
 *
 * Əsl ad yalnız ad və soyadın hər ikisi bilinəndə yazılır: yarımçıq ad
 * göstərmək məlumat vermir, sadəcə natamam görünür.
 */
export const alt = "ArenaHub — oyunçu";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; playerSlug: string }>;
}) {
  const { locale, playerSlug } = await params;
  const az = locale !== "en";

  const player = await prisma.player.findUnique({
    where: { slug: playerSlug },
    select: {
      id: true,
      nickname: true,
      firstName: true,
      lastName: true,
      country: true,
      role: true,
      game: { select: { name: true, accentColor: true } },
    },
  });

  if (!player) {
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

  const membership = await prisma.teamMembership.findFirst({
    where: { playerId: player.id, leftAt: null },
    select: { team: { select: { name: true, primaryColor: true } } },
  });

  const accent = membership?.team.primaryColor ?? player.game.accentColor;
  const realName =
    player.firstName && player.lastName ? `${player.firstName} ${player.lastName}` : null;
  const fontSize = player.nickname.length > 20 ? 68 : player.nickname.length > 12 ? 84 : 96;

  return new ImageResponse(
    (
      <Frame accent={accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Wordmark />
          <div style={{ display: "flex", fontSize: 24, color: C.muted }}>
            {az ? "OYUNÇU" : "PLAYER"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 18 }}>
          {membership && (
            <div style={{ display: "flex", fontSize: 30, color: accent }}>
              {membership.team.name}
            </div>
          )}
          <div style={{ display: "flex", fontSize, color: C.foreground, lineHeight: 1.05 }}>
            {player.nickname}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: C.muted }}>
            {[realName, player.role, player.country, player.game.name].filter(Boolean).join(" · ")}
          </div>
        </div>
      </Frame>
    ),
    size,
  );
}
