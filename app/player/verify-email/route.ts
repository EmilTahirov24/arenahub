import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isVerifyTokenValid, verifyTokenLookup } from "@/lib/emailVerification";

/**
 * Confirms an email address from the link we sent.
 *
 * Deliberately **idempotent**. This route used to null the token the first time
 * it ran, which sounds right until you remember what happens to a bare GET link
 * in an inbox: Gmail's link checker, Outlook Safe Links and most corporate mail
 * scanners fetch it before the human ever clicks. The scanner consumed the
 * token, the person's own click then found nothing, and they were bounced to
 * the login page with "link is invalid" — which reads as "login rejected me",
 * and is exactly the failure that was reported.
 *
 * So the token is left in place until it expires on its own, and a second visit
 * to an already-verified account is a success, not an error. The token only
 * ever sets a boolean, so keeping it usable for its 48 hours costs nothing.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const base = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${base}/player/login?verify=invalid`);
  }

  const player = await prisma.player.findUnique({ where: { verifyToken: verifyTokenLookup(token) } });

  if (!player) {
    return NextResponse.redirect(`${base}/player/login?verify=invalid`);
  }

  // Already confirmed, and the link is simply being opened again.
  if (player.emailVerified) {
    return NextResponse.redirect(`${base}/player/login?verify=success`);
  }

  if (!isVerifyTokenValid(player, token)) {
    return NextResponse.redirect(`${base}/player/login?verify=expired`);
  }

  await prisma.player.update({ where: { id: player.id }, data: { emailVerified: true } });

  return NextResponse.redirect(`${base}/player/login?verify=success`);
}
