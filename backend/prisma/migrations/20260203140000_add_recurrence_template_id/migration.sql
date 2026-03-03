-- AlterTable
ALTER TABLE "Event" ADD COLUMN "recurrenceTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "Event_recurrenceTemplateId_idx" ON "Event"("recurrenceTemplateId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_recurrenceTemplateId_fkey" FOREIGN KEY ("recurrenceTemplateId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
