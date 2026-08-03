import "server-only";
import { prisma } from "@/lib/prisma";

export type ClaimBlock =
  | "NOT_FOUND"
  | "ALREADY_CLAIMED"
  | "WRONG_GAME"
  | "SELF"
  | "ALREADY_PENDING"
  | "CLAIMANT_HAS_TEAM";

export const CLAIM_BLOCK_MESSAGE: Record<ClaimBlock, string> = {
  NOT_FOUND: "Belə bir profil tapılmadı.",
  ALREADY_CLAIMED: "Bu profilin artıq sahibi var.",
  WRONG_GAME: "Bu profil başqa bir oyun üzrədir.",
  SELF: "Bu artıq sizin profilinizdir.",
  ALREADY_PENDING: "Bu profil üçün müraciətiniz artıq baxılır.",
  CLAIMANT_HAS_TEAM:
    "Profili öz üzərinizə keçirməzdən əvvəl indiki komandanızdan ayrılmalısınız — profilin öz komanda tarixçəsi var.",
};

/**
 * Can `claimantId` ask to take over the shell profile `playerId`?
 *
 * Only unclaimed profiles are claimable — an account already belongs to
 * someone. Same game is required, and the claimant must not currently be on a
 * roster, because the merge moves the shell profile's own membership history
 * over and a player can only sit on one active roster.
 */
export async function claimBlockFor(playerId: string, claimantId: string): Promise<ClaimBlock | null> {
  const [target, claimant] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { isClaimed: true, gameId: true } }),
    prisma.player.findUniqueOrThrow({ where: { id: claimantId }, select: { gameId: true } }),
  ]);

  if (!target) return "NOT_FOUND";
  if (playerId === claimantId) return "SELF";
  if (target.isClaimed) return "ALREADY_CLAIMED";
  if (target.gameId !== claimant.gameId) return "WRONG_GAME";

  const membership = await prisma.teamMembership.findFirst({ where: { playerId: claimantId, leftAt: null } });
  if (membership) return "CLAIMANT_HAS_TEAM";

  const pending = await prisma.profileClaim.findFirst({
    where: { playerId, claimantId, status: "PENDING" },
  });
  if (pending) return "ALREADY_PENDING";

  return null;
}

/**
 * Approve a claim: fold the claimant's account into the shell profile.
 *
 * The shell profile survives and the account row is deleted, not the other way
 * around — the shell is the public entity, with an indexed slug, match stats and
 * roster history that would be lost by pointing the account at it instead. Its
 * credentials are taken over from the account, so the user simply logs in again
 * with the same email and lands on the merged profile. Their session dies with
 * the deleted row, which `getPlayerSession` already handles by returning null.
 */
export async function approveProfileClaim(claimId: string, adminId: string, note?: string) {
  const claim = await prisma.profileClaim.findUniqueOrThrow({
    where: { id: claimId },
    include: { player: true, claimant: true },
  });
  if (claim.status !== "PENDING") throw new Error("Bu müraciətə artıq baxılıb");

  const block = await claimBlockFor(claim.playerId, claim.claimantId);
  // ALREADY_PENDING is this very claim, so it is not a reason to refuse.
  if (block && block !== "ALREADY_PENDING") throw new Error(CLAIM_BLOCK_MESSAGE[block]);

  const { player: target, claimant } = claim;

  // Order matters. Every row still pointing at the claimant has to be moved or
  // removed before the delete: TeamMembership and PlayerMatchStat are Restrict
  // (the delete would fail), and ProfileClaim is Cascade (the delete would take
  // the approval record with it), so the claim rows are repointed rather than
  // left to cascade.
  await prisma.$transaction([
    prisma.profileClaim.updateMany({
      where: { claimantId: claimant.id, status: "PENDING", id: { not: claim.id } },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewNote: "Başqa profil təsdiqləndi" },
    }),
    prisma.profileClaim.update({
      where: { id: claim.id },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: adminId, reviewNote: note || null },
    }),
    prisma.profileClaim.updateMany({ where: { claimantId: claimant.id }, data: { claimantId: target.id } }),

    // Predictions, points, stats and history follow the person.
    prisma.matchPrediction.updateMany({ where: { playerId: claimant.id }, data: { playerId: target.id } }),
    prisma.playerMatchStat.updateMany({ where: { playerId: claimant.id }, data: { playerId: target.id } }),
    prisma.teamMembership.updateMany({ where: { playerId: claimant.id }, data: { playerId: target.id } }),
    prisma.team.updateMany({ where: { ownerId: claimant.id }, data: { ownerId: target.id } }),
    prisma.teamInvite.deleteMany({ where: { OR: [{ playerId: claimant.id }, { invitedById: claimant.id }] } }),

    // Free the unique email before it is re-used on the target row.
    prisma.player.update({
      where: { id: claimant.id },
      data: { email: null, resetToken: null, verifyToken: null },
    }),
    prisma.player.update({
      where: { id: target.id },
      data: {
        email: claimant.email,
        passwordHash: claimant.passwordHash,
        emailVerified: claimant.emailVerified,
        isClaimed: true,
        points: target.points + claimant.points,
      },
    }),
    prisma.player.delete({ where: { id: claimant.id } }),
  ]);
}

export async function rejectProfileClaim(claimId: string, adminId: string, note?: string) {
  const { count } = await prisma.profileClaim.updateMany({
    where: { id: claimId, status: "PENDING" },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: adminId, reviewNote: note || null },
  });
  if (count === 0) throw new Error("Bu müraciətə artıq baxılıb");
}

export function pendingClaimCount() {
  return prisma.profileClaim.count({ where: { status: "PENDING" } });
}
