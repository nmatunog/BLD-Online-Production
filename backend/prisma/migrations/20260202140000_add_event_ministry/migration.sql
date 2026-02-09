-- AlterTable
ALTER TABLE "Event" ADD COLUMN "ministry" TEXT;

-- CreateIndex
CREATE INDEX "Event_ministry_idx" ON "Event"("ministry");
