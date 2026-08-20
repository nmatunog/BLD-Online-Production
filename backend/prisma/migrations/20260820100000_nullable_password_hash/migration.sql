-- Allow members to register without credentials (attendance-only signup).
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
