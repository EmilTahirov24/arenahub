"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { INVITE_BLOCK_MESSAGE, findInvitablePlayer, inviteBlockFor, inviteExpiry } from "@/lib/teamInvites";
import type { PlayerStatus } from "@/app/generated/prisma/client";

async function requireOwnedTeam() {
  const session = await getPlayerSession();
  if (!session) throw new Error("Unauthorized");
  const team = await prisma.team.findFirst({ where: { ownerId: session.id } });
  if (!team) throw new Error("Forbidden");
  return { team, ownerId: session.id };
}

async function requireRosterMember(teamId: string, playerId: string) {
  const membership = await prisma.teamMembership.findFirst({ where: { teamId, playerId, leftAt: null } });
  if (!membership) throw new Error("Forbidden");
  return membership;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------- Inviting an existing account ----------

export type InviteSearchState = {
  error?: string;
  found?: { id: string; nickname: string; country: string | null; photoUrl: string | null; role: string | null };
};

export async function searchPlayerToInvite(
  _prevState: InviteSearchState | undefined,
  formData: FormData,
): Promise<InviteSearchState> {
  const { team, ownerId } = await requireOwnedTeam();
  const query = String(formData.get("query") ?? "").trim();

  // Keyed by session rather than IP: the actor is authenticated, and this stops
  // one owner grinding through nickname guesses without punishing everyone else
  // behind the same IP.
  const limit = rateLimit(`invite-search:${ownerId}`, 20, 60_000);
  if (!limit.ok) {
    return { error: "Çox sayda axtarış. Bir dəqiqə sonra yenidən yoxlayın." };
  }

  const result = await findInvitablePlayer(query, team, ownerId);
  if ("block" in result) return { error: INVITE_BLOCK_MESSAGE[result.block] };

  const { id, nickname, country, photoUrl, role } = result.player;
  return { found: { id, nickname, country, photoUrl, role } };
}

export async function sendTeamInvite(playerId: string) {
  const { team, ownerId } = await requireOwnedTeam();

  // Re-validate from scratch: the search result travelled through the client,
  // and the player may have joined a team since it was produced.
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || !player.isClaimed) throw new Error("Oyunçu tapılmadı");
  const block = await inviteBlockFor(player, team, ownerId);
  if (block) throw new Error(INVITE_BLOCK_MESSAGE[block]);

  await prisma.teamInvite.upsert({
    where: { teamId_playerId: { teamId: team.id, playerId } },
    create: { teamId: team.id, playerId, invitedById: ownerId, expiresAt: inviteExpiry() },
    update: { status: "PENDING", invitedById: ownerId, expiresAt: inviteExpiry(), respondedAt: null },
  });

  revalidatePath("/player/team/roster");
  redirect("/player/team/roster");
}

export async function cancelTeamInvite(inviteId: string) {
  const { team } = await requireOwnedTeam();

  const { count } = await prisma.teamInvite.updateMany({
    where: { id: inviteId, teamId: team.id, status: "PENDING" },
    data: { status: "CANCELLED", respondedAt: new Date() },
  });
  if (count === 0) throw new Error("Dəvət tapılmadı");

  revalidatePath("/player/team/roster");
}

// ---------- Shell players (people without an account) ----------

export type CreatePlayerState = { error?: string } | undefined;

export async function createOwnPlayer(_prevState: CreatePlayerState, formData: FormData): Promise<CreatePlayerState> {
  const { team } = await requireOwnedTeam();
  const nickname = String(formData.get("nickname") ?? "").trim();
  if (!nickname) return { error: "Nickname boş ola bilməz." };

  // Stop the duplicate at the source: if this person already has an account,
  // creating a second, owner-controlled profile for them is exactly the problem
  // this feature exists to remove.
  const registered = await prisma.player.findFirst({
    where: { isClaimed: true, nickname: { equals: nickname, mode: "insensitive" } },
    select: { id: true },
  });
  if (registered) {
    return {
      error: `"${nickname}" adı ilə qeydiyyatlı hesab artıq var. Yeni profil yaratmaq əvəzinə axtarış vasitəsilə ona dəvət göndərin.`,
    };
  }

  const player = await prisma.player.create({
    data: {
      nickname,
      slug: slugify(nickname) + "-" + Math.random().toString(36).slice(2, 6),
      firstName: String(formData.get("firstName") ?? "") || null,
      lastName: String(formData.get("lastName") ?? "") || null,
      country: String(formData.get("country") ?? "") || null,
      role: String(formData.get("role") ?? "") || null,
      photoUrl: String(formData.get("photoUrl") ?? "") || null,
      gameId: team.gameId,
    },
  });
  await prisma.teamMembership.create({ data: { teamId: team.id, playerId: player.id } });

  revalidatePath("/player/team/roster");
  revalidatePath("/[locale]", "layout");
  redirect("/player/team/roster");
}

/**
 * Full profile editing, restricted to the shell profiles the owner created
 * themselves. A claimed player's nickname, photo and country belong to that
 * account — for them the owner only gets the membership controls below.
 */
export async function updateShellPlayer(
  playerId: string,
  _prevState: CreatePlayerState,
  formData: FormData,
): Promise<CreatePlayerState> {
  const { team } = await requireOwnedTeam();
  await requireRosterMember(team.id, playerId);

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { isClaimed: true } });
  if (!player) throw new Error("Oyunçu tapılmadı");
  if (player.isClaimed) throw new Error("Bu oyunçunun profili özünə məxsusdur");

  const nickname = String(formData.get("nickname") ?? "").trim();
  if (!nickname) return { error: "Nickname boş ola bilməz." };

  const registered = await prisma.player.findFirst({
    where: { isClaimed: true, nickname: { equals: nickname, mode: "insensitive" } },
    select: { id: true },
  });
  if (registered) {
    return { error: `"${nickname}" adı ilə qeydiyyatlı hesab var — kölgə profilə bu adı verə bilmərik.` };
  }

  await prisma.player.update({
    where: { id: playerId },
    data: {
      nickname,
      firstName: String(formData.get("firstName") ?? "") || null,
      lastName: String(formData.get("lastName") ?? "") || null,
      country: String(formData.get("country") ?? "") || null,
      role: String(formData.get("role") ?? "") || null,
      status: String(formData.get("status") ?? "ACTIVE") as PlayerStatus,
      photoUrl: String(formData.get("photoUrl") ?? "") || null,
    },
  });

  await updateMembershipFields(team.id, playerId, formData);

  revalidatePath("/player/team/roster");
  revalidatePath("/[locale]", "layout");
  redirect("/player/team/roster");
}

/** Team-internal fields — the owner's business for every roster member. */
export async function updateMembership(playerId: string, formData: FormData) {
  const { team } = await requireOwnedTeam();
  await requireRosterMember(team.id, playerId);
  await updateMembershipFields(team.id, playerId, formData);

  revalidatePath("/player/team/roster");
  revalidatePath("/[locale]", "layout");
  redirect("/player/team/roster");
}

async function updateMembershipFields(teamId: string, playerId: string, formData: FormData) {
  await prisma.teamMembership.updateMany({
    where: { teamId, playerId, leftAt: null },
    data: {
      isStandin: formData.get("isStandin") === "on",
      isCoach: formData.get("isCoach") === "on",
    },
  });
}

export async function removeOwnPlayer(playerId: string) {
  const { team, ownerId } = await requireOwnedTeam();
  // An owner leaving their own roster would leave the team managed by someone
  // who is not on it — removal has to go through deleting/transferring instead.
  if (playerId === ownerId) throw new Error("Komanda sahibi öz tərkibindən çıxa bilməz");
  await requireRosterMember(team.id, playerId);

  await prisma.teamMembership.updateMany({
    where: { teamId: team.id, playerId, leftAt: null },
    data: { leftAt: new Date() },
  });

  revalidatePath("/player/team/roster");
  revalidatePath("/[locale]", "layout");
}
