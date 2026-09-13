/**
 * Manila Date Helper Tests
 * 
 * Ensure Manila timezone conversions are correct and prevent the Tuesday→Wednesday bug
 */

import {
  toManilaDateString,
  getManilaWeekday,
  buildManilaDateTime,
  getNextWeekdayManila,
  isInBlackoutPeriod,
  isHolyMassTuesday,
  addDaysManila,
} from './manila-date.helper';

describe('Manila Date Helpers', () => {
  describe('toManilaDateString', () => {
    it('should format UTC date correctly in Manila timezone', () => {
      // Sep 15, 2026 11:00 UTC = Sep 15, 2026 19:00 Manila
      const date = new Date('2026-09-15T11:00:00.000Z');
      expect(toManilaDateString(date)).toBe('2026-09-15');
    });

    it('should handle date crossing midnight in Manila', () => {
      // Sep 15, 2026 16:00 UTC = Sep 16, 2026 00:00 Manila (next day!)
      const date = new Date('2026-09-15T16:00:00.000Z');
      expect(toManilaDateString(date)).toBe('2026-09-16');
    });
  });

  describe('getManilaWeekday', () => {
    it('should return Tuesday for Sep 15, 2026 in Manila', () => {
      // Sep 15, 2026 is a Tuesday in Manila (regardless of UTC time)
      const date = new Date('2026-09-15T11:00:00.000Z'); // 19:00 Manila
      expect(getManilaWeekday(date)).toBe('Tuesday');
    });

    it('should return Wednesday when date crosses midnight', () => {
      // Sep 15, 2026 16:00 UTC = Sep 16, 2026 00:00 Manila (Wednesday!)
      const date = new Date('2026-09-15T16:00:00.000Z');
      expect(getManilaWeekday(date)).toBe('Wednesday');
    });
  });

  describe('buildManilaDateTime', () => {
    it('should build correct UTC date for Tuesday Sep 15, 2026 19:00 Manila', () => {
      const date = buildManilaDateTime(2026, 9, 15, 19, 0);
      
      // Should be stored as 11:00 UTC (19:00 - 8 hours)
      expect(date.toISOString()).toBe('2026-09-15T11:00:00.000Z');
      
      // Must be Tuesday in Manila
      expect(getManilaWeekday(date)).toBe('Tuesday');
      expect(toManilaDateString(date)).toBe('2026-09-15');
    });

    it('should build correct dates for multiple Tuesdays', () => {
      const tuesdays = [
        buildManilaDateTime(2026, 9, 15, 19, 0),
        buildManilaDateTime(2026, 9, 22, 19, 0),
        buildManilaDateTime(2026, 9, 29, 19, 0),
        buildManilaDateTime(2026, 10, 6, 19, 0),
      ];

      tuesdays.forEach((date, index) => {
        expect(getManilaWeekday(date)).toBe('Tuesday');
        console.log(`CW ${index + 1}: ${toManilaDateString(date)} ${getManilaWeekday(date)}`);
      });
    });
  });

  describe('getNextWeekdayManila', () => {
    it('should get next Tuesday from Saturday Sep 13, 2026', () => {
      // Sep 13, 2026 is a Saturday in Manila
      const saturday = new Date('2026-09-13T10:00:00.000Z'); // 18:00 Manila
      const nextTuesday = getNextWeekdayManila(saturday, 2, 19, 0); // Tuesday = 2
      
      expect(getManilaWeekday(nextTuesday)).toBe('Tuesday');
      expect(toManilaDateString(nextTuesday)).toBe('2026-09-15');
      
      // Verify it's 19:00 Manila (11:00 UTC)
      expect(nextTuesday.toISOString()).toBe('2026-09-15T11:00:00.000Z');
    });

    it('should get next occurrence one week later if already past that day', () => {
      // Sep 16, 2026 is a Wednesday
      const wednesday = new Date('2026-09-16T10:00:00.000Z');
      const nextTuesday = getNextWeekdayManila(wednesday, 2, 19, 0);
      
      // Should be Sep 22, 2026 (next Tuesday)
      expect(getManilaWeekday(nextTuesday)).toBe('Tuesday');
      expect(toManilaDateString(nextTuesday)).toBe('2026-09-22');
    });
  });

  describe('isInBlackoutPeriod', () => {
    it('should return true for Dec 24-31 and Jan 1', () => {
      expect(isInBlackoutPeriod(new Date('2025-12-24T12:00:00+08:00'))).toBe(true);
      expect(isInBlackoutPeriod(new Date('2025-12-31T12:00:00+08:00'))).toBe(true);
      expect(isInBlackoutPeriod(new Date('2026-01-01T12:00:00+08:00'))).toBe(true);
    });

    it('should return false for other dates', () => {
      expect(isInBlackoutPeriod(new Date('2025-12-23T12:00:00+08:00'))).toBe(false);
      expect(isInBlackoutPeriod(new Date('2026-01-02T12:00:00+08:00'))).toBe(false);
    });
  });

  describe('isHolyMassTuesday', () => {
    it('should return true for 1st and 3rd Tuesdays', () => {
      // Sep 2026: 1st=1, 3rd=15, 2nd=8, 4th=22
      expect(isHolyMassTuesday(buildManilaDateTime(2026, 9, 1, 19, 0))).toBe(true);  // 1st
      expect(isHolyMassTuesday(buildManilaDateTime(2026, 9, 15, 19, 0))).toBe(true); // 3rd
    });

    it('should return false for 2nd and 4th Tuesdays', () => {
      expect(isHolyMassTuesday(buildManilaDateTime(2026, 9, 8, 19, 0))).toBe(false);  // 2nd
      expect(isHolyMassTuesday(buildManilaDateTime(2026, 9, 22, 19, 0))).toBe(false); // 4th
    });
  });

  describe('addDaysManila', () => {
    it('should add 7 days while preserving Manila time', () => {
      const tuesday1 = buildManilaDateTime(2026, 9, 15, 19, 0);
      const tuesday2 = addDaysManila(tuesday1, 7);
      
      expect(getManilaWeekday(tuesday2)).toBe('Tuesday');
      expect(toManilaDateString(tuesday2)).toBe('2026-09-22');
      
      // Time should still be 19:00 Manila (11:00 UTC)
      expect(tuesday2.getUTCHours()).toBe(11);
      expect(tuesday2.getUTCMinutes()).toBe(0);
    });

    it('should add multiple weeks correctly', () => {
      let current = buildManilaDateTime(2026, 9, 15, 19, 0);
      
      for (let i = 0; i < 4; i++) {
        expect(getManilaWeekday(current)).toBe('Tuesday');
        current = addDaysManila(current, 7);
      }
    });
  });
});
