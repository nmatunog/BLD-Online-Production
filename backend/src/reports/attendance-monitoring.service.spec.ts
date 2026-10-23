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
    attendanceStartDate?: Date | null;
    createdAt?: Date;
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
  attendance: Array<{ memberId: string; eventId: string; checkInTime?: Date }>;
  history?: Array<{
    memberId: string;
    ministry: string;
    startDate: Date;
    endDate: Date | null;
  }>;
}) {
  const createdAtFallback = buildManilaDateTime(2026, 1, 6, 8, 0);
  return {
    member: {
      findMany: jest.fn().mockImplementation(async () =>
        data.members.map((member) => ({
          ...member,
          attendanceStartDate: member.attendanceStartDate ?? null,
          createdAt: member.createdAt ?? createdAtFallback,
        })),
      ),
    },
    event: {
      findMany: jest.fn().mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
        const codes = (where?.seriesCode as { in?: EventSeriesCode[] } | undefined)?.in;
        return data.events
          .filter((event) => !codes || codes.includes(event.seriesCode))
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
      groupBy: jest.fn().mockImplementation(async () => {
        const earliest = new Map<string, Date>();
        for (const row of data.attendance) {
          const time = row.checkInTime ?? buildManilaDateTime(2026, 10, 6, 19, 0);
          const current = earliest.get(row.memberId);
          if (!current || time < current) earliest.set(row.memberId, time);
        }
        return [...earliest.entries()].map(([memberId, checkInTime]) => ({
          memberId,
          _min: { checkInTime },
        }));
      }),
    },
    memberMinistryHistory: {
      findMany: jest.fn().mockResolvedValue(data.history ?? []),
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

describe('AttendanceMonitoringService start date and transfers', () => {
  const cwJan = {
    id: 'cw-jan',
    startDate: buildManilaDateTime(2026, 1, 6, 19, 0),
    status: EventStatus.COMPLETED,
    seriesCode: EventSeriesCode.CW,
    ministry: null,
    eventKind: EventKind.OCCURRENCE,
    checkIns: 3,
  };
  const cwOct = {
    id: 'cw-oct',
    startDate: buildManilaDateTime(2026, 10, 6, 19, 0),
    status: EventStatus.COMPLETED,
    seriesCode: EventSeriesCode.CW,
    ministry: null,
    eventKind: EventKind.OCCURRENCE,
    checkIns: 2,
  };
  const wscMusicOct = {
    id: 'wsc-music-oct',
    startDate: buildManilaDateTime(2026, 10, 5, 19, 0),
    status: EventStatus.COMPLETED,
    seriesCode: EventSeriesCode.WSC,
    ministry: 'Music Ministry',
    eventKind: EventKind.OCCURRENCE,
    checkIns: 1,
  };
  const wscPraiseEarly = {
    id: 'wsc-praise-early',
    startDate: buildManilaDateTime(2026, 10, 6, 19, 0),
    status: EventStatus.COMPLETED,
    seriesCode: EventSeriesCode.WSC,
    ministry: 'Praise Ministry',
    eventKind: EventKind.OCCURRENCE,
    checkIns: 1,
  };
  const wscPraiseOct = {
    id: 'wsc-praise-oct',
    startDate: buildManilaDateTime(2026, 10, 13, 19, 0),
    status: EventStatus.COMPLETED,
    seriesCode: EventSeriesCode.WSC,
    ministry: 'Praise Ministry',
    eventKind: EventKind.OCCURRENCE,
    checkIns: 1,
  };

  it('does not score CW sessions before the community start and does not flag follow-up', async () => {
    const prisma = mockPrisma({
      members: [
        {
          id: 'm-new',
          firstName: 'Liza',
          lastName: 'Tan',
          ministry: 'Music Ministry',
          attendanceStartDate: buildManilaDateTime(2026, 10, 1, 0, 0),
          createdAt: buildManilaDateTime(2026, 10, 1, 8, 0),
        },
      ],
      events: [cwJan, cwOct, wscMusicOct],
      attendance: [{ memberId: 'm-new', eventId: 'cw-oct', checkInTime: buildManilaDateTime(2026, 10, 6, 19, 0) }],
    });
    const service = new AttendanceMonitoringService(prisma as never);
    const report = await service.getReport(
      { year: 2026, month: 10 },
      { role: 'ADMINISTRATOR' },
    );
    const member = report.groups[0].members[0];
    expect(member.effectiveCommunityStart).toBe('2026-10-01');
    expect(member.ytdCw.held).toBe(1);
    expect(member.ytdCw.pct).toBe(100);
    expect(member.needsFollowUp).toBe(false);
    expect(member.cw.weeks.includes('not_yet_member') || member.ytdCw.held === 1).toBe(true);
  });

  it('groups a transferred member under the period-end ministry and carries prior WSC attendance', async () => {
    const prisma = mockPrisma({
      members: [
        {
          id: 'm-xfer',
          firstName: 'Carlo',
          lastName: 'Uy',
          ministry: 'Praise Ministry',
        },
      ],
      events: [cwOct, wscMusicOct, wscPraiseEarly, wscPraiseOct],
      attendance: [
        { memberId: 'm-xfer', eventId: 'wsc-music-oct', checkInTime: buildManilaDateTime(2026, 10, 5, 19, 0) },
      ],
      history: [
        {
          memberId: 'm-xfer',
          ministry: 'Music Ministry',
          startDate: buildManilaDateTime(2026, 1, 6, 0, 0),
          endDate: buildManilaDateTime(2026, 10, 6, 0, 0),
        },
        {
          memberId: 'm-xfer',
          ministry: 'Praise Ministry',
          startDate: buildManilaDateTime(2026, 10, 7, 0, 0),
          endDate: null,
        },
      ],
    });
    const service = new AttendanceMonitoringService(prisma as never);
    const praiseView = await service.getReport(
      { year: 2026, month: 10 },
      { role: 'ADMINISTRATOR' },
    );
    expect(praiseView.groups.map((g) => g.ministry)).toEqual(['Praise Ministry']);
    const row = praiseView.groups[0].members[0];
    expect(row.ministryNote).toContain('Joined Praise Ministry on');
    expect(row.wsc.held).toBe(2);
    expect(row.wsc.attended).toBe(1);
    expect(row.wsc.pct).toBe(50);
    expect(row.wsc.weeks).toContain('attended');
    expect(row.wsc.weekMinistries).toContain('Music Ministry');

    const musicCoordinator = await service.getReport(
      { year: 2026, month: 10 },
      { role: 'MINISTRY_COORDINATOR', ministry: 'Music Ministry' },
    );
    expect(musicCoordinator.groups).toEqual([]);
    expect(JSON.stringify(musicCoordinator)).not.toContain('m-xfer');
  });

  it('shows em dash percent when a member has no eligible sessions yet', async () => {
    const prisma = mockPrisma({
      members: [
        {
          id: 'm-future',
          firstName: 'Nina',
          lastName: 'Go',
          ministry: 'Music Ministry',
          createdAt: buildManilaDateTime(2026, 11, 1, 8, 0),
        },
      ],
      events: [cwOct, wscMusicOct],
      attendance: [],
    });
    const service = new AttendanceMonitoringService(prisma as never);
    const report = await service.getReport(
      { year: 2026, month: 10 },
      { role: 'ADMINISTRATOR' },
    );
    const row = report.groups[0].members[0];
    expect(row.cw.pct).toBeNull();
    expect(row.wsc.pct).toBeNull();
    expect(row.needsFollowUp).toBe(false);
    const csv = (await service.exportWorkbook({ year: 2026, month: 10, format: 'csv' }, { role: 'ADMINISTRATOR' }))
      .buffer.toString('utf8');
    expect(csv).toContain('—');
  });
});
