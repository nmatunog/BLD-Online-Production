/**
 * Migrate data from Development to Production
 * 
 * This script copies all data from dev database to prod database,
 * EXCLUDING dummy data (marked with [DUMMY] or DUMMY in names/descriptions).
 * 
 * WARNING: This will overwrite production data!
 * 
 * Usage:
 *   # Set both database URLs
 *   DEV_DATABASE_URL="postgresql://..." PROD_DATABASE_URL="postgresql://..." \
 *   npx ts-node scripts/migrate-dev-to-prod.ts
 * 
 * Or use Cloud SQL Proxy:
 *   # Terminal 1: Dev proxy
 *   cloud-sql-proxy bld-cebu-portal-dev:asia-southeast1:bld-portal-db-dev
 *   
 *   # Terminal 2: Prod proxy
 *   cloud-sql-proxy bldcebu-portal:asia-southeast1:bld-portal-db
 *   
 *   # Terminal 3: Run migration
 *   DEV_DATABASE_URL="postgresql://postgres:PASSWORD@127.0.0.1:5432/bld_portal_dev" \
 *   PROD_DATABASE_URL="postgresql://postgres:PASSWORD@127.0.0.1:5433/bld_portal" \
 *   npx ts-node scripts/migrate-dev-to-prod.ts
 */

import { PrismaClient } from '@prisma/client';

const devPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DEV_DATABASE_URL,
    },
  },
});

const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL,
    },
  },
});

interface MigrationStats {
  users: number;
  members: number;
  events: number;
  registrations: number;
  attendances: number;
  incomeEntries: number;
  expenseEntries: number;
  adjustmentEntries: number;
  skipped: {
    events: number;
    members: number;
    registrations: number;
    attendances: number;
    incomeEntries: number;
    expenseEntries: number;
    adjustmentEntries: number;
  };
}

function isDummyData(data: any, field: string): boolean {
  const value = data[field];
  if (!value) return false;
  
  const str = String(value).toUpperCase();
  return str.includes('[DUMMY]') || str.includes('DUMMY');
}

async function migrateUsers(): Promise<number> {
  console.log('📋 Migrating users...');
  const users = await devPrisma.user.findMany({
    where: {
      isActive: true, // Only migrate active users
    },
  });

  let migrated = 0;
  for (const user of users) {
    try {
      await prodPrisma.user.upsert({
        where: { id: user.id },
        update: {
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          ministry: user.ministry,
          shepherdEncounterType: user.shepherdEncounterType,
          shepherdClassNumber: user.shepherdClassNumber,
        },
        create: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          password: user.password, // Note: Passwords are hashed, safe to copy
          role: user.role,
          isActive: user.isActive,
          ministry: user.ministry,
          shepherdEncounterType: user.shepherdEncounterType,
          shepherdClassNumber: user.shepherdClassNumber,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
      migrated++;
    } catch (error) {
      console.error(`  ⚠️  Failed to migrate user ${user.id}:`, error);
    }
  }
  console.log(`  ✅ Migrated ${migrated} users`);
  return migrated;
}

async function migrateMembers(): Promise<{ migrated: number; skipped: number }> {
  console.log('📋 Migrating members (excluding dummy data)...');
  const members = await devPrisma.member.findMany({
    where: {
      isActive: true,
    },
    include: {
      user: true,
    },
  });

  let migrated = 0;
  let skipped = 0;

  for (const member of members) {
    // Skip dummy members
    if (
      isDummyData(member, 'firstName') ||
      isDummyData(member, 'lastName') ||
      isDummyData(member, 'communityId') ||
      (member.communityId && member.communityId.toUpperCase().includes('DUMMY'))
    ) {
      skipped++;
      continue;
    }

    try {
      await prodPrisma.member.upsert({
        where: { id: member.id },
        update: {
          userId: member.userId,
          firstName: member.firstName,
          lastName: member.lastName,
          nickname: member.nickname,
          communityId: member.communityId,
          email: member.email,
          phone: member.phone,
          dateOfBirth: member.dateOfBirth,
          gender: member.gender,
          address: member.address,
          city: member.city,
          province: member.province,
          postalCode: member.postalCode,
          country: member.country,
          profession: member.profession,
          apostolate: member.apostolate,
          ministry: member.ministry,
          encounterType: member.encounterType,
          classNumber: member.classNumber,
          isActive: member.isActive,
          qrCodeUrl: member.qrCodeUrl,
          updatedAt: new Date(),
        },
        create: {
          id: member.id,
          userId: member.userId,
          firstName: member.firstName,
          lastName: member.lastName,
          nickname: member.nickname,
          communityId: member.communityId,
          email: member.email,
          phone: member.phone,
          dateOfBirth: member.dateOfBirth,
          gender: member.gender,
          address: member.address,
          city: member.city,
          province: member.province,
          postalCode: member.postalCode,
          country: member.country,
          profession: member.profession,
          apostolate: member.apostolate,
          ministry: member.ministry,
          encounterType: member.encounterType,
          classNumber: member.classNumber,
          isActive: member.isActive,
          qrCodeUrl: member.qrCodeUrl,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        },
      });
      migrated++;
    } catch (error) {
      console.error(`  ⚠️  Failed to migrate member ${member.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${migrated} members, skipped ${skipped} dummy members`);
  return { migrated, skipped };
}

async function migrateEvents(): Promise<{ migrated: number; skipped: number }> {
  console.log('📋 Migrating events (excluding dummy data)...');
  const events = await devPrisma.event.findMany({
    include: {
      classShepherds: true,
    },
  });

  let migrated = 0;
  let skipped = 0;

  for (const event of events) {
    // Skip dummy events
    if (
      isDummyData(event, 'title') ||
      isDummyData(event, 'description')
    ) {
      skipped++;
      continue;
    }

    try {
      // Create event
      const prodEvent = await prodPrisma.event.upsert({
        where: { id: event.id },
        update: {
          title: event.title,
          eventType: event.eventType,
          category: event.category,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          venue: event.venue,
          status: event.status,
          hasRegistration: event.hasRegistration,
          registrationFee: event.registrationFee,
          maxParticipants: event.maxParticipants,
          isRecurring: event.isRecurring,
          recurrencePattern: event.recurrencePattern,
          recurrenceDays: event.recurrenceDays,
          recurrenceInterval: event.recurrenceInterval,
          monthlyType: event.monthlyType,
          monthlyDayOfMonth: event.monthlyDayOfMonth,
          monthlyDayOfWeek: event.monthlyDayOfWeek,
          recurrenceEndDate: event.recurrenceEndDate,
          qrCodeUrl: event.qrCodeUrl,
          updatedAt: new Date(),
        },
        create: {
          id: event.id,
          title: event.title,
          eventType: event.eventType,
          category: event.category,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          venue: event.venue,
          status: event.status,
          hasRegistration: event.hasRegistration,
          registrationFee: event.registrationFee,
          maxParticipants: event.maxParticipants,
          isRecurring: event.isRecurring,
          recurrencePattern: event.recurrencePattern,
          recurrenceDays: event.recurrenceDays,
          recurrenceInterval: event.recurrenceInterval,
          monthlyType: event.monthlyType,
          monthlyDayOfMonth: event.monthlyDayOfMonth,
          monthlyDayOfWeek: event.monthlyDayOfWeek,
          recurrenceEndDate: event.recurrenceEndDate,
          qrCodeUrl: event.qrCodeUrl,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        },
      });

      // Migrate class shepherds
      for (const shepherd of event.classShepherds) {
        await prodPrisma.classShepherd.upsert({
          where: { id: shepherd.id },
          update: {
            eventId: prodEvent.id,
            userId: shepherd.userId,
            encounterType: shepherd.encounterType,
            classNumber: shepherd.classNumber,
            updatedAt: new Date(),
          },
          create: {
            id: shepherd.id,
            eventId: prodEvent.id,
            userId: shepherd.userId,
            encounterType: shepherd.encounterType,
            classNumber: shepherd.classNumber,
            createdAt: shepherd.createdAt,
            updatedAt: shepherd.updatedAt,
          },
        });
      }

      migrated++;
    } catch (error) {
      console.error(`  ⚠️  Failed to migrate event ${event.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${migrated} events, skipped ${skipped} dummy events`);
  return { migrated, skipped };
}

async function migrateRegistrations(): Promise<{ migrated: number; skipped: number }> {
  console.log('📋 Migrating registrations (excluding dummy data)...');
  
  // Get all non-dummy events and members
  const prodEvents = await prodPrisma.event.findMany({ select: { id: true } });
  const prodMembers = await prodPrisma.member.findMany({ select: { id: true } });
  const prodEventIds = new Set(prodEvents.map(e => e.id));
  const prodMemberIds = new Set(prodMembers.map(m => m.id));

  const registrations = await devPrisma.eventRegistration.findMany();

  let migrated = 0;
  let skipped = 0;

  for (const reg of registrations) {
    // Skip if event or member is dummy (not in prod)
    if (!prodEventIds.has(reg.eventId) || (reg.memberId && !prodMemberIds.has(reg.memberId))) {
      skipped++;
      continue;
    }

    try {
      await prodPrisma.eventRegistration.upsert({
        where: { id: reg.id },
        update: {
          eventId: reg.eventId,
          memberId: reg.memberId,
          registrationType: reg.registrationType,
          firstName: reg.firstName,
          lastName: reg.lastName,
          email: reg.email,
          phone: reg.phone,
          paymentStatus: reg.paymentStatus,
          paymentAmount: reg.paymentAmount,
          paymentDate: reg.paymentDate,
          notes: reg.notes,
          updatedAt: new Date(),
        },
        create: {
          id: reg.id,
          eventId: reg.eventId,
          memberId: reg.memberId,
          registrationType: reg.registrationType,
          firstName: reg.firstName,
          lastName: reg.lastName,
          email: reg.email,
          phone: reg.phone,
          paymentStatus: reg.paymentStatus,
          paymentAmount: reg.paymentAmount,
          paymentDate: reg.paymentDate,
          notes: reg.notes,
          createdAt: reg.createdAt,
          updatedAt: reg.updatedAt,
        },
      });
      migrated++;
    } catch (error) {
      console.error(`  ⚠️  Failed to migrate registration ${reg.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${migrated} registrations, skipped ${skipped} dummy registrations`);
  return { migrated, skipped };
}

async function migrateAttendances(): Promise<{ migrated: number; skipped: number }> {
  console.log('📋 Migrating attendances (excluding dummy data)...');
  
  // Get all non-dummy events and members
  const prodEvents = await prodPrisma.event.findMany({ select: { id: true } });
  const prodMembers = await prodPrisma.member.findMany({ select: { id: true } });
  const prodEventIds = new Set(prodEvents.map(e => e.id));
  const prodMemberIds = new Set(prodMembers.map(m => m.id));

  const attendances = await devPrisma.attendance.findMany();

  let migrated = 0;
  let skipped = 0;

  for (const att of attendances) {
    // Skip if event or member is dummy (not in prod)
    if (!prodEventIds.has(att.eventId) || !prodMemberIds.has(att.memberId)) {
      skipped++;
      continue;
    }

    try {
      await prodPrisma.attendance.upsert({
        where: { id: att.id },
        update: {
          memberId: att.memberId,
          eventId: att.eventId,
          checkedInAt: att.checkedInAt,
          method: att.method,
          updatedAt: new Date(),
        },
        create: {
          id: att.id,
          memberId: att.memberId,
          eventId: att.eventId,
          checkedInAt: att.checkedInAt,
          method: att.method,
          createdAt: att.createdAt,
          updatedAt: att.updatedAt,
        },
      });
      migrated++;
    } catch (error) {
      console.error(`  ⚠️  Failed to migrate attendance ${att.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${migrated} attendances, skipped ${skipped} dummy attendances`);
  return { migrated, skipped };
}

async function migrateAccounting(): Promise<{
  income: { migrated: number; skipped: number };
  expense: { migrated: number; skipped: number };
  adjustment: { migrated: number; skipped: number };
}> {
  console.log('📋 Migrating accounting entries (excluding dummy data)...');
  
  // Get all non-dummy events
  const prodEvents = await prodPrisma.event.findMany({ select: { id: true } });
  const prodEventIds = new Set(prodEvents.map(e => e.id));

  // Migrate income entries
  const incomeEntries = await devPrisma.incomeEntry.findMany({
    include: { account: { select: { eventId: true } } },
  });

  let incomeMigrated = 0;
  let incomeSkipped = 0;

  for (const entry of incomeEntries) {
    // Skip if event is dummy or entry has [DUMMY] in description
    if (!prodEventIds.has(entry.account.eventId) || isDummyData(entry, 'description')) {
      incomeSkipped++;
      continue;
    }

    try {
      // Get or create account in prod
      const prodAccount = await prodPrisma.eventAccount.upsert({
        where: { eventId: entry.account.eventId },
        update: {},
        create: {
          eventId: entry.account.eventId,
        },
      });

      await prodPrisma.incomeEntry.upsert({
        where: { id: entry.id },
        update: {
          accountId: prodAccount.id,
          source: entry.source,
          description: entry.description,
          amount: entry.amount,
          receivedAt: entry.receivedAt,
          remarks: entry.remarks,
          orVoucherNumber: entry.orVoucherNumber,
          updatedAt: new Date(),
        },
        create: {
          id: entry.id,
          accountId: prodAccount.id,
          source: entry.source,
          description: entry.description,
          amount: entry.amount,
          receivedAt: entry.receivedAt,
          remarks: entry.remarks,
          orVoucherNumber: entry.orVoucherNumber,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
      });
      incomeMigrated++;
    } catch (error) {
      console.error(`  ⚠️  Failed to migrate income entry ${entry.id}:`, error);
    }
  }

  // Migrate expense entries
  const expenseEntries = await devPrisma.expenseEntry.findMany({
    include: { account: { select: { eventId: true } } },
  });

  let expenseMigrated = 0;
  let expenseSkipped = 0;

  for (const entry of expenseEntries) {
    if (!prodEventIds.has(entry.account.eventId) || isDummyData(entry, 'description')) {
      expenseSkipped++;
      continue;
    }

    try {
      const prodAccount = await prodPrisma.eventAccount.upsert({
        where: { eventId: entry.account.eventId },
        update: {},
        create: {
          eventId: entry.account.eventId,
        },
      });

      await prodPrisma.expenseEntry.upsert({
        where: { id: entry.id },
        update: {
          accountId: prodAccount.id,
          category: entry.category,
          description: entry.description,
          amount: entry.amount,
          paidAt: entry.paidAt,
          remarks: entry.remarks,
          orVoucherNumber: entry.orVoucherNumber,
          updatedAt: new Date(),
        },
        create: {
          id: entry.id,
          accountId: prodAccount.id,
          category: entry.category,
          description: entry.description,
          amount: entry.amount,
          paidAt: entry.paidAt,
          remarks: entry.remarks,
          orVoucherNumber: entry.orVoucherNumber,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
      });
      expenseMigrated++;
    } catch (error) {
      console.error(`  ⚠️  Failed to migrate expense entry ${entry.id}:`, error);
    }
  }

  // Migrate adjustment entries
  const adjustmentEntries = await devPrisma.adjustmentEntry.findMany({
    include: { account: { select: { eventId: true } } },
  });

  let adjustmentMigrated = 0;
  let adjustmentSkipped = 0;

  for (const entry of adjustmentEntries) {
    if (!prodEventIds.has(entry.account.eventId) || isDummyData(entry, 'description')) {
      adjustmentSkipped++;
      continue;
    }

    try {
      const prodAccount = await prodPrisma.eventAccount.upsert({
        where: { eventId: entry.account.eventId },
        update: {},
        create: {
          eventId: entry.account.eventId,
        },
      });

      await prodPrisma.adjustmentEntry.upsert({
        where: { id: entry.id },
        update: {
          accountId: prodAccount.id,
          description: entry.description,
          amount: entry.amount,
          adjustedAt: entry.adjustedAt,
          remarks: entry.remarks,
          orVoucherNumber: entry.orVoucherNumber,
          updatedAt: new Date(),
        },
        create: {
          id: entry.id,
          accountId: prodAccount.id,
          description: entry.description,
          amount: entry.amount,
          adjustedAt: entry.adjustedAt,
          remarks: entry.remarks,
          orVoucherNumber: entry.orVoucherNumber,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
      });
      adjustmentMigrated++;
    } catch (error) {
      console.error(`  ⚠️  Failed to migrate adjustment entry ${entry.id}:`, error);
    }
  }

  console.log(`  ✅ Income: ${incomeMigrated} migrated, ${incomeSkipped} skipped`);
  console.log(`  ✅ Expense: ${expenseMigrated} migrated, ${expenseSkipped} skipped`);
  console.log(`  ✅ Adjustment: ${adjustmentMigrated} migrated, ${adjustmentSkipped} skipped`);

  return {
    income: { migrated: incomeMigrated, skipped: incomeSkipped },
    expense: { migrated: expenseMigrated, skipped: expenseSkipped },
    adjustment: { migrated: adjustmentMigrated, skipped: adjustmentSkipped },
  };
}

async function main() {
  if (!process.env.DEV_DATABASE_URL || !process.env.PROD_DATABASE_URL) {
    console.error('❌ Error: Both DEV_DATABASE_URL and PROD_DATABASE_URL must be set');
    console.error('');
    console.error('Usage:');
    console.error('  DEV_DATABASE_URL="postgresql://..." PROD_DATABASE_URL="postgresql://..." \\');
    console.error('  npx ts-node scripts/migrate-dev-to-prod.ts');
    process.exit(1);
  }

  console.log('🚀 Starting migration from DEV to PROD...');
  console.log('📋 Excluding dummy data (marked with [DUMMY] or DUMMY)');
  console.log('='.repeat(60));
  console.log('');

  const stats: MigrationStats = {
    users: 0,
    members: 0,
    events: 0,
    registrations: 0,
    attendances: 0,
    incomeEntries: 0,
    expenseEntries: 0,
    adjustmentEntries: 0,
    skipped: {
      events: 0,
      members: 0,
      registrations: 0,
      attendances: 0,
      incomeEntries: 0,
      expenseEntries: 0,
      adjustmentEntries: 0,
    },
  };

  try {
    // Migrate in order (respecting foreign key constraints)
    stats.users = await migrateUsers();
    const membersResult = await migrateMembers();
    stats.members = membersResult.migrated;
    stats.skipped.members = membersResult.skipped;

    const eventsResult = await migrateEvents();
    stats.events = eventsResult.migrated;
    stats.skipped.events = eventsResult.skipped;

    const registrationsResult = await migrateRegistrations();
    stats.registrations = registrationsResult.migrated;
    stats.skipped.registrations = registrationsResult.skipped;

    const attendancesResult = await migrateAttendances();
    stats.attendances = attendancesResult.migrated;
    stats.skipped.attendances = attendancesResult.skipped;

    const accountingResult = await migrateAccounting();
    stats.incomeEntries = accountingResult.income.migrated;
    stats.expenseEntries = accountingResult.expense.migrated;
    stats.adjustmentEntries = accountingResult.adjustment.migrated;
    stats.skipped.incomeEntries = accountingResult.income.skipped;
    stats.skipped.expenseEntries = accountingResult.expense.skipped;
    stats.skipped.adjustmentEntries = accountingResult.adjustment.skipped;

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Migration Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📊 Migration Summary:');
    console.log(`   Users: ${stats.users}`);
    console.log(`   Members: ${stats.members} (${stats.skipped.members} dummy skipped)`);
    console.log(`   Events: ${stats.events} (${stats.skipped.events} dummy skipped)`);
    console.log(`   Registrations: ${stats.registrations} (${stats.skipped.registrations} dummy skipped)`);
    console.log(`   Attendances: ${stats.attendances} (${stats.skipped.attendances} dummy skipped)`);
    console.log(`   Income Entries: ${stats.incomeEntries} (${stats.skipped.incomeEntries} dummy skipped)`);
    console.log(`   Expense Entries: ${stats.expenseEntries} (${stats.skipped.expenseEntries} dummy skipped)`);
    console.log(`   Adjustment Entries: ${stats.adjustmentEntries} (${stats.skipped.adjustmentEntries} dummy skipped)`);
    console.log('');
    console.log('✅ Dummy data has been excluded from production');
    console.log('✅ Development database remains unchanged');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await devPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

main();
