-- CreateEnum
CREATE TYPE "CashAdvanceStatus" AS ENUM ('OUTSTANDING', 'LIQUIDATED');

-- CreateEnum
CREATE TYPE "LiquidationStatus" AS ENUM ('DRAFT', 'APPROVED');

-- AlterTable
ALTER TABLE "ExpenseEntry" ADD COLUMN     "liquidationLineId" TEXT;

-- CreateTable
CREATE TABLE "CashAdvance" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "disbursedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payeeName" TEXT,
    "referenceNumber" TEXT,
    "notation" TEXT,
    "status" "CashAdvanceStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liquidation" (
    "id" TEXT NOT NULL,
    "cashAdvanceId" TEXT NOT NULL,
    "status" "LiquidationStatus" NOT NULL DEFAULT 'DRAFT',
    "notation" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Liquidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidationLine" (
    "id" TEXT NOT NULL,
    "liquidationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "category" TEXT,
    "orVoucherNumber" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "LiquidationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoredDisbursement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "label" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "disbursedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payeeName" TEXT,
    "referenceNumber" TEXT,
    "notation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoredDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashAdvance_accountId_idx" ON "CashAdvance"("accountId");

-- CreateIndex
CREATE INDEX "Liquidation_cashAdvanceId_idx" ON "Liquidation"("cashAdvanceId");

-- CreateIndex
CREATE INDEX "LiquidationLine_liquidationId_idx" ON "LiquidationLine"("liquidationId");

-- CreateIndex
CREATE INDEX "MonitoredDisbursement_accountId_idx" ON "MonitoredDisbursement"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEntry_liquidationLineId_key" ON "ExpenseEntry"("liquidationLineId");

-- AddForeignKey
ALTER TABLE "CashAdvance" ADD CONSTRAINT "CashAdvance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EventAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidation" ADD CONSTRAINT "Liquidation_cashAdvanceId_fkey" FOREIGN KEY ("cashAdvanceId") REFERENCES "CashAdvance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidationLine" ADD CONSTRAINT "LiquidationLine_liquidationId_fkey" FOREIGN KEY ("liquidationId") REFERENCES "Liquidation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredDisbursement" ADD CONSTRAINT "MonitoredDisbursement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EventAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_liquidationLineId_fkey" FOREIGN KEY ("liquidationLineId") REFERENCES "LiquidationLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
