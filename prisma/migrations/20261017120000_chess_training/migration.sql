-- Leou Chess — Training.
-- One row per (student, track, lesson). Training is an enrolled-only feature and
-- is graded by the chess-training judge rather than the arcade judge, so it gets
-- its own table instead of reusing GameProgress.
CREATE TABLE "ChessTrainingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'python',
    "stars" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "bestMoves" INTEGER,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChessTrainingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChessTrainingProgress_userId_track_lessonId_key" ON "ChessTrainingProgress"("userId", "track", "lessonId");
CREATE INDEX "ChessTrainingProgress_userId_track_idx" ON "ChessTrainingProgress"("userId", "track");
CREATE INDEX "ChessTrainingProgress_userId_updatedAt_idx" ON "ChessTrainingProgress"("userId", "updatedAt");

ALTER TABLE "ChessTrainingProgress" ADD CONSTRAINT "ChessTrainingProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
