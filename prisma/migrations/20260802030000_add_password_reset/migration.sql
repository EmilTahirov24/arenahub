-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Team_resetToken_key" ON "Team"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "Player_resetToken_key" ON "Player"("resetToken");
