-- Dedicated audit-log types for practical-assignment admin actions.
--
-- Reusing ADMIN_*_ASSESSMENT would make the activity feed lie about what an admin
-- did. Postgres enum additions are additive and cannot drop or rewrite existing
-- values, so every historical row keeps its meaning.
ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'ADMIN_CREATE_PRACTICAL';
ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'ADMIN_UPDATE_PRACTICAL';
