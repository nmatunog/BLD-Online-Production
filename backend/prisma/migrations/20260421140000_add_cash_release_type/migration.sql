-- CreateEnum
CREATE TYPE "CashReleaseType" AS ENUM ('CASH_ADVANCE', 'REIMBURSEMENT', 'PURCHASE', 'PETTY_CASH', 'SUPPLIES', 'HONORARIUM', 'TRANSPORT', 'OTHER');

-- AlterTable
ALTER TABLE "CashAdvance" ADD COLUMN "releaseType" "CashReleaseType" NOT NULL DEFAULT 'CASH_ADVANCE';

-- AlterTable
ALTER TABLE "MonitoredDisbursement" ADD COLUMN "releaseType" "CashReleaseType" NOT NULL DEFAULT 'OTHER';
