import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isVerifyTokenValid } from "@/lib/emailVerification";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const base = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${base}/player/login?verify=invalid`);
  }

  const player = await prisma.player.findUnique({ where: { verifyToken: token } });

  if (!player || !isVerifyTokenValid(player, token)) {
    return NextResponse.redirect(`${base}/player/login?verify=invalid`);
  }

  await prisma.player.update({
    where: { id: player.id },
    data: { emailVerified: true, verifyToken: null, verifyTokenExpiry: null },
  });

  return NextResponse.redirect(`${base}/player/login?verify=success`);
}
