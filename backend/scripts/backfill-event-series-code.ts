/**
 * Dry-run / apply report for Event.seriesCode and WSC ministry backfill.
 * Does not run against production unless DATABASE_URL is explicitly provided.
 *
 * Usage:
 *   npx ts-node scripts/backfill-event-series-code.ts
 *   npx ts-node scripts/backfill-event-series-code.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import { inferMinistryFromTitle, inferSeriesCode } from '../src/common/utils/event-series-code.helper';

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  const events = await prisma.event.findMany({
    select: { id: true, title: true, category: true, eventType: true, ministry: true, seriesCode: true },
  });

  let cw = 0;
  let wsc = 0;
  let ministryFilled = 0;
  const samples: Array<{ id: string; title: string; from: string; to: string; ministry?: string }> = [];

  for (const event of events) {
    const inferred = inferSeriesCode(event);
    const ministry = event.ministry || (inferred === 'WSC' ? inferMinistryFromTitle(event.title) : null);
    if (inferred === 'CW') cw += 1;
    if (inferred === 'WSC') wsc += 1;
    if (!event.ministry && ministry) ministryFilled += 1;
    if (event.seriesCode !== inferred || (!event.ministry && ministry)) {
      if (samples.length < 20) {
        samples.push({
          id: event.id,
          title: event.title,
          from: event.seriesCode,
          to: inferred,
          ministry: ministry || undefined,
        });
      }
    }
    if (apply && (event.seriesCode !== inferred || (!event.ministry && ministry))) {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          seriesCode: inferred,
          ...(ministry && !event.ministry ? { ministry } : {}),
        },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        totalEvents: events.length,
        inferredCw: cw,
        inferredWsc: wsc,
        ministryFilled,
        samples,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
