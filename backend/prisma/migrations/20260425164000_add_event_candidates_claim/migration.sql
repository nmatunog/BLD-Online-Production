-- CreateEnum
CREATE TYPE "EventCandidateStatus" AS ENUM ('IMPORTED', 'CLAIMED', 'REGISTERED', 'REJECTED');

-- CreateTable
CREATE TABLE "EventCandidate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "classGroup" TEXT,
    "classShepherds" TEXT,
    "candidateClass" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "mobileNumber" TEXT,
    "cleanMobile" TEXT,
    "cmpATaken" TEXT,
    "candidateClassNorm" TEXT NOT NULL,
    "familyNameNorm" TEXT NOT NULL,
    "firstNameNorm" TEXT NOT NULL,
    "status" "EventCandidateStatus" NOT NULL DEFAULT 'IMPORTED',
    "claimedAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3),
    "memberId" TEXT,
    "registrationId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventCandidate_eventId_status_idx" ON "EventCandidate"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventCandidate_candidateClassNorm_familyNameNorm_firstNameNorm_idx" ON "EventCandidate"("candidateClassNorm", "familyNameNorm", "firstNameNorm");

-- CreateIndex
CREATE INDEX "EventCandidate_cleanMobile_idx" ON "EventCandidate"("cleanMobile");

-- CreateIndex
CREATE UNIQUE INDEX "EventCandidate_eventId_candidateClassNorm_familyNameNorm_firstNameNorm_cleanMobile_key" ON "EventCandidate"("eventId", "candidateClassNorm", "familyNameNorm", "firstNameNorm", "cleanMobile");

-- AddForeignKey
ALTER TABLE "EventCandidate" ADD CONSTRAINT "EventCandidate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCandidate" ADD CONSTRAINT "EventCandidate_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCandidate" ADD CONSTRAINT "EventCandidate_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
