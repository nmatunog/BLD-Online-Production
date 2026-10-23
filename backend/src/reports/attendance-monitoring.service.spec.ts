import { ForbiddenException } from '@nestjs/common';
import { EventKind, EventSeriesCode, EventStatus } from '@prisma/client';
import { buildManilaDateTime } from '../common/utils/manila-date.helper';
import { AttendanceMonitoringService } from './attendance-monitoring.service';

function mockPrisma(data: {
  members: Array<{
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    ministry: string | null;
  }>;
  events: Array<{
    id: string;
    startDate: Date;
    status: EventStatus;
    seriesCode: EventSeriesCode;
    ministry: string | null;
    eventKind: EventKind;
    checkIns: number;
  }>;
  attendance: Array<{ memberId: string; eventId: string }>;
}) {
  return {
    member: {
      findMany: jest.fn().mockImplementation(async ({ where }: { where?: { ministry?: string } }) => {
        const ministry = where?.ministry;
        return data.members.filter((m) => (ministry ? m.ministry === ministry : true));
      }),
    },
    event: {
      findMany: jest.fn().mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
        const or = where?.OR as Array<Record<string, unknown>> | undefined;
        return data.events
          .filter((event) => {
            if (!or) {
              const codes = (where?.seriesCode as { in?: EventSeriesCode[] } | undefined)?.in;
              return !codes || codes.includes(event.seriesCode);
            }
            return or.some((clause) => {
              if (clause.seriesCode === EventSeriesCode.CW) {
                return event.seriesCode === EventSeriesCode.CW;
              }
              if (clause.seriesCode === EventSeriesCode.WSC) {
                const ministryOr = clause.OR as Array<{ ministry?: string | null }> | undefined;
                if (!ministryOr) return event.seriesCode === EventSeriesCode.WSC;
                return (
                  event.seriesCode === EventSeriesCode.WSC &&
                  ministryOr.some((item) =>
                    Object.prototype.hasOwnProperty.call(item, 'ministry')
                      ? event.ministry === item.ministry
                      : true,
                  )
                );
              }
              return false;
            });
          })
          .map((event) => ({
            id: event.id,
            startDate: event.startDate,
            status: event.status,
            seriesCode: event.seriesCode,
            ministry: event.ministry,
            eventKind: event.eventKind,
            _count: { attendances: event.checkIns },
          }));
      }),
    },
    attendance: {
      findMany: jest.fn().mockImplementation(async ({ where }: { where?: { eventId?: { in?: string[] } } }) => {
        const ids = new Set(where?.eventId?.in ?? []);
        return data.attendance.filter((row) => ids.has(row.eventId));
      }),
    },
  };
}

describe('AttendanceMonitoringService auth', () => {
  const service = new AttendanceMonitoringService({} as never);

  it('rejects MEMBER role before querying data', async () => {
    await expect(service.getReport({ year: 2026, month: 10 }, { role: 'MEMBER' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects unauthenticated callers', async () => {
    await expect(service.getReport({ year: 2026 }, { role: null })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects ministry coordinators who have no ministry assigned', async () => {
    const serviceWithDb = new AttendanceMonitoringService(mockPrisma({
      members: [],
      events: [],
      attendance: [],
    }) as never);
    await expect(
      serviceWithDb.getReport({ year: 2026, month: 10 }, { role: 'MINISTRY_COORDINATOR' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AttendanceMonitoringService ministry scope', () => {
  const intercessoryMember = {
    id: 'm-int',
    firstName: 'Ana',
    lastName: 'Cruz',
    middleName: null,
    ministry: 'Intercessory Ministry',
  };
  const praiseMember = {
    id: 'm-praise',
    firstName: 'Ben',
    lastName: 'Reyes',
    middleName: null,
    ministry: 'Praise Ministry',
  };
  const cw = {
    id: 'cw-1',
    startDate: buildManilaDateTime(2026, 10, 6, 19, 0),
    status: EventStatus.COMPLETED,
    seriesCode: EventSeriesCode.CW,
    ministry: null,
    eventKind: EventKind.OCCURRENCE,
    checkIns: 2,
  };
  const wscIntercessory = {
    id: 'wsc-int',
    startDate: buildManilaDateTime(2026, 10, 7, 19, 0),
    status: EventStatus.COMPLETED,
    seriesCode: EventSeriesCode.WSC,
    ministry: 'Intercessory Ministry',
    eventKind: EventKind.OCCURRENCE,
    checkIns: 1,
  };
  const wscPraise = {
    id: 'wsc-praise',
    startDate: buildManilaDateTime(2026, 10, 8, 19, 0),
    status: EventStatus.COMPLETED,
    seriesCode: EventSeriesCode.WSC,
    ministry: 'Praise Ministry',
    eventKind: EventKind.OCCURRENCE,
    checkIns: 1,
  };

  it('does not leak other ministries to a scoped coordinator/export', async () => {
    const prisma = mockPrisma({
      members: [intercessoryMember, praiseMember],
      events: [cw, wscIntercessory, wscPraise],
      attendance: [
        { memberId: 'm-int', eventId: 'cw-1' },
        { memberId: 'm-int', eventId: 'wsc-int' },
        { memberId: 'm-praise', eventId: 'cw-1' },
        { memberId: 'm-praise', eventId: 'wsc-praise' },
      ],
    });
    const service = new AttendanceMonitoringService(prisma as never);
    const report = await service.getReport(
      { year: 2026, month: 10, ministry: 'Praise Ministry' },
      { role: 'MINISTRY_COORDINATOR', ministry: 'Intercessory Ministry' },
    );

    expect(report.ministry).toBe('Intercessory Ministry');
    expect(report.groups.map((g) => g.ministry)).toEqual(['Intercessory Ministry']);
    expect(report.groups[0].members.map((m) => m.id)).toEqual(['m-int']);
    expect(Object.keys(report.weeks.wscByMinistry)).toEqual(['Intercessory Ministry']);
    expect(report.summary.wscHeld).toBe(1);
    expect(report.summary.members).toBe(1);
    expect(JSON.stringify(report)).not.toContain('Praise Ministry');
    expect(JSON.stringify(report)).not.toContain('wsc-praise');
    expect(JSON.stringify(report)).not.toContain('m-praise');
  });
});
