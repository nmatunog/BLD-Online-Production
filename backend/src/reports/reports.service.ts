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

    // Count event instances for Community Worship (Tuesdays) and Word Sharing Circles (Thursdays)
    const totalInstances = {
      corporateWorship: this.countEventInstances('Community Worship', startDate, endDate),
      wordSharingCircles: this.countEventInstances('Word Sharing Circles', startDate, endDate),
    };

    // Get members based on report type
    const members = await this.getMembersForReport(
      query.recurringReportType || 'community',
      query.memberId,
      query.ministry,
      query.apostolate,
    );

    // Get attendance records for the period
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        checkInTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        member: true,
        event: {
          select: {
            title: true,
            category: true,
          },
        },
      },
    });

    // Calculate member attendance
    const memberAttendance = this.calculateMemberAttendance(
      members,
      attendanceRecords,
      totalInstances,
    );

    // Sort members according to ministry rules
    const sortedMembers = this.sortMembersForReport(memberAttendance, query.ministry);

    // Calculate summary statistics
    const summary = {
      totalMembers: sortedMembers.length,
      totalInstances,
      averageAttendance: this.calculateAverageAttendance(sortedMembers),
      totalCorporateWorshipAttended: sortedMembers.reduce(
        (sum, member) => sum + (member.corporateWorshipAttended || 0),
        0,
      ),
      totalWordSharingCirclesAttended: sortedMembers.reduce(
        (sum, member) => sum + (member.wordSharingCirclesAttended || 0),
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
   * Count event instances for recurring events
   */
  private countEventInstances(eventType: string, startDate: Date, endDate: Date): number {
    if (eventType === 'Community Worship') {
      // Community Worship happens on Tuesdays (day 2)
      let count = 0;
      const current = new Date(startDate);
      while (current <= endDate) {
        if (current.getDay() === 2) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      return count;
    } else if (eventType === 'Word Sharing Circles') {
      // Word Sharing Circles happens on Thursdays (day 4)
      let count = 0;
      const current = new Date(startDate);
      while (current <= endDate) {
        if (current.getDay() === 4) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      return count;
    }
    return 0;
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
   * Calculate member attendance for recurring events
   */
  private calculateMemberAttendance(
    members: any[],
    attendanceRecords: any[],
    totalInstances: { corporateWorship: number; wordSharingCircles: number },
  ) {
    return members.map((member) => {
      const memberAttendance = attendanceRecords.filter(
        (record) => record.memberId === member.id,
      );

      // Deduplicate attendance records: same member + same event + same date = one attendance
      const uniqueAttendances = new Map<string, any>();
      memberAttendance.forEach((record) => {
        const checkInTime = new Date(record.checkInTime);
        const dateKey = checkInTime.toISOString().split('T')[0]; // YYYY-MM-DD
        const eventTitle = (record.event?.title || '').toLowerCase().trim();
        const eventCategory = (record.event?.category || '').toLowerCase().trim();

        const uniqueKey = `${member.id}|${eventTitle}|${eventCategory}|${dateKey}`;

        if (!uniqueAttendances.has(uniqueKey)) {
          uniqueAttendances.set(uniqueKey, record);
        } else {
          const existing = uniqueAttendances.get(uniqueKey);
          const existingTime = new Date(existing.checkInTime);
          if (checkInTime < existingTime) {
            uniqueAttendances.set(uniqueKey, record);
          }
        }
      });

      const deduplicatedAttendance = Array.from(uniqueAttendances.values());

      // Count Community Worship and Word Sharing Circles attendance
      const corporateWorshipAttended = deduplicatedAttendance.filter((record) => {
        const title = (record.event?.title || '').toLowerCase();
        const category = (record.event?.category || '').toLowerCase();
        return (
          title.includes('corporate worship') ||
          title.includes('corporate') ||
          category.includes('corporate worship') ||
          title === 'corporate worship'
        );
      }).length;

      const wordSharingCirclesAttended = deduplicatedAttendance.filter((record) => {
        const title = (record.event?.title || '').toLowerCase();
        const category = (record.event?.category || '').toLowerCase();
        return (
          title.includes('word sharing') ||
          title.includes('wsc') ||
          category.includes('word sharing') ||
          title === 'word sharing circles' ||
          title === 'word sharing circle'
        );
      }).length;

      const totalAttended = corporateWorshipAttended + wordSharingCirclesAttended;
      const totalPossible = totalInstances.corporateWorship + totalInstances.wordSharingCircles;
      const percentage = totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 100) : 0;

      const corporateWorshipPercentage =
        totalInstances.corporateWorship > 0
          ? Math.round((corporateWorshipAttended / totalInstances.corporateWorship) * 100)
          : 0;

      const wordSharingCirclesPercentage =
        totalInstances.wordSharingCircles > 0
          ? Math.round((wordSharingCirclesAttended / totalInstances.wordSharingCircles) * 100)
          : 0;

      // Extract middleInitial from middleName if not already set
      const middleInitial = member.middleInitial || 
        (member.middleName ? member.middleName.charAt(0).toUpperCase() : '');

      return {
        ...member,
        middleInitial,
        corporateWorshipAttended,
        wordSharingCirclesAttended,
        totalAttended,
        totalPossible,
        percentage,
        corporateWorshipPercentage,
        wordSharingCirclesPercentage,
      };
    });
  }

  /**
   * Sort members according to ministry rules
   */
  private sortMembersForReport(members: any[], ministry?: string) {
    if (ministry && ['PLSG', 'Service', 'Intercessory'].includes(ministry)) {
      // Sort by ME Class No., then alphabetically
      return members.sort((a, b) => {
        const aClass = parseInt(a.meClassNo || '0') || 0;
        const bClass = parseInt(b.meClassNo || '0') || 0;

        if (aClass !== bClass) {
          return aClass - bClass;
        }

        const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
        if (lastNameCompare !== 0) {
          return lastNameCompare;
        }

        return (a.firstName || '').localeCompare(b.firstName || '');
      });
    }

    // Default: sort alphabetically by last name, then first name
    return members.sort((a, b) => {
      const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
      if (lastNameCompare !== 0) {
        return lastNameCompare;
      }
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

