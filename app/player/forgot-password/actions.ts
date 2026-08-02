"use server";

import { prisma } from "@/lib/prisma";
import { generateResetToken, resetTokenExpiry, wasResetRequestedRecently } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";

export async function requestPlayerPasswordReset(
  _prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { error: "Email daxil edin." };
  }

  const player = await prisma.player.findUnique({ where: { email } });

  if (player && !wasResetRequestedRecently(player)) {
    const token = generateResetToken();
    await prisma.player.update({
      where: { id: player.id },
      data: { resetToken: token, resetTokenExpiry: resetTokenExpiry() },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/player/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl, "az");
  }

  return { success: true };
}
