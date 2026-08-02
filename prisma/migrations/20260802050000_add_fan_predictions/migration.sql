-- CreateTable
CREATE TABLE "Fan" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockUntil" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "verifyToken" TEXT,
    "verifyTokenExpiry" TIMESTAMP(3),

    CONSTRAINT "Fan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPrediction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchId" TEXT NOT NULL,
    "fanId" TEXT NOT NULL,
    "predictedWinnerId" TEXT NOT NULL,

    CONSTRAINT "MatchPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fan_username_key" ON "Fan"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Fan_email_key" ON "Fan"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Fan_resetToken_key" ON "Fan"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "Fan_verifyToken_key" ON "Fan"("verifyToken");

-- CreateIndex
CREATE INDEX "MatchPrediction_matchId_idx" ON "MatchPrediction"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPrediction_matchId_fanId_key" ON "MatchPrediction"("matchId", "fanId");

-- AddForeignKey
ALTER TABLE "MatchPrediction" ADD CONSTRAINT "MatchPrediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPrediction" ADD CONSTRAINT "MatchPrediction_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPrediction" ADD CONSTRAINT "MatchPrediction_predictedWinnerId_fkey" FOREIGN KEY ("predictedWinnerId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
