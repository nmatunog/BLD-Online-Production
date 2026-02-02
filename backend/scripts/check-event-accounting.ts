import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkEventAccounting() {
  try {
    // Find events with "BBS" in the title
    console.log('🔍 Searching for events with "BBS" in title...\n');
    const events = await prisma.event.findMany({
      where: {
        title: {
          contains: 'BBS',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (events.length === 0) {
      console.log('❌ No events found with "BBS" in title');
      console.log('\n📋 Recent events:');
      const allEvents = await prisma.event.findMany({
        select: { id: true, title: true, startDate: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      allEvents.forEach((e) => {
        console.log(`   - "${e.title}" (ID: ${e.id})`);
      });
      return;
    }

    console.log(`✅ Found ${events.length} event(s):\n`);
    for (const event of events) {
      console.log(`📅 Event: "${event.title}"`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Start Date: ${event.startDate}`);
      
      // Check account
      const account = await prisma.eventAccount.findUnique({
        where: { eventId: event.id },
        include: {
          incomeEntries: {
            where: {
              description: {
                startsWith: '[DUMMY]',
              },
            },
          },
          expenseEntries: {
            where: {
              description: {
                startsWith: '[DUMMY]',
              },
            },
          },
          adjustmentEntries: {
            where: {
              description: {
                startsWith: '[DUMMY]',
              },
            },
          },
        },
      });

      if (!account) {
        console.log('   ⚠️  No account found');
      } else {
        console.log(`   ✅ Account exists (ID: ${account.id})`);
        console.log(`   Status: ${account.isClosed ? 'CLOSED' : 'OPEN'}`);
        console.log(`   Dummy Income Entries: ${account.incomeEntries.length}`);
        console.log(`   Dummy Expense Entries: ${account.expenseEntries.length}`);
        console.log(`   Dummy Adjustment Entries: ${account.adjustmentEntries.length}`);
        
        if (account.incomeEntries.length > 0) {
          console.log('\n   💰 Dummy Income Entries:');
          account.incomeEntries.forEach((entry) => {
            console.log(`      - ${entry.description}: ${entry.amount}`);
          });
        }
        
        if (account.expenseEntries.length > 0) {
          console.log('\n   💸 Dummy Expense Entries:');
          account.expenseEntries.forEach((entry) => {
            console.log(`      - ${entry.description}: ${entry.amount}`);
          });
        }
        
        if (account.adjustmentEntries.length > 0) {
          console.log('\n   ⚖️  Dummy Adjustment Entries:');
          account.adjustmentEntries.forEach((entry) => {
            console.log(`      - ${entry.description}: ${entry.amount}`);
          });
        }
      }
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkEventAccounting();
