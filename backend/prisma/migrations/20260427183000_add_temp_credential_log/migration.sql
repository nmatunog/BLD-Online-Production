-- CreateTable
CREATE TABLE "TempCredentialLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "tempPassword" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TempCredentialLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TempCredentialLog_eventId_createdAt_idx" ON "TempCredentialLog"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "TempCredentialLog_expiresAt_idx" ON "TempCredentialLog"("expiresAt");

-- CreateIndex
CREATE INDEX "TempCredentialLog_communityId_idx" ON "TempCredentialLog"("communityId");

-- AddForeignKey
ALTER TABLE "TempCredentialLog" ADD CONSTRAINT "TempCredentialLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempCredentialLog" ADD CONSTRAINT "TempCredentialLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempCredentialLog" ADD CONSTRAINT "TempCredentialLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempCredentialLog" ADD CONSTRAINT "TempCredentialLog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
