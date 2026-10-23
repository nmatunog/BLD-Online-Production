import { ForbiddenException, Injectable } from '@nestjs/common';
import { EventKind, EventSeriesCode } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../common/prisma/prisma.service';
import { getManilaDateParts, manilaYearBounds } from '../common/utils/manila-date.helper';
import {
  UNASSIGNED_MINISTRY,
  averagePct,
  compareMinistries,
  countAttendedHeld,
  countAttendedHeldFromEvents,
  eventsInManilaMonth,
  formatMemberReportName,
  isCwEvent,
  isReportableOccurrence,
  isSessionHeld,
  isWscEvent,
  mapMonthWeekSlots,
  needsFollowUp,
  resolveAttendanceMonitoringMinistry,
  sessionStatus,
  wscEventsForMinistry,
  type SessionEventInput,
} from './attendance-monitoring.helpers';
import type { AttendanceMonitoringReport } from './attendance-monitoring.types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

@Injectable()
export class AttendanceMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(
    query: { year: number; month?: number; ministry?: string },
    user: { role?: string | null; ministry?: string | null },
  ): Promise<AttendanceMonitoringReport> {
    const scope = resolveAttendanceMonitoringMinistry(user, query.ministry);
    if (scope.forbidden) {
      throw new ForbiddenException('Attendance Monitoring is available to administrators only.');
    }

    const year = query.year;
    const month = query.month ?? null;
    const ministryFilter = scope.ministry;

    const { start, end } = manilaYearBounds(year);
    const generatedAt = new Date();

    const [members, events] = await Promise.all([
      this.prisma.member.findMany({
        where: {
          user: { isActive: true },
          ...(ministryFilter ? { ministry: ministryFilter } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          ministry: true,
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.event.findMany({
        where: {
          startDate: { gte: start, lte: end },
          eventKind: { not: EventKind.SERIES },
          ...(ministryFilter
            ? {
                OR: [
                  { seriesCode: EventSeriesCode.CW },
                  {
                    seriesCode: EventSeriesCode.WSC,
                    OR: [{ ministry: ministryFilter }, { ministry: null }],
                  },
                ],
              }
            : { seriesCode: { in: [EventSeriesCode.CW, EventSeriesCode.WSC] } }),
        },
        select: {
          id: true,
          startDate: true,
          status: true,
          seriesCode: true,
          ministry: true,
          eventKind: true,
          _count: { select: { attendances: true } },
        },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    const eventIds = events.map((e) => e.id);
    const attendanceRows = eventIds.length
      ? await this.prisma.attendance.findMany({
          where: { eventId: { in: eventIds } },
          select: { memberId: true, eventId: true },
        })
      : [];

    const attendedByMember = new Map<string, Set<string>>();
    for (const row of attendanceRows) {
      let set = attendedByMember.get(row.memberId);
      if (!set) {
        set = new Set();
        attendedByMember.set(row.memberId, set);
      }
      set.add(row.eventId);
    }

    const sessions: SessionEventInput[] = events.map((e) => ({
      id: e.id,
      startDate: e.startDate,
      status: e.status,
      seriesCode: e.seriesCode,
      ministry: e.ministry,
      eventKind: e.eventKind,
      checkInCount: e._count.attendances,
    }));

    const reportable = sessions.filter(isReportableOccurrence);
    const allCw = reportable.filter(isCwEvent);
    const allWsc = reportable.filter(isWscEvent);

    const periodCw = month ? eventsInManilaMonth(allCw, year, month) : allCw;
    const periodWscAll = month ? eventsInManilaMonth(allWsc, year, month) : allWsc;

    const cwWeekSlots = mapMonthWeekSlots(periodCw);

    const wscMinistries = new Set<string>();
    for (const m of members) {
      wscMinistries.add(m.ministry?.trim() || UNASSIGNED_MINISTRY);
    }
    if (!ministryFilter) {
      for (const e of periodWscAll) {
        if (e.ministry) wscMinistries.add(e.ministry);
      }
    }

    const wscByMinistrySlots: Record<string, ReturnType<typeof mapMonthWeekSlots>> = {};
    for (const ministryName of wscMinistries) {
      const key = ministryName === UNASSIGNED_MINISTRY ? null : ministryName;
      wscByMinistrySlots[ministryName] = mapMonthWeekSlots(
        wscEventsForMinistry(periodWscAll, key),
      );
    }
    const periodWscForSummary = ministryFilter
      ? wscEventsForMinistry(periodWscAll, ministryFilter)
      : periodWscAll;

    const nowParts = getManilaDateParts(generatedAt);
    const ytdThroughMonth = month ?? (nowParts.year === year ? nowParts.month : 12);
    const ytdCw = allCw.filter((e) => {
      const parts = getManilaDateParts(e.startDate);
      return parts.month <= ytdThroughMonth;
    });

    const groupsMap = new Map<string, typeof members>();
    for (const member of members) {
      const key = member.ministry?.trim() || UNASSIGNED_MINISTRY;
      const list = groupsMap.get(key) ?? [];
      list.push(member);
      groupsMap.set(key, list);
    }

    const groups = [...groupsMap.entries()]
      .sort(([a], [b]) => compareMinistries(a, b))
      .map(([ministryName, groupMembers]) => {
        const wscSlots = wscByMinistrySlots[ministryName] ?? [];
        const ytdWscEvents = (() => {
          const key = ministryName === UNASSIGNED_MINISTRY ? null : ministryName;
          return wscEventsForMinistry(allWsc, key).filter(
            (e) => getManilaDateParts(e.startDate).month <= ytdThroughMonth,
          );
        })();

        const rows = groupMembers.map((member) => {
          const attended = attendedByMember.get(member.id) ?? new Set<string>();
          const cw = countAttendedHeld(cwWeekSlots, attended);
          const wsc = countAttendedHeld(wscSlots, attended);
          const ytdCwStats = countAttendedHeldFromEvents(ytdCw, attended);
          const ytdWscStats = countAttendedHeldFromEvents(ytdWscEvents, attended);
          return {
            id: member.id,
            name: formatMemberReportName(member),
            firstName: member.firstName,
            lastName: member.lastName,
            ministry: member.ministry,
            cw,
            wsc,
            ytdCw: ytdCwStats,
            ytdWsc: ytdWscStats,
            needsFollowUp: needsFollowUp(cw.pct, wsc.pct),
          };
        });

        return {
          ministry: ministryName,
          avgCwPct: averagePct(rows.map((r) => r.cw.pct)),
          avgWscPct: averagePct(rows.map((r) => r.wsc.pct)),
          avgYtdCwPct: averagePct(rows.map((r) => r.ytdCw.pct)),
          avgYtdWscPct: averagePct(rows.map((r) => r.ytdWsc.pct)),
          members: rows,
        };
      });

    const allRows = groups.flatMap((g) => g.members);
    const uniqueHeldIds = new Set<string>();
    const uniqueCancelledIds = new Set<string>();
    for (const e of [...periodCw, ...periodWscForSummary]) {
      const status = sessionStatus(e);
      if (status === 'held') uniqueHeldIds.add(e.id);
      if (status === 'cancelled') uniqueCancelledIds.add(e.id);
    }

    return {
      year,
      month,
      ministry: ministryFilter,
      timezone: 'Asia/Manila',
      generatedAt: generatedAt.toISOString(),
      summary: {
        members: allRows.length,
        ministries: groups.filter((g) => g.ministry !== UNASSIGNED_MINISTRY || g.members.length > 0)
          .length,
        avgCwPct: averagePct(allRows.map((r) => r.cw.pct)),
        avgWscPct: averagePct(allRows.map((r) => r.wsc.pct)),
        ytdAvgCwPct: averagePct(allRows.map((r) => r.ytdCw.pct)),
        ytdAvgWscPct: averagePct(allRows.map((r) => r.ytdWsc.pct)),
        sessionsHeld: uniqueHeldIds.size,
        cwHeld: periodCw.filter(isSessionHeld).length,
        wscHeld: periodWscForSummary.filter(isSessionHeld).length,
        cancelled: uniqueCancelledIds.size,
      },
      weeks: {
        cw: cwWeekSlots,
        wscByMinistry: wscByMinistrySlots,
      },
      groups,
    };
  }

  async exportWorkbook(
    query: { year: number; month?: number; ministry?: string; format?: 'xlsx' | 'csv' },
    user: { role?: string | null; ministry?: string | null },
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const report = await this.getReport(query, user);
    const format = query.format ?? 'xlsx';
    const periodLabel = this.periodLabel(report.year, report.month);
    const ministryLabel = report.ministry || 'All';
    const baseName = `BLD Attendance Monitoring ${periodLabel}`;

    if (format === 'csv') {
      const csv = this.toCsv(report);
      return {
        buffer: Buffer.from(csv, 'utf8'),
        filename: `${baseName}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    const buffer = await this.toXlsx(report, periodLabel, ministryLabel);
    return {
      buffer,
      filename: `${baseName}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  periodLabel(year: number, month: number | null): string {
    if (!month) return String(year);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }

  private formatPct(pct: number | null): string {
    return pct == null ? 'n/a' : `${pct}%`;
  }

  private formatAttHeld(attended: number, held: number): string {
    return held === 0 ? 'n/a' : `${attended}/${held}`;
  }

  private toCsv(report: AttendanceMonitoringReport): string {
    const headers = [
      'Member',
      'Ministry',
      'CW att/held',
      'CW %',
      'WSC att/held',
      'WSC %',
      'YTD CW %',
      'YTD WSC %',
      'Needs follow-up',
    ];
    const lines = [headers.join(',')];
    for (const group of report.groups) {
      for (const member of group.members) {
        lines.push(
          [
            csvCell(member.name),
            csvCell(group.ministry),
            csvCell(this.formatAttHeld(member.cw.attended, member.cw.held)),
            csvCell(this.formatPct(member.cw.pct)),
            csvCell(this.formatAttHeld(member.wsc.attended, member.wsc.held)),
            csvCell(this.formatPct(member.wsc.pct)),
            csvCell(this.formatPct(member.ytdCw.pct)),
            csvCell(this.formatPct(member.ytdWsc.pct)),
            member.needsFollowUp ? 'yes' : '',
          ].join(','),
        );
      }
      lines.push(
        [
          csvCell(`${group.ministry} average`),
          '',
          '',
          csvCell(this.formatPct(group.avgCwPct)),
          '',
          csvCell(this.formatPct(group.avgWscPct)),
          csvCell(this.formatPct(group.avgYtdCwPct)),
          csvCell(this.formatPct(group.avgYtdWscPct)),
          '',
        ].join(','),
      );
    }
    return lines.join('\n');
  }

  private async toXlsx(
    report: AttendanceMonitoringReport,
    periodLabel: string,
    ministryLabel: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BLD Online';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Attendance', {
      views: [{ state: 'frozen', ySplit: 5, xSplit: 1 }],
    });

    sheet.mergeCells('A1:H1');
    sheet.getCell('A1').value = 'BLD Cebu — Attendance Report';
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1E3A5F' } };

    sheet.mergeCells('A2:H2');
    sheet.getCell('A2').value = 'Community Worship (CW) & WSC';
    sheet.getCell('A2').font = { size: 11, color: { argb: 'FF334155' } };

    sheet.getCell('A3').value = `Period: ${periodLabel}`;
    sheet.getCell('C3').value = `Ministry: ${ministryLabel}`;
    sheet.getCell('F3').value = `Generated: ${formatGeneratedManila(report.generatedAt)}`;

    sheet.getCell('A4').value = `Members: ${report.summary.members}`;
    sheet.getCell('C4').value = `Avg CW: ${this.formatPct(report.summary.avgCwPct)} (YTD ${this.formatPct(report.summary.ytdAvgCwPct)})`;
    sheet.getCell('E4').value = `Avg WSC: ${this.formatPct(report.summary.avgWscPct)} (YTD ${this.formatPct(report.summary.ytdAvgWscPct)})`;
    sheet.getCell('G4').value = `Sessions held / cancelled: ${report.summary.sessionsHeld} / ${report.summary.cancelled}`;

    const header = sheet.addRow([
      'Member',
      'Ministry',
      'CW att/held',
      'CW %',
      'WSC att/held',
      'WSC %',
      'YTD CW %',
      'YTD WSC %',
    ]);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { vertical: 'middle' };
    });

    for (const group of report.groups) {
      for (const member of group.members) {
        const row = sheet.addRow([
          member.name,
          group.ministry,
          this.formatAttHeld(member.cw.attended, member.cw.held),
          this.formatPct(member.cw.pct),
          this.formatAttHeld(member.wsc.attended, member.wsc.held),
          this.formatPct(member.wsc.pct),
          this.formatPct(member.ytdCw.pct),
          this.formatPct(member.ytdWsc.pct),
        ]);
        if (member.needsFollowUp) {
          const cwCell = row.getCell(4);
          const wscCell = row.getCell(6);
          if (member.cw.pct != null && member.cw.pct < 50) {
            cwCell.font = { color: { argb: 'FFC2410C' }, bold: true };
          }
          if (member.wsc.pct != null && member.wsc.pct < 50) {
            wscCell.font = { color: { argb: 'FFC2410C' }, bold: true };
          }
        }
      }
      const avg = sheet.addRow([
        `${group.ministry} average`,
        '',
        '',
        this.formatPct(group.avgCwPct),
        '',
        this.formatPct(group.avgWscPct),
        this.formatPct(group.avgYtdCwPct),
        this.formatPct(group.avgYtdWscPct),
      ]);
      avg.font = { bold: true };
      avg.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      });
    }

    sheet.addRow([]);
    sheet.addRow([
      'Legend: % = attended ÷ sessions held; cancelled sessions are excluded. YTD = January to date. Orange = below 50% (follow-up suggested).',
    ]);
    sheet.mergeCells(`A${sheet.lastRow!.number}:H${sheet.lastRow!.number}`);

    sheet.columns = [
      { width: 28 },
      { width: 22 },
      { width: 14 },
      { width: 10 },
      { width: 14 },
      { width: 10 },
      { width: 12 },
      { width: 12 },
    ];

    const out = await workbook.xlsx.writeBuffer();
    return Buffer.from(out);
  }
}

function csvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatGeneratedManila(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export { MONTH_NAMES };
