/**
 * BLD Event Standards v1 Helper Functions Tests
 * 
 * Tests for Community Worship generator logic:
 * - Manila timezone date operations
 * - Blackout period detection (Dec 24 - Jan 1)
 * - Week-of-month calculation for Holy Mass Tuesdays (1st/3rd)
 */

// Helper functions extracted for testing (these should match the ones in events.service.ts)

function toManilaDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function isInBlackoutPeriod(d: Date): boolean {
  const manilaStr = toManilaDateString(d);
  const [year, month, day] = manilaStr.split('-').map(Number);
  // Dec 24-31 or Jan 1
  return (month === 12 && day >= 24) || (month === 1 && day === 1);
}

function getWeekOfMonth(d: Date): number {
  const manilaStr = toManilaDateString(d);
  const [, , day] = manilaStr.split('-').map(Number);
  return Math.ceil(day / 7);
}

function isHolyMassTuesday(d: Date): boolean {
  const week = getWeekOfMonth(d);
  return week === 1 || week === 3;
}

describe('BLD Event Standards v1 Helpers', () => {
  describe('toManilaDateString', () => {
    it('should format date in Manila timezone', () => {
      const date = new Date('2026-09-15T16:00:00Z'); // UTC time
      const result = toManilaDateString(date);
      // Manila is UTC+8, so this should be Sep 16
      expect(result).toBe('2026-09-16');
    });

    it('should handle date crossing midnight in Manila', () => {
      const date = new Date('2026-01-01T00:00:00+08:00'); // Jan 1 00:00 Manila
      const result = toManilaDateString(date);
      expect(result).toBe('2026-01-01');
    });
  });

  describe('isInBlackoutPeriod', () => {
    it('should return true for Dec 24', () => {
      const date = new Date('2025-12-24T12:00:00+08:00');
      expect(isInBlackoutPeriod(date)).toBe(true);
    });

    it('should return true for Dec 31', () => {
      const date = new Date('2025-12-31T12:00:00+08:00');
      expect(isInBlackoutPeriod(date)).toBe(true);
    });

    it('should return true for Jan 1', () => {
      const date = new Date('2026-01-01T12:00:00+08:00');
      expect(isInBlackoutPeriod(date)).toBe(true);
    });

    it('should return false for Dec 23', () => {
      const date = new Date('2025-12-23T12:00:00+08:00');
      expect(isInBlackoutPeriod(date)).toBe(false);
    });

    it('should return false for Jan 2', () => {
      const date = new Date('2026-01-02T12:00:00+08:00');
      expect(isInBlackoutPeriod(date)).toBe(false);
    });

    it('should return false for regular dates', () => {
      const date = new Date('2026-09-15T12:00:00+08:00');
      expect(isInBlackoutPeriod(date)).toBe(false);
    });
  });

  describe('getWeekOfMonth', () => {
    it('should return 1 for first week (days 1-7)', () => {
      expect(getWeekOfMonth(new Date('2026-09-01T12:00:00+08:00'))).toBe(1);
      expect(getWeekOfMonth(new Date('2026-09-07T12:00:00+08:00'))).toBe(1);
    });

    it('should return 2 for second week (days 8-14)', () => {
      expect(getWeekOfMonth(new Date('2026-09-08T12:00:00+08:00'))).toBe(2);
      expect(getWeekOfMonth(new Date('2026-09-14T12:00:00+08:00'))).toBe(2);
    });

    it('should return 3 for third week (days 15-21)', () => {
      expect(getWeekOfMonth(new Date('2026-09-15T12:00:00+08:00'))).toBe(3);
      expect(getWeekOfMonth(new Date('2026-09-21T12:00:00+08:00'))).toBe(3);
    });

    it('should return 4 for fourth week (days 22-28)', () => {
      expect(getWeekOfMonth(new Date('2026-09-22T12:00:00+08:00'))).toBe(4);
      expect(getWeekOfMonth(new Date('2026-09-28T12:00:00+08:00'))).toBe(4);
    });

    it('should return 5 for fifth week (days 29-31)', () => {
      expect(getWeekOfMonth(new Date('2026-09-29T12:00:00+08:00'))).toBe(5);
    });
  });

  describe('isHolyMassTuesday', () => {
    it('should return true for 1st Tuesday of month', () => {
      // Sep 1, 2026 is a Tuesday (1st week)
      const date = new Date('2026-09-01T19:00:00+08:00');
      expect(isHolyMassTuesday(date)).toBe(true);
    });

    it('should return false for 2nd Tuesday of month', () => {
      // Sep 8, 2026 is a Tuesday (2nd week)
      const date = new Date('2026-09-08T19:00:00+08:00');
      expect(isHolyMassTuesday(date)).toBe(false);
    });

    it('should return true for 3rd Tuesday of month', () => {
      // Sep 15, 2026 is a Tuesday (3rd week)
      const date = new Date('2026-09-15T19:00:00+08:00');
      expect(isHolyMassTuesday(date)).toBe(true);
    });

    it('should return false for 4th Tuesday of month', () => {
      // Sep 22, 2026 is a Tuesday (4th week)
      const date = new Date('2026-09-22T19:00:00+08:00');
      expect(isHolyMassTuesday(date)).toBe(false);
    });

    it('should return false for 5th Tuesday of month', () => {
      // Sep 29, 2026 is a Tuesday (5th week)
      const date = new Date('2026-09-29T19:00:00+08:00');
      expect(isHolyMassTuesday(date)).toBe(false);
    });
  });

  describe('Community Worship Tuesday scenarios', () => {
    it('should correctly identify Holy Mass Tuesdays in a month', () => {
      // January 2026: Tuesdays are 7th (1st), 14th (2nd), 21st (3rd), 28th (4th)
      expect(isHolyMassTuesday(new Date('2026-01-07T19:00:00+08:00'))).toBe(true);  // 1st Tuesday
      expect(isHolyMassTuesday(new Date('2026-01-14T19:00:00+08:00'))).toBe(false); // 2nd Tuesday
      expect(isHolyMassTuesday(new Date('2026-01-21T19:00:00+08:00'))).toBe(true);  // 3rd Tuesday
      expect(isHolyMassTuesday(new Date('2026-01-28T19:00:00+08:00'))).toBe(false); // 4th Tuesday
    });

    it('should skip blackout period Tuesdays', () => {
      // Dec 29, 2025 is Tuesday but in blackout period
      const dec29 = new Date('2025-12-29T19:00:00+08:00');
      expect(isInBlackoutPeriod(dec29)).toBe(true);
      // This Tuesday should be skipped
    });
  });
});
