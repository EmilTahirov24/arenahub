"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { isLocked, lockoutMinutesLeft, nextFailedAttemptState, lockoutErrorMessage } from "@/lib/loginLockout";

export async function playerLogin(_prevState: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const player = await prisma.player.findUnique({ where: { email } });

  if (player && isLocked(player)) {
    return { error: lockoutErrorMessage(lockoutMinutesLeft(player)) };
  }

  if (!player || !player.passwordHash || !(await bcrypt.compare(password, player.passwordHash))) {
    if (player) {
      await prisma.player.update({
        where: { id: player.id },
        data: nextFailedAttemptState(player.failedLoginAttempts),
      });
    }
    return { error: "Email və ya şifrə yanlışdır." };
  }

  await prisma.player.update({ where: { id: player.id }, data: { failedLoginAttempts: 0, lockUntil: null } });
  await createSession({ kind: "player", id: player.id });
  redirect("/player");
}
