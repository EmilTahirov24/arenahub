"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { isLocked, lockoutMinutesLeft, nextFailedAttemptState, lockoutErrorMessage } from "@/lib/loginLockout";

export async function fanLogin(_prevState: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const fan = await prisma.fan.findUnique({ where: { email } });

  if (fan && isLocked(fan)) {
    return { error: lockoutErrorMessage(lockoutMinutesLeft(fan)) };
  }

  if (!fan || !(await bcrypt.compare(password, fan.passwordHash))) {
    if (fan) {
      await prisma.fan.update({
        where: { id: fan.id },
        data: nextFailedAttemptState(fan.failedLoginAttempts),
      });
    }
    return { error: "Email və ya şifrə yanlışdır." };
  }

  await prisma.fan.update({ where: { id: fan.id }, data: { failedLoginAttempts: 0, lockUntil: null } });
  await createSession({ kind: "fan", id: fan.id });
  redirect("/fan");
}
