-- The payment lock. The single thing that makes a saved quotation uneditable
-- once the student points a real payment at its reference.
ALTER TABLE "OnboardingRequest" ADD COLUMN "lockedAt" TIMESTAMP(3);

-- Chapters per subject. The flat *Topics columns stay and stay in sync as the
-- union across subjects (pricing/admin/fee records read them), but they cannot
-- say which subject a chapter belongs to, so this is the entitlement authority.
ALTER TABLE "OnboardingRequest" ADD COLUMN "subjectTopics" JSONB;

CREATE INDEX "OnboardingRequest_lockedAt_idx" ON "OnboardingRequest"("lockedAt");

-- ---------------------------------------------------------------------------
-- Backfill subjectTopics from the flat columns.
--
-- Every historical request stored one comma-separated list that was applied to
-- *all* of that request's subjects, so the only faithful expansion is to give
-- every selected subject that same list. That reproduces today's behaviour
-- exactly - it does not invent or drop a single chapter - and is why the
-- per-subject entries can only start diverging from here on.
-- ---------------------------------------------------------------------------

-- Mirrors parseTopics() in src/services/onboardingService.ts: split on comma,
-- trim, lowercase, drop empties, dedupe. jsonb_agg over a distinct set gives
-- the dedupe; array_agg keeps a stable order so the value is reproducible.
CREATE OR REPLACE FUNCTION pg_temp.leou_topic_list(raw text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(DISTINCT lower(btrim(part)))
      FROM unnest(string_to_array(COALESCE(raw, ''), ',')) AS part
      WHERE btrim(part) <> ''
    ),
    '[]'::jsonb
  );
$$;

UPDATE "OnboardingRequest" AS r
SET "subjectTopics" = COALESCE(
  (
    SELECT jsonb_object_agg(
             s."subjectId",
             jsonb_build_object(
               'assignment', pg_temp.leou_topic_list(r."assignmentTopics"),
               'mock', pg_temp.leou_topic_list(
                 CASE WHEN r."sameTopicsForMockTests"
                      THEN r."assignmentTopics" ELSE r."mockTopics" END),
               'test', pg_temp.leou_topic_list(
                 CASE WHEN r."sameTopicsForMockTests"
                      THEN r."assignmentTopics" ELSE r."testTopics" END)
             )
           )
    FROM jsonb_array_elements_text(COALESCE(r."subjects", '[]'::jsonb)) AS s("subjectId")
  ),
  '{}'::jsonb
)
WHERE r."subjectTopics" IS NULL;

DROP FUNCTION pg_temp.leou_topic_list(text);
