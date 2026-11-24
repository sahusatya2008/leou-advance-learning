-- CreateEnum
CREATE TYPE "AssessmentAttemptMode" AS ENUM ('SCHEDULED', 'FLEXIBLE');

-- DropIndex
DROP INDEX "Submission_assessmentId_studentId_key";

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "attemptMode" "AssessmentAttemptMode" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "maxAttempts" INTEGER,
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Assessment_batchId_subjectId_topic_idx" ON "Assessment"("batchId", "subjectId", "topic");

-- CreateIndex
CREATE INDEX "Submission_assessmentId_studentId_idx" ON "Submission"("assessmentId", "studentId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
