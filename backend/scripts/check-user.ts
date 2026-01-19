import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findFirst({
      include: { member: true },
      orderBy: { createdAt: 'desc' },
    });
    
    if (user) {
      console.log('✅ User found:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email || 'N/A'}`);
      console.log(`  Phone: ${user.phone || 'N/A'}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Created: ${user.createdAt}`);
      if (user.member) {
        console.log(`  Member Community ID: ${user.member.communityId}`);
        console.log(`  Member Name: ${user.member.firstName} ${user.member.lastName}`);
      }
      console.log('');
      if (user.role === 'SUPER_USER') {
        console.log('✅ SUCCESS: First user is SUPER_USER as expected!');
      } else {
        console.log('⚠️  WARNING: First user is NOT SUPER_USER');
      }
    } else {
      console.log('❌ No user found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
