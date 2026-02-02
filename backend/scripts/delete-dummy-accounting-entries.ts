import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function deleteDummyEntries() {
  try {
    // Find the event "BBS -01"
    const event = await prisma.event.findFirst({
      where: {
        title: {
          contains: 'BBS -01',
          mode: 'insensitive',
        },
      },
    });

    if (!event) {
      console.log('❌ Event "BBS -01" not found');
      return;
    }

    console.log(`✅ Found event: ${event.title} (ID: ${event.id})`);

    // Get event account
    const account = await prisma.eventAccount.findUnique({
      where: { eventId: event.id },
    });

    if (!account) {
      console.log('❌ Event account not found');
      return;
    }

    // Delete all dummy entries
    console.log('\n🗑️  Deleting dummy entries...');
    const deletedIncome = await prisma.incomeEntry.deleteMany({
      where: {
        accountId: account.id,
        description: {
          startsWith: '[DUMMY]',
        },
      },
    });
    const deletedExpense = await prisma.expenseEntry.deleteMany({
      where: {
        accountId: account.id,
        description: {
          startsWith: '[DUMMY]',
        },
      },
    });
    const deletedAdjustment = await prisma.adjustmentEntry.deleteMany({
      where: {
        accountId: account.id,
        description: {
          startsWith: '[DUMMY]',
        },
      },
    });

    console.log(`✅ Deleted ${deletedIncome.count} income entries`);
    console.log(`✅ Deleted ${deletedExpense.count} expense entries`);
    console.log(`✅ Deleted ${deletedAdjustment.count} adjustment entries`);
    console.log('\n✅ All dummy entries deleted successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteDummyEntries();
