-- Attendance Monitoring: explicit CW/WSC marker, import-ready attendance provenance.
-- EventStatus.CANCELLED already exists (admin-settable via cancel endpoint / status filter).
-- Do not classify CW/WSC by title at query time after this backfill.

-- CreateEnum
CREATE TYPE "EventSeriesCode" AS ENUM ('CW', 'WSC', 'OTHER');

-- AlterTable Event: explicit series marker
ALTER TABLE "Event" ADD COLUMN "seriesCode" "EventSeriesCode" NOT NULL DEFAULT 'OTHER';

-- AlterTable Attendance: optional import provenance for later Google Sheets history import
-- (phase 2). Import can create Attendance rows with method=MANUAL and importedFrom set.
ALTER TABLE "Attendance" ADD COLUMN "importedFrom" TEXT;

-- Backfill CW (Community / Corporate Worship) from category, title, or eventType
UPDATE "Event"
SET "seriesCode" = 'CW'
WHERE
  lower(coalesce("category", '')) LIKE '%community worship%'
  OR lower(coalesce("category", '')) LIKE '%corporate worship%'
  OR lower(coalesce("title", '')) LIKE '%community worship%'
  OR lower(coalesce("title", '')) LIKE '%corporate worship%'
  OR lower(coalesce("eventType", '')) IN ('community worship', 'corporate worship', 'corporate_worship')
  OR lower(coalesce("category", '')) ~ '(^|[^a-z])cw([^a-z]|$)'
  OR lower(coalesce("title", '')) ~ '(^|[^a-z])cw([^a-z]|$)'
  OR lower(coalesce("eventType", '')) ~ '(^|[^a-z])cw([^a-z]|$)';

-- Backfill WSC from category, title, or eventType (do not overwrite CW)
UPDATE "Event"
SET "seriesCode" = 'WSC'
WHERE "seriesCode" = 'OTHER'
  AND (
    lower(coalesce("category", '')) LIKE '%word sharing%'
    OR lower(coalesce("title", '')) LIKE '%word sharing%'
    OR lower(coalesce("title", '')) ~ '(^|[^a-z])wsc([^a-z]|$)'
    OR lower(coalesce("eventType", '')) IN ('wsc', 'word sharing circle')
  );

-- Backfill Event.ministry for WSC rows from title (longest official name wins).
-- Order matters: more specific / longer names first.
UPDATE "Event" SET "ministry" = 'Prayer Counseling and Healing Services (PCHS)'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%prayer counseling%';
UPDATE "Event" SET "ministry" = 'Shepherds of Districts-in-Process'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%shepherds of districts%';
UPDATE "Event" SET "ministry" = 'Scholarship of Hope Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%scholarship of hope%';
UPDATE "Event" SET "ministry" = 'Institutional Services Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%institutional services%';
UPDATE "Event" SET "ministry" = 'District Council of Stewards'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%district council%';
UPDATE "Event" SET "ministry" = 'Witness Development Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%witness development%';
UPDATE "Event" SET "ministry" = 'Coach Development Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%coach development%';
UPDATE "Event" SET "ministry" = 'Marriage Encounter Program'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%marriage encounter%';
UPDATE "Event" SET "ministry" = 'Family Encounter Program'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%family encounter%';
UPDATE "Event" SET "ministry" = 'Life in the Spirit Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%life in the spirit%';
UPDATE "Event" SET "ministry" = 'Post-LSS Group (PLSG)'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND (lower("title") LIKE '%post-lss%' OR lower("title") LIKE '%plsg%');
UPDATE "Event" SET "ministry" = 'Parish Services Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%parish services%';
UPDATE "Event" SET "ministry" = 'Nazareth Housing Program'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%nazareth%';
UPDATE "Event" SET "ministry" = 'Solo Parent Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%solo parent%';
UPDATE "Event" SET "ministry" = 'Intercessory Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%intercessory%';
UPDATE "Event" SET "ministry" = 'Discipling Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%discipling%';
UPDATE "Event" SET "ministry" = 'Management Services'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%management services%';
UPDATE "Event" SET "ministry" = 'Mission Homesteads'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%mission homestead%';
UPDATE "Event" SET "ministry" = 'Pastoral Services'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%pastoral services%';
UPDATE "Event" SET "ministry" = 'Youth Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%youth ministry%';
UPDATE "Event" SET "ministry" = 'Singles Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%singles ministry%';
UPDATE "Event" SET "ministry" = 'Mark 10 Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%mark 10%';
UPDATE "Event" SET "ministry" = 'Praise Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%praise ministry%';
UPDATE "Event" SET "ministry" = 'Liturgy Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%liturgy%';
UPDATE "Event" SET "ministry" = 'Teaching Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%teaching ministry%';
UPDATE "Event" SET "ministry" = 'Word Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%word ministry%';
UPDATE "Event" SET "ministry" = 'Service Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%service ministry%';
UPDATE "Event" SET "ministry" = 'Treasury Ministry'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%treasury%';
UPDATE "Event" SET "ministry" = 'Secretariat Office'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%secretariat%';
UPDATE "Event" SET "ministry" = 'Technical Group'
WHERE "seriesCode" = 'WSC' AND "ministry" IS NULL AND lower("title") LIKE '%technical group%';

-- Index for attendance-monitoring range queries
CREATE INDEX "Event_seriesCode_startDate_idx" ON "Event"("seriesCode", "startDate");
