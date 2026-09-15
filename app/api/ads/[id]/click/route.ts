import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * An advert click: increments the counter and redirects to the advertiser.
 *
 * Why the click goes through the server: on a direct press of the link over
 * the banner we learn nothing - the visitor leaves the site and the event is
 * lost. This route in between both counts and redirects.
 *
 * This is NOT an open redirect: the target does not come from the request, it
 * is read from the advert row in the database. All an outsider can do is pick
 * one of the existing advert ids. The protocol is checked all the same - an
 * editor with panel access writing `javascript:` by mistake (or on purpose,
 * if the account were taken over) would without that check become an attack
 * running from our own domain.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

  const ad = await prisma.adBanner.findUnique({ where: { id }, select: { linkUrl: true } });
  if (!ad) return NextResponse.redirect(base);

  let target: URL;
  try {
    target = new URL(ad.linkUrl);
  } catch {
    return NextResponse.redirect(base);
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.redirect(base);
  }

  // The counter must not hold up the redirect: the person should reach the
  // advertiser's site, not wait on our write. The redirect happens even on a
  // failure - one lost click beats a stalled link.
  const ip = clientIp(request.headers);
  const allowed = !ip || rateLimit(`ad-click:${ip}:${id}`, 20, 60 * 60_000).ok;
  if (allowed) {
    prisma.adBanner
      .update({ where: { id }, data: { clicks: { increment: 1 } } })
      .catch(() => {});
  }

  return NextResponse.redirect(target.toString());
}
