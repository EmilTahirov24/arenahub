import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isVerifyTokenValid } from "@/lib/emailVerification";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const base = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${base}/fan/login?verify=invalid`);
  }

  const fan = await prisma.fan.findUnique({ where: { verifyToken: token } });

  if (!fan || !isVerifyTokenValid(fan, token)) {
    return NextResponse.redirect(`${base}/fan/login?verify=invalid`);
  }

  await prisma.fan.update({
    where: { id: fan.id },
    data: { emailVerified: true, verifyToken: null, verifyTokenExpiry: null },
  });

  return NextResponse.redirect(`${base}/fan/login?verify=success`);
}
