import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * The advert IMPRESSION counter.
 *
 * Counting on the server is impossible, and that is by design. `getAd()` is
 * cached (`use cache: remote`), so the render comes from the cache - counting
 * there would count cache windows rather than views. Writing to the database
 * on every page render would also hand back everything the caching work
 * gained.
 *
 * So the count comes from the browser, which carries two further advantages:
 *
 *   Only a banner that genuinely appeared ON SCREEN is counted - an advert
 *   sitting below the fold that nobody ever saw is not. That is the number an
 *   advertiser should be given.
 *
 *   Crawlers that do not run JavaScript cannot inflate the counter. Bot
 *   traffic falls outside automatically.
 *
 * The limit: 200 an hour per banner per IP. An ordinary person may browse 30
 * to 40 pages in an hour and the banner in the side rail has to be counted
 * correctly each time, so the ceiling is high - this is a guard against crude
 * abuse, not precise accounting.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ip = clientIp(request.headers);
  if (ip && !rateLimit(`ad-view:${ip}:${id}`, 200, 60 * 60_000).ok) {
    return new NextResponse(null, { status: 204 });
  }

  // An id that does not exist is simply ignored: this route returns no body,
  // so reporting an error to the browser would serve nothing.
  await prisma.adBanner
    .update({ where: { id }, data: { impressions: { increment: 1 } } })
    .catch(() => {});

  return new NextResponse(null, { status: 204 });
}
