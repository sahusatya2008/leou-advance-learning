-- Which live subscription lines a renewal takes over when approved. Empty = whole plan.
ALTER TABLE "OnboardingRequest" ADD COLUMN "renewsActivationIds" JSONB;
