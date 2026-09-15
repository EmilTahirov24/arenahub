import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";

/**
 * The current player, for the header's account menu.
 *
 * This route exists so that the Header does not read the session itself.
 * Reading `cookies()` makes a route dynamic, and since the Header renders on
 * every page, the entire public site became uncacheable - every visitor and
 * every crawler went to the database. With the session moved here the pages
 * are cached and only this small request stays outside.
 *
 * Only the fields the view needs come back - not the email, the points or the
 * rest, because this response is fetched on every page load. `slug` and
 * `ownedTeamSlug` are for the "Edit" link on player and team pages: those
 * stopped reading the session on the server for the same reason.
 */
export async function GET() {
  const session = await getPlayerSession();
  if (!session) {
    return NextResponse.json({ player: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const player = await prisma.player.findUnique({
    where: { id: session.id },
    select: {
      nickname: true,
      photoUrl: true,
      slug: true,
      ownedTeams: { select: { slug: true }, take: 1 },
    },
  });

  const body = player
    ? {
        nickname: player.nickname,
        photoUrl: player.photoUrl,
        slug: player.slug,
        ownedTeamSlug: player.ownedTeams[0]?.slug ?? null,
      }
    : null;

  return NextResponse.json({ player: body }, { headers: { "Cache-Control": "no-store" } });
}
