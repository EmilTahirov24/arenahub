-- Team ranking becomes computed instead of hand-typed. The old worldRanking
-- values were manually entered and never reacted to results, so there is
-- nothing worth migrating into the new columns — lib/rating.ts replays every
-- finished match to fill them in.
ALTER TABLE "Team" DROP COLUMN "worldRanking";
ALTER TABLE "Team" ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 1000,
ADD COLUMN     "previousRating" DOUBLE PRECISION NOT NULL DEFAULT 1000;

-- CreateEnum
CREATE TYPE "ProfileClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ProfileClaim" (
    "id" TEXT NOT NULL,
    "status" "ProfileClaimStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "playerId" TEXT NOT NULL,
    "claimantId" TEXT NOT NULL,
    "reviewedById" TEXT,

    CONSTRAINT "ProfileClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileClaim_playerId_claimantId_key" ON "ProfileClaim"("playerId", "claimantId");

-- CreateIndex
CREATE INDEX "ProfileClaim_status_idx" ON "ProfileClaim"("status");

-- AddForeignKey
ALTER TABLE "ProfileClaim" ADD CONSTRAINT "ProfileClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileClaim" ADD CONSTRAINT "ProfileClaim_claimantId_fkey" FOREIGN KEY ("claimantId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileClaim" ADD CONSTRAINT "ProfileClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
