import { describe, expect, it } from 'vitest';
import { formatAttendedHeld, formatPct, isLowPct, periodLabel } from './attendance-monitoring';

describe('attendance monitoring display helpers', () => {
  it('shows an em dash when no eligible sessions were held', () => {
    expect(formatPct(null)).toBe('—');
    expect(formatAttendedHeld(0, 0)).toBe('—');
    expect(formatAttendedHeld(3, 4)).toBe('3/4');
  });

  it('labels the period and flags follow-up under 50%', () => {
    expect(periodLabel(2026, 10)).toBe('October 2026');
    expect(periodLabel(2026, null)).toBe('2026');
    expect(isLowPct(33)).toBe(true);
    expect(isLowPct(50)).toBe(false);
    expect(isLowPct(null)).toBe(false);
  });
});
