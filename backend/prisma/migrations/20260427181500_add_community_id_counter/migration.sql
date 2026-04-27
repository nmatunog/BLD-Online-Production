-- CreateTable
CREATE TABLE "CommunityIdCounter" (
    "cityCode" TEXT NOT NULL,
    "encounterCode" TEXT NOT NULL,
    "classNumber" INTEGER NOT NULL,
    "nextSequence" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityIdCounter_pkey" PRIMARY KEY ("cityCode","encounterCode","classNumber")
);

-- Backfill counters from existing Member community IDs.
-- Keeps output format unchanged (e.g. CEB-SE3901) while making future allocation atomic.
WITH parsed AS (
    SELECT
        (m)[1] AS "cityCode",
        (m)[2] AS "encounterCode",
        ((m)[3])::int AS "classNumber",
        ((m)[4])::int AS "sequence"
    FROM (
        SELECT regexp_match(upper("communityId"), '^([A-Z]{3})-([A-Z]{1,4})(\d{2,3})(\d{2})$') AS m
        FROM "Member"
    ) s
    WHERE m IS NOT NULL
),
agg AS (
    SELECT
        "cityCode",
        "encounterCode",
        "classNumber",
        MAX("sequence") AS "maxSequence"
    FROM parsed
    GROUP BY "cityCode", "encounterCode", "classNumber"
)
INSERT INTO "CommunityIdCounter" (
    "cityCode",
    "encounterCode",
    "classNumber",
    "nextSequence",
    "createdAt",
    "updatedAt"
)
SELECT
    "cityCode",
    "encounterCode",
    "classNumber",
    "maxSequence" + 1,
    NOW(),
    NOW()
FROM agg
ON CONFLICT ("cityCode","encounterCode","classNumber")
DO UPDATE
SET
    "nextSequence" = GREATEST("CommunityIdCounter"."nextSequence", EXCLUDED."nextSequence"),
    "updatedAt" = NOW();
