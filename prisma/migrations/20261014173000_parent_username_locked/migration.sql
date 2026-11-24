-- A parent account registered from a student's profile has a system-generated
-- username the student may personalise once; this flag marks that it has been
-- fixed so the student flow stops offering an edit.
ALTER TABLE "ParentProfile" ADD COLUMN "usernameLocked" BOOLEAN NOT NULL DEFAULT false;
