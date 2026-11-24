-- Add a chapter/topic tag to every question so the admin question bank can
-- filter by class, subject, chapter and type, and assignments can be built
-- from questions of one chapter.
ALTER TABLE "Question" ADD COLUMN     "topic" TEXT;

CREATE INDEX "Question_classRoomId_subjectId_topic_idx" ON "Question"("classRoomId", "subjectId", "topic");