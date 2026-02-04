/**
 * Wipe all data from the database (production or local).
 * Use this to start from scratch so the next user to register becomes Super User.
 *
 * Usage (production - use public DATABASE_URL from Railway):
 *   cd backend
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/reset-production-data.ts
 *
 * Usage (with confirmation prompt):
 *   DATABASE_URL="..." npx ts-node scripts/reset-production-data.ts --confirm
 *
 * Without --confirm, the script will print what it would do and exit.
 * With --confirm, it will delete all data.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const confirmed = process.argv.includes('--confirm');

async function reset() {
  console.log('Database reset script');
  console.log('=====================');

  if (!confirmed) {
    console.log('\nThis would delete ALL data: users, members, events, attendance, registrations, accounting.');
    console.log('Run with --confirm to actually perform the reset:');
    console.log('  npx ts-node scripts/reset-production-data.ts --confirm\n');
    process.exit(0);
  }

  try {
    // Order: children first, then parents (respect FK constraints)
    console.log('Deleting IncomeEntry, ExpenseEntry, AdjustmentEntry...');
    await prisma.incomeEntry.deleteMany({});
    await prisma.expenseEntry.deleteMany({});
    await prisma.adjustmentEntry.deleteMany({});

    console.log('Deleting EventAccount...');
    await prisma.eventAccount.deleteMany({});

    console.log('Deleting Attendance...');
    await prisma.attendance.deleteMany({});

    console.log('Deleting EventRegistration...');
    await prisma.eventRegistration.deleteMany({});

    console.log('Deleting EventClassShepherd...');
    await prisma.eventClassShepherd.deleteMany({});

    console.log('Deleting Session...');
    await prisma.session.deleteMany({});

    console.log('Deleting Member...');
    await prisma.member.deleteMany({});

    console.log('Deleting User...');
    await prisma.user.deleteMany({});

    console.log('Deleting Event...');
    await prisma.event.deleteMany({});

    const userCount = await prisma.user.count();
    const memberCount = await prisma.member.count();
    const eventCount = await prisma.event.count();

    console.log('\nDone. Counts: users=%d, members=%d, events=%d', userCount, memberCount, eventCount);
    console.log('Next person to register will become Super User.\n');
  } catch (e) {
    console.error('Reset failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reset();
