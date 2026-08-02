"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, getFanSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVerifyToken, verifyTokenExpiry, resendAvailableInSeconds, RESEND_RATE_LIMIT_SECONDS } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/email";

export async function fanLogout() {
  await destroySession();
  redirect("/fan/login");
}

export async function resendFanVerificationEmail(_prevState: { waitSeconds: number } | undefined) {
  const session = await getFanSession();
  if (!session) throw new Error("Unauthorized");

  const fan = await prisma.fan.findUnique({ where: { id: session.id } });
  if (!fan || fan.emailVerified) return { waitSeconds: 0 };

  const waitSeconds = resendAvailableInSeconds(fan);
  if (waitSeconds > 0) return { waitSeconds };

  const verifyToken = generateVerifyToken();
  await prisma.fan.update({
    where: { id: fan.id },
    data: { verifyToken, verifyTokenExpiry: verifyTokenExpiry() },
  });

  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/fan/verify-email?token=${verifyToken}`;
  await sendVerificationEmail(fan.email, verifyUrl, "az");
  revalidatePath("/fan");
  return { waitSeconds: RESEND_RATE_LIMIT_SECONDS };
}
