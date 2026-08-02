"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { isLocked, lockoutMinutesLeft, nextFailedAttemptState, lockoutErrorMessage } from "@/lib/loginLockout";

export async function adminLogin(_prevState: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const admin = await prisma.adminUser.findUnique({ where: { email } });

  if (admin && isLocked(admin)) {
    return { error: lockoutErrorMessage(lockoutMinutesLeft(admin)) };
  }

  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    if (admin) {
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: nextFailedAttemptState(admin.failedLoginAttempts),
      });
    }
    return { error: "Email və ya şifrə yanlışdır." };
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockUntil: null },
  });
  await createSession({ kind: "admin", id: admin.id, role: admin.role });
  redirect("/admin");
}
