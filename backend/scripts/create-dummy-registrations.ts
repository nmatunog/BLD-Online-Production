import { PrismaClient, RegistrationType, PaymentStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function createDummyRegistrations(eventId?: string) {
  try {
    let event;
    
    if (eventId) {
      event = await prisma.event.findUnique({
        where: { id: eventId },
      });
      
      if (!event) {
        console.log(`❌ Event with ID "${eventId}" not found`);
        return;
      }
    } else {
      // Find any event with "BBS" in title
      event = await prisma.event.findFirst({
        where: {
          title: {
            contains: 'BBS',
            mode: 'insensitive',
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      if (!event) {
        console.log('❌ No event with "BBS" in title found');
        console.log('\n📋 Recent events:');
        const allEvents = await prisma.event.findMany({
          select: { id: true, title: true, startDate: true, hasRegistration: true, registrationFee: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        allEvents.forEach((e) => {
          console.log(`   - "${e.title}" (ID: ${e.id}) - Registration: ${e.hasRegistration ? 'Yes' : 'No'} - Fee: ${e.registrationFee || 0}`);
        });
        console.log('\n💡 Usage: npx ts-node scripts/create-dummy-registrations.ts <event-id>');
        return;
      }
    }

    console.log(`✅ Found event: "${event.title}" (ID: ${event.id})`);
    console.log(`   Registration enabled: ${event.hasRegistration ? 'Yes' : 'No'}`);
    console.log(`   Registration fee: ₱${event.registrationFee || 0}\n`);

    if (!event.hasRegistration) {
      console.log('⚠️  Event does not have registration enabled. Enabling it...');
      await prisma.event.update({
        where: { id: event.id },
        data: { hasRegistration: true, registrationFee: event.registrationFee || 500 },
      });
      console.log('✅ Registration enabled\n');
    }

    const registrationFee = event.registrationFee ? Number(event.registrationFee) : 500;

    // Delete existing dummy registrations
    console.log('🗑️  Cleaning up existing dummy registrations...');
    const deletedRegs = await prisma.eventRegistration.deleteMany({
      where: {
        eventId: event.id,
        OR: [
          { firstName: { startsWith: '[DUMMY]' } },
          { notes: { contains: '[DUMMY]' } },
        ],
      },
    });
    console.log(`   Deleted ${deletedRegs.count} dummy registrations\n`);

    // Get some existing members (or create dummy ones)
    console.log('👥 Getting members for registrations...');
    const members = await prisma.member.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
      },
      where: {
        user: {
          isActive: true,
        },
      },
      take: 5,
    });

    console.log(`   Found ${members.length} active members\n`);

    // Create dummy member registrations
    console.log('📝 Creating dummy member registrations...');
    const memberRegistrations = [
      { firstName: '[DUMMY] Juan', lastName: 'Dela Cruz', member: members[0] },
      { firstName: '[DUMMY] Maria', lastName: 'Santos', member: members[1] },
      { firstName: '[DUMMY] Jose', lastName: 'Reyes', member: members[2] },
    ];

    for (const reg of memberRegistrations) {
      if (reg.member) {
        await prisma.eventRegistration.create({
          data: {
            eventId: event.id,
            memberId: reg.member.id,
            registrationType: RegistrationType.MEMBER,
            firstName: reg.member.firstName,
            lastName: reg.member.lastName,
            middleName: reg.member.middleName,
            email: reg.member.user?.email || null,
            phone: reg.member.user?.phone || null,
            memberCommunityId: reg.member.communityId,
            paymentStatus: PaymentStatus.PAID,
            paymentAmount: registrationFee,
            paymentReference: `DUMMY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            notes: '[DUMMY] Test registration',
          },
        });
        console.log(`   ✓ ${reg.member.firstName} ${reg.member.lastName} (${reg.member.communityId}) - ₱${registrationFee.toFixed(2)}`);
      }
    }

    // Create dummy non-member registrations
    console.log('\n📝 Creating dummy non-member registrations...');
    const nonMemberRegistrations = [
      { firstName: '[DUMMY] Pedro', lastName: 'Garcia', email: 'pedro.garcia@example.com', phone: '09123456789' },
      { firstName: '[DUMMY] Ana', lastName: 'Lopez', email: 'ana.lopez@example.com', phone: '09123456790' },
      { firstName: '[DUMMY] Carlos', lastName: 'Martinez', email: 'carlos.martinez@example.com', phone: '09123456791' },
    ];

    for (const reg of nonMemberRegistrations) {
      await prisma.eventRegistration.create({
        data: {
          eventId: event.id,
          registrationType: RegistrationType.NON_MEMBER,
          firstName: reg.firstName,
          lastName: reg.lastName,
          email: reg.email,
          phone: reg.phone,
          paymentStatus: PaymentStatus.PAID,
          paymentAmount: registrationFee,
          paymentReference: `DUMMY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          notes: '[DUMMY] Test non-member registration',
        },
      });
      console.log(`   ✓ ${reg.firstName} ${reg.lastName} (Non-member) - ₱${registrationFee.toFixed(2)}`);
    }

    // Create a dummy couple registration
    if (members.length >= 2) {
      console.log('\n💑 Creating dummy couple registration...');
      const coupleId = `DUMMY-COUPLE-${Date.now()}`;
      
      // Create husband registration
      const husband = await prisma.eventRegistration.create({
        data: {
          eventId: event.id,
          memberId: members[0]?.id,
          registrationType: RegistrationType.COUPLE,
          firstName: members[0]?.firstName || '[DUMMY] John',
          lastName: members[0]?.lastName || 'Smith',
          middleName: members[0]?.middleName,
          email: members[0]?.user?.email || null,
          phone: members[0]?.user?.phone || null,
          memberCommunityId: members[0]?.communityId,
          spouseFirstName: members[1]?.firstName || '[DUMMY] Jane',
          spouseLastName: members[1]?.lastName || 'Smith',
          spouseMiddleName: members[1]?.middleName,
          coupleRegistrationId: coupleId,
          coupleRole: 'HUSBAND',
          paymentStatus: PaymentStatus.PAID,
          paymentAmount: registrationFee * 2, // Couple pays double
          paymentReference: `DUMMY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          notes: '[DUMMY] Test couple registration',
        },
      });

      // Create wife registration
      const wife = await prisma.eventRegistration.create({
        data: {
          eventId: event.id,
          memberId: members[1]?.id,
          registrationType: RegistrationType.COUPLE,
          firstName: members[1]?.firstName || '[DUMMY] Jane',
          lastName: members[1]?.lastName || 'Smith',
          middleName: members[1]?.middleName,
          email: members[1]?.user?.email || null,
          phone: members[1]?.user?.phone || null,
          memberCommunityId: members[1]?.communityId,
          spouseFirstName: members[0]?.firstName || '[DUMMY] John',
          spouseLastName: members[0]?.lastName || 'Smith',
          spouseMiddleName: members[0]?.middleName,
          coupleRegistrationId: coupleId,
          coupleRole: 'WIFE',
          paymentStatus: PaymentStatus.PAID,
          paymentAmount: registrationFee * 2, // Couple pays double
          paymentReference: `DUMMY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          notes: '[DUMMY] Test couple registration',
        },
      });

      console.log(`   ✓ ${husband.firstName} ${husband.lastName} & ${wife.firstName} ${wife.lastName} (Couple) - ₱${(registrationFee * 2).toFixed(2)}`);
    }

    // Verify registrations
    console.log('\n🔍 Verifying registrations...');
    const allRegistrations = await prisma.eventRegistration.findMany({
      where: {
        eventId: event.id,
        paymentStatus: PaymentStatus.PAID,
        OR: [
          { firstName: { startsWith: '[DUMMY]' } },
          { notes: { contains: '[DUMMY]' } },
        ],
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    const totalPaid = allRegistrations.reduce((sum, r) => sum + (Number(r.paymentAmount) || 0), 0);

    console.log(`   ✅ Total paid registrations: ${allRegistrations.length}`);
    console.log(`   ✅ Total payment amount: ₱${totalPaid.toFixed(2)}`);
    console.log(`   ✅ Expected in income entry: ₱${totalPaid.toFixed(2)}`);

    console.log('\n✅ Dummy registrations created successfully!');
    console.log('💡 These registrations will appear in the Registration Fees income entry participant list.');
    console.log(`\n🔗 Event Registrations URL: http://localhost:3000/event-registrations?eventId=${event.id}`);
    console.log(`🔗 Event Accounting URL: http://localhost:3000/accounting/${event.id}`);
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get event ID from command line argument
const eventId = process.argv[2];
createDummyRegistrations(eventId);
