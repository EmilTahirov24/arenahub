"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { createVerifyToken } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { siteUrl } from "@/lib/siteUrl";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Email ünvanı düzgün deyil." };
  }

  if (formData.get("terms") !== "on") {
    return { error: "Davam etmək üçün İstifadə Şərtləri və Məxfilik Siyasətini qəbul etməlisiniz." };
  }

  // Each signup hashes a password and sends an email — throttle so a script
  // can't mass-create accounts or use us to bomb someone else's inbox. Skipped
  // when the caller's address is unknown: one shared bucket would lock out
  // every honest visitor rather than the one abuser.
  const ip = clientIp(await headers());
  if (ip) {
    const limit = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!limit.ok) {
      const minutes = Math.ceil(limit.retryAfterSec / 60);
      return { error: `Çox sayda qeydiyyat cəhdi. ${minutes} dəqiqə sonra yenidən yoxlayın.` };
    }
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) {
    return { error: "Oyun seçimi düzgün deyil." };
  }

  const existing = await prisma.player.findUnique({ where: { email } });
  if (existing) {
    return { error: "Bu email artıq qeydiyyatdan keçib." };
  }

  // Raw token in the link, hash in the database — see lib/tokens.ts.
  const verify = createVerifyToken();

  const player = await prisma.player.create({
    data: {
      nickname,
      slug: `${slugify(nickname)}-${Math.random().toString(36).slice(2, 6)}`,
      gameId,
      country,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      isClaimed: true,
      verifyToken: verify.hash,
      verifyTokenExpiry: verify.expiresAt,
    },
  });

  const verifyUrl = `${siteUrl()}/player/verify-email?token=${verify.raw}`;
  const mail = await sendVerificationEmail(email, verifyUrl, "az");

  await createSession({ kind: "player", id: player.id });

  // The account exists and the session is valid either way — but if the message
  // never left, saying nothing would leave someone waiting on an email that is
  // not coming. The dashboard banner picks this up and offers a resend.
  redirect(mail.ok ? "/player" : "/player?mail=failed");
}
