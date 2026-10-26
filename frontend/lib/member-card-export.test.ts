import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPrinterCsv, downloadBytes, toPrinterRows } from './member-card-export';

describe('member-card-export', () => {
  it('builds a printer CSV with the approved columns including cardStatus', () => {
    const rows = toPrinterRows([
      {
        name: 'Juan Dela Cruz',
        communityId: 'CEB-ME01-0001',
        ministry: 'Worship',
        photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
        nfcUrl: 'https://app.bldcebu.com/verify/tok',
        cardStatus: 'ACTIVE',
      },
      {
        name: 'Maria Santos',
        communityId: 'CEB-ME01-0002',
        ministry: 'Music Ministry',
        photoUrl: '',
        nfcUrl: '',
        cardStatus: '',
      },
    ]);
    const csv = buildPrinterCsv(rows);
    expect(csv).toContain('name,communityId,ministry,photoUrl,nfcUrl,cardStatus');
    expect(csv).toContain('Juan Dela Cruz');
    expect(csv).toContain('https://app.bldcebu.com/verify/tok');
    expect(csv).toContain('ACTIVE');
    expect(csv).toContain('Maria Santos');
  });
});

describe('downloadBytes', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses navigator.share when canShare({ files }) is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, canShare, share });
    const createObjectURL = vi.fn(() => 'blob:unused');
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);

    await downloadBytes('bld-nfc-cards.csv', 'name\n', 'text/csv;charset=utf-8');

    expect(canShare).toHaveBeenCalledWith(expect.objectContaining({ files: expect.any(Array) }));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.any(Array),
        title: 'bld-nfc-cards.csv',
      }),
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('falls back to an anchor download and revokes the object URL after about 1s', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { ...navigator, canShare: undefined, share: undefined });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cards');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.fn();
    const link = {
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement;
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    await downloadBytes('bld-nfc-cards.csv', 'name\n', 'text/csv;charset=utf-8');

    expect(createObjectURL).toHaveBeenCalled();
    expect(link.download).toBe('bld-nfc-cards.csv');
    expect(click).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cards');
  });
});
