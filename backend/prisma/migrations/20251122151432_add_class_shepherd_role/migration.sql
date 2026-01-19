-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CLASS_SHEPHERD';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ministry" TEXT,
ADD COLUMN     "shepherdClassNumber" INTEGER,
ADD COLUMN     "shepherdEncounterType" TEXT;

-- CreateIndex
CREATE INDEX "User_shepherdEncounterType_shepherdClassNumber_idx" ON "User"("shepherdEncounterType", "shepherdClassNumber");
