-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "sessionSlot" TEXT NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX IF EXISTS "Attendance_memberId_eventId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_memberId_eventId_sessionSlot_key" ON "Attendance"("memberId", "eventId", "sessionSlot");
