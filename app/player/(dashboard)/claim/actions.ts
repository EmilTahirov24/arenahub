"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { CLAIM_BLOCK_MESSAGE, claimBlockFor } from "@/lib/profileClaims";

export type ClaimSearchState = {
  error?: string;
  results?: { id: string; nickname: string; country: string | null; photoUrl: string | null; team: string | null }[];
};

async function requirePlayer() {
  const session = await getPlayerSession();
  if (!session) throw new Error("Unauthorized");
  return session.id;
}

/**
 * Search the unclaimed profiles for one that might be this user.
 *
 * Unlike the roster invite search this is a contains-match, not exact: every
 * candidate here is an unclaimed profile, which `publiclyListedPlayer` already
 * publishes in the public directory, so there is nothing to enumerate that a
 * visitor could not simply browse.
 */
export async function searchClaimableProfiles(
  _prevState: ClaimSearchState | undefined,
  formData: FormData,
): Promise<ClaimSearchState> {
  const playerId = await requirePlayer();
  const query = String(formData.get("query") ?? "").trim();
  if (query.length < 2) return { error: "Ən azı 2 simvol yazın." };

  const limit = rateLimit(`claim-search:${playerId}`, 20, 60_000);
  if (!limit.ok) return { error: "Çox sayda axtarış. Bir dəqiqə sonra yenidən yoxlayın." };

  const me = await prisma.player.findUniqueOrThrow({ where: { id: playerId }, select: { gameId: true } });
  const found = await prisma.player.findMany({
    where: { isClaimed: false, gameId: me.gameId, nickname: { contains: query, mode: "insensitive" } },
    orderBy: { nickname: "asc" },
    take: 10,
    include: { memberships: { where: { leftAt: null }, include: { team: true }, take: 1 } },
  });

  if (found.length === 0) return { error: "Bu ada uyğun sahibsiz profil tapılmadı." };

  return {
    results: found.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      country: p.country,
      photoUrl: p.photoUrl,
      team: p.memberships[0]?.team.name ?? null,
    })),
  };
}

export async function submitProfileClaim(playerId: string, formData: FormData) {
  const claimantId = await requirePlayer();
  const message = String(formData.get("message") ?? "").trim();
  if (message.length < 10) throw new Error("Sübut mətni ən azı 10 simvol olmalıdır");

  const block = await claimBlockFor(playerId, claimantId);
  if (block) throw new Error(CLAIM_BLOCK_MESSAGE[block]);

  await prisma.profileClaim.upsert({
    where: { playerId_claimantId: { playerId, claimantId } },
    create: { playerId, claimantId, message },
    update: { status: "PENDING", message, reviewedAt: null, reviewedById: null, reviewNote: null },
  });

  revalidatePath("/player/claim");
  revalidatePath("/player");
}

export async function withdrawProfileClaim(claimId: string) {
  const claimantId = await requirePlayer();
  const { count } = await prisma.profileClaim.deleteMany({
    where: { id: claimId, claimantId, status: "PENDING" },
  });
  if (count === 0) throw new Error("Müraciət tapılmadı");

  revalidatePath("/player/claim");
  revalidatePath("/player");
}
