import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    console.log('🔄 Resetting database...');
    
    // Delete in correct order (respecting foreign keys)
    await prisma.session.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.eventRegistration.deleteMany({});
    await prisma.incomeEntry.deleteMany({});
    await prisma.expenseEntry.deleteMany({});
    await prisma.eventAccount.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.user.deleteMany({});
    
    console.log('✅ Database reset complete!');
    console.log('📝 Next signup will be the first user and will become SUPER_USER');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();

