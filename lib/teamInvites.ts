import "server-only";
import { prisma } from "@/lib/prisma";
import type { Player, Team } from "@/app/generated/prisma/client";

export const INVITE_EXPIRY_DAYS = 14;

export function inviteExpiry() {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60_000);
}

export type InviteBlock =
  | "NOT_REGISTERED"
  | "SELF"
  | "SAME_TEAM"
  | "OTHER_TEAM"
  | "WRONG_GAME"
  | "ALREADY_INVITED";

export type InviteLookup = { player: Player } | { block: InviteBlock };

export const INVITE_BLOCK_MESSAGE: Record<InviteBlock, string> = {
  NOT_REGISTERED:
    "Bu ad və ya email ilə qeydiyyatlı hesab tapılmadı. Hesabı olmayan oyunçunu aşağıdakı forma ilə əlavə edə bilərsiniz.",
  SELF: "Bu sizsiniz — özünüzü dəvət edə bilməzsiniz.",
  SAME_TEAM: "Bu oyunçu artıq sizin tərkibinizdədir.",
  OTHER_TEAM: "Bu oyunçu artıq başqa bir komandanın tərkibindədir. Əvvəlcə həmin komandadan ayrılmalıdır.",
  WRONG_GAME: "Bu oyunçu başqa bir oyun üzrə qeydiyyatdan keçib.",
  ALREADY_INVITED: "Bu oyunçuya artıq dəvət göndərilib və cavab gözlənilir.",
};

/**
 * Resolve a nickname or email typed by a team owner into a player they are
 * allowed to invite.
 *
 * Deliberately an exact (case-insensitive) match rather than a prefix search:
 * `publiclyListedPlayer` hides self-registered users who have no team from the
 * public directory, and a prefix search here would hand a logged-in user a way
 * to enumerate exactly those hidden accounts. An exact match still finds anyone
 * you actually know, without turning this box into a user directory.
 *
 * Only `isClaimed` players are invitable — the seeded/admin-created pros have
 * no owner to consent, so nobody may claim they joined their roster.
 */
export async function findInvitablePlayer(rawQuery: string, team: Team, ownerId: string): Promise<InviteLookup> {
  const query = rawQuery.trim();
  if (!query) return { block: "NOT_REGISTERED" };

  const player = await prisma.player.findFirst({
    where: {
      isClaimed: true,
      OR: [{ nickname: { equals: query, mode: "insensitive" } }, { email: { equals: query, mode: "insensitive" } }],
    },
  });
  if (!player) return { block: "NOT_REGISTERED" };

  const block = await inviteBlockFor(player, team, ownerId);
  return block ? { block } : { player };
}

/**
 * The eligibility rules themselves, kept separate so the send action can
 * re-check them instead of trusting whatever the search step returned.
 */
export async function inviteBlockFor(player: Player, team: Team, ownerId: string): Promise<InviteBlock | null> {
  if (player.id === ownerId) return "SELF";
  if (player.gameId !== team.gameId) return "WRONG_GAME";

  const activeMembership = await prisma.teamMembership.findFirst({
    where: { playerId: player.id, leftAt: null },
  });
  if (activeMembership) return activeMembership.teamId === team.id ? "SAME_TEAM" : "OTHER_TEAM";

  const pending = await prisma.teamInvite.findFirst({
    where: { playerId: player.id, teamId: team.id, status: "PENDING", expiresAt: { gt: new Date() } },
  });
  if (pending) return "ALREADY_INVITED";

  return null;
}

/** Live invites awaiting this player's answer, newest first. */
export function pendingInvitesFor(playerId: string) {
  return prisma.teamInvite.findMany({
    where: { playerId, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    include: { team: { include: { game: true } }, invitedBy: { select: { nickname: true } } },
  });
}

export function countPendingInvitesFor(playerId: string) {
  return prisma.teamInvite.count({
    where: { playerId, status: "PENDING", expiresAt: { gt: new Date() } },
  });
}
