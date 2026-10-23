import { EventSeriesCode, EventStatus } from '@prisma/client';
import { buildManilaDateTime, getManilaDateParts } from '../common/utils/manila-date.helper';
import {
  attendancePct,
  averagePct,
  countAttendedHeld,
  countAttendedHeldFromEvents,
  eventsInManilaMonth,
  formatMemberReportName,
  isSessionHeld,
  mapMonthWeekSlots,
  needsFollowUp,
  resolveAttendanceMonitoringMinistry,
  sessionStatus,
  weekMarkForMember,
  wscEventsForMinistry,
  type SessionEventInput,
} from './attendance-monitoring.helpers';

function session(
  overrides: Partial<SessionEventInput> & Pick<SessionEventInput, 'id' | 'startDate'>,
): SessionEventInput {
  return {
    status: EventStatus.COMPLETED,
    seriesCode: EventSeriesCode.CW,
    ministry: null,
    eventKind: 'OCCURRENCE',
    checkInCount: 1,
    ...overrides,
  };
}

describe('attendance-monitoring helpers', () => {
  describe('held session rule', () => {
    it('counts a session as held only when it is not cancelled and has a check-in', () => {
      expect(isSessionHeld({ status: EventStatus.COMPLETED, checkInCount: 1 })).toBe(true);
      expect(isSessionHeld({ status: EventStatus.UPCOMING, checkInCount: 2 })).toBe(true);
      expect(isSessionHeld({ status: EventStatus.CANCELLED, checkInCount: 3 })).toBe(false);
      expect(isSessionHeld({ status: EventStatus.COMPLETED, checkInCount: 0 })).toBe(false);
      expect(sessionStatus({ status: EventStatus.CANCELLED, checkInCount: 0 })).toBe('cancelled');
      expect(sessionStatus({ status: EventStatus.COMPLETED, checkInCount: 0 })).toBe('not_held');
    });
  });

  describe('percent', () => {
    it('divides attended by sessions held and rounds half-up', () => {
      expect(attendancePct(2, 3)).toBe(67);
      expect(attendancePct(1, 2)).toBe(50);
      expect(attendancePct(0, 4)).toBe(0);
      expect(attendancePct(3, 0)).toBeNull();
    });

    it('averages only members who have a percentage', () => {
      expect(averagePct([100, 50, null])).toBe(75);
      expect(averagePct([null, null])).toBeNull();
    });
  });

  describe('week mapping', () => {
    it('maps a 5-Tuesday month as weeks 1–5 in Manila order', () => {
      const march2026: SessionEventInput[] = [3, 10, 17, 24, 31].map((day) =>
        session({
          id: `cw-${day}`,
          startDate: buildManilaDateTime(2026, 3, day, 19, 0),
          checkInCount: 1,
        }),
      );
      const slots = mapMonthWeekSlots(march2026);
      expect(slots).toHaveLength(5);
      expect(slots.map((s) => s.date)).toEqual([
        '2026-03-03',
        '2026-03-10',
        '2026-03-17',
        '2026-03-24',
        '2026-03-31',
      ]);
      expect(slots[0].week).toBe(1);
    });

    it('excludes a cancelled CW from the denominator but keeps a cancelled week slot', () => {
      const events: SessionEventInput[] = [
        session({
          id: 'held-1',
          startDate: buildManilaDateTime(2026, 10, 6, 19, 0),
          checkInCount: 4,
        }),
        session({
          id: 'cancelled',
          startDate: buildManilaDateTime(2026, 10, 13, 19, 0),
          status: EventStatus.CANCELLED,
          checkInCount: 0,
        }),
        session({
          id: 'held-2',
          startDate: buildManilaDateTime(2026, 10, 20, 19, 0),
          checkInCount: 2,
        }),
      ];
      const slots = mapMonthWeekSlots(events);
      expect(slots.map((s) => s.status)).toEqual(['held', 'cancelled', 'held']);

      const attended = new Set(['held-1']);
      const stats = countAttendedHeld(slots, attended);
      expect(stats.held).toBe(2);
      expect(stats.attended).toBe(1);
      expect(stats.pct).toBe(50);
      expect(stats.weeks).toEqual(['attended', 'cancelled', 'absent']);
    });

    it('treats a check-in at 23:30 Manila on the last day of the month as that month', () => {
      const checkIn = buildManilaDateTime(2026, 10, 31, 23, 30);
      const parts = getManilaDateParts(checkIn);
      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(10);
      expect(parts.day).toBe(31);

      const utcWouldBeNovember = checkIn.toISOString().startsWith('2026-10-31');
      expect(utcWouldBeNovember).toBe(true);

      const event = session({
        id: 'late',
        startDate: checkIn,
        checkInCount: 1,
      });
      const inOctober = eventsInManilaMonth([event], 2026, 10);
      const inNovember = eventsInManilaMonth([event], 2026, 11);
      expect(inOctober).toHaveLength(1);
      expect(inNovember).toHaveLength(0);
    });

    it('counts duplicate AM/PM session slots as one attendance for the event', () => {
      const event = session({
        id: 'cw-1',
        startDate: buildManilaDateTime(2026, 10, 6, 19, 0),
        checkInCount: 2,
      });
      const attendedEventIds = new Set(['cw-1']);
      const stats = countAttendedHeldFromEvents([event], attendedEventIds);
      expect(stats.attended).toBe(1);
      expect(stats.held).toBe(1);
    });

    it('returns n/a when a member has no WSC events', () => {
      const cwOnly = [
        session({
          id: 'cw-1',
          startDate: buildManilaDateTime(2026, 10, 6, 19, 0),
          seriesCode: EventSeriesCode.CW,
        }),
      ];
      expect(wscEventsForMinistry(cwOnly, 'Music Ministry')).toEqual([]);
      const stats = countAttendedHeldFromEvents([], new Set());
      expect(stats.held).toBe(0);
      expect(stats.pct).toBeNull();
    });

    it('uses dedicated ministry WSC events, then falls back to general WSC', () => {
      const events: SessionEventInput[] = [
        session({
          id: 'wsc-music',
          startDate: buildManilaDateTime(2026, 10, 7, 19, 0),
          seriesCode: EventSeriesCode.WSC,
          ministry: 'Music Ministry',
        }),
        session({
          id: 'wsc-general',
          startDate: buildManilaDateTime(2026, 10, 8, 19, 0),
          seriesCode: EventSeriesCode.WSC,
          ministry: null,
        }),
      ];
      expect(wscEventsForMinistry(events, 'Music Ministry').map((e) => e.id)).toEqual(['wsc-music']);
      expect(wscEventsForMinistry(events, 'Couples Ministry').map((e) => e.id)).toEqual([
        'wsc-general',
      ]);
    });

    it('marks not-held weeks as n/a', () => {
      const slot = {
        week: 1,
        date: '2026-10-06',
        eventId: 'empty',
        status: 'not_held' as const,
      };
      expect(weekMarkForMember(slot, new Set())).toBe('n/a');
    });
  });

  describe('follow-up and names', () => {
    it('flags members under 50% on CW or WSC', () => {
      expect(needsFollowUp(33, 100)).toBe(true);
      expect(needsFollowUp(100, 25)).toBe(true);
      expect(needsFollowUp(50, 75)).toBe(false);
      expect(needsFollowUp(null, null)).toBe(false);
    });

    it('formats Last, First M.', () => {
      expect(
        formatMemberReportName({ lastName: 'Santos', firstName: 'Maria', middleName: 'Alicia' }),
      ).toBe('Santos, Maria A.');
      expect(formatMemberReportName({ lastName: 'Reyes', firstName: 'Jose' })).toBe('Reyes, Jose');
    });
  });

  describe('auth scope', () => {
    it('rejects members and scopes ministry coordinators', () => {
      expect(resolveAttendanceMonitoringMinistry({ role: 'MEMBER' }, 'Music Ministry')).toEqual({
        ministry: null,
        forbidden: true,
      });
      expect(
        resolveAttendanceMonitoringMinistry(
          { role: 'MINISTRY_COORDINATOR', ministry: 'Intercessory Ministry' },
          'Music Ministry',
        ),
      ).toEqual({ ministry: 'Intercessory Ministry', forbidden: false });
      expect(
        resolveAttendanceMonitoringMinistry({ role: 'ADMINISTRATOR' }, 'Music Ministry'),
      ).toEqual({ ministry: 'Music Ministry', forbidden: false });
      expect(resolveAttendanceMonitoringMinistry({ role: 'DCS' }, undefined)).toEqual({
        ministry: null,
        forbidden: false,
      });
    });
  });
});
