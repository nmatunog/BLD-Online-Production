-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "classNumber" INTEGER,
ADD COLUMN     "encounterType" TEXT;

-- CreateIndex
CREATE INDEX "Event_encounterType_classNumber_idx" ON "Event"("encounterType", "classNumber");
