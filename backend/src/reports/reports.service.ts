import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReportQueryDto, ReportType } from './dto/report-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate attendance report
   */
  async generateAttendanceReport(query: ReportQueryDto) {
    const where: Prisma.AttendanceWhereInput = {};

    if (query.eventId) {
      where.eventId = query.eventId;
    }

    if (query.memberId) {
      where.memberId = query.memberId;
    }

    if (query.ministry) {
      where.member = {
        ministry: query.ministry,
      };
    }

    if (query.startDate || query.endDate) {
      where.checkInTime = {};
      if (query.startDate) {
        where.checkInTime.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.checkInTime.lte = endDate;
      }
    }

    const attendances = await this.prisma.attendance.findMany({
      where,
      include: {
        member: {
          include: {
            user: {
              select: {
                email: true,
                phone: true,
                role: true,
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            location: true,
            category: true,
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
    });

    // Calculate statistics
    const stats = {
      total: attendances.length,
      qrCodeCount: attendances.filter((a) => a.method === 'QR_CODE').length,
      manualCount: attendances.filter((a) => a.method === 'MANUAL').length,
      uniqueMembers: new Set(attendances.map((a) => a.memberId)).size,
      uniqueEvents: new Set(attendances.map((a) => a.eventId)).size,
    };

    return {
      data: attendances,
      statistics: stats,
      summary: {
        reportType: ReportType.ATTENDANCE,
        generatedAt: new Date(),
        filters: {
          eventId: query.eventId,
          memberId: query.memberId,
          ministry: query.ministry,
          startDate: query.startDate,
          endDate: query.endDate,
        },
      },
    };
  }

  /**
   * Generate registration report
   */
  async generateRegistrationReport(query: ReportQueryDto) {
    const where: Prisma.EventRegistrationWhereInput = {};

    if (query.eventId) {
      where.eventId = query.eventId;
    }

    if (query.ministry) {
      where.member = {
        ministry: query.ministry,
      };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const registrations = await this.prisma.eventRegistration.findMany({
      where,
      include: {
        member: {
          include: {
            user: {
              select: {
                email: true,
                phone: true,
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            location: true,
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate statistics
    const stats = {
      total: registrations.length,
      memberCount: registrations.filter((r) => r.registrationType === 'MEMBER').length,
      nonMemberCount: registrations.filter((r) => r.registrationType === 'NON_MEMBER').length,
      coupleCount: registrations.filter((r) => r.registrationType === 'COUPLE').length,
      paidCount: registrations.filter((r) => r.paymentStatus === 'PAID').length,
      pendingCount: registrations.filter((r) => r.paymentStatus === 'PENDING').length,
      totalRevenue: registrations
        .filter((r) => r.paymentStatus === 'PAID')
        .reduce((sum, r) => sum + Number(r.paymentAmount || 0), 0),
    };

    return {
      data: registrations,
      statistics: stats,
      summary: {
        reportType: ReportType.REGISTRATION,
        generatedAt: new Date(),
        filters: {
          eventId: query.eventId,
          ministry: query.ministry,
          startDate: query.startDate,
          endDate: query.endDate,
        },
      },
    };
  }

  /**
   * Generate member report
   */
  async generateMemberReport(query: ReportQueryDto) {
    const where: Prisma.MemberWhereInput = {};

    if (query.encounterType) {
      where.encounterType = query.encounterType;
    }

    if (query.ministry) {
      where.ministry = query.ministry;
    }

    if (query.city) {
      where.city = query.city;
    }

    const members = await this.prisma.member.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            role: true,
            isActive: true,
          },
        },
        attendances: {
          select: {
            id: true,
            eventId: true,
            checkInTime: true,
          },
          orderBy: {
            checkInTime: 'desc',
          },
          take: 10, // Last 10 attendances
        },
        registrations: {
          select: {
            id: true,
            eventId: true,
            registrationType: true,
            paymentStatus: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Last 10 registrations
        },
      },
      orderBy: {
        lastName: 'asc',
      },
    });

    // Calculate statistics
    const stats = {
      total: members.length,
      activeMembers: members.filter((m) => m.user.isActive).length,
      inactiveMembers: members.filter((m) => !m.user.isActive).length,
      byEncounterType: members.reduce((acc, m) => {
        acc[m.encounterType] = (acc[m.encounterType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byMinistry: members.reduce((acc, m) => {
        if (m.ministry) {
          acc[m.ministry] = (acc[m.ministry] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
      byCity: members.reduce((acc, m) => {
        acc[m.city] = (acc[m.city] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return {
      data: members,
      statistics: stats,
      summary: {
        reportType: ReportType.MEMBER,
        generatedAt: new Date(),
        filters: {
          encounterType: query.encounterType,
          ministry: query.ministry,
          city: query.city,
        },
      },
    };
  }

  /**
   * Generate event report
   */
  async generateEventReport(query: ReportQueryDto) {
    const where: Prisma.EventWhereInput = {};

    if (query.startDate || query.endDate) {
      where.startDate = {};
      if (query.startDate) {
        where.startDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.startDate.lte = endDate;
      }
    }

    if (query.encounterType) {
      where.encounterType = query.encounterType;
    }

    const events = await this.prisma.event.findMany({
      where,
      include: {
        attendances: {
          include: {
            member: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                communityId: true,
              },
            },
          },
        },
        registrations: {
          select: {
            id: true,
            registrationType: true,
            paymentStatus: true,
            paymentAmount: true,
          },
        },
        account: {
          include: {
            incomeEntries: true,
            expenseEntries: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    // Calculate statistics
    const stats = {
      total: events.length,
      upcoming: events.filter((e) => e.status === 'UPCOMING').length,
      ongoing: events.filter((e) => e.status === 'ONGOING').length,
      completed: events.filter((e) => e.status === 'COMPLETED').length,
      cancelled: events.filter((e) => e.status === 'CANCELLED').length,
      totalAttendances: events.reduce((sum, e) => sum + e.attendances.length, 0),
      totalRegistrations: events.reduce((sum, e) => sum + e.registrations.length, 0),
      totalRevenue: events.reduce((sum, e) => {
        const paidRegistrations = e.registrations.filter((r) => r.paymentStatus === 'PAID');
        return sum + paidRegistrations.reduce((s, r) => s + Number(r.paymentAmount || 0), 0);
      }, 0),
    };

    return {
      data: events,
      statistics: stats,
      summary: {
        reportType: ReportType.EVENT,
        generatedAt: new Date(),
        filters: {
          startDate: query.startDate,
          endDate: query.endDate,
          encounterType: query.encounterType,
        },
      },
    };
  }

  /**
   * Generate recurring attendance report (for Community Worship and Word Sharing Circles)
   * Ministry report: CW = Tuesdays in period; WSC = actual Event count for that ministry in period.
   * Members sorted by ME class (encounterType + classNumber), then alphabetically; PLSG/Service/Intercessory grouped by ME class.
   */
  async generateRecurringAttendanceReport(query: ReportQueryDto) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Start date and end date are required for recurring attendance reports');
    }

    // Calculate period dates
    const startDate = new Date(query.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    // Community Worship = number of Tuesdays in period (typically 4–5 per month)
    const totalCwInPeriod = this.countEventInstances('Community Worship', startDate, endDate);

    // Community Report: apostolate/ministry summary only (no per-member list). Track CW and WSC % vs registered members for analytics.
    if (query.recurringReportType === 'community') {
      return this.generateCommunitySummaryReport(query, startDate, endDate, totalCwInPeriod);
    }

    // Ministry / Individual: per-member list
    const members = await this.getMembersForReport(
      query.recurringReportType || 'community',
      query.memberId,
      query.ministry,
      query.apostolate,
    );

    const ministryFilter = query.recurringReportType === 'ministry' ? query.ministry : undefined;
    const wscTotalsByMinistry = await this.getWscEventCountsByMinistry(startDate, endDate, ministryFilter);
    const totalInstances = {
      corporateWorship: totalCwInPeriod,
      wordSharingCircles: ministryFilter
        ? wscTotalsByMinistry.get(ministryFilter || '') ?? 0
        : 0,
      wscByMinistry: wscTotalsByMinistry,
    };

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        checkInTime: { gte: startDate, lte: endDate },
      },
      include: {
        member: true,
        event: { select: { id: true, title: true, category: true } },
      },
    });

    const memberAttendance = this.calculateMemberAttendance(
      members,
      attendanceRecords,
      totalInstances,
      query.recurringReportType,
      query.ministry,
    );
    const sortedMembers = this.sortMembersForReport(memberAttendance, query.ministry);

    const totalInstancesResponse = {
      corporateWorship: totalInstances.corporateWorship,
      wordSharingCircles: totalInstances.wordSharingCircles,
      wscByMinistry: totalInstances.wscByMinistry
        ? Object.fromEntries(totalInstances.wscByMinistry)
        : undefined,
    };

    const summary = {
      totalMembers: sortedMembers.length,
      totalInstances: totalInstancesResponse,
      averageAttendance: this.calculateAverageAttendance(sortedMembers),
      totalCorporateWorshipAttended: sortedMembers.reduce(
        (sum, m) => sum + (m.corporateWorshipAttended || 0),
        0,
      ),
      totalWordSharingCirclesAttended: sortedMembers.reduce(
        (sum, m) => sum + (m.wordSharingCirclesAttended || 0),
        0,
      ),
    };

    return {
      data: sortedMembers,
      statistics: summary,
      summary: {
        reportType: ReportType.RECURRING_ATTENDANCE,
        generatedAt: new Date(),
        filters: {
          recurringReportType: query.recurringReportType,
          period: query.period,
          startDate: query.startDate,
          endDate: query.endDate,
          ministry: query.ministry,
          apostolate: query.apostolate,
          memberId: query.memberId,
        },
      },
    };
  }

  /**
   * Community Report: summary by Apostolate and Ministry (no per-member list).
   * Tracks total members per ministry, total CW/WSC attendances, and % vs 100% possible (for analytics and activity planning).
   */
  private async generateCommunitySummaryReport(
    query: ReportQueryDto,
    startDate: Date,
    endDate: Date,
    totalCwInPeriod: number,
  ) {
    const wscByMinistry = await this.getWscEventCountsByMinistry(startDate, endDate);

    const where: Prisma.MemberWhereInput = {
      apostolate: { not: null },
      ministry: { not: null },
    };
    if (query.apostolate) {
      where.apostolate = query.apostolate;
    }
    const members = await this.prisma.member.findMany({
      where,
      select: { id: true, apostolate: true, ministry: true },
    });

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        checkInTime: { gte: startDate, lte: endDate },
      },
      include: {
        member: { select: { id: true, apostolate: true, ministry: true } },
        event: { select: { id: true, title: true, category: true } },
      },
    });

    const isCwEvent = (record: { event?: { title?: string; category?: string } | null }) => {
      const t = (record.event?.title || '').toLowerCase();
      const c = (record.event?.category || '').toLowerCase();
      return (
        t.includes('community worship') ||
        t.includes('corporate worship') ||
        c.includes('community worship') ||
        c.includes('corporate worship')
      );
    };
    const isWscForMinistry = (record: { event?: { title?: string } | null }, ministry: string) => {
      const t = (record.event?.title || '').toLowerCase();
      const isWsc =
        t.includes('word sharing') || t.includes('wsc');
      if (!isWsc || !ministry) return false;
      return t.includes(ministry.toLowerCase());
    };

    const byApostolateMinistry = new Map<
      string,
      { memberIds: Set<string>; cwAttended: number; wscAttended: number; seenCw: Set<string>; seenWsc: Set<string> }
    >();
    for (const m of members) {
      const key = `${m.apostolate || ''}|${m.ministry || ''}`;
      if (!byApostolateMinistry.has(key)) {
        byApostolateMinistry.set(key, {
          memberIds: new Set(),
          cwAttended: 0,
          wscAttended: 0,
          seenCw: new Set(),
          seenWsc: new Set(),
        });
      }
      byApostolateMinistry.get(key)!.memberIds.add(m.id);
    }

    for (const rec of attendanceRecords) {
      const memberId = rec.memberId;
      const apostolate = rec.member?.apostolate;
      const ministry = rec.member?.ministry;
      if (!apostolate || !ministry) continue;
      const key = `${apostolate}|${ministry}`;
      const group = byApostolateMinistry.get(key);
      if (!group || !group.memberIds.has(memberId)) continue;

      const dateKey = new Date(rec.checkInTime).toISOString().split('T')[0];
      const eventId = rec.eventId;
      const uk = `${key}|${memberId}|${eventId}|${dateKey}`;

      if (isCwEvent(rec)) {
        if (!group.seenCw.has(uk)) {
          group.seenCw.add(uk);
          group.cwAttended += 1;
        }
      }
      if (isWscForMinistry(rec, ministry)) {
        if (!group.seenWsc.has(uk)) {
          group.seenWsc.add(uk);
          group.wscAttended += 1;
        }
      }
    }

    const data: Array<{
      apostolate: string;
      ministry: string;
      totalMembers: number;
      totalCwAttended: number;
      totalCwInPeriod: number;
      cwPercentage: number;
      totalWscAttended: number;
      totalWscInPeriod: number;
      wscPercentage: number;
    }> = [];
    const apostolateOrder = this.getApostolateOrder();
    for (const [key, group] of byApostolateMinistry) {
      const [apostolate, ministry] = key.split('|');
      const totalMembers = group.memberIds.size;
      const totalCwAttended = group.cwAttended;
      const totalWscInPeriod = wscByMinistry.get(ministry) ?? 0;
      const totalWscAttended = group.wscAttended;
      const possibleCw = totalMembers * totalCwInPeriod;
      const possibleWsc = totalMembers * totalWscInPeriod;
      const cwPercentage =
        possibleCw > 0 ? Math.round((totalCwAttended / possibleCw) * 100) : 0;
      const wscPercentage =
        possibleWsc > 0 ? Math.round((totalWscAttended / possibleWsc) * 100) : 0;
      data.push({
        apostolate: apostolate || '',
        ministry: ministry || '',
        totalMembers,
        totalCwAttended,
        totalCwInPeriod,
        cwPercentage,
        totalWscAttended,
        totalWscInPeriod,
        wscPercentage,
      });
    }

    data.sort((a, b) => {
      const aApo = apostolateOrder.indexOf(a.apostolate);
      const bApo = apostolateOrder.indexOf(b.apostolate);
      if (aApo !== -1 || bApo !== -1) {
        const aOrd = aApo === -1 ? 999 : aApo;
        const bOrd = bApo === -1 ? 999 : bApo;
        if (aOrd !== bOrd) return aOrd - bOrd;
      } else if (a.apostolate !== b.apostolate) {
        return a.apostolate.localeCompare(b.apostolate);
      }
      return a.ministry.localeCompare(b.ministry);
    });

    const totalMembersAll = data.reduce((s, r) => s + r.totalMembers, 0);
    const totalCwAttendedAll = data.reduce((s, r) => s + r.totalCwAttended, 0);
    const totalWscAttendedAll = data.reduce((s, r) => s + r.totalWscAttended, 0);
    const possibleCwAll = totalMembersAll * totalCwInPeriod;
    const possibleWscAll = data.reduce(
      (s, r) => s + r.totalMembers * r.totalWscInPeriod,
      0,
    );

    const totalInstancesResponse = {
      corporateWorship: totalCwInPeriod,
      wordSharingCircles: 0,
      wscByMinistry: Object.fromEntries(wscByMinistry),
    };

    return {
      data,
      statistics: {
        totalMinistries: data.length,
        totalMembers: totalMembersAll,
        totalInstances: totalInstancesResponse,
        totalCwAttended: totalCwAttendedAll,
        totalWscAttended: totalWscAttendedAll,
        communityCwPercentage:
          possibleCwAll > 0 ? Math.round((totalCwAttendedAll / possibleCwAll) * 100) : 0,
        communityWscPercentage:
          possibleWscAll > 0 ? Math.round((totalWscAttendedAll / possibleWscAll) * 100) : 0,
        averageCwPercentageByMinistry:
          data.length > 0
            ? Math.round(data.reduce((s, r) => s + r.cwPercentage, 0) / data.length)
            : 0,
        averageWscPercentageByMinistry:
          data.length > 0
            ? Math.round(data.reduce((s, r) => s + r.wscPercentage, 0) / data.length)
            : 0,
      },
      summary: {
        reportType: ReportType.RECURRING_ATTENDANCE,
        generatedAt: new Date(),
        filters: {
          recurringReportType: 'community',
          period: query.period,
          startDate: query.startDate,
          endDate: query.endDate,
          apostolate: query.apostolate,
        },
      },
    };
  }

  private getApostolateOrder(): string[] {
    return [
      'Pastoral Apostolate',
      'Evangelization Apostolate',
      'Formation Apostolate',
      'Management Apostolate',
      'Mission Apostolate',
    ];
  }

  /**
   * Count event instances for Community Worship (Tuesdays in period)
   */
  private countEventInstances(eventType: string, startDate: Date, endDate: Date): number {
    if (eventType === 'Community Worship') {
      let count = 0;
      const current = new Date(startDate);
      while (current <= endDate) {
        if (current.getDay() === 2) count++;
        current.setDate(current.getDate() + 1);
      }
      return count;
    }
    return 0;
  }

  /**
   * Count WSC events per ministry from Event table (ministries have different WSC days).
   * Events: category contains 'Word Sharing Circle', title contains ministry name, startDate in range.
   */
  private async getWscEventCountsByMinistry(
    startDate: Date,
    endDate: Date,
    ministryFilter?: string,
  ): Promise<Map<string, number>> {
    const events = await this.prisma.event.findMany({
      where: {
        startDate: { gte: startDate, lte: endDate },
        category: { contains: 'Word Sharing', mode: 'insensitive' },
      },
      select: { id: true, title: true },
    });

    const ministries = this.getKnownMinistries().filter((m) => !ministryFilter || m === ministryFilter);
    const byMinistry = new Map<string, number>();
    for (const e of events) {
      const title = (e.title || '').toLowerCase();
      // Assign event to one ministry: longest ministry name that appears in title (e.g. "WSC - Service Ministry -")
      let best: string | null = null;
      let bestLen = 0;
      for (const ministry of ministries) {
        const slug = ministry.toLowerCase();
        if (title.includes(slug) && slug.length > bestLen) {
          best = ministry;
          bestLen = slug.length;
        }
      }
      if (best) {
        byMinistry.set(best, (byMinistry.get(best) ?? 0) + 1);
      }
    }
    return byMinistry;
  }

  private getKnownMinistries(): string[] {
    return [
      'Pastoral Services', 'Youth Ministry', 'Singles Ministry', 'Solo Parent Ministry', 'Mark 10 Ministry',
      'Prayer Counseling and Healing Services (PCHS)', 'Marriage Encounter Program', 'Family Encounter Program',
      'Life in the Spirit Ministry', 'Praise Ministry', 'Liturgy Ministry', 'Post-LSS Group (PLSG)',
      'Teaching Ministry', 'Intercessory Ministry', 'Discipling Ministry', 'Word Ministry',
      'Witness Development Ministry', 'Coach Development Ministry', 'Service Ministry', 'Treasury Ministry',
      'Secretariat Office', 'Management Services', 'Technical Group', 'Parish Services Ministry',
      'Institutional Services Ministry', 'Scholarship of Hope Ministry', 'Nazareth Housing Program',
      'Mission Homesteads', 'Shepherds of Districts-in-Process',
    ];
  }

  /**
   * Get members based on report type
   */
  private async getMembersForReport(
    reportType: string,
    memberId?: string,
    ministry?: string,
    apostolate?: string,
  ) {
    const where: Prisma.MemberWhereInput = {};

    if (reportType === 'individual' && memberId) {
      where.communityId = memberId;
    } else if (reportType === 'ministry' && ministry) {
      where.ministry = ministry;
    } else if (reportType === 'community' && apostolate) {
      where.apostolate = apostolate;
    }

    return this.prisma.member.findMany({
      where,
      orderBy: {
        lastName: 'asc',
      },
    });
  }

  /**
   * Calculate member attendance for recurring events.
   * CW: check-ins to Community Worship. WSC: check-ins to WSC events for that member's ministry.
   * CW % = attended / total Tuesdays in period; WSC % = attended / total WSC events for ministry in period.
   */
  private calculateMemberAttendance(
    members: any[],
    attendanceRecords: any[],
    totalInstances: {
      corporateWorship: number;
      wordSharingCircles: number;
      wscByMinistry?: Map<string, number>;
    },
    recurringReportType?: string,
    reportMinistry?: string,
  ) {
    const totalCw = totalInstances.corporateWorship;
    const wscByMinistry = totalInstances.wscByMinistry ?? new Map<string, number>();

    return members.map((member) => {
      const memberAttendance = attendanceRecords.filter((r) => r.memberId === member.id);
      const uniqueAttendances = new Map<string, any>();
      memberAttendance.forEach((record) => {
        const checkInTime = new Date(record.checkInTime);
        const dateKey = checkInTime.toISOString().split('T')[0];
        const uniqueKey = `${member.id}|${record.eventId}|${dateKey}`;
        if (!uniqueAttendances.has(uniqueKey)) {
          uniqueAttendances.set(uniqueKey, record);
        } else {
          const existing = uniqueAttendances.get(uniqueKey);
          if (checkInTime < new Date(existing.checkInTime)) {
            uniqueAttendances.set(uniqueKey, record);
          }
        }
      });
      const deduplicated = Array.from(uniqueAttendances.values());

      const corporateWorshipAttended = deduplicated.filter((record) => {
        const title = (record.event?.title || '').toLowerCase();
        const category = (record.event?.category || '').toLowerCase();
        return (
          title.includes('community worship') ||
          title.includes('corporate worship') ||
          category.includes('community worship') ||
          category.includes('corporate worship')
        );
      }).length;

      const memberMinistry = (member.ministry || reportMinistry || '').trim();
      const wordSharingCirclesAttended = deduplicated.filter((record) => {
        const title = (record.event?.title || '').toLowerCase();
        const category = (record.event?.category || '').toLowerCase();
        const isWsc =
          title.includes('word sharing') ||
          title.includes('wsc') ||
          category.includes('word sharing');
        if (!isWsc) return false;
        if (!memberMinistry) return true;
        return title.includes(memberMinistry.toLowerCase());
      }).length;

      const wscTotalForMember =
        recurringReportType === 'ministry' && reportMinistry
          ? totalInstances.wordSharingCircles
          : wscByMinistry.get(memberMinistry) ?? 0;
      const corporateWorshipPercentage =
        totalCw > 0 ? Math.round((corporateWorshipAttended / totalCw) * 100) : 0;
      const wordSharingCirclesPercentage =
        wscTotalForMember > 0
          ? Math.round((wordSharingCirclesAttended / wscTotalForMember) * 100)
          : 0;
      const totalPossible = totalCw + wscTotalForMember;
      const totalAttended = corporateWorshipAttended + wordSharingCirclesAttended;
      const percentage =
        totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 100) : 0;

      const meClass = `${member.encounterType || ''}${member.classNumber ?? ''}`.trim() || undefined;
      const middleInitial =
        member.middleInitial ||
        (member.middleName ? member.middleName.charAt(0).toUpperCase() : '');

      return {
        ...member,
        middleInitial,
        meClass,
        corporateWorshipAttended,
        wordSharingCirclesAttended,
        totalCwInPeriod: totalCw,
        totalWscInPeriod: wscTotalForMember,
        totalAttended,
        totalPossible,
        percentage,
        corporateWorshipPercentage,
        wordSharingCirclesPercentage,
      };
    });
  }

  /** Ministries that are grouped by ME class (encounterType + classNumber), then alphabetically by name */
  private readonly ME_CLASS_GROUP_MINISTRIES = [
    'Post-LSS Group (PLSG)',
    'Service Ministry',
    'Intercessory Ministry',
  ];

  /**
   * Sort members: for PLSG, Service, Intercessory — by ME class (encounterType + classNumber), then alphabetically.
   * Otherwise by last name, first name.
   */
  private sortMembersForReport(members: any[], ministry?: string) {
    const groupByMeClass = ministry && this.ME_CLASS_GROUP_MINISTRIES.includes(ministry);

    if (groupByMeClass) {
      return members.sort((a, b) => {
        const aType = (a.encounterType || '').localeCompare(b.encounterType || '');
        if (aType !== 0) return aType;
        const aNum = Number(a.classNumber) ?? 0;
        const bNum = Number(b.classNumber) ?? 0;
        if (aNum !== bNum) return aNum - bNum;
        const last = (a.lastName || '').localeCompare(b.lastName || '');
        if (last !== 0) return last;
        return (a.firstName || '').localeCompare(b.firstName || '');
      });
    }

    return members.sort((a, b) => {
      const last = (a.lastName || '').localeCompare(b.lastName || '');
      if (last !== 0) return last;
      return (a.firstName || '').localeCompare(b.firstName || '');
    });
  }

  /**
   * Calculate average attendance percentage
   */
  private calculateAverageAttendance(members: any[]): number {
    if (members.length === 0) return 0;
    const totalPercentage = members.reduce((sum, member) => sum + (member.percentage || 0), 0);
    return Math.round(totalPercentage / members.length);
  }

  /**
   * Generate report based on type
   */
  async generateReport(query: ReportQueryDto) {
    if (!query.reportType) {
      throw new BadRequestException('Report type is required');
    }

    switch (query.reportType) {
      case ReportType.ATTENDANCE:
        return this.generateAttendanceReport(query);
      case ReportType.REGISTRATION:
        return this.generateRegistrationReport(query);
      case ReportType.MEMBER:
        return this.generateMemberReport(query);
      case ReportType.EVENT:
        return this.generateEventReport(query);
      case ReportType.RECURRING_ATTENDANCE:
        return this.generateRecurringAttendanceReport(query);
      default:
        throw new BadRequestException(`Invalid report type: ${query.reportType}`);
    }
  }
}

