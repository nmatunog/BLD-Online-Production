-- CreateEnum
CREATE TYPE "EventAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "EventAuditLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "action" "EventAuditAction" NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousSnapshot" JSONB,
    "changedFields" JSONB,
    "restoredAt" TIMESTAMP(3),
    "restoredBy" TEXT,

    CONSTRAINT "EventAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventAuditLog_eventId_idx" ON "EventAuditLog"("eventId");

-- CreateIndex
CREATE INDEX "EventAuditLog_userId_idx" ON "EventAuditLog"("userId");

-- CreateIndex
CREATE INDEX "EventAuditLog_performedAt_idx" ON "EventAuditLog"("performedAt");

-- CreateIndex
CREATE INDEX "EventAuditLog_action_idx" ON "EventAuditLog"("action");

-- AddForeignKey
ALTER TABLE "EventAuditLog" ADD CONSTRAINT "EventAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
