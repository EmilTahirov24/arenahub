"use server";

import { prisma } from "@/lib/prisma";
import { createResetToken, wasResetRequestedRecently } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";
import { siteUrl } from "@/lib/siteUrl";

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
    // Raw token in the link, hash in the database — see lib/tokens.ts.
    const reset = createResetToken();
    await prisma.player.update({
      where: { id: player.id },
      data: { resetToken: reset.hash, resetTokenExpiry: reset.expiresAt },
    });

    const resetUrl = `${siteUrl()}/player/reset-password?token=${reset.raw}`;
    const mail = await sendPasswordResetEmail(email, resetUrl, "az");

    // Nothing reached the inbox, so the fifteen-minute throttle would only
    // punish someone who did nothing wrong. Clearing the expiry lets them ask
    // again straight away. The reply stays the same either way — saying "we
    // could not send it" here would confirm the address exists.
    if (!mail.ok) {
      await prisma.player.update({
        where: { id: player.id },
        data: { resetToken: null, resetTokenExpiry: null },
      });
    }
  }

  return { success: true };
}
