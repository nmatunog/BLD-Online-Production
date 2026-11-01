import JSZip from 'jszip';
import {
  allowedPhotoHosts,
  buildPrintPackZip,
  csvCell,
  isAllowedPhotoUrl,
  PRINT_PACK_CSV_COLUMNS,
  printPackFileStem,
} from './member-card-print-pack';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPG = Buffer.from([0xff, 0xd8, 0xff]);

function card(overrides: Partial<{ memberId: string; fullName: string; firstName: string }> = {}) {
  return {
    memberId: 'CEB-ME1801',
    fullName: 'Juan Dela Cruz',
    nickname: 'Jun',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    bloodType: 'O+',
    verifyUrl: 'https://app.bldcebu.com/verify/tok',
    photo: JPG,
    qr: PNG,
    ...overrides,
  };
}

describe('print pack photo hosts', () => {
  it('only allows https photos on the ID photo CDN', () => {
    const hosts = allowedPhotoHosts();
    expect(isAllowedPhotoUrl('https://bld-idphotos.b-cdn.net/a.jpg', hosts)).toBe(true);
    expect(isAllowedPhotoUrl('http://bld-idphotos.b-cdn.net/a.jpg', hosts)).toBe(false);
    expect(isAllowedPhotoUrl('https://evil.example.com/a.jpg', hosts)).toBe(false);
    expect(isAllowedPhotoUrl('https://169.254.169.254/latest', hosts)).toBe(false);
    expect(isAllowedPhotoUrl('not a url', hosts)).toBe(false);
    expect(isAllowedPhotoUrl(null, hosts)).toBe(false);
  });

  it('adds the configured CDN host and ignores a malformed one', () => {
    expect(allowedPhotoHosts('https://photos.bldcebu.com')).toContain('photos.bldcebu.com');
    expect(allowedPhotoHosts('::bad::')).toEqual(['bld-idphotos.b-cdn.net']);
  });

  it('builds safe file names from member IDs', () => {
    expect(printPackFileStem('ceb-me1801')).toBe('CEB-ME1801');
    expect(printPackFileStem('../../etc/passwd')).toBe('ETCPASSWD');
    expect(printPackFileStem('')).toBe('member');
  });
});

describe('buildPrintPackZip', () => {
  it('packs cards.csv, photos, QR codes and a README', async () => {
    const zip = await JSZip.loadAsync(
      await buildPrintPackZip({
        cards: [card(), card({ memberId: 'CEB-ME1802', fullName: 'Ana "Ann" Peñaflor', firstName: 'Ana' })],
        skipped: [],
      }),
    );

    expect(Object.keys(zip.files).sort()).toEqual([
      'README.txt',
      'cards.csv',
      'photos/',
      'photos/CEB-ME1801.jpg',
      'photos/CEB-ME1802.jpg',
      'qr/',
      'qr/CEB-ME1801.png',
      'qr/CEB-ME1802.png',
    ]);

    const csv = await zip.file('cards.csv')!.async('string');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe(PRINT_PACK_CSV_COLUMNS.join(','));
    expect(lines[1]).toBe(
      'CEB-ME1801,Juan Dela Cruz,Jun,Juan,Dela Cruz,O+,photos/CEB-ME1801.jpg,qr/CEB-ME1801.png,https://app.bldcebu.com/verify/tok',
    );
    expect(lines[2]).toContain('"Ana ""Ann"" Peñaflor"');
    expect(csv).not.toMatch(/emergency|signature/i);

    const qr = await zip.file('qr/CEB-ME1801.png')!.async('nodebuffer');
    expect(qr.equals(PNG)).toBe(true);
    expect(zip.file('skipped.csv')).toBeNull();
  });

  it('lists skipped members and de-duplicates file names', async () => {
    const zip = await JSZip.loadAsync(
      await buildPrintPackZip({
        cards: [card(), card()],
        skipped: [{ memberId: 'bad-id', fullName: 'No Photo', reason: 'Not ready: missing photo' }],
      }),
    );
    expect(zip.file('photos/CEB-ME1801-2.jpg')).not.toBeNull();
    const skipped = await zip.file('skipped.csv')!.async('string');
    expect(skipped).toContain('bad-id,No Photo,Not ready: missing photo');
  });
});

describe('csvCell', () => {
  it('neutralises spreadsheet formulas from member-entered names', () => {
    expect(csvCell('=HYPERLINK("http://x","click")')).toBe('"\'=HYPERLINK(""http://x"",""click"")"');
    expect(csvCell('+63917')).toBe("'+63917");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tcmd')).toBe("'\tcmd");
    expect(csvCell('CEB-ME1801')).toBe('CEB-ME1801');
    expect(csvCell('O+')).toBe('O+');
    expect(csvCell('Dela Cruz, Jr.')).toBe('"Dela Cruz, Jr."');
  });
});
