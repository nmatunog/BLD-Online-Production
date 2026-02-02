import { PrismaClient, EventStatus } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Create historical recurring events:
 * - Corporate Worship: Every Tuesday at 7pm (going back 6 months)
 * - Management Services WSC: Every Wednesday at 8pm (going back 6 months)
 * - Service Ministry WSC: Every Friday at 7pm (going back 6 months)
 */
async function createDummyRecurringEvents() {
  try {
    console.log('📅 Creating historical recurring events...\n');

    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Corporate Worship - Tuesdays at 7pm
    console.log('🎵 Creating Corporate Worship events (Tuesdays 7pm)...');
    const corporateWorshipEvents = [];
    const current = new Date(sixMonthsAgo);
    
    while (current <= today) {
      if (current.getDay() === 2) { // Tuesday
        const eventDate = new Date(current);
        eventDate.setHours(19, 0, 0, 0); // 7pm
        
        const endDate = new Date(eventDate);
        endDate.setHours(21, 0, 0, 0); // 9pm (2 hours duration)

        const event = await prisma.event.create({
          data: {
            title: `Corporate Worship - ${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            description: 'Weekly Corporate Worship gathering',
            category: 'Corporate Worship',
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
        console.log(`   ✓ ${event.title} (${eventDate.toLocaleDateString()})`);
      }
      current.setDate(current.getDate() + 1);
    }
    console.log(`✅ Created ${corporateWorshipEvents.length} Corporate Worship events\n`);

    // Management Services WSC - Wednesdays at 8pm
    console.log('📚 Creating Management Services WSC events (Wednesdays 8pm)...');
    const mgmtServicesEvents = [];
    const currentWed = new Date(sixMonthsAgo);
    
    while (currentWed <= today) {
      if (currentWed.getDay() === 3) { // Wednesday
        const eventDate = new Date(currentWed);
        eventDate.setHours(20, 0, 0, 0); // 8pm
        
        const endDate = new Date(eventDate);
        endDate.setHours(22, 0, 0, 0); // 10pm (2 hours duration)

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
        console.log(`   ✓ ${event.title} (${eventDate.toLocaleDateString()})`);
      }
      currentWed.setDate(currentWed.getDate() + 1);
    }
    console.log(`✅ Created ${mgmtServicesEvents.length} Management Services WSC events\n`);

    // Service Ministry WSC - Fridays at 7pm
    console.log('🤝 Creating Service Ministry WSC events (Fridays 7pm)...');
    const serviceMinistryEvents = [];
    const currentFri = new Date(sixMonthsAgo);
    
    while (currentFri <= today) {
      if (currentFri.getDay() === 5) { // Friday
        const eventDate = new Date(currentFri);
        eventDate.setHours(19, 0, 0, 0); // 7pm
        
        const endDate = new Date(eventDate);
        endDate.setHours(21, 0, 0, 0); // 9pm (2 hours duration)

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
        console.log(`   ✓ ${event.title} (${eventDate.toLocaleDateString()})`);
      }
      currentFri.setDate(currentFri.getDate() + 1);
    }
    console.log(`✅ Created ${serviceMinistryEvents.length} Service Ministry WSC events\n`);

    console.log('✅ All recurring events created successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   Corporate Worship: ${corporateWorshipEvents.length} events`);
    console.log(`   Management Services WSC: ${mgmtServicesEvents.length} events`);
    console.log(`   Service Ministry WSC: ${serviceMinistryEvents.length} events`);
    console.log(`   Total: ${corporateWorshipEvents.length + mgmtServicesEvents.length + serviceMinistryEvents.length} events`);
  } catch (error) {
    console.error('❌ Error creating recurring events:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createDummyRecurringEvents();
