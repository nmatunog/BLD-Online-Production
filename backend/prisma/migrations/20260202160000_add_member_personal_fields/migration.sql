-- AlterTable
ALTER TABLE "Member" ADD COLUMN "gender" TEXT;
ALTER TABLE "Member" ADD COLUMN "profession" TEXT;
ALTER TABLE "Member" ADD COLUMN "civilStatus" TEXT;
ALTER TABLE "Member" ADD COLUMN "dateOfBirth" TEXT;
ALTER TABLE "Member" ADD COLUMN "spouseName" TEXT;
ALTER TABLE "Member" ADD COLUMN "dateOfMarriage" TEXT;
ALTER TABLE "Member" ADD COLUMN "numberOfChildren" INTEGER;
ALTER TABLE "Member" ADD COLUMN "children" JSONB;
ALTER TABLE "Member" ADD COLUMN "dateOfEncounter" TEXT;
