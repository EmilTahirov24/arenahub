"use server";

import { revalidatePublicContent } from "@/lib/cacheTags";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";

async function requirePlayer() {
  const session = await getPlayerSession();
  // Bitmiş sessiya adi haldır — xəta ekranı yox, giriş səhifəsi (AGENTS.md).
  if (!session) redirect("/player/login");
  return session.id;
}

/** The invite must still be live and still addressed to whoever is answering it. */
async function requirePendingInvite(inviteId: string, playerId: string) {
  const invite = await prisma.teamInvite.findFirst({
    where: { id: inviteId, playerId, status: "PENDING", expiresAt: { gt: new Date() } },
    include: { team: true },
  });
  if (!invite) throw new Error("Dəvət tapılmadı və ya vaxtı bitib");
  return invite;
}

export async function acceptTeamInvite(inviteId: string) {
  const playerId = await requirePlayer();
  const invite = await requirePendingInvite(inviteId, playerId);

  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  // The eligibility rules are re-checked here, not just at invite time: days can
  // pass between sending and accepting, and the player may have joined another
  // roster in between.
  if (player.gameId !== invite.team.gameId) throw new Error("Bu komanda başqa oyun üzrədir");

  const existing = await prisma.teamMembership.findFirst({ where: { playerId, leftAt: null } });
  if (existing) throw new Error("Artıq bir komandanın tərkibindəsiniz");

  await prisma.$transaction([
    prisma.teamMembership.create({ data: { teamId: invite.teamId, playerId } }),
    prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    }),
    // Any other team still waiting on this player can stop waiting.
    prisma.teamInvite.updateMany({
      where: { playerId, status: "PENDING", id: { not: invite.id } },
      data: { status: "CANCELLED", respondedAt: new Date() },
    }),
  ]);

  revalidatePath("/player");
  revalidatePath("/player/team");
  // Joining a roster makes a self-registered profile publicly listed
  // (lib/publicPlayers.ts), so the public pages need rebuilding too.
  revalidatePublicContent();
}

export async function declineTeamInvite(inviteId: string) {
  const playerId = await requirePlayer();
  const invite = await requirePendingInvite(inviteId, playerId);

  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: { status: "DECLINED", respondedAt: new Date() },
  });

  revalidatePath("/player");
  revalidatePath("/player/team");
}

export async function leaveTeam() {
  const playerId = await requirePlayer();

  const membership = await prisma.teamMembership.findFirst({
    where: { playerId, leftAt: null },
    include: { team: true },
  });
  if (!membership) throw new Error("Heç bir komandanın tərkibində deyilsiniz");
  if (membership.team.ownerId === playerId) {
    throw new Error("Komanda sahibi öz komandasından ayrıla bilməz");
  }

  await prisma.teamMembership.update({
    where: { id: membership.id },
    data: { leftAt: new Date() },
  });

  revalidatePath("/player");
  revalidatePath("/player/team");
  revalidatePublicContent();
}
