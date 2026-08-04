"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, getPlayerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { socialsFromFormData } from "@/lib/socials";
import type { PlayerStatus } from "@/app/generated/prisma/client";
import { createVerifyToken, resendAvailableInSeconds, RESEND_RATE_LIMIT_SECONDS } from "@/lib/emailVerification";
import { sendVerificationEmail } from "@/lib/email";
import { siteUrl } from "@/lib/siteUrl";

export async function playerLogout() {
  await destroySession();
  redirect("/player/login");
}

export async function resendPlayerVerificationEmail(
  _prevState: { waitSeconds: number; failed?: boolean } | undefined,
) {
  const session = await getPlayerSession();
  if (!session) throw new Error("Unauthorized");

  const player = await prisma.player.findUnique({ where: { id: session.id } });
  if (!player || !player.email || player.emailVerified) return { waitSeconds: 0 };

  const waitSeconds = resendAvailableInSeconds(player);
  if (waitSeconds > 0) return { waitSeconds };

  const verify = createVerifyToken();
  await prisma.player.update({
    where: { id: player.id },
    data: { verifyToken: verify.hash, verifyTokenExpiry: verify.expiresAt },
  });

  const verifyUrl = `${siteUrl()}/player/verify-email?token=${verify.raw}`;
  const mail = await sendVerificationEmail(player.email, verifyUrl, "az");
  revalidatePath("/player");

  // A failed send must not start the five-minute cooldown — the point of the
  // cooldown is to stop inbox flooding, and nothing reached the inbox.
  if (!mail.ok) return { waitSeconds: 0, failed: true };

  return { waitSeconds: RESEND_RATE_LIMIT_SECONDS };
}

export async function updateOwnPlayer(formData: FormData) {
  const session = await getPlayerSession();
  if (!session) throw new Error("Unauthorized");

  await prisma.player.update({
    where: { id: session.id },
    data: {
      firstName: String(formData.get("firstName") ?? "") || null,
      lastName: String(formData.get("lastName") ?? "") || null,
      country: String(formData.get("country") ?? "") || null,
      role: String(formData.get("role") ?? "") || null,
      status: String(formData.get("status") ?? "ACTIVE") as PlayerStatus,
      photoUrl: String(formData.get("photoUrl") ?? "") || null,
      socials: socialsFromFormData(formData),
    },
  });
  revalidatePath("/player");
  revalidatePath("/[locale]", "layout");
}
