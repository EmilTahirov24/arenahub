-- AlterTable
ALTER TABLE "MatchPrediction" ALTER COLUMN "fanId" DROP NOT NULL;
ALTER TABLE "MatchPrediction" ADD COLUMN     "playerId" TEXT,
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "MatchPrediction_matchId_playerId_key" ON "MatchPrediction"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPrediction_matchId_teamId_key" ON "MatchPrediction"("matchId", "teamId");

-- AddForeignKey
ALTER TABLE "MatchPrediction" ADD CONSTRAINT "MatchPrediction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPrediction" ADD CONSTRAINT "MatchPrediction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
