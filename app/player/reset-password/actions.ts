"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isResetTokenValid, resetTokenLookup } from "@/lib/passwordReset";

export async function resetPlayerPassword(_prevState: { error?: string } | undefined, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "Sıfırlama linki etibarsızdır." };
  }
  if (password.length < 6) {
    return { error: "Şifrə ən azı 6 simvol olmalıdır." };
  }
  if (password !== confirmPassword) {
    return { error: "Şifrələr uyğun gəlmir." };
  }

  const player = await prisma.player.findUnique({ where: { resetToken: resetTokenLookup(token) } });

  if (!player || !isResetTokenValid(player, token)) {
    return { error: "Sıfırlama linki etibarsızdır və ya vaxtı bitib. Yenidən sorğu göndərin." };
  }

  await prisma.player.update({
    where: { id: player.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      resetToken: null,
      resetTokenExpiry: null,
      failedLoginAttempts: 0,
      lockUntil: null,

      // Opening a link sent to the address proves the inbox belongs to them,
      // which is the same thing the verification link proves — so stop nagging.
      emailVerified: true,

      // Sessions are stateless 30-day JWTs with no server-side record, so a
      // stolen cookie would otherwise keep working after the owner changed
      // their password. Anything issued before this instant stops being valid.
      sessionsValidAfter: new Date(),
    },
  });

  redirect("/player/login?reset=success");
}
