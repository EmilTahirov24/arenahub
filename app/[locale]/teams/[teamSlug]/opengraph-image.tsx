import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { C, Frame, Wordmark, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogTheme";

/**
 * The share image for a team page.
 *
 * The logo is DELIBERATELY not fetched. In production one team in 855 has a
 * logo, so a remote image fetch gains nothing in 99.9% of cases and carries
 * risk in the rest: if satori cannot get the image the whole render fails and
 * the shared link ends up with no image at all. The team's own colour is used
 * instead - always present, and it never breaks.
 */
export const alt = "ArenaHub — komanda";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; teamSlug: string }>;
}) {
  const { locale, teamSlug } = await params;
  const az = locale !== "en";

  const team = await prisma.team.findUnique({
    where: { slug: teamSlug },
    select: {
      name: true,
      country: true,
      primaryColor: true,
      game: { select: { name: true, accentColor: true } },
    },
  });

  if (!team) {
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

  const accent = team.primaryColor ?? team.game.accentColor;
  // The size follows the name so a long one does not spill out of the image.
  const fontSize = team.name.length > 26 ? 62 : team.name.length > 16 ? 76 : 92;

  return (
    new ImageResponse(
      (
        <Frame accent={accent}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Wordmark />
            <div style={{ display: "flex", fontSize: 24, color: C.muted }}>
              {az ? "KOMANDA" : "TEAM"}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* Rəng zolağı loqonun yerini tutur: komandanı bir baxışda ayırır. */}
              <div style={{ display: "flex", width: 12, height: fontSize, background: accent, borderRadius: 6 }} />
              <div style={{ display: "flex", fontSize, color: C.foreground, lineHeight: 1.05 }}>
                {team.name}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 30, color: C.muted }}>
              {[team.game.name, team.country].filter(Boolean).join(" · ")}
            </div>
          </div>
        </Frame>
      ),
      size,
    )
  );
}
