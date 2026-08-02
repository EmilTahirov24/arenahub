"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { generateVerifyToken, verifyTokenExpiry } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/email";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function playerRegister(_prevState: { error?: string } | undefined, formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const gameId = String(formData.get("gameId") ?? "");
  const country = String(formData.get("country") ?? "") || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!nickname || !gameId || !email || password.length < 6) {
    return { error: "Bütün xanaları doldurun, şifrə ən azı 6 simvol olmalıdır." };
  }

  if (formData.get("terms") !== "on") {
    return { error: "Davam etmək üçün İstifadə Şərtləri və Məxfilik Siyasətini qəbul etməlisiniz." };
  }

  const existing = await prisma.player.findUnique({ where: { email } });
  if (existing) {
    return { error: "Bu email artıq qeydiyyatdan keçib." };
  }

  const verifyToken = generateVerifyToken();

  const player = await prisma.player.create({
    data: {
      nickname,
      slug: `${slugify(nickname)}-${Math.random().toString(36).slice(2, 6)}`,
      gameId,
      country,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      isClaimed: true,
      verifyToken,
      verifyTokenExpiry: verifyTokenExpiry(),
    },
  });

  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/player/verify-email?token=${verifyToken}`;
  await sendVerificationEmail(email, verifyUrl, "az");

  await createSession({ kind: "player", id: player.id });
  redirect("/player");
}
