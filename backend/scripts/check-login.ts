import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkLogin(emailOrPhone: string) {
  try {
    console.log(`\n🔍 Checking login for: ${emailOrPhone}\n`);
    
    // Check if it's an email or phone
    const isEmail = emailOrPhone.includes('@');
    
    // Find user
    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: emailOrPhone }
        : { phone: emailOrPhone },
      include: { member: true },
    });
    
    if (!user) {
      console.log('❌ User NOT FOUND in database');
      console.log(`\n💡 Possible reasons:`);
      console.log(`   1. Database was reset and user was deleted`);
      console.log(`   2. Email/phone doesn't match exactly`);
      console.log(`   3. User was never created`);
      console.log(`\n✅ Solution: Create a new account or restore from backup\n`);
      
      // Check total user count
      const userCount = await prisma.user.count();
      console.log(`📊 Total users in database: ${userCount}`);
      
      if (userCount === 0) {
        console.log(`\n⚠️  DATABASE IS EMPTY - All users were deleted!`);
        console.log(`   You'll need to register a new account.`);
        console.log(`   The first user registered will become SUPER_USER.\n`);
      } else {
        console.log(`\n📋 Listing all users in database:`);
        const allUsers = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        
        allUsers.forEach((u, idx) => {
          console.log(`   ${idx + 1}. ${u.email || u.phone || 'N/A'} (${u.role}) - ${u.isActive ? 'Active' : 'Inactive'}`);
        });
      }
    } else {
      console.log('✅ User FOUND in database:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Phone: ${user.phone || 'N/A'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive ? 'Yes' : 'No'}`);
      console.log(`   Created: ${user.createdAt}`);
      
      if (user.member) {
        console.log(`   Member: ${user.member.firstName} ${user.member.lastName}`);
        console.log(`   Community ID: ${user.member.communityId}`);
      }
      
      if (!user.isActive) {
        console.log(`\n⚠️  WARNING: User account is DEACTIVATED`);
        console.log(`   This is why login is failing!\n`);
      } else {
        console.log(`\n💡 User exists and is active.`);
        console.log(`   If login is still failing, the password might be incorrect.`);
        console.log(`   Try resetting the password or use the correct password.\n`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email/phone from command line argument
const emailOrPhone = process.argv[2];

if (!emailOrPhone) {
  console.log('Usage: npx ts-node scripts/check-login.ts <email-or-phone>');
  console.log('Example: npx ts-node scripts/check-login.ts nmatunog@gmail.com');
  process.exit(1);
}

checkLogin(emailOrPhone);
