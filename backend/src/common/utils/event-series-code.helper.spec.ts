import { EventSeriesCode } from '@prisma/client';
import { inferMinistryFromTitle, inferSeriesCode } from './event-series-code.helper';

describe('inferSeriesCode', () => {
  it('marks Community Worship and legacy Corporate Worship as CW', () => {
    expect(inferSeriesCode({ category: 'Community Worship', title: 'Community Worship' })).toBe(
      EventSeriesCode.CW,
    );
    expect(inferSeriesCode({ title: 'Corporate Worship' })).toBe(EventSeriesCode.CW);
    expect(inferSeriesCode({ title: 'CW', eventType: 'CW' })).toBe(EventSeriesCode.CW);
  });

  it('marks Word Sharing Circle as WSC without matching other titles', () => {
    expect(inferSeriesCode({ category: 'Word Sharing Circle', title: 'WSC - Service Ministry' })).toBe(
      EventSeriesCode.WSC,
    );
    expect(inferSeriesCode({ title: 'LSS Shepherding Session 1', category: 'Formation' })).toBe(
      EventSeriesCode.OTHER,
    );
  });
});

describe('inferMinistryFromTitle', () => {
  it('uses the longest official ministry name in the title', () => {
    expect(inferMinistryFromTitle('WSC - Intercessory Ministry')).toBe('Intercessory Ministry');
    expect(inferMinistryFromTitle('WSC - Prayer Counseling and Healing Services (PCHS)')).toBe(
      'Prayer Counseling and Healing Services (PCHS)',
    );
  });
});
