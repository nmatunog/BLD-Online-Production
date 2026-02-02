-- AlterTable
ALTER TABLE "AdjustmentEntry" ADD COLUMN     "orVoucherNumber" TEXT;

-- AlterTable
ALTER TABLE "ExpenseEntry" ADD COLUMN     "orVoucherNumber" TEXT;

-- AlterTable
ALTER TABLE "IncomeEntry" ADD COLUMN     "orVoucherNumber" TEXT;
