-- Distinguish a first request from a top-up or a renewal, and remember which
-- request each was derived from.
CREATE TYPE "OnboardingKind" AS ENUM ('INITIAL', 'ADDITIONAL', 'RENEWAL');
ALTER TABLE "OnboardingRequest" ADD COLUMN "kind" "OnboardingKind" NOT NULL DEFAULT 'INITIAL';
ALTER TABLE "OnboardingRequest" ADD COLUMN "parentRequestId" TEXT;
CREATE INDEX "OnboardingRequest_parentRequestId_idx" ON "OnboardingRequest"("parentRequestId");
