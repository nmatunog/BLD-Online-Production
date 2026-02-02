/**
 * Script to identify and optionally remove dummy data from the database
 * 
 * WARNING: This script can delete data. Use with caution!
 * Only run this in development/staging environments.
 * 
 * Usage:
 *   npx ts-node scripts/cleanup-dummy-data.ts [--dry-run] [--delete]
 * 
 * Options:
 *   --dry-run: Show what would be deleted without actually deleting
 *   --delete: Actually delete the dummy data (requires confirmation)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DummyDataCounts {
  events: number;
  members: number;
  registrations: number;
  attendances: number;
  incomeEntries: number;
  expenseEntries: number;
  adjustmentEntries: number;
}

async function findDummyData(): Promise<DummyDataCounts> {
  console.log('🔍 Scanning for dummy data...\n');

  // Find events with [DUMMY] in title or description
  const dummyEvents = await prisma.event.findMany({
    where: {
      OR: [
        { title: { contains: '[DUMMY]', mode: 'insensitive' } },
        { description: { contains: '[DUMMY]', mode: 'insensitive' } },
      ],
    },
    select: { id: true, title: true },
  });

  // Find members with [DUMMY] in name or communityId
  const dummyMembers = await prisma.member.findMany({
    where: {
      OR: [
        { firstName: { contains: '[DUMMY]', mode: 'insensitive' } },
        { lastName: { contains: '[DUMMY]', mode: 'insensitive' } },
        { communityId: { contains: 'DUMMY', mode: 'insensitive' } },
      ],
    },
    select: { id: true, communityId: true, firstName: true, lastName: true },
  });

  // Find registrations for dummy events or members
  const dummyRegistrations = await prisma.eventRegistration.findMany({
    where: {
      OR: [
        { eventId: { in: dummyEvents.map(e => e.id) } },
        { memberId: { in: dummyMembers.map(m => m.id) } },
      ],
    },
    select: { id: true },
  });

  // Find attendances for dummy events or members
  const dummyAttendances = await prisma.attendance.findMany({
    where: {
      OR: [
        { eventId: { in: dummyEvents.map(e => e.id) } },
        { memberId: { in: dummyMembers.map(m => m.id) } },
      ],
    },
    select: { id: true },
  });

  // Find accounting entries with [DUMMY] in description
  const dummyIncomeEntries = await prisma.incomeEntry.findMany({
    where: {
      description: { contains: '[DUMMY]', mode: 'insensitive' },
    },
    select: { id: true },
  });

  const dummyExpenseEntries = await prisma.expenseEntry.findMany({
    where: {
      description: { contains: '[DUMMY]', mode: 'insensitive' },
    },
    select: { id: true },
  });

  const dummyAdjustmentEntries = await prisma.adjustmentEntry.findMany({
    where: {
      description: { contains: '[DUMMY]', mode: 'insensitive' },
    },
    select: { id: true },
  });

  return {
    events: dummyEvents.length,
    members: dummyMembers.length,
    registrations: dummyRegistrations.length,
    attendances: dummyAttendances.length,
    incomeEntries: dummyIncomeEntries.length,
    expenseEntries: dummyExpenseEntries.length,
    adjustmentEntries: dummyAdjustmentEntries.length,
  };
}

async function deleteDummyData(dryRun: boolean): Promise<void> {
  console.log(dryRun ? '🔍 DRY RUN - No data will be deleted\n' : '⚠️  DELETING DUMMY DATA\n');

  // Delete in reverse order of dependencies
  const counts = await findDummyData();

  if (dryRun) {
    console.log('📊 Would delete:');
    console.log(`   - ${counts.adjustmentEntries} adjustment entries`);
    console.log(`   - ${counts.expenseEntries} expense entries`);
    console.log(`   - ${counts.incomeEntries} income entries`);
    console.log(`   - ${counts.attendances} attendance records`);
    console.log(`   - ${counts.registrations} registrations`);
    console.log(`   - ${counts.members} members`);
    console.log(`   - ${counts.events} events`);
    return;
  }

  // Delete accounting entries
  if (counts.adjustmentEntries > 0) {
    await prisma.adjustmentEntry.deleteMany({
      where: {
        description: { contains: '[DUMMY]', mode: 'insensitive' },
      },
    });
    console.log(`✅ Deleted ${counts.adjustmentEntries} adjustment entries`);
  }

  if (counts.expenseEntries > 0) {
    await prisma.expenseEntry.deleteMany({
      where: {
        description: { contains: '[DUMMY]', mode: 'insensitive' },
      },
    });
    console.log(`✅ Deleted ${counts.expenseEntries} expense entries`);
  }

  if (counts.incomeEntries > 0) {
    await prisma.incomeEntry.deleteMany({
      where: {
        description: { contains: '[DUMMY]', mode: 'insensitive' },
      },
    });
    console.log(`✅ Deleted ${counts.incomeEntries} income entries`);
  }

  // Delete attendances
  const dummyEvents = await prisma.event.findMany({
    where: {
      OR: [
        { title: { contains: '[DUMMY]', mode: 'insensitive' } },
        { description: { contains: '[DUMMY]', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  const dummyMembers = await prisma.member.findMany({
    where: {
      OR: [
        { firstName: { contains: '[DUMMY]', mode: 'insensitive' } },
        { lastName: { contains: '[DUMMY]', mode: 'insensitive' } },
        { communityId: { contains: 'DUMMY', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  if (counts.attendances > 0) {
    await prisma.attendance.deleteMany({
      where: {
        OR: [
          { eventId: { in: dummyEvents.map(e => e.id) } },
          { memberId: { in: dummyMembers.map(m => m.id) } },
        ],
      },
    });
    console.log(`✅ Deleted ${counts.attendances} attendance records`);
  }

  // Delete registrations
  if (counts.registrations > 0) {
    await prisma.eventRegistration.deleteMany({
      where: {
        OR: [
          { eventId: { in: dummyEvents.map(e => e.id) } },
          { memberId: { in: dummyMembers.map(m => m.id) } },
        ],
      },
    });
    console.log(`✅ Deleted ${counts.registrations} registrations`);
  }

  // Delete members (and their associated users)
  if (counts.members > 0) {
    const memberIds = dummyMembers.map(m => m.id);
    // Delete members (cascade will handle related data)
    await prisma.member.deleteMany({
      where: { id: { in: memberIds } },
    });
    console.log(`✅ Deleted ${counts.members} members`);
  }

  // Delete events
  if (counts.events > 0) {
    await prisma.event.deleteMany({
      where: {
        OR: [
          { title: { contains: '[DUMMY]', mode: 'insensitive' } },
          { description: { contains: '[DUMMY]', mode: 'insensitive' } },
        ],
      },
    });
    console.log(`✅ Deleted ${counts.events} events`);
  }

  console.log('\n✅ Dummy data cleanup complete!');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const deleteFlag = args.includes('--delete');

  try {
    if (dryRun) {
      await deleteDummyData(true);
    } else if (deleteFlag) {
      console.log('⚠️  WARNING: This will delete all dummy data!');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await deleteDummyData(false);
    } else {
      const counts = await findDummyData();
      console.log('📊 Dummy data found:');
      console.log(`   - ${counts.events} events`);
      console.log(`   - ${counts.members} members`);
      console.log(`   - ${counts.registrations} registrations`);
      console.log(`   - ${counts.attendances} attendance records`);
      console.log(`   - ${counts.incomeEntries} income entries`);
      console.log(`   - ${counts.expenseEntries} expense entries`);
      console.log(`   - ${counts.adjustmentEntries} adjustment entries`);
      console.log('\n💡 To see what would be deleted: npx ts-node scripts/cleanup-dummy-data.ts --dry-run');
      console.log('💡 To actually delete: npx ts-node scripts/cleanup-dummy-data.ts --delete');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
