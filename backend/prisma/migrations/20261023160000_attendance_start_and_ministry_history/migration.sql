-- Attendance start + ministry assignment history (additive, no backfill).
-- Community-level Member.attendanceStartDate is nullable; scoring falls back to
-- earliest Attendance.checkInTime (includes importedFrom rows), then createdAt.
-- Members without history rows use implicit current-ministry start = that fallback.

-- AlterTable
ALTER TABLE "Member" ADD COLUMN "attendanceStartDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MemberMinistryHistory" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "ministry" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberMinistryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberMinistryHistory_memberId_startDate_idx" ON "MemberMinistryHistory"("memberId", "startDate");

-- CreateIndex
CREATE INDEX "MemberMinistryHistory_ministry_startDate_idx" ON "MemberMinistryHistory"("ministry", "startDate");

-- AddForeignKey
ALTER TABLE "MemberMinistryHistory" ADD CONSTRAINT "MemberMinistryHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
