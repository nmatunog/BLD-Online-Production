import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function createDummyEntries() {
  try {
    // Find the event "BBS -01" or "BBS-01" (try different formats)
    let event = await prisma.event.findFirst({
      where: {
        title: {
          contains: 'BBS',
          mode: 'insensitive',
        },
      },
    });

    // If not found, try exact match variations
    if (!event) {
      event = await prisma.event.findFirst({
        where: {
          OR: [
            { title: { contains: 'BBS -01', mode: 'insensitive' } },
            { title: { contains: 'BBS-01', mode: 'insensitive' } },
            { title: { contains: 'BBS 01', mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!event) {
      console.log('❌ Event "BBS -01" not found');
      console.log('📋 Available events:');
      const allEvents = await prisma.event.findMany({
        select: { id: true, title: true, startDate: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      allEvents.forEach((e) => {
        console.log(`   - ${e.title} (ID: ${e.id})`);
      });
      return;
    }

    console.log(`✅ Found event: ${event.title} (ID: ${event.id})`);

    // Get or create event account
    let account = await prisma.eventAccount.findUnique({
      where: { eventId: event.id },
    });

    if (!account) {
      console.log('📝 Creating event account...');
      account = await prisma.eventAccount.create({
        data: { eventId: event.id },
      });
      console.log('✅ Event account created');
    } else {
      console.log('✅ Event account exists');
    }

    // Check if account is closed
    if (account.isClosed) {
      console.log('⚠️  Account is closed. Reopening it...');
      await prisma.eventAccount.update({
        where: { id: account.id },
        data: { isClosed: false, closedAt: null },
      });
      console.log('✅ Account reopened');
    }

    // Delete existing dummy entries (optional - comment out if you want to keep existing)
    console.log('\n🗑️  Cleaning up existing dummy entries...');
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
    console.log(`   Deleted ${deletedIncome.count} income entries`);
    console.log(`   Deleted ${deletedExpense.count} expense entries`);
    console.log(`   Deleted ${deletedAdjustment.count} adjustment entries`);

    // Create dummy income entries
    console.log('\n💰 Creating dummy income entries...');
    const incomeEntries = [
      {
        description: '[DUMMY] Registration fees from participants',
        amount: 15000.00,
        source: 'Registration Fees',
        remarks: 'Payment received early',
        receivedAt: new Date(event.startDate),
      },
      {
        description: '[DUMMY] Sponsorship from local business',
        amount: 5000.00,
        source: 'Sponsorship',
        remarks: 'Corporate sponsor',
        receivedAt: new Date(new Date(event.startDate).getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before
      },
      {
        description: '[DUMMY] Donation from community member',
        amount: 2000.00,
        source: 'Donations',
        remarks: 'Anonymous donation',
        receivedAt: new Date(new Date(event.startDate).getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day before
      },
      {
        description: '[DUMMY] Merchandise sales',
        amount: 3500.00,
        source: 'Merchandise',
        remarks: 'T-shirt sales',
        receivedAt: new Date(event.startDate),
      },
    ];

    for (const entry of incomeEntries) {
      await prisma.incomeEntry.create({
        data: {
          accountId: account.id,
          ...entry,
        },
      });
      console.log(`   ✓ ${entry.description} - ${entry.amount.toFixed(2)}`);
    }

    // Create dummy expense entries
    console.log('\n💸 Creating dummy expense entries...');
    const expenseEntries = [
      {
        description: '[DUMMY] Venue rental fee',
        amount: 8000.00,
        category: 'Venue',
        remarks: 'Full day rental',
        paidAt: new Date(new Date(event.startDate).getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days before
      },
      {
        description: '[DUMMY] Catering services',
        amount: 12000.00,
        category: 'Food & Beverage',
        remarks: 'Lunch and snacks',
        paidAt: new Date(new Date(event.startDate).getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
      },
      {
        description: '[DUMMY] Sound system rental',
        amount: 3000.00,
        category: 'Equipment',
        remarks: 'Audio equipment',
        paidAt: new Date(new Date(event.startDate).getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before
      },
      {
        description: '[DUMMY] Transportation costs',
        amount: 2500.00,
        category: 'Transportation',
        remarks: 'Bus rental',
        paidAt: new Date(new Date(event.startDate).getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day before
      },
      {
        description: '[DUMMY] Printing and materials',
        amount: 1500.00,
        category: 'Materials',
        remarks: 'Programs and handouts',
        paidAt: new Date(event.startDate),
      },
    ];

    for (const entry of expenseEntries) {
      await prisma.expenseEntry.create({
        data: {
          accountId: account.id,
          ...entry,
        },
      });
      console.log(`   ✓ ${entry.description} - ${entry.amount.toFixed(2)}`);
    }

    // Create dummy adjustment entries
    console.log('\n⚖️  Creating dummy adjustment entries...');
    const adjustmentEntries = [
      {
        description: '[DUMMY] Balance correction',
        amount: -500.00,
        remarks: 'Refund adjustment',
        adjustedAt: new Date(event.startDate),
      },
      {
        description: '[DUMMY] Late fee adjustment',
        amount: 200.00,
        remarks: 'Late registration fee',
        adjustedAt: new Date(event.startDate),
      },
    ];

    for (const entry of adjustmentEntries) {
      await prisma.adjustmentEntry.create({
        data: {
          accountId: account.id,
          ...entry,
        },
      });
      console.log(`   ✓ ${entry.description} - ${entry.amount.toFixed(2)}`);
    }

    // Calculate totals
    const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
    const totalAdjustments = adjustmentEntries.reduce((sum, e) => sum + e.amount, 0);
    const netBalance = totalIncome - totalExpenses + totalAdjustments;

    console.log('\n📊 Summary:');
    console.log(`   Total Income: ${totalIncome.toFixed(2)}`);
    console.log(`   Total Expenses: ${totalExpenses.toFixed(2)}`);
    console.log(`   Total Adjustments: ${totalAdjustments.toFixed(2)}`);
    console.log(`   Net Balance: ${netBalance.toFixed(2)}`);
    console.log(`   Status: ${netBalance >= 0 ? 'SURPLUS' : 'DEFICIT'}`);

    console.log('\n✅ Dummy entries created successfully!');
    console.log('💡 All entries are marked with [DUMMY] prefix for easy identification and deletion.');
    
    // Verify entries were created
    console.log('\n🔍 Verifying entries...');
    const verifyAccount = await prisma.eventAccount.findUnique({
      where: { id: account.id },
      include: {
        incomeEntries: {
          where: { description: { startsWith: '[DUMMY]' } },
        },
        expenseEntries: {
          where: { description: { startsWith: '[DUMMY]' } },
        },
        adjustmentEntries: {
          where: { description: { startsWith: '[DUMMY]' } },
        },
      },
    });
    
    console.log(`   Income entries: ${verifyAccount?.incomeEntries.length || 0}`);
    console.log(`   Expense entries: ${verifyAccount?.expenseEntries.length || 0}`);
    console.log(`   Adjustment entries: ${verifyAccount?.adjustmentEntries.length || 0}`);
    
    if (verifyAccount && (verifyAccount.incomeEntries.length > 0 || verifyAccount.expenseEntries.length > 0)) {
      console.log('\n✅ Verification successful! Entries are in the database.');
      console.log('💡 Refresh the Event Accounting page in your browser to see them.');
    } else {
      console.log('\n⚠️  Warning: Entries may not have been created. Check the error messages above.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createDummyEntries();
