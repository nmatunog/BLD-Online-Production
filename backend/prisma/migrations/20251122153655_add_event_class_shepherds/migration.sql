-- CreateTable
CREATE TABLE "EventClassShepherd" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encounterType" TEXT NOT NULL,
    "classNumber" INTEGER NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventClassShepherd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventClassShepherd_eventId_idx" ON "EventClassShepherd"("eventId");

-- CreateIndex
CREATE INDEX "EventClassShepherd_userId_idx" ON "EventClassShepherd"("userId");

-- CreateIndex
CREATE INDEX "EventClassShepherd_encounterType_classNumber_idx" ON "EventClassShepherd"("encounterType", "classNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EventClassShepherd_eventId_userId_encounterType_classNumber_key" ON "EventClassShepherd"("eventId", "userId", "encounterType", "classNumber");

-- AddForeignKey
ALTER TABLE "EventClassShepherd" ADD CONSTRAINT "EventClassShepherd_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventClassShepherd" ADD CONSTRAINT "EventClassShepherd_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
