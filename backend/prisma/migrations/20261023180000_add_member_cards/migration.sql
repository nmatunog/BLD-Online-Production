-- Additive MemberCard table for NFC ID verification.
-- Timestamp 20261023180000 so this applies AFTER
-- 20261023160000_attendance_start_and_ministry_history (#59).
-- Safe for `prisma migrate deploy` on Railway (create-only; no destructive changes).

-- CreateEnum
CREATE TYPE "MemberCardStatus" AS ENUM ('ACTIVE', 'ENCODED', 'REVOKED');

-- CreateTable
CREATE TABLE "MemberCard" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "status" "MemberCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "encodedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "issuedByUserId" TEXT,
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberCard_tokenHash_key" ON "MemberCard"("tokenHash");

-- CreateIndex
CREATE INDEX "MemberCard_memberId_status_idx" ON "MemberCard"("memberId", "status");

-- CreateIndex
CREATE INDEX "MemberCard_status_idx" ON "MemberCard"("status");

-- CreateIndex
CREATE INDEX "MemberCard_lastVerifiedAt_idx" ON "MemberCard"("lastVerifiedAt");

-- CreateIndex
CREATE INDEX "MemberCard_encodedAt_idx" ON "MemberCard"("encodedAt");

-- AddForeignKey
ALTER TABLE "MemberCard" ADD CONSTRAINT "MemberCard_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
