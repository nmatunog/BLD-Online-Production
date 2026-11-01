/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPrinterCsv, downloadBytes, toPrinterRows } from './member-card-export';

describe('member-card-export', () => {
  it('builds a printer CSV with the ID-print columns', () => {
    const rows = toPrinterRows([
      {
        memberId: 'CEB-ME1801',
        fullName: 'Juan Dela Cruz',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        bloodType: 'O+',
        photoUrl: 'https://bld-idphotos.b-cdn.net/juan.jpg',
        verifyUrl: 'https://app.bldcebu.com/verify/tok',
      },
      {
        memberId: 'CEB-ME1802',
        fullName: 'Maria Santos',
        firstName: 'Maria',
        lastName: 'Santos',
        bloodType: '',
        signatureUrl: '',
        photoUrl: '',
        verifyUrl: '',
      },
    ]);
    const csv = buildPrinterCsv(rows);
    expect(csv).toContain(
      'memberId,fullName,firstName,lastName,bloodType,signatureUrl,photoUrl,verifyUrl',
    );
    expect(csv).toContain('CEB-ME1801,Juan Dela Cruz,Juan,Dela Cruz,O+');
    expect(csv).toContain('https://app.bldcebu.com/verify/tok');
    expect(csv).toContain('CEB-ME1802,Maria Santos,Maria,Santos');
    expect(csv).not.toContain('ministry');
    expect(csv).not.toContain('cardStatus');
    expect(csv).not.toMatch(/emergency/i);
  });
});

describe('downloadBytes', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses navigator.share when canShare({ files }) is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    const createObjectURL = vi.fn(() => 'blob:unused');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });

    await downloadBytes('bld-id-print.csv', 'memberId\n', 'text/csv;charset=utf-8');

    expect(canShare).toHaveBeenCalledWith(expect.objectContaining({ files: expect.any(Array) }));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.any(Array),
        title: 'bld-id-print.csv',
      }),
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('falls back to an anchor download and revokes the object URL after about 1s', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    const createObjectURL = vi.fn(() => 'blob:cards');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    const click = vi.fn();
    const link = {
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement;
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    await downloadBytes('bld-id-print.csv', 'memberId\n', 'text/csv;charset=utf-8');

    expect(createObjectURL).toHaveBeenCalled();
    expect(link.download).toBe('bld-id-print.csv');
    expect(click).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cards');
  });
});
