-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifyToken" TEXT,
ADD COLUMN     "verifyTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifyToken" TEXT,
ADD COLUMN     "verifyTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Team_verifyToken_key" ON "Team"("verifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "Player_verifyToken_key" ON "Player"("verifyToken");
