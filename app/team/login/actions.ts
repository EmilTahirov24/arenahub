"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { isLocked, lockoutMinutesLeft, nextFailedAttemptState, lockoutErrorMessage } from "@/lib/loginLockout";

export async function teamLogin(_prevState: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const team = await prisma.team.findUnique({ where: { email } });

  if (team && isLocked(team)) {
    return { error: lockoutErrorMessage(lockoutMinutesLeft(team)) };
  }

  if (!team || !team.passwordHash || !(await bcrypt.compare(password, team.passwordHash))) {
    if (team) {
      await prisma.team.update({
        where: { id: team.id },
        data: nextFailedAttemptState(team.failedLoginAttempts),
      });
    }
    return { error: "Email və ya şifrə yanlışdır." };
  }

  await prisma.team.update({ where: { id: team.id }, data: { failedLoginAttempts: 0, lockUntil: null } });
  await createSession({ kind: "team", id: team.id });
  redirect("/team");
}
