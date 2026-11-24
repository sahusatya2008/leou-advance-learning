-- The reference belongs to the service request, not to each proof attempt, so
-- it is minted once and reused when a student has to resubmit.
DROP INDEX "public"."PaymentRequest_leouPayRef_key";
CREATE INDEX "PaymentRequest_leouPayRef_idx" ON "PaymentRequest" ("leouPayRef");

ALTER TABLE "OnboardingRequest" ADD COLUMN "leouPayRef" TEXT;
CREATE UNIQUE INDEX "OnboardingRequest_leouPayRef_key" ON "OnboardingRequest"("leouPayRef");
