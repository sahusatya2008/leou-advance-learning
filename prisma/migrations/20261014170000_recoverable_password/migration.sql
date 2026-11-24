-- Administrators must be able to read back the password they provisioned for a
-- student or parent ("show the current password"). bcrypt cannot be reversed, so
-- every password set also writes an AES-256-GCM copy here. Login still verifies
-- against "passwordHash"; this column is display-only.
ALTER TABLE "User" ADD COLUMN "passwordEnc" TEXT;
