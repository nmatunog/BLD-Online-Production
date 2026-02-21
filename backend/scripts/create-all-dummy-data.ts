import { PrismaClient, UserRole, EventStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Master script to create all dummy data for Reports module testing:
 * 1. Historical Community Worship events (Tuesdays 7pm)
 * 2. WSC events per ministry (Management Services Wed 8pm, Service Ministry Fri 7pm)
 * 3. Dummy members with ministries and apostolates
 * 4. Historical attendance data (60-80% and 100% attendance rates)
 */
async function createAllDummyData() {
  try {
    console.log('🚀 Creating all dummy data for Reports module...\n');
    console.log('=' .repeat(60));

    // Step 1: Create members with ministries
    console.log('\n📋 Step 1: Creating members with ministries and apostolates...');
    console.log('-'.repeat(60));
    
    const membersData = [
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

    const passwordHash = await bcrypt.hash('password123', 10);
    const createdMembers = [];

    for (let i = 0; i < membersData.length; i++) {
      const memberData = membersData[i];
      const sequence = String(i + 1).padStart(2, '0');
      const communityId = `CEB-${memberData.encounterType}${memberData.classNumber}${sequence}`;

      const existing = await prisma.member.findUnique({
        where: { communityId },
      });

      if (existing) {
        console.log(`   ⊘ ${memberData.firstName} ${memberData.lastName} (${communityId}) already exists`);
        createdMembers.push(existing);
        continue;
      }

      const user = await prisma.user.create({
        data: {
          email: `${memberData.firstName.toLowerCase()}.${memberData.lastName.toLowerCase().replace(/\s+/g, '')}@example.com`,
          passwordHash,
          role: UserRole.MEMBER,
          phone: `0917${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
        },
      });

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

    // Step 2: Create recurring events
    console.log('\n📅 Step 2: Creating historical recurring events...');
    console.log('-'.repeat(60));

    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Community Worship - Tuesdays at 7pm
    console.log('🎵 Creating Community Worship events (Tuesdays 7pm)...');
    const corporateWorshipEvents = [];
    const current = new Date(sixMonthsAgo);
    
    while (current <= today) {
      if (current.getDay() === 2) { // Tuesday
        const eventDate = new Date(current);
        eventDate.setHours(19, 0, 0, 0);
        const endDate = new Date(eventDate);
        endDate.setHours(21, 0, 0, 0);

        const event = await prisma.event.create({
          data: {
            title: `Community Worship - ${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            description: 'Weekly Community Worship gathering',
            category: 'Community Worship',
            eventType: 'CORPORATE_WORSHIP',
            startDate: eventDate,
            endDate: endDate,
            startTime: '19:00',
            endTime: '21:00',
            location: 'BLD Cebu Main Venue',
            venue: 'Main Hall',
            isRecurring: true,
            hasRegistration: false,
            status: eventDate < today ? EventStatus.COMPLETED : EventStatus.UPCOMING,
          },
        });
        corporateWorshipEvents.push(event);
      }
      current.setDate(current.getDate() + 1);
    }
    console.log(`   ✓ Created ${corporateWorshipEvents.length} Community Worship events`);

    // Management Services WSC - Wednesdays at 8pm
    console.log('📚 Creating Management Services WSC events (Wednesdays 8pm)...');
    const mgmtServicesEvents = [];
    const currentWed = new Date(sixMonthsAgo);
    
    while (currentWed <= today) {
      if (currentWed.getDay() === 3) { // Wednesday
        const eventDate = new Date(currentWed);
        eventDate.setHours(20, 0, 0, 0);
        const endDate = new Date(eventDate);
        endDate.setHours(22, 0, 0, 0);

        const event = await prisma.event.create({
          data: {
            title: `WSC - Management Services - ${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            description: 'Word Sharing Circle for Management Services Ministry',
            category: 'Word Sharing Circle',
            eventType: 'WSC',
            startDate: eventDate,
            endDate: endDate,
            startTime: '20:00',
            endTime: '22:00',
            location: 'BLD Cebu Main Venue',
            venue: 'Conference Room A',
            isRecurring: true,
            hasRegistration: false,
            status: eventDate < today ? EventStatus.COMPLETED : EventStatus.UPCOMING,
          },
        });
        mgmtServicesEvents.push(event);
      }
      currentWed.setDate(currentWed.getDate() + 1);
    }
    console.log(`   ✓ Created ${mgmtServicesEvents.length} Management Services WSC events`);

    // Service Ministry WSC - Fridays at 7pm
    console.log('🤝 Creating Service Ministry WSC events (Fridays 7pm)...');
    const serviceMinistryEvents = [];
    const currentFri = new Date(sixMonthsAgo);
    
    while (currentFri <= today) {
      if (currentFri.getDay() === 5) { // Friday
        const eventDate = new Date(currentFri);
        eventDate.setHours(19, 0, 0, 0);
        const endDate = new Date(eventDate);
        endDate.setHours(21, 0, 0, 0);

        const event = await prisma.event.create({
          data: {
            title: `WSC - Service Ministry - ${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            description: 'Word Sharing Circle for Service Ministry',
            category: 'Word Sharing Circle',
            eventType: 'WSC',
            startDate: eventDate,
            endDate: endDate,
            startTime: '19:00',
            endTime: '21:00',
            location: 'BLD Cebu Main Venue',
            venue: 'Conference Room B',
            isRecurring: true,
            hasRegistration: false,
            status: eventDate < today ? EventStatus.COMPLETED : EventStatus.UPCOMING,
          },
        });
        serviceMinistryEvents.push(event);
      }
      currentFri.setDate(currentFri.getDate() + 1);
    }
    console.log(`   ✓ Created ${serviceMinistryEvents.length} Service Ministry WSC events`);

    const allEvents = [...corporateWorshipEvents, ...mgmtServicesEvents, ...serviceMinistryEvents];
    console.log(`\n✅ Created ${allEvents.length} total recurring events`);

    // Step 3: Create attendance data
    console.log('\n📊 Step 3: Creating historical attendance data...');
    console.log('-'.repeat(60));

    const mgmtServicesMembers = createdMembers.filter(m => m.ministry === 'Management Services');
    const serviceMinistryMembers = createdMembers.filter(m => m.ministry === 'Service Ministry');
    let totalAttendances = 0;

    // Community Worship attendance (70-90% of all members)
    console.log('🎵 Creating Community Worship attendance...');
    for (const event of corporateWorshipEvents) {
      const attendanceRate = 0.7 + Math.random() * 0.2;
      const numAttendees = Math.floor(createdMembers.length * attendanceRate);
      const shuffled = [...createdMembers].sort(() => Math.random() - 0.5);
      const attendees = shuffled.slice(0, numAttendees);

      for (const member of attendees) {
        const existing = await prisma.attendance.findFirst({
          where: { memberId: member.id, eventId: event.id },
        });

        if (!existing) {
          const checkInTime = new Date(event.startDate);
          checkInTime.setMinutes(checkInTime.getMinutes() + Math.floor(Math.random() * 30));

          await prisma.attendance.create({
            data: {
              memberId: member.id,
              eventId: event.id,
              method: Math.random() > 0.5 ? 'QR_CODE' : 'MANUAL',
              checkInTime,
            },
          });
          totalAttendances++;
        }
      }
    }
    console.log(`   ✓ Created attendance for Community Worship events`);

    // Management Services WSC attendance (60-80% of ministry members)
    console.log('📚 Creating Management Services WSC attendance...');
    for (const event of mgmtServicesEvents) {
      const attendanceRate = 0.6 + Math.random() * 0.2;
      const numAttendees = Math.floor(mgmtServicesMembers.length * attendanceRate);
      const shuffled = [...mgmtServicesMembers].sort(() => Math.random() - 0.5);
      const attendees = shuffled.slice(0, numAttendees);

      for (const member of attendees) {
        const existing = await prisma.attendance.findFirst({
          where: { memberId: member.id, eventId: event.id },
        });

        if (!existing) {
          const checkInTime = new Date(event.startDate);
          checkInTime.setMinutes(checkInTime.getMinutes() + Math.floor(Math.random() * 30));

          await prisma.attendance.create({
            data: {
              memberId: member.id,
              eventId: event.id,
              method: Math.random() > 0.5 ? 'QR_CODE' : 'MANUAL',
              checkInTime,
            },
          });
          totalAttendances++;
        }
      }
    }
    console.log(`   ✓ Created attendance for Management Services WSC events`);

    // Service Ministry WSC attendance (60-80% of ministry members)
    console.log('🤝 Creating Service Ministry WSC attendance...');
    for (const event of serviceMinistryEvents) {
      const attendanceRate = 0.6 + Math.random() * 0.2;
      const numAttendees = Math.floor(serviceMinistryMembers.length * attendanceRate);
      const shuffled = [...serviceMinistryMembers].sort(() => Math.random() - 0.5);
      const attendees = shuffled.slice(0, numAttendees);

      for (const member of attendees) {
        const existing = await prisma.attendance.findFirst({
          where: { memberId: member.id, eventId: event.id },
        });

        if (!existing) {
          const checkInTime = new Date(event.startDate);
          checkInTime.setMinutes(checkInTime.getMinutes() + Math.floor(Math.random() * 30));

          await prisma.attendance.create({
            data: {
              memberId: member.id,
              eventId: event.id,
              method: Math.random() > 0.5 ? 'QR_CODE' : 'MANUAL',
              checkInTime,
            },
          });
          totalAttendances++;
        }
      }
    }
    console.log(`   ✓ Created attendance for Service Ministry WSC events`);

    // Create 100% attendance for a few members
    console.log('⭐ Creating 100% attendance for selected members...');
    const perfectAttendanceMembers = createdMembers.slice(0, Math.min(5, createdMembers.length));
    
    for (const member of perfectAttendanceMembers) {
      let relevantEvents: typeof allEvents = [];
      relevantEvents.push(...corporateWorshipEvents);
      
      if (member.ministry === 'Management Services') {
        relevantEvents.push(...mgmtServicesEvents);
      } else if (member.ministry === 'Service Ministry') {
        relevantEvents.push(...serviceMinistryEvents);
      }

      for (const event of relevantEvents) {
        const existing = await prisma.attendance.findFirst({
          where: { memberId: member.id, eventId: event.id },
        });

        if (!existing) {
          const checkInTime = new Date(event.startDate);
          checkInTime.setMinutes(checkInTime.getMinutes() + Math.floor(Math.random() * 30));

          await prisma.attendance.create({
            data: {
              memberId: member.id,
              eventId: event.id,
              method: Math.random() > 0.5 ? 'QR_CODE' : 'MANUAL',
              checkInTime,
            },
          });
          totalAttendances++;
        }
      }
      console.log(`   ✓ ${member.firstName} ${member.lastName} - 100% attendance (${relevantEvents.length} events)`);
    }

    console.log(`\n✅ Created ${totalAttendances} attendance records`);

    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Members created: ${createdMembers.length}`);
    console.log(`   Community Worship events: ${corporateWorshipEvents.length}`);
    console.log(`   Management Services WSC events: ${mgmtServicesEvents.length}`);
    console.log(`   Service Ministry WSC events: ${serviceMinistryEvents.length}`);
    console.log(`   Total events: ${allEvents.length}`);
    console.log(`   Total attendance records: ${totalAttendances}`);
    console.log(`   Perfect attendance members: ${perfectAttendanceMembers.length}`);
    console.log('\n✅ All dummy data created successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Go to Reports module');
    console.log('   2. Test reports by ministry, apostolate, and community');
    console.log('   3. Test individual member reports');
  } catch (error) {
    console.error('❌ Error creating dummy data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createAllDummyData();
