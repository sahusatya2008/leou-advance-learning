-- Practical assignments: chapter-scoped guided practice.
--
-- Strictly additive. `isPractical` defaults to false so all 216 existing
-- questions keep behaving exactly as before and no existing row is rewritten
-- beyond receiving the column default. No table is dropped or altered in a way
-- that can lose data, so this is safe to apply to the live database.
--
-- A practical set is unique per (batch, subject, chapter): the admin builder
-- picks one chapter and gets exactly one practical workspace for it, which
-- stops two competing question lists existing for the same chapter.

-- Enums
CREATE TYPE "PracticalStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "PracticalAttemptStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');
CREATE TYPE "PracticalEventType" AS ENUM (
  'CODE_SAVED',
  'CODE_RUN',
  'TERMINAL_INPUT',
  'TERMINAL_OUTPUT',
  'ATTEMPT_STARTED',
  'ATTEMPT_FINISHED'
);

-- Practical tagging on the question bank
ALTER TABLE "Question" ADD COLUMN "isPractical" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Question_classRoomId_subjectId_topic_isPractical_idx"
  ON "Question"("classRoomId", "subjectId", "topic", "isPractical");

-- The practical set for one chapter of one subject in one batch
CREATE TABLE "PracticalAssignment" (
  "id"           TEXT NOT NULL,
  "batchId"      TEXT NOT NULL,
  "subjectId"    TEXT NOT NULL,
  "topic"        TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "instructions" TEXT,
  "status"       "PracticalStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "createdBy"    TEXT,

  CONSTRAINT "PracticalAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticalAssignment_batchId_subjectId_topic_key"
  ON "PracticalAssignment"("batchId", "subjectId", "topic");
CREATE INDEX "PracticalAssignment_batchId_status_idx"
  ON "PracticalAssignment"("batchId", "status");
CREATE INDEX "PracticalAssignment_batchId_subjectId_topic_idx"
  ON "PracticalAssignment"("batchId", "subjectId", "topic");

-- Ordered questions inside a practical set
CREATE TABLE "PracticalAssignmentQuestion" (
  "id"           TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "questionId"   TEXT NOT NULL,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "addedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PracticalAssignmentQuestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticalAssignmentQuestion_assignmentId_questionId_key"
  ON "PracticalAssignmentQuestion"("assignmentId", "questionId");
CREATE INDEX "PracticalAssignmentQuestion_assignmentId_idx"
  ON "PracticalAssignmentQuestion"("assignmentId");

-- A student's work on one practical question
CREATE TABLE "PracticalAttempt" (
  "id"              TEXT NOT NULL,
  "assignmentId"    TEXT NOT NULL,
  "studentId"       TEXT NOT NULL,
  "questionId"      TEXT NOT NULL,
  "status"          "PracticalAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "language"        TEXT,
  "code"            TEXT,
  "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"      TIMESTAMP(3),

  CONSTRAINT "PracticalAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticalAttempt_assignmentId_studentId_idx"
  ON "PracticalAttempt"("assignmentId", "studentId");
CREATE INDEX "PracticalAttempt_studentId_lastActivityAt_idx"
  ON "PracticalAttempt"("studentId", "lastActivityAt");
CREATE INDEX "PracticalAttempt_studentId_questionId_lastActivityAt_idx"
  ON "PracticalAttempt"("studentId", "questionId", "lastActivityAt");

-- Append-only activity trail for the admin
CREATE TABLE "PracticalEvent" (
  "id"        TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "type"      "PracticalEventType" NOT NULL,
  "summary"   TEXT,
  "detail"    JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PracticalEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticalEvent_attemptId_createdAt_idx"
  ON "PracticalEvent"("attemptId", "createdAt");
CREATE INDEX "PracticalEvent_studentId_createdAt_idx"
  ON "PracticalEvent"("studentId", "createdAt");
CREATE INDEX "PracticalEvent_type_createdAt_idx"
  ON "PracticalEvent"("type", "createdAt");

-- Foreign keys. All ON DELETE CASCADE, matching the rest of the schema, so
-- deleting a batch or question can never leave orphaned practical rows behind.
ALTER TABLE "PracticalAssignment"
  ADD CONSTRAINT "PracticalAssignment_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticalAssignment"
  ADD CONSTRAINT "PracticalAssignment_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticalAssignmentQuestion"
  ADD CONSTRAINT "PracticalAssignmentQuestion_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "PracticalAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE, to match `AssessmentQuestion.question` and Prisma's
-- default for a required relation: deleting a Question that sits in a published
-- practical must fail loudly rather than silently drop it from a student's
-- chapter. Admins remove it from the practical set first (that deletes this row).
ALTER TABLE "PracticalAssignmentQuestion"
  ADD CONSTRAINT "PracticalAssignmentQuestion_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticalAttempt"
  ADD CONSTRAINT "PracticalAttempt_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "PracticalAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticalAttempt"
  ADD CONSTRAINT "PracticalAttempt_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticalAttempt"
  ADD CONSTRAINT "PracticalAttempt_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticalEvent"
  ADD CONSTRAINT "PracticalEvent_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "PracticalAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;