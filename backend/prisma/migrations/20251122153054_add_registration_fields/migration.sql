-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "coupleRegistrationId" TEXT,
ADD COLUMN     "coupleRole" TEXT,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "memberCommunityId" TEXT,
ADD COLUMN     "specialRequirements" TEXT,
ADD COLUMN     "spouseMiddleName" TEXT;

-- CreateIndex
CREATE INDEX "EventRegistration_coupleRegistrationId_idx" ON "EventRegistration"("coupleRegistrationId");
