-- AlterTable
ALTER TABLE "Member" ADD COLUMN "bloodType" TEXT;

-- Comment: Blood type is optional. Allowed values when set: A+, A-, B+, B-, AB+, AB-, O+, O-. NULL = unknown/skipped.
