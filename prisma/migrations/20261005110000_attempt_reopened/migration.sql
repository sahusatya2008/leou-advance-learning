-- AlterEnum
-- Adds the event type written when a student reopens an attempt they had marked
-- done, so the audit trail shows the gap between finishing and coming back.
ALTER TYPE "PracticalEventType" ADD VALUE 'ATTEMPT_REOPENED';
