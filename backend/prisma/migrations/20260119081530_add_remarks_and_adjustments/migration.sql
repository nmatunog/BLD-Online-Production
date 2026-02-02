-- AlterTable
ALTER TABLE "ExpenseEntry" ADD COLUMN     "remarks" TEXT;

-- AlterTable
ALTER TABLE "IncomeEntry" ADD COLUMN     "remarks" TEXT;

-- CreateTable
CREATE TABLE "AdjustmentEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "remarks" TEXT,
    "adjustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdjustmentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdjustmentEntry_accountId_idx" ON "AdjustmentEntry"("accountId");

-- CreateIndex
CREATE INDEX "AdjustmentEntry_adjustedAt_idx" ON "AdjustmentEntry"("adjustedAt");

-- AddForeignKey
ALTER TABLE "AdjustmentEntry" ADD CONSTRAINT "AdjustmentEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EventAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
