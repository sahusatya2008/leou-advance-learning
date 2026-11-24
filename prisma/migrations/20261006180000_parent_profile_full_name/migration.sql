-- Parents get a display name for admin lists and their own panel.
ALTER TABLE "ParentProfile" ADD COLUMN "fullName" TEXT;

-- Audit type for admin CRUD on parent accounts (PARENT_LOGIN already exists in LogType).
ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'ADMIN_MANAGE_PARENT';
