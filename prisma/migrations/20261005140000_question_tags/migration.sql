-- AlterTable
-- Concept tags (e.g. ["while-loop"]) that sit alongside the chapter in
-- Question.topic. Nullable, so existing questions are untouched.
ALTER TABLE "Question" ADD COLUMN     "tags" JSONB;
