-- Drop old predictions not attributed to a player (previously fan/team predictions)
DELETE FROM "MatchPrediction" WHERE "playerId" IS NULL;

-- Drop FKs/indexes tied to the columns being removed
ALTER TABLE "MatchPrediction" DROP CONSTRAINT IF EXISTS "MatchPrediction_fanId_fkey";
ALTER TABLE "MatchPrediction" DROP CONSTRAINT IF EXISTS "MatchPrediction_teamId_fkey";
DROP INDEX IF EXISTS "MatchPrediction_matchId_fanId_key";
DROP INDEX IF EXISTS "MatchPrediction_matchId_teamId_key";

-- AlterTable
ALTER TABLE "MatchPrediction" DROP COLUMN "fanId",
DROP COLUMN "teamId",
ALTER COLUMN "playerId" SET NOT NULL;

-- DropTable
DROP TABLE "Fan";

-- AlterTable: Team loses its independent auth, gains an owner
ALTER TABLE "Team" DROP COLUMN "email",
DROP COLUMN "passwordHash",
DROP COLUMN "isClaimed",
DROP COLUMN "emailVerified",
DROP COLUMN "points",
DROP COLUMN "failedLoginAttempts",
DROP COLUMN "lockUntil",
DROP COLUMN "resetToken",
DROP COLUMN "resetTokenExpiry",
DROP COLUMN "verifyToken",
DROP COLUMN "verifyTokenExpiry",
ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "Team_ownerId_idx" ON "Team"("ownerId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
