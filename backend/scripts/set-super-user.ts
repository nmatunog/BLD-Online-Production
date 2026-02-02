/**
 * One-time script to set a user's role to SUPER_USER (e.g. after creating as ADMINISTRATOR).
 *
 * Usage (local with production DB URL):
 *   cd backend
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/set-super-user.ts
 *
 * Usage (Railway - run against production DB):
 *   cd backend
 *   railway run npx ts-node scripts/set-super-user.ts
 *
 * Or with email as first argument:
 *   DATABASE_URL="..." npx ts-node scripts/set-super-user.ts nmatunog@gmail.com
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const EMAIL = process.argv[2] || process.env.ADMIN_EMAIL || 'nmatunog@gmail.com';

async function setSuperUser() {
  try {
    console.log('Setting role to SUPER_USER for:', EMAIL);
    const user = await prisma.user.findFirst({
      where: { email: EMAIL },
    });
    if (!user) {
      console.error('User not found with email:', EMAIL);
      process.exit(1);
    }
    if (user.role === UserRole.SUPER_USER) {
      console.log('User already has role SUPER_USER.');
      process.exit(0);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.SUPER_USER },
    });
    console.log('Done. Role updated to SUPER_USER for', EMAIL);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setSuperUser();
