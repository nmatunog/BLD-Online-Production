-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('SERIES', 'OCCURRENCE', 'ONE_OFF');

-- AlterTable: Add new Event Standards v1 fields
ALTER TABLE "Event" ADD COLUMN "eventKind" "EventKind";
ALTER TABLE "Event" ADD COLUMN "occurrenceSubtype" TEXT;
ALTER TABLE "Event" ADD COLUMN "serialNumber" INTEGER;

-- Backfill eventKind with safe logic:
-- 1. SERIES: isRecurring=true, recurrenceTemplateId IS NULL, recurrencePattern set, category in known series
-- 2. OCCURRENCE: recurrenceTemplateId IS NOT NULL (child of a series)
-- 3. ONE_OFF: everything else (standalone events)

-- Mark true recurring series templates (Community Worship, Word Sharing Circle with recurrence pattern)
UPDATE "Event"
SET "eventKind" = 'SERIES'
WHERE "isRecurring" = true
  AND "recurrenceTemplateId" IS NULL
  AND "recurrencePattern" IS NOT NULL
  AND "category" IN ('Community Worship', 'Word Sharing Circle');

-- Mark occurrences (children of series)
UPDATE "Event"
SET "eventKind" = 'OCCURRENCE'
WHERE "recurrenceTemplateId" IS NOT NULL;

-- Mark everything else as ONE_OFF (standalone events or legacy junk)
UPDATE "Event"
SET "eventKind" = 'ONE_OFF'
WHERE "eventKind" IS NULL;

-- Now make eventKind required (NOT NULL)
ALTER TABLE "Event" ALTER COLUMN "eventKind" SET NOT NULL;

-- Add index for eventKind
CREATE INDEX "Event_eventKind_idx" ON "Event"("eventKind");

-- Note: Unique constraint for occurrences (recurrenceTemplateId, startDate day, startTime)
-- will be implemented programmatically in the service layer using idempotent create logic
-- since Prisma doesn't support partial unique constraints cleanly with date functions
