"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isResetTokenValid } from "@/lib/passwordReset";

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

  const player = await prisma.player.findUnique({ where: { resetToken: token } });

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
    },
  });

  redirect("/player/login");
}
