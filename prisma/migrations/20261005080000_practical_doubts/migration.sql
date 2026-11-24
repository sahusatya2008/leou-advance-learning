-- CreateEnum
CREATE TYPE "PracticalDoubtStatus" AS ENUM ('OPEN', 'ANSWERED', 'SATISFIED');
-- CreateEnum
CREATE TYPE "DoubtAuthorRole" AS ENUM ('STUDENT', 'ADMIN');
-- CreateEnum
CREATE TYPE "DoubtRecordingKind" AS ENUM ('SCREEN', 'VOICE');
-- DropIndex
-- DropIndex
-- CreateTable
CREATE TABLE "PracticalDoubt" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "PracticalDoubtStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "satisfiedAt" TIMESTAMP(3),
    CONSTRAINT "PracticalDoubt_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "PracticalDoubtMessage" (
    "id" TEXT NOT NULL,
    "doubtId" TEXT NOT NULL,
    "authorRole" "DoubtAuthorRole" NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT,
    "codeExcerpt" TEXT,
    "terminalExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticalDoubtMessage_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "PracticalRecording" (
    "id" TEXT NOT NULL,
    "doubtId" TEXT NOT NULL,
    "messageId" TEXT,
    "studentId" TEXT NOT NULL,
    "kind" "DoubtRecordingKind" NOT NULL,
    "storageName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PracticalRecording_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "PracticalDoubt_studentId_status_idx" ON "PracticalDoubt"("studentId", "status");
-- CreateIndex
CREATE INDEX "PracticalDoubt_assignmentId_questionId_idx" ON "PracticalDoubt"("assignmentId", "questionId");
-- CreateIndex
CREATE INDEX "PracticalDoubt_status_lastActivityAt_idx" ON "PracticalDoubt"("status", "lastActivityAt");
-- CreateIndex
CREATE INDEX "PracticalDoubtMessage_doubtId_createdAt_idx" ON "PracticalDoubtMessage"("doubtId", "createdAt");
-- CreateIndex
CREATE INDEX "PracticalRecording_doubtId_kind_idx" ON "PracticalRecording"("doubtId", "kind");
-- CreateIndex
CREATE INDEX "PracticalRecording_deletedAt_idx" ON "PracticalRecording"("deletedAt");
-- CreateIndex
CREATE INDEX "PracticalRecording_createdAt_idx" ON "PracticalRecording"("createdAt");
-- AddForeignKey
ALTER TABLE "PracticalDoubt" ADD CONSTRAINT "PracticalDoubt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PracticalAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PracticalDoubt" ADD CONSTRAINT "PracticalDoubt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PracticalDoubt" ADD CONSTRAINT "PracticalDoubt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PracticalDoubtMessage" ADD CONSTRAINT "PracticalDoubtMessage_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "PracticalDoubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PracticalRecording" ADD CONSTRAINT "PracticalRecording_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "PracticalDoubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PracticalRecording" ADD CONSTRAINT "PracticalRecording_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "PracticalDoubtMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
