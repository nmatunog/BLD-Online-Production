import { apiClient } from './api-client';
import { ApiResponse } from '@/types/api.types';

function ensureBody<T>(response: { data?: ApiResponse<T> }): ApiResponse<T> {
  const body = response?.data;
  if (body == null) {
    return { success: false, error: 'Empty response from server' };
  }
  return body;
}

export interface Attendance {
  id: string;
  memberId: string;
  eventId: string;
  checkInTime: string;
  method: 'QR_CODE' | 'MANUAL';
  member: {
    id: string;
    firstName: string;
    lastName: string;
    nickname: string | null;
    communityId: string;
    user: {
      email: string | null;
      phone: string | null;
      role: string;
      isActive: boolean;
    };
  };
  event: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    location: string;
    venue: string | null;
    status?: string;
  };
}

export interface CheckInRequest {
  memberId?: string;
  communityId?: string;
  eventId: string;
  method?: 'QR_CODE' | 'MANUAL';
}

export interface AttendanceQueryParams {
  eventId?: string;
  memberId?: string;
  communityId?: string;
  dateFrom?: string;
  dateTo?: string;
  eventStatus?: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  sortBy?: 'checkedInAt' | 'memberName' | 'eventTitle';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

class AttendanceService {
  async checkIn(data: CheckInRequest): Promise<ApiResponse<Attendance>> {
    if (data.communityId) {
      const response = await apiClient.post<ApiResponse<Attendance>>(
        '/attendance/check-in/qr',
        {
          communityId: data.communityId,
          eventId: data.eventId,
        },
      );
      return ensureBody(response);
    } else {
      const response = await apiClient.post<ApiResponse<Attendance>>(
        '/attendance/check-in',
        {
          memberId: data.memberId,
          eventId: data.eventId,
          method: data.method || 'MANUAL',
        },
      );
      return ensureBody(response);
    }
  }

  async getAll(params?: AttendanceQueryParams): Promise<ApiResponse<{ data: Attendance[]; pagination: unknown }>> {
    const response = await apiClient.get<ApiResponse<{ data: Attendance[]; pagination: unknown }>>(
      '/attendance',
      { params },
    );
    return ensureBody(response);
  }

  async getByEvent(eventId: string): Promise<ApiResponse<Attendance[]>> {
    const response = await apiClient.get<ApiResponse<Attendance[]>>(`/attendance/event/${eventId}`);
    return ensureBody(response);
  }

  async getByMember(memberId: string): Promise<ApiResponse<Attendance[]>> {
    const response = await apiClient.get<ApiResponse<Attendance[]>>(`/attendance/member/${memberId}`);
    return ensureBody(response);
  }

  async getMe(): Promise<ApiResponse<Attendance[]>> {
    const response = await apiClient.get<ApiResponse<Attendance[]>>('/attendance/me');
    return ensureBody(response);
  }

  async remove(id: string): Promise<ApiResponse<Attendance>> {
    const response = await apiClient.delete<ApiResponse<Attendance>>(`/attendance/${id}`);
    return ensureBody(response);
  }

  async getEventStats(eventId: string): Promise<ApiResponse<{ total: number; qrCodeCount: number; manualCount: number }>> {
    const response = await apiClient.get<ApiResponse<{ total: number; qrCodeCount: number; manualCount: number }>>(
      `/attendance/event/${eventId}/stats`
    );
    return ensureBody(response);
  }
}

export const attendanceService = new AttendanceService();

