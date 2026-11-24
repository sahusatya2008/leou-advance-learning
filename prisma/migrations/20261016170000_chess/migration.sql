-- Leou Chess: matches (one board each) and the move log.
-- The board position is a single FEN on the match; every ply is also logged so
-- the game — and the code that produced each move — can be replayed later.
CREATE TABLE "ChessMatch" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "difficulty" TEXT,
    "language" TEXT NOT NULL DEFAULT 'python',
    "createdById" TEXT NOT NULL,
    "whiteId" TEXT,
    "blackId" TEXT,
    "fen" TEXT NOT NULL,
    "result" TEXT,
    "reason" TEXT,
    "plyCount" INTEGER NOT NULL DEFAULT 0,
    "whiteCode" TEXT,
    "blackCode" TEXT,
    "inviteToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ChessMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChessMove" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "ply" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "uci" TEXT NOT NULL,
    "san" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "code" TEXT,
    "language" TEXT,
    "thinkMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChessMove_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChessMatch_inviteToken_key" ON "ChessMatch"("inviteToken");
CREATE INDEX "ChessMatch_createdById_idx" ON "ChessMatch"("createdById");
CREATE INDEX "ChessMatch_whiteId_idx" ON "ChessMatch"("whiteId");
CREATE INDEX "ChessMatch_blackId_idx" ON "ChessMatch"("blackId");
CREATE INDEX "ChessMatch_status_idx" ON "ChessMatch"("status");
CREATE INDEX "ChessMatch_mode_status_idx" ON "ChessMatch"("mode", "status");

CREATE UNIQUE INDEX "ChessMove_matchId_ply_key" ON "ChessMove"("matchId", "ply");
CREATE INDEX "ChessMove_matchId_idx" ON "ChessMove"("matchId");

ALTER TABLE "ChessMatch" ADD CONSTRAINT "ChessMatch_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChessMatch" ADD CONSTRAINT "ChessMatch_whiteId_fkey"
    FOREIGN KEY ("whiteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChessMatch" ADD CONSTRAINT "ChessMatch_blackId_fkey"
    FOREIGN KEY ("blackId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChessMove" ADD CONSTRAINT "ChessMove_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "ChessMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
