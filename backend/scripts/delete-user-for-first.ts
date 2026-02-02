/**
 * Delete a user so you can re-register as the "first user" and get SUPER_USER automatically.
 * The backend assigns SUPER_USER when userCount === 0 at registration time.
 *
 * Usage (local with production DB URL):
 *   cd backend
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/delete-user-for-first.ts your@email.com
 *
 * Usage (Railway - run against production DB):
 *   cd backend
 *   railway run npx ts-node scripts/delete-user-for-first.ts your@email.com
 *
 * Then register again (same or new email) — you'll be the first user and get Super User.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMAIL = process.argv[2] || process.env.ADMIN_EMAIL;

async function deleteUserForFirst() {
  if (!EMAIL) {
    console.error('Usage: npx ts-node scripts/delete-user-for-first.ts <email>');
    console.error('   or: ADMIN_EMAIL=your@email.com npx ts-node scripts/delete-user-for-first.ts');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: EMAIL },
      include: { member: true },
    });

    if (!user) {
      console.error('User not found with email:', EMAIL);
      process.exit(1);
    }

    console.log('Deleting user:', EMAIL, '(member:', user.member?.firstName, user.member?.lastName, ')');
    // Cascade deletes Member, Session, EventClassShepherd
    await prisma.user.delete({ where: { id: user.id } });

    const remaining = await prisma.user.count();
    console.log('Done. User deleted.');
    console.log('Remaining users in DB:', remaining);
    if (remaining === 0) {
      console.log('Next person to register will get Super User automatically.');
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUserForFirst();
