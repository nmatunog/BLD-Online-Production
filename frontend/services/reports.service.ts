import { apiClient } from './api-client';
import { ApiResponse } from '@/types/api.types';

export enum ReportType {
  ATTENDANCE = 'ATTENDANCE',
  REGISTRATION = 'REGISTRATION',
  MEMBER = 'MEMBER',
  EVENT = 'EVENT',
  RECURRING_ATTENDANCE = 'RECURRING_ATTENDANCE',
}

export enum RecurringReportType {
  INDIVIDUAL = 'individual',
  MINISTRY = 'ministry',
  COMMUNITY = 'community',
}

export enum PeriodType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YTD = 'ytd',
  ANNUAL = 'annual',
}

export enum ExportFormat {
  CSV = 'CSV',
  PDF = 'PDF',
  EXCEL = 'EXCEL',
}

export interface ReportQueryParams {
  reportType: ReportType;
  eventId?: string;
  memberId?: string;
  startDate?: string;
  endDate?: string;
  encounterType?: string;
  ministry?: string;
  city?: string;
  format?: ExportFormat;
  // Recurring attendance report fields
  recurringReportType?: RecurringReportType;
  period?: PeriodType;
  apostolate?: string;
}

export interface AttendanceReport {
  data: Array<{
    id: string;
    memberId: string;
    eventId: string;
    checkInTime: string;
    method: 'QR_CODE' | 'MANUAL';
    member: {
      id: string;
      firstName: string;
      lastName: string;
      nickname?: string;
      communityId: string;
      user: {
        email?: string;
        phone?: string;
        role: string;
      };
    };
    event: {
      id: string;
      title: string;
      startDate: string;
      endDate: string;
      location: string;
      category: string;
    };
  }>;
  statistics: {
    total: number;
    qrCodeCount: number;
    manualCount: number;
    uniqueMembers: number;
    uniqueEvents: number;
  };
  summary: {
    reportType: ReportType;
    generatedAt: string;
    filters: Record<string, any>;
  };
}

export interface RegistrationReport {
  data: Array<{
    id: string;
    eventId: string;
    memberId?: string;
    registrationType: 'MEMBER' | 'NON_MEMBER' | 'COUPLE';
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED';
    paymentAmount?: number;
    roomAssignment?: string;
    member?: {
      id: string;
      communityId: string;
    };
    event: {
      id: string;
      title: string;
      startDate: string;
      endDate: string;
      location: string;
      category: string;
    };
  }>;
  statistics: {
    total: number;
    memberCount: number;
    nonMemberCount: number;
    coupleCount: number;
    paidCount: number;
    pendingCount: number;
    totalRevenue: number;
  };
  summary: {
    reportType: ReportType;
    generatedAt: string;
    filters: Record<string, any>;
  };
}

export interface MemberReport {
  data: Array<{
    id: string;
    firstName: string;
    lastName: string;
    nickname?: string;
    communityId: string;
    city: string;
    encounterType: string;
    classNumber: number;
    ministry?: string;
    apostolate?: string;
    user: {
      email?: string;
      phone?: string;
      role: string;
      isActive: boolean;
    };
    attendances: Array<{
      id: string;
      eventId: string;
      checkInTime: string;
    }>;
    registrations: Array<{
      id: string;
      eventId: string;
      registrationType: string;
      paymentStatus: string;
      createdAt: string;
    }>;
  }>;
  statistics: {
    total: number;
    activeMembers: number;
    inactiveMembers: number;
    byEncounterType: Record<string, number>;
    byMinistry: Record<string, number>;
    byCity: Record<string, number>;
  };
  summary: {
    reportType: ReportType;
    generatedAt: string;
    filters: Record<string, any>;
  };
}

export interface EventReport {
  data: Array<{
    id: string;
    title: string;
    category: string;
    startDate: string;
    endDate: string;
    location: string;
    status: string;
    attendances: Array<{
      id: string;
      member: {
        id: string;
        firstName: string;
        lastName: string;
        nickname?: string;
        communityId: string;
      };
    }>;
    registrations: Array<{
      id: string;
      registrationType: string;
      paymentStatus: string;
      paymentAmount?: number;
    }>;
    account?: {
      incomeEntries: Array<any>;
      expenseEntries: Array<any>;
    };
  }>;
  statistics: {
    total: number;
    upcoming: number;
    ongoing: number;
    completed: number;
    cancelled: number;
    totalAttendances: number;
    totalRegistrations: number;
    totalRevenue: number;
  };
  summary: {
    reportType: ReportType;
    generatedAt: string;
    filters: Record<string, any>;
  };
}

export interface RecurringAttendanceReport {
  data: Array<{
    id: string;
    communityId: string;
    firstName: string;
    lastName: string;
    middleInitial?: string;
    ministry?: string;
    apostolate?: string;
    corporateWorshipAttended: number;
    wordSharingCirclesAttended: number;
    totalAttended: number;
    totalPossible: number;
    percentage: number;
    corporateWorshipPercentage: number;
    wordSharingCirclesPercentage: number;
  }>;
  statistics: {
    totalMembers: number;
    totalInstances: {
      corporateWorship: number;
      wordSharingCircles: number;
    };
    averageAttendance: number;
    totalCorporateWorshipAttended: number;
    totalWordSharingCirclesAttended: number;
  };
  summary: {
    reportType: ReportType;
    generatedAt: string;
    filters: Record<string, any>;
  };
}

export type ReportResult = AttendanceReport | RegistrationReport | MemberReport | EventReport | RecurringAttendanceReport;

class ReportsService {
  async generateReport(params: ReportQueryParams): Promise<{ success: boolean; data: ReportResult }> {
    const response = await apiClient.get<ApiResponse<ReportResult>>('/reports', { params });
    const apiResponse = response.data as ApiResponse<ReportResult>;
    return {
      success: true,
      data: apiResponse.data!,
    };
  }

  async generateAttendanceReport(params: Omit<ReportQueryParams, 'reportType'>): Promise<{ success: boolean; data: AttendanceReport }> {
    const response = await apiClient.get<ApiResponse<AttendanceReport>>('/reports/attendance', { params });
    return {
      success: true,
      data: response.data.data!,
    };
  }

  async generateRegistrationReport(params: Omit<ReportQueryParams, 'reportType'>): Promise<{ success: boolean; data: RegistrationReport }> {
    const response = await apiClient.get<ApiResponse<RegistrationReport>>('/reports/registration', { params });
    return {
      success: true,
      data: response.data.data!,
    };
  }

  async generateMemberReport(params: Omit<ReportQueryParams, 'reportType'>): Promise<{ success: boolean; data: MemberReport }> {
    const response = await apiClient.get<ApiResponse<MemberReport>>('/reports/member', { params });
    return {
      success: true,
      data: response.data.data!,
    };
  }

  async generateEventReport(params: Omit<ReportQueryParams, 'reportType'>): Promise<{ success: boolean; data: EventReport }> {
    const response = await apiClient.get<ApiResponse<EventReport>>('/reports/event', { params });
    return {
      success: true,
      data: response.data.data!,
    };
  }

  /**
   * Export report data to CSV
   */
  exportToCSV(data: any[], filename: string): void {
    if (!data || data.length === 0) {
      return;
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle nested objects and arrays
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          // Escape commas and quotes
          const stringValue = String(value).replace(/"/g, '""');
          return `"${stringValue}"`;
        }).join(',')
      ),
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const reportsService = new ReportsService();

