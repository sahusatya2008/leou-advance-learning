-- Coding games: per-student progress and editor snapshot for each game level.
-- The levels themselves live in code (src/lib/games); only progress is a row.
CREATE TABLE "GameProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'python',
    "stars" INTEGER NOT NULL DEFAULT 0,
    "bestMoves" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameProgress_userId_gameId_levelId_key" ON "GameProgress"("userId", "gameId", "levelId");
CREATE INDEX "GameProgress_userId_gameId_idx" ON "GameProgress"("userId", "gameId");
CREATE INDEX "GameProgress_userId_updatedAt_idx" ON "GameProgress"("userId", "updatedAt");

ALTER TABLE "GameProgress" ADD CONSTRAINT "GameProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
