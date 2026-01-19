import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkPhoneFormats() {
  try {
    const users = await prisma.user.findMany({
      where: { phone: { not: null } },
      select: { id: true, phone: true, email: true },
    });
    
    console.log(`Found ${users.length} users with phone numbers:\n`);
    users.forEach((user, idx) => {
      console.log(`${idx + 1}. Phone: ${user.phone}, Email: ${user.email || 'N/A'}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhoneFormats();
