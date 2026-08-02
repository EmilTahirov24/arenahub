"use server";

import { prisma } from "@/lib/prisma";
import { generateResetToken, resetTokenExpiry, wasResetRequestedRecently } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";

export async function requestFanPasswordReset(
  _prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { error: "Email daxil edin." };
  }

  const fan = await prisma.fan.findUnique({ where: { email } });

  if (fan && !wasResetRequestedRecently(fan)) {
    const token = generateResetToken();
    await prisma.fan.update({
      where: { id: fan.id },
      data: { resetToken: token, resetTokenExpiry: resetTokenExpiry() },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/fan/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl, "az");
  }

  return { success: true };
}
