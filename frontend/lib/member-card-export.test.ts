import { describe, expect, it } from 'vitest';
import { buildPrinterCsv, toPrinterRows } from './member-card-export';

describe('member-card-export', () => {
  it('builds a printer CSV with the approved columns', () => {
    const rows = toPrinterRows([
      {
        name: 'Juan Dela Cruz',
        communityId: 'CEB-ME01-0001',
        ministry: 'Worship',
        photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
        nfcUrl: 'https://app.bldcebu.com/verify/tok',
      },
    ]);
    const csv = buildPrinterCsv(rows);
    expect(csv).toContain('name,communityId,ministry,photoUrl,nfcUrl');
    expect(csv).toContain('Juan Dela Cruz');
    expect(csv).toContain('https://app.bldcebu.com/verify/tok');
  });
});
