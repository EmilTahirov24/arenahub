import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isVerifyTokenValid } from "@/lib/emailVerification";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const base = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${base}/team/login?verify=invalid`);
  }

  const team = await prisma.team.findUnique({ where: { verifyToken: token } });

  if (!team || !isVerifyTokenValid(team, token)) {
    return NextResponse.redirect(`${base}/team/login?verify=invalid`);
  }

  await prisma.team.update({
    where: { id: team.id },
    data: { emailVerified: true, verifyToken: null, verifyTokenExpiry: null },
  });

  return NextResponse.redirect(`${base}/team/login?verify=success`);
}
