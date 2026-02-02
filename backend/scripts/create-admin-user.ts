/**
 * One-time script to create the first admin user for production
 * 
 * Usage:
 *   DATABASE_URL="your-production-db-url" npx ts-node scripts/create-admin-user.ts
 * 
 * This script will:
 * 1. Create a user account
 * 2. Create an associated member profile
 * 3. Set the user role to ADMINISTRATOR
 * 
 * WARNING: Only run this once for initial setup!
 */

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createAdminUser() {
  try {
    console.log('🔐 Creating Admin User for Production\n');
    console.log('='.repeat(60));

    // Get user input
    const email = await question('Email: ');
    if (!email || !email.includes('@')) {
      throw new Error('Valid email is required');
    }

    const phone = await question('Phone (optional, press Enter to skip): ');
    const password = await question('Password: ');
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const confirmPassword = await question('Confirm Password: ');
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    const firstName = await question('First Name: ');
    if (!firstName) {
      throw new Error('First Name is required');
    }

    const lastName = await question('Last Name: ');
    if (!lastName) {
      throw new Error('Last Name is required');
    }

    const nickname = await question('Nickname (optional, press Enter to skip): ');

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          ...(phone ? [{ phone: phone.replace(/\D/g, '') }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new Error('User with this email or phone already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    console.log('\n📝 Creating user...');
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        phone: phone ? phone.replace(/\D/g, '') : null,
        passwordHash: hashedPassword,
        role: UserRole.ADMINISTRATOR,
        isActive: true,
      },
    });

    console.log('✅ User created:', user.id);

    // Generate a unique community ID for admin
    // Format: ADMIN-{timestamp}-{random}
    const communityId = `ADMIN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Create member profile
    // Note: Member model requires communityId, city, encounterType, and classNumber
    // For admin users, we'll use placeholder values
    console.log('📝 Creating member profile...');
    const member = await prisma.member.create({
      data: {
        userId: user.id,
        firstName,
        lastName,
        nickname: nickname || null,
        communityId: communityId,
        city: 'Cebu', // Default city
        encounterType: 'ADMIN', // Special type for admin
        classNumber: 0, // Placeholder for admin
      },
    });

    console.log('✅ Member profile created:', member.id);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Admin user created successfully!');
    console.log('\n📋 Details:');
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${firstName} ${lastName}`);
    console.log(`   Role: ${UserRole.ADMINISTRATOR}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Member ID: ${member.id}`);
    console.log('\n💡 You can now log in with this account.');
    console.log('⚠️  Remember to delete this script or restrict access after use!');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createAdminUser();
