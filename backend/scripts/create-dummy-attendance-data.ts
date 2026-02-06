import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Create historical attendance data for members
 * - Some members with 60-80% attendance
 * - A few members with 100% attendance
 * - Distribute across Community Worship and WSC events
 */
async function createDummyAttendanceData() {
  try {
    console.log('📊 Creating historical attendance data...\n');

    // Get all members
    const members = await prisma.member.findMany({
      where: {
        isActive: true,
      },
    });

    if (members.length === 0) {
      console.log('❌ No active members found. Please create members first.');
      return;
    }

    // Get all recurring events (Community Worship and WSC)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const events = await prisma.event.findMany({
      where: {
        isRecurring: true,
        startDate: {
          gte: sixMonthsAgo,
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    if (events.length === 0) {
      console.log('❌ No recurring events found. Please create recurring events first.');
      return;
    }

    console.log(`📅 Found ${events.length} recurring events`);
    console.log(`👥 Found ${members.length} members\n`);

    // Categorize events
    const corporateWorshipEvents = events.filter(e => 
      e.title?.toLowerCase().includes('corporate worship')
    );
    const wscEvents = events.filter(e => 
      e.title?.toLowerCase().includes('wsc') || 
      e.title?.toLowerCase().includes('word sharing')
    );

    console.log(`   Community Worship events: ${corporateWorshipEvents.length}`);
    console.log(`   WSC events: ${wscEvents.length}\n`);

    // Group WSC events by ministry
    const mgmtServicesEvents = wscEvents.filter(e => 
      e.title?.toLowerCase().includes('management services')
    );
    const serviceMinistryEvents = wscEvents.filter(e => 
      e.title?.toLowerCase().includes('service ministry')
    );

    console.log(`   Management Services WSC: ${mgmtServicesEvents.length}`);
    console.log(`   Service Ministry WSC: ${serviceMinistryEvents.length}\n`);

    // Group members by ministry
    const mgmtServicesMembers = members.filter(m => m.ministry === 'Management Services');
    const serviceMinistryMembers = members.filter(m => m.ministry === 'Service Ministry');
    const otherMembers = members.filter(m => 
      m.ministry !== 'Management Services' && m.ministry !== 'Service Ministry'
    );

    console.log(`   Management Services members: ${mgmtServicesMembers.length}`);
    console.log(`   Service Ministry members: ${serviceMinistryMembers.length}`);
    console.log(`   Other members: ${otherMembers.length}\n`);

    let totalAttendances = 0;

    // Create attendance for Community Worship (all members can attend)
    console.log('🎵 Creating Community Worship attendance...');
    for (const event of corporateWorshipEvents) {
      // 70-90% of members attend Community Worship
      const attendanceRate = 0.7 + Math.random() * 0.2; // 70-90%
      const numAttendees = Math.floor(members.length * attendanceRate);
      
      // Randomly select members
      const shuffled = [...members].sort(() => Math.random() - 0.5);
      const attendees = shuffled.slice(0, numAttendees);

      for (const member of attendees) {
        // Check if attendance already exists
        const existing = await prisma.attendance.findFirst({
          where: {
            memberId: member.id,
            eventId: event.id,
          },
        });

        if (!existing) {
          const checkInTime = new Date(event.startDate);
          // Add random check-in time variation (0-30 minutes after event start)
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
    console.log(`   ✓ Created attendance for Community Worship events\n`);

    // Create attendance for Management Services WSC
    console.log('📚 Creating Management Services WSC attendance...');
    for (const event of mgmtServicesEvents) {
      // Members from Management Services attend their WSC
      // Some members have 60-80% attendance, a few have 100%
      const attendanceRate = 0.6 + Math.random() * 0.3; // 60-90%
      const numAttendees = Math.floor(mgmtServicesMembers.length * attendanceRate);
      
      const shuffled = [...mgmtServicesMembers].sort(() => Math.random() - 0.5);
      const attendees = shuffled.slice(0, numAttendees);

      for (const member of attendees) {
        const existing = await prisma.attendance.findFirst({
          where: {
            memberId: member.id,
            eventId: event.id,
          },
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
    console.log(`   ✓ Created attendance for Management Services WSC events\n`);

    // Create attendance for Service Ministry WSC
    console.log('🤝 Creating Service Ministry WSC attendance...');
    for (const event of serviceMinistryEvents) {
      // Members from Service Ministry attend their WSC
      const attendanceRate = 0.6 + Math.random() * 0.3; // 60-90%
      const numAttendees = Math.floor(serviceMinistryMembers.length * attendanceRate);
      
      const shuffled = [...serviceMinistryMembers].sort(() => Math.random() - 0.5);
      const attendees = shuffled.slice(0, numAttendees);

      for (const member of attendees) {
        const existing = await prisma.attendance.findFirst({
          where: {
            memberId: member.id,
            eventId: event.id,
          },
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
    console.log(`   ✓ Created attendance for Service Ministry WSC events\n`);

    // Create some 100% attendance members (select a few members to have perfect attendance)
    console.log('⭐ Creating 100% attendance for selected members...');
    const perfectAttendanceMembers = members.slice(0, Math.min(5, members.length)); // Top 5 members
    
    for (const member of perfectAttendanceMembers) {
      // Get all events this member should attend
      let relevantEvents: typeof events = [];
      
      // All Community Worship events
      relevantEvents.push(...corporateWorshipEvents);
      
      // WSC events based on ministry
      if (member.ministry === 'Management Services') {
        relevantEvents.push(...mgmtServicesEvents);
      } else if (member.ministry === 'Service Ministry') {
        relevantEvents.push(...serviceMinistryEvents);
      }

      for (const event of relevantEvents) {
        const existing = await prisma.attendance.findFirst({
          where: {
            memberId: member.id,
            eventId: event.id,
          },
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
    console.log(`\n📊 Summary:`);
    console.log(`   Total events: ${events.length}`);
    console.log(`   Total members: ${members.length}`);
    console.log(`   Total attendance records: ${totalAttendances}`);
    console.log(`   Average attendance per event: ${(totalAttendances / events.length).toFixed(1)}`);
    console.log(`   Perfect attendance members: ${perfectAttendanceMembers.length}`);
  } catch (error) {
    console.error('❌ Error creating attendance data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createDummyAttendanceData();
