"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { generateVerifyToken, verifyTokenExpiry } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/email";

export async function fanRegister(_prevState: { error?: string } | undefined, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !email || password.length < 6) {
    return { error: "Bütün xanaları doldurun, şifrə ən azı 6 simvol olmalıdır." };
  }

  if (formData.get("terms") !== "on") {
    return { error: "Davam etmək üçün İstifadə Şərtləri və Məxfilik Siyasətini qəbul etməlisiniz." };
  }

  const [existingEmail, existingUsername] = await Promise.all([
    prisma.fan.findUnique({ where: { email } }),
    prisma.fan.findUnique({ where: { username } }),
  ]);
  if (existingEmail) {
    return { error: "Bu email artıq qeydiyyatdan keçib." };
  }
  if (existingUsername) {
    return { error: "Bu istifadəçi adı artıq mövcuddur." };
  }

  const verifyToken = generateVerifyToken();

  const fan = await prisma.fan.create({
    data: {
      username,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      verifyToken,
      verifyTokenExpiry: verifyTokenExpiry(),
    },
  });

  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/fan/verify-email?token=${verifyToken}`;
  await sendVerificationEmail(email, verifyUrl, "az");

  await createSession({ kind: "fan", id: fan.id });
  redirect("/fan");
}
