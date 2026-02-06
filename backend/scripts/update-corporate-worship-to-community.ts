/**
 * One-off: update Event.category from "Corporate Worship" to "Community Worship" in the DB.
 *
 * Run against production:
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/update-corporate-worship-to-community.ts
 *
 * Or with Railway CLI (from repo root):
 *   cd backend && npx @railway/cli run --service <your-backend-service> npx ts-node scripts/update-corporate-worship-to-community.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const r1 = await prisma.$executeRaw`
    UPDATE "Event" SET category = 'Community Worship' WHERE category = 'Corporate Worship'
  `;
  const r2 = await prisma.$executeRaw`
    UPDATE "Event" SET category = 'Community Worship' WHERE category = 'Corporate Worship (Weekly Recurring)'
  `;
  const total = Number(r1) + Number(r2);
  console.log(`Updated ${total} event(s) from Corporate Worship to Community Worship.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
