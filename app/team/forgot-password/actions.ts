"use server";

import { prisma } from "@/lib/prisma";
import { generateResetToken, resetTokenExpiry, wasResetRequestedRecently } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";

export async function requestTeamPasswordReset(
  _prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { error: "Email daxil edin." };
  }

  const team = await prisma.team.findUnique({ where: { email } });

  if (team && !wasResetRequestedRecently(team)) {
    const token = generateResetToken();
    await prisma.team.update({
      where: { id: team.id },
      data: { resetToken: token, resetTokenExpiry: resetTokenExpiry() },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/team/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl, "az");
  }

  return { success: true };
}
