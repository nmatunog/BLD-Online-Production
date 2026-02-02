import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Create dummy members with different ministries and apostolates
 * Ministries: Management Services, Service Ministry, PLSG, Intercessory
 * Apostolates: Various apostolates
 */
async function createDummyMembersWithMinistries() {
  try {
    console.log('👥 Creating dummy members with ministries and apostolates...\n');

    const ministries = ['Management Services', 'Service Ministry', 'PLSG', 'Intercessory'];
    const apostolates = ['Teaching', 'Music', 'Youth', 'Couples', 'Singles', 'Family'];
    const cities = ['CEBU', 'MANDAUE', 'LAPU-LAPU', 'TALISAY'];
    const encounterTypes = ['ME', 'SE', 'FE', 'YE'];
    
    const members = [
      // Management Services members
      { firstName: 'John', lastName: 'Dela Cruz', ministry: 'Management Services', apostolate: 'Teaching', city: 'CEBU', encounterType: 'ME', classNumber: 18 },
      { firstName: 'Maria', lastName: 'Santos', ministry: 'Management Services', apostolate: 'Music', city: 'CEBU', encounterType: 'ME', classNumber: 19 },
      { firstName: 'Pedro', lastName: 'Garcia', ministry: 'Management Services', apostolate: 'Youth', city: 'MANDAUE', encounterType: 'SE', classNumber: 20 },
      { firstName: 'Ana', lastName: 'Lopez', ministry: 'Management Services', apostolate: 'Couples', city: 'CEBU', encounterType: 'ME', classNumber: 21 },
      { firstName: 'Carlos', lastName: 'Martinez', ministry: 'Management Services', apostolate: 'Singles', city: 'LAPU-LAPU', encounterType: 'SE', classNumber: 22 },
      
      // Service Ministry members
      { firstName: 'Juan', lastName: 'Reyes', ministry: 'Service Ministry', apostolate: 'Teaching', city: 'CEBU', encounterType: 'ME', classNumber: 17 },
      { firstName: 'Rosa', lastName: 'Fernandez', ministry: 'Service Ministry', apostolate: 'Music', city: 'CEBU', encounterType: 'ME', classNumber: 18 },
      { firstName: 'Miguel', lastName: 'Torres', ministry: 'Service Ministry', apostolate: 'Youth', city: 'MANDAUE', encounterType: 'YE', classNumber: 15 },
      { firstName: 'Carmen', lastName: 'Villanueva', ministry: 'Service Ministry', apostolate: 'Couples', city: 'TALISAY', encounterType: 'ME', classNumber: 19 },
      { firstName: 'Roberto', lastName: 'Cruz', ministry: 'Service Ministry', apostolate: 'Family', city: 'CEBU', encounterType: 'FE', classNumber: 12 },
      
      // PLSG members
      { firstName: 'Elena', lastName: 'Ramos', ministry: 'PLSG', apostolate: 'Teaching', city: 'CEBU', encounterType: 'ME', classNumber: 16 },
      { firstName: 'Fernando', lastName: 'Mendoza', ministry: 'PLSG', apostolate: 'Music', city: 'CEBU', encounterType: 'ME', classNumber: 17 },
      { firstName: 'Isabel', lastName: 'Gutierrez', ministry: 'PLSG', apostolate: 'Youth', city: 'MANDAUE', encounterType: 'YE', classNumber: 14 },
      { firstName: 'Manuel', lastName: 'Alvarez', ministry: 'PLSG', apostolate: 'Couples', city: 'LAPU-LAPU', encounterType: 'ME', classNumber: 18 },
      { firstName: 'Patricia', lastName: 'Morales', ministry: 'PLSG', apostolate: 'Singles', city: 'CEBU', encounterType: 'SE', classNumber: 21 },
      
      // Intercessory members
      { firstName: 'Ricardo', lastName: 'Castillo', ministry: 'Intercessory', apostolate: 'Teaching', city: 'CEBU', encounterType: 'ME', classNumber: 15 },
      { firstName: 'Sofia', lastName: 'Jimenez', ministry: 'Intercessory', apostolate: 'Music', city: 'TALISAY', encounterType: 'ME', classNumber: 16 },
      { firstName: 'Tomas', lastName: 'Herrera', ministry: 'Intercessory', apostolate: 'Youth', city: 'CEBU', encounterType: 'YE', classNumber: 13 },
      { firstName: 'Victoria', lastName: 'Navarro', ministry: 'Intercessory', apostolate: 'Couples', city: 'MANDAUE', encounterType: 'ME', classNumber: 17 },
      { firstName: 'William', lastName: 'Ortega', ministry: 'Intercessory', apostolate: 'Family', city: 'CEBU', encounterType: 'FE', classNumber: 11 },
    ];

    const createdMembers = [];
    const passwordHash = await bcrypt.hash('password123', 10);

    for (let i = 0; i < members.length; i++) {
      const memberData = members[i];
      const sequence = String(i + 1).padStart(2, '0');
      const communityId = `CEB-${memberData.encounterType}${memberData.classNumber}${sequence}`;

      // Check if member already exists
      const existing = await prisma.member.findUnique({
        where: { communityId },
      });

      if (existing) {
        console.log(`   ⊘ ${memberData.firstName} ${memberData.lastName} (${communityId}) already exists`);
        continue;
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email: `${memberData.firstName.toLowerCase()}.${memberData.lastName.toLowerCase().replace(/\s+/g, '')}@example.com`,
          passwordHash,
          role: UserRole.MEMBER,
          phone: `0917${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
        },
      });

      // Create member
      const member = await prisma.member.create({
        data: {
          userId: user.id,
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          middleName: memberData.firstName === 'Maria' ? 'Cruz' : undefined,
          nickname: memberData.firstName === 'John' ? 'Johnny' : undefined,
          communityId,
          city: memberData.city,
          encounterType: memberData.encounterType,
          classNumber: memberData.classNumber,
          ministry: memberData.ministry,
          apostolate: memberData.apostolate,
        },
      });

      createdMembers.push(member);
      console.log(`   ✓ ${memberData.firstName} ${memberData.lastName} (${communityId}) - ${memberData.ministry} / ${memberData.apostolate}`);
    }

    console.log(`\n✅ Created ${createdMembers.length} members`);
    console.log(`\n📊 Summary by Ministry:`);
    const byMinistry = createdMembers.reduce((acc, m) => {
      const ministry = m.ministry || 'None';
      acc[ministry] = (acc[ministry] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    Object.entries(byMinistry).forEach(([ministry, count]) => {
      console.log(`   ${ministry}: ${count} members`);
    });

    console.log(`\n📊 Summary by Apostolate:`);
    const byApostolate = createdMembers.reduce((acc, m) => {
      const apostolate = m.apostolate || 'None';
      acc[apostolate] = (acc[apostolate] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    Object.entries(byApostolate).forEach(([apostolate, count]) => {
      console.log(`   ${apostolate}: ${count} members`);
    });
  } catch (error) {
    console.error('❌ Error creating members:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createDummyMembersWithMinistries();
