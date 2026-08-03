-- AlterTable: career prize money, entered by an admin from a public source
ALTER TABLE "Team" ADD COLUMN     "earnings" INTEGER;

-- AlterTable: period averages for players whose individual matches are not
-- recorded here. Nullable on purpose — an unknown value stays unknown.
ALTER TABLE "Player" ADD COLUMN     "statMaps" INTEGER,
ADD COLUMN     "statKillsPerRound" DOUBLE PRECISION,
ADD COLUMN     "statDeathsPerRound" DOUBLE PRECISION,
ADD COLUMN     "statDamagePerRound" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "TournamentPrize" (
    "id" TEXT NOT NULL,
    "placeFrom" INTEGER NOT NULL,
    "placeTo" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "label" TEXT,
    "tournamentId" TEXT NOT NULL,

    CONSTRAINT "TournamentPrize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPrize_tournamentId_placeFrom_key" ON "TournamentPrize"("tournamentId", "placeFrom");

-- CreateIndex
CREATE INDEX "TournamentPrize_tournamentId_idx" ON "TournamentPrize"("tournamentId");

-- AddForeignKey
ALTER TABLE "TournamentPrize" ADD CONSTRAINT "TournamentPrize_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
