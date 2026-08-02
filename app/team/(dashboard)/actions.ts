"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, getTeamSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVerifyToken, verifyTokenExpiry, resendAvailableInSeconds, RESEND_RATE_LIMIT_SECONDS } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/email";

export async function teamLogout() {
  await destroySession();
  redirect("/team/login");
}

export async function resendTeamVerificationEmail(_prevState: { waitSeconds: number } | undefined) {
  const session = await getTeamSession();
  if (!session) throw new Error("Unauthorized");

  const team = await prisma.team.findUnique({ where: { id: session.id } });
  if (!team || !team.email || team.emailVerified) return { waitSeconds: 0 };

  const waitSeconds = resendAvailableInSeconds(team);
  if (waitSeconds > 0) return { waitSeconds };

  const verifyToken = generateVerifyToken();
  await prisma.team.update({
    where: { id: team.id },
    data: { verifyToken, verifyTokenExpiry: verifyTokenExpiry() },
  });

  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/team/verify-email?token=${verifyToken}`;
  await sendVerificationEmail(team.email, verifyUrl, "az");
  revalidatePath("/team");
  return { waitSeconds: RESEND_RATE_LIMIT_SECONDS };
}

export async function updateOwnTeam(formData: FormData) {
  const session = await getTeamSession();
  if (!session) throw new Error("Unauthorized");

  await prisma.team.update({
    where: { id: session.id },
    data: {
      name: String(formData.get("name") ?? ""),
      country: String(formData.get("country") ?? "") || null,
      primaryColor: String(formData.get("primaryColor") ?? "") || null,
      secondaryColor: String(formData.get("secondaryColor") ?? "") || null,
      logoUrl: String(formData.get("logoUrl") ?? "") || null,
      description: String(formData.get("description") ?? "") || null,
    },
  });
  revalidatePath("/team");
  revalidatePath("/[locale]", "layout");
}
